const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

const { logAction } = require('../models/logger');
const { insertNotification, sendProxyNotification, sendOwnerApprovalNotification, sendPartialApprovalNotification } = require('../models/notfications-utils');
require('dotenv').config();

// متغير global لحفظ علاقات التفويض الدائم (delegateeId -> delegatorId)
const globalPermanentDelegations = {};

// Create a MySQL pool
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

/**
 * 1. Get pending committee approvals for the logged-in user
 */
async function getUserPendingCommitteeApprovals(req, res) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    const { id: userId } = jwt.verify(token, process.env.JWT_SECRET);

    // تحقق إذا كان المستخدم مفوض له من active_delegations
    const [delegationRows] = await db.execute(
      'SELECT user_id FROM active_delegations WHERE delegate_id = ?',
      [userId]
    );

    let rows = [];

    if (delegationRows.length) {
      // المستخدم مفوض له - سيظهر له الملف مرة واحدة وسيعتمد مرتين تلقائياً
      const delegatorId = delegationRows[0].user_id;
      
      // جلب الملفات المكلف بها المستخدم (شخصياً أو بالنيابة)
      // المهم: لا تظهر الملف للمفوض الأصلي، فقط للمفوض له
      const [delegatedRows] = await db.execute(`
        SELECT
          CONCAT('comm-', cc.id) AS id,
          cc.title,
          cc.file_path,
          cc.notes,
          cc.approval_status,
          CAST(cc.approvers_required AS CHAR) AS approvers_required,
          cc.created_at,
          cf.name AS folderName,
          com.name  AS source_name,
          'committee' AS type,
          GROUP_CONCAT(DISTINCT u2.username) AS assigned_approvers,
          'dual' AS signature_type
        FROM committee_contents cc
        JOIN committee_folders cf     ON cc.folder_id = cf.id
        JOIN committees com           ON cf.committee_id = com.id
        LEFT JOIN committee_content_approvers cca ON cca.content_id = cc.id
        LEFT JOIN users u2            ON cca.user_id = u2.id
        WHERE cc.is_approved = 0
          AND JSON_CONTAINS(cc.approvers_required, JSON_ARRAY(?))
          AND NOT EXISTS (
            SELECT 1 FROM committee_approval_logs cal
            WHERE cal.content_id = cc.id
              AND cal.approver_id = ?
              AND cal.status = 'approved'
          )
        GROUP BY cc.id
        ORDER BY cc.created_at DESC
      `, [userId, userId]);

      rows = delegatedRows;
    } else {
      // المستخدم عادي - جلب الملفات المكلف بها فقط
      const [normalRows] = await db.execute(`
        SELECT
          CONCAT('comm-', cc.id) AS id,
          cc.title,
          cc.file_path,
          cc.notes,
          cc.approval_status,
          CAST(cc.approvers_required AS CHAR) AS approvers_required,
          cc.created_at,
          cf.name AS folderName,
          com.name  AS source_name,
          'committee' AS type,
          GROUP_CONCAT(DISTINCT u2.username) AS assigned_approvers,
          'normal' AS signature_type
        FROM committee_contents cc
        JOIN committee_folders cf     ON cc.folder_id = cf.id
        JOIN committees com           ON cf.committee_id = com.id
        LEFT JOIN committee_content_approvers cca ON cca.content_id = cc.id
        LEFT JOIN users u2            ON cca.user_id = u2.id
        WHERE cc.is_approved = 0
          AND JSON_CONTAINS(cc.approvers_required, JSON_ARRAY(?))
          AND NOT EXISTS (
            SELECT 1 FROM committee_approval_logs cal
            WHERE cal.content_id = cc.id
              AND cal.approver_id = ?
              AND cal.status = 'approved'
          )
        GROUP BY cc.id
        ORDER BY cc.created_at DESC
      `, [userId, userId]);

      rows = normalRows;
    }

    // parse JSON fields
    rows.forEach(r => {
      try {
        r.approvers_required = JSON.parse(r.approvers_required);
      } catch {
        r.approvers_required = [];
      }
    });

    res.json({ status: 'success', data: rows });
  } catch (err) {
    console.error('Error in getUserPendingCommitteeApprovals:', err);
    res.status(500).json({ status: 'error', message: 'خطأ في جلب الموافقات المعلقة للجان' });
  }
}

/**
 * 2. Approve or reject a committee content
 */
