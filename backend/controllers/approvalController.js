const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// استيراد مكتبة arabic-reshaper لمعالجة النصوص العربية

// دالة محسنة لمعالجة النص العربي مع arabic-reshaper
const processArabicText = (text) => {
  if (!text || typeof text !== 'string') return text;
  
  // تنظيف المسافات المتعددة
  let cleaned = text.replace(/\s+/g, ' ').trim();
  
  // تحسين عرض النص العربي في PDF
  const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
  if (arabicPattern.test(cleaned)) {
    try {
      // استخدام arabic-reshaper لمعالجة النص العربي
      // التحقق من وجود الدالة أولاً
      if (typeof arabicReshaper.reshape === 'function') {
        const reshapedText = arabicReshaper.reshape(cleaned);
        console.log('🔍 Original Arabic text:', cleaned);
        console.log('🔍 Reshaped Arabic text:', reshapedText);
        return reshapedText;
      } else {
        console.warn('⚠️ arabicReshaper.reshape is not a function, using manual processing');
        throw new Error('reshape function not available');
      }
    } catch (error) {
      console.warn('⚠️ Error reshaping Arabic text:', error.message);
      // إذا فشل arabic-reshaper، استخدم المعالجة اليدوية المحسنة
      // إزالة المسافات الصغيرة التي تم إضافتها سابقاً
      cleaned = cleaned.replace(/\u200B/g, '');
      cleaned = cleaned.replace(/\u200C/g, '');
      cleaned = cleaned.replace(/\u200D/g, '');
      
      // تحسين المسافات بين الكلمات العربية
      cleaned = cleaned.replace(/\s+/g, ' ');
      
      // لا نضيف مسافات صغيرة بين الحروف لأنها تمنع الاتصال
      // بدلاً من ذلك، نترك النص كما هو للسماح للخط بالتعامل مع الاتصال
      
      console.log('🔍 Manually processed Arabic text:', cleaned);
      return cleaned;
    }
  }
  
  return cleaned;
};

const { logAction } = require('../models/logger');

// دالة تجهيز النص العربي مع تحسينات إضافية
const prepareArabic = (text) => {
  if (!text || typeof text !== 'string') return text;
  
  // استخدام الدالة الجديدة لمعالجة النص العربي
  let processed = processArabicText(text);
  
  // تحسينات إضافية للنص العربي
  const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
  if (arabicPattern.test(processed)) {
    // إزالة المسافات الزائدة في بداية ونهاية النص
    processed = processed.trim();
    
    // تحسين المسافات بين الكلمات العربية
    processed = processed.replace(/\s+/g, ' ');
    
    // إزالة أي مسافات صغيرة متبقية
    processed = processed.replace(/\u200B/g, '');
    processed = processed.replace(/\u200C/g, '');
    processed = processed.replace(/\u200D/g, '');
    
    // تحسين عرض النص العربي بإضافة مسافات مناسبة
    processed = processed.replace(/([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF])\s+([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF])/g, '$1 $2');
    
    // تحسين إضافي للنص العربي - إضافة مسافات صغيرة بين الحروف المتصلة
    // ولكن بطريقة لا تمنع الاتصال
    processed = processed.replace(/([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF])(?=[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF])/g, '$1\u200E');
    
    console.log('🔍 Final processed Arabic text:', processed);
  }
  
  return processed;
};

const { insertNotification, sendProxyNotification, sendOwnerApprovalNotification, sendPartialApprovalNotification } = require('../models/notfications-utils');

require('dotenv').config();

// قاعدة البيانات
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// متغير global مؤقت لحفظ علاقات التفويض الدائم (userId -> delegateeId)
const globalProxies = {};
// متغير global لحفظ علاقات التفويض الدائم (delegateeId -> delegatorId)
const globalPermanentDelegations = {};

// دالة endpoint لتفعيل التفويض الدائم (تُستدعى عند موافقة المفوض له في صفحة sign)
// مثال: POST /api/proxy/activate { userId, delegateeId }
const activateProxy = (req, res) => {
  const { userId, delegateeId } = req.body;
  if (!userId || !delegateeId) return res.status(400).json({ status: 'error', message: 'بيانات ناقصة' });
  globalProxies[userId] = delegateeId;
  res.json({ status: 'success', message: 'تم تفعيل التفويض الدائم مؤقتاً' });
};

// تعديل دالة getUserPendingApprovals
const getUserPendingApprovals = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    // تحقق إذا كان المستخدم مفوض له من active_delegations
    const [delegationRows] = await db.execute(
      'SELECT user_id FROM active_delegations WHERE delegate_id = ?',
      [userId]
    );

    let rows = [];

    if (delegationRows.length) {
      // المستخدم مفوض له - سيظهر له الملف مرة واحدة وسيعتمد مرتين تلقائياً
      const delegatorId = delegationRows[0].user_id;
      
      // جلب الملفات المكلف بها المستخدم (شخصياً أو بالنيابة) مع التحقق من التسلسل
      const [delegatedRows] = await db.execute(`
        SELECT 
          CONCAT('dept-', c.id) AS id, 
          c.title, 
          c.file_path, 
          c.notes, 
          c.approval_status, 
          CAST(c.approvers_required AS CHAR) AS approvers_required,
          c.approvals_log, 
          c.created_at,
          c.start_date,
          c.end_date,
          f.name AS folderName,
          COALESCE(d.name, '-') AS source_name,
          COALESCE(d.type, 'department') AS department_type,
          GROUP_CONCAT(DISTINCT u2.username ORDER BY ca.sequence_number) AS assigned_approvers,
          'dual' AS signature_type,
          ca.sequence_number
        FROM contents c
        JOIN folders f ON c.folder_id = f.id
        LEFT JOIN departments d ON f.department_id = d.id
        JOIN content_approvers ca ON ca.content_id = c.id
        LEFT JOIN users u2 ON ca.user_id = u2.id
        WHERE c.is_approved = 0
          AND ca.user_id = ?
          AND NOT EXISTS (
            SELECT 1 FROM approval_logs
            WHERE content_id = c.id
              AND approver_id = ?
              AND status = 'approved'
          )
          AND (
            -- التحقق من أن جميع المعتمدين السابقين قد وقعوا
            ca.sequence_number = 1 
            OR (
              SELECT COUNT(*) FROM content_approvers ca2
              JOIN approval_logs al ON al.content_id = ca2.content_id AND al.approver_id = ca2.user_id
              WHERE ca2.content_id = c.id 
                AND ca2.sequence_number < ca.sequence_number
                AND al.status = 'approved'
            ) = (
              SELECT COUNT(*) FROM content_approvers ca3
              WHERE ca3.content_id = c.id 
                AND ca3.sequence_number < ca.sequence_number
            )
          )
        GROUP BY c.id, ca.sequence_number
        ORDER BY ca.sequence_number
      `, [userId, userId]);

      rows = delegatedRows;
    } else {
      // المستخدم عادي - جلب الملفات المكلف بها فقط مع التحقق من التسلسل
      const [normalRows] = await db.execute(`
        SELECT 
          CONCAT('dept-', c.id) AS id, 
          c.title, 
          c.file_path, 
          c.notes, 
          c.approval_status, 
          CAST(c.approvers_required AS CHAR) AS approvers_required,
          c.approvals_log, 
          c.created_at,
          c.start_date,
          c.end_date,
          f.name AS folderName,
          COALESCE(d.name, '-') AS source_name,
          COALESCE(d.type, 'department') AS department_type,
          GROUP_CONCAT(DISTINCT u2.username ORDER BY ca.sequence_number) AS assigned_approvers,
          'normal' AS signature_type,
          ca.sequence_number
        FROM contents c
        JOIN folders f ON c.folder_id = f.id
        LEFT JOIN departments d ON f.department_id = d.id
        JOIN content_approvers ca ON ca.content_id = c.id
        LEFT JOIN users u2 ON ca.user_id = u2.id
        WHERE c.is_approved = 0
          AND ca.user_id = ?
          AND NOT EXISTS (
            SELECT 1 FROM approval_logs
            WHERE content_id = c.id
              AND approver_id = ?
              AND status = 'approved'
          )
          AND (
            -- التحقق من أن جميع المعتمدين السابقين قد وقعوا
            ca.sequence_number = 1 
            OR (
              SELECT COUNT(*) FROM content_approvers ca2
              JOIN approval_logs al ON al.content_id = ca2.content_id AND al.approver_id = ca2.user_id
              WHERE ca2.content_id = c.id 
                AND ca2.sequence_number < ca.sequence_number
                AND al.status = 'approved'
            ) = (
              SELECT COUNT(*) FROM content_approvers ca3
              WHERE ca3.content_id = c.id 
                AND ca3.sequence_number < ca.sequence_number
            )
          )
        GROUP BY c.id, ca.sequence_number
        ORDER BY ca.sequence_number
      `, [userId, userId]);

      rows = normalRows;
    }

    rows.forEach(row => {
      if (typeof row.approvers_required === 'string') {
        try {
          row.approvers_required = JSON.parse(row.approvers_required);
        } catch (e) {
          row.approvers_required = [];
        }
      } else if (row.approvers_required === null || !Array.isArray(row.approvers_required)) {
        row.approvers_required = [];
      }
    });

    res.status(200).json({ status: 'success', data: rows });
  } catch (err) {
    console.error('Error in getUserPendingApprovals:', err);
    res.status(500).json({ status: 'error', message: 'خطأ في جلب الموافقات المعلقة للمستخدم' });
  }
};
// اعتماد/رفض ملف - محسن للأداء
const handleApproval = async (req, res) => {
  let { contentId: originalContentId } = req.params;
  const { approved, signature, notes, electronic_signature, on_behalf_of, } = req.body;

  let contentId;
  let isCommitteeContent = false;

  if (typeof originalContentId === 'string') {
    if (originalContentId.startsWith('dept-')) {
      contentId = parseInt(originalContentId.split('-')[1], 10);
      isCommitteeContent = false;
    } else if (originalContentId.startsWith('comm-')) {
      // Redirect committee content to the appropriate handler
      return res.status(400).json({ 
        status: 'error', 
        message: 'محتوى اللجان يجب أن يتم اعتماده عبر API اللجان المنفصل' 
      });
    } else {
      contentId = parseInt(originalContentId, 10);
      isCommitteeContent = false;
    }
  } else {
    contentId = originalContentId;
    isCommitteeContent = false;
  }

  if (typeof approved !== 'boolean') {
    return res.status(400).json({ status: 'error', message: 'البيانات ناقصة' });
  }

  if (approved === true && !signature && !electronic_signature) {
    return res.status(400).json({ status: 'error', message: 'التوقيع مفقود' });
  }

  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    let currentUserId = decoded.id;
    // إذا كان المستخدم مفوض شخص آخر، نفذ الاعتماد باسم المفوض له
    if (globalProxies[currentUserId]) {
      currentUserId = globalProxies[currentUserId];
    }

    // التحقق من صلاحيات المستخدم للأدمن أولاً
    const userRole = decoded.role;
    const [permRows] = await db.execute(`
      SELECT p.permission_key
      FROM user_permissions up
      JOIN permissions p ON up.permission_id = p.id
      WHERE up.user_id = ?
    `, [currentUserId]);
    const perms = new Set(permRows.map(r => r.permission_key));
    const isAdmin = (userRole === 'admin' || perms.has('transfer_credits'));

    let allData = [];
    let contentData = null;

    if (isAdmin) {
      // للأدمن: جلب بيانات المحتوى مباشرة بدون التحقق من content_approvers
      const [contentRows] = await db.execute(`
        SELECT 
          c.id,
          c.title,
          c.created_by,
          c.is_approved
        FROM contents c
        WHERE c.id = ?
      `, [contentId]);

      if (!contentRows.length) {
        return res.status(404).json({ status: 'error', message: 'الملف غير موجود' });
      }

      contentData = contentRows[0];
      // للأدمن: تعيين sequence_number = 1 للسماح بالاعتماد
      allData = [{
        sequence_number: 1,
        title: contentData.title,
        created_by: contentData.created_by,
        is_approved: contentData.is_approved,
        is_delegated: 0,
        delegator_id: null,
        has_personal_log: 0,
        has_proxy_log: 0,
        personal_log_id: null,
        proxy_log_id: null,
        personal_status: null,
        proxy_status: null
      }];
    } else {
      // للمستخدمين العاديين: التحقق من content_approvers
      const [approverData] = await db.execute(`
        SELECT 
          ca.sequence_number,
          c.title,
          c.created_by,
          c.is_approved,
          CASE WHEN ad.user_id IS NOT NULL THEN 1 ELSE 0 END as is_delegated,
          ad.user_id as delegator_id,
          CASE WHEN al_personal.id IS NOT NULL THEN 1 ELSE 0 END as has_personal_log,
          CASE WHEN al_proxy.id IS NOT NULL THEN 1 ELSE 0 END as has_proxy_log,
          al_personal.id as personal_log_id,
          al_proxy.id as proxy_log_id,
          al_personal.status as personal_status,
          al_proxy.status as proxy_status
        FROM content_approvers ca
        JOIN contents c ON c.id = ca.content_id
        LEFT JOIN active_delegations ad ON ad.delegate_id = ca.user_id
        LEFT JOIN approval_logs al_personal ON al_personal.content_id = ca.content_id 
          AND al_personal.approver_id = ca.user_id 
          AND al_personal.signed_as_proxy = 0 
          AND al_personal.delegated_by IS NULL
        LEFT JOIN approval_logs al_proxy ON al_proxy.content_id = ca.content_id 
          AND al_proxy.approver_id = ca.user_id 
          AND al_proxy.signed_as_proxy = 1 
          AND al_proxy.delegated_by = ad.user_id
        WHERE ca.content_id = ? AND ca.user_id = ?
      `, [contentId, currentUserId]);

      if (!approverData.length) {
        return res.status(404).json({ status: 'error', message: 'المستخدم غير مكلف بهذا الملف' });
      }

      allData = approverData;
    }

    const data = allData[0];
    const currentSequence = data.sequence_number;
    const isDelegated = data.is_delegated === 1;
    const delegatorId = data.delegator_id;
    const hasPersonalLog = data.has_personal_log === 1;
    const hasProxyLog = data.has_proxy_log === 1;
    const personalLogId = data.personal_log_id;
    const proxyLogId = data.proxy_log_id;
    const personalStatus = data.personal_status;
    const proxyStatus = data.proxy_status;

    // التحقق من التسلسل - تحسين الأداء (الأدمن يمكنه التخطي)
    if (currentSequence > 1 && !isAdmin) {
      const [previousApprovers] = await db.execute(`
        SELECT COUNT(*) as count
        FROM content_approvers ca
        WHERE ca.content_id = ? 
          AND ca.sequence_number < ?
          AND NOT EXISTS (
            SELECT 1 FROM approval_logs al
            WHERE al.content_id = ca.content_id 
              AND al.approver_id = ca.user_id
              AND al.status = 'approved'
          )
      `, [contentId, currentSequence]);

      if (previousApprovers[0].count > 0) {
        return res.status(400).json({ 
          status: 'error', 
          message: 'لا يمكنك التوقيع حتى يوقع المعتمد السابق' 
        });
      }
    }

    // ——— منطق التوقيع المزدوج للمفوض له ———
    // المستخدم المفوض له يعتمد مرتين تلقائياً:
    // 1. توقيع شخصي (isProxy = false, delegatedBy = null)
    // 2. توقيع بالنيابة (isProxy = true, delegatedBy = delegatorId)
    let delegatedBy = null;
    let isProxy = false;
    let singleDelegationRows = []; // تعريف المتغير خارج النطاق لضمان توافره

    if (isDelegated) {
      // المستخدم مفوض له تفويض جماعي - سيتم الاعتماد مرتين تلقائياً
      // التوقيع الأول: شخصي
      delegatedBy = null;
      isProxy = false;
    } else {
      // تحقق من التفويضات الفردية المقبولة
      const [singleDelegationRowsResult] = await db.execute(`
        SELECT delegated_by, signed_as_proxy
        FROM approval_logs
        WHERE content_id = ? AND approver_id = ? AND signed_as_proxy = 1 AND status = 'accepted'
        LIMIT 1
      `, [contentId, currentUserId]);

      singleDelegationRows = singleDelegationRowsResult; // تعيين النتيجة للمتغير العام

      if (singleDelegationRows.length) {
        // المستخدم مفوض له تفويض فردي مقبول
        const singleDelegatorId = singleDelegationRows[0].delegated_by;
        
        // التحقق من وجود المفوض الأصلي في تسلسل المعتمدين
        const [delegatorSequenceCheck] = await db.execute(
          `SELECT sequence_number FROM content_approvers WHERE content_id = ? AND user_id = ?`,
          [contentId, singleDelegatorId]
        );
        
        if (delegatorSequenceCheck.length) {
          // التوقيع بالنيابة عن المفوض الأصلي
          delegatedBy = singleDelegatorId;
          isProxy = true;
        }
      } else if (on_behalf_of) {
        // المستخدم ليس مفوض له، تحقق من السجلات القديمة
        const [existing] = await db.execute(`
          SELECT delegated_by, signed_as_proxy
          FROM approval_logs
          WHERE content_id = ? AND approver_id = ?
          LIMIT 1
        `, [contentId, currentUserId]);

        if (existing.length && existing[0].signed_as_proxy === 1) {
          delegatedBy = existing[0].delegated_by;
          isProxy = true;
        }
      }
    }

    // استخدم currentUserId كموقّع فعلي
    const approverId = currentUserId;

    const approvalLogsTable = 'approval_logs';
    const contentApproversTable = 'content_approvers';
    const contentsTable = 'contents';
    const generatePdfFunction = generateFinalSignedPDF;

    // منطق الاعتماد المزدوج للمستخدم المفوض له - محسن للأداء
    if (isDelegated) {
      // التوقيع الأول: شخصي
      // استخدام INSERT ... ON DUPLICATE KEY UPDATE لتجنب خطأ duplicate entry
      await db.execute(`
        INSERT INTO ${approvalLogsTable} (
          content_id, approver_id, delegated_by, signed_as_proxy, status, signature, electronic_signature, comments, created_at
        ) VALUES (?, ?, NULL, 0, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE 
          status = VALUES(status),
          signature = VALUES(signature),
          electronic_signature = VALUES(electronic_signature),
          comments = VALUES(comments),
          created_at = NOW()
      `, [
        contentId,
        approverId,
        approved ? 'approved' : 'rejected',
        signature || null,
        electronic_signature || null,
        notes || ''
      ]);
      
      // التوقيع الثاني: بالنيابة
      // استخدام INSERT ... ON DUPLICATE KEY UPDATE لتجنب خطأ duplicate entry
      await db.execute(`
        INSERT INTO ${approvalLogsTable} (
          content_id,
          approver_id,
          delegated_by,
          signed_as_proxy,
          status,
          signature,
          electronic_signature,
          comments,
          created_at
        )
        VALUES (?, ?, ?, 1, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE 
          status = VALUES(status),
          signature = VALUES(signature),
          electronic_signature = VALUES(electronic_signature),
          comments = VALUES(comments),
          created_at = NOW()
      `, [
        contentId,
        approverId,
        delegatorId,
        approved ? 'approved' : 'rejected',
        signature || null,
        electronic_signature || null,
        notes || ''
      ]);
    } else {
      // المستخدم عادي - اعتماد واحد فقط
      // استخدام INSERT ... ON DUPLICATE KEY UPDATE لتجنب خطأ duplicate entry
      await db.execute(`
        INSERT INTO ${approvalLogsTable} (
          content_id,
          approver_id,
          delegated_by,
          signed_as_proxy,
          status,
          signature,
          electronic_signature,
          comments,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE 
          status = VALUES(status),
          signature = VALUES(signature),
          electronic_signature = VALUES(electronic_signature),
          comments = VALUES(comments),
          created_at = NOW()
      `, [
        contentId,
        approverId,
        delegatedBy,
        isProxy ? 1 : 0,
        approved ? 'approved' : 'rejected',
        signature || null,
        electronic_signature || null,
        notes || ''
      ]);
    }

    // إضافة المستخدم المفوض له إلى content_approvers إذا لم يكن موجوداً
    // للمستخدمين المفوض لهم، نضيفهم في كلا الحالتين (شخصي وبالنيابة)
    if ((isProxy && approved) || (isDelegated && approved)) {
      await db.execute(
        `INSERT IGNORE INTO ${contentApproversTable} (content_id, user_id) VALUES (?, ?)`,
        [contentId, approverId]
      );
    }

    // تحديث حالة التفويض الفردي إلى 'approved' قبل حساب المعتمدين المتبقين
    if (singleDelegationRows && singleDelegationRows.length > 0) {
      await db.execute(`
        UPDATE approval_logs 
        SET status = 'approved' 
        WHERE content_id = ? AND approver_id = ? AND signed_as_proxy = 1 AND status = 'accepted'
      `, [contentId, currentUserId]);
    }

    // جلب عدد المعتمدين المتبقين قبل إشعارات صاحب الملف - محسن للأداء
    const [remaining] = await db.execute(`
      SELECT COUNT(*) AS count
      FROM content_approvers ca
      LEFT JOIN active_delegations ad ON ad.delegate_id = ca.user_id
      LEFT JOIN approval_logs al_personal ON al_personal.content_id = ca.content_id 
        AND al_personal.approver_id = ca.user_id 
        AND al_personal.signed_as_proxy = 0 
        AND al_personal.status = 'approved'
      LEFT JOIN approval_logs al_proxy ON al_proxy.content_id = ca.content_id 
        AND al_proxy.approver_id = ca.user_id 
        AND al_proxy.signed_as_proxy = 1 
        AND al_proxy.status = 'approved'
      LEFT JOIN approval_logs al_single ON al_single.content_id = ca.content_id 
        AND al_single.approver_id = ca.user_id 
        AND al_single.signed_as_proxy = 1 
        AND al_single.status = 'approved'
      WHERE ca.content_id = ? 
        AND al_single.id IS NULL
        AND (
          CASE 
            WHEN ad.user_id IS NULL THEN
              -- المستخدم العادي: لا يوجد توقيع شخصي
              al_personal.id IS NULL
            ELSE
              -- المستخدم المفوض له: لا يوجد توقيع شخصي أو لا يوجد توقيع بالنيابة
              (al_personal.id IS NULL OR al_proxy.id IS NULL)
          END
        )
    `, [contentId]);

    // استخدام البيانات المحفوظة مسبقاً للوق
    const itemTitle = data.title || `رقم ${contentId}`;

    // ✅ log action
    const logDescription = {
        ar: `تم ${approved ? 'اعتماد' : 'رفض'} الملف: "${getContentNameByLanguage(itemTitle, 'ar')}"${isProxy ? ' كمفوض عن مستخدم آخر' : ''}`,
        en: `${approved ? 'Approved' : 'Rejected'} file: "${getContentNameByLanguage(itemTitle, 'en')}"${isProxy ? ' as a proxy' : ''}`
    };

    await logAction(
      currentUserId,
      approved ? 'approve_content' : 'reject_content',
      JSON.stringify(logDescription),
      'content',
      contentId
    );

    if (isProxy && approverId) {
      // لم يعد هناك إشعار هنا
    }

    // استخدام البيانات المحفوظة مسبقاً للإشعارات
    const ownerId = data.created_by;
    const fileTitle = data.title || '';
    
    // إذا لم يكتمل الاعتماد النهائي، أرسل إشعار اعتماد جزئي
    if (approved && remaining[0].count > 0) {
      // جلب اسم المعتمد
      const [approverRows] = await db.execute('SELECT username FROM users WHERE id = ?', [approverId]);
      const approverName = approverRows.length ? approverRows[0].username : '';
      await sendPartialApprovalNotification(ownerId, fileTitle, approverName, false);
    }
    // إذا اكتمل الاعتماد النهائي، أرسل إشعار "تم اعتماد الملف من الإدارة"
    if (remaining[0].count === 0) {
      await sendOwnerApprovalNotification(ownerId, fileTitle, approved, false);
    }

    if (approved === true && isProxy) {
      await addApproverWithDelegation(contentId, approverId);
    }

    // تحديث PDF بعد كل اعتماد - جعلها غير متزامنة لتجنب التأخير
    if (approved) {
      // تشغيل تحديث PDF في الخلفية بدون انتظار مع تحسين الأداء
      setImmediate(() => {
        updatePDFAfterApproval(contentId).catch(err => {
          console.error('Error updating PDF after approval:', err);
        });
      });
    }

    if (remaining[0].count === 0) {
      // تشغيل توليد PDF النهائي في الخلفية بدون انتظار مع تحسين الأداء
      setImmediate(() => {
        generatePdfFunction(contentId).catch(err => {
          console.error('Error generating final PDF:', err);
        });
      });
      
      await db.execute(`
        UPDATE ${contentsTable}
        SET is_approved = 1,
            approval_status = 'approved',
            approved_by = ?,
            updated_at = NOW()
        WHERE id = ?
      `, [approverId, contentId]);
    }

    res.status(200).json({ status: 'success', message: 'تم التوقيع بنجاح' });
  } catch (err) {
    console.error('Error in handleApproval:', err);
    res.status(500).json({ status: 'error', message: 'خطأ أثناء معالجة الاعتماد' });
  }
};

