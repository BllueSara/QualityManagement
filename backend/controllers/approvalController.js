const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

const { logAction } = require('../models/logger');
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
      
      // جلب الملفات المكلف بها المستخدم (شخصياً أو بالنيابة)
      // المهم: لا تظهر الملف للمفوض الأصلي، فقط للمفوض له
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
          GROUP_CONCAT(DISTINCT u2.username) AS assigned_approvers,
          'dual' AS signature_type
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
        GROUP BY c.id
      `, [userId, userId]);

      rows = delegatedRows;
    } else {
      // المستخدم عادي - جلب الملفات المكلف بها فقط
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
          GROUP_CONCAT(DISTINCT u2.username) AS assigned_approvers,
          'normal' AS signature_type
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
        GROUP BY c.id
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

// ——— منطق التوقيع المزدوج للمفوض له ———
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
      ORDER BY created_at
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
// توليد نسخة نهائية موقعة من PDF مع دعم "توقيع بالنيابة"
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

  // 2) تحميل وثيقة الـ PDF
  let pdfDoc;
  try {
    const pdfBytes = fs.readFileSync(fullPath);
    pdfDoc = await PDFDocument.load(pdfBytes);
  } catch (err) {
    return console.error('❌ Failed to load PDF:', err);
  }

  // 3) جلب سجلات الاعتماد بما فيها التفويض
  const [logs] = await db.execute(`
    SELECT
      al.signed_as_proxy,
      u_actual.username   AS actual_signer,
      u_original.username AS original_user,
      al.signature,
      al.electronic_signature,
      al.comments
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

  // 4) إعداد الصفحة
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let page = pdfDoc.addPage();
  let y = 750;

  page.drawText('Signatures Summary', {
    x: 200,
    y,
    size: 20,
    font,
    color: rgb(0, 0, 0)
  });
  y -= 40;

  // 5) رسم كل توقيع
  for (const log of logs) {
    if (y < 200) {
      page = pdfDoc.addPage();
      y = 750;
    }

    // التسمية تصير:
    //   إذا signed_as_proxy = 1 → "Signed by Ahmed on behalf of Rawad"
    //   وإلا → "Signed by Ahmed"
    const label = log.signed_as_proxy
      ? `Signed by ${log.actual_signer} on behalf of ${log.original_user}`
      : `Signed by ${log.actual_signer}`;

    page.drawText(label, {
      x: 50, y, size: 14, font, color: rgb(0, 0, 0)
    });
    y -= 25;

    // توقيع يدوي
    if (log.signature?.startsWith('data:image')) {
      try {
        const base64Data = log.signature.split(',')[1];
        const imgBytes = Buffer.from(base64Data, 'base64');
        const img = await pdfDoc.embedPng(imgBytes);
        const dims = img.scale(0.4);

        page.drawImage(img, {
          x: 150,
          y: y - dims.height + 10,
          width: dims.width,
          height: dims.height
        });
        y -= dims.height + 20;
      } catch (err) {
        console.warn('Failed to draw hand signature:', err);
        y -= 20;
      }
    }

    // توقيع إلكتروني
    if (log.electronic_signature) {
      try {
        const stampPath = path.join(__dirname, '../e3teamdelc.png');
        const stampBytes = fs.readFileSync(stampPath);
        const stampImg = await pdfDoc.embedPng(stampBytes);
        const dims = stampImg.scale(0.5);

        page.drawImage(stampImg, {
          x: 150,
          y: y - dims.height + 10,
          width: dims.width,
          height: dims.height
        });
        y -= dims.height + 20;
      } catch (err) {
        console.warn('Failed to draw electronic signature:', err);
        y -= 20;
      }
    }

    // التعليقات
    if (log.comments) {
      page.drawText(`Comments: ${log.comments}`, {
        x: 50, y, size: 12, font, color: rgb(0.3, 0.3, 0.3)
      });
      y -= 20;
    }

    // فاصل
    page.drawLine({
      start: { x: 50, y },
      end:   { x: 550, y },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8)
    });
    y -= 30;
  }

  // 6) حفظ التعديلات
  try {
    const finalBytes = await pdfDoc.save();
    fs.writeFileSync(fullPath, finalBytes);
    console.log(`✅ PDF updated: ${fullPath}`);
  } catch (err) {
    console.error('❌ Error saving PDF:', err);
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
          GROUP_CONCAT(DISTINCT u2.username) AS assigned_approvers,
          d.name AS source_name,
          f.name AS folder_name,
          u.username AS created_by_username,
          'department' AS type,
          CAST(c.approvers_required AS CHAR) AS approvers_required,
          c.created_at
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
        GROUP BY c.id
      `
      : `
        SELECT
          CONCAT('dept-', c.id) AS id,
          c.title,
          c.file_path,
          c.approval_status,
          GROUP_CONCAT(DISTINCT u2.username) AS assigned_approvers,
          d.name AS source_name,
          f.name AS folder_name,
          u.username AS created_by_username,
          'department' AS type,
          CAST(c.approvers_required AS CHAR) AS approvers_required,
          c.created_at
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
        GROUP BY c.id
      `;

    const committeeContentQuery = canViewAll
      ? `
        SELECT
          CONCAT('comm-', cc.id) AS id,
          cc.title,
          cc.file_path,
          cc.approval_status,
          GROUP_CONCAT(DISTINCT u2.username) AS assigned_approvers,
          com.name AS source_name,
          cf.name AS folder_name,
          u.username AS created_by_username,
          'committee' AS type,
          CAST(cc.approvers_required AS CHAR) AS approvers_required,
          cc.created_at
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
        GROUP BY cc.id
      `
      : `
        SELECT
          CONCAT('comm-', cc.id) AS id,
          cc.title,
          cc.file_path,
          cc.approval_status,
          GROUP_CONCAT(DISTINCT u2.username) AS assigned_approvers,
          com.name AS source_name,
          cf.name AS folder_name,
          u.username AS created_by_username,
          'committee' AS type,
          CAST(cc.approvers_required AS CHAR) AS approvers_required,
          cc.created_at
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
        GROUP BY cc.id
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

    // إذا كان المستخدم مفوض له (من جدول active_delegations)
    // لا نحتاج لجلب ملفات المفوض الأصلي لأن المفوض له هو من سيعتمد
    // const [delegationRows] = await db.execute(
    //   'SELECT user_id FROM active_delegations WHERE delegate_id = ?',
    //   [userId]
    // );
    // if (delegationRows.length) {
    //   const delegatorId = delegationRows[0].user_id;
    //   // جلب ملفات المفوض الأصلي بنفس الاستعلام
    //   let delegatorParams = canViewAll ? [delegatorId, delegatorId] : [delegatorId, delegatorId, delegatorId, delegatorId];
    //   let [delegatorRows] = await db.execute(finalQuery, delegatorParams);
    //   // دمج النتائج بدون تكرار (حسب id)
    //   const existingIds = new Set(rows.map(r => r.id));
    //   delegatorRows.forEach(r => {
    //     if (!existingIds.has(r.id)) rows.push(r);
    //   });
    // }

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

// دالة موحدة لجلب التفويضات المعلقة (أقسام ولجان)
const getPendingDelegationsUnified = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    jwt.verify(token, process.env.JWT_SECRET);
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ status: 'error', message: 'يرجى تحديد المستخدم' });

    // جلب التفويضات المعلقة من approval_logs (الأقسام)
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
    `, [userId]);

    // جلب التفويضات المعلقة من committee_approval_logs (اللجان)
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
  processBulkDelegationUnified
};


