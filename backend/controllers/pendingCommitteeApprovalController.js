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

    let params = [];

    // Query for committee contents only
    const committeeContentQuery = `
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
        JOIN committee_folders cf ON cc.folder_id = cf.id
        JOIN committees com ON cf.committee_id = com.id
        JOIN users u ON cc.created_by = u.id
        LEFT JOIN committee_content_approvers cca ON cca.content_id = cc.id
        LEFT JOIN users u2 ON cca.user_id = u2.id
        WHERE cc.approval_status = 'pending'
        ${!canViewAll ? `AND (EXISTS (SELECT 1 FROM committee_content_approvers WHERE content_id = cc.id AND user_id = ?) OR cc.created_by = ?)` : ''}
        GROUP BY cc.id
    `;

    if (!canViewAll) {
        params.push(userId, userId);
    }

    const [rows] = await pool.execute(committeeContentQuery, params);

    // Parse approvers_required JSON string into an array for easier frontend use
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

    return res.json({ status: 'success', data: rows });

  } catch (err) {
    res.status(500).json({ status: 'error', message: 'خطأ في جلب الموافقات المعلقة (محتوى اللجنة)' });
  } finally {
    await pool.end();
  }
};

exports.sendApprovalRequest = async (req, res) => {
  let { contentId, approvers } = req.body;

  // إذا كان contentId يحتوي على بادئة (مثل 'comm-' أو 'dept-')، قم بإزالتها للحصول على الرقم الأصلي
  if (typeof contentId === 'string' && contentId.includes('-')) {
    contentId = parseInt(contentId.split('-')[1], 10);
  }

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
    await conn.execute(`DELETE FROM committee_content_approvers WHERE content_id = ?`, [contentId]);
    // ونحذف سجلات الموافقات القديمة
    await conn.execute(`DELETE FROM committee_approval_logs WHERE content_id = ?`, [contentId]);

    // 2) ندخل المعتمدين الجدد
    for (const userId of approvers) {
      await conn.execute(
        `INSERT INTO committee_content_approvers (content_id, user_id, assigned_at) VALUES (?, ?, NOW())`,
        [contentId, userId]
      );
      // ونسجّل لهم أيضاً سجلّ موافقة جديد
      await conn.execute(
        `INSERT INTO committee_approval_logs
           (content_id, approver_id, status, comments, signed_as_proxy, delegated_by, created_at)
         VALUES (?, ?, 'pending', NULL, 0, NULL, CURRENT_TIMESTAMP)`,
        [contentId, userId]
      );
      // إشعار للمعتمد الجديد
      await insertNotification(
        userId,
        'تم تفويضك للتوقيع',
        `تم تفويضك للتوقيع على ملف لجنة جديد رقم ${contentId}`,
        'proxy'
      );
    }

    // 3) نحدّث حالة المحتوى
    await conn.execute(
      `UPDATE committee_contents 
         SET approval_status = 'pending', 
             approvers_required = ?, 
             updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [JSON.stringify(approvers), contentId]
    );

    await conn.commit();
    res.status(200).json({ status: 'success', message: 'تم الإرسال بنجاح' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ status: 'error', message: 'فشل إرسال طلب الاعتماد' });
  } finally {
    conn.release();
  }
};

exports.delegateCommitteeApproval = async (req, res) => {
    const { contentId, delegateTo, notes } = req.body;
    const auth = req.headers.authorization;

    if (!auth?.startsWith('Bearer ')) {
        return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }
    let payload;
    try {
        payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    } catch (err) {
        return res.status(401).json({ status: 'error', message: 'Invalid token' });
    }
    const currentUserId = payload.id;

    if (!contentId || !delegateTo) {
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

        // Mark the current approver as delegated in committee_approval_logs
        await conn.execute(
            `UPDATE committee_approval_logs
             SET status = 'delegated',
                 comments = ?,
                 delegated_by = ?
             WHERE content_id = ? AND approver_id = ?`,
            [notes, delegateTo, contentId, currentUserId]
        );

        // Add the new delegatee as a pending approver if they are not already listed
        await conn.execute(
            `INSERT INTO committee_content_approvers (content_id, user_id, assigned_at) VALUES (?, ?, NOW())
             ON DUPLICATE KEY UPDATE assigned_at = NOW()`,
            [contentId, delegateTo]
        );

        // Add a new pending approval log for the delegatee if not already there
        await conn.execute(
            `INSERT INTO committee_approval_logs (content_id, approver_id, status, created_at)
             VALUES (?, ?, 'pending', CURRENT_TIMESTAMP)
             ON DUPLICATE KEY UPDATE status = 'pending', created_at = CURRENT_TIMESTAMP`,
            [contentId, delegateTo]
        );

        await conn.commit();
        res.status(200).json({ status: 'success', message: 'تم تفويض الاعتماد بنجاح' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ status: 'error', message: 'فشل تفويض الاعتماد' });
    } finally {
        conn.release();
    }
}; 