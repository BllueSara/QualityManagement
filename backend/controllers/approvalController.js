const mysql = require('mysql2/promise');
const jwt   = require('jsonwebtoken');
require('dotenv').config();

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

/**
 * GET /api/approvals
 * ترجع للمستخدم الملفات اللي تحتاج موافقته (أي pending and user in approvers_required)
 */
const getUserPendingApprovals = async (req, res) => {
  try {
    // استخراج المستخدم من التوكن
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ status:'error', message:'لا يوجد توكن' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    // جلب المحتويات pending حيث يكون userId ضمن approvers_required
    const [rows] = await db.execute(`
      SELECT 
        id, title, file_path, notes, approval_status, approvers_required, approvals_log, created_at
      FROM contents
      WHERE is_approved = 0
        AND JSON_CONTAINS(approvers_required, JSON_ARRAY(?))
    `, [userId]);

    res.status(200).json({ status:'success', data: rows });
  } catch (err) {
    console.error('Error getUserPendingApprovals:', err);
    res.status(500).json({ status:'error', message:'خطأ في السيرفر' });
  }
};

/**
 * POST /api/approvals/:contentId/approve
 * الجسم: { approved: true|false, notes?: string }
 */
const handleApproval = async (req, res) => {
  const { contentId } = req.params;
  const userId = req.user.id;
  const { approved, signature, notes } = req.body;

  if (typeof approved !== 'boolean' || !signature) {
    return res.status(400).json({ status: 'error', message: 'البيانات ناقصة' });
  }

  try {
    // حفظ الموافقة مع التوقيع
    await db.execute(`
      UPDATE approval_logs
      SET status = ?, signature = ?, notes = ?, approved_at = NOW()
      WHERE content_id = ? AND approver_id = ?
    `, [approved ? 'approved' : 'rejected', signature, notes || '', contentId, userId]);

    // التحقق هل كلهم وافقوا
    const [remaining] = await db.execute(`
      SELECT COUNT(*) AS count
      FROM content_approvers ca
      LEFT JOIN approval_logs al ON ca.content_id = al.content_id AND ca.user_id = al.approver_id
      WHERE ca.content_id = ? AND (al.status IS NULL OR al.status != 'approved')
    `, [contentId]);

    if (remaining[0].count === 0) {
      // الكل وافق → توليد نسخة PDF موقعة
      await generateFinalSignedPDF(contentId);
    }

    res.status(200).json({ status: 'success', message: 'تم التوقيع' });
  } catch (err) {
    console.error('handleApproval Error:', err);
    res.status(500).json({ status: 'error', message: 'فشل التوقيع' });
  }
};



const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb } = require('pdf-lib');

async function generateFinalSignedPDF(contentId) {
  const originalPath = path.join(__dirname, `../../uploads/${contentId}.pdf`);
  const outputPath = path.join(__dirname, `../../signed/final_${contentId}.pdf`);

  if (!fs.existsSync(originalPath)) {
    console.error('الملف غير موجود:', originalPath);
    return;
  }

  const pdfBytes = fs.readFileSync(originalPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const page = pdfDoc.getPages()[0];

  const [logs] = await db.execute(`
    SELECT u.full_name, al.signature
    FROM approval_logs al
    JOIN users u ON al.approver_id = u.id
    WHERE al.content_id = ? AND al.status = 'approved'
  `, [contentId]);

  let y = 700;

  for (const log of logs) {
    if (!log.signature) continue;

    const imageBytes = Buffer.from(log.signature.split(',')[1], 'base64');
    const img = await pdfDoc.embedPng(imageBytes);
    const dims = img.scale(0.4);

    page.drawText(log.full_name, {
      x: 50,
      y: y + 40,
      size: 12,
      color: rgb(0, 0, 0)
    });

    page.drawImage(img, {
      x: 50,
      y: y,
      width: dims.width,
      height: dims.height,
    });

    y -= dims.height + 60;
  }

  const finalBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, finalBytes);
}








const getAssignedApprovals = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });

    const token = authHeader.split(' ')[1];
    const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const [rows] = await db.execute(`
      SELECT
        c.id,
        c.title,
        c.approval_status,
        d.name AS department_name
      FROM contents c
      JOIN content_approvers ca ON c.id = ca.content_id
      JOIN users u ON ca.user_id = u.id
      LEFT JOIN folders f ON c.folder_id = f.id
      LEFT JOIN departments d ON f.department_id = d.id
      WHERE u.id = ?
    `, [userId]);

    res.json({ status: 'success', data: rows });
  } catch (err) {
    console.error('getAssignedApprovals error:', err);
    res.status(500).json({ status: 'error', message: 'خطأ في جلب البيانات' });
  }
};

module.exports = {
  getUserPendingApprovals,
  handleApproval,
  getAssignedApprovals,
};