async function handleCommitteeApproval(req, res) {
  const originalId = req.params.contentId;        // e.g. "comm-123"
  const { approved, signature, electronic_signature, notes, on_behalf_of } = req.body;

  if (typeof approved !== 'boolean') {
    return res.status(400).json({ status: 'error', message: 'البيانات ناقصة' });
  }

  // extract numeric ID
  const contentId = parseInt(originalId.replace(/^comm-/, ''), 10);
  if (isNaN(contentId)) {
    return res.status(400).json({ status: 'error', message: 'معرّف غير صالح' });
  }

  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentUserId = decoded.id;

    // 2) منطق التوقيع المزدوج للمفوض له
    // المستخدم المفوض له يعتمد مرتين تلقائياً:
    // 1. توقيع شخصي (isProxy = false, delegatedBy = null)
    // 2. توقيع بالنيابة (isProxy = true, delegatedBy = delegatorId)
    let delegatedBy = null;
    let isProxy = false;

    // تحقق إذا كان المستخدم مفوض له من active_delegations
    const [delegationRows] = await db.execute(
      'SELECT user_id FROM active_delegations WHERE delegate_id = ?',
      [currentUserId]
    );

    if (delegationRows.length) {
      const delegatorId = delegationRows[0].user_id;
      
      // المستخدم مفوض له - سيتم الاعتماد مرتين تلقائياً
      // التوقيع الأول: شخصي
      delegatedBy = null;
      isProxy = false;
    } else {
      // المستخدم ليس مفوض له، تحقق من السجلات القديمة
      if (on_behalf_of) {
        // إذا أرسل on_behalf_of ولكن ليس مفوض له، تحقق من السجلات
        const [existing] = await db.execute(`
          SELECT delegated_by, signed_as_proxy
          FROM committee_approval_logs
          WHERE content_id = ? AND approver_id = ?
          LIMIT 1
        `, [contentId, currentUserId]);

        if (existing.length && existing[0].signed_as_proxy === 1) {
          delegatedBy = existing[0].delegated_by;
          isProxy = true;
        }
      }
    }

    // 3) الموقّع الفعلي دائماً currentUserId
    const approverId = currentUserId;

    // Debug logging - يمكن إزالته بعد التأكد من عمل النظام
    // console.log('🔍 Committee Approval Debug:', {
    //   currentUserId,
    //   approverId,
    //   delegatedBy,
    //   isProxy,
    //   on_behalf_of,
    //   delegationRows: delegationRows.length
    // });

    if (approved && !signature && !electronic_signature) {
      return res.status(400).json({ status: 'error', message: 'التوقيع مفقود' });
    }



    // منطق الاعتماد المزدوج للمستخدم المفوض له
    if (delegationRows.length) {
      const delegatorId = delegationRows[0].user_id;
      
      console.log('🔍 Saving dual committee approval for delegated user:', {
        userId: currentUserId,
        delegatorId,
        contentId
      });
      
      // التوقيع الأول: شخصي
      const [existingPersonalLogs] = await db.execute(
        `SELECT * FROM committee_approval_logs WHERE content_id = ? AND approver_id = ? AND signed_as_proxy = 0 AND delegated_by IS NULL`,
        [contentId, approverId]
      );
      
      if (!existingPersonalLogs.length) {
        // حفظ التوقيع الشخصي
        await db.execute(`
          INSERT IGNORE INTO committee_approval_logs (
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
          VALUES (?, ?, NULL, 0, ?, ?, ?, ?, NOW())
        `, [
          contentId,
          approverId,
          approved ? 'approved' : 'rejected',
          signature || null,
          electronic_signature || null,
          notes || ''
        ]);
        console.log('✅ Saved personal committee approval for user:', currentUserId);
      } else {
        // تحديث التوقيع الشخصي
        await db.execute(
          `UPDATE committee_approval_logs SET status = ?, signature = ?, electronic_signature = ?, comments = ?, created_at = NOW() WHERE content_id = ? AND approver_id = ? AND signed_as_proxy = 0 AND delegated_by IS NULL`,
          [
            approved ? 'approved' : 'rejected',
            signature || null,
            electronic_signature || null,
            notes || '',
            contentId,
            approverId
          ]
        );
        console.log('✅ Updated personal committee approval for user:', currentUserId);
      }
      
      // التوقيع الثاني: بالنيابة
      const [existingProxyLogs] = await db.execute(
        `SELECT * FROM committee_approval_logs WHERE content_id = ? AND approver_id = ? AND signed_as_proxy = 1 AND delegated_by = ?`,
        [contentId, approverId, delegatorId]
      );
      
      if (!existingProxyLogs.length) {
        // حفظ التوقيع بالنيابة
        await db.execute(`
          INSERT IGNORE INTO committee_approval_logs (
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
        console.log('✅ Saved proxy committee approval for user:', currentUserId, 'on behalf of:', delegatorId);
      } else {
        // تحديث التوقيع بالنيابة
        await db.execute(
          `UPDATE committee_approval_logs SET status = ?, signature = ?, electronic_signature = ?, comments = ?, created_at = NOW() WHERE content_id = ? AND approver_id = ? AND signed_as_proxy = 1 AND delegated_by = ?`,
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
        console.log('✅ Updated proxy committee approval for user:', currentUserId, 'on behalf of:', delegatorId);
      }
      
      console.log('✅ تم الاعتماد المزدوج للجنة للمستخدم المفوض له:', {
        userId: currentUserId,
        delegatorId,
        contentId,
        personalLogs: existingPersonalLogs.length,
        proxyLogs: existingProxyLogs.length
      });
      
    } else {
      // المستخدم عادي - اعتماد واحد فقط
      const [existingLogs] = await db.execute(
        `SELECT * FROM committee_approval_logs WHERE content_id = ? AND approver_id = ? AND signed_as_proxy = ? AND (delegated_by <=> ? OR (? IS NULL AND delegated_by IS NULL))`,
        [contentId, approverId, isProxy ? 1 : 0, delegatedBy, delegatedBy]
      );

      if (!existingLogs.length) {
        // استخدام INSERT IGNORE لتجنب خطأ duplicate entry
        const insertResult = await db.execute(`
          INSERT IGNORE INTO committee_approval_logs (
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
          `UPDATE committee_approval_logs SET status = ?, signature = ?, electronic_signature = ?, comments = ?, created_at = NOW() WHERE content_id = ? AND approver_id = ? AND signed_as_proxy = ? AND (delegated_by <=> ? OR (? IS NULL AND delegated_by IS NULL))`,
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

    // Fetch details for logging
    const [contentDetails] = await db.execute(`
        SELECT cc.title, com.name as committee_name
        FROM committee_contents cc
        JOIN committee_folders cf ON cc.folder_id = cf.id
        JOIN committees com ON cf.committee_id = com.id
        WHERE cc.id = ?
    `, [contentId]);

    const title = contentDetails.length ? contentDetails[0].title : `ID ${contentId}`;
    const committeeName = contentDetails.length ? contentDetails[0].committee_name : '';

    const logDescription = {
        ar: `تم ${approved ? 'اعتماد' : 'رفض'} ملف اللجنة: "${getContentNameByLanguage(title, 'ar')}" في لجنة: "${getCommitteeNameByLanguage(committeeName, 'ar')}"${isProxy ? ' كمفوض عن مستخدم آخر' : ''}`,
        en: `${approved ? 'Approved' : 'Rejected'} committee content: "${getContentNameByLanguage(title, 'en')}" in committee: "${getCommitteeNameByLanguage(committeeName, 'en')}"${isProxy ? ' as a proxy' : ''}`
    };

    await logAction(
      currentUserId,
      approved ? 'approve_committee_content' : 'reject_committee_content',
      JSON.stringify(logDescription),
      'committee_content',
      contentId
    );
    
    // إشعار للمفوض له إذا تم التوقيع بالنيابة
    if (isProxy && approverId) {
      // لم يعد هناك إشعار هنا
    }

    // Check if any approvers remain - منطق مبسط لحساب الاعتماد المزدوج
    const [remaining] = await db.execute(`
      SELECT COUNT(*) AS cnt
      FROM committee_content_approvers cca
      WHERE cca.content_id = ? 
        AND (
          -- للمستخدمين العاديين: لا يوجد توقيع
          (cca.user_id NOT IN (
            SELECT delegate_id FROM active_delegations
          ) AND NOT EXISTS (
            SELECT 1 FROM committee_approval_logs al
            WHERE al.content_id = cca.content_id 
              AND al.approver_id = cca.user_id
              AND al.status = 'approved'
          ))
          OR
          -- للمستخدمين المفوض لهم: أقل من توقيعين
          (cca.user_id IN (
            SELECT delegate_id FROM active_delegations
          ) AND (
            SELECT COUNT(*) FROM committee_approval_logs al
            WHERE al.content_id = cca.content_id 
              AND al.approver_id = cca.user_id
              AND al.status = 'approved'
          ) < 2)
        )
    `, [contentId]);

    // جلب عدد التوقيعات للمستخدم الحالي للتشخيص
    const [currentUserLogs] = await db.execute(`
      SELECT COUNT(*) as count FROM committee_approval_logs 
      WHERE content_id = ? AND approver_id = ? AND status = 'approved'
    `, [contentId, currentUserId]);

    // جلب التفويضات النشطة للمستخدم الحالي
    const [activeDelegations] = await db.execute(`
      SELECT COUNT(*) as count FROM active_delegations 
      WHERE delegate_id = ?
    `, [currentUserId]);

    // استعلام تشخيصي للتوقيعات المفصلة
    const [detailedLogs] = await db.execute(`
      SELECT 
        approver_id,
        signed_as_proxy,
        delegated_by,
        status,
        created_at
      FROM committee_approval_logs 
      WHERE content_id = ? AND approver_id = ?
      ORDER BY created_at
    `, [contentId, currentUserId]);

    console.log('🔍 Committee remaining approvers check:', {
      contentId,
      remainingCount: remaining[0].cnt,
      delegationRows: delegationRows.length,
      currentUserApprovals: currentUserLogs[0].count,
      activeDelegations: activeDelegations[0].count,
      detailedLogs: detailedLogs
    });

    // إشعار لصاحب الملف عند قبول أو رفض التوقيع
    // جلب صاحب الملف
    let [ownerRows] = await db.execute(`SELECT created_by, title FROM committee_contents WHERE id = ?`, [contentId]);
    if (ownerRows.length) {
      const ownerId = ownerRows[0].created_by;
      const fileTitle = ownerRows[0].title || '';
      // إذا لم يكتمل الاعتماد النهائي، أرسل إشعار اعتماد جزئي
      if (approved && remaining[0].cnt > 0) {
        // جلب اسم المعتمد
        const [approverRows] = await db.execute('SELECT username FROM users WHERE id = ?', [approverId]);
        const approverName = approverRows.length ? approverRows[0].username : '';
        await sendPartialApprovalNotification(ownerId, fileTitle, approverName, true);
      }
      // إذا اكتمل الاعتماد النهائي، أرسل إشعار "تم اعتماد الملف من الإدارة"
      if (remaining[0].cnt === 0) {
        await sendOwnerApprovalNotification(ownerId, fileTitle, approved, true);
      }
    }

    // إضافة المستخدم المفوض له إلى committee_content_approvers إذا لم يكن موجوداً
    if (isProxy && approved) {
      await db.execute(`
        INSERT IGNORE INTO committee_content_approvers (content_id, user_id)
        VALUES(?, ?)
      `, [contentId, approverId]);
    }

    // If none remain, finalize
    if (remaining[0].cnt === 0) {
      console.log('🎉 All committee approvers completed! Updating file status...');
      await generateFinalSignedCommitteePDF(contentId);
      const updateResult = await db.execute(`
        UPDATE committee_contents
        SET is_approved     = 1,
            approval_status = 'approved',
            approved_by     = ?,
            updated_at      = NOW()
        WHERE id = ?
      `, [approverId, contentId]);
      console.log('✅ Committee file status updated:', updateResult);
    } else {
      console.log('⏳ Still waiting for', remaining[0].cnt, 'committee approvers');
    }

    res.json({ status: 'success', message: 'تم التوقيع بنجاح' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'خطأ أثناء معالجة الاعتماد' });
  }
}

/**
 * 3. List all committee contents assigned to me or created by me
 */
async function getAssignedCommitteeApprovals(req, res) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) 
      return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });

    const decoded   = jwt.verify(token, process.env.JWT_SECRET);
    const userId    = decoded.id;
    const userRole  = decoded.role;

    // 1) جلب صلاحيات المستخدم
    const [permRows] = await db.execute(`
      SELECT p.permission_key
      FROM user_permissions up
      JOIN permissions p ON up.permission_id = p.id
      WHERE up.user_id = ?
    `, [userId]);
    const perms = new Set(permRows.map(r => r.permission_key));
    const canViewAll = (userRole === 'admin' || perms.has('transfer_credits'));

    // 2) قاعدة الاستعلام
    let baseQuery = `
      SELECT 
        CONCAT('comm-', cc.id)                AS id,
        cc.title,
        cc.file_path,
        cc.approval_status,
        GROUP_CONCAT(DISTINCT u2.username)    AS assigned_approvers,
        com.name                              AS source_name,
        cf.name                               AS folder_name,
        u.username                            AS created_by_username,
        'committee'                           AS type,
        CAST(cc.approvers_required AS CHAR)   AS approvers_required,
        cc.created_at
      FROM committee_contents cc
      JOIN committee_folders cf       ON cc.folder_id = cf.id
      JOIN committees com             ON cf.committee_id = com.id
      JOIN users u                    ON cc.created_by = u.id
    `;

    const params = [];

    if (!canViewAll) {
      baseQuery += `
        JOIN committee_content_approvers cca 
          ON cca.content_id = cc.id 
         AND cca.user_id = ?
        LEFT JOIN users u2 
          ON u2.id = cca.user_id
        WHERE NOT EXISTS (
          SELECT 1 FROM committee_approval_logs cal
          WHERE cal.content_id = cc.id
            AND cal.approver_id = ?
            AND cal.signed_as_proxy = 1
            AND cal.status IN ('pending','accepted')
        )
      `;
      params.push(userId, userId);
    } else {
      baseQuery += `
        LEFT JOIN committee_content_approvers cca 
          ON cca.content_id = cc.id
        LEFT JOIN users u2 
          ON u2.id = cca.user_id
        WHERE NOT EXISTS (
          SELECT 1 FROM committee_approval_logs cal
          WHERE cal.content_id = cc.id
            AND cal.approver_id = ?
            AND cal.signed_as_proxy = 1
            AND cal.status IN ('pending','accepted')
        )
      `;
      params.push(userId);
    }
    baseQuery += `
      GROUP BY cc.id
      ORDER BY cc.created_at DESC
    `;

    // 6) تنفيذ الاستعلام
    const [rows] = await db.execute(baseQuery, params);

    // إذا كان المستخدم مفوض له (من جدول active_delegations)
    // لا نحتاج لجلب ملفات المفوض الأصلي لأن المفوض له هو من سيعتمد
    // const [delegationRows] = await db.execute(
    //   'SELECT user_id FROM active_delegations WHERE delegate_id = ?',
    //   [userId]
    // );
    // if (delegationRows.length) {
    //   const delegatorId = delegationRows[0].user_id;
    //   // جلب ملفات المفوض الأصلي بنفس الاستعلام
    //   let delegatorParams = canViewAll ? [delegatorId] : [delegatorId, delegatorId];
    //   const [delegatorRows] = await db.execute(baseQuery, delegatorParams);
    //   // دمج النتائج بدون تكرار (حسب id)
    //   const existingIds = new Set(rows.map(r => r.id));
    //   delegatorRows.forEach(r => {
    //     if (!existingIds.has(r.id)) rows.push(r);
    //   });
    // }

    // 7) تحويل الحقل من JSON نصي إلى مصفوفة
    rows.forEach(r => {
      try {
        r.approvers_required = JSON.parse(r.approvers_required);
      } catch {
        r.approvers_required = [];
      }
    });

    return res.json({ status: 'success', data: rows });
  } catch (err) {
    console.error('Error in getAssignedCommitteeApprovals:', err);
    return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
  }
}

