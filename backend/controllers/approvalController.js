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
        id, title, file_path, notes, approval_status, approvers_required, approvals_log, created_at
      FROM contents
      WHERE is_approved = 0
        AND JSON_CONTAINS(approvers_required, JSON_ARRAY(?))
    `, [userId]);

    res.status(200).json({ status: 'success', data: rows });
  } catch (err) {
    console.error('Error getUserPendingApprovals:', err);
    res.status(500).json({ status: 'error', message: 'خطأ في السيرفر' });
  }
};

// اعتماد/رفض ملف
const handleApproval = async (req, res) => {
  const { contentId } = req.params;
  const { approved, signature, notes, electronic_signature, on_behalf_of } = req.body;

  if (typeof approved !== 'boolean') {
    return res.status(400).json({ status: 'error', message: 'البيانات ناقصة' });
  }

  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentUserId = decoded.id;

    // تحديد الموقّع الفعلي
    const approverId = on_behalf_of || currentUserId;
    const delegatedBy = on_behalf_of ? currentUserId : null;
    const isProxy = !!on_behalf_of;

    // ✅ السماح بالرفض بدون توقيع
    if (approved === true && !signature && !electronic_signature) {
      return res.status(400).json({ status: 'error', message: 'التوقيع مفقود' });
    }

    // تسجيل التوقيع أو الرفض في جدول approval_logs
    await db.execute(`
      INSERT INTO approval_logs (
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
   // ✅ إذا وافق على التفويض، أضفه كموقّع رسمي للملف
    if (approved === true && isProxy) {
      await db.execute(`
        INSERT IGNORE INTO content_approvers (content_id, user_id)
        VALUES (?, ?)
      `, [contentId, approverId]);
    }
    // التحقق من اكتمال التواقيع المطلوبة
    const [remaining] = await db.execute(`
      SELECT COUNT(*) AS count
      FROM content_approvers ca
      LEFT JOIN approval_logs al 
        ON ca.content_id = al.content_id AND ca.user_id = al.approver_id
      WHERE ca.content_id = ? AND (al.status IS NULL OR al.status != 'approved')
    `, [contentId]);

    if (remaining[0].count === 0) {
      await generateFinalSignedPDF(contentId);
      await db.execute(`
        UPDATE contents
        SET is_approved = 1,
            approval_status = 'approved',
            approved_by = ?,
            updated_at = NOW()
        WHERE id = ?
      `, [approverId, contentId]);
    }

    res.status(200).json({ status: 'success', message: 'تم التوقيع بنجاح' });
  } catch (err) {
    console.error('❌ handleApproval Error:', err);
    res.status(500).json({ status: 'error', message: 'فشل التوقيع' });
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

        page.drawText(`Electronic Signature:`, {
          x: 50,
          y,
          size: 12,
          font,
          color: rgb(0.2, 0.2, 0.2)
        });

        page.drawImage(stampImg, {
          x: 170,
          y: y - dims.height,
          width: dims.width,
          height: dims.height
        });

        y -= dims.height + 20;
      } catch (err) {
        page.drawText('Electronically approved', {
          x: 50,
          y,
          size: 14,
          font,
          color: rgb(0, 0.5, 0.5)
        });

        y -= 30;
      }
    }

    if (log.comments) {
      page.drawText(`Notes: ${log.comments}`, {
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








module.exports = { generateFinalSignedPDF };

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

    let departmentContentQuery = `
      SELECT
        c.id,
        c.title,
        c.file_path,
        c.approval_status,
        GROUP_CONCAT(DISTINCT u2.username) AS assigned_approvers,
        d.name AS source_name, -- Alias to source_name for consistency
        u.username AS created_by_username,
        'department_content' AS content_type,
        CAST(c.approvers_required AS CHAR) AS approvers_required,
        c.created_at
      FROM contents c
      JOIN folders f ON c.folder_id = f.id
      JOIN departments d ON f.department_id = d.id
      JOIN users u ON c.created_by = u.id
      LEFT JOIN content_approvers ca ON ca.content_id = c.id
      LEFT JOIN users u2 ON ca.user_id = u2.id
      WHERE c.approval_status = 'pending'
    `;

    let committeeContentQuery = `
      SELECT
        cc.id,
        cc.title,
        cc.file_path,
        cc.approval_status,
        GROUP_CONCAT(DISTINCT u2.username) AS assigned_approvers,
        com.name AS source_name, -- Alias to source_name for consistency
        u.username AS created_by_username,
        'committee_content' AS content_type,
        CAST(cc.approvers_required AS CHAR) AS approvers_required,
        cc.created_at
      FROM committee_contents cc
      JOIN committee_folders cf ON cc.folder_id = cf.id
      JOIN committees com ON cf.committee_id = com.id
      JOIN users u ON cc.created_by = u.id
      LEFT JOIN committee_content_approvers cca ON cca.content_id = cc.id
      LEFT JOIN users u2 ON cca.user_id = u2.id
      WHERE cc.approval_status = 'pending'
    `;

    let params = [];

    if (!canViewAll) {
      departmentContentQuery += ` AND (EXISTS (SELECT 1 FROM content_approvers WHERE content_id = c.id AND user_id = ?) OR c.created_by = ?)`;
      committeeContentQuery += ` AND (EXISTS (SELECT 1 FROM committee_content_approvers WHERE content_id = cc.id AND user_id = ?) OR cc.created_by = ?)`;
      params.push(userId, userId, userId, userId);
    }

    departmentContentQuery += ` GROUP BY c.id`;
    committeeContentQuery += ` GROUP BY cc.id`;

    const finalQuery = `
      ${departmentContentQuery}
      UNION ALL
      ${committeeContentQuery}
      ORDER BY created_at DESC
    `;

    const [rows] = await db.execute(finalQuery, params);

    rows.forEach(row => {
      if (typeof row.approvers_required === 'string') {
        try {
          row.approvers_required = JSON.parse(row.approvers_required);
        } catch (e) {
          console.error('Failed to parse approvers_required JSON string for item ID:', row.id, 'Raw string:', row.approvers_required, 'Error:', e);
          row.approvers_required = [];
        }
      } else if (row.approvers_required === null || !Array.isArray(row.approvers_required)) {
        row.approvers_required = [];
      }
    });

    res.json({ status: 'success', data: rows });
  } catch (err) {
    console.error('Error in getAssignedApprovals:', err);
    res.status(500).json({ status: 'error', message: 'Internal Server Error' });
  }
};




const delegateApproval = async (req, res) => {
  const contentId = req.params.id;
  const { delegateTo, notes } = req.body;

  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentUserId = decoded.id;
    
    if (!contentId || !delegateTo || !currentUserId) {
      console.error('❌ قيم ناقصة:', { contentId, delegateTo, currentUserId });
      return res.status(400).json({ status: 'error', message: 'بيانات مفقودة للتفويض' });
    }

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
    
    res.status(200).json({
      status: 'success',
      message: '✅ تم التفويض بالنيابة بنجاح'
    });

  } catch (err) {
    console.error('خطأ أثناء التفويض بالنيابة:', err);
    res.status(500).json({ status: 'error', message: 'فشل التفويض بالنيابة' });
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
    res.status(500).json({ status: 'error', message: 'فشل في تحميل التواقيع بالنيابة' });
  }
};


module.exports = {
  getUserPendingApprovals,
  handleApproval,
  delegateApproval,
  getAssignedApprovals,
  getProxyApprovals
};


