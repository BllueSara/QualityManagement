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

    // جلب فقط الموافقات التي لم يتم تفويضها لمستخدم آخر
    const [rows] = await db.execute(`
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
        GROUP_CONCAT(DISTINCT u2.username) AS assigned_approvers
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
            AND delegated_by = ca.user_id
            AND signed_as_proxy = 1
            AND status = 'pending'
        )
      GROUP BY c.id
    `, [userId]);

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

// ——— fallback لحفظ التفويض القديم إذا ما جالنا on_behalf_of ———
// أولاً حدد القيم الواردة من الـ body
let delegatedBy = on_behalf_of || null;
let isProxy    = Boolean(on_behalf_of);

// إذا ما وصلنا on_behalf_of نقرأ من القاعدة السجل القديم
if (!on_behalf_of) {
  const [existing] = await db.execute(`
    SELECT delegated_by, signed_as_proxy
    FROM approval_logs
    WHERE content_id = ? AND approver_id = ?
    LIMIT 1
  `, [contentId, currentUserId]);

  if (existing.length && existing[0].signed_as_proxy === 1) {
    // احتفظ بقيم التفويض القديمة بدل مسحها
    delegatedBy = existing[0].delegated_by;
    isProxy    = true;
  }
}

// بعدين استخدم currentUserId كموقّع فعلي
const approverId = currentUserId;
// ————————————————————————————————————————————————


    if (approved === true && !signature && !electronic_signature) {
      return res.status(400).json({ status: 'error', message: 'التوقيع مفقود' });
    }

    const approvalLogsTable = 'approval_logs';
    const contentApproversTable = 'content_approvers';
    const contentsTable = 'contents';
    const generatePdfFunction = generateFinalSignedPDF;

    // تحقق إذا كان هناك سجل بنفس نوع التوقيع (أصلي أو نيابة)
    const [existingLogs] = await db.execute(
      `SELECT * FROM ${approvalLogsTable} WHERE content_id = ? AND approver_id = ? AND signed_as_proxy = ? AND (delegated_by <=> ? OR (? IS NULL AND delegated_by IS NULL))`,
      [contentId, approverId, isProxy ? 1 : 0, delegatedBy, delegatedBy]
    );
    
    // تحقق إذا كان المستخدم مفوض له (للدعم التفويض المزدوج)
    const [delegationRows] = await db.execute(
      'SELECT permanent_delegate_id FROM users WHERE id = ?',
      [approverId]
    );
    
    if (!existingLogs.length) {
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
      
      // إذا كان المستخدم مفوض له، أضف سجل بالنيابة إضافي
      if (delegationRows.length && delegationRows[0].permanent_delegate_id) {
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
        `, [
          contentId,
          approverId,
          delegationRows[0].permanent_delegate_id,
          1, // signed_as_proxy = 1
          approved ? 'approved' : 'rejected',
          signature || null,
          electronic_signature || null,
          notes || ''
        ]);
      }
    } else {
      // إذا يوجد سجل، حدثه فقط إذا أردت (اختياري)
      await db.execute(
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
      
      // إذا كان المستخدم مفوض له، حدث سجل بالنيابة أيضاً
      if (delegationRows.length && delegationRows[0].permanent_delegate_id) {
        await db.execute(
          `UPDATE ${approvalLogsTable} SET status = ?, signature = ?, electronic_signature = ?, comments = ?, created_at = NOW() WHERE content_id = ? AND approver_id = ? AND signed_as_proxy = 1 AND delegated_by = ?`,
          [
            approved ? 'approved' : 'rejected',
            signature || null,
            electronic_signature || null,
            notes || '',
            contentId,
            approverId,
            delegationRows[0].permanent_delegate_id
          ]
        );
      }
    }

    // جلب عدد المعتمدين المتبقين قبل إشعارات صاحب الملف
    const [remaining] = await db.execute(`
      SELECT COUNT(*) AS count
      FROM content_approvers ca
      LEFT JOIN approval_logs al 
        ON ca.content_id = al.content_id AND ca.user_id = al.approver_id
      WHERE ca.content_id = ? 
        AND (
          al.status IS NULL 
          OR al.status != 'approved'
        )
    `, [contentId]);

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
      await generatePdfFunction(contentId);
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
            AND al.status IN ('pending','accepted')
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
            AND al.status IN ('pending','accepted')
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
            AND cal.status IN ('pending','accepted')
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
            AND cal.status IN ('pending','accepted')
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

    // إذا كان المستخدم مفوض له (موجود في globalPermanentDelegations)
    if (globalPermanentDelegations[userId]) {
      const delegatorId = globalPermanentDelegations[userId];
      // جلب ملفات المفوض الأصلي بنفس الاستعلام
      let delegatorParams = canViewAll ? [delegatorId, delegatorId] : [delegatorId, delegatorId, delegatorId, delegatorId];
      let [delegatorRows] = await db.execute(finalQuery, delegatorParams);
      // دمج النتائج بدون تكرار (حسب id)
      const existingIds = new Set(rows.map(r => r.id));
      delegatorRows.forEach(r => {
        if (!existingIds.has(r.id)) rows.push(r);
      });
    }

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
      INSERT INTO approval_logs (
        content_id,
        approver_id,
        delegated_by,
        signed_as_proxy,
        status,
        comments,
        created_at
      ) VALUES (?, ?, ?, 1, 'pending', ?, NOW())
      ON DUPLICATE KEY UPDATE
        delegated_by = VALUES(delegated_by),
        signed_as_proxy = 1,
        status = 'pending',
        comments = VALUES(comments),
        created_at = NOW()
    `, [contentId, delegateTo, currentUserId, notes || null]);

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
    // أضف المستخدم لجدول المعيّنين
    await addApproverWithDelegation(contentId, userId);
    // لا تغيّر حالة سجل التفويض في logs، اتركه 'pending' حتى يوقع المفوض له فعلياً
    res.json({ status: 'success', message: 'تم قبول التفويض وستظهر لك في التقارير المكلف بها' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'فشل قبول التفويض' });
  }
};