/**
 * 4. Delegate my committee approval to someone else
 */
// دالة مساعدة لتحويل title من JSON أو إعادته كما هو
function parseTitleByLang(jsonOrString, lang = 'ar') {
  if (!jsonOrString) return '';
  try {
    const obj = JSON.parse(jsonOrString);
    return obj[lang] || obj.ar || obj.en || '';
  } catch {
    return jsonOrString;
  }
}

async function delegateCommitteeApproval(req, res) {
  // 1) احصل على الرقم من "comm-<id>"
  let contentId;
  if (typeof req.params.id === 'string' && req.params.id.startsWith('comm-')) {
    contentId = parseInt(req.params.id.split('-')[1], 10);
  } else {
    contentId = parseInt(req.params.id, 10);
  }
  const { delegateTo, notes } = req.body;

  if (!contentId || !delegateTo) {
    return res.status(400).json({
      status: 'error',
      message: 'بيانات مفقودة للتفويض'
    });
  }

  try {
    // 2) فكّ التوكن
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentUserId = decoded.id;

    // 3) سجّل التفويض في جدول اللجان
    await db.execute(`
      INSERT IGNORE INTO committee_approval_logs (
        content_id, approver_id, delegated_by,
        signed_as_proxy, status, comments, created_at
      ) VALUES (?, ?, ?, 1, 'pending', ?, NOW())
    `, [contentId, delegateTo, currentUserId, notes || null]);
    
    // إضافة سجل في active_delegations للتفويض النشط
    await db.execute(
      'INSERT IGNORE INTO active_delegations (user_id, delegate_id) VALUES (?, ?)',
      [currentUserId, delegateTo]
    );



    // 4) جلب اسم المفوَّض
    const [delegateeRows] = await db.execute(
      'SELECT username FROM users WHERE id = ?', 
      [delegateTo]
    );
    const delegateeUsername = delegateeRows.length
      ? delegateeRows[0].username
      : String(delegateTo);

    // 5) جلب عنوان المحتوى من جدول committee_contents
    const [contentRows] = await db.execute(
      'SELECT title FROM committee_contents WHERE id = ?', 
      [contentId]
    );
    const rawTitle = contentRows.length
      ? contentRows[0].title
      : '';

    // 6) تحويل العنوان إلى نصوص عربية وإنجليزية
    const titleAr = parseTitleByLang(rawTitle, 'ar') || 'غير معروف';
    const titleEn = parseTitleByLang(rawTitle, 'en') || 'Unknown';

    // 7) سجل الحركة (باستخدام reference_type = 'approval' لأنه ضمن enum)
    const logDescription = {
      ar: `تم تفويض التوقيع للمستخدم: ${delegateeUsername} على ملف اللجنة: "${titleAr}"`,
      en: `Delegated signature to user: ${delegateeUsername} for committee file: "${titleEn}"`
    };
    await logAction(
      currentUserId,
      'delegate_committee_signature',
      JSON.stringify(logDescription),
      'approval',      // تأكد أن 'approval' موجودة في enum
      contentId
    );

    // إرسال إشعار فوري للمفوض له
    let delegatorName = '';
    const [delegatorRows] = await db.execute('SELECT username FROM users WHERE id = ?', [currentUserId]);
    delegatorName = delegatorRows.length ? delegatorRows[0].username : '';
    await insertNotification(
      delegateTo,
      'تم تفويضك للتوقيع',
      `تم تفويضك للتوقيع بالنيابة عن${delegatorName ? ' ' + delegatorName : ''} على ملف لجنة رقم ${contentId}`,
      'proxy'
    );
    await sendProxyNotification(delegateTo, contentId, true);

    // 8) أرسل رد بنجاح
    return res.json({
      status: 'success',
      message: '✅ تم التفويض بالنيابة بنجاح'
    });

  } catch (err) {
    console.error('خطأ في delegateCommitteeApproval:', err);
    return res.status(500).json({
      status: 'error',
      message: 'فشل التفويض بالنيابة'
    });
  }
}