// توليد نسخة نهائية موقعة من PDF مع دعم "توقيع بالنيابة" باستخدام pdfmake
async function generateFinalSignedPDF(contentId) {
  // 1) جلب مسار الملف
  const [fileRows] = await db.execute(
    `SELECT file_path FROM contents WHERE id = ?`,
    [contentId]
  );
  if (!fileRows.length) {
    return console.error('📁 Content not found for ID', contentId);
  }
  const relativePath = fileRows[0].file_path;
  const fullPath = path.join(__dirname, '../../uploads', relativePath);
  if (!fs.existsSync(fullPath)) {
    return console.error('❌ File not found on disk:', fullPath);
  }

  // 2) تحميل وثيقة الـ PDF الأصلية
  let originalPdfBytes;
  let electronicSealDataUrl;
  try {
    originalPdfBytes = fs.readFileSync(fullPath);
    // قراءة ختم الاعتماد الإلكتروني كـ base64 مرة واحدة
    const electronicSealBase64 = fs.readFileSync(path.join(__dirname, '../e3teamdelc.png')).toString('base64');
    electronicSealDataUrl = 'data:image/png;base64,' + electronicSealBase64;
  } catch (err) {
    return console.error('❌ Failed to load original PDF or electronic seal:', err);
  }

  // 3) جلب سجلات الاعتماد بما فيها التفويض مع معلومات إضافية
  const [logs] = await db.execute(`
    SELECT
      al.signed_as_proxy,
      u_actual.username   AS actual_signer,
      u_original.username AS original_user,
      u_actual.first_name AS actual_first_name,
      u_actual.second_name AS actual_second_name,
      u_actual.third_name AS actual_third_name,
      u_actual.last_name AS actual_last_name,
      u_original.first_name AS original_first_name,
      u_original.second_name AS original_second_name,
      u_original.third_name AS original_third_name,
      u_original.last_name AS original_last_name,
      al.signature,
      al.electronic_signature,
      al.comments,
      al.created_at,
      jt_actual.title AS signer_job_title,
      jt_original.title AS original_job_title
    FROM approval_logs al
    JOIN users u_actual
      ON al.approver_id = u_actual.id
    LEFT JOIN job_titles jt_actual
      ON u_actual.job_title_id = jt_actual.id
    LEFT JOIN users u_original
      ON al.delegated_by = u_original.id
    LEFT JOIN job_titles jt_original
      ON u_original.job_title_id = jt_original.id
    WHERE al.content_id = ? AND al.status = 'approved'
    ORDER BY al.created_at
  `, [contentId]);

  console.log('PDF logs:', logs); // للتأكد من القيم

  if (!logs.length) {
    console.warn('⚠️ No approved signatures found for content', contentId);
    return;
  }

  // 4) إعداد pdfmake
  const PdfPrinter = require('pdfmake/src/printer');
  
  // دالة مساعدة لحل مشكلة ترتيب الكلمات العربية
  const fixArabicOrder = (text) => {
    if (typeof text === 'string' && /[\u0600-\u06FF]/.test(text)) {
      // عكس ترتيب الكلمات للنص العربي لحل مشكلة الترتيب
      return text.split(' ').reverse().join(' ');
    }
    return text;
  };

  // دالة مساعدة لبناء الاسم الكامل من الأجزاء
  const buildFullName = (firstName, secondName, thirdName, lastName) => {
    const nameParts = [firstName, secondName, thirdName, lastName].filter(part => part && part.trim());
    return nameParts.join(' ');
  };

  // تعريف خط Amiri العربي
  const fonts = {
    Amiri: {
      normal: path.join(__dirname, '../../fonts/Amiri-Regular.ttf'),
      bold: path.join(__dirname, '../../fonts/Amiri-Regular.ttf'),
      italics: path.join(__dirname, '../../fonts/Amiri-Regular.ttf'),
      bolditalics: path.join(__dirname, '../../fonts/Amiri-Regular.ttf')
    }
  };

  let printer;
  try {
    printer = new PdfPrinter(fonts);
  } catch (fontError) {
    console.log('⚠️ Error with Amiri font, using default fonts');
    printer = new PdfPrinter();
  }


  // 5) جلب اسم الملف لعرضه كعنوان
  const [contentRows] = await db.execute(
    `SELECT title FROM contents WHERE id = ?`,
    [contentId]
  );
  const fileName = contentRows.length > 0 ? contentRows[0].title : `File ${contentId}`;

  // 6) إنشاء محتوى صفحة الاعتمادات باستخدام pdfmake
  const approvalTableBody = [];
  
  // إضافة رأس الجدول
  approvalTableBody.push([
    { text: 'Approvals', style: 'tableHeader' },
    { text: 'Name', style: 'tableHeader' },
    { text: 'Position', style: 'tableHeader' },
    { text: 'Approval Method', style: 'tableHeader' },
    { text: 'Signature', style: 'tableHeader' },
    { text: 'Date', style: 'tableHeader' }
  ]);

  // إضافة بيانات الاعتمادات
  let rowIndex = 1;
  const getSignatureCell = (log) => {
    if (log.signature && log.signature.startsWith('data:image')) {
      // صورة توقيع يدوي
      return { image: log.signature, width: 40, height: 20, alignment: 'center' };
    } else if (log.electronic_signature) {
      // اعتماد إلكتروني: دائماً صورة الختم
      return { image: electronicSealDataUrl, width: 40, height: 20, alignment: 'center' };
    } else {
      // لا يوجد توقيع
      return { text: '✓', style: 'tableCell' };
    }
  };
  for (const log of logs) {
    // نوع الاعتماد
    const approvalType = rowIndex === 1 ? 'Reviewed' : 
                        rowIndex === logs.length ? 'Approver' : 'Reviewed';
    
    // طريقة الاعتماد
    const approvalMethod = log.signature ? 'Hand Signature' : 
                          log.electronic_signature ? 'Electronic Signature' : 'Not Specified';
    
    // التاريخ
    const approvalDate = new Date(log.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    // بناء الاسم الكامل للموقع الفعلي
    const actualSignerFullName = buildFullName(
      log.actual_first_name,
      log.actual_second_name,
      log.actual_third_name,
      log.actual_last_name
    ) || log.actual_signer || 'N/A';

    // إضافة صف الاعتماد مع معالجة النصوص العربية
    approvalTableBody.push([
      { text: approvalType, style: 'tableCell' },
      { text: fixArabicOrder(actualSignerFullName), style: 'tableCell' },
      { text: fixArabicOrder(log.signer_job_title || 'Not Specified'), style: 'tableCell' },
      { text: approvalMethod, style: 'tableCell' },
      getSignatureCell(log),
      { text: approvalDate, style: 'tableCell' }
    ]);

    // إذا كان تفويض، أضف صف إضافي للمفوض الأصلي
    if (log.signed_as_proxy && log.original_user) {
      // بناء الاسم الكامل للمفوض الأصلي
      const originalUserFullName = buildFullName(
        log.original_first_name,
        log.original_second_name,
        log.original_third_name,
        log.original_last_name
      ) || log.original_user || 'N/A';

      approvalTableBody.push([
        { text: '(Proxy for)', style: 'proxyCell' },
        { text: fixArabicOrder(originalUserFullName), style: 'proxyCell' },
        { text: fixArabicOrder(log.original_job_title || 'Not Specified'), style: 'proxyCell' },
        { text: 'Delegated', style: 'proxyCell' },
        { text: '-', style: 'proxyCell' },
        { text: '-', style: 'proxyCell' }
      ]);
    }

    rowIndex++;
  }

  // 7) إنشاء تعريف المستند باستخدام pdfmake
  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 60],
    defaultStyle: {
      font: 'Amiri',
      fontSize: 10
    },
    styles: {
      title: {
        fontSize: 18,
        bold: true,
        alignment: 'center',
        margin: [0, 0, 0, 20]
      },
      tableHeader: {
        bold: true,
        fontSize: 9,
        color: 'black',
        alignment: 'center',
        fillColor: '#e6e6e6'
      },
      tableCell: {
        fontSize: 8,
        alignment: 'center'
      },
      proxyCell: {
        fontSize: 8,
        alignment: 'center',
        color: '#666666',
        fillColor: '#f9f9f9'
      }
    },
    content: [
      // عنوان الملف مع معالجة النص العربي
      {
        text: fixArabicOrder(fileName),
        style: 'title'
      },
      // جدول الاعتمادات
      {
        table: {
          headerRows: 1,
          widths: ['15%', '20%', '20%', '20%', '10%', '15%'],
          body: approvalTableBody
        },
        layout: {
          hLineWidth: function(i, node) {
            return 1;
          },
          vLineWidth: function(i, node) {
            return 1;
          },
          hLineColor: function(i, node) {
            return '#000000';
          },
          vLineColor: function(i, node) {
            return '#000000';
          }
        }
      }
    ]
  };

  // 8) إنشاء PDF جديد باستخدام pdfmake
  try {
    const approvalPdfDoc = printer.createPdfKitDocument(docDefinition);
    const approvalPdfChunks = [];
    
    approvalPdfDoc.on('data', (chunk) => {
      approvalPdfChunks.push(chunk);
    });
    
    approvalPdfDoc.on('end', async () => {
      try {
        const approvalPdfBuffer = Buffer.concat(approvalPdfChunks);
        
        // 9) دمج صفحة الاعتمادات مع PDF الأصلي
        const { PDFDocument } = require('pdf-lib');
        const mergedPdf = await PDFDocument.create();
        
        // إضافة صفحات PDF الأصلي أولاً (بدون صفحة الاعتمادات السابقة)
        const originalPdfDoc = await PDFDocument.load(originalPdfBytes);
        const originalPageCount = originalPdfDoc.getPageCount();
        
        // نسخ جميع صفحات PDF الأصلي ما عدا الصفحة الأخيرة إذا كانت صفحة اعتمادات
        const pagesToCopy = [];
        for (let i = 0; i < originalPageCount; i++) {
          pagesToCopy.push(i);
        }
        
        // إذا كان PDF يحتوي على أكثر من صفحة واحدة، نتجاهل الصفحة الأخيرة
        // لأنها قد تكون صفحة اعتمادات سابقة
        if (originalPageCount > 1) {
          pagesToCopy.pop(); // إزالة الصفحة الأخيرة
        }
        
        const originalPages = await mergedPdf.copyPages(originalPdfDoc, pagesToCopy);
        originalPages.forEach((page) => mergedPdf.addPage(page));
        
        // إضافة صفحة الاعتمادات المحدثة في النهاية
        const approvalPdfDoc = await PDFDocument.load(approvalPdfBuffer);
        const approvalPages = await mergedPdf.copyPages(approvalPdfDoc, approvalPdfDoc.getPageIndices());
        approvalPages.forEach((page) => mergedPdf.addPage(page));
        
        // حفظ PDF المدمج
        const finalPdfBytes = await mergedPdf.save();
        fs.writeFileSync(fullPath, finalPdfBytes);
        console.log(`✅ PDF updated with approval table using pdfmake: ${fullPath}`);
      } catch (mergeError) {
        console.error('❌ Error merging PDFs:', mergeError);
        // في حالة فشل الدمج، احفظ صفحة الاعتمادات فقط
        try {
          fs.writeFileSync(fullPath, approvalPdfBuffer);
          console.log(`✅ Saved approval page only: ${fullPath}`);
        } catch (saveError) {
          console.error('❌ Error saving approval page:', saveError);
        }
      }
    });
    
    approvalPdfDoc.on('error', (error) => {
      console.error('❌ Error in PDF generation:', error);
    });
    
    approvalPdfDoc.end();
  } catch (err) {
    console.error('❌ Error creating approval PDF:', err);
  }
}

