// controllers/usersController.js
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'Quality'
});
const { logAction } = require('../models/logger');

// 1) جلب كل المستخدمين
const getUsers = async (req, res) => {
  const departmentId = req.query.departmentId;

  try {
    let query = `
      SELECT 
        u.id,
        u.username AS name,
        u.email,
        u.role,
        u.department_id AS departmentId,
        d.name AS departmentName,
        u.created_at,
        u.updated_at
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
    `;

    const params = [];

    if (departmentId) {
      query += ` WHERE u.department_id = ?`;
      params.push(departmentId);
    }

    query += ` ORDER BY u.created_at DESC`;

    const [rows] = await db.execute(query, params);

    res.status(200).json({
      status: 'success',
      data: rows
    });
  } catch (error) {
    console.error('خطأ في جلب المستخدمين:', error);
    res.status(500).json({ status:'error', message:'حدث خطأ في السيرفر' });
  }
};


// 2) جلب مستخدم محدد
const getUserById = async (req, res) => {
  const id = req.params.id;
  try {
    const [rows] = await db.execute(
      `SELECT 
         u.id,
         u.username AS name,
         u.email,
         u.role,
         u.department_id AS departmentId,
         d.name AS departmentName,
         u.created_at,
         u.updated_at
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.id = ?`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ status:'error', message:'المستخدم غير موجود' });
    }
    res.status(200).json({
      status: 'success',
      data: rows[0]
    });
  } catch (error) {
    console.error('خطأ في جلب المستخدم:', error);
    res.status(500).json({ status:'error', message:'حدث خطأ في السيرفر' });
  }
};

// 3) إضافة مستخدم جديد
const addUser = async (req, res) => {
  const { name, email, departmentId, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ status:'error', message:'جميع الحقول مطلوبة' });
  }

  try {
    // التحقق من عدم وجود البريد الإلكتروني
    const [existingUser] = await db.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUser.length > 0) {
      return res.status(409).json({ 
        status: 'error', 
        message: 'البريد الإلكتروني مستخدم بالفعل' 
      });
    }

    // تشفير كلمة المرور
    const hashed = await bcrypt.hash(password, 12);

    const [result] = await db.execute(
      `INSERT INTO users (
        username, 
        email, 
        department_id, 
        password, 
        role,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [name, email, departmentId || null, hashed, role]
    );

    res.status(201).json({ 
      status: 'success', 
      message: 'تم إضافة المستخدم بنجاح',
      userId: result.insertId 
    });
  } catch (error) {
    console.error('خطأ في إضافة المستخدم:', error);
    res.status(500).json({ status:'error', message:'حدث خطأ في السيرفر' });
  }
};

// 4) تعديل مستخدم
const updateUser = async (req, res) => {
  const id = req.params.id;
  const { name, email, departmentId, role } = req.body;

  if (!name || !email || !role) {
    return res.status(400).json({ status:'error', message:'الحقول الأساسية مطلوبة' });
  }

  try {
    // التحقق من عدم وجود البريد الإلكتروني مع مستخدم آخر
    const [existingUser] = await db.execute(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [email, id]
    );

    if (existingUser.length > 0) {
      return res.status(409).json({ 
        status: 'error', 
        message: 'البريد الإلكتروني مستخدم بالفعل' 
      });
    }

    const [result] = await db.execute(
      `UPDATE users 
       SET username = ?, 
           email = ?, 
           department_id = ?, 
           role = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, email, departmentId || null, role, id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ status:'error', message:'المستخدم غير موجود' });
    }

    res.status(200).json({ 
      status: 'success',
      message: 'تم تحديث بيانات المستخدم بنجاح'
    });
  } catch (error) {
    console.error('خطأ في تعديل المستخدم:', error);
    res.status(500).json({ status:'error', message:'حدث خطأ في السيرفر' });
  }
};

// 5) حذف مستخدم
const deleteUser = async (req, res) => {
  const id = req.params.id;
  try {
    // التحقق من وجود محتويات مرتبطة بالمستخدم
    const [relatedContents] = await db.execute(
      'SELECT COUNT(*) as count FROM contents WHERE created_by = ? OR approved_by = ?',
      [id, id]
    );

    if (relatedContents[0].count > 0) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'لا يمكن حذف المستخدم لوجود محتويات مرتبطة به' 
      });
    }

    const [result] = await db.execute('DELETE FROM users WHERE id = ?', [id]);
    
    if (!result.affectedRows) {
      return res.status(404).json({ status:'error', message:'المستخدم غير موجود' });
    }

    res.status(200).json({ 
      status: 'success',
      message: 'تم حذف المستخدم بنجاح'
    });
  } catch (error) {
    console.error('خطأ في حذف المستخدم:', error);
    res.status(500).json({ status:'error', message:'حدث خطأ في السيرفر' });
  }
};

