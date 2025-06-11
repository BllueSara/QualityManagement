// controllers/permissionsDefController.js
const mysql = require('mysql2/promise');
require('dotenv').config();

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// جلب جميع التعريفات
const getPermissionsList = async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT id, `key`, description FROM permissions');
    return res.status(200).json({ status: 'success', data: rows });
  } catch (error) {
    console.error('خطأ في جلب التعريفات:', error);
    return res.status(500).json({ status: 'error', message: 'حدث خطأ في السيرفر' });
  }
};

// إضافة تعريف جديد
const addPermissionDef = async (req, res) => {
  const { key, description } = req.body;
  if (!key || !description) {
    return res.status(400).json({ status: 'error', message: 'المفتاح والوصف مطلوبان' });
  }
  try {
    const [exists] = await db.execute('SELECT id FROM permissions WHERE `key` = ?', [key]);
    if (exists.length) {
      return res.status(409).json({ status: 'error', message: 'الصلاحية موجودة مسبقاً' });
    }
    const [result] = await db.execute(
      'INSERT INTO permissions (`key`, description) VALUES (?, ?)',
      [key, description]
    );
    return res.status(201).json({ status: 'success', id: result.insertId });
  } catch (error) {
    console.error('خطأ في إضافة تعريف الصلاحية:', error);
    return res.status(500).json({ status: 'error', message: 'حدث خطأ في السيرفر' });
  }
};

// تعديل تعريف
const updatePermissionDef = async (req, res) => {
  const { id } = req.params;
  const { key, description } = req.body;
  if (!key) {
    return res.status(400).json({ status: 'error', message: 'المفتاح مطلوب' });
  }
  try {
    const params = [key, description, id];
    const [result] = await db.execute(
      'UPDATE permissions SET `key` = ?, description = ? WHERE id = ?',
      params
    );
    if (!result.affectedRows) {
      return res.status(404).json({ status: 'error', message: 'الصلاحية غير موجودة' });
    }
    return res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('خطأ في تعديل تعريف الصلاحية:', error);
    return res.status(500).json({ status: 'error', message: 'حدث خطأ في السيرفر' });
  }
};

// حذف تعريف
const deletePermissionDef = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.execute('DELETE FROM permissions WHERE id = ?', [id]);
    if (!result.affectedRows) {
      return res.status(404).json({ status: 'error', message: 'الصلاحية غير موجودة' });
    }
    return res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('خطأ في حذف تعريف الصلاحية:', error);
    return res.status(500).json({ status: 'error', message: 'حدث خطأ في السيرفر' });
  }
};

module.exports = {
  getPermissionsList,
  addPermissionDef,
  updatePermissionDef,
  deletePermissionDef
};