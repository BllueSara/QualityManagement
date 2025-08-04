const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

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
 * ملاحظة مهمة حول دعم الأدمن:
 * 
 * تم إضافة دعم خاص للأدمن في ملفات اللجان:
 * 1. الأدمن يمكنه رؤية جميع الملفات المعلقة (في getUserPendingCommitteeApprovals)
 * 2. الأدمن يمكنه التوقيع على أي ملف لجنة (في handleCommitteeApproval)
 * 3. توقيع الأدمن يعتبر كافياً للاعتماد النهائي للملف
 * 4. الأدمن محدد بـ: userRole === 'admin' أو لديه صلاحية 'transfer_credits'
 * 
 * هذا يسمح للأدمن بالتدخل في أي ملف لجنة معلق واعتماده مباشرة.
 */

/**
 * 1. Get pending committee approvals for the logged-in user
 */
async function getUserPendingCommitteeApprovals(req, res) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { id: userId } = decoded;
    const userRole = decoded.role;

    // تحقق من صلاحيات المستخدم للأدمن
    const [permRows] = await db.execute(`
      SELECT p.permission_key
      FROM user_permissions up
      JOIN permissions p ON up.permission_id = p.id
      WHERE up.user_id = ?
    `, [userId]);
    const perms = new Set(permRows.map(r => r.permission_key));
    const isAdmin = (userRole === 'admin' || perms.has('transfer_credits'));

    // تحقق إذا كان المستخدم مفوض له من active_delegations
    const [delegationRows] = await db.execute(
      'SELECT user_id FROM active_delegations WHERE delegate_id = ?',
      [userId]
    );

    let rows = [];

    if (isAdmin) {
      // الأدمن يرى جميع الملفات المعلقة مع التحقق من التسلسل
      const [adminRows] = await db.execute(`
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
          GROUP_CONCAT(DISTINCT u2.username ORDER BY cca.sequence_number) AS assigned_approvers,
          'admin' AS signature_type,
          cca.sequence_number
        FROM committee_contents cc
        JOIN committee_folders cf     ON cc.folder_id = cf.id
        JOIN committees com           ON cf.committee_id = com.id
        LEFT JOIN committee_content_approvers cca ON cca.content_id = cc.id
        LEFT JOIN users u2            ON cca.user_id = u2.id
        WHERE cc.is_approved = 0
          AND NOT EXISTS (
            SELECT 1 FROM committee_approval_logs cal
            WHERE cal.content_id = cc.id
              AND cal.approver_id = ?
              AND cal.status = 'approved'
          )
        GROUP BY cc.id, cca.sequence_number
        ORDER BY cc.created_at DESC, cca.sequence_number
      `, [userId]);

      rows = adminRows;
    } else if (delegationRows.length) {
      // المستخدم مفوض له - سيظهر له الملف مرة واحدة وسيعتمد مرتين تلقائياً مع التحقق من التسلسل
      const delegatorId = delegationRows[0].user_id;
      
      // جلب الملفات المكلف بها المستخدم (شخصياً أو بالنيابة) مع التحقق من التسلسل
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
          GROUP_CONCAT(DISTINCT u2.username ORDER BY cca.sequence_number) AS assigned_approvers,
          'dual' AS signature_type,
          cca.sequence_number
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
        ORDER BY cc.created_at DESC, cca.sequence_number
      `, [userId, userId]);

      rows = delegatedRows;
    } else {
      // المستخدم عادي - جلب الملفات المكلف بها فقط مع التحقق من التسلسل
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
          GROUP_CONCAT(DISTINCT u2.username ORDER BY cca.sequence_number) AS assigned_approvers,
          'normal' AS signature_type,
          cca.sequence_number
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
        ORDER BY cc.created_at DESC, cca.sequence_number
      `, [userId, userId]);

      rows = normalRows;
    }

    // تحويل الحقل من نص JSON إلى مصفوفة
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
    console.error('Error in getUserPendingCommitteeApprovals:', err);
    res.status(500).json({ status: 'error', message: 'خطأ في جلب الموافقات المعلقة للجان للمستخدم' });
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
    const userRole = decoded.role;

    // تحقق من صلاحيات المستخدم للأدمن
    const [permRows] = await db.execute(`
      SELECT p.permission_key
      FROM user_permissions up
      JOIN permissions p ON up.permission_id = p.id
      WHERE up.user_id = ?
    `, [currentUserId]);
    const perms = new Set(permRows.map(r => r.permission_key));
    const isAdmin = (userRole === 'admin' || perms.has('transfer_credits'));

    // التحقق من التسلسل - تأكد من أن المعتمد السابق قد وقع
    const [sequenceCheck] = await db.execute(`
      SELECT cca.sequence_number
      FROM committee_content_approvers cca
      WHERE cca.content_id = ? AND cca.user_id = ?
    `, [contentId, currentUserId]);

    if (sequenceCheck.length > 0) {
      const currentSequence = sequenceCheck[0].sequence_number;
      
      // إذا لم يكن المعتمد الأول، تحقق من أن المعتمد السابق قد وقع
      if (currentSequence > 1) {
        const [previousApprovers] = await db.execute(`
          SELECT COUNT(*) as count
          FROM committee_content_approvers cca
          JOIN committee_approval_logs cal ON cal.content_id = cca.content_id AND cal.approver_id = cca.user_id
          WHERE cca.content_id = ? 
            AND cca.sequence_number < ?
            AND cal.status = 'approved'
        `, [contentId, currentSequence]);

        if (previousApprovers[0].count === 0) {
          return res.status(400).json({ 
            status: 'error', 
            message: 'لا يمكنك التوقيع حتى يوقع المعتمد السابق' 
          });
        }
      }
    }

    // 2) منطق التوقيع المزدوج للمفوض له
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

    // تحقق من التفويضات الفردية المقبولة للجان
    const [singleDelegationRows] = await db.execute(`
      SELECT delegated_by, signed_as_proxy
      FROM committee_approval_logs
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
      const [personalLog] = await db.execute(
        `SELECT * FROM committee_approval_logs WHERE content_id = ? AND approver_id = ? AND signed_as_proxy = 0 AND delegated_by IS NULL`,
        [contentId, approverId]
      );
      if (!personalLog.length) {
        // أضف سجل جديد
        await db.execute(`
          INSERT INTO committee_approval_logs (
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
        console.log('✅ Inserted personal committee approval for user:', currentUserId);
      } else if (personalLog[0].status !== (approved ? 'approved' : 'rejected')) {
        // حدّث السجل ليصبح معتمد
        await db.execute(
          `UPDATE committee_approval_logs SET status = ?, signature = ?, electronic_signature = ?, comments = ?, created_at = NOW() WHERE id = ?`,
          [
            approved ? 'approved' : 'rejected',
            signature || null,
            electronic_signature || null,
            notes || '',
            personalLog[0].id
          ]
        );
        console.log('✅ Updated personal committee approval for user:', currentUserId);
      } else {
        console.log('ℹ️ Personal committee approval already exists and is up to date.');
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
        personalLogs: personalLog.length,
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
        ar: `تم ${approved ? 'اعتماد' : 'رفض'} ملف اللجنة: "${getContentNameByLanguage(title, 'ar')}" في لجنة: "${getCommitteeNameByLanguage(committeeName, 'ar')}"${isProxy ? ' كمفوض عن مستخدم آخر' : ''}${isAdmin ? ' كأدمن' : ''}`,
        en: `${approved ? 'Approved' : 'Rejected'} committee content: "${getContentNameByLanguage(title, 'en')}" in committee: "${getCommitteeNameByLanguage(committeeName, 'en')}"${isProxy ? ' as a proxy' : ''}${isAdmin ? ' as admin' : ''}`
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

    // منطق جديد للاعتماد النهائي مع دعم الأدمن
    let shouldApproveFile = false;
    
    if (isAdmin && approved) {
      // الأدمن يمكنه اعتماد الملف مباشرة
      shouldApproveFile = true;
      console.log('🎉 Admin approval - approving file directly');
    } else {
      // منطق الاعتماد العادي للمستخدمين العاديين
      const [approvers] = await db.execute(
        'SELECT user_id FROM committee_content_approvers WHERE content_id = ?',
        [contentId]
      );

      let requiredApprovals = 1;
      let isCurrentUserDelegate = false;
      if (approvers.length === 1) {
        // تحقق إذا كان هو مفوض له
        const [isDelegate] = await db.execute(
          'SELECT * FROM active_delegations WHERE delegate_id = ?',
          [approvers[0].user_id]
        );
        if (isDelegate.length) {
          isCurrentUserDelegate = true;
          requiredApprovals = 1;
        }
      } else if (approvers.length > 1 && delegationRows.length) {
        // إذا كان هناك أكثر من معتمد والمستخدم مفوض له، يحتاج توقيعين
        isCurrentUserDelegate = true;
        requiredApprovals = 2;
      }

      // جلب عدد التواقيع للمستخدم الحالي
      const [userApprovals] = await db.execute(
        `SELECT COUNT(*) as count FROM committee_approval_logs 
         WHERE content_id = ? AND approver_id = ? AND status = 'approved'`,
        [contentId, currentUserId]
      );

      // عدل شرط remaining بناءً على المنطق الجديد
      let remainingCount = 0;
      if (isCurrentUserDelegate) {
        if (userApprovals[0].count < requiredApprovals) {
          remainingCount = 1;
        }
      } else {
        // منطق المستخدم العادي: لم يوقع بعد
        if (userApprovals[0].count < 1) {
          remainingCount = 1;
        }
      }

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
        remainingCount: remainingCount,
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
        if (approved && remainingCount > 0) {
          // جلب اسم المعتمد
          const [approverRows] = await db.execute('SELECT username FROM users WHERE id = ?', [approverId]);
          const approverName = approverRows.length ? approverRows[0].username : '';
          await sendPartialApprovalNotification(ownerId, fileTitle, approverName, true);
        }
        // إذا اكتمل الاعتماد النهائي، أرسل إشعار "تم اعتماد الملف من الإدارة"
        if (remainingCount === 0) {
          await sendOwnerApprovalNotification(ownerId, fileTitle, approved, true);
        }
      }

      // تحقق من اعتماد جميع المعتمدين قبل الاعتماد النهائي (لملفات اللجان)
      // 1. جلب جميع المعتمدين
      const [allApproversRows] = await db.execute(
        'SELECT user_id FROM committee_content_approvers WHERE content_id = ?',
        [contentId]
      );
      const approverIds = allApproversRows.map(r => r.user_id);

      // 2. جلب عدد من وقع فعلاً (approved)
      let approvedApproverCount = 0;
      if (approverIds.length > 0) {
        const [approvedLogsRows] = await db.execute(
          `SELECT approver_id FROM committee_approval_logs WHERE content_id = ? AND status = 'approved' AND approver_id IN (${approverIds.map(() => '?').join(',')}) GROUP BY approver_id`,
          [contentId, ...approverIds]
        );
        approvedApproverCount = approvedLogsRows.length;
      }

      // 3. إذا كل المعتمدين وقعوا، اعتمد الملف نهائياً
      const allApproved = approverIds.length > 0 && approvedApproverCount === approverIds.length;
      shouldApproveFile = allApproved;
    }

    // إضافة المستخدم المفوض له إلى committee_content_approvers إذا لم يكن موجوداً
    if (isProxy && approved) {
      await db.execute(`
        INSERT IGNORE INTO committee_content_approvers (content_id, user_id)
        VALUES(?, ?)
      `, [contentId, approverId]);
    }

    // إزالة التفويض الفردي بعد التوقيع
    if (singleDelegationRows && singleDelegationRows.length > 0) {
      await db.execute(`
        UPDATE committee_approval_logs 
        SET status = 'completed' 
        WHERE content_id = ? AND approver_id = ? AND signed_as_proxy = 1 AND status = 'accepted'
      `, [contentId, currentUserId]);
      console.log('✅ Single committee delegation marked as completed for user:', currentUserId);
    }

    // الاعتماد النهائي للملف
    if (shouldApproveFile) {
      console.log('🎉 Committee file ready for final approval! Updating file status...');
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
      
      // إشعار لصاحب الملف عند الاعتماد النهائي
      let [ownerRows] = await db.execute(`SELECT created_by, title FROM committee_contents WHERE id = ?`, [contentId]);
      if (ownerRows.length) {
        const ownerId = ownerRows[0].created_by;
        const fileTitle = ownerRows[0].title || '';
        await sendOwnerApprovalNotification(ownerId, fileTitle, approved, true);
      }
      
      // حذف الملف من قائمة المعتمدين المفوض لهم بعد الاعتماد النهائي
      if (delegationRows.length) {
        const delegatorId = delegationRows[0].user_id;
        console.log('🗑️ Removing delegated file from approvers after final approval');
        await db.execute(`
          DELETE FROM committee_content_approvers 
          WHERE content_id = ? AND user_id = ?
        `, [contentId, currentUserId]);
        
        // حذف سجلات التفويض المعلقة
        await db.execute(`
          DELETE FROM committee_approval_logs 
          WHERE content_id = ? AND approver_id = ? AND signed_as_proxy = 1 AND status = 'pending'
        `, [contentId, currentUserId]);
      }
    } else {
      console.log('⏳ Still waiting for other committee approvers or admin approval');
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

    // 2) قاعدة الاستعلام مع دعم التسلسل
    let baseQuery = `
      SELECT 
        CONCAT('comm-', cc.id)                AS id,
        cc.title,
        cc.file_path,
        cc.approval_status,
        GROUP_CONCAT(DISTINCT u2.username ORDER BY cca.sequence_number)    AS assigned_approvers,
        com.name                              AS source_name,
        cf.name                               AS folder_name,
        u.username                            AS created_by_username,
        'committee'                           AS type,
        CAST(cc.approvers_required AS CHAR)   AS approvers_required,
        cc.created_at,
        cca.sequence_number
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
            AND cal.delegated_by = ?
            AND cal.signed_as_proxy = 1
            AND cal.status = 'accepted'
        )
        AND NOT EXISTS (
          SELECT 1 FROM committee_approval_logs cal2
          WHERE cal2.content_id = cc.id
            AND cal2.approver_id = ?
            AND cal2.signed_as_proxy = 1
            AND cal2.status = 'accepted'
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
      `;
      params.push(userId, userId, userId);
    } else {
      baseQuery += `
        LEFT JOIN committee_content_approvers cca 
          ON cca.content_id = cc.id
        LEFT JOIN users u2 
          ON u2.id = cca.user_id
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
            AND cal2.signed_as_proxy = 1
            AND cal2.status = 'accepted'
        )
      `;
      params.push(userId, userId);
    }
    baseQuery += `
      GROUP BY cc.id, cca.sequence_number
      ORDER BY cc.created_at DESC, cca.sequence_number
    `;

    // 6) تنفيذ الاستعلام
    const [rows] = await db.execute(baseQuery, params);

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
    await db.execute(`      INSERT IGNORE INTO committee_approval_logs (
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

    // جلب الملفات المفوضة التي لم يتم اعتمادها بعد
    const [rows] = await db.execute(`
      SELECT DISTINCT
        CONCAT('comm-', cc.id) AS id,
        cc.title,
        cc.approval_status,
        com.name AS committeeName,
        u.username AS delegated_by,
        u.id AS delegated_by_id
      FROM committee_contents cc
      JOIN committee_folders cf ON cc.folder_id = cf.id
      JOIN committees com ON cf.committee_id = com.id
      JOIN committee_content_approvers cca ON cc.id = cca.content_id
      JOIN users u ON cca.user_id = u.id
      WHERE cca.user_id = ?
        AND cc.is_approved = 0
        AND cc.approval_status != 'approved'
        AND EXISTS (
          SELECT 1 FROM committee_approval_logs al 
          WHERE al.content_id = cc.id 
            AND al.approver_id = ? 
            AND al.signed_as_proxy = 1 
            AND al.status = 'pending'
        )
    `, [userId, userId]);

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
  // 1) جلب مسار الملف
  const [fileRows] = await db.execute(
    `SELECT file_path FROM committee_contents WHERE id = ?`,
    [contentId]
  );
  if (!fileRows.length) {
    return console.error('📁 Committee content not found for ID', contentId);
  }
  const relativePath = fileRows[0].file_path;
  const fullPath = path.join(__dirname, '../..', relativePath);
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
    FROM committee_approval_logs al
    JOIN users u_actual
      ON al.approver_id = u_actual.id
    LEFT JOIN users u_original
      ON al.delegated_by = u_original.id
    WHERE al.content_id = ? AND al.status = 'approved'
    ORDER BY al.created_at
  `, [contentId]);

  console.log('Committee PDF logs:', logs); // للتأكد من القيم

  if (!logs.length) {
    console.warn('⚠️ No approved signatures found for committee content', contentId);
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
    `SELECT title FROM committee_contents WHERE id = ?`,
    [contentId]
  );
  const fileName = contentRows.length > 0 ? contentRows[0].title : `Committee File ${contentId}`;

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

    // إضافة صف الاعتماد مع معالجة النصوص العربية والتواقيع
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
        console.log(`✅ Committee PDF updated with approval table using pdfmake: ${fullPath}`);
      } catch (mergeError) {
        console.error('❌ Error merging committee PDFs:', mergeError);
        // في حالة فشل الدمج، احفظ صفحة الاعتمادات فقط
        try {
          fs.writeFileSync(fullPath, approvalPdfBuffer);
          console.log(`✅ Saved committee approval page only: ${fullPath}`);
        } catch (saveError) {
          console.error('❌ Error saving committee approval page:', saveError);
        }
      }
    });
    
    approvalPdfDoc.on('error', (error) => {
      console.error('❌ Error in committee PDF generation:', error);
    });
    
    approvalPdfDoc.end();
  } catch (err) {
    console.error('❌ Error creating committee approval PDF:', err);
  }
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
    // جلب التفويض
    const [proxyRows] = await db.execute(
      'SELECT * FROM committee_approval_logs WHERE content_id = ? AND approver_id = ? AND signed_as_proxy = 1 AND status = "pending"',
      [contentId, userId]
    );
    if (!proxyRows.length) {
      return res.status(404).json({ status: 'error', message: 'لا يوجد تفويض معلق لهذا الملف' });
    }
    const delegation = proxyRows[0];
    const delegatedBy = delegation.delegated_by;

    // تحديث حالة التفويض إلى 'accepted'
    await db.execute(
      'UPDATE committee_approval_logs SET status = "accepted" WHERE id = ?',
      [delegation.id]
    );

    // أضف المستخدم لجدول المعيّنين
    await db.execute(
      'INSERT IGNORE INTO committee_content_approvers (content_id, user_id) VALUES (?, ?)',
      [contentId, userId]
    );

    // احذف المفوض الأصلي من committee_content_approvers
    if (delegatedBy && delegatedBy !== userId) {
      await db.execute(
        'DELETE FROM committee_content_approvers WHERE content_id = ? AND user_id = ?',
        [contentId, delegatedBy]
      );
    }

    // جلب اسم المفوض الأصلي
    let delegatedByName = '';
    if (delegatedBy) {
      const [delegatedByRows] = await db.execute('SELECT username FROM users WHERE id = ?', [delegatedBy]);
      delegatedByName = delegatedByRows.length ? delegatedByRows[0].username : '';
    }
    
    console.log('✅ Committee proxy delegation accepted:', {
      contentId,
      userId,
      delegatedBy,
      delegatedByName
    });
    
    return res.json({
      status: 'success',
      message: 'تم قبول التفويض وستظهر لك في تقارير اللجان المكلف بها. يمكنك التوقيع مرتين: مرة شخصية ومرة بالنيابة.',
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
      SELECT id, content_id, delegated_by FROM committee_approval_logs
      WHERE approver_id = ? AND signed_as_proxy = 1 AND status = 'pending'
    `, [userId]);

    if (!rows.length) {
      return res.json({ status: 'success', message: 'لا يوجد تفويضات لجان لقبولها' });
    }

    let processedFiles = 0;

    for (const row of rows) {
      if (row.content_id) {
        // تحديث حالة التفويض إلى 'accepted'
        await db.execute(
          'UPDATE committee_approval_logs SET status = "accepted" WHERE id = ?',
          [row.id]
        );
        // إضافة المستخدم إلى committee_content_approvers
        await db.execute(
          'INSERT IGNORE INTO committee_content_approvers (content_id, user_id) VALUES (?, ?)',
          [row.content_id, userId]
        );
        // حذف المفوض الأصلي من committee_content_approvers
        if (row.delegated_by && userId !== row.delegated_by) {
          await db.execute(
            'DELETE FROM committee_content_approvers WHERE content_id = ? AND user_id = ?',
            [row.content_id, row.delegated_by]
          );
        }
        processedFiles++;
      }
    }

    console.log('✅ Accepted all committee proxy delegations:', {
      userId,
      processedFiles,
      totalRows: rows.length
    });

    res.json({ 
      status: 'success', 
      message: `تم قبول جميع تفويضات اللجان بنجاح (${processedFiles} ملف)`,
      stats: {
        committeeFiles: processedFiles
      }
    });
  } catch (err) {
    console.error('خطأ في قبول جميع تفويضات اللجان:', err);
    res.status(500).json({ status: 'error', message: 'فشل قبول جميع تفويضات اللجان' });
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
    const delegatorId = delegationRows[0].user_id;
    // أضف سجل تفويض بالنيابة
    await db.execute(
      `INSERT IGNORE INTO committee_approval_logs (content_id, approver_id, delegated_by, signed_as_proxy, status, created_at)
       VALUES (?, ?, ?, 1, 'pending', NOW())`,
      [contentId, userId, delegatorId]
    );
    // أضف المفوض له إلى committee_content_approvers
    await db.execute('INSERT IGNORE INTO committee_content_approvers (content_id, user_id) VALUES (?, ?)', [contentId, userId]);
    // احذف المفوض الأصلي من committee_content_approvers
    await db.execute('DELETE FROM committee_content_approvers WHERE content_id = ? AND user_id = ?', [contentId, delegatorId]);
    
    console.log('[ADD COMMITTEE APPROVER] Delegated from', delegatorId, 'to', userId, 'for content', contentId);
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

// دالة لجلب التفويضات الفردية المعلقة للجان
const getSingleCommitteeDelegations = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    jwt.verify(token, process.env.JWT_SECRET);
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ status: 'error', message: 'يرجى تحديد المستخدم' });

    // جلب التفويضات الفردية المعلقة من committee_approval_logs (اللجان فقط)
    const [singleDelegations] = await db.execute(`
      SELECT 
        cal.id,
        cal.content_id,
        cal.delegated_by,
        cal.created_at,
        cal.comments,
        u.username as delegated_by_name,
        cc.title as content_title,
        'committee' as type
      FROM committee_approval_logs cal
      JOIN users u ON cal.delegated_by = u.id
      JOIN committee_contents cc ON cal.content_id = cc.id
      WHERE cal.approver_id = ? 
        AND cal.signed_as_proxy = 1 
        AND cal.status = 'pending'
        AND cal.content_id IS NOT NULL
      ORDER BY cal.created_at DESC
    `, [userId]);

    res.status(200).json({ status: 'success', data: singleDelegations });
  } catch (err) {
    console.error('getSingleCommitteeDelegations error:', err);
    res.status(500).json({ status: 'error', message: 'فشل جلب التفويضات الفردية للجان' });
  }
};

// دالة معالجة التفويضات الفردية للجان (قبول/رفض)
const processSingleCommitteeDelegationUnified = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentUserId = decoded.id;
    
    const { contentId, action, contentType, reason } = req.body;
    if (!contentId || !action || !contentType) {
      return res.status(400).json({ status: 'error', message: 'يرجى تحديد الملف والإجراء والنوع' });
    }

    // جلب معلومات التفويض
    const [delegationRows] = await db.execute(`
      SELECT * FROM committee_approval_logs 
      WHERE content_id = ? AND approver_id = ? AND signed_as_proxy = 1 AND status = 'pending'
    `, [contentId, currentUserId]);

    if (delegationRows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'لم يتم العثور على التفويض' });
    }

    const delegation = delegationRows[0];
    const delegatorId = delegation.delegated_by;

    if (action === 'accept') {
      // قبول التفويض الفردي للجان
      // تحديث حالة التفويض إلى مقبول
      await db.execute(`
        UPDATE committee_approval_logs 
        SET status = 'accepted' 
        WHERE id = ?
      `, [delegation.id]);

      // لا نضيف المستخدم إلى committee_content_approvers بشكل دائم
      // التفويض الفردي يكون مؤقت فقط لهذا الملف المحدد
      // سيتم التعامل معه عند التوقيع الفعلي

      // إرسال إشعار للمفوض الأصلي
      await insertNotification(
        delegatorId,
        'single_committee_delegation_accepted',
        JSON.stringify({ 
          ar: `تم قبول تفويض ملف اللجنة الفردي من قبل ${currentUserId}`,
          en: `Single committee file delegation accepted by ${currentUserId}`
        }),
        'committee_contents',
        contentId
      );

      res.status(200).json({ status: 'success', message: 'تم قبول تفويض ملف اللجنة الفردي بنجاح' });

    } else if (action === 'reject') {
      // رفض التفويض الفردي للجان
      // تحديث حالة التفويض إلى مرفوض
      await db.execute(`
        UPDATE committee_approval_logs 
        SET status = 'rejected', comments = ? 
        WHERE id = ?
      `, [reason || null, delegation.id]);

      // إعادة المفوض الأصلي إلى committee_content_approvers
      await db.execute(
        `INSERT IGNORE INTO committee_content_approvers (content_id, user_id) VALUES (?, ?)`,
        [contentId, delegatorId]
      );

      // إرسال إشعار للمفوض الأصلي
      await insertNotification(
        delegatorId,
        'single_committee_delegation_rejected',
        JSON.stringify({ 
          ar: `تم رفض تفويض ملف اللجنة الفردي من قبل ${currentUserId}`,
          en: `Single committee file delegation rejected by ${currentUserId}`
        }),
        'committee_contents',
        contentId
      );

      res.status(200).json({ status: 'success', message: 'تم رفض تفويض ملف اللجنة الفردي بنجاح' });
    } else {
      res.status(400).json({ status: 'error', message: 'إجراء غير صحيح' });
    }

  } catch (err) {
    console.error('processSingleCommitteeDelegationUnified error:', err);
    res.status(500).json({ status: 'error', message: 'فشل معالجة تفويض ملف اللجنة الفردي' });
  }
};

// دالة لجلب سجلات التفويضات للجان لمستخدم معين
const getCommitteeDelegationLogs = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    jwt.verify(token, process.env.JWT_SECRET);
    const { userId, delegatorId } = req.params;
    if (!userId || !delegatorId) return res.status(400).json({ status: 'error', message: 'يرجى تحديد المستخدم والمفوض' });

    // جلب سجلات التفويضات من committee_approval_logs
    const [delegationLogs] = await db.execute(`
      SELECT 
        cal.id,
        cal.content_id,
        cal.approver_id,
        cal.delegated_by,
        cal.status,
        cal.signed_as_proxy,
        cal.created_at,
        cal.comments,
        cc.title as content_title,
        u.username as approver_name,
        d.username as delegator_name
      FROM committee_approval_logs cal
      JOIN committee_contents cc ON cal.content_id = cc.id
      JOIN users u ON cal.approver_id = u.id
      JOIN users d ON cal.delegated_by = d.id
      WHERE cal.approver_id = ? AND cal.delegated_by = ? AND cal.signed_as_proxy = 1
      ORDER BY cal.created_at DESC
    `, [userId, delegatorId]);

    res.status(200).json({ status: 'success', data: delegationLogs });
  } catch (err) {
    console.error('getCommitteeDelegationLogs error:', err);
    res.status(500).json({ status: 'error', message: 'فشل جلب سجلات تفويضات اللجان' });
  }
};

// دالة فحص نوع التفويض في active_delegations للجان
const checkActiveCommitteeDelegationType = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    jwt.verify(token, process.env.JWT_SECRET);
    
    const { delegateId, delegatorId } = req.params;
    if (!delegateId || !delegatorId) {
      return res.status(400).json({ status: 'error', message: 'يرجى تحديد المعرفات المطلوبة' });
    }

    // فحص إذا كان هناك تفويض شامل (content_id = NULL)
    const [bulkCommitteeDelegations] = await db.execute(`
      SELECT 'bulk' as type
      FROM committee_approval_logs 
      WHERE approver_id = ? AND delegated_by = ? AND signed_as_proxy = 1 AND content_id IS NULL AND status = 'pending'
      LIMIT 1
    `, [delegateId, delegatorId]);

    // فحص إذا كان هناك تفويض فردي (content_id IS NOT NULL)
    const [singleCommitteeDelegations] = await db.execute(`
      SELECT 'single' as type
      FROM committee_approval_logs 
      WHERE approver_id = ? AND delegated_by = ? AND signed_as_proxy = 1 AND content_id IS NOT NULL AND status = 'pending'
      LIMIT 1
    `, [delegateId, delegatorId]);

    let delegationType = 'bulk'; // افتراضي

    // إذا وجد تفويض شامل، فهو شامل
    if (bulkCommitteeDelegations.length > 0) {
      delegationType = 'bulk';
    }
    // إذا وجد تفويض فردي فقط، فهو فردي
    else if (singleCommitteeDelegations.length > 0) {
      delegationType = 'single';
    }

    res.status(200).json({ 
      status: 'success', 
      data: { 
        delegationType,
        hasBulkDelegations: bulkCommitteeDelegations.length > 0,
        hasSingleDelegations: singleCommitteeDelegations.length > 0
      }
    });
  } catch (err) {
    console.error('خطأ في فحص نوع التفويض للجان:', err);
    res.status(500).json({ status: 'error', message: 'فشل فحص نوع التفويض للجان' });
  }
};

// دالة التفويض الفردي للجان
const delegateSingleCommitteeApproval = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentUserId = decoded.id;
    const { delegateTo, notes, contentId, contentType } = req.body;
    
    if (!delegateTo || !contentId || !contentType) {
      return res.status(400).json({ status: 'error', message: 'بيانات مفقودة أو غير صحيحة للتفويض' });
    }
    
    // تحويل contentId من 'comm-42' إلى '42' إذا كان يحتوي على بادئة
    let cleanContentId = contentId;
    if (typeof contentId === 'string' && contentId.startsWith('comm-')) {
      cleanContentId = contentId.replace('comm-', '');
    }
    
    console.log('🔍 Cleaned contentId:', { original: contentId, cleaned: cleanContentId });

    // التحقق من ملف اللجنة
    console.log('🔍 Checking committee content:', { cleanContentId, contentType });
    
    // أولاً، دعنا نرى ما هو موجود في الجدول
    const [allContentRows] = await db.execute(`
      SELECT cc.id, cc.title, cc.approval_status, cc.is_approved
      FROM committee_contents cc 
      WHERE cc.id = ?
    `, [cleanContentId]);
    
    console.log('🔍 All committee content rows:', allContentRows);
    
    if (!allContentRows.length) {
      return res.status(404).json({ status: 'error', message: 'ملف اللجنة غير موجود' });
    }
    
    const content = allContentRows[0];
    console.log('🔍 Found committee content:', content);
    
    // التحقق من حالة الملف (قد يكون approval_status أو is_approved)
    const isPending = content.approval_status === 'pending' || content.is_approved === 0;
    
    if (!isPending) {
      return res.status(404).json({ 
        status: 'error', 
        message: `ملف اللجنة تم اعتماده مسبقاً. الحالة: ${content.approval_status || content.is_approved}` 
      });
    }

    // التحقق من أن المستخدم الحالي معتمد على هذا الملف
    const [approverRows] = await db.execute(`
      SELECT * FROM committee_content_approvers 
      WHERE content_id = ? AND user_id = ?
    `, [cleanContentId, currentUserId]);

    if (!approverRows.length) {
      return res.status(403).json({ status: 'error', message: 'ليس لديك صلاحية تفويض هذا الملف' });
    }

    const contentTitle = content.title;

    // جلب اسم المفوض
    const [delegatorRows] = await db.execute('SELECT username FROM users WHERE id = ?', [currentUserId]);
    const delegatorName = delegatorRows.length ? delegatorRows[0].username : '';

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

    // إرسال إشعار للمفوض له
    await sendProxyNotification(delegateTo, cleanContentId, true);

    // تسجيل الحركة
    await logAction(
      currentUserId,
      'delegate_committee_signature',
      JSON.stringify({
        ar: `تم تفويض توقيع ملف اللجنة "${contentTitle}" للمستخدم ${delegateTo}`,
        en: `Delegated committee file signature "${contentTitle}" to user ${delegateTo}`
      }),
      'approval',
      cleanContentId
    );

    res.status(200).json({ 
      status: 'success', 
      message: 'تم تفويض ملف اللجنة بنجاح' 
    });

  } catch (err) {
    console.error('delegateSingleCommitteeApproval error:', err);
    res.status(500).json({ status: 'error', message: 'فشل تفويض ملف اللجنة' });
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
  revokeAllCommitteeDelegations,
  revokeCommitteeDelegation,
  getCommitteeDelegationsByUser,
  getCommitteeDelegationSummaryByUser,
  getSingleCommitteeDelegations,
  processSingleCommitteeDelegationUnified,
  getCommitteeDelegationLogs,
  checkActiveCommitteeDelegationType,
  delegateSingleCommitteeApproval
};

