// controllers/permissionsController.js
const mysql = require('mysql2/promise');
require('dotenv').config();
const { logAction } = require('../models/logger');
const { insertNotification } = require('../models/notfications-utils');

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'Quality'
});

// 1) جلب صلاحيات مستخدم
const getUserPermissions = async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ status: 'error', message: 'معرّف المستخدم غير صالح' });
  }

  try {
    const [rows] = await db.execute(
      `SELECT
         p.id,
         p.permission_key AS permission,
         p.description
       FROM permissions p
       JOIN user_permissions up ON p.id = up.permission_id
       WHERE up.user_id = ?
       ORDER BY p.permission_key`,
      [userId]
    );

   const keys = rows.map(r => r.permission);
    return res.status(200).json({ status: 'success', data: keys });
  } catch (error) {
    console.error('خطأ في جلب صلاحيات المستخدم:', error);
    return res.status(500).json({ status: 'error', message: 'حدث خطأ في السيرفر' });
  }
};

// 2) تحديث صلاحيات مستخدم
const updateUserPermissions = async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ status: 'error', message: 'معرّف المستخدم غير صالح' });
  }

  const newPerms = req.body;
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // حذف القديم
    await conn.execute('DELETE FROM user_permissions WHERE user_id = ?', [userId]);

    const keys = Object.keys(newPerms).filter(k => newPerms[k]);
    if (keys.length) {
      const placeholders = keys.map(() => '?').join(',');
      const sqlFetch = `SELECT id FROM permissions WHERE permission_key IN (${placeholders})`;
      const [permsRows] = await conn.execute(sqlFetch, keys);

      const inserts = permsRows.map(p => [userId, p.id]);
      if (inserts.length) {
        await conn.query(
          'INSERT INTO user_permissions (user_id, permission_id) VALUES ?',
          [inserts]
        );
      }
    }

    await conn.commit();
    return res.json({ status: 'success', message: 'تم تحديث الصلاحيات بنجاح' });
  } catch (error) {
    await conn.rollback();
    console.error('❌ updateUserPermissions error:', error);
    return res.status(500).json({ status: 'error', message: 'حدث خطأ في السيرفر' });
  } finally {
    conn.release();
  }
};

// 3) إضافة صلاحية واحدة
const addUserPermission = async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const key    = req.params.key;

  if (Number.isNaN(userId)) {
    return res.status(400).json({ status: 'error', message: 'معرّف المستخدم غير صالح' });
  }

  try {
    const [[perm]] = await db.execute(
      'SELECT id FROM permissions WHERE permission_key = ?',
      [key]
    );

    if (!perm) {
      return res.status(404).json({ status: 'error', message: 'صلاحية غير موجودة' });
    }

    await db.execute(
      'INSERT IGNORE INTO user_permissions (user_id, permission_id) VALUES (?, ?)',
      [userId, perm.id]
    );

    return res.json({ status: 'success', message: 'تم إضافة الصلاحية' });
  } catch (error) {
    console.error('❌ addUserPermission error:', error);
    return res.status(500).json({ status: 'error', message: 'حدث خطأ في السيرفر' });
  }
};

// 4) إزالة صلاحية واحدة
const removeUserPermission = async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const key    = req.params.key;

  if (Number.isNaN(userId)) {
    return res.status(400).json({ status: 'error', message: 'معرّف المستخدم غير صالح' });
  }

  try {
    const [[perm]] = await db.execute(
      'SELECT id FROM permissions WHERE permission_key = ?',
      [key]
    );

    if (!perm) {
      return res.status(404).json({ status: 'error', message: 'صلاحية غير موجودة' });
    }

    const [result] = await db.execute(
      'DELETE FROM user_permissions WHERE user_id = ? AND permission_id = ?',
      [userId, perm.id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ status: 'error', message: 'لم تُمنح هذه الصلاحية للمستخدم' });
    }

    return res.json({ status: 'success', message: 'تم إزالة الصلاحية' });
  } catch (error) {
    console.error('❌ removeUserPermission error:', error);
    return res.status(500).json({ status: 'error', message: 'حدث خطأ في السيرفر' });
  }
};

module.exports = {
  getUserPermissions,
  updateUserPermissions,
  addUserPermission,
  removeUserPermission
};