// دالة جديدة لتحديث PDF بعد كل اعتماد فوري
async function updatePDFAfterApproval(contentId) {
  try {
    // 1) جلب مسار الملف
    const [fileRows] = await db.execute(
      `SELECT file_path FROM contents WHERE id = ?`,
      [contentId]
    );
    if (!fileRows.length) {
      return console.error('📁 Content not found for ID', contentId);
    }
    const relativePath = fileRows[0].file_path;
    const fullPath = path.join(__dirname, '../../uploads', relativePath);
    if (!fs.existsSync(fullPath)) {
      return console.error('❌ File not found on disk:', fullPath);
    }

    // 2) تحميل وثيقة الـ PDF الأصلية
    let originalPdfBytes;
    let electronicSealDataUrl;
    try {
      originalPdfBytes = fs.readFileSync(fullPath);
      // قراءة ختم الاعتماد الإلكتروني كـ base64 مرة واحدة
      const electronicSealBase64 = fs.readFileSync(path.join(__dirname, '../e3teamdelc.png')).toString('base64');
      electronicSealDataUrl = 'data:image/png;base64,' + electronicSealBase64;
    } catch (err) {
      return console.error('❌ Failed to load original PDF or electronic seal:', err);
    }

    // 3) جلب سجلات الاعتماد بما فيها التفويض مع معلومات إضافية
    const [logs] = await db.execute(`
      SELECT
        al.signed_as_proxy,
        u_actual.username   AS actual_signer,
        u_original.username AS original_user,
        u_actual.first_name AS actual_first_name,
        u_actual.second_name AS actual_second_name,
        u_actual.third_name AS actual_third_name,
        u_actual.last_name AS actual_last_name,
        u_original.first_name AS original_first_name,
        u_original.second_name AS original_second_name,
        u_original.third_name AS original_third_name,
        u_original.last_name AS original_last_name,
        al.signature,
        al.electronic_signature,
        al.comments,
        al.created_at,
        jt_actual.title AS signer_job_title,
        jt_original.title AS original_job_title
      FROM approval_logs al
      JOIN users u_actual
        ON al.approver_id = u_actual.id
      LEFT JOIN job_titles jt_actual
        ON u_actual.job_title_id = jt_actual.id
      LEFT JOIN users u_original
        ON al.delegated_by = u_original.id
      LEFT JOIN job_titles jt_original
        ON u_original.job_title_id = jt_original.id
      WHERE al.content_id = ? AND al.status = 'approved'
      ORDER BY al.created_at
    `, [contentId]);

    if (!logs.length) {
      console.warn('⚠️ No approved signatures found for content', contentId);
      return;
    }

    // 4) إعداد pdfmake
    const PdfPrinter = require('pdfmake/src/printer');
    
    // دالة مساعدة لحل مشكلة ترتيب الكلمات العربية
    const fixArabicOrder = (text) => {
      if (typeof text === 'string' && /[\u0600-\u06FF]/.test(text)) {
        return text.split(' ').reverse().join(' ');
      }
      return text;
    };

    // دالة مساعدة لبناء الاسم الكامل من الأجزاء
    const buildFullName = (firstName, secondName, thirdName, lastName) => {
      const nameParts = [firstName, secondName, thirdName, lastName].filter(part => part && part.trim());
      return nameParts.join(' ');
    };

    // تعريف خط Amiri العربي
    const fonts = {
      Amiri: {
        normal: path.join(__dirname, '../../fonts/Amiri-Regular.ttf'),
        bold: path.join(__dirname, '../../fonts/Amiri-Regular.ttf'),
        italics: path.join(__dirname, '../../fonts/Amiri-Regular.ttf'),
        bolditalics: path.join(__dirname, '../../fonts/Amiri-Regular.ttf')
      }
    };

    let printer;
    try {
      printer = new PdfPrinter(fonts);
    } catch (fontError) {
      console.log('⚠️ Error with Amiri font, using default fonts');
      printer = new PdfPrinter();
    }

    // 5) جلب اسم الملف لعرضه كعنوان
    const [contentRows] = await db.execute(
      `SELECT title FROM contents WHERE id = ?`,
      [contentId]
    );
    const fileName = contentRows.length > 0 ? contentRows[0].title : `File ${contentId}`;

    // 6) إنشاء محتوى صفحة الاعتمادات باستخدام pdfmake
    const approvalTableBody = [];
    
    // إضافة رأس الجدول
    approvalTableBody.push([
      { text: 'Approvals', style: 'tableHeader' },
      { text: 'Name', style: 'tableHeader' },
      { text: 'Position', style: 'tableHeader' },
      { text: 'Approval Method', style: 'tableHeader' },
      { text: 'Signature', style: 'tableHeader' },
      { text: 'Date', style: 'tableHeader' }
    ]);

    // إضافة بيانات الاعتمادات
    let rowIndex = 1;
    const getSignatureCell = (log) => {
      if (log.signature && log.signature.startsWith('data:image')) {
        return { image: log.signature, width: 40, height: 20, alignment: 'center' };
      } else if (log.electronic_signature) {
        return { image: electronicSealDataUrl, width: 40, height: 20, alignment: 'center' };
      } else {
        return { text: '✓', style: 'tableCell' };
      }
    };

    for (const log of logs) {
      const approvalType = rowIndex === 1 ? 'Reviewed' : 
                          rowIndex === logs.length ? 'Approver' : 'Reviewed';
      
      const approvalMethod = log.signature ? 'Hand Signature' : 
                            log.electronic_signature ? 'Electronic Signature' : 'Not Specified';
      
      const approvalDate = new Date(log.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });

      const actualSignerFullName = buildFullName(
        log.actual_first_name,
        log.actual_second_name,
        log.actual_third_name,
        log.actual_last_name
      ) || log.actual_signer || 'N/A';

      approvalTableBody.push([
        { text: approvalType, style: 'tableCell' },
        { text: fixArabicOrder(actualSignerFullName), style: 'tableCell' },
        { text: fixArabicOrder(log.signer_job_title || 'Not Specified'), style: 'tableCell' },
        { text: approvalMethod, style: 'tableCell' },
        getSignatureCell(log),
        { text: approvalDate, style: 'tableCell' }
      ]);

      if (log.signed_as_proxy && log.original_user) {
        const originalUserFullName = buildFullName(
          log.original_first_name,
          log.original_second_name,
          log.original_third_name,
          log.original_last_name
        ) || log.original_user || 'N/A';

        approvalTableBody.push([
          { text: '(Proxy for)', style: 'proxyCell' },
          { text: fixArabicOrder(originalUserFullName), style: 'proxyCell' },
          { text: fixArabicOrder(log.original_job_title || 'Not Specified'), style: 'proxyCell' },
          { text: 'Delegated', style: 'proxyCell' },
          { text: '-', style: 'proxyCell' },
          { text: '-', style: 'proxyCell' }
        ]);
      }

      rowIndex++;
    }

    // 7) إنشاء تعريف المستند باستخدام pdfmake
    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 60],
      defaultStyle: {
        font: 'Amiri',
        fontSize: 10
      },
      styles: {
        title: {
          fontSize: 18,
          bold: true,
          alignment: 'center',
          margin: [0, 0, 0, 20]
        },
        tableHeader: {
          bold: true,
          fontSize: 9,
          color: 'black',
          alignment: 'center',
          fillColor: '#e6e6e6'
        },
        tableCell: {
          fontSize: 8,
          alignment: 'center'
        },
        proxyCell: {
          fontSize: 8,
          alignment: 'center',
          color: '#666666',
          fillColor: '#f9f9f9'
        }
      },
      content: [
        {
          text: fixArabicOrder(fileName),
          style: 'title'
        },
        {
          table: {
            headerRows: 1,
            widths: ['15%', '20%', '20%', '20%', '10%', '15%'],
            body: approvalTableBody
          },
          layout: {
            hLineWidth: function(i, node) {
              return 1;
            },
            vLineWidth: function(i, node) {
              return 1;
            },
            hLineColor: function(i, node) {
              return '#000000';
            },
            vLineColor: function(i, node) {
              return '#000000';
            }
          }
        }
      ]
    };

    // 8) إنشاء PDF جديد باستخدام pdfmake
    const approvalPdfDoc = printer.createPdfKitDocument(docDefinition);
    const approvalPdfChunks = [];
    
    approvalPdfDoc.on('data', (chunk) => {
      approvalPdfChunks.push(chunk);
    });
    
    approvalPdfDoc.on('end', async () => {
      try {
        const approvalPdfBuffer = Buffer.concat(approvalPdfChunks);
        
        // 9) دمج صفحة الاعتمادات مع PDF الأصلي
        const { PDFDocument } = require('pdf-lib');
        const mergedPdf = await PDFDocument.create();
        
        // إضافة صفحات PDF الأصلي أولاً (بدون صفحة الاعتمادات السابقة)
        const originalPdfDoc = await PDFDocument.load(originalPdfBytes);
        const originalPageCount = originalPdfDoc.getPageCount();
        
        // نسخ جميع صفحات PDF الأصلي ما عدا الصفحة الأخيرة إذا كانت صفحة اعتمادات
        const pagesToCopy = [];
        for (let i = 0; i < originalPageCount; i++) {
          pagesToCopy.push(i);
        }
        
        // إذا كان PDF يحتوي على أكثر من صفحة واحدة، نتجاهل الصفحة الأخيرة
        // لأنها قد تكون صفحة اعتمادات سابقة
        if (originalPageCount > 1) {
          pagesToCopy.pop(); // إزالة الصفحة الأخيرة
        }
        
        const originalPages = await mergedPdf.copyPages(originalPdfDoc, pagesToCopy);
        originalPages.forEach((page) => mergedPdf.addPage(page));
        
        // إضافة صفحة الاعتمادات المحدثة في النهاية
        const approvalPdfDoc = await PDFDocument.load(approvalPdfBuffer);
        const approvalPages = await mergedPdf.copyPages(approvalPdfDoc, approvalPdfDoc.getPageIndices());
        approvalPages.forEach((page) => mergedPdf.addPage(page));
        
        // حفظ PDF المدمج
        const finalPdfBytes = await mergedPdf.save();
        fs.writeFileSync(fullPath, finalPdfBytes);
        console.log(`✅ PDF updated with approval table after each approval: ${fullPath}`);
      } catch (mergeError) {
        console.error('❌ Error merging PDFs:', mergeError);
        try {
          fs.writeFileSync(fullPath, approvalPdfBuffer);
          console.log(`✅ Saved approval page only: ${fullPath}`);
        } catch (saveError) {
          console.error('❌ Error saving approval page:', saveError);
        }
      }
    });
    
    approvalPdfDoc.on('error', (error) => {
      console.error('❌ Error in PDF generation:', error);
    });
    
    approvalPdfDoc.end();
  } catch (err) {
    console.error('❌ Error updating PDF after approval:', err);
  }
}

