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
      // الأدمن يرى جميع الملفات المعلقة
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
          GROUP_CONCAT(DISTINCT u2.username) AS assigned_approvers,
          'admin' AS signature_type
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
        GROUP BY cc.id
        ORDER BY cc.created_at DESC
      `, [userId]);

      rows = adminRows;
    } else if (delegationRows.length) {
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
      GROUP BY cc.id
      ORDER BY cc.created_at DESC
    `;

    // 6) تنفيذ الاستعلام
    const [rows] = await db.execute(baseQuery, params);

    // إذا كان المستخدم مفوض له (من جدول active_delegations)
    // جلب ملفات المفوض الأصلي فقط إذا كان التفويض مقبول
    const [delegationRows] = await db.execute(
      'SELECT user_id FROM active_delegations WHERE delegate_id = ?',
      [userId]
    );
    if (delegationRows.length) {
      const delegatorId = delegationRows[0].user_id;
      // جلب فقط الملفات التي تم قبول التفويض عليها
      let delegatorParams = canViewAll ? [delegatorId, userId] : [delegatorId, userId, userId];
      let delegatorQuery = baseQuery.replace(/cca\.user_id = \?/g, `cca.user_id = ${delegatorId}`);
      const [delegatorRows] = await db.execute(baseQuery, delegatorParams);
      // دمج النتائج بدون تكرار (حسب id)
      const existingIds = new Set(rows.map(r => r.id));
      delegatorRows.forEach(r => {
        if (!existingIds.has(r.id)) rows.push(r);
      });
    }

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
  getCommitteeDelegationSummaryByUser
};