// 6) تغيير دور المستخدم
const changeUserRole = async (req, res) => {
  const id = req.params.id;
  const { role } = req.body;

  if (!role) {
    return res.status(400).json({ status:'error', message:'الدور مطلوب' });
  }

  try {
    const [result] = await db.execute(
      'UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [role, id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ status:'error', message:'المستخدم غير موجود' });
    }

    res.status(200).json({ 
      status: 'success',
      message: 'تم تغيير دور المستخدم بنجاح'
    });
  } catch (error) {
    console.error('خطأ في تغيير الدور:', error);
    res.status(500).json({ status:'error', message:'حدث خطأ في السيرفر' });
  }
};

// 7) إعادة تعيين كلمة مرور (admin)
const adminResetPassword = async (req, res) => {
  const id = req.params.id;
  const { newPassword } = req.body;

  if (!newPassword) {
    return res.status(400).json({ status:'error', message:'كلمة المرور مطلوبة' });
  }

  try {
    const hashed = await bcrypt.hash(newPassword, 12);
    const [result] = await db.execute(
      'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashed, id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ status:'error', message:'المستخدم غير موجود' });
    }

    res.status(200).json({ 
      status: 'success',
      message: 'تم إعادة تعيين كلمة المرور بنجاح'
    });
  } catch (error) {
    console.error('خطأ في إعادة التعيين:', error);
    res.status(500).json({ status:'error', message:'حدث خطأ في السيرفر' });
  }
};

// 8) جلب الأدوار المتاحة
const getRoles = async (req, res) => {
  const roles = ['admin', 'sub-admin', 'user'];
  return res.status(200).json({ 
    status: 'success', 
    data: roles 
  });
};
const getLogs = async (req, res) => {
  try {
    const { from, to, action, user, search } = req.query;
    const conditions = [];
    const params = [];

    if (from) {
      conditions.push('al.created_at >= ?');
      params.push(from);
    }
    if (to) {
      conditions.push('al.created_at <= ?');
      params.push(to);
    }
    if (action) {
      conditions.push('al.action = ?');
      params.push(action);
    }
    if (user) {
      conditions.push('u.username = ?');
      params.push(user);
    }
    if (search) {
      conditions.push('(al.action LIKE ? OR al.description LIKE ? OR u.username LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT
        al.id,
        u.username AS user,
        al.action,
        al.description,
        al.reference_type,
        al.reference_id,
        al.created_at
      FROM activity_logs al
      LEFT JOIN users u ON u.id = al.user_id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT 500
    `;

    const [rows] = await db.execute(sql, params);
    res.status(200).json({ status: 'success', data: rows });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ status: 'error', message: 'حدث خطأ أثناء جلب السجلات' });
  }
};
const getNotifications = async (req, res) => {
  const userId = req.params.id;
  try {
    const [rows] = await db2.execute(
      'SELECT id, title, message, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    res.status(200).json({ status: 'success', data: rows });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ status: 'error', message: 'حدث خطأ أثناء جلب الإشعارات' });
  }
};

/**
 * Mark a notification as read
 */
const markAsRead = async (req, res) => {
  const notifId = req.params.id;
  try {
    const [result] = await db2.execute(
      'UPDATE notifications SET is_read = TRUE WHERE id = ?',
      [notifId]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ status: 'error', message: 'الإشعار غير موجود' });
    }
    res.status(200).json({ status: 'success', message: 'تم وسم الإشعار كمقروء' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ status: 'error', message: 'حدث خطأ أثناء تحديث الإشعار' });
  }
};


/**
 * Delete a notification
 */
const deleteNotification = async (req, res) => {
  const notifId = req.params.id;
  try {
    const [result] = await db2.execute(
      'DELETE FROM notifications WHERE id = ?',
      [notifId]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ status: 'error', message: 'الإشعار غير موجود' });
    }
    res.status(200).json({ status: 'success', message: 'تم حذف الإشعار' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ status: 'error', message: 'حدث خطأ أثناء حذف الإشعار' });
  }
};

module.exports = {
  getUsers,
  getUserById,
  addUser,
  updateUser,
  deleteUser,
  changeUserRole,
  adminResetPassword,
  getRoles,
  getLogs,
  getNotifications,
  markAsRead,
  deleteNotification
};