async function getUserPermissions(userId) {
  const [permRows] = await db.execute(`
    SELECT p.permission_key
    FROM permissions p
    JOIN user_permissions up ON up.permission_id = p.id
    WHERE up.user_id = ?
  `, [userId]);
  return new Set(permRows.map(r => r.permission_key));
}
const getAssignedApprovals = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    let userId = decoded.id;
    const userRole = decoded.role;

    const permsSet = await getUserPermissions(userId);
    const canViewAll = userRole === 'admin' || permsSet.has('transfer_credits');

    let allRows = [];

    if (canViewAll) {
      // للمستخدمين المفوّض لهم - جلب جميع الملفات
      const [deptRows] = await db.execute(`
        SELECT
          CONCAT('dept-', c.id) AS id,
          c.title,
          c.file_path,
          c.approval_status,
          GROUP_CONCAT(DISTINCT u2.username ORDER BY ca.sequence_number) AS assigned_approvers,
          d.name AS source_name,
          COALESCE(d.type, 'department') AS department_type,
          f.name AS folder_name,
          u.username AS created_by_username,
          'department' AS type,
          CAST(c.approvers_required AS CHAR) AS approvers_required,
          c.created_at,
          c.start_date,
          c.end_date,
          ca.sequence_number
        FROM contents c
        JOIN folders f        ON c.folder_id = f.id
        JOIN departments d    ON f.department_id = d.id
        JOIN users u          ON c.created_by = u.id
        LEFT JOIN content_approvers ca ON ca.content_id = c.id
        LEFT JOIN users u2     ON ca.user_id = u2.id
        WHERE NOT EXISTS (
          SELECT 1 FROM approval_logs al
          WHERE al.content_id = c.id
            AND al.delegated_by = ?
            AND al.signed_as_proxy = 1
            AND al.status = 'accepted'
        )
        GROUP BY c.id, ca.sequence_number
      `, [userId]);

      const [commRows] = await db.execute(`
        SELECT
          CONCAT('comm-', cc.id) AS id,
          cc.title,
          cc.file_path,
          cc.approval_status,
          GROUP_CONCAT(DISTINCT u2.username ORDER BY cca.sequence_number) AS assigned_approvers,
          com.name AS source_name,
          cf.name AS folder_name,
          u.username AS created_by_username,
          'committee' AS type,
          CAST(cc.approvers_required AS CHAR) AS approvers_required,
          cc.created_at,
          cc.start_date,
          cc.end_date,
          cca.sequence_number
        FROM ss cc
        JOIN committee_folders cf      ON cc.folder_id = cf.id
        JOIN committees com            ON cf.committee_id = com.id
        JOIN users u                   ON cc.created_by = u.id
        LEFT JOIN committee_content_approvers cca ON cca.content_id = cc.id
        LEFT JOIN users u2             ON cca.user_id = u2.id
        WHERE NOT EXISTS (
          SELECT 1 FROM committee_approval_logs cal
          WHERE cal.content_id = cc.id
            AND cal.delegated_by = ?
            AND cal.signed_as_proxy = 1
            AND cal.status = 'accepted'
        )
        GROUP BY cc.id, cca.sequence_number
      `, [userId]);

      allRows = [...deptRows, ...commRows];
    } else {
      // للمستخدمين العاديين - جلب الملفات المخصصة لهم فقط
      
      // جلب الملفات من الأقسام
      const [deptRows] = await db.execute(`
        SELECT
          CONCAT('dept-', c.id) AS id,
          c.title,
          c.file_path,
          c.approval_status,
          GROUP_CONCAT(DISTINCT u2.username ORDER BY ca.sequence_number) AS assigned_approvers,
          d.name AS source_name,
          COALESCE(d.type, 'department') AS department_type,
          f.name AS folder_name,
          u.username AS created_by_username,
          'department' AS type,
          CAST(c.approvers_required AS CHAR) AS approvers_required,
          c.created_at,
          c.start_date,
          c.end_date,
          ca.sequence_number
        FROM contents c
        JOIN folders f        ON c.folder_id = f.id
        JOIN departments d    ON f.department_id = d.id
        JOIN users u          ON c.created_by = u.id
        JOIN content_approvers ca ON ca.content_id = c.id AND ca.user_id = ?
        LEFT JOIN users u2     ON ca.user_id = u2.id
        WHERE NOT EXISTS (
          SELECT 1 FROM approval_logs al
          WHERE al.content_id = c.id
            AND al.delegated_by = ?
            AND al.signed_as_proxy = 1
            AND al.status = 'accepted'
        )
        AND NOT EXISTS (
          SELECT 1 FROM approval_logs al2
          WHERE al2.content_id = c.id
            AND al2.approver_id = ?
            AND al2.status = 'approved'
        )
        GROUP BY c.id, ca.sequence_number
      `, [userId, userId, userId]);

      // جلب الملفات من اللجان
      const [commRows] = await db.execute(`
        SELECT
          CONCAT('comm-', cc.id) AS id,
          cc.title,
          cc.file_path,
          cc.approval_status,
          GROUP_CONCAT(DISTINCT u2.username ORDER BY cca.sequence_number) AS assigned_approvers,
          com.name AS source_name,
          cf.name AS folder_name,
          u.username AS created_by_username,
          'committee' AS type,
          CAST(cc.approvers_required AS CHAR) AS approvers_required,
          cc.created_at,
          cc.start_date,
          cc.end_date,
          cca.sequence_number
        FROM committee_contents cc
        JOIN committee_folders cf      ON cc.folder_id = cf.id
        JOIN committees com            ON cf.committee_id = com.id
        JOIN users u                   ON cc.created_by = u.id
        JOIN committee_content_approvers cca ON cca.content_id = cc.id AND cca.user_id = ?
        LEFT JOIN users u2             ON cca.user_id = u2.id
        WHERE NOT EXISTS (
          SELECT 1 FROM committee_approval_logs cal
          WHERE cal.content_id = cc.id
            AND cal.delegated_by = ?
            AND cal.signed_as_proxy = 1
            AND cal.status = 'accepted'
        )
        AND NOT EXISTS (
          SELECT 1 FROM committee_approval_logs cal2
          WHERE cal2.content_id = cc.id
            AND cal2.approver_id = ?
            AND cal2.status = 'approved'
        )
        GROUP BY cc.id, cca.sequence_number
      `, [userId, userId, userId]);

      allRows = [...deptRows, ...commRows];
    }

    // فلترة النتائج حسب التسلسل
    const filteredRows = [];
    const processedContentIds = new Set();

    for (const row of allRows) {
      const contentId = row.id;
      const sequenceNumber = row.sequence_number;

      // إذا كان هذا أول معتمد في التسلسل
      if (sequenceNumber === 1) {
        if (!processedContentIds.has(contentId)) {
          filteredRows.push(row);
          processedContentIds.add(contentId);
        }
        continue;
      }

      // التحقق من أن جميع المعتمدين السابقين قد وقعوا
      const isReadyForApproval = await checkPreviousApproversSigned(contentId, sequenceNumber, row.type);
      
      if (isReadyForApproval && !processedContentIds.has(contentId)) {
        filteredRows.push(row);
        processedContentIds.add(contentId);
      }
    }

    // تحويل الحقل من نص JSON إلى مصفوفة
    filteredRows.forEach(row => {
      try {
        row.approvers_required = JSON.parse(row.approvers_required);
      } catch {
        row.approvers_required = [];
      }
    });

    // ترتيب النتائج
    filteredRows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return res.json({ status: 'success', data: filteredRows });
  } catch (err) {
    console.error('Error in getAssignedApprovals:', err);
    return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
  }
};

// دالة مساعدة للتحقق من توقيع المعتمدين السابقين
async function checkPreviousApproversSigned(contentId, currentSequence, type) {
  try {
    if (type === 'department') {
      const actualContentId = contentId.replace('dept-', '');
      
      // جلب عدد المعتمدين السابقين الذين لم يكملوا اعتمادهم
      const [remainingApprovers] = await db.execute(`
        SELECT COUNT(*) as count
        FROM content_approvers ca
        WHERE ca.content_id = ? 
          AND ca.sequence_number < ?
          AND (
            -- للمستخدمين العاديين: لا يوجد توقيع شخصي
            (ca.user_id NOT IN (
              SELECT delegate_id FROM active_delegations
            ) AND NOT EXISTS (
              SELECT 1 FROM approval_logs al
              WHERE al.content_id = ca.content_id 
                AND al.approver_id = ca.user_id
                AND al.signed_as_proxy = 0
                AND al.status = 'approved'
            ))
            OR
            -- للمستخدمين المفوض لهم: لا يوجد توقيع شخصي أو لا يوجد توقيع بالنيابة
            (ca.user_id IN (
              SELECT delegate_id FROM active_delegations
            ) AND (
              -- لا يوجد توقيع شخصي
              NOT EXISTS (
                SELECT 1 FROM approval_logs al
                WHERE al.content_id = ca.content_id 
                  AND al.approver_id = ca.user_id
                  AND al.signed_as_proxy = 0
                  AND al.status = 'approved'
              )
              OR
              -- لا يوجد توقيع بالنيابة
              NOT EXISTS (
                SELECT 1 FROM approval_logs al
                WHERE al.content_id = ca.content_id 
                  AND al.approver_id = ca.user_id
                  AND al.signed_as_proxy = 1
                  AND al.status = 'approved'
              )
            ))
          )
      `, [actualContentId, currentSequence]);

      // إذا كان عدد المعتمدين المتبقين = 0، فهذا يعني أن جميع المعتمدين السابقين قد أكملوا اعتمادهم
      return remainingApprovers[0].count === 0;
    } else if (type === 'committee') {
      const actualContentId = contentId.replace('comm-', '');
      
      // جلب عدد المعتمدين السابقين الذين لم يكملوا اعتمادهم
      const [remainingApprovers] = await db.execute(`
        SELECT COUNT(*) as count
        FROM committee_content_approvers cca
        WHERE cca.content_id = ? 
          AND cca.sequence_number < ?
          AND (
            -- للمستخدمين العاديين: لا يوجد توقيع شخصي
            (cca.user_id NOT IN (
              SELECT delegate_id FROM active_delegations
            ) AND NOT EXISTS (
              SELECT 1 FROM committee_approval_logs cal
              WHERE cal.content_id = cca.content_id 
                AND cal.approver_id = cca.user_id
                AND cal.signed_as_proxy = 0
                AND cal.status = 'approved'
            ))
            OR
            -- للمستخدمين المفوض لهم: لا يوجد توقيع شخصي أو لا يوجد توقيع بالنيابة
            (cca.user_id IN (
              SELECT delegate_id FROM active_delegations
            ) AND (
              -- لا يوجد توقيع شخصي
              NOT EXISTS (
                SELECT 1 FROM committee_approval_logs cal
                WHERE cal.content_id = cca.content_id 
                  AND cal.approver_id = cca.user_id
                  AND cal.signed_as_proxy = 0
                  AND cal.status = 'approved'
              )
              OR
              -- لا يوجد توقيع بالنيابة
              NOT EXISTS (
                SELECT 1 FROM committee_approval_logs cal
                WHERE cal.content_id = cca.content_id 
                  AND cal.approver_id = cca.user_id
                  AND cal.signed_as_proxy = 1
                  AND cal.status = 'approved'
              )
            ))
          )
      `, [actualContentId, currentSequence]);

      // إذا كان عدد المعتمدين المتبقين = 0، فهذا يعني أن جميع المعتمدين السابقين قد أكملوا اعتمادهم
      return remainingApprovers[0].count === 0;
    }
    
    return false;
  } catch (err) {
    console.error('Error in checkPreviousApproversSigned:', err);
    return false;
  }
}

// Helper لتحويل نص JSON إلى اسم حسب اللغة
function parseTitleByLang(titleJson, lang = 'ar') {
  try {
    const obj = JSON.parse(titleJson);
    return obj[lang] || obj.ar || obj.en || '';
  } catch {
    return titleJson || '';
  }
}

const delegateApproval = async (req, res) => {
  const rawId = req.params.id;            // e.g. "dept-10" أو "comm-5" أو رقم فقط
  let contentId;
  if (typeof rawId === 'string' && (rawId.startsWith('dept-') || rawId.startsWith('comm-'))) {
    contentId = parseInt(rawId.split('-')[1], 10);
  } else {
    contentId = parseInt(rawId, 10);
  }
  const { delegateTo, notes } = req.body;

  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentUserId = decoded.id;

    if (isNaN(contentId) || !delegateTo || !currentUserId) {
      return res.status(400).json({ status: 'error', message: 'بيانات مفقودة أو غير صحيحة للتفويض' });
    }

    // 1) سجّل التفويض
    await db.execute(`
      INSERT IGNORE INTO approval_logs (
        content_id,
        approver_id,
        delegated_by,
        signed_as_proxy,
        status,
        comments,
        created_at
      ) VALUES (?, ?, ?, 1, 'pending', ?, NOW())
    `, [contentId, delegateTo, currentUserId, notes || null]);
    
    // إضافة سجل في active_delegations للتفويض النشط
    await db.execute(
      'INSERT IGNORE INTO active_delegations (user_id, delegate_id) VALUES (?, ?)',
      [currentUserId, delegateTo]
    );

    // 2) احضُر اسم المستخدم والمحتوى بشكل صحيح
    const [delegateRows] = await db.execute(
      'SELECT username FROM users WHERE id = ?', 
      [delegateTo]
    );
    const isCommittee = rawId.startsWith('comm-');
    const tableName = isCommittee ? 'committee_contents' : 'contents';
    const [contentRows] = await db.execute(
      `SELECT title FROM ${tableName} WHERE id = ?`, 
      [contentId]
    );

    const delegateeUsername = delegateRows.length 
      ? delegateRows[0].username 
      : String(delegateTo);
    const rawTitle = contentRows.length 
      ? contentRows[0].title 
      : '';
    const parsedTitleAr = parseTitleByLang(rawTitle, 'ar') || 'غير معروف';
    const parsedTitleEn = parseTitleByLang(rawTitle, 'en') || 'Unknown';

    // 3) سجّل الحركة بنوع مرجعي صحيح (enum يحتوي على 'approval')
    await logAction(
      currentUserId,
      'delegate_signature',
      JSON.stringify({
        ar: `تم تفويض التوقيع للمستخدم: ${delegateeUsername} على الملف: "${parsedTitleAr}"`,
        en: `Delegated signature to user: ${delegateeUsername} for file: "${parsedTitleEn}"`
      }),
      'approval',      // يجب أن يكون ضمن enum('content','folder','user','approval','notification')
      contentId
    );

    // إرسال إشعار فوري للمفوض له
    let delegatorName = '';
    const [delegatorRows] = await db.execute('SELECT username FROM users WHERE id = ?', [currentUserId]);
    delegatorName = delegatorRows.length ? delegatorRows[0].username : '';
    await sendProxyNotification(delegateTo, contentId, isCommittee);

    return res.status(200).json({
      status: 'success',
      message: '✅ تم التفويض بالنيابة بنجاح'
    });

  } catch (err) {
    console.error('خطأ أثناء التفويض بالنيابة:', err);
    return res.status(500).json({ status: 'error', message: 'فشل التفويض بالنيابة' });
  }
};



const getProxyApprovals = async (req, res) => {

  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const [rows] = await db.execute(`
      SELECT 
        c.id,
        c.title,
        c.approval_status,
        d.name AS department_name,
        u.username AS delegated_by_name,
        al.status AS proxy_status
      FROM approval_logs al
      JOIN contents c ON al.content_id = c.id
      LEFT JOIN folders f ON c.folder_id = f.id
      LEFT JOIN departments d ON f.department_id = d.id
      JOIN users u ON al.delegated_by = u.id
      WHERE al.approver_id = ? 
        AND al.signed_as_proxy = 1 
        AND al.status IN ('pending', 'accepted')
        AND al.content_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM active_delegations ad 
          WHERE ad.delegate_id = al.approver_id 
          AND ad.user_id = al.delegated_by
        )
    `, [userId]);

    res.json({ status: 'success', data: rows });
  } catch (err) {
    console.error('getProxyApprovals error:', err);
    res.status(500).json({ status: 'error', message: 'فشل جلب الموافقات بالوكالة' });
  }
};

// Helper function to get content title by language
function getContentNameByLanguage(contentNameData, userLanguage = 'ar') {
    try {
        if (typeof contentNameData === 'string' && contentNameData.startsWith('{')) {
            const parsed = JSON.parse(contentNameData);
            return parsed[userLanguage] || parsed['ar'] || contentNameData;
        }
        return contentNameData || 'غير معروف';
    } catch (error) {
        return contentNameData || 'غير معروف';
    }
}