/**
 * 5. Get pending approvals where I'm the proxy
 */
async function getProxyCommitteeApprovals(req, res) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    const { id: userId } = jwt.verify(token, process.env.JWT_SECRET);

    const [rows] = await db.execute(`
      SELECT
        CONCAT('comm-', al.content_id) AS id,
        cc.title,
        cc.approval_status,
        com.name AS committeeName,
        u.username AS delegated_by
      FROM committee_approval_logs al
      JOIN committee_contents cc   ON al.content_id = cc.id
      JOIN committee_folders cf    ON cc.folder_id = cf.id
      JOIN committees com          ON cf.committee_id = com.id
      JOIN users u                 ON al.delegated_by = u.id
      WHERE al.approver_id = ? 
        AND al.signed_as_proxy = 1
        AND al.status = 'pending'
    `, [userId]);

    res.json({ status: 'success', data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'فشل جلب الموافقات بالوكالة' });
  }
}


/**
 * Helper: generate final signed PDF for committee
 */
async function generateFinalSignedCommitteePDF(contentId) {
  const [rows] = await db.execute(
    `SELECT file_path FROM committee_contents WHERE id = ?`,
    [contentId]
  );
  if (!rows.length) return console.error('Committee content not found');

  const fullPath = path.join(__dirname, '../..', rows[0].file_path);
  if (!fs.existsSync(fullPath)) return console.error('File not found', fullPath);

  const pdfBytes = fs.readFileSync(fullPath);
  const pdfDoc   = await PDFDocument.load(pdfBytes);

  // 6) جلب سجلات الاعتماد مع بيانات النيابة
  const [logs] = await db.execute(`
    SELECT
      al.signature,
      al.electronic_signature,
      al.signed_as_proxy,
      al.delegated_by,
      u_actual.username   AS actual_signer,
      u_proxy.username    AS original_user,
      al.comments
    FROM committee_approval_logs al
    JOIN users u_actual ON al.approver_id = u_actual.id
    LEFT JOIN users u_proxy ON al.delegated_by = u_proxy.id
    WHERE al.content_id = ? AND al.status = 'approved'
  `, [contentId]);

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let page = pdfDoc.addPage();
  let y    = 750;

  page.drawText('Committee Signatures Summary', {
    x: 200, y, size: 20, font, color: rgb(0,0,0)
  });
  y -= 40;

  // 7) رسم التوقيعات مع "on behalf of"
  for (const log of logs) {
    if (y < 200) { page = pdfDoc.addPage(); y = 750; }
    const label = log.signed_as_proxy
      ? `Signed by ${log.actual_signer} on behalf of ${log.original_user}`
      : `Signed by ${log.actual_signer}`;
    page.drawText(label, { x: 50, y, size: 14, font });
    y -= 25;

    // hand signature
    if (log.signature?.startsWith('data:image')) {
      const imgBytes = Buffer.from(log.signature.split(',')[1], 'base64');
      const img      = await pdfDoc.embedPng(imgBytes);
      const dims     = img.scale(0.4);
      page.drawImage(img, {
        x: 150,
        y: y - dims.height + 10,
        width: dims.width,
        height: dims.height
      });
      y -= dims.height + 30;
    }

    // electronic signature
    if (log.electronic_signature) {
      const stampPath  = path.join(__dirname, '../e3teamdelc.png');
      const stampBytes = fs.readFileSync(stampPath);
      const stampImg   = await pdfDoc.embedPng(stampBytes);
      const stampDims  = stampImg.scale(0.5);
      page.drawImage(stampImg, {
        x: 150,
        y: y - stampDims.height + 10,
        width: stampDims.width,
        height: stampDims.height
      });
      y -= stampDims.height + 30;
    }

    if (log.comments) {
      page.drawText(`Comments: ${log.comments}`, { x:50, y, size:12, font });
      y -= 20;
    }

    page.drawLine({
      start: { x:50, y },
      end:   { x:550, y },
      thickness: 1,
      color: rgb(0.8,0.8,0.8)
    });
    y -= 30;
  }

  // 8) حفظ التعديلات
  const finalBytes = await pdfDoc.save();
  fs.writeFileSync(fullPath, finalBytes);
  console.log('✅ Committee signature page added:', fullPath);
}

