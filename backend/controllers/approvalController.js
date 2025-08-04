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
          f.name AS folderName,
          COALESCE(d.name, '-') AS source_name,
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
            OR NOT EXISTS (
              SELECT 1 FROM content_approvers ca2
              JOIN approval_logs al ON al.content_id = ca2.content_id AND al.approver_id = ca2.user_id
              WHERE ca2.content_id = c.id 
                AND ca2.sequence_number < ca.sequence_number
                AND al.status = 'approved'
            ) = 0
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
          f.name AS folderName,
          COALESCE(d.name, '-') AS source_name,
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
            OR NOT EXISTS (
              SELECT 1 FROM content_approvers ca2
              JOIN approval_logs al ON al.content_id = ca2.content_id AND al.approver_id = ca2.user_id
              WHERE ca2.content_id = c.id 
                AND ca2.sequence_number < ca.sequence_number
                AND al.status = 'approved'
            ) = 0
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
// اعتماد/رفض ملف
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

  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    let currentUserId = decoded.id;
    // إذا كان المستخدم مفوض شخص آخر، نفذ الاعتماد باسم المفوض له
    if (globalProxies[currentUserId]) {
      currentUserId = globalProxies[currentUserId];
    }

    // التحقق من التسلسل - تأكد من أن المعتمد السابق قد وقع
    const [sequenceCheck] = await db.execute(`
      SELECT ca.sequence_number
      FROM content_approvers ca
      WHERE ca.content_id = ? AND ca.user_id = ?
    `, [contentId, currentUserId]);

    if (sequenceCheck.length > 0) {
      const currentSequence = sequenceCheck[0].sequence_number;
      
      // إذا لم يكن المعتمد الأول، تحقق من أن المعتمد السابق قد وقع
      if (currentSequence > 1) {
        const [previousApprovers] = await db.execute(`
          SELECT COUNT(*) as count
          FROM content_approvers ca
          JOIN approval_logs al ON al.content_id = ca.content_id AND al.approver_id = ca.user_id
          WHERE ca.content_id = ? 
            AND ca.sequence_number < ?
            AND al.status = 'approved'
        `, [contentId, currentSequence]);

        if (previousApprovers[0].count === 0) {
          return res.status(400).json({ 
            status: 'error', 
            message: 'لا يمكنك التوقيع حتى يوقع المعتمد السابق' 
          });
        }
      }
    }

// ——— منطق التوقيع المزدوج للمفوض له ———
// المستخدم المفوض له يعتمد مرتين تلقائياً:
// 1. توقيع شخصي (isProxy = false, delegatedBy = null)
// 2. توقيع بالنيابة (isProxy = true, delegatedBy = delegatorId)
let delegatedBy = null;
let isProxy = false;

// تحقق إذا كان المستخدم مفوض له من active_delegations (التفويض الجماعي)
const [delegationRows] = await db.execute(
  'SELECT user_id FROM active_delegations WHERE delegate_id = ?',
  [currentUserId]
);

// تحقق من التفويضات الفردية المقبولة
const [singleDelegationRows] = await db.execute(`
  SELECT delegated_by, signed_as_proxy
  FROM approval_logs
  WHERE content_id = ? AND approver_id = ? AND signed_as_proxy = 1 AND status = 'accepted'
  LIMIT 1
`, [contentId, currentUserId]);