const acceptProxyDelegation = async (req, res) => {
  const contentId = parseInt(req.params.id, 10);
  const token = req.headers.authorization?.split(' ')[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const userId = decoded.id;

  try {
    // تحقق إذا كان المستخدم مفوض له من active_delegations
    const [delegationRows] = await db.execute(
      'SELECT user_id FROM active_delegations WHERE delegate_id = ?',
      [userId]
    );

    if (delegationRows.length) {
      const delegatorId = delegationRows[0].user_id;
      
      // أضف المستخدم لجدول المعيّنين
      await db.execute('INSERT IGNORE INTO content_approvers (content_id, user_id) VALUES (?, ?)', [contentId, userId]);
      
      // أضف سجل بالنيابة
      await db.execute(
        `INSERT IGNORE INTO approval_logs (
          content_id, approver_id, delegated_by, signed_as_proxy, status, created_at
        ) VALUES (?, ?, ?, 1, 'pending', NOW())`,
        [contentId, userId, delegatorId]
      );
      
      // أضف سجل عادي
      await db.execute(
        `INSERT IGNORE INTO approval_logs (
          content_id, approver_id, delegated_by, signed_as_proxy, status, created_at
        ) VALUES (?, ?, NULL, 0, 'pending', NOW())`,
        [contentId, userId]
      );
      
      // احذف المفوض الأصلي من content_approvers
      await db.execute(
        'DELETE FROM content_approvers WHERE content_id = ? AND user_id = ?',
        [contentId, delegatorId]
      );
      
      res.json({ 
        status: 'success', 
        message: 'تم قبول التفويض وستظهر لك في التقارير المكلف بها. يمكنك التوقيع مرتين: مرة شخصية ومرة بالنيابة.',
        proxy: true,
        delegated_by: delegatorId
      });
    } else {
      // أضف المستخدم لجدول المعيّنين (الطريقة القديمة)
      await addApproverWithDelegation(contentId, userId);
      res.json({ status: 'success', message: 'تم قبول التفويض وستظهر لك في التقارير المكلف بها' });
    }
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'فشل قبول التفويض' });
  }
};







// إلغاء جميع التفويضات التي أعطاها المستخدم (revoke all delegations by user)
const revokeAllDelegations = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const adminId = decoded.id;
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ status: 'error', message: 'يرجى تحديد المستخدم' });

    // جلب كل التفويضات النشطة التي أعطاها هذا المستخدم (delegated_by = userId)
    const [rows] = await db.execute(
      `SELECT content_id, approver_id FROM approval_logs WHERE delegated_by = ? AND signed_as_proxy = 1 AND status = 'pending'`,
      [userId]
    );
    
    // التحقق من وجود سجلات في active_delegations
    const [activeDelegations] = await db.execute(
      `SELECT * FROM active_delegations WHERE user_id = ?`,
      [userId]
    );
    
    if (!rows.length && !activeDelegations.length) {
      return res.status(200).json({ status: 'success', message: 'لا يوجد تفويضات نشطة لهذا المستخدم.' });
    }
    
    // حذف أو تعديل كل التفويضات (إرجاعها للوضع الطبيعي)
    for (const row of rows) {
      // جلب التسلسل الحالي للمفوض له
      const [delegateeSequence] = await db.execute(
        'SELECT sequence_number FROM content_approvers WHERE content_id = ? AND user_id = ?',
        [row.content_id, row.approver_id]
      );

      // حذف سجل التفويض من approval_logs
      await db.execute(
        `DELETE FROM approval_logs WHERE content_id = ? AND approver_id = ? AND delegated_by = ? AND signed_as_proxy = 1 AND status = 'pending'`,
        [row.content_id, row.approver_id, userId]
      );
      
      // إعادة المفوض الأصلي إلى جدول content_approvers إذا لم يكن موجوداً
      const [wasApprover] = await db.execute(
        `SELECT * FROM approval_logs WHERE content_id = ? AND approver_id = ? AND signed_as_proxy = 0`,
        [row.content_id, userId]
      );
      
      if (wasApprover.length) {
        // إعادة المفوض الأصلي إلى مكانه في التسلسل
        if (delegateeSequence.length > 0) {
          const originalSequence = delegateeSequence[0].sequence_number;
          
          // إدراج المفوض الأصلي في نفس المكان في التسلسل
          await db.execute(
            `INSERT INTO content_approvers (content_id, user_id, sequence_number) VALUES (?, ?, ?)`,
            [row.content_id, userId, originalSequence]
          );
          
          // إعادة ترتيب التسلسل للمعتمدين المتبقين
          const [remainingApprovers] = await db.execute(
            'SELECT user_id, sequence_number FROM content_approvers WHERE content_id = ? AND user_id != ? ORDER BY sequence_number',
            [row.content_id, userId]
          );
          
          for (let i = 0; i < remainingApprovers.length; i++) {
            let newSequence = i + 1;
            if (newSequence >= originalSequence) {
              newSequence = i + 2; // تخطي المكان الذي أخذته المفوض الأصلي
            }
            await db.execute(
              'UPDATE content_approvers SET sequence_number = ? WHERE content_id = ? AND user_id = ?',
              [newSequence, row.content_id, remainingApprovers[i].user_id]
            );
          }
        } else {
          // إذا لم يكن هناك تسلسل محدد، أضفه في النهاية
          await db.execute(
            `INSERT IGNORE INTO content_approvers (content_id, user_id) VALUES (?, ?)`,
            [row.content_id, userId]
          );
        }
      }
      
      // حذف المفوض له من جدول content_approvers فقط إذا كان وجوده بسبب التفويض
      const [proxyRows] = await db.execute(
        `SELECT * FROM approval_logs WHERE content_id = ? AND approver_id = ? AND signed_as_proxy = 1 AND status = 'pending'`,
        [row.content_id, row.approver_id]
      );
      
      if (proxyRows.length === 0) {
        // لا يوجد سجل تفويض بالنيابة، لا تحذف
      } else {
        // كان وجوده بسبب التفويض، احذفه
        await db.execute(
          `DELETE FROM content_approvers WHERE content_id = ? AND user_id = ?`,
          [row.content_id, row.approver_id]
        );
        
        // إعادة ترتيب التسلسل بعد الحذف
        const [remainingApprovers] = await db.execute(
          'SELECT user_id, sequence_number FROM content_approvers WHERE content_id = ? ORDER BY sequence_number',
          [row.content_id]
        );
        
        for (let i = 0; i < remainingApprovers.length; i++) {
          await db.execute(
            'UPDATE content_approvers SET sequence_number = ? WHERE content_id = ? AND user_id = ?',
            [i + 1, row.content_id, remainingApprovers[i].user_id]
          );
        }
      }
    }
    
    // حذف سجلات active_delegations (حتى لو لم يكن لديه ملفات نشطة)
    await db.execute('DELETE FROM active_delegations WHERE user_id = ?', [userId]);
    
    // تسجيل لوق
    await logAction(adminId, 'revoke_all_delegations', JSON.stringify({ ar: `تم إلغاء جميع التفويضات التي أعطاها المستخدم رقم ${userId} وإعادة ترتيب التسلسل` }), 'user', userId);
    res.status(200).json({ status: 'success', message: 'تم إلغاء جميع التفويضات بنجاح وإعادة ترتيب التسلسل.' });
  } catch (err) {
    console.error('خطأ أثناء إلغاء جميع التفويضات:', err);
    res.status(500).json({ status: 'error', message: 'فشل إلغاء جميع التفويضات' });
  }
};

// إلغاء تفويض ملف واحد (revoke delegation for a single file)
const revokeDelegation = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const adminId = decoded.id;
    const { id } = req.params; // id = contentId
    const { delegateeId } = req.body; // المفوض له
    if (!id || !delegateeId) return res.status(400).json({ status: 'error', message: 'يرجى تحديد الملف والمفوض له' });

    // جلب التسلسل الحالي للمفوض له
    const [delegateeSequence] = await db.execute(
      'SELECT sequence_number FROM content_approvers WHERE content_id = ? AND user_id = ?',
      [id, delegateeId]
    );

    // حذف سجل التفويض
    await db.execute(
      `DELETE FROM approval_logs WHERE content_id = ? AND approver_id = ? AND signed_as_proxy = 1 AND status = 'pending'`,
      [id, delegateeId]
    );

    // إعادة المفوض الأصلي إلى جدول content_approvers إذا لم يكن موجوداً
    const [delegationRow] = await db.execute(
      `SELECT delegated_by FROM approval_logs WHERE content_id = ? AND approver_id = ?`,
      [id, delegateeId]
    );
    
    if (delegationRow.length && delegationRow[0].delegated_by) {
      const originalDelegatorId = delegationRow[0].delegated_by;
      
      // تحقق إذا كان المفوض الأصلي كان معتمدًا قبل التفويض
      const [wasApprover] = await db.execute(
        `SELECT * FROM approval_logs WHERE content_id = ? AND approver_id = ? AND signed_as_proxy = 0`,
        [id, originalDelegatorId]
      );
      
      if (wasApprover.length) {
        // إعادة المفوض الأصلي إلى مكانه في التسلسل
        if (delegateeSequence.length > 0) {
          const originalSequence = delegateeSequence[0].sequence_number;
          
          // إدراج المفوض الأصلي في نفس المكان في التسلسل
          await db.execute(
            `INSERT INTO content_approvers (content_id, user_id, sequence_number) VALUES (?, ?, ?)`,
            [id, originalDelegatorId, originalSequence]
          );
          
          // إعادة ترتيب التسلسل للمعتمدين المتبقين
          const [remainingApprovers] = await db.execute(
            'SELECT user_id, sequence_number FROM content_approvers WHERE content_id = ? AND user_id != ? ORDER BY sequence_number',
            [id, originalDelegatorId]
          );
          
          for (let i = 0; i < remainingApprovers.length; i++) {
            const newSequence = i + 1;
            if (newSequence >= originalSequence) {
              newSequence = i + 2; // تخطي المكان الذي أخذته المفوض الأصلي
            }
            await db.execute(
              'UPDATE content_approvers SET sequence_number = ? WHERE content_id = ? AND user_id = ?',
              [newSequence, id, remainingApprovers[i].user_id]
            );
          }
        } else {
          // إذا لم يكن هناك تسلسل محدد، أضفه في النهاية
          await db.execute(
            `INSERT IGNORE INTO content_approvers (content_id, user_id) VALUES (?, ?)`,
            [id, originalDelegatorId]
          );
        }
      }
      
      // تحقق إذا كان المفوض له ليس له توقيع شخصي (أي وجوده فقط بسبب التفويض)
      const [hasPersonalLog] = await db.execute(
        `SELECT * FROM approval_logs WHERE content_id = ? AND approver_id = ? AND signed_as_proxy = 0`,
        [id, delegateeId]
      );
      
      if (!hasPersonalLog.length) {
        // احذفه من content_approvers
        await db.execute(
          `DELETE FROM content_approvers WHERE content_id = ? AND user_id = ?`,
          [id, delegateeId]
        );
        
        // إعادة ترتيب التسلسل بعد الحذف
        const [remainingApprovers] = await db.execute(
          'SELECT user_id, sequence_number FROM content_approvers WHERE content_id = ? ORDER BY sequence_number',
          [id]
        );
        
        for (let i = 0; i < remainingApprovers.length; i++) {
          await db.execute(
            'UPDATE content_approvers SET sequence_number = ? WHERE content_id = ? AND user_id = ?',
            [i + 1, id, remainingApprovers[i].user_id]
          );
        }
      }
    }
    
    // حذف سجل active_delegations
    await db.execute('DELETE FROM active_delegations WHERE user_id = ? AND delegate_id = ?', [id, delegateeId]);
    
    // تسجيل لوق
    await logAction(adminId, 'revoke_delegation', JSON.stringify({ ar: `تم إلغاء تفويض الملف رقم ${id} من المستخدم رقم ${delegateeId} وإعادة ترتيب التسلسل` }), 'content', id);
    res.status(200).json({ status: 'success', message: 'تم إلغاء التفويض بنجاح وإعادة ترتيب التسلسل.' });
  } catch (err) {
    console.error('خطأ أثناء إلغاء التفويض:', err);
    res.status(500).json({ status: 'error', message: 'فشل إلغاء التفويض' });
  }
};

// جلب كل التفويضات النشطة التي أعطاها مستخدم معيّن (delegated_by = userId)
const getDelegationsByUser = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    jwt.verify(token, process.env.JWT_SECRET); // فقط تحقق من التوكن
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ status: 'error', message: 'يرجى تحديد المستخدم' });
    const [rows] = await db.execute(
      `SELECT al.content_id, al.approver_id, c.title, al.status, al.signed_as_proxy, al.delegated_by
       FROM approval_logs al
       JOIN contents c ON al.content_id = c.id
       WHERE al.delegated_by = ? AND al.signed_as_proxy = 1 AND al.status = 'pending'`,
      [userId]
    );
    res.status(200).json({ status: 'success', data: rows });
  } catch (err) {
    console.error('getDelegationsByUser error:', err);
    res.status(500).json({ status: 'error', message: 'فشل جلب التفويضات' });
  }
};





// دالة لتنظيف السجلات القديمة من approval_logs
const cleanupOldApprovalLogs = async () => {
  try {
    // حذف جميع السجلات بالنيابة التي لا تتوافق مع active_delegations
    await db.execute(`
      DELETE FROM approval_logs 
      WHERE signed_as_proxy = 1 
      AND delegated_by IS NOT NULL
      AND (delegated_by, approver_id) NOT IN (
        SELECT ad.user_id, ad.delegate_id 
        FROM active_delegations ad
      )
    `);
    console.log('✅ تم تنظيف السجلات القديمة من approval_logs بنجاح');
  } catch (err) {
    console.error('❌ خطأ في تنظيف approval_logs:', err);
  }
};

// دالة مساعدة: إضافة معتمد لملف مع دعم التفويض التلقائي
async function addApproverWithDelegation(contentId, userId) {
  // أضف المستخدم الأصلي
  await db.execute('INSERT IGNORE INTO content_approvers (content_id, user_id) VALUES (?, ?)', [contentId, userId]);
  // تحقق إذا كان لديه تفويض نشط من جدول active_delegations
  const [delegationRows] = await db.execute(
    'SELECT user_id FROM active_delegations WHERE delegate_id = ?',
    [userId]
  );
  
  if (delegationRows.length) {
    const delegatorId = delegationRows[0].user_id;
    // أضف سجل تفويض بالنيابة
    await db.execute(
      `INSERT IGNORE INTO approval_logs (content_id, approver_id, delegated_by, signed_as_proxy, status, created_at)
       VALUES (?, ?, ?, 1, 'pending', NOW())`,
      [contentId, userId, delegatorId]
    );
    // أضف المفوض له إلى content_approvers
    await db.execute('INSERT IGNORE INTO content_approvers (content_id, user_id) VALUES (?, ?)', [contentId, userId]);
    // احذف المفوض الأصلي من content_approvers
    await db.execute('DELETE FROM content_approvers WHERE content_id = ? AND user_id = ?', [contentId, delegatorId]);
  }
}

// جلب قائمة الأشخاص الذين تم تفويضهم من المستخدم الحالي (distinct approver_id) في التفويضات العادية
const getDelegationSummaryByUser = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    jwt.verify(token, process.env.JWT_SECRET);
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ status: 'error', message: 'يرجى تحديد المستخدم' });
    const [rows] = await db.execute(
      `SELECT al.approver_id, u.username AS approver_name, u.email, COUNT(al.content_id) AS files_count
       FROM approval_logs al
       JOIN users u ON al.approver_id = u.id
       WHERE al.delegated_by = ? AND al.signed_as_proxy = 1 AND al.status = 'pending'
       GROUP BY al.approver_id, u.username, u.email`,
      [userId]
    );
    res.status(200).json({ status: 'success', data: rows });
  } catch (err) {
    console.error('getDelegationSummaryByUser error:', err);
    res.status(500).json({ status: 'error', message: 'فشل جلب ملخص التفويضات' });
  }
};