// Helper function to get committee name by language
function getCommitteeNameByLanguage(committeeNameData, userLanguage = 'ar') {
    try {
        if (typeof committeeNameData === 'string' && committeeNameData.startsWith('{')) {
            const parsed = JSON.parse(committeeNameData);
            return parsed[userLanguage] || parsed['ar'] || committeeNameData;
        }
        return committeeNameData || 'غير معروف';
    } catch (error) {
        return committeeNameData || 'غير معروف';
    }
}

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

const acceptProxyDelegationCommittee = async (req, res) => {
  let contentId;
  if (typeof req.params.id === 'string' && req.params.id.startsWith('comm-')) {
    contentId = parseInt(req.params.id.split('-')[1], 10);
  } else {
    contentId = parseInt(req.params.id, 10);
  }
  const token = req.headers.authorization?.split(' ')[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const userId = decoded.id;

  try {
    console.log('[ACCEPT PROXY COMMITTEE] Start for contentId:', contentId, 'userId:', userId);
    
    // أضف المستخدم لجدول المعيّنين
    await db.execute(
      'INSERT IGNORE INTO committee_content_approvers (content_id, user_id) VALUES (?, ?)',
      [contentId, userId]
    );

    // جلب تسلسل الاعتماد (approvers_required أو committee)
    const [contentRows] = await db.execute(
      'SELECT approvers_required, folder_id FROM committee_contents WHERE id = ?',
      [contentId]
    );
    let sequence = [];
    let useCustom = false;
    if (contentRows.length && contentRows[0].approvers_required) {
      try {
        sequence = JSON.parse(contentRows[0].approvers_required);
        useCustom = true;
        console.log('[ACCEPT PROXY COMMITTEE] Got approvers_required:', sequence);
      } catch { sequence = []; }
    }
    // في QualityManagement، لا يوجد approval_sequence في جدول committees
    // نستخدم فقط approvers_required من جدول committee_contents
    if (!useCustom) {
      console.log('[ACCEPT PROXY COMMITTEE] No custom approvers_required found, using empty sequence');
    }

    // جلب المفوض الأصلي من جدول active_delegations
    let delegatedBy = null;
    const [delegationRows] = await db.execute(
      'SELECT user_id FROM active_delegations WHERE delegate_id = ?',
      [userId]
    );
    if (delegationRows.length) {
      delegatedBy = delegationRows[0].user_id;
      console.log('[ACCEPT PROXY COMMITTEE] Found active delegation from:', delegatedBy, 'to:', userId);
    } else {
      // fallback: جلب delegated_by من committee_approval_logs إذا كان تفويض يدوي
      const [proxyRows] = await db.execute(
        'SELECT delegated_by FROM committee_approval_logs WHERE content_id = ? AND approver_id = ? AND signed_as_proxy = 1',
        [contentId, userId]
      );
      if (proxyRows.length) {
        delegatedBy = Number(proxyRows[0].delegated_by);
        console.log('[ACCEPT PROXY COMMITTEE] Found manual delegation from:', delegatedBy, 'to:', userId);
      }
    }

    if (delegatedBy) {
      // لا نحتاج ترتيب - كل معتمد يعتمد بدون ترتيب
      // أضف سجل بالنيابة دائماً
      await db.execute(
        `INSERT IGNORE INTO committee_approval_logs (
          content_id, approver_id, delegated_by, signed_as_proxy, status, created_at
        ) VALUES (?, ?, ?, 1, 'pending', NOW())`,
        [contentId, userId, delegatedBy]
      );
      console.log('[ACCEPT PROXY COMMITTEE] Added proxy log for user:', userId, 'on behalf of:', delegatedBy);
      
      // أضف سجل عادي دائماً (لا نحتاج ترتيب)
      await db.execute(
        `INSERT IGNORE INTO committee_approval_logs (
          content_id, approver_id, delegated_by, signed_as_proxy, status, created_at
        ) VALUES (?, ?, NULL, 0, 'pending', NOW())`,
        [contentId, userId]
      );
      console.log('[ACCEPT PROXY COMMITTEE] Added self log for user:', userId);
      
      // احذف المفوض الأصلي من committee_content_approvers
      await db.execute(
        'DELETE FROM committee_content_approvers WHERE content_id = ? AND user_id = ?',
        [contentId, delegatedBy]
      );
      console.log('[ACCEPT PROXY COMMITTEE] Removed original delegator from committee_content_approvers:', delegatedBy);
      
      // جلب اسم المفوض الأصلي
      let delegatedByName = '';
      if (delegatedBy) {
        const [delegatedByRows] = await db.execute('SELECT username FROM users WHERE id = ?', [delegatedBy]);
        delegatedByName = delegatedByRows.length ? delegatedByRows[0].username : '';
      }
      console.log('[ACCEPT PROXY COMMITTEE] Done for contentId:', contentId, 'userId:', userId);
      return res.json({
        status: 'success',
        message: 'تم قبول التفويض وستظهر لك في تقارير اللجان المكلف بها. يمكنك التوقيع مرتين: مرة شخصية ومرة بالنيابة.',
        proxy: true,
        delegated_by: delegatedBy,
        delegated_by_name: delegatedByName
      });
    }
    // fallback القديم إذا لم يوجد delegatedBy
    let delegatedByName = '';
    if (delegatedBy) {
      const [delegatedByRows] = await db.execute('SELECT username FROM users WHERE id = ?', [delegatedBy]);
      delegatedByName = delegatedByRows.length ? delegatedByRows[0].username : '';
    }
    console.log('[ACCEPT PROXY COMMITTEE] Fallback/no delegation for contentId:', contentId, 'userId:', userId);
    return res.json({
      status: 'success',
      message: 'تم قبول التفويض وستظهر لك في تقارير اللجان المكلف بها',
      proxy: true,
      delegated_by: delegatedBy,
      delegated_by_name: delegatedByName
    });
  } catch (err) {
    console.error('[ACCEPT PROXY COMMITTEE] Error:', err)
    res.status(500).json({ status: 'error', message: 'فشل قبول التفويض للجنة' });
  }
};

const acceptAllProxyDelegationsCommittee = async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const userId = decoded.id;

  try {
    const [rows] = await db.execute(`
      SELECT content_id FROM committee_approval_logs
      WHERE approver_id = ? AND signed_as_proxy = 1 AND status = 'pending'
    `, [userId]);

    if (!rows.length) {
      return res.json({ status: 'success', message: 'لا يوجد تفويضات لقبولها' });
    }

    for (const row of rows) {
      await addCommitteeApproverWithDelegation(row.content_id, userId);
    }

    res.json({ status: 'success', message: 'تم قبول جميع تفويضات اللجان بنجاح' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'فشل قبول جميع تفويضات اللجان' });
  }
};

