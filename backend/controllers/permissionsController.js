// controllers/permissionsController.js
const mysql = require('mysql2/promise');
require('dotenv').config();

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'Quality'
});

// 1) جلب صلاحيات مستخدم
const getUserPermissions = async (req, res) => {
  const userId = req.params.id;
  try {
    const [rows] = await db.execute(
      `SELECT 
         p.id,
         p.key AS permission,
         p.description,
         up.created_at,
         up.updated_at
       FROM permissions p
       JOIN user_permissions up ON p.id = up.permission_id
       WHERE up.user_id = ?
       ORDER BY p.key`,
      [userId]
    );

    const permissions = rows.map(r => ({
      id: r.id,
      key: r.permission,
      description: r.description,
      created_at: r.created_at,
      updated_at: r.updated_at
    }));

    return res.status(200).json({ 
      status: 'success', 
      data: permissions 
    });
  } catch (error) {
    console.error('خطأ في جلب صلاحيات المستخدم:', error);
    return res.status(500).json({ 
      status: 'error', 
      message: 'حدث خطأ في السيرفر' 
    });
  }
};

// 2) تحديث صلاحيات مستخدم
const updateUserPermissions = async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'معرّف المستخدم غير صالح' 
    });
  }

  // newPerms: { add_section: true, edit_section: false, ... }
  const newPerms = req.body;
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // 1) احذف القديم
    await conn.execute(
      'DELETE FROM user_permissions WHERE user_id = ?',
      [userId]
    );

    // 2) جهّز المفاتيح المفعّلة فقط
    const keys = Object
      .entries(newPerms)
      .filter(([_, enabled]) => enabled)
      .map(([key]) => key);

    if (keys.length) {
      // 3) أبنِ placeholders بناءً على عدد المفاتيح
      const placeholders = keys.map(() => '?').join(',');
      const sqlFetch = `SELECT id, key FROM permissions WHERE key IN (${placeholders})`;
      const [permsRows] = await conn.execute(sqlFetch, keys);

      // 4) جهّز مصفوفة الإضافات
      const inserts = permsRows.map(p => {
        return [userId, p.id, new Date(), new Date()];
      });

      if (inserts.length) {
        await conn.query(
          `INSERT INTO user_permissions (
            user_id, 
            permission_id, 
            created_at, 
            updated_at
          ) VALUES ?`,
          [inserts]
        );
      }
    }

    await conn.commit();
    res.json({ 
      status: 'success', 
      message: 'تم تحديث الصلاحيات بنجاح' 
    });

  } catch (err) {
    await conn.rollback();
    console.error('❌ updateUserPermissions error:', err);
    res.status(500).json({ 
      status: 'error', 
      message: 'حدث خطأ في السيرفر' 
    });
  } finally {
    conn.release();
  }
};

// 3) إضافة صلاحية واحدة
const addUserPermission = async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const key = req.params.key;

  if (Number.isNaN(userId)) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'معرّف المستخدم غير صالح' 
    });
  }

  try {
    // 1) احصل على permission_id
    const [[perm]] = await db.execute(
      'SELECT id FROM permissions WHERE key = ?',
      [key]
    );

    if (!perm) {
      return res.status(404).json({ 
        status: 'error', 
        message: 'صلاحية غير موجودة' 
      });
    }

    // 2) أدخل في الجدول الوسيط
    await db.execute(
      `INSERT INTO user_permissions (
        user_id, 
        permission_id, 
        created_at, 
        updated_at
      ) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
      [userId, perm.id]
    );

    res.json({ 
      status: 'success', 
      message: 'تم إضافة الصلاحية' 
    });
  } catch (err) {
    console.error('❌ addUserPermission error:', err);
    res.status(500).json({ 
      status: 'error', 
      message: 'حدث خطأ في السيرفر' 
    });
  }
};

// 4) إزالة صلاحية واحدة
const removeUserPermission = async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const key = req.params.key;

  if (Number.isNaN(userId)) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'معرّف المستخدم غير صالح' 
    });
  }

  try {
    // جلب permission_id
    const [[perm]] = await db.execute(
      'SELECT id FROM permissions WHERE key = ?',
      [key]
    );

    if (!perm) {
      return res.status(404).json({ 
        status: 'error', 
        message: 'صلاحية غير موجودة' 
      });
    }

    // احذف
    const [result] = await db.execute(
      'DELETE FROM user_permissions WHERE user_id = ? AND permission_id = ?',
      [userId, perm.id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ 
        status: 'error', 
        message: 'الصلاحية غير ممنوحة للمستخدم' 
      });
    }

    res.json({ 
      status: 'success', 
      message: 'تم إزالة الصلاحية' 
    });
  } catch (err) {
    console.error('❌ removeUserPermission error:', err);
    res.status(500).json({ 
      status: 'error', 
      message: 'حدث خطأ في السيرفر' 
    });
  }
};

module.exports = {
  getUserPermissions,
  updateUserPermissions,
  addUserPermission,
  removeUserPermission
};