// دالة لجلب التفويضات الفردية المعلقة للأقسام
const getSingleDelegations = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    jwt.verify(token, process.env.JWT_SECRET);
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ status: 'error', message: 'يرجى تحديد المستخدم' });

    // جلب التفويضات الفردية المعلقة من approval_logs (الأقسام فقط)
    const [singleDelegations] = await db.execute(`
      SELECT 
        al.id,
        al.content_id,
        al.delegated_by,
        al.created_at,
        al.comments,
        u.username as delegated_by_name,
        c.title as content_title,
        'department' as type
      FROM approval_logs al
      JOIN users u ON al.delegated_by = u.id
      JOIN contents c ON al.content_id = c.id
      WHERE al.approver_id = ? 
        AND al.signed_as_proxy = 1 
        AND al.status = 'pending'
        AND al.content_id IS NOT NULL
      ORDER BY al.created_at DESC
    `, [userId]);

    res.status(200).json({ status: 'success', data: singleDelegations });
  } catch (err) {
    console.error('getSingleDelegations error:', err);
    res.status(500).json({ status: 'error', message: 'فشل جلب التفويضات الفردية' });
  }
};

// دالة معالجة التفويضات الفردية الموحدة (قبول/رفض)
const processSingleDelegationUnified = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentUserId = decoded.id;
    
    const { delegationId, action, reason } = req.body;
    if (!delegationId || !action) {
      return res.status(400).json({ status: 'error', message: 'يرجى تحديد التفويض والإجراء' });
    }

    // جلب معلومات التفويض من approval_logs
    const [delegationRows] = await db.execute(`
      SELECT * FROM approval_logs 
      WHERE id = ? AND approver_id = ? AND signed_as_proxy = 1 AND status = 'pending'
    `, [delegationId, currentUserId]);

    if (delegationRows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'لم يتم العثور على التفويض' });
    }

    const delegation = delegationRows[0];
    const delegatorId = delegation.delegated_by;
    const contentId = delegation.content_id;

    if (action === 'accept') {
      // قبول التفويض الفردي
      // تحديث حالة التفويض إلى مقبول
      await db.execute(`
        UPDATE approval_logs 
        SET status = 'accepted' 
        WHERE id = ?
      `, [delegation.id]);

      // إضافة المفوض له إلى content_approvers
      await db.execute(
        `INSERT IGNORE INTO content_approvers (content_id, user_id) VALUES (?, ?)`,
        [contentId, currentUserId]
      );

      // حذف المفوض الأصلي من content_approvers (فقد صلاحيته)
      await db.execute(
        `DELETE FROM content_approvers WHERE content_id = ? AND user_id = ?`,
        [contentId, delegatorId]
      );

      // إرسال إشعار للمفوض الأصلي
      await insertNotification(
        delegatorId,
        'قبول تفويض الملف الفردي',
        JSON.stringify({ 
          ar: `تم قبول تفويض الملف الفردي من قبل ${currentUserId}`,
          en: `Single file delegation accepted by ${currentUserId}`
        }),
        'contents',
        contentId
      );

      res.status(200).json({ status: 'success', message: 'تم قبول التفويض الفردي بنجاح' });

    } else if (action === 'reject') {
      // رفض التفويض الفردي
      // تحديث حالة التفويض إلى مرفوض
      await db.execute(`
        UPDATE approval_logs 
        SET status = 'rejected', comments = ? 
        WHERE id = ?
      `, [reason || null, delegation.id]);

      // إعادة المفوض الأصلي إلى content_approvers
      await db.execute(
        `INSERT IGNORE INTO content_approvers (content_id, user_id) VALUES (?, ?)`,
        [contentId, delegatorId]
      );

      // إرسال إشعار للمفوض الأصلي
      await insertNotification(
        delegatorId,
        'رفض تفويض الملف الفردي',
        JSON.stringify({ 
          ar: `تم رفض تفويض الملف الفردي من قبل ${currentUserId}`,
          en: `Single file delegation rejected by ${currentUserId}`
        }),
        'contents',
        contentId
      );

      res.status(200).json({ status: 'success', message: 'تم رفض التفويض الفردي بنجاح' });
    } else {
      res.status(400).json({ status: 'error', message: 'إجراء غير صحيح' });
    }

  } catch (err) {
    console.error('processSingleDelegationUnified error:', err);
    res.status(500).json({ status: 'error', message: 'فشل معالجة التفويض الفردي' });
  }
};

// دالة لجلب سجلات التفويضات لمستخدم معين
const getDelegationLogs = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    jwt.verify(token, process.env.JWT_SECRET);
    const { userId, delegatorId } = req.params;
    if (!userId || !delegatorId) return res.status(400).json({ status: 'error', message: 'يرجى تحديد المستخدم والمفوض' });

    // جلب سجلات التفويضات من approval_logs
    const [delegationLogs] = await db.execute(`
      SELECT 
        al.id,
        al.content_id,
        al.approver_id,
        al.delegated_by,
        al.status,
        al.signed_as_proxy,
        al.created_at,
        al.comments,
        c.title as content_title,
        u.username as approver_name,
        d.username as delegator_name
      FROM approval_logs al
      JOIN contents c ON al.content_id = c.id
      JOIN users u ON al.approver_id = u.id
      JOIN users d ON al.delegated_by = d.id
      WHERE al.approver_id = ? AND al.delegated_by = ? AND al.signed_as_proxy = 1
      ORDER BY al.created_at DESC
    `, [userId, delegatorId]);

    res.status(200).json({ status: 'success', data: delegationLogs });
  } catch (err) {
    console.error('getDelegationLogs error:', err);
    res.status(500).json({ status: 'error', message: 'فشل جلب سجلات التفويضات' });
  }
};

// دالة لجلب حالة موافقة المستخدم مع مفوض معين
const getUserApprovalStatus = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    jwt.verify(token, process.env.JWT_SECRET);
    const { userId, delegatorId } = req.params;
    if (!userId || !delegatorId) return res.status(400).json({ status: 'error', message: 'يرجى تحديد المستخدم والمفوض' });

    // التحقق من وجود سجلات موافقة معالجة
    const [processedLogs] = await db.execute(`
      SELECT COUNT(*) as count
      FROM approval_logs 
      WHERE approver_id = ? AND delegated_by = ? AND signed_as_proxy = 1 
      AND status IN ('accepted', 'rejected', 'approved')
    `, [userId, delegatorId]);

    const hasProcessed = processedLogs[0].count > 0;

    res.status(200).json({ 
      status: 'success', 
      data: { hasProcessed } 
    });
  } catch (err) {
    console.error('getUserApprovalStatus error:', err);
    res.status(500).json({ status: 'error', message: 'فشل جلب حالة موافقة المستخدم' });
  }
};

// دالة موحدة للتفويض الشامل (أقسام ولجان)
const delegateAllApprovalsUnified = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentUserId = decoded.id;
    const { delegateTo, notes } = req.body;
    if (!delegateTo) return res.status(400).json({ status: 'error', message: 'يرجى اختيار المستخدم المفوض له' });
    


    // جلب اسم المفوض
    const [delegatorRows] = await db.execute('SELECT username FROM users WHERE id = ?', [currentUserId]);
    const delegatorName = delegatorRows.length ? delegatorRows[0].username : '';

    // جلب جميع ملفات الأقسام المعلقة للمستخدم الحالي
    const [departmentRows] = await db.execute(`
      SELECT c.id, 'department' as type
      FROM contents c
      JOIN content_approvers ca ON ca.content_id = c.id
      WHERE c.is_approved = 0 AND ca.user_id = ?
    `, [currentUserId]);

    // جلب جميع ملفات اللجان المعلقة للمستخدم الحالي
    const [committeeRows] = await db.execute(`
      SELECT cc.id, 'committee' as type
      FROM committee_contents cc
      JOIN committee_content_approvers cca ON cca.content_id = cc.id
      WHERE cc.approval_status = 'pending' AND cca.user_id = ?
    `, [currentUserId]);

    const allFiles = [...departmentRows, ...committeeRows];
    const departmentFiles = departmentRows.map(r => r.id);
    const committeeFiles = committeeRows.map(r => r.id);

    // إضافة سجل في active_delegations للتفويض النشط
    await db.execute(
      'INSERT IGNORE INTO active_delegations (user_id, delegate_id) VALUES (?, ?)',
      [currentUserId, delegateTo]
    );

    if (!allFiles.length) {
      // إنشاء سجل تفويض معلق في approval_logs (للأقسام)
      await db.execute(`
        INSERT IGNORE INTO approval_logs (
          content_id,
          approver_id,
          delegated_by,
          signed_as_proxy,
          status,
          comments,
          created_at
        ) VALUES (NULL, ?, ?, 1, 'pending', ?, NOW())
      `, [delegateTo, currentUserId, notes || null]);

      // إنشاء سجل تفويض معلق في committee_approval_logs (للجان)
      await db.execute(`
        INSERT IGNORE INTO committee_approval_logs (
          content_id,
          approver_id,
          delegated_by,
          signed_as_proxy,
          status,
          comments,
          created_at
        ) VALUES (NULL, ?, ?, 1, 'pending', ?, NOW())
      `, [delegateTo, currentUserId, notes || null]);
      
      // أرسل إشعار جماعي حتى لو لم توجد ملفات
      try {
        await insertNotification(
          delegateTo,
          'طلب تفويض بالنيابة',
          `تم طلب تفويضك للتوقيع بالنيابة عن ${delegatorName} على جميع الملفات (أقسام ولجان).`,
          'proxy_bulk_unified',
          JSON.stringify({ 
            from: currentUserId, 
            from_name: delegatorName, 
            notes: notes || '', 
            departmentFileIds: [],
            committeeFileIds: [],
            totalFiles: 0
          })
        );
      } catch (notificationErr) {
        console.log('Notification disabled or failed, continuing with direct delegation');
      }
      
      return res.status(200).json({ 
        status: 'success', 
        message: 'تم تفعيل التفويض الجماعي الموحد بنجاح. سيتم تحويل أي ملفات جديدة تلقائياً.',
        stats: {
          departmentFiles: 0,
          committeeFiles: 0,
          totalFiles: 0
        }
      });
    }

    // إنشاء سجلات تفويض معلقة لكل ملف قسم
    for (const row of departmentRows) {
      await db.execute(`
        INSERT IGNORE INTO approval_logs (
          content_id,
          approver_id,
          delegated_by,
          signed_as_proxy,
          status,
          comments,
          created_at
        ) VALUES (?, ?, ?, 1, 'pending', ?, NOW())
      `, [row.id, delegateTo, currentUserId, notes || null]);
    }

    // إنشاء سجلات تفويض معلقة لكل ملف لجنة
    for (const row of committeeRows) {
      await db.execute(`
        INSERT IGNORE INTO committee_approval_logs (
          content_id,
          approver_id,
          delegated_by,
          signed_as_proxy,
          status,
          comments,
          created_at
        ) VALUES (?, ?, ?, 1, 'pending', ?, NOW())
      `, [row.id, delegateTo, currentUserId, notes || null]);
    }
    
    // إرسال إشعار جماعي موحد للمفوض له
    try {
      await insertNotification(
        delegateTo,
        'طلب تفويض بالنيابة',
        `تم طلب تفويضك للتوقيع بالنيابة عن ${delegatorName} على جميع الملفات (أقسام ولجان).`,
        'proxy_bulk_unified',
        JSON.stringify({ 
          from: currentUserId, 
          from_name: delegatorName, 
          notes: notes || '', 
          departmentFileIds: departmentFiles,
          committeeFileIds: committeeFiles,
          totalFiles: allFiles.length
        })
      );
      
      // أرسل إشعار تفويض لكل ملف للمفوض إليه
      for (const row of departmentRows) {
        await sendProxyNotification(delegateTo, row.id, false);
      }
      for (const row of committeeRows) {
        await sendProxyNotification(delegateTo, row.id, true);
      }
    } catch (notificationErr) {
      console.log('Notification disabled or failed, continuing with direct delegation');
    }
    
    res.status(200).json({ 
      status: 'success', 
      message: 'تم إرسال طلب التفويض الجماعي الموحد بنجاح. بانتظار موافقة المفوض له.',
      stats: {
        departmentFiles: departmentFiles.length,
        committeeFiles: committeeFiles.length,
        totalFiles: allFiles.length
      }
    });
  } catch (err) {
    console.error('خطأ أثناء إرسال طلب التفويض الجماعي الموحد:', err);
    res.status(500).json({ status: 'error', message: 'فشل إرسال طلب التفويض الجماعي الموحد' });
  }
};

// دالة موحدة لقبول جميع التفويضات (أقسام ولجان) في عملية واحدة
const acceptAllProxyDelegationsUnified = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    // جلب جميع التفويضات المعلقة للأقسام
    const [departmentDelegations] = await db.execute(`
      SELECT al.content_id, al.delegated_by, al.comments
      FROM approval_logs al
      WHERE al.approver_id = ? AND al.signed_as_proxy = 1 AND al.status = 'pending'
    `, [userId]);

    // جلب جميع التفويضات المعلقة للجان
    const [committeeDelegations] = await db.execute(`
      SELECT cal.content_id, cal.delegated_by, cal.comments
      FROM committee_approval_logs cal
      WHERE cal.approver_id = ? AND cal.signed_as_proxy = 1 AND cal.status = 'pending'
    `, [userId]);

    let processedDepartmentFiles = 0;
    let processedCommitteeFiles = 0;

    // معالجة تفويضات الأقسام
    for (const delegation of departmentDelegations) {
      if (delegation.content_id) {
        // إضافة المستخدم إلى content_approvers
        await db.execute(
          'INSERT IGNORE INTO content_approvers (content_id, user_id) VALUES (?, ?)',
          [delegation.content_id, userId]
        );
        
        // حذف المفوض الأصلي من content_approvers
        if (delegation.delegated_by && userId !== delegation.delegated_by) {
          await db.execute(
            'DELETE FROM content_approvers WHERE content_id = ? AND user_id = ?',
            [delegation.content_id, delegation.delegated_by]
          );
        }
        
        processedDepartmentFiles++;
      }
    }

    // معالجة تفويضات اللجان
    for (const delegation of committeeDelegations) {
      if (delegation.content_id) {
        // إضافة المستخدم إلى committee_content_approvers
        await db.execute(
          'INSERT IGNORE INTO committee_content_approvers (content_id, user_id) VALUES (?, ?)',
          [delegation.content_id, userId]
        );
        
        // حذف المفوض الأصلي من committee_content_approvers
        if (delegation.delegated_by && userId !== delegation.delegated_by) {
          await db.execute(
            'DELETE FROM committee_content_approvers WHERE content_id = ? AND user_id = ?',
            [delegation.content_id, delegation.delegated_by]
          );
        }
        
        processedCommitteeFiles++;
      }
    }

    // تحديث حالة جميع التفويضات إلى 'accepted'
    await db.execute(`
      UPDATE approval_logs 
      SET status = 'accepted' 
      WHERE approver_id = ? AND signed_as_proxy = 1 AND status = 'pending'
    `, [userId]);

    await db.execute(`
      UPDATE committee_approval_logs 
      SET status = 'accepted' 
      WHERE approver_id = ? AND signed_as_proxy = 1 AND status = 'pending'
    `, [userId]);

    // تسجيل الإجراء
    await logAction(userId, 'accept_all_proxy_delegations_unified', `تم قبول ${processedDepartmentFiles} ملف قسم و ${processedCommitteeFiles} ملف لجنة`);

    res.status(200).json({
      status: 'success',
      message: 'تم قبول جميع التفويضات بنجاح',
      stats: {
        departmentFiles: processedDepartmentFiles,
        committeeFiles: processedCommitteeFiles,
        totalFiles: processedDepartmentFiles + processedCommitteeFiles
      }
    });
  } catch (err) {
    console.error('خطأ أثناء قبول جميع التفويضات الموحدة:', err);
    res.status(500).json({ status: 'error', message: 'فشل قبول جميع التفويضات' });
  }
};

