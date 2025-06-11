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
  const { approved, notes, signature } = req.body;

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ status:'error', message:'لا يوجد توكن' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    // حفظ سجل التوقيع في جدول approval_logs
    await db.execute(`
      INSERT INTO approval_logs (content_id, approver_id, status, comments, signature)
      VALUES (?, ?, ?, ?, ?)
    `, [
      contentId,
      userId,
      approved ? 'approved' : 'rejected',
      notes || '',
      signature || null
    ]);

    // جلب المعتمدين لهذا المحتوى
    const [approvers] = await db.execute(
      `SELECT COUNT(DISTINCT user_id) AS total FROM content_approvers WHERE content_id = ?`,
      [contentId]
    );
    const totalApprovers = approvers[0].total;

    const [approvals] = await db.execute(
      `SELECT COUNT(*) AS approvedCount FROM approval_logs 
       WHERE content_id = ? AND status = 'approved'`,
      [contentId]
    );

    const approvedCount = approvals[0].approvedCount;
    const isFullyApproved = approvedCount >= totalApprovers;

    // تحديث جدول المحتوى
    await db.execute(`
      UPDATE contents
      SET 
        approval_status = ?,
        is_approved     = ?,
        approved_by     = ?,
        updated_at      = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      isFullyApproved ? 'approved' : 'pending',
      isFullyApproved ? 1 : 0,
      isFullyApproved ? userId : null,
      contentId
    ]);

    res.status(200).json({
      status: 'success',
      message: isFullyApproved 
        ? 'تم الاعتماد النهائي' 
        : `تم تسجيل ${approved ? 'موافقة' : 'رفض'}`
    });

  } catch (err) {
    console.error('Error handleApproval:', err);
    res.status(500).json({ status: 'error', message: 'فشل أثناء تنفيذ الاعتماد' });
  }
};







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


