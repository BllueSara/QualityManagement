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

 // 1) جلب كل المستخدمين
// controllers/usersController.js

const getUsers = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT 
         u.id,
         u.username AS name,
         u.email,
         u.role,
         u.department_id AS departmentId,
         d.name         AS departmentName
       FROM users u
       LEFT JOIN departments d
         ON u.department_id = d.id`
    );
    res.status(200).json(rows);
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
         d.name       AS departmentName
       FROM users u
       LEFT JOIN departments d 
         ON u.department_id = d.id
       WHERE u.id = ?`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ status:'error', message:'المستخدم غير موجود' });
    }
    // على سبيل المثال: { id, name, email, status, role, departmentId, departmentName }
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('خطأ في جلب المستخدم:', error);
    res.status(500).json({ status:'error', message:'حدث خطأ في السيرفر' });
  }
};

// 3) إضافة مستخدم جديد
const addUser = async (req, res) => {
  const { name, email, jobTitle, departmentId, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ status:'error', message:'جميع الحقول مطلوبة' });
  }
  try {
    // تشفير كلمة المرور
    const hashed = await bcrypt.hash(password, 12);
    const [result] = await db.execute(
      'INSERT INTO users (username, email, job_title, department_id, password, role) VALUES (?,?,?,?,?,?)',
      [name, email, jobTitle||null, departmentId||null, hashed, role]
    );
    res.status(201).json({ status:'success', userId: result.insertId });
  } catch (error) {
    console.error('خطأ في إضافة المستخدم:', error);
    res.status(500).json({ status:'error', message:'حدث خطأ في السيرفر' });
  }
};

// 4) تعديل مستخدم
const updateUser = async (req, res) => {
  const id = req.params.id;
  const { name, email, jobTitle, departmentId, role } = req.body;
  if (!name || !email || !role) {
    return res.status(400).json({ status:'error', message:'الحقول الأساسية مطلوبة' });
  }
  try {
    const [result] = await db.execute(
      'UPDATE users SET username=?, email=?, job_title=?, department_id=?, role=? WHERE id=?',
      [name, email, jobTitle||null, departmentId||null, role, id]
    );
    if (!result.affectedRows) return res.status(404).json({ status:'error', message:'المستخدم غير موجود' });
    res.status(200).json({ status:'success' });
  } catch (error) {
    console.error('خطأ في تعديل المستخدم:', error);
    res.status(500).json({ status:'error', message:'حدث خطأ في السيرفر' });
  }
};

// 5) حذف مستخدم
const deleteUser = async (req, res) => {
  const id = req.params.id;
  try {
    const [result] = await db.execute('DELETE FROM users WHERE id = ?', [id]);
    if (!result.affectedRows) return res.status(404).json({ status:'error', message:'المستخدم غير موجود' });
    res.status(200).json({ status:'success' });
  } catch (error) {
    console.error('خطأ في حذف المستخدم:', error);
    res.status(500).json({ status:'error', message:'حدث خطأ في السيرفر' });
  }
};

// 6) تغيير دور المستخدم
const changeUserRole = async (req, res) => {
  const id = req.params.id;
  const { role } = req.body;
  if (!role) return res.status(400).json({ status:'error', message:'الدور مطلوب' });
  try {
    await db.execute('UPDATE users SET role = ? WHERE id = ?', [role, id]);
    res.status(200).json({ status:'success' });
  } catch (error) {
    console.error('خطأ في تغيير الدور:', error);
    res.status(500).json({ status:'error', message:'حدث خطأ في السيرفر' });
  }
};

// 7) إعادة تعيين كلمة مرور (admin)
const adminResetPassword = async (req, res) => {
  const id = req.params.id;
  const { newPassword } = req.body;
  if (!newPassword) return res.status(400).json({ status:'error', message:'كلمة المرور مطلوبة' });
  try {
    const hashed = await bcrypt.hash(newPassword, 12);
    await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashed, id]);
    res.status(200).json({ status:'success' });
  } catch (error) {
    console.error('خطأ في إعادة التعيين:', error);
    res.status(500).json({ status:'error', message:'حدث خطأ في السيرفر' });
  }
};

// 8) جلب الأدوار المتاحة
const getRoles = async (req, res) => {
  // القيم كما حددت في الـ ENUM
  const roles = ['admin','sub-admin','user'];
  return res.status(200).json({ status:'success', data: roles });
};



module.exports = {
  getUsers,
  getUserById,
  addUser,
  updateUser,
  deleteUser,
  changeUserRole,
  adminResetPassword,
  getRoles       // صدّر الدالة
};