// قبول جميع التفويضات دفعة واحدة
const acceptAllProxyDelegations = async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const userId = decoded.id;

  try {
    // جلب كل الملفات التي للمستخدم تفويض فيها ولم يقبلها بعد
    const [rows] = await db.execute(`
      SELECT content_id FROM approval_logs
      WHERE approver_id = ? AND signed_as_proxy = 1 AND status = 'pending'
    `, [userId]);

    if (!rows.length) {
      return res.json({ status: 'success', message: 'لا يوجد تفويضات لقبولها' });
    }

    // أضف المستخدم كمعتمد في كل ملف
    for (const row of rows) {
      await db.execute(
        'INSERT IGNORE INTO content_approvers (content_id, user_id) VALUES (?, ?)',
        [row.content_id, userId]
      );
    }

    res.json({ status: 'success', message: 'تم قبول جميع التفويضات بنجاح' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'فشل قبول جميع التفويضات' });
  }
};

// تفويض جميع الملفات المعلقة دفعة واحدة (يرسل إشعار فقط)
const delegateAllApprovals = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentUserId = decoded.id;
    const { delegateTo, notes } = req.body;
    if (!delegateTo) return res.status(400).json({ status: 'error', message: 'يرجى اختيار المستخدم المفوض له' });

    // جلب جميع الملفات المعلقة للمستخدم الحالي
    const [rows] = await db.execute(`
      SELECT c.id
      FROM contents c
      JOIN content_approvers ca ON ca.content_id = c.id
      WHERE c.is_approved = 0 AND ca.user_id = ?
    `, [currentUserId]);

    if (!rows.length) {
      // جلب اسم المفوض
      const [delegatorRows] = await db.execute('SELECT username FROM users WHERE id = ?', [currentUserId]);
      const delegatorName = delegatorRows.length ? delegatorRows[0].username : '';
      // لا يوجد ملفات معلقة للتفويض الجماعي
      return res.status(400).json({ status: 'error', message: 'لا يوجد ملفات معلقة للتفويض الجماعي.' });
    }

    // جلب اسم المفوض
    const [delegatorRows] = await db.execute('SELECT username FROM users WHERE id = ?', [currentUserId]);
    const delegatorName = delegatorRows.length ? delegatorRows[0].username : '';
    // إرسال إشعار جماعي للمفوض له
    await insertNotification(
      delegateTo,
      'طلب تفويض بالنيابة',
      `تم طلب تفويضك للتوقيع بالنيابة عن ${delegatorName} على جميع الملفات.`,
      'proxy_bulk',
      JSON.stringify({ from: currentUserId, from_name: delegatorName, notes: notes || '', fileIds: rows.map(r => r.id) })
    );
    // أرسل إشعار تفويض لكل ملف للمفوض إليه
    for (const row of rows) {
      await sendProxyNotification(delegateTo, row.id, false);
    }
    res.status(200).json({ status: 'success', message: 'تم إرسال طلب التفويض الجماعي بنجاح. بانتظار موافقة المفوض له.' });
  } catch (err) {
    console.error('خطأ أثناء إرسال طلب التفويض الجماعي:', err);
    res.status(500).json({ status: 'error', message: 'فشل إرسال طلب التفويض الجماعي' });
  }
};

