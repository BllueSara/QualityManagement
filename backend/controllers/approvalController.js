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
  const { approved, notes } = req.body;

  try {
    // استخراج المستخدم من التوكن
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ status:'error', message:'لا يوجد توكن' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    const username = decoded.username;

    // جلب الـcontent الحالي و approvals_log و approvers_required
    const [contents] = await db.execute(
      `SELECT approvals_log, approvers_required FROM contents WHERE id = ?`,
      [contentId]
    );
    if (contents.length === 0) 
      return res.status(404).json({ status:'error', message:'المحتوى غير موجود' });

    let approvalsLog = JSON.parse(contents[0].approvals_log || '[]');
    const approversRequired = JSON.parse(contents[0].approvers_required || '[]');

    // إضافة أو تحديث سجل الاعتماد
    // إذا كان المستخدم موجود مسبقًا، نحدث الـlog، وإلا نضيف سجل جديد
    const existingIndex = approvalsLog.findIndex(l => l.user_id === userId);
    const entry = {
      user_id:  userId,
      username: username,
      approved: Boolean(approved),
      notes:    notes || '',
      timestamp: new Date().toISOString()
    };
    if (existingIndex >= 0) {
      approvalsLog[existingIndex] = entry;
    } else {
      approvalsLog.push(entry);
    }

    // حساب من وافق
    const approvedCount = approvalsLog.filter(l => l.approved).length;
    const isFullyApproved = approvedCount >= approversRequired.length;

    // تحديث جدول contents
    await db.execute(
      `UPDATE contents
         SET approvals_log   = ?,
             is_approved     = ?,
             approval_status = ?,
             approved_by     = ?,
             updated_at      = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        JSON.stringify(approvalsLog),
        isFullyApproved ? 1 : 0,
        isFullyApproved ? 'approved' : 'pending',
        isFullyApproved ? userId : null,
        contentId
      ]
    );

    res.status(200).json({
      status:'success',
      message: isFullyApproved 
        ? 'تم الاعتماد بالكامل' 
        : `تم وضع ${approved ? 'موافق' : 'مرفوض'} بنجاح`
    });
  } catch (err) {
    console.error('Error handleApproval:', err);
    res.status(500).json({ status:'error', message:'خطأ في السيرفر' });
  }
};

module.exports = {
  getUserPendingApprovals,
  handleApproval
};
