
// controllers/permissionsDefController.js
const mysql = require('mysql2/promise');
require('dotenv').config();
const { logAction } = require('../models/logger');

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'Quality'
});

// 1) جلب جميع التعريفات
const getPermissionsList = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT
         id,
         permission_key AS \`key\`,
         description
       FROM permissions
       ORDER BY permission_key`
    );

    return res.status(200).json({ status: 'success', data: rows });
  } catch (error) {
    console.error('خطأ في جلب التعريفات:', error);
    return res.status(500).json({ status: 'error', message: 'حدث خطأ في السيرفر' });
  }
};

// 2) إضافة تعريف جديد
const addPermissionDef = async (req, res) => {
  const { key, description } = req.body;
  if (!key || !description) {
    return res.status(400).json({ status: 'error', message: 'المفتاح والوصف مطلوبان' });
  }

  try {
    const [exists] = await db.execute(
      'SELECT id FROM permissions WHERE permission_key = ?',
      [key]
    );

    if (exists.length) {
      return res.status(409).json({ status: 'error', message: 'الصلاحية موجودة مسبقاً' });
    }

    const [result] = await db.execute(
      'INSERT INTO permissions (permission_key, description) VALUES (?, ?)',
      [key, description]
    );

    return res.status(201).json({ status: 'success', message: 'تم إضافة الصلاحية بنجاح', id: result.insertId });
  } catch (error) {
    console.error('خطأ في إضافة تعريف الصلاحية:', error);
    return res.status(500).json({ status: 'error', message: 'حدث خطأ في السيرفر' });
  }
};

// 3) تعديل تعريف
const updatePermissionDef = async (req, res) => {
  const { id } = req.params;
  const { key, description } = req.body;
  if (!key) {
    return res.status(400).json({ status: 'error', message: 'المفتاح مطلوب' });
  }

  try {
    const [exists] = await db.execute(
      'SELECT id FROM permissions WHERE permission_key = ? AND id != ?',
      [key, id]
    );

    if (exists.length) {
      return res.status(409).json({ status: 'error', message: 'الصلاحية موجودة مسبقاً' });
    }

    const [result] = await db.execute(
      'UPDATE permissions SET permission_key = ?, description = ? WHERE id = ?',
      [key, description, id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ status: 'error', message: 'الصلاحية غير موجودة' });
    }

    return res.status(200).json({ status: 'success', message: 'تم تحديث الصلاحية بنجاح' });
  } catch (error) {
    console.error('خطأ في تعديل تعريف الصلاحية:', error);
    return res.status(500).json({ status: 'error', message: 'حدث خطأ في السيرفر' });
  }
};

// 4) حذف تعريف
const deletePermissionDef = async (req, res) => {
  const { id } = req.params;

  try {
    const [related] = await db.execute(
      'SELECT COUNT(*) AS count FROM user_permissions WHERE permission_id = ?',
      [id]
    );

    if (related[0].count > 0) {
      return res.status(400).json({ status: 'error', message: 'لا يمكن حذف الصلاحية لوجود مستخدمين مرتبطين بها' });
    }

    const [result] = await db.execute(
      'DELETE FROM permissions WHERE id = ?',
      [id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ status: 'error', message: 'الصلاحية غير موجودة' });
    }

    return res.status(200).json({ status: 'success', message: 'تم حذف الصلاحية بنجاح' });
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