// تنفيذ أو رفض التفويض الجماعي (عند موافقة المفوض له)
const processBulkDelegation = async (req, res) => {
  console.log('--- processBulkDelegation called ---');
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    const { notificationId, action } = req.body; // action: 'accept' or 'reject'
    console.log('notificationId:', notificationId, 'action:', action, 'userId:', userId);
    if (!notificationId || !['accept','reject'].includes(action)) {
      return res.status(400).json({ status: 'error', message: 'بيانات غير صالحة' });
    }
    // جلب الإشعار بدون شرط is_read_by_user
    // إضافة لوج لكل الإشعارات المتاحة للمستخدم
    const [allNotifs] = await db.execute(
      'SELECT * FROM notifications WHERE user_id = ? AND (type = ? OR type = ?)',
      [userId, 'proxy_bulk', 'proxy_bulk_committee']
    );
    console.log('All proxy_bulk notifications for user:', allNotifs);
    const [rows] = await db.execute(
      'SELECT * FROM notifications WHERE id = ? AND user_id = ? AND (type = ? OR type = ?)',
      [notificationId, userId, 'proxy_bulk', 'proxy_bulk_committee']
    );
    console.log('notification rows:', rows);
    if (!rows.length) return res.status(404).json({ status: 'error', message: 'لا يوجد طلب تفويض جماعي' });
    const notif = rows[0];
    const data = notif.message_data ? JSON.parse(notif.message_data) : {};
    console.log('notif.message_data:', notif.message_data, 'parsed data:', data);
    if (action === 'reject') {
      await db.execute('DELETE FROM notifications WHERE id = ?', [notificationId]);
      return res.status(200).json({ status: 'success', message: 'تم رفض طلب التفويض الجماعي' });
    }
    if (action === 'accept') {
      for (const fileId of data.fileIds) {
        // أضف المستخدم كسيناريو تفويض بالنيابة
        await db.execute(
          `INSERT INTO approval_logs (
            content_id, approver_id, delegated_by, signed_as_proxy, status, created_at
          ) VALUES (?, ?, ?, 1, 'pending', NOW())
          ON DUPLICATE KEY UPDATE
            delegated_by = VALUES(delegated_by),
            signed_as_proxy = 1,
            status = 'pending',
            created_at = NOW()`,
          [fileId, userId, data.from]
        );
        // أضف المستخدم الجديد إلى content_approvers
        await db.execute(
          'INSERT IGNORE INTO content_approvers (content_id, user_id) VALUES (?, ?)',
          [fileId, userId]
        );
        // احذف المفوض الأصلي من content_approvers
        if (data.from && userId && data.from !== userId) {
          await db.execute(
            'DELETE FROM content_approvers WHERE content_id = ? AND user_id = ?',
            [fileId, data.from]
          );
        }
      }
      // احذف الإشعار نهائياً بعد المعالجة
      await db.execute('DELETE FROM notifications WHERE id = ?', [notificationId]);
      // إضافة علاقة التفويض الدائم في جدول المستخدمين
      await db.execute(
        'UPDATE users SET permanent_delegate_id = ? WHERE id = ?',
        [data.from, userId]
      );
      return res.status(200).json({ status: 'success', message: 'تم قبول التفويض الجماعي وأصبحت مفوضاً بالنيابة عن جميع الملفات.' });
    }
  } catch (err) {
    console.error('خطأ أثناء تنفيذ التفويض الجماعي:', err);
    res.status(500).json({ status: 'error', message: 'فشل تنفيذ التفويض الجماعي' });
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
    if (!rows.length) {
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
    // حذف علاقة التفويض الدائم من قاعدة البيانات
    await db.execute('UPDATE users SET permanent_delegate_id = NULL WHERE permanent_delegate_id = ?', [userId]);
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
      await db.execute(
        `INSERT IGNORE INTO content_approvers (content_id, user_id) VALUES (?, ?)`,
        [id, delegationRow[0].delegated_by]
      );
    }
    // حذف علاقة التفويض الدائم من قاعدة البيانات
    await db.execute('UPDATE users SET permanent_delegate_id = NULL WHERE id = ?', [delegateeId]);
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

// جلب قائمة الأشخاص الذين تم تفويضهم من المستخدم الحالي (distinct delegateeId)
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

// دالة مساعدة: إضافة معتمد لملف مع دعم التفويض التلقائي
async function addApproverWithDelegation(contentId, userId) {
  // أضف المستخدم الأصلي
  await db.execute('INSERT IGNORE INTO content_approvers (content_id, user_id) VALUES (?, ?)', [contentId, userId]);
  // تحقق إذا كان لديه تفويض نشط من قاعدة البيانات
  const [delegationRows] = await db.execute(
    'SELECT permanent_delegate_id FROM users WHERE id = ?',
    [userId]
  );
  
  if (delegationRows.length && delegationRows[0].permanent_delegate_id) {
    const delegateeId = delegationRows[0].permanent_delegate_id;
    // أضف سجل تفويض بالنيابة
    await db.execute(
      `INSERT INTO approval_logs (content_id, approver_id, delegated_by, signed_as_proxy, status, created_at)
       VALUES (?, ?, ?, 1, 'pending', NOW())
       ON DUPLICATE KEY UPDATE delegated_by = VALUES(delegated_by), signed_as_proxy = 1, status = 'pending', created_at = NOW()`,
      [contentId, delegateeId, userId]
    );
    // أضف المفوض له إلى content_approvers
    await db.execute('INSERT IGNORE INTO content_approvers (content_id, user_id) VALUES (?, ?)', [contentId, delegateeId]);
    // احذف المفوض الأصلي من content_approvers
    await db.execute('DELETE FROM content_approvers WHERE content_id = ? AND user_id = ?', [contentId, userId]);
  }
}

module.exports = {
  getUserPendingApprovals,
  handleApproval,
  delegateApproval,
  getAssignedApprovals,
  getProxyApprovals,
  acceptProxyDelegation,
  acceptAllProxyDelegations,
  delegateAllApprovals,
  processBulkDelegation,
  activateProxy, // أضف هذا
  revokeAllDelegations,
  revokeDelegation,
  getDelegationsByUser,
  getDelegationSummaryByUser
};


