// controllers/pendingApprovalsController.js
const mysql = require('mysql2/promise');
const jwt   = require('jsonwebtoken');
const { logAction } = require('../models/logger');
const { insertNotification } = require('../models/notfications-utils');

async function getUserPerms(pool, userId) {
  const [rows] = await pool.execute(`
    SELECT p.permission_key
    FROM permissions p
    JOIN user_permissions up ON up.permission_id = p.id
    WHERE up.user_id = ?
  `, [userId]);
  return new Set(rows.map(r => r.permission_key));
}

exports.getPendingApprovals = async (req, res) => {
  // 1) فكّ JWT
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ status:'error', message:'Unauthorized' });
  }
  let payload;
  try {
    payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ status:'error', message:'Invalid token' });
  }
  const userId   = payload.id;
  const userRole = payload.role;

  // 2) افتح الاتصال
  const pool = mysql.createPool({
    host:            process.env.DB_HOST,
    user:            process.env.DB_USER,
    password:        process.env.DB_PASSWORD,
    database:        process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit:       0
  });

  try {
    // 3) جلب صلاحيات المستخدم
    const permsSet = await getUserPerms(pool, userId);
    const canViewAll = userRole === 'admin' || permsSet.has('transfer_credits');

    let sql = `
      SELECT 
        c.id,
        c.title,
        c.approval_status,
        GROUP_CONCAT(u2.username SEPARATOR ', ') AS approvers,
        d.name AS department_name,
        u.username AS created_by
      FROM contents c
      JOIN folders f ON c.folder_id = f.id
      JOIN departments d ON f.department_id = d.id
      JOIN users u ON c.created_by = u.id
      LEFT JOIN content_approvers ca ON ca.content_id = c.id
      LEFT JOIN users u2 ON ca.user_id = u2.id
      WHERE c.approval_status = 'pending'
    `;
    const params = [];

    if (!canViewAll) {
      // لمشتركي transfer_credits فقط محتوياتهم
      sql += ` AND c.created_by = ?`;
      params.push(userId);
    }

    sql += `
      GROUP BY c.id
    `;

    const [rows] = await pool.execute(sql, params);
    return res.json({ status: 'success', data: rows });

  } catch (err) {
    console.error('Error in getPendingApprovals:', err);
    return res.status(500).json({ status:'error', message:'Internal Server Error' });
  } finally {
    await pool.end();
  }
};

  

exports.sendApprovalRequest = async (req, res) => {
  const { contentId, approvers } = req.body;
  if (!contentId || !Array.isArray(approvers) || approvers.length === 0) {
    return res.status(400).json({ status: 'error', message: 'البيانات غير صالحة' });
  }

  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
  });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) نحذف المعتمدين السابقين
    await conn.execute(`DELETE FROM content_approvers WHERE content_id = ?`, [contentId]);
    // ونحذف سجلات الموافقات القديمة
    await conn.execute(`DELETE FROM approval_logs WHERE content_id = ?`, [contentId]);

    // 2) ندخل المعتمدين الجدد
    for (const userId of approvers) {
      await conn.execute(
        `INSERT INTO content_approvers (content_id, user_id) VALUES (?, ?)`,
        [contentId, userId]
      );
      // ونسجّل لهم أيضاً سجلّ موافقة جديد
      await conn.execute(
        `INSERT INTO approval_logs
           (content_id, approver_id, status, comments, signed_as_proxy, delegated_by, created_at)
         VALUES (?, ?, 'pending', NULL, 0, NULL, CURRENT_TIMESTAMP)`,
        [contentId, userId]
      );
    }

    // 3) نحدّث حالة المحتوى
    await conn.execute(
      `UPDATE contents 
         SET approval_status      = 'pending', 
             approvers_required  = ?, 
             updated_at          = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [JSON.stringify(approvers), contentId]
    );

    await conn.commit();
    res.status(200).json({ status: 'success', message: 'تم الإرسال بنجاح' });
  } catch (err) {
    await conn.rollback();
    console.error('sendApprovalRequest Error:', err);
    res.status(500).json({ status: 'error', message: 'خطأ في إرسال الاعتماد' });
  } finally {
    conn.release();
    await pool.end();
  }
};

  
  
  
