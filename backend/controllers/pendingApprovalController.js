const mysql = require('mysql2/promise');


exports.getPendingApprovals = async (req, res) => {
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  
    try {
      const [rows] = await pool.execute(`
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
        GROUP BY c.id
      `);
  
      res.json({ status: 'success', data: rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ status: 'error', message: 'Internal Server Error' });
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

  
  
  