const delegateAllCommitteeApprovals = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentUserId = decoded.id;
    const { delegateTo, notes } = req.body;
    if (!delegateTo) return res.status(400).json({ status: 'error', message: 'يرجى اختيار المستخدم المفوض له' });

    // جلب جميع ملفات اللجان المعلقة للمستخدم الحالي
    const [rows] = await db.execute(`
      SELECT cc.id
      FROM committee_contents cc
      JOIN committee_content_approvers cca ON cca.content_id = cc.id
      WHERE cc.approval_status = 'pending' AND cca.user_id = ?
    `, [currentUserId]);

    if (!rows.length) {
      // جلب اسم المفوض
      const [delegatorRows] = await db.execute('SELECT username FROM users WHERE id = ?', [currentUserId]);
      const delegatorName = delegatorRows.length ? delegatorRows[0].username : '';
      // أنشئ إشعار تفويض جماعي للجان حتى لو لم توجد ملفات
      await insertNotification(
        delegateTo,
        'طلب تفويض بالنيابة للجان',
        `تم طلب تفويضك للتوقيع بالنيابة عن ${delegatorName} على جميع ملفات اللجان.`,
        'proxy_bulk_committee',
        JSON.stringify({ from: currentUserId, from_name: delegatorName, notes: notes || '', fileIds: [] })
      );
      return res.status(200).json({ status: 'success', message: 'تم تفعيل التفويض الجماعي للجان بنجاح. سيتم تحويل أي ملفات لجان جديدة تلقائياً.' });
    }

    for (const row of rows) {
      await addCommitteeApproverWithDelegation(row.id, delegateTo);

      await insertNotification(
        delegateTo,
        'تم تفويضك للتوقيع',
        `تم تفويضك للتوقيع بالنيابة عن مستخدم آخر على ملف لجنة رقم ${row.id}`,
        'proxy'
      );
      await sendProxyNotification(delegateTo, row.id, true);
    }
    
    // إضافة سجل في active_delegations للتفويض النشط
    await db.execute(
      'INSERT IGNORE INTO active_delegations (user_id, delegate_id) VALUES (?, ?)',
      [currentUserId, delegateTo]
    );
    res.status(200).json({ status: 'success', message: 'تم تفويض جميع ملفات اللجان بنجاح' });
  } catch (err) {
    console.error('خطأ أثناء التفويض الجماعي للجان:', err);
    res.status(500).json({ status: 'error', message: 'فشل التفويض الجماعي للجان' });
  }
};