if (delegationRows.length) {
  const delegatorId = delegationRows[0].user_id;
  
  // المستخدم مفوض له تفويض جماعي - سيتم الاعتماد مرتين تلقائياً
  // التوقيع الأول: شخصي
  delegatedBy = null;
  isProxy = false;
} else if (singleDelegationRows.length) {
  // المستخدم مفوض له تفويض فردي مقبول
  const delegatorId = singleDelegationRows[0].delegated_by;
  
  // التوقيع بالنيابة عن المفوض الأصلي
  delegatedBy = delegatorId;
  isProxy = true;
} else {
  // المستخدم ليس مفوض له، تحقق من السجلات القديمة
  if (on_behalf_of) {
    // إذا أرسل on_behalf_of ولكن ليس مفوض له، تحقق من السجلات
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

// Debug logging - يمكن إزالته بعد التأكد من عمل النظام
// console.log('🔍 Approval Debug:', {
//   currentUserId,
//   approverId,
//   delegatedBy,
//   isProxy,
//   on_behalf_of,
//   delegationRows: delegationRows.length
// });
// ————————————————————————————————————————————————


    if (approved === true && !signature && !electronic_signature) {
      return res.status(400).json({ status: 'error', message: 'التوقيع مفقود' });
    }

    const approvalLogsTable = 'approval_logs';
    const contentApproversTable = 'content_approvers';
    const contentsTable = 'contents';
    const generatePdfFunction = generateFinalSignedPDF;

    // منطق الاعتماد المزدوج للمستخدم المفوض له
    if (delegationRows.length) {
      const delegatorId = delegationRows[0].user_id;
      
      console.log('🔍 Saving dual approval for delegated user:', {
        userId: currentUserId,
        delegatorId,
        contentId
      });
      
      // التوقيع الأول: شخصي
      const [personalLog] = await db.execute(
        `SELECT * FROM ${approvalLogsTable} WHERE content_id = ? AND approver_id = ? AND signed_as_proxy = 0 AND delegated_by IS NULL`,
        [contentId, approverId]
      );
      if (!personalLog.length) {
        // أضف سجل جديد
        await db.execute(`
          INSERT INTO ${approvalLogsTable} (
            content_id, approver_id, delegated_by, signed_as_proxy, status, signature, electronic_signature, comments, created_at
          ) VALUES (?, ?, NULL, 0, ?, ?, ?, ?, NOW())
        `, [
          contentId,
          approverId,
          approved ? 'approved' : 'rejected',
          signature || null,
          electronic_signature || null,
          notes || ''
        ]);
        console.log('✅ Inserted personal approval for user:', currentUserId);
      } else if (personalLog[0].status !== (approved ? 'approved' : 'rejected')) {
        // حدّث السجل ليصبح معتمد
        await db.execute(
          `UPDATE ${approvalLogsTable} SET status = ?, signature = ?, electronic_signature = ?, comments = ?, created_at = NOW() WHERE id = ?`,
          [
            approved ? 'approved' : 'rejected',
            signature || null,
            electronic_signature || null,
            notes || '',
            personalLog[0].id
          ]
        );
        console.log('✅ Updated personal approval for user:', currentUserId);
      } else {
        console.log('ℹ️ Personal approval already exists and is up to date.');
      }
      
      // التوقيع الثاني: بالنيابة
      const [existingProxyLogs] = await db.execute(
        `SELECT * FROM ${approvalLogsTable} WHERE content_id = ? AND approver_id = ? AND signed_as_proxy = 1 AND delegated_by = ?`,
        [contentId, approverId, delegatorId]
      );
      // إذا يوجد فقط توقيع بالنيابة بدون توقيع شخصي، أضف التوقيع الشخصي تلقائياً
      if (!existingProxyLogs.length) {
        // حفظ التوقيع بالنيابة
        await db.execute(`
          INSERT IGNORE INTO ${approvalLogsTable} (
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
        `, [
          contentId,
          approverId,
          delegatorId,
          approved ? 'approved' : 'rejected',
          signature || null,
          electronic_signature || null,
          notes || ''
        ]);
        console.log('✅ Saved proxy approval for user:', currentUserId, 'on behalf of:', delegatorId);
      } else {
        // تحديث التوقيع بالنيابة
        await db.execute(
          `UPDATE ${approvalLogsTable} SET status = ?, signature = ?, electronic_signature = ?, comments = ?, created_at = NOW() WHERE content_id = ? AND approver_id = ? AND signed_as_proxy = 1 AND delegated_by = ?`,
          [
            approved ? 'approved' : 'rejected',
            signature || null,
            electronic_signature || null,
            notes || '',
            contentId,
            approverId,
            delegatorId
          ]
        );
        console.log('✅ Updated proxy approval for user:', currentUserId, 'on behalf of:', delegatorId);
      }
      
      console.log('✅ تم الاعتماد المزدوج للمستخدم المفوض له:', {
        userId: currentUserId,
        delegatorId,
        contentId,
        personalLogs: personalLog.length,
        proxyLogs: existingProxyLogs.length
      });
      
    } else {
      // المستخدم عادي - اعتماد واحد فقط
      const [existingLogs] = await db.execute(
        `SELECT * FROM ${approvalLogsTable} WHERE content_id = ? AND approver_id = ? AND signed_as_proxy = ? AND (delegated_by <=> ? OR (? IS NULL AND delegated_by IS NULL))`,
        [contentId, approverId, isProxy ? 1 : 0, delegatedBy, delegatedBy]
      );

      if (!existingLogs.length) {
        // استخدام INSERT IGNORE لتجنب خطأ duplicate entry
        const insertResult = await db.execute(`
          INSERT IGNORE INTO ${approvalLogsTable} (
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
      } else {
        // إذا يوجد سجل، حدثه فقط إذا أردت (اختياري)
        const updateResult = await db.execute(
          `UPDATE ${approvalLogsTable} SET status = ?, signature = ?, electronic_signature = ?, comments = ?, created_at = NOW() WHERE content_id = ? AND approver_id = ? AND signed_as_proxy = ? AND (delegated_by <=> ? OR (? IS NULL AND delegated_by IS NULL))`,
          [
            approved ? 'approved' : 'rejected',
            signature || null,
            electronic_signature || null,
            notes || '',
            contentId,
            approverId,
            isProxy ? 1 : 0,
            delegatedBy,
            delegatedBy
          ]
        );
      }
    }

    // إضافة المستخدم المفوض له إلى content_approvers إذا لم يكن موجوداً
    if (isProxy && approved) {
      await db.execute(
        `INSERT IGNORE INTO ${contentApproversTable} (content_id, user_id) VALUES (?, ?)`,
        [contentId, approverId]
      );
    }

    // جلب عدد المعتمدين المتبقين قبل إشعارات صاحب الملف
    // منطق مبسط لحساب الاعتماد المزدوج
    const [remaining] = await db.execute(`
      SELECT COUNT(*) AS count
      FROM content_approvers ca
      WHERE ca.content_id = ? 
        AND (
          -- للمستخدمين العاديين: لا يوجد توقيع
          (ca.user_id NOT IN (
            SELECT delegate_id FROM active_delegations
          ) AND NOT EXISTS (
            SELECT 1 FROM approval_logs al
            WHERE al.content_id = ca.content_id 
              AND al.approver_id = ca.user_id
              AND al.status = 'approved'
          ))
          OR
          -- للمستخدمين المفوض لهم: أقل من توقيعين
          (ca.user_id IN (
            SELECT delegate_id FROM active_delegations
          ) AND (
            SELECT COUNT(*) FROM approval_logs al
            WHERE al.content_id = ca.content_id 
              AND al.approver_id = ca.user_id
              AND al.status = 'approved'
          ) < 2)
        )
    `, [contentId]);

    // جلب عدد التوقيعات للمستخدم الحالي للتشخيص
    const [currentUserLogs] = await db.execute(`
      SELECT COUNT(*) as count FROM approval_logs 
      WHERE content_id = ? AND approver_id = ? AND status = 'approved'
    `, [contentId, currentUserId]);

    // جلب التفويضات النشطة للمستخدم الحالي
    const [activeDelegations] = await db.execute(`
      SELECT COUNT(*) as count FROM active_delegations 
      WHERE delegate_id = ?
    `, [currentUserId]);

    // استعلام تشخيصي مفصل
    const [allApprovers] = await db.execute(`
      SELECT 
        ca.user_id,
        u.username,
        (SELECT COUNT(*) FROM active_delegations WHERE delegate_id = ca.user_id) as is_delegated,
        (SELECT COUNT(*) FROM approval_logs WHERE content_id = ca.content_id AND approver_id = ca.user_id AND status = 'approved') as approval_count
      FROM content_approvers ca
      JOIN users u ON ca.user_id = u.id
      WHERE ca.content_id = ?
    `, [contentId]);

    // استعلام تشخيصي للتوقيعات المفصلة
    const [detailedLogs] = await db.execute(`
      SELECT 
        approver_id,
        signed_as_proxy,
        delegated_by,
        status,
        created_at
      FROM approval_logs 
      WHERE content_id = ? AND approver_id = ?
      ORDER BY created_at DESC
    `, [contentId, currentUserId]);

    console.log('🔍 Remaining approvers check:', {
      contentId,
      remainingCount: remaining[0].count,
      delegationRows: delegationRows.length,
      currentUserApprovals: currentUserLogs[0].count,
      activeDelegations: activeDelegations[0].count,
      allApprovers: allApprovers,
      detailedLogs: detailedLogs
    });

    // Fetch details for logging
    const [itemDetails] = await db.execute(`SELECT title FROM ${contentsTable} WHERE id = ?`, [contentId]);
    const itemTitle = itemDetails.length > 0 ? itemDetails[0].title : `رقم ${contentId}`;

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

    let [ownerRows] = await db.execute(`SELECT created_by, title FROM ${contentsTable} WHERE id = ?`, [contentId]);
    if (ownerRows.length) {
      const ownerId = ownerRows[0].created_by;
      const fileTitle = ownerRows[0].title || '';
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
    }

    if (approved === true && isProxy) {
      await addApproverWithDelegation(contentId, approverId);
    }

    // إزالة التفويض الفردي بعد التوقيع
    if (singleDelegationRows && singleDelegationRows.length > 0) {
      await db.execute(`
        UPDATE approval_logs 
        SET status = 'completed' 
        WHERE content_id = ? AND approver_id = ? AND signed_as_proxy = 1 AND status = 'accepted'
      `, [contentId, currentUserId]);
      console.log('✅ Single delegation marked as completed for user:', currentUserId);
    }

    if (remaining[0].count === 0) {
      console.log('🎉 All approvers completed! Updating file status...');
      await generatePdfFunction(contentId);
      const updateResult = await db.execute(`
        UPDATE ${contentsTable}
        SET is_approved = 1,
            approval_status = 'approved',
            approved_by = ?,
            updated_at = NOW()
        WHERE id = ?
      `, [approverId, contentId]);
      console.log('✅ File status updated:', updateResult);
    } else {
      console.log('⏳ Still waiting for', remaining[0].count, 'approvers');
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
      u_actual.job_title AS signer_job_title,
      u_original.job_title AS original_job_title
    FROM approval_logs al
    JOIN users u_actual
      ON al.approver_id = u_actual.id
    LEFT JOIN users u_original
      ON al.delegated_by = u_original.id
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
        
        // إضافة صفحات PDF الأصلي أولاً
        const originalPdfDoc = await PDFDocument.load(originalPdfBytes);
        const originalPages = await mergedPdf.copyPages(originalPdfDoc, originalPdfDoc.getPageIndices());
        originalPages.forEach((page) => mergedPdf.addPage(page));
        
        // إضافة صفحة الاعتمادات في النهاية
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


async function getUserPermissions(userId) {
  const [permRows] = await db.execute(`
    SELECT p.permission_key
    FROM permissions p
    JOIN user_permissions up ON up.permission_id = p.id
    WHERE up.user_id = ?
  `, [userId]);
  return new Set(permRows.map(r => r.permission_key));
}

// جلب الملفات المكلف بها المستخدم
const getAssignedApprovals = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    let userId = decoded.id;
    const userRole = decoded.role;

    const permsSet = await getUserPermissions(userId);
    const canViewAll = userRole === 'admin' || permsSet.has('transfer_credits');

    // لو الكيان ليس admin أو لا يملك الصلاحية، نبني استعلام محدود
    const departmentContentQuery = canViewAll
      ? `
        SELECT
          CONCAT('dept-', c.id) AS id,
          c.title,
          c.file_path,
          c.approval_status,
          GROUP_CONCAT(DISTINCT u2.username ORDER BY ca.sequence_number) AS assigned_approvers,
          d.name AS source_name,
          f.name AS folder_name,
          u.username AS created_by_username,
          'department' AS type,
          CAST(c.approvers_required AS CHAR) AS approvers_required,
          c.created_at,
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
      `
      : `
        SELECT
          CONCAT('dept-', c.id) AS id,
          c.title,
          c.file_path,
          c.approval_status,
          GROUP_CONCAT(DISTINCT u2.username ORDER BY ca.sequence_number) AS assigned_approvers,
          d.name AS source_name,
          f.name AS folder_name,
          u.username AS created_by_username,
          'department' AS type,
          CAST(c.approvers_required AS CHAR) AS approvers_required,
          c.created_at,
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
        AND (
          -- التحقق من أن جميع المعتمدين السابقين قد وقعوا
          ca.sequence_number = 1 
          OR NOT EXISTS (
            SELECT 1 FROM content_approvers ca2
            JOIN approval_logs al ON al.content_id = ca2.content_id AND al.approver_id = ca2.user_id
            WHERE ca2.content_id = c.id 
              AND ca2.sequence_number < ca.sequence_number
              AND al.status = 'approved'
          ) = 0
        )
        GROUP BY c.id, ca.sequence_number
      `;

    const committeeContentQuery = canViewAll
      ? `
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
          cca.sequence_number
        FROM committee_contents cc
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
      `
      : `
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
        AND (
          -- التحقق من أن جميع المعتمدين السابقين قد وقعوا
          cca.sequence_number = 1 
          OR NOT EXISTS (
            SELECT 1 FROM committee_content_approvers cca2
            JOIN committee_approval_logs cal ON cal.content_id = cca2.content_id AND cal.approver_id = cca2.user_id
            WHERE cca2.content_id = cc.id 
              AND cca2.sequence_number < cca.sequence_number
              AND cal.status = 'approved'
          ) = 0
        )
        GROUP BY cc.id, cca.sequence_number
      `;

    // إذا كان مفوّض محدود نمرر userId مرتين فقط (مرة للقسم ومرة للجنة)
    const params = canViewAll
      ? [userId, userId]
      : [userId, userId, userId, userId];

    const finalQuery = `
      ${departmentContentQuery}
      UNION ALL
      ${committeeContentQuery}
      ORDER BY created_at DESC
    `;

    let [rows] = await db.execute(finalQuery, params);

    // تحويل الحقل من نص JSON إلى مصفوفة
    rows.forEach(row => {
      try {
        row.approvers_required = JSON.parse(row.approvers_required);
      } catch {
        row.approvers_required = [];
      }
    });

    return res.json({ status: 'success', data: rows });
  } catch (err) {
    console.error('Error in getAssignedApprovals:', err);
    return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
  }
};


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
  console.log('[getProxyApprovals]', {
    method: req.method,
    url: req.originalUrl,
    authorization: req.headers.authorization
  });
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
      WHERE al.approver_id = ? AND al.signed_as_proxy = 1 AND al.status IN ('pending', 'accepted')
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
      // حذف سجل التفويض من approval_logs
      await db.execute(
        `DELETE FROM approval_logs WHERE content_id = ? AND approver_id = ? AND delegated_by = ? AND signed_as_proxy = 1 AND status = 'pending'`,
        [row.content_id, row.approver_id, userId]
      );
      // إعادة المفوض الأصلي إلى جدول content_approvers إذا لم يكن موجوداً
      await db.execute(
        `INSERT IGNORE INTO content_approvers (content_id, user_id) VALUES (?, ?)`,
        [row.content_id, userId]
      );
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
      }
    }
    
    // حذف سجلات active_delegations (حتى لو لم يكن لديه ملفات نشطة)
    await db.execute('DELETE FROM active_delegations WHERE user_id = ?', [userId]);
    
    // تسجيل لوق
    await logAction(adminId, 'revoke_all_delegations', JSON.stringify({ ar: `تم إلغاء جميع التفويضات التي أعطاها المستخدم رقم ${userId}` }), 'user', userId);
    res.status(200).json({ status: 'success', message: 'تم إلغاء جميع التفويضات بنجاح.' });
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
      // تحقق إذا كان المفوض الأصلي كان معتمدًا قبل التفويض
      const [wasApprover] = await db.execute(
        `SELECT * FROM approval_logs WHERE content_id = ? AND approver_id = ? AND signed_as_proxy = 0`,
        [id, delegationRow[0].delegated_by]
      );
      if (wasApprover.length) {
        await db.execute(
          `INSERT IGNORE INTO content_approvers (content_id, user_id) VALUES (?, ?)` ,
          [id, delegationRow[0].delegated_by]
        );
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
      }
    }
    // حذف سجل active_delegations
    await db.execute('DELETE FROM active_delegations WHERE user_id = ? AND delegate_id = ?', [id, delegateeId]);
    // تسجيل لوق
    await logAction(adminId, 'revoke_delegation', JSON.stringify({ ar: `تم إلغاء تفويض الملف رقم ${id} من المستخدم رقم ${delegateeId}` }), 'content', id);
    res.status(200).json({ status: 'success', message: 'تم إلغاء التفويض بنجاح.' });
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
    
    const { contentId, action, contentType, reason } = req.body;
    if (!contentId || !action || !contentType) {
      return res.status(400).json({ status: 'error', message: 'يرجى تحديد الملف والإجراء والنوع' });
    }

    const isCommittee = contentType === 'committee';
    const tableName = isCommittee ? 'committee_approval_logs' : 'approval_logs';
    const approversTable = isCommittee ? 'committee_content_approvers' : 'content_approvers';
    const contentsTable = isCommittee ? 'committee_contents' : 'contents';

    // جلب معلومات التفويض
    const [delegationRows] = await db.execute(`
      SELECT * FROM ${tableName} 
      WHERE content_id = ? AND approver_id = ? AND signed_as_proxy = 1 AND status = 'pending'
    `, [contentId, currentUserId]);

    if (delegationRows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'لم يتم العثور على التفويض' });
    }

    const delegation = delegationRows[0];
    const delegatorId = delegation.delegated_by;

    if (action === 'accept') {
      // قبول التفويض الفردي
      // تحديث حالة التفويض إلى مقبول
      await db.execute(`
        UPDATE ${tableName} 
        SET status = 'accepted' 
        WHERE id = ?
      `, [delegation.id]);

      // لا نضيف المستخدم إلى approvers بشكل دائم
      // التفويض الفردي يكون مؤقت فقط لهذا الملف المحدد
      // سيتم التعامل معه عند التوقيع الفعلي

      // إرسال إشعار للمفوض الأصلي
      await insertNotification(
        delegatorId,
        'single_delegation_accepted',
        JSON.stringify({ 
          ar: `تم قبول تفويض الملف الفردي من قبل ${currentUserId}`,
          en: `Single file delegation accepted by ${currentUserId}`
        }),
        contentsTable,
        contentId
      );

      res.status(200).json({ status: 'success', message: 'تم قبول التفويض الفردي بنجاح' });

    } else if (action === 'reject') {
      // رفض التفويض الفردي
      // تحديث حالة التفويض إلى مرفوض
      await db.execute(`
        UPDATE ${tableName} 
        SET status = 'rejected', comments = ? 
        WHERE id = ?
      `, [reason || null, delegation.id]);

      // إعادة المفوض الأصلي إلى approvers
      await db.execute(
        `INSERT IGNORE INTO ${approversTable} (content_id, user_id) VALUES (?, ?)`,
        [contentId, delegatorId]
      );

      // إرسال إشعار للمفوض الأصلي
      await insertNotification(
        delegatorId,
        'single_delegation_rejected',
        JSON.stringify({ 
          ar: `تم رفض تفويض الملف الفردي من قبل ${currentUserId}`,
          en: `Single file delegation rejected by ${currentUserId}`
        }),
        contentsTable,
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
      // حذف التفويض من approval_logs
      await db.execute('DELETE FROM approval_logs WHERE id = ? AND approver_id = ? AND signed_as_proxy = 1', [delegationId, userId]);
      // حذف التفويض من committee_approval_logs
      await db.execute('DELETE FROM committee_approval_logs WHERE id = ? AND approver_id = ? AND signed_as_proxy = 1', [delegationId, userId]);
      return res.status(200).json({ status: 'success', message: 'تم رفض طلب التفويض' });
    }

    if (action === 'accept') {
      // جلب التفويض من approval_logs أو committee_approval_logs
      let [delegation] = await db.execute(
        'SELECT * FROM approval_logs WHERE id = ? AND approver_id = ? AND signed_as_proxy = 1 AND status = "pending"',
        [delegationId, userId]
      );
      
      let isCommittee = false;
      if (!delegation.length) {
        [delegation] = await db.execute(
          'SELECT * FROM committee_approval_logs WHERE id = ? AND approver_id = ? AND signed_as_proxy = 1 AND status = "pending"',
          [delegationId, userId]
        );
        isCommittee = true;
      }

      if (!delegation.length) {
        return res.status(404).json({ status: 'error', message: 'لا يوجد طلب تفويض معلق' });
      }

      const delegationData = delegation[0];

      if (isCommittee) {
        // معالجة تفويض اللجان
        if (delegationData.content_id) {
          await db.execute(
            'INSERT IGNORE INTO committee_content_approvers (content_id, user_id) VALUES (?, ?)',
            [delegationData.content_id, userId]
          );
          
          if (delegationData.delegated_by && userId !== delegationData.delegated_by) {
            await db.execute(
              'DELETE FROM committee_content_approvers WHERE content_id = ? AND user_id = ?',
              [delegationData.content_id, delegationData.delegated_by]
            );
          }
        }
        
        await db.execute(
          'UPDATE committee_approval_logs SET status = "accepted" WHERE id = ?',
          [delegationId]
        );
      } else {
        // معالجة تفويض الأقسام
        if (delegationData.content_id) {
          await db.execute(
            'INSERT IGNORE INTO content_approvers (content_id, user_id) VALUES (?, ?)',
            [delegationData.content_id, userId]
          );
          
          if (delegationData.delegated_by && userId !== delegationData.delegated_by) {
            await db.execute(
              'DELETE FROM content_approvers WHERE content_id = ? AND user_id = ?',
              [delegationData.content_id, delegationData.delegated_by]
            );
          }
        }
        
        await db.execute(
          'UPDATE approval_logs SET status = "accepted" WHERE id = ?',
          [delegationId]
        );
      }

      // إضافة سجل في active_delegations للتفويض النشط
      if (delegationData.delegated_by) {
        await db.execute(
          'INSERT IGNORE INTO active_delegations (user_id, delegate_id) VALUES (?, ?)',
          [delegationData.delegated_by, userId]
        );
      }

      return res.status(200).json({ 
        status: 'success', 
        message: 'تم قبول التفويض بنجاح',
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
      // إضافة المستخدم مباشرة إلى committee_content_approvers
      await db.execute(
        'INSERT IGNORE INTO committee_content_approvers (content_id, user_id) VALUES (?, ?)',
        [cleanContentId, delegateTo]
      );
      
      // إنشاء سجل تفويض بالنيابة للجان
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
      
      // حذف المفوض الأصلي من committee_content_approvers
      await db.execute(
        'DELETE FROM committee_content_approvers WHERE content_id = ? AND user_id = ?',
        [cleanContentId, currentUserId]
      );
    } else {
      // إضافة المستخدم مباشرة إلى content_approvers
      await db.execute(
        'INSERT IGNORE INTO content_approvers (content_id, user_id) VALUES (?, ?)',
        [cleanContentId, delegateTo]
      );
      
      // إنشاء سجل تفويض بالنيابة للأقسام
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
      
      // حذف المفوض الأصلي من content_approvers
      await db.execute(
        'DELETE FROM content_approvers WHERE content_id = ? AND user_id = ?',
        [cleanContentId, currentUserId]
      );
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
      contentId
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
  checkActiveDelegationType
};