// دالة موحدة لجلب التفويضات المعلقة (أقسام ولجان) - التفويضات الجماعية فقط
const getPendingDelegationsUnified = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    jwt.verify(token, process.env.JWT_SECRET);
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ status: 'error', message: 'يرجى تحديد المستخدم' });

    // جلب التفويضات الجماعية المعلقة من approval_logs (الأقسام)
    // التفويضات الجماعية هي التي ليس لها content_id محدد (أي تفويض شامل)
    const [departmentDelegations] = await db.execute(`
      SELECT 
        al.id,
        al.content_id,
        al.delegated_by,
        al.created_at,
        u.username as delegated_by_name,
        'department' as type
      FROM approval_logs al
      JOIN users u ON al.delegated_by = u.id
      WHERE al.approver_id = ? 
        AND al.signed_as_proxy = 1 
        AND al.status = 'pending'
        AND al.content_id IS NULL
    `, [userId]);

    // جلب التفويضات الجماعية المعلقة من committee_approval_logs (اللجان)
    const [committeeDelegations] = await db.execute(`
      SELECT 
        cal.id,
        cal.content_id,
        cal.delegated_by,
        cal.created_at,
        u.username as delegated_by_name,
        'committee' as type
      FROM committee_approval_logs cal
      JOIN users u ON cal.delegated_by = u.id
      WHERE cal.approver_id = ? 
        AND cal.signed_as_proxy = 1 
        AND cal.status = 'pending'
        AND cal.content_id IS NULL
    `, [userId]);

    // دمج النتائج وترتيبها حسب التاريخ
    const allDelegations = [...departmentDelegations, ...committeeDelegations]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.status(200).json({ status: 'success', data: allDelegations });
  } catch (err) {
    console.error('getPendingDelegationsUnified error:', err);
    res.status(500).json({ status: 'error', message: 'فشل جلب التفويضات المعلقة' });
  }
};

// دالة موحدة لمعالجة التفويض المباشر (أقسام ولجان)
const processDirectDelegationUnified = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    const { delegatorId, action } = req.body;
    
    if (!delegatorId || !['accept','reject'].includes(action)) {
      return res.status(400).json({ status: 'error', message: 'بيانات غير صالحة' });
    }

    if (action === 'reject') {
      // حذف التفويض من active_delegations
      await db.execute('DELETE FROM active_delegations WHERE user_id = ? AND delegate_id = ?', [delegatorId, userId]);
      return res.status(200).json({ status: 'success', message: 'تم رفض التفويض المباشر' });
    }

    if (action === 'accept') {
      // إضافة التفويض إلى active_delegations
      await db.execute('INSERT IGNORE INTO active_delegations (user_id, delegate_id) VALUES (?, ?)', [delegatorId, userId]);
      
      // جلب جميع ملفات الأقسام المعلقة للمفوض الأصلي وتفويضها للمفوض له
      const [pendingDepartmentFiles] = await db.execute(`
        SELECT c.id
        FROM contents c
        JOIN content_approvers ca ON ca.content_id = c.id
        WHERE c.is_approved = 0 AND ca.user_id = ?
      `, [delegatorId]);

      // جلب جميع ملفات اللجان المعلقة للمفوض الأصلي وتفويضها للمفوض له
      const [pendingCommitteeFiles] = await db.execute(`
        SELECT cc.id
        FROM committee_contents cc
        JOIN committee_content_approvers cca ON cca.content_id = cc.id
        WHERE cc.approval_status = 'pending' AND cca.user_id = ?
      `, [delegatorId]);

      // معالجة ملفات الأقسام
      for (const file of pendingDepartmentFiles) {
        // أضف المفوض له إلى content_approvers
        await db.execute('INSERT IGNORE INTO content_approvers (content_id, user_id) VALUES (?, ?)', [file.id, userId]);
        
        // أضف سجل تفويض بالنيابة
        await db.execute(
          `INSERT IGNORE INTO approval_logs (
            content_id, approver_id, delegated_by, signed_as_proxy, status, created_at
          ) VALUES (?, ?, ?, 1, 'pending', NOW())`,
          [file.id, userId, delegatorId]
        );
        
        // احذف المفوض الأصلي من content_approvers
        await db.execute('DELETE FROM content_approvers WHERE content_id = ? AND user_id = ?', [file.id, delegatorId]);
      }

      // معالجة ملفات اللجان
      for (const file of pendingCommitteeFiles) {
        // أضف المفوض له إلى committee_content_approvers
        await db.execute('INSERT IGNORE INTO committee_content_approvers (content_id, user_id) VALUES (?, ?)', [file.id, userId]);
        
        // أضف سجل تفويض بالنيابة
        await db.execute(
          `INSERT IGNORE INTO committee_approval_logs (
            content_id, approver_id, delegated_by, signed_as_proxy, status, created_at
          ) VALUES (?, ?, ?, 1, 'pending', NOW())`,
          [file.id, userId, delegatorId]
        );
        
        // احذف المفوض الأصلي من committee_content_approvers
        await db.execute('DELETE FROM committee_content_approvers WHERE content_id = ? AND user_id = ?', [file.id, delegatorId]);
      }

      return res.status(200).json({ 
        status: 'success', 
        message: 'تم قبول التفويض المباشر بنجاح',
        stats: {
          departmentFiles: pendingDepartmentFiles.length,
          committeeFiles: pendingCommitteeFiles.length,
          totalFiles: pendingDepartmentFiles.length + pendingCommitteeFiles.length
        }
      });
    }
  } catch (err) {
    console.error('خطأ في معالجة التفويض المباشر الموحد:', err);
    res.status(500).json({ status: 'error', message: 'فشل معالجة التفويض المباشر' });
  }
};

// دالة موحدة لمعالجة التفويض الجماعي (أقسام ولجان)
const processBulkDelegationUnified = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    const { delegationId, action } = req.body;
    
    if (!delegationId || !['accept','reject'].includes(action)) {
      return res.status(400).json({ status: 'error', message: 'بيانات غير صالحة' });
    }

    if (action === 'reject') {
      // حذف التفويض الشامل من approval_logs أو committee_approval_logs
      let deleted = await db.execute('DELETE FROM approval_logs WHERE id = ? AND approver_id = ? AND signed_as_proxy = 1 AND content_id IS NULL', [delegationId, userId]);
      if (deleted[0].affectedRows === 0) {
        await db.execute('DELETE FROM committee_approval_logs WHERE id = ? AND approver_id = ? AND signed_as_proxy = 1 AND content_id IS NULL', [delegationId, userId]);
      }
      return res.status(200).json({ status: 'success', message: 'تم رفض طلب التفويض الشامل' });
    }

    if (action === 'accept') {
      // جلب التفويض من approval_logs أو committee_approval_logs (للتفويض الشامل content_id = NULL)
      let [delegation] = await db.execute(
        'SELECT * FROM approval_logs WHERE id = ? AND approver_id = ? AND signed_as_proxy = 1 AND status = "pending" AND content_id IS NULL',
        [delegationId, userId]
      );
      
      let isCommittee = false;
      if (!delegation.length) {
        [delegation] = await db.execute(
          'SELECT * FROM committee_approval_logs WHERE id = ? AND approver_id = ? AND signed_as_proxy = 1 AND status = "pending" AND content_id IS NULL',
          [delegationId, userId]
        );
        isCommittee = true;
      }

      if (!delegation.length) {
        return res.status(404).json({ status: 'error', message: 'لا يوجد طلب تفويض شامل معلق' });
      }

      const delegationData = delegation[0];
      const delegatorId = delegationData.delegated_by;

      // للتفويض الشامل، نحتاج إلى نقل جميع الملفات المعلقة من المفوض إلى المفوض له
      if (isCommittee) {
        // معالجة تفويض اللجان الشامل
        // جلب جميع ملفات اللجان المعلقة للمفوض الأصلي
        const [pendingCommitteeFiles] = await db.execute(`
          SELECT cc.id
          FROM committee_contents cc
          JOIN committee_content_approvers cca ON cca.content_id = cc.id
          WHERE cc.approval_status = 'pending' AND cca.user_id = ?
        `, [delegatorId]);

        // نقل جميع الملفات إلى المفوض له
        for (const file of pendingCommitteeFiles) {
          await db.execute(
            'INSERT IGNORE INTO committee_content_approvers (content_id, user_id) VALUES (?, ?)',
            [file.id, userId]
          );
          
          // حذف المفوض الأصلي من هذه الملفات
          await db.execute(
            'DELETE FROM committee_content_approvers WHERE content_id = ? AND user_id = ?',
            [file.id, delegatorId]
          );
        }
        
        await db.execute(
          'UPDATE committee_approval_logs SET status = "accepted" WHERE id = ?',
          [delegationId]
        );
      } else {
        // معالجة تفويض الأقسام الشامل
        // جلب جميع ملفات الأقسام المعلقة للمفوض الأصلي
        const [pendingDepartmentFiles] = await db.execute(`
          SELECT c.id
          FROM contents c
          JOIN content_approvers ca ON ca.content_id = c.id
          WHERE c.is_approved = 0 AND ca.user_id = ?
        `, [delegatorId]);

        // نقل جميع الملفات إلى المفوض له
        for (const file of pendingDepartmentFiles) {
          await db.execute(
            'INSERT IGNORE INTO content_approvers (content_id, user_id) VALUES (?, ?)',
            [file.id, userId]
          );
          
          // حذف المفوض الأصلي من هذه الملفات
          await db.execute(
            'DELETE FROM content_approvers WHERE content_id = ? AND user_id = ?',
            [file.id, delegatorId]
          );
        }
        
        await db.execute(
          'UPDATE approval_logs SET status = "accepted" WHERE id = ?',
          [delegationId]
        );
      }

      // إضافة سجل في active_delegations للتفويض النشط
      await db.execute(
        'INSERT IGNORE INTO active_delegations (user_id, delegate_id) VALUES (?, ?)',
        [delegatorId, userId]
      );

      return res.status(200).json({ 
        status: 'success', 
        message: 'تم قبول التفويض الشامل بنجاح',
        type: isCommittee ? 'committee' : 'department'
      });
    }
  } catch (err) {
    console.error('خطأ أثناء تنفيذ التفويض الجماعي الموحد:', err);
    res.status(500).json({ status: 'error', message: 'فشل تنفيذ التفويض الجماعي' });
  }
};

// دالة للتفويض الفردي الموحد (ملف واحد فقط - أقسام ولجان)
const delegateSingleApproval = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentUserId = decoded.id;
    const { delegateTo, notes, contentId, contentType } = req.body;
    
    if (!delegateTo || !contentId || !contentType) {
      return res.status(400).json({ status: 'error', message: 'بيانات مفقودة أو غير صحيحة للتفويض' });
    }
    

    
    // تحويل contentId من 'dept-42' أو 'comm-42' إلى '42' إذا كان يحتوي على بادئة
    let cleanContentId = contentId;
    if (typeof contentId === 'string') {
      if (contentId.startsWith('dept-')) {
        cleanContentId = contentId.replace('dept-', '');
      } else if (contentId.startsWith('comm-')) {
        cleanContentId = contentId.replace('comm-', '');
      }
    }
    
    console.log('🔍 Cleaned contentId:', { original: contentId, cleaned: cleanContentId });

    let contentRows, approverRows, contentTitle, isCommittee = false;

    if (contentType === 'department') {
      // التحقق من ملف الأقسام
      console.log('🔍 Checking department content:', { contentId, contentType });
      
      [contentRows] = await db.execute(`
        SELECT c.id, c.title, c.is_approved 
        FROM contents c 
        WHERE c.id = ?
      `, [cleanContentId]);

      console.log('🔍 Department content rows:', contentRows);

      if (!contentRows.length) {
        return res.status(404).json({ status: 'error', message: 'ملف القسم غير موجود' });
      }
      
      const content = contentRows[0];
      console.log('🔍 Found department content:', content);
      
      if (content.is_approved !== 0) {
        return res.status(404).json({ 
          status: 'error', 
          message: `ملف القسم تم اعتماده مسبقاً. الحالة: ${content.is_approved}` 
        });
      }

      // التحقق من أن المستخدم الحالي معتمد على هذا الملف
      [approverRows] = await db.execute(`
        SELECT * FROM content_approvers 
        WHERE content_id = ? AND user_id = ?
      `, [cleanContentId, currentUserId]);

      contentTitle = content.title;
      isCommittee = false;

    } else if (contentType === 'committee') {
      // التحقق من ملف اللجان
      console.log('🔍 Checking committee content in approvalController:', { contentId, contentType });
      
      [contentRows] = await db.execute(`
        SELECT cc.id, cc.title, cc.approval_status, cc.is_approved
        FROM committee_contents cc 
        WHERE cc.id = ?
      `, [cleanContentId]);

      console.log('🔍 Committee content rows in approvalController:', contentRows);

      if (!contentRows.length) {
        return res.status(404).json({ status: 'error', message: 'ملف اللجنة غير موجود' });
      }
      
      const committeeContent = contentRows[0];
      console.log('🔍 Found committee content in approvalController:', committeeContent);
      
      // التحقق من حالة الملف (قد يكون approval_status أو is_approved)
      const isPending = committeeContent.approval_status === 'pending' || committeeContent.is_approved === 0;
      
      if (!isPending) {
        return res.status(404).json({ 
          status: 'error', 
          message: `ملف اللجنة تم اعتماده مسبقاً. الحالة: ${committeeContent.approval_status || committeeContent.is_approved}` 
        });
      }

      // التحقق من أن المستخدم الحالي معتمد على هذا الملف
      [approverRows] = await db.execute(`
        SELECT * FROM committee_content_approvers 
        WHERE content_id = ? AND user_id = ?
      `, [cleanContentId, currentUserId]);

      contentTitle = committeeContent.title;
      isCommittee = true;

    } else {
      return res.status(400).json({ status: 'error', message: 'نوع المحتوى غير صحيح' });
    }

    if (!approverRows.length) {
      return res.status(403).json({ status: 'error', message: 'ليس لديك صلاحية تفويض هذا الملف' });
    }

    // جلب اسم المفوض
    const [delegatorRows] = await db.execute('SELECT username FROM users WHERE id = ?', [currentUserId]);
    const delegatorName = delegatorRows.length ? delegatorRows[0].username : '';

    if (isCommittee) {
      // إنشاء سجل تفويض بالنيابة للجان (بدون نقل المسؤولية بعد)
      await db.execute(`
        INSERT IGNORE INTO committee_approval_logs (
          content_id,
          approver_id,
          delegated_by,
          signed_as_proxy,
          status,
          comments,
          created_at
        ) VALUES (?, ?, ?, 1, 'pending', ?, NOW())
      `, [cleanContentId, delegateTo, currentUserId, notes || null]);
    } else {
      // إنشاء سجل تفويض بالنيابة للأقسام (بدون نقل المسؤولية بعد)
      await db.execute(`
        INSERT IGNORE INTO approval_logs (
          content_id,
          approver_id,
          delegated_by,
          signed_as_proxy,
          status,
          comments,
          created_at
        ) VALUES (?, ?, ?, 1, 'pending', ?, NOW())
      `, [cleanContentId, delegateTo, currentUserId, notes || null]);
    }

    // إرسال إشعار للمفوض له
    try {
      const notificationType = isCommittee ? 'proxy_single_committee' : 'proxy_single';
      const fileType = isCommittee ? 'ملف لجنة' : 'ملف قسم';
      
      await insertNotification(
        delegateTo,
        'طلب تفويض بالنيابة',
        `تم طلب تفويضك للتوقيع بالنيابة عن ${delegatorName} على ${fileType} واحد.`,
        notificationType,
        JSON.stringify({ 
          from: currentUserId, 
          from_name: delegatorName, 
          content_id: contentId,
          content_title: contentTitle,
          content_type: contentType,
          notes: notes || ''
        })
      );
    } catch (notificationErr) {
      console.log('Notification disabled or failed, continuing with delegation');
    }

    // تسجيل الإجراء
    const logActionType = isCommittee ? 'delegate_single_committee_signature' : 'delegate_single_signature';
    const fileTypeText = isCommittee ? 'ملف اللجنة' : 'الملف';
    
    await logAction(
      currentUserId,
      logActionType,
      JSON.stringify({
        ar: `تم تفويض التوقيع للمستخدم: ${delegateTo} على ${fileTypeText}: "${contentTitle}"`,
        en: `Delegated signature to user: ${delegateTo} for ${isCommittee ? 'committee file' : 'file'}: "${contentTitle}"`
      }),
      'approval',
      cleanContentId
    );

    return res.status(200).json({
      status: 'success',
      message: `✅ تم إرسال طلب التفويض الفردي لل${isCommittee ? 'لجنة' : 'قسم'} بنجاح`,
      data: {
        contentId,
        contentTitle,
        delegateTo,
        contentType,
        isCommittee
      }
    });

  } catch (err) {
    console.error('خطأ أثناء التفويض الفردي الموحد:', err);
    return res.status(500).json({ status: 'error', message: 'فشل التفويض الفردي' });
  }
};