// تنفيذ أو رفض التفويض الجماعي لملفات اللجان (عند موافقة المفوض له)
const processBulkDelegationCommittee = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    const { notificationId, action } = req.body; // action: 'accept' or 'reject'
    if (!notificationId || !['accept','reject'].includes(action)) {
      return res.status(400).json({ status: 'error', message: 'بيانات غير صالحة' });
    }
    // جلب الإشعار بدون شرط is_read_by_user
    const [rows] = await db.execute('SELECT * FROM notifications WHERE id = ? AND user_id = ? AND type = ?', [notificationId, userId, 'proxy_bulk_committee']);
    if (!rows.length) return res.status(404).json({ status: 'error', message: 'لا يوجد طلب تفويض جماعي للجان' });
    const notif = rows[0];
    const data = notif.message_data ? JSON.parse(notif.message_data) : {};
    if (action === 'reject') {
      await db.execute('DELETE FROM notifications WHERE id = ?', [notificationId]);
      return res.status(200).json({ status: 'success', message: 'تم رفض طلب التفويض الجماعي للجان' });
    }
    // تنفيذ التفويض الجماعي فعلياً
    if (action === 'accept') {
      for (const fileId of data.fileIds) {
        // أضف المستخدم كسيناريو تفويض بالنيابة
        await db.execute(`
          INSERT IGNORE INTO committee_approval_logs (
            content_id, approver_id, delegated_by, signed_as_proxy, status, created_at
          ) VALUES (?, ?, ?, 1, 'pending', NOW())`,
          [fileId, userId, data.from]
        );
        // أضف المستخدم الجديد إلى committee_content_approvers
        await db.execute(
          'INSERT IGNORE INTO committee_content_approvers (content_id, user_id) VALUES (?, ?)',
          [fileId, userId]
        );
        // احذف المفوض الأصلي من committee_content_approvers
        if (data.from && userId && data.from !== userId) {
          await db.execute(
            'DELETE FROM committee_content_approvers WHERE content_id = ? AND user_id = ?',
            [fileId, data.from]
          );
        }
      }
      // احذف الإشعار نهائياً بعد المعالجة
      await db.execute('DELETE FROM notifications WHERE id = ?', [notificationId]);
      
      // إضافة سجل في active_delegations للتفويض النشط
      await db.execute(
        'INSERT IGNORE INTO active_delegations (user_id, delegate_id) VALUES (?, ?)',
        [data.from, userId]
      );
      return res.status(200).json({ status: 'success', message: 'تم قبول التفويض الجماعي للجان وأصبحت مفوضاً بالنيابة عن جميع ملفات اللجان.' });
    }
  } catch (err) {
    console.error('خطأ أثناء تنفيذ التفويض الجماعي للجان:', err);
    res.status(500).json({ status: 'error', message: 'فشل تنفيذ التفويض الجماعي للجان' });
  }
};

// دالة مساعدة: إضافة معتمد لملف لجنة مع دعم التفويض التلقائي
async function addCommitteeApproverWithDelegation(contentId, userId) {
  // أضف المستخدم الأصلي
  await db.execute('INSERT IGNORE INTO committee_content_approvers (content_id, user_id) VALUES (?, ?)', [contentId, userId]);
  
  // تحقق إذا كان لديه تفويض نشط من جدول active_delegations
  const [delegationRows] = await db.execute(
    'SELECT user_id FROM active_delegations WHERE delegate_id = ?',
    [userId]
  );
  
  if (delegationRows.length) {
    const delegateeId = delegationRows[0].user_id;
    // أضف سجل تفويض بالنيابة
    await db.execute(
      `INSERT IGNORE INTO committee_approval_logs (content_id, approver_id, delegated_by, signed_as_proxy, status, created_at)
       VALUES (?, ?, ?, 1, 'pending', NOW())`,
      [contentId, delegateeId, userId]
    );
    // أضف المفوض له إلى committee_content_approvers
    await db.execute('INSERT IGNORE INTO committee_content_approvers (content_id, user_id) VALUES (?, ?)', [contentId, delegateeId]);
    // احذف المفوض الأصلي من committee_content_approvers
    await db.execute('DELETE FROM committee_content_approvers WHERE content_id = ? AND user_id = ?', [contentId, userId]);
    
    console.log('[ADD COMMITTEE APPROVER] Delegated from', userId, 'to', delegateeId, 'for content', contentId);
  }
}

