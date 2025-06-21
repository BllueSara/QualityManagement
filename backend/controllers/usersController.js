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
const { insertNotification } = require('../models/notfications-utils');

function getUserLang(req) {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    try {
      const token = auth.slice(7);
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      return payload.lang || 'ar';
    } catch (err) {
      return 'ar';
    }
  }
  return 'ar';
}

function getLocalizedName(nameField, lang) {
  if (!nameField) return '';
  // Check if it's already a parsed object
  if (typeof nameField === 'object' && nameField !== null) {
    return nameField[lang] || nameField['ar'] || '';
  }
  if (typeof nameField === 'string') {
    try {
      // Try to parse it as JSON
      const nameObj = JSON.parse(nameField);
      return nameObj[lang] || nameObj['ar'] || nameField;
    } catch (e) {
      // If parsing fails, return the original string
      return nameField;
    }
  }
  // For any other type, convert to string and return
  return String(nameField);
}

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
    res.status(500).json({ message: 'خطأ في جلب المستخدمين' });
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
    res.status(500).json({ message: 'خطأ في جلب المستخدم' });
  }
};

// 3) إضافة مستخدم جديد
const addUser = async (req, res) => {
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
  const adminUserId = payload.id;
  const userLang = getUserLang(req);

  const { name, email, departmentId, password, role, employeeNumber } = req.body;
  console.log('🪵 بيانات قادمة:', req.body);

  if (!name || !email || !password || !role) {
    return res.status(400).json({ status: 'error', message: 'جميع الحقول مطلوبة' });
  }

  try {
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

    // Fetch department details for logging
    let departmentName = null;
    if (departmentId) {
      const [[deptDetails]] = await db.execute(
        'SELECT name FROM departments WHERE id = ?',
        [departmentId]
      );
      departmentName = deptDetails ? deptDetails.name : null;
    }

    const hashed = await bcrypt.hash(password, 12);
    const cleanDeptId = departmentId && departmentId !== '' ? departmentId : null;

    const [result] = await db.execute(
  `INSERT INTO users (
    username, 
    email, 
    department_id, 
    password, 
    role,
    employee_number,
    created_at,
    updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
  [name, email, cleanDeptId, hashed, role, employeeNumber]
);

    // Add to logs
    const localizedDeptName = getLocalizedName(departmentName, userLang);
    const logMessage = userLang === 'en' 
      ? `Added new user: '${name}' (${email}) with role '${role}'${departmentName ? ` in department '${localizedDeptName}'` : ''}`
      : `أضاف مستخدم جديد: '${name}' (${email}) بدور '${role}'${departmentName ? ` في القسم '${localizedDeptName}'` : ''}`;
    await logAction(adminUserId, 'add_user', logMessage, 'user', result.insertId);

    res.status(201).json({
      status: 'success',
      message: 'تم إضافة المستخدم بنجاح',
      userId: result.insertId
    });
  } catch (error) {
    console.error('❌ Error in addUser:', error);
    res.status(500).json({ message: 'خطأ في إضافة المستخدم' });
  }
};

// 4) تعديل مستخدم
const updateUser = async (req, res) => {
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
  const adminUserId = payload.id;
  const userLang = getUserLang(req);

  const id = req.params.id;
  const { name, email, departmentId, role } = req.body;

  if (!name || !email || !role) {
    return res.status(400).json({ status:'error', message:'الحقول الأساسية مطلوبة' });
  }

  try {
    // Fetch old user details for logging
    const [[oldUser]] = await db.execute(
      `SELECT u.username, u.email, u.role, u.department_id, d.name as department_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.id = ?`,
      [id]
    );

    if (!oldUser) {
      return res.status(404).json({ status:'error', message:'المستخدم غير موجود' });
    }

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

    // Fetch new department details for logging
    let newDepartmentName = null;
    if (departmentId) {
      const [[deptDetails]] = await db.execute(
        'SELECT name FROM departments WHERE id = ?',
        [departmentId]
      );
      newDepartmentName = deptDetails ? deptDetails.name : null;
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

    // Add to logs
    const changes = [];
    if (name !== oldUser.username) {
      changes.push(userLang === 'en' 
        ? `name: '${oldUser.username}' → '${name}'`
        : `الاسم: '${oldUser.username}' → '${name}'`);
    }
    if (email !== oldUser.email) {
      changes.push(userLang === 'en' 
        ? `email: '${oldUser.email}' → '${email}'`
        : `البريد الإلكتروني: '${oldUser.email}' → '${email}'`);
    }
    if (role !== oldUser.role) {
      changes.push(userLang === 'en' 
        ? `role: '${oldUser.role}' → '${role}'`
        : `الدور: '${oldUser.role}' → '${role}'`);
    }
    if (departmentId !== oldUser.department_id) {
      const oldDeptName = getLocalizedName(oldUser.department_name, userLang);
      const newDeptName = getLocalizedName(newDepartmentName, userLang);
      changes.push(userLang === 'en' 
        ? `department: '${oldDeptName || 'None'}' → '${newDeptName || 'None'}'`
        : `القسم: '${oldDeptName || 'لا يوجد'}' → '${newDeptName || 'لا يوجد'}'`);
    }

    let logMessage;
    if (changes.length > 0) {
      logMessage = userLang === 'en' 
        ? `Updated user '${oldUser.username}': ${changes.join(', ')}`
        : `حدث المستخدم '${oldUser.username}': ${changes.join(', ')}`;
    } else {
      logMessage = userLang === 'en' 
        ? `Updated user '${oldUser.username}' (no changes)`
        : `حدث المستخدم '${oldUser.username}' (لا توجد تغييرات)`;
    }
    
    await logAction(adminUserId, 'update_user', logMessage, 'user', id);

    res.status(200).json({ 
      status: 'success',
      message: 'تم تحديث بيانات المستخدم بنجاح'
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في تعديل المستخدم' });
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

    // 8) تحويل سجلات النشاط (activity_logs) لحقل user_id إلى NULL
    await conn.execute(
      `UPDATE activity_logs
         SET user_id = NULL
       WHERE user_id = ?`,
      [userId]
    );

    // 9) حذف صلاحيات المستخدم (user_permissions) — مُعرَّفة بـ ON DELETE CASCADE،
    //    ولكن نضمن عبر حذف المستخدم نفسه لاحقًا

    // 10) حذف إشعارات المستخدم (notifications) — أيضاً CASCADE

    // 11) حذف المستخدم نفسه
    const [delResult] = await conn.execute(
      `DELETE FROM users WHERE id = ?`,
      [userId]
    );
    if (delResult.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({
        status: 'error',
        message: 'المستخدم غير موجود'
      });
    }

    const [result] = await db.execute('DELETE FROM users WHERE id = ?', [id]);
    
    if (!result.affectedRows) {
      return res.status(404).json({ status:'error', message:'المستخدم غير موجود' });
    }

    res.status(200).json({ 
      status: 'success',
      message: 'تم حذف المستخدم وجميع السجلات المرتبطة به بنجاح'
    });

  } catch (error) {
    if (conn) await conn.rollback();
    console.error('deleteUser error:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'فشل حذف المستخدم'
    });
  } finally {
    if (conn) conn.release();
  }
};


// 6) تغيير دور المستخدم
const changeUserRole = async (req, res) => {
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
  const adminUserId = payload.id;
  const userLang = getUserLang(req);

  const id = req.params.id;
  const { role } = req.body;

  if (!role) {
    return res.status(400).json({ status:'error', message:'الدور مطلوب' });
  }

  try {
    // Fetch user details for logging
    const [[userDetails]] = await db.execute(
      'SELECT username, role as old_role FROM users WHERE id = ?',
      [id]
    );

    if (!userDetails) {
      return res.status(404).json({ status:'error', message:'المستخدم غير موجود' });
    }

    const [result] = await db.execute(
      'UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [role, id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ status:'error', message:'المستخدم غير موجود' });
    }

    // Add to logs
    const logMessage = userLang === 'en' 
      ? `Changed user role for '${userDetails.username}': '${userDetails.old_role}' → '${role}'`
      : `غير دور المستخدم '${userDetails.username}': '${userDetails.old_role}' → '${role}'`;
    await logAction(adminUserId, 'change_user_role', logMessage, 'user', id);

    res.status(200).json({ 
      status: 'success',
      message: 'تم تغيير دور المستخدم بنجاح'
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في تغيير الدور' });
  }
};

// 7) إعادة تعيين كلمة مرور (admin)
const adminResetPassword = async (req, res) => {
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
  const adminUserId = payload.id;
  const userLang = getUserLang(req);

  const id = req.params.id;
  const { newPassword } = req.body;

  if (!newPassword) {
    return res.status(400).json({ status:'error', message:'كلمة المرور مطلوبة' });
  }

  try {
    // Fetch user details for logging
    const [[userDetails]] = await db.execute(
      'SELECT username FROM users WHERE id = ?',
      [id]
    );

    if (!userDetails) {
      return res.status(404).json({ status:'error', message:'المستخدم غير موجود' });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    const [result] = await db.execute(
      'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashed, id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ status:'error', message:'المستخدم غير موجود' });
    }

    // Add to logs
    const logMessage = userLang === 'en' 
      ? `Reset password for user: '${userDetails.username}'`
      : `أعاد تعيين كلمة المرور للمستخدم: '${userDetails.username}'`;
    await logAction(adminUserId, 'reset_user_password', logMessage, 'user', id);

    res.status(200).json({ 
      status: 'success',
      message: 'تم إعادة تعيين كلمة المرور بنجاح'
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في إعادة التعيين' });
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
    res.status(500).json({ message: 'Error fetching logs' });
  }
};

const getNotifications = async (req, res) => {
  const userId = req.params.id;

  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'Missing token' });

    let payload;
    try {
      payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    } catch {
      return res.status(400).json({ status: 'error', message: 'توكن غير صالح' });
    }

    const isAdmin = payload.role === 'admin';

const query = isAdmin
  ? `
    SELECT 
      n.id,
      n.user_id,
      u.username AS user_name,
      n.title,
      n.message,
      n.is_read,
      n.created_at,
      n.type
    FROM notifications n
    LEFT JOIN users u ON u.id = n.user_id
    ORDER BY n.created_at DESC
  `
  : `
    SELECT 
      n.id,
      n.user_id,
      u.username AS user_name,
      n.title,
      n.message,
      n.is_read,
      n.created_at,
      n.type
    FROM notifications n
    LEFT JOIN users u ON u.id = n.user_id
    WHERE n.user_id = ?
    ORDER BY n.created_at DESC
  `;


    const [rows] = await db.execute(query, isAdmin ? [] : [userId]);

    return res.status(200).json({ status: 'success', data: rows });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching notifications' });
  }
};




/**
 * Mark a notification as read
 */



/**
 * Delete a notification
 */
const deleteNotification = async (req, res) => {
  const notifId = req.params.id;
  try {
    const [result] = await db.execute(
      'DELETE FROM notifications WHERE id = ?',
      [notifId]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ status: 'error', message: 'الإشعار غير موجود' });
    }
    res.status(200).json({ status: 'success', message: 'تم حذف الإشعار' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting notification' });
  }
};
// controllers/usersController.js
const markAllAsRead = async (req, res) => {
  const userId = req.params.id;

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'غير مصرح' });
  }

  let decoded;
  try {
    decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'توكن غير صالح' });
  }

  const isAdmin = decoded.role === 'admin';

  try {
    await db.execute(
      isAdmin
        ? `UPDATE notifications SET is_read = 1 WHERE is_read = 0`
        : `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`,
      isAdmin ? [] : [userId]
    );

    res.status(200).json({ status: 'success', message: 'تم تحديث الإشعارات كمقروءة.' });
  } catch (err) {
    res.status(500).json({ message: 'Error marking as read' });
  }
};
// GET /api/users/:id/notifications/unread-count
const getUnreadCount = async (req, res) => {
  const userId = req.params.id;

  // استخرج الدور من التوكن
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'غير مصرح' });
  }

  let decoded;
  try {
    decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'توكن غير صالح' });
  }

  const isAdmin = decoded.role === 'admin';

  try {
    const [rows] = await db.execute(
      isAdmin
        ? 'SELECT COUNT(*) AS count FROM notifications WHERE is_read = 0'
        : 'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0',
      isAdmin ? [] : [userId]
    );
    res.status(200).json({ count: rows[0].count });
  } catch (err) {
    res.status(500).json({ message: 'Error getting unread count' });
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
  deleteNotification,
  markAllAsRead,
  getUnreadCount
};