// دالة تشخيص لفحص التفويضات في قاعدة البيانات
const debugDelegations = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    jwt.verify(token, process.env.JWT_SECRET);
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ status: 'error', message: 'يرجى تحديد المستخدم' });

    // فحص جميع التفويضات للمستخدم
    const [allDelegations] = await db.execute(`
      SELECT 
        'approval_logs' as table_name,
        al.id,
        al.content_id,
        al.approver_id,
        al.delegated_by,
        al.signed_as_proxy,
        al.status,
        al.created_at,
        u.username as delegated_by_name
      FROM approval_logs al
      JOIN users u ON al.delegated_by = u.id
      WHERE al.approver_id = ? AND al.signed_as_proxy = 1
      ORDER BY al.created_at DESC
    `, [userId]);

    const [allCommitteeDelegations] = await db.execute(`
      SELECT 
        'committee_approval_logs' as table_name,
        cal.id,
        cal.content_id,
        cal.approver_id,
        cal.delegated_by,
        cal.signed_as_proxy,
        cal.status,
        cal.created_at,
        u.username as delegated_by_name
      FROM committee_approval_logs cal
      JOIN users u ON cal.delegated_by = u.id
      WHERE cal.approver_id = ? AND cal.signed_as_proxy = 1
      ORDER BY cal.created_at DESC
    `, [userId]);

    // فحص active_delegations
    const [activeDelegations] = await db.execute(`
      SELECT 
        'active_delegations' as table_name,
        ad.user_id,
        ad.delegate_id,
        u.username as delegator_name
      FROM active_delegations ad
      JOIN users u ON ad.user_id = u.id
      WHERE ad.delegate_id = ?
    `, [userId]);

    res.status(200).json({ 
      status: 'success', 
      data: {
        approvalLogs: allDelegations,
        committeeApprovalLogs: allCommitteeDelegations,
        activeDelegations: activeDelegations,
        summary: {
          totalApprovalLogs: allDelegations.length,
          totalCommitteeLogs: allCommitteeDelegations.length,
          totalActiveDelegations: activeDelegations.length,
          singleDelegations: allDelegations.filter(d => d.content_id !== null).length + 
                           allCommitteeDelegations.filter(d => d.content_id !== null).length,
          bulkDelegations: allDelegations.filter(d => d.content_id === null).length + 
                          allCommitteeDelegations.filter(d => d.content_id === null).length
        }
      }
    });
  } catch (err) {
    console.error('debugDelegations error:', err);
    res.status(500).json({ status: 'error', message: 'فشل فحص التفويضات' });
  }
};

// دالة فحص نوع التفويض في active_delegations
const checkActiveDelegationType = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    jwt.verify(token, process.env.JWT_SECRET);
    
    const { delegateId, delegatorId } = req.params;
    if (!delegateId || !delegatorId) {
      return res.status(400).json({ status: 'error', message: 'يرجى تحديد المعرفات المطلوبة' });
    }

    // فحص إذا كان هناك تفويض شامل (content_id = NULL)
    const [bulkDelegations] = await db.execute(`
      SELECT 'bulk' as type
      FROM approval_logs 
      WHERE approver_id = ? AND delegated_by = ? AND signed_as_proxy = 1 AND content_id IS NULL AND status = 'pending'
      LIMIT 1
    `, [delegateId, delegatorId]);

    const [bulkCommitteeDelegations] = await db.execute(`
      SELECT 'bulk' as type
      FROM committee_approval_logs 
      WHERE approver_id = ? AND delegated_by = ? AND signed_as_proxy = 1 AND content_id IS NULL AND status = 'pending'
      LIMIT 1
    `, [delegateId, delegatorId]);

    // فحص إذا كان هناك تفويض فردي (content_id IS NOT NULL)
    const [singleDelegations] = await db.execute(`
      SELECT 'single' as type
      FROM approval_logs 
      WHERE approver_id = ? AND delegated_by = ? AND signed_as_proxy = 1 AND content_id IS NOT NULL AND status = 'pending'
      LIMIT 1
    `, [delegateId, delegatorId]);

    const [singleCommitteeDelegations] = await db.execute(`
      SELECT 'single' as type
      FROM committee_approval_logs 
      WHERE approver_id = ? AND delegated_by = ? AND signed_as_proxy = 1 AND content_id IS NOT NULL AND status = 'pending'
      LIMIT 1
    `, [delegateId, delegatorId]);

    let delegationType = 'bulk'; // افتراضي

    // إذا وجد تفويض شامل، فهو شامل
    if (bulkDelegations.length > 0 || bulkCommitteeDelegations.length > 0) {
      delegationType = 'bulk';
    }
    // إذا وجد تفويض فردي فقط، فهو فردي
    else if (singleDelegations.length > 0 || singleCommitteeDelegations.length > 0) {
      delegationType = 'single';
    }

    res.status(200).json({ 
      status: 'success', 
      data: { 
        delegationType,
        hasBulkDelegations: (bulkDelegations.length > 0 || bulkCommitteeDelegations.length > 0),
        hasSingleDelegations: (singleDelegations.length > 0 || singleCommitteeDelegations.length > 0)
      }
    });
  } catch (err) {
    console.error('خطأ في فحص نوع التفويض:', err);
    res.status(500).json({ status: 'error', message: 'فشل فحص نوع التفويض' });
  }
};

const getDelegationConfirmationData = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentUserId = decoded.id;
    const { delegationId, delegationType, contentId, contentType } = req.body;
    
    if (!delegationId || !delegationType) {
      return res.status(400).json({ status: 'error', message: 'بيانات التفويض مفقودة' });
    }

    let delegatorId, delegateId, fileInfo = null;

    // جلب معلومات التفويض حسب النوع
    if (delegationType === 'single') {
      if (contentType === 'committee') {
        // جلب معلومات تفويض اللجنة الفردي
        const [delegationRows] = await db.execute(`
          SELECT cal.content_id, cal.approver_id, cal.delegated_by
          FROM committee_approval_logs cal
          WHERE cal.id = ? AND cal.approver_id = ? AND cal.signed_as_proxy = 1 AND cal.status = 'pending'
        `, [delegationId, currentUserId]);

        if (!delegationRows.length) {
          return res.status(404).json({ status: 'error', message: 'التفويض غير موجود أو تم معالجته مسبقاً' });
        }

        const delegation = delegationRows[0];
        delegatorId = delegation.delegated_by;
        delegateId = delegation.approver_id;

        // جلب معلومات الملف
        const [contentRows] = await db.execute(`
          SELECT id, title FROM committee_contents WHERE id = ?
        `, [delegation.content_id]);
        
        if (contentRows.length) {
          fileInfo = {
            id: contentRows[0].id,
            title: contentRows[0].title,
            type: 'committee'
          };
        }
      } else {
        // جلب معلومات تفويض القسم الفردي
        const [delegationRows] = await db.execute(`
          SELECT al.content_id, al.approver_id, al.delegated_by
          FROM approval_logs al
          WHERE al.id = ? AND al.approver_id = ? AND al.signed_as_proxy = 1 AND al.status = 'pending'
        `, [delegationId, currentUserId]);

        if (!delegationRows.length) {
          return res.status(404).json({ status: 'error', message: 'التفويض غير موجود أو تم معالجته مسبقاً' });
        }

        const delegation = delegationRows[0];
        delegatorId = delegation.delegated_by;
        delegateId = delegation.approver_id;

        // جلب معلومات الملف
        const [contentRows] = await db.execute(`
          SELECT id, title FROM contents WHERE id = ?
        `, [delegation.content_id]);
        
        if (contentRows.length) {
          fileInfo = {
            id: contentRows[0].id,
            title: contentRows[0].title,
            type: 'department'
          };
        }
      }
    } else if (delegationType === 'bulk') {
      // جلب معلومات التفويض الشامل من approval_logs أو committee_approval_logs
      let [delegationRows] = await db.execute(`
        SELECT al.delegated_by, al.approver_id
        FROM approval_logs al
        WHERE al.id = ? AND al.approver_id = ? AND al.signed_as_proxy = 1 AND al.status = 'pending' AND al.content_id IS NULL
      `, [delegationId, currentUserId]);

      if (!delegationRows.length) {
        // جرب committee_approval_logs
        [delegationRows] = await db.execute(`
          SELECT cal.delegated_by, cal.approver_id
          FROM committee_approval_logs cal
          WHERE cal.id = ? AND cal.approver_id = ? AND cal.signed_as_proxy = 1 AND cal.status = 'pending' AND cal.content_id IS NULL
        `, [delegationId, currentUserId]);
      }

      if (!delegationRows.length) {
        return res.status(404).json({ status: 'error', message: 'التفويض الشامل غير موجود أو تم إلغاؤه' });
      }

      const delegation = delegationRows[0];
      delegatorId = delegation.delegated_by;
      delegateId = delegation.approver_id;
      fileInfo = null; // للتفويض الشامل لا يوجد ملف محدد
    }

    // جلب معلومات المفوض
    const [delegatorRows] = await db.execute(`
      SELECT u.id, u.username, u.first_name, u.second_name, u.third_name, u.last_name, u.national_id
      FROM users u WHERE u.id = ?
    `, [delegatorId]);
    
    // جلب معلومات المفوض له
    const [delegateRows] = await db.execute(`
      SELECT u.id, u.username, u.first_name, u.second_name, u.third_name, u.last_name, u.national_id
      FROM users u WHERE u.id = ?
    `, [delegateId]);
    
    if (!delegatorRows.length || !delegateRows.length) {
      return res.status(404).json({ status: 'error', message: 'معلومات المستخدم غير موجودة' });
    }
    
    const delegator = delegatorRows[0];
    const delegate = delegateRows[0];
    
    // بناء الاسم الكامل
    const buildFullName = (user) => {
      const names = [user.first_name, user.second_name, user.third_name, user.last_name].filter(Boolean);
      return names.join(' ');
    };
    
    return res.status(200).json({
      status: 'success',
      confirmationData: {
        delegator: {
          id: delegator.id,
          fullName: buildFullName(delegator),
          idNumber: delegator.national_id || 'غير محدد'
        },
        delegate: {
          id: delegate.id,
          fullName: buildFullName(delegate),
          idNumber: delegate.national_id || 'غير محدد'
        },
        file: fileInfo,
        isBulk: delegationType === 'bulk'
      }
    });
  } catch (error) {
    console.error('getDelegationConfirmationData error:', error);
    return res.status(500).json({ status: 'error', message: 'حدث خطأ في جلب بيانات التأكيد' });
  }
};

// دالة جلب اقرارات التفويض للمدير
const getDelegationConfirmations = async (req, res) => {
  try {
    // التحقق من الصلاحيات - فقط المديرين يمكنهم الوصول
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ status: 'error', message: 'غير مصرح' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentUserId = decoded.id;

    // التحقق من أن المستخدم مدير
    const [userRows] = await db.execute(`
      SELECT role FROM users WHERE id = ?
    `, [currentUserId]);

    if (!userRows.length || (userRows[0].role !== 'admin' && userRows[0].role !== 'manager')) {
      return res.status(403).json({ status: 'error', message: 'ليس لديك صلاحية للوصول لهذه البيانات' });
    }

    // جلب اقرارات التفويض من approval_logs
    const [approvalLogs] = await db.execute(`
      SELECT 
        al.id,
        al.delegated_by,
        al.approver_id,
        al.content_id,
        al.created_at,
        al.status,
        al.signed_as_proxy,
        al.signature,
        al.electronic_signature,
        c.title as content_title,
        'department' as content_type
      FROM approval_logs al
      LEFT JOIN contents c ON al.content_id = c.id
      WHERE al.signed_as_proxy = 1 
      AND al.status IN ('accepted', 'approved')
      ORDER BY al.created_at DESC
      LIMIT 100
    `);

    // جلب اقرارات التفويض من committee_approval_logs
    const [committeeLogs] = await db.execute(`
      SELECT 
        cal.id,
        cal.delegated_by,
        cal.approver_id,
        cal.content_id,
        cal.created_at,
        cal.status,
        cal.signed_as_proxy,
        cal.signature,
        cal.electronic_signature,
        cc.title as content_title,
        'committee' as content_type
      FROM committee_approval_logs cal
      LEFT JOIN committee_contents cc ON cal.content_id = cc.id
      WHERE cal.signed_as_proxy = 1 
      AND cal.status IN ('accepted', 'approved')
      ORDER BY cal.created_at DESC
      LIMIT 100
    `);

    // دمج النتائج
    const allLogs = [...approvalLogs, ...committeeLogs].sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    );

    // تجميع النتائج حسب التفويض
    const confirmationsMap = new Map();

    for (const log of allLogs) {
      const key = `${log.delegated_by}-${log.approver_id}-${log.content_id || 'bulk'}`;
      
      if (!confirmationsMap.has(key)) {
        // جلب معلومات المفوض
        const [delegatorRows] = await db.execute(`
          SELECT id, username, first_name, second_name, third_name, last_name, national_id
          FROM users WHERE id = ?
        `, [log.delegated_by]);

        // جلب معلومات المفوض له
        const [delegateRows] = await db.execute(`
          SELECT id, username, first_name, second_name, third_name, last_name, national_id
          FROM users WHERE id = ?
        `, [log.approver_id]);

        if (delegatorRows.length && delegateRows.length) {
          const delegator = delegatorRows[0];
          const delegate = delegateRows[0];

          const buildFullName = (user) => {
            const names = [user.first_name, user.second_name, user.third_name, user.last_name].filter(Boolean);
            return names.join(' ');
          };

          confirmationsMap.set(key, {
            id: log.id,
            delegator: {
              id: delegator.id,
              fullName: buildFullName(delegator),
              idNumber: delegator.national_id || 'غير محدد'
            },
            delegate: {
              id: delegate.id,
              fullName: buildFullName(delegate),
              idNumber: delegate.national_id || 'غير محدد'
            },
            is_bulk: !log.content_id,
            content_type: log.content_type || 'department',
            created_at: log.created_at,
            signature: log.signature || null,
            electronic_signature: log.electronic_signature || null,
            files: []
          });
        }
      }

      // إضافة الملف إذا كان تفويض فردي
      if (log.content_id && log.content_title) {
        const confirmation = confirmationsMap.get(key);
        if (confirmation) {
          confirmation.files.push({
            id: log.content_id,
            title: log.content_title,
            type: log.content_type || 'department'
          });
        }
      }
    }

    const confirmations = Array.from(confirmationsMap.values());

    return res.status(200).json({
      status: 'success',
      data: confirmations
    });

  } catch (error) {
    console.error('getDelegationConfirmations error:', error);
    return res.status(500).json({ status: 'error', message: 'حدث خطأ في جلب اقرارات التفويض' });
  }
};

module.exports = {
  getUserPendingApprovals,
  handleApproval,
  delegateApproval,
  getAssignedApprovals,
  getProxyApprovals,
  acceptProxyDelegation,
  activateProxy,
  revokeAllDelegations,
  revokeDelegation,
  getDelegationsByUser,
  cleanupOldApprovalLogs,
  getDelegationSummaryByUser,
  // الدوال الموحدة الجديدة
  delegateAllApprovalsUnified,
  acceptAllProxyDelegationsUnified,
  getPendingDelegationsUnified,
  processDirectDelegationUnified,
  processBulkDelegationUnified,
  // دالة التفويض الفردي الجديدة
  delegateSingleApproval,
  getSingleDelegations,
  processSingleDelegationUnified,
  getDelegationLogs,
  getUserApprovalStatus,
  debugDelegations,
  checkActiveDelegationType,
  getDelegationConfirmationData,
  getDelegationConfirmations
};