// إلغاء جميع تفويضات اللجان التي أعطاها المستخدم (revoke all committee delegations by user)
const revokeAllCommitteeDelegations = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const adminId = decoded.id;
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ status: 'error', message: 'يرجى تحديد المستخدم' });

    // جلب كل تفويضات اللجان النشطة التي أعطاها هذا المستخدم (delegated_by = userId)
    const [rows] = await db.execute(
      `SELECT content_id, approver_id FROM committee_approval_logs WHERE delegated_by = ? AND signed_as_proxy = 1 AND status = 'pending'`,
      [userId]
    );
    
    // التحقق من وجود سجلات في active_delegations
    const [activeDelegations] = await db.execute(
      `SELECT * FROM active_delegations WHERE user_id = ?`,
      [userId]
    );
    
    if (!rows.length && !activeDelegations.length) {
      return res.status(200).json({ status: 'success', message: 'لا يوجد تفويضات لجان نشطة لهذا المستخدم.' });
    }
    
    // حذف أو تعديل كل التفويضات (إرجاعها للوضع الطبيعي)
    for (const row of rows) {
      // حذف سجل التفويض من committee_approval_logs
      await db.execute(
        `DELETE FROM committee_approval_logs WHERE content_id = ? AND approver_id = ? AND delegated_by = ? AND signed_as_proxy = 1 AND status = 'pending'`,
        [row.content_id, row.approver_id, userId]
      );
      // إعادة المفوض الأصلي إلى جدول committee_content_approvers إذا لم يكن موجوداً
      await db.execute(
        `INSERT IGNORE INTO committee_content_approvers (content_id, user_id) VALUES (?, ?)`,
        [row.content_id, userId]
      );
      // حذف المفوض له من جدول committee_content_approvers فقط إذا كان وجوده بسبب التفويض
      const [proxyRows] = await db.execute(
        `SELECT * FROM committee_approval_logs WHERE content_id = ? AND approver_id = ? AND signed_as_proxy = 1 AND status = 'pending'`,
        [row.content_id, row.approver_id]
      );
      if (proxyRows.length === 0) {
        // لا يوجد سجل تفويض بالنيابة، لا تحذف
      } else {
        // كان وجوده بسبب التفويض، احذفه
        await db.execute(
          `DELETE FROM committee_content_approvers WHERE content_id = ? AND user_id = ?`,
          [row.content_id, row.approver_id]
        );
      }
    }
    
    // حذف سجلات active_delegations (حتى لو لم يكن لديه ملفات نشطة)
    await db.execute('DELETE FROM active_delegations WHERE user_id = ?', [userId]);
    
    // تسجيل لوق
    await logAction(adminId, 'revoke_all_committee_delegations', JSON.stringify({ ar: `تم إلغاء جميع تفويضات اللجان التي أعطاها المستخدم رقم ${userId}` }), 'user', userId);
    res.status(200).json({ status: 'success', message: 'تم إلغاء جميع تفويضات اللجان بنجاح.' });
  } catch (err) {
    console.error('خطأ أثناء إلغاء جميع تفويضات اللجان:', err);
    res.status(500).json({ status: 'error', message: 'فشل إلغاء جميع تفويضات اللجان' });
  }
};

// إلغاء تفويض ملف لجنة واحد (revoke committee delegation for a single file)
const revokeCommitteeDelegation = async (req, res) => {
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
      `DELETE FROM committee_approval_logs WHERE content_id = ? AND approver_id = ? AND signed_as_proxy = 1 AND status = 'pending'`,
      [id, delegateeId]
    );
    // إعادة المفوض الأصلي إلى جدول committee_content_approvers إذا لم يكن موجوداً
    const [delegationRow] = await db.execute(
      `SELECT delegated_by FROM committee_approval_logs WHERE content_id = ? AND approver_id = ?`,
      [id, delegateeId]
    );
    if (delegationRow.length && delegationRow[0].delegated_by) {
      await db.execute(
        `INSERT IGNORE INTO committee_content_approvers (content_id, user_id) VALUES (?, ?)`,
        [id, delegationRow[0].delegated_by]
      );
    }
    // حذف سجل active_delegations
    await db.execute('DELETE FROM active_delegations WHERE user_id = ? AND delegate_id = ?', [delegateeId, id]);
    // تسجيل لوق
    await logAction(adminId, 'revoke_committee_delegation', JSON.stringify({ ar: `تم إلغاء تفويض ملف اللجنة رقم ${id} من المستخدم رقم ${delegateeId}` }), 'committee_content', id);
    res.status(200).json({ status: 'success', message: 'تم إلغاء التفويض بنجاح.' });
  } catch (err) {
    console.error('خطأ أثناء إلغاء تفويض اللجنة:', err);
    res.status(500).json({ status: 'error', message: 'فشل إلغاء تفويض اللجنة' });
  }
};

// جلب كل تفويضات اللجان النشطة التي أعطاها مستخدم معيّن (delegated_by = userId)
const getCommitteeDelegationsByUser = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    jwt.verify(token, process.env.JWT_SECRET); // فقط تحقق من التوكن
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ status: 'error', message: 'يرجى تحديد المستخدم' });
    const [rows] = await db.execute(
      `SELECT al.content_id, al.approver_id, cc.title, al.status, al.signed_as_proxy, al.delegated_by
       FROM committee_approval_logs al
       JOIN committee_contents cc ON al.content_id = cc.id
       WHERE al.delegated_by = ? AND al.signed_as_proxy = 1 AND al.status = 'pending'`,
      [userId]
    );
    res.status(200).json({ status: 'success', data: rows });
  } catch (err) {
    console.error('getCommitteeDelegationsByUser error:', err);
    res.status(500).json({ status: 'error', message: 'فشل جلب تفويضات اللجان' });
  }
};

// جلب قائمة الأشخاص الذين تم تفويضهم من المستخدم الحالي (distinct delegateeId) في تفويضات اللجان
const getCommitteeDelegationSummaryByUser = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    jwt.verify(token, process.env.JWT_SECRET);
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ status: 'error', message: 'يرجى تحديد المستخدم' });
    const [rows] = await db.execute(
      `SELECT al.approver_id, u.username AS approver_name, u.email, COUNT(al.content_id) AS files_count
       FROM committee_approval_logs al
       JOIN users u ON al.approver_id = u.id
       WHERE al.delegated_by = ? AND al.signed_as_proxy = 1 AND al.status = 'pending'
       GROUP BY al.approver_id, u.username, u.email`,
      [userId]
    );
    res.status(200).json({ status: 'success', data: rows });
  } catch (err) {
    console.error('getCommitteeDelegationSummaryByUser error:', err);
    res.status(500).json({ status: 'error', message: 'فشل جلب ملخص تفويضات اللجان' });
  }
};

module.exports = {
  getUserPendingCommitteeApprovals,
  handleCommitteeApproval,
  getAssignedCommitteeApprovals,
  delegateCommitteeApproval,
  getProxyCommitteeApprovals,
  acceptProxyDelegationCommittee,
  acceptAllProxyDelegationsCommittee,
  delegateAllCommitteeApprovals,
  processBulkDelegationCommittee,
  revokeAllCommitteeDelegations,
  revokeCommitteeDelegation,
  getCommitteeDelegationsByUser,
  getCommitteeDelegationSummaryByUser
};
