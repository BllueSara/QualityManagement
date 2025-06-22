const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

const { logAction } = require('../models/logger');
const { insertNotification } = require('../models/notfications-utils');

require('dotenv').config();

// قاعدة البيانات
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// جلب التواقيع المعلقة للمستخدم
const getUserPendingApprovals = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

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
      LEFT JOIN content_approvers ca ON ca.content_id = c.id
      LEFT JOIN users u2 ON ca.user_id = u2.id
      WHERE c.is_approved = 0
        AND JSON_CONTAINS(c.approvers_required, JSON_ARRAY(?))
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
// اعتماد/رفض ملف
const handleApproval = async (req, res) => {
  let { contentId: originalContentId } = req.params;
  const { approved, signature, notes, electronic_signature, on_behalf_of } = req.body;

  let contentId;
  let isCommitteeContent = false;

  if (typeof originalContentId === 'string') {
    if (originalContentId.startsWith('dept-')) {
      contentId = parseInt(originalContentId.split('-')[1], 10);
      isCommitteeContent = false;
    } else if (originalContentId.startsWith('comm-')) {
      contentId = parseInt(originalContentId.split('-')[1], 10);
      isCommitteeContent = true;
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
    const currentUserId = decoded.id;

    const approverId = on_behalf_of || currentUserId;
    const delegatedBy = on_behalf_of ? currentUserId : null;
    const isProxy = !!on_behalf_of;

    if (approved === true && !signature && !electronic_signature) {
      return res.status(400).json({ status: 'error', message: 'التوقيع مفقود' });
    }

    const approvalLogsTable = isCommitteeContent ? 'committee_approval_logs' : 'approval_logs';
    const contentApproversTable = isCommitteeContent ? 'committee_content_approvers' : 'content_approvers';
    const contentsTable = isCommitteeContent ? 'committee_contents' : 'contents';
    const generatePdfFunction = isCommitteeContent ? generateFinalSignedCommitteePDF : generateFinalSignedPDF;

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
        delegated_by = VALUES(delegated_by),
        signed_as_proxy = VALUES(signed_as_proxy),
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

    // ✅ log action
    await logAction(
      currentUserId,
      approved ? 'approve_content' : 'reject_content',
      `تم ${approved ? 'اعتماد' : 'رفض'} الملف رقم ${contentId}${isProxy ? ' كمفوض عن مستخدم آخر' : ''}`,
      isCommitteeContent ? 'committee_content' : 'content',
      contentId
    );

    if (isProxy && approverId) {
      await insertNotification(
        approverId,
        'تم تفويضك للتوقيع',
        `تم تفويضك للتوقيع بالنيابة عن مستخدم آخر على الملف رقم ${contentId}`,
        'proxy'
      );
    }

    let [ownerRows] = await db.execute(`SELECT created_by, title FROM ${contentsTable} WHERE id = ?`, [contentId]);
    if (ownerRows.length) {
      const ownerId = ownerRows[0].created_by;
      const fileTitle = ownerRows[0].title || '';
      await insertNotification(
        ownerId,
        approved ? 'تم اعتماد ملفك' : 'تم رفض ملفك',
        `الملف "${fileTitle}" ${approved ? 'تم اعتماده' : 'تم رفضه'} من قبل الإدارة.`,
        approved ? 'approval' : 'rejected'
      );
    }

    if (approved === true && isProxy) {
      await db.execute(`
        INSERT IGNORE INTO ${contentApproversTable} (content_id, user_id)
        VALUES (?, ?)
      `, [contentId, approverId]);
    }

    const [remaining] = await db.execute(`
      SELECT COUNT(*) AS count
      FROM ${contentApproversTable} ca
      LEFT JOIN ${approvalLogsTable} al 
        ON ca.content_id = al.content_id AND ca.user_id = al.approver_id
      WHERE ca.content_id = ? AND (al.status IS NULL OR al.status != 'approved')
    `, [contentId]);

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


// توليد نسخة نهائية موقعة من PDF
async function generateFinalSignedPDF(contentId) {
  const [rows] = await db.execute(`SELECT file_path FROM contents WHERE id = ?`, [contentId]);
  if (!rows.length) return console.error('📁 Content not found');

  const relativePath = rows[0].file_path;
  const fullPath = path.join(__dirname, '../../uploads', relativePath);
  if (!fs.existsSync(fullPath)) return console.error('❌ File not found:', fullPath);

  let pdfDoc;
  try {
    const pdfBytes = fs.readFileSync(fullPath);
    pdfDoc = await PDFDocument.load(pdfBytes);
  } catch (err) {
    return console.error('❌ Failed to load PDF:', err);
  }

  const [logs] = await db.execute(`
    SELECT 
      u.username AS username,
      al.signature,
      al.electronic_signature,
      al.signed_as_proxy,
      al.comments
    FROM approval_logs al
    JOIN users u ON al.approver_id = u.id
    WHERE al.content_id = ? AND al.status = 'approved'
  `, [contentId]);

  if (!logs.length) return console.warn('No signatures found');

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

  for (const log of logs) {
    if (y < 200) {
      page = pdfDoc.addPage();
      y = 750;
    }

    const isProxy = !!log.signed_as_proxy;
    const label = isProxy ? 'Signed on behalf of' : 'Signed by';

    page.drawText(`${label}: ${log.username}`, {
      x: 50,
      y,
      size: 14,
      font,
      color: rgb(0, 0, 0)
    });

    y -= 25;

    if (log.signature && log.signature.startsWith('data:image')) {
      try {
        const base64Data = log.signature.split(',')[1];
        const imageBytes = Buffer.from(base64Data, 'base64');
        const img = await pdfDoc.embedPng(imageBytes);
        const dims = img.scale(0.4);

        page.drawText(`Hand Signature:`, {
          x: 50,
          y,
          size: 12,
          font,
          color: rgb(0.2, 0.2, 0.2)
        });

        page.drawImage(img, {
          x: 150,
          y: y - dims.height + 10,
          width: dims.width,
          height: dims.height
        });

        y -= dims.height + 30;
      } catch (err) {
        console.warn('Failed to draw hand signature:', err);
        y -= 20;
      }
    }

    if (log.electronic_signature) {
      try {
        const stampPath = path.join(__dirname, '../e3teamdelc.png');
        const stampImageBytes = fs.readFileSync(stampPath);
        const stampImg = await pdfDoc.embedPng(stampImageBytes);
        const dims = stampImg.scale(0.5);

        page.drawText(`E-Signature:`, {
          x: 50,
          y,
          size: 12,
          font,
          color: rgb(0.2, 0.2, 0.2)
        });

        page.drawImage(stampImg, {
          x: 150,
          y: y - dims.height + 10,
          width: dims.width,
          height: dims.height
        });

        y -= dims.height + 30;
      } catch (err) {
        console.warn('Failed to draw electronic signature:', err);
        y -= 20;
      }
    }

    if (log.comments) {
      page.drawText(`Comments: ${log.comments}`, {
        x: 50,
        y,
        size: 12,
        font,
        color: rgb(0.3, 0.3, 0.3)
      });
      y -= 20;
    }

    page.drawLine({
      start: { x: 50, y: y },
      end: { x: 550, y: y },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });

    y -= 30;
  }

  const finalBytes = await pdfDoc.save();
  fs.writeFileSync(fullPath, finalBytes);
  console.log(`✅ Signature page added: ${fullPath}`);
}

// Add a placeholder for committee PDF generation
async function generateFinalSignedCommitteePDF(contentId) {
  const [rows] = await db.execute(`SELECT file_path FROM committee_contents WHERE id = ?`, [contentId]);
  if (!rows.length) return console.error('📁 Committee Content not found');

  const relativePath = rows[0].file_path;
  const fullPath = path.join(__dirname, '../../uploads', relativePath);
  if (!fs.existsSync(fullPath)) return console.error('❌ Committee File not found:', fullPath);

  let pdfDoc;
  try {
    const pdfBytes = fs.readFileSync(fullPath);
    pdfDoc = await PDFDocument.load(pdfBytes);
  } catch (err) {
    return console.error('❌ Failed to load committee PDF:', err);
  }

  const [logs] = await db.execute(`
    SELECT 
      u.username AS username,
      al.signature,
      al.electronic_signature,
      al.signed_as_proxy,
      al.comments
    FROM committee_approval_logs al
    JOIN users u ON al.approver_id = u.id
    WHERE al.content_id = ? AND al.status = 'approved'
  `, [contentId]);

  if (!logs.length) return console.warn('No committee signatures found');

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let page = pdfDoc.addPage();
  let y = 750;

  page.drawText('Committee Signatures Summary', {
    x: 200,
    y,
    size: 20,
    font,
    color: rgb(0, 0, 0)
  });

  y -= 40;

  for (const log of logs) {
    if (y < 200) {
      page = pdfDoc.addPage();
      y = 750;
    }

    const isProxy = !!log.signed_as_proxy;
    const label = isProxy ? 'Signed on behalf of' : 'Signed by';

    page.drawText(`${label}: ${log.username}`, {
      x: 50,
      y,
      size: 14,
      font,
      color: rgb(0, 0, 0)
    });

    y -= 25;

    if (log.signature && log.signature.startsWith('data:image')) {
      try {
        const base64Data = log.signature.split(',')[1];
        const imageBytes = Buffer.from(base64Data, 'base64');
        const img = await pdfDoc.embedPng(imageBytes);
        const dims = img.scale(0.4);

        page.drawText(`Hand Signature:`, {
          x: 50,
          y,
          size: 12,
          font,
          color: rgb(0.2, 0.2, 0.2)
        });

        page.drawImage(img, {
          x: 150,
          y: y - dims.height + 10,
          width: dims.width,
          height: dims.height
        });

        y -= dims.height + 30;
      } catch (err) {
        console.warn('Failed to draw hand signature for committee:', err);
        y -= 20;
      }
    }

    if (log.electronic_signature) {
      try {
        const stampPath = path.join(__dirname, '../e3teamdelc.png');
        const stampImageBytes = fs.readFileSync(stampPath);
        const stampImg = await pdfDoc.embedPng(stampImageBytes);
        const dims = stampImg.scale(0.5);

        page.drawText(`E-Signature:`, {
          x: 50,
          y,
          size: 12,
          font,
          color: rgb(0.2, 0.2, 0.2)
        });

        page.drawImage(stampImg, {
          x: 150,
          y: y - dims.height + 10,
          width: dims.width,
          height: dims.height
        });

        y -= dims.height + 30;
      } catch (err) {
        console.warn('Failed to draw electronic signature for committee:', err);
        y -= 20;
      }
    }

    if (log.comments) {
      page.drawText(`Comments: ${log.comments}`, {
        x: 50,
        y,
        size: 12,
        font,
        color: rgb(0.3, 0.3, 0.3)
      });
      y -= 20;
    }

    page.drawLine({
      start: { x: 50, y: y },
      end: { x: 550, y: y },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });

    y -= 30;
  }

  const finalBytes = await pdfDoc.save();
  fs.writeFileSync(fullPath, finalBytes);
  console.log(`✅ Committee Signature page added: ${fullPath}`);
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
    const userId = decoded.id;
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
        WHERE c.approval_status = 'pending'
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
          u.username AS created_by_username,
          'department' AS type,
          CAST(c.approvers_required AS CHAR) AS approvers_required,
          c.created_at
        FROM contents c
        JOIN folders f        ON c.folder_id = f.id
        JOIN departments d    ON f.department_id = d.id
        JOIN users u          ON c.created_by = u.id
        -- هنا نضمن أن الصف موجود فقط لو هو من المعينين أو منشئه
        JOIN content_approvers ca ON ca.content_id = c.id AND ca.user_id = ?
        LEFT JOIN users u2     ON ca.user_id = u2.id
        WHERE c.approval_status = 'pending'
          OR c.created_by = ?
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
        WHERE cc.approval_status = 'pending'
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
        WHERE cc.approval_status = 'pending'
          OR cc.created_by = ?
        GROUP BY cc.id
      `;

    // إذا كان مفوّض محدود نمرر userId مرتين لكل جزء
    const params = canViewAll
      ? []
      : [userId, userId, userId, userId];

    const finalQuery = `
      ${departmentContentQuery}
      UNION ALL
      ${committeeContentQuery}
      ORDER BY created_at DESC
    `;

    const [rows] = await db.execute(finalQuery, params);

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


const delegateApproval = async (req, res) => {
  // 1) فكّ الـ prefix وخذ الرقم فقط
  const rawId = req.params.id;            // e.g. "dept-10" أو "comm-5"
  const parts = rawId.split('-');
  const contentId = parseInt(parts[1], 10);

  const { delegateTo, notes } = req.body;

  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentUserId = decoded.id;

    // 2) تحقق من صحة القيم بعد التحويل
    if (isNaN(contentId) || !delegateTo || !currentUserId) {
      console.error('❌ قيم ناقصة أو غير صحيحة:', { contentId, delegateTo, currentUserId });
      return res.status(400).json({ status: 'error', message: 'بيانات مفقودة أو غير صحيحة للتفويض' });
    }

    // 3) نفّذ الاستعلام مع الرقم الصحيح
    await db.execute(`
      INSERT INTO approval_logs (
        content_id,
        approver_id,
        delegated_by,
        signed_as_proxy,
        status,
        comments,
        created_at
      )
      VALUES (?, ?, ?, 1, 'pending', ?, NOW())
      ON DUPLICATE KEY UPDATE
        delegated_by = VALUES(delegated_by),
        signed_as_proxy = 1,
        status = 'pending',
        comments = VALUES(comments),
        created_at = NOW()
    `, [contentId, delegateTo, currentUserId, notes || null]);

    await logAction(
      currentUserId,
      'delegate_signature',
      JSON.stringify({
        ar: `تم تفويض التوقيع للمستخدم: ${delegateTo} على الملف رقم: ${contentId}`,
        en: `Delegated signature to user: ${delegateTo} for file ID: ${contentId}`
      }),
      rawId.startsWith('comm-') ? 'committee_content' : 'content',
      contentId
    );

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
        u.username AS delegated_by_name
      FROM approval_logs al
      JOIN contents c ON al.content_id = c.id
      LEFT JOIN folders f ON c.folder_id = f.id
      LEFT JOIN departments d ON f.department_id = d.id
      JOIN users u ON al.delegated_by = u.id
      WHERE al.approver_id = ? AND al.signed_as_proxy = 1 AND al.status = 'pending'
    `, [userId]);

    res.json({ status: 'success', data: rows });
  } catch (err) {
    console.error('getProxyApprovals error:', err);
    res.status(500).json({ status: 'error', message: 'فشل جلب الموافقات بالوكالة' });
  }
};

module.exports = {
  getUserPendingApprovals,
  handleApproval,
  delegateApproval,
  getAssignedApprovals,
  getProxyApprovals,
  generateFinalSignedCommitteePDF
};


