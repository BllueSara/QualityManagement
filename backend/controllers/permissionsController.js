// controllers/permissionsController.js
const mysql = require('mysql2/promise');
require('dotenv').config();
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// جلب صلاحيات مستخدم
const getUserPermissions = async (req, res) => {
  const userId = req.params.id;
  try {
 const [rows] = await db.execute(
   `SELECT p.\`key\` AS permission
    FROM permissions p
    JOIN user_permissions up
      ON p.id = up.permission_id
    WHERE up.user_id = ?`,
   [userId]
 );

    const granted = rows.map(r => r.permission);
    return res.status(200).json({ status: 'success', data: granted });
  } catch (error) {
    console.error('خطأ في جلب صلاحيات المستخدم:', error);
    return res.status(500).json({ status: 'error', message: 'حدث خطأ في السيرفر' });
  }
};

// تحديث صلاحيات مستخدم
async function updateUserPermissions(req, res) {
  const userId = parseInt(req.params.id, 10);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ status:'error', message:'معرّف المستخدم غير صالح' });
  }

  // newPerms: { add_section: true, edit_section: false, ... }
  const newPerms = req.body;
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();
    // 1) احذف القديم
    await conn.execute('DELETE FROM user_permissions WHERE user_id = ?', [userId]);

    // 2) جهّز المفاتيح المفعّلة فقط
    const keys = Object
      .entries(newPerms)
      .filter(([_, enabled]) => enabled)
      .map(([key]) => key);

    if (keys.length) {
      // 3) أبنِ placeholders بناءً على عدد المفاتيح
      const placeholders = keys.map(() => '?').join(',');
      const sqlFetch = `SELECT id, \`key\` FROM permissions WHERE \`key\` IN (${placeholders})`;
      const [permsRows] = await conn.execute(sqlFetch, keys);

      // 4) جهّز مصفوفة الإضافات الوراثية [ [userId, permId], … ]
      const inserts = permsRows.map(p => {
        return [userId, p.id];
      });

      console.log('🔍 user_permissions inserts:', inserts);
      if (inserts.length) {
        await conn.query(
          'INSERT INTO user_permissions (user_id, permission_id) VALUES ?',
          [inserts]
        );
      }
    }

    await conn.commit();
    res.json({ status:'success', message:'تم تحديث الصلاحيات بنجاح' });

  } catch (err) {
    await conn.rollback();
    console.error('❌ updateUserPermissions error:', err);
    res.status(500).json({ status:'error', message:'حدث خطأ في السيرفر' });
  } finally {
    conn.release();
  }
}

// إضافة صلاحية واحدة
async function addUserPermission(req, res) {
  const userId = parseInt(req.params.id,10);
  const key    = req.params.key;
  try {
    // 1) احصل على permission_id
    const [[perm]] = await db.execute(
      'SELECT id FROM permissions WHERE `key` = ?',
      [key]
    );
    if (!perm) return res.status(404).json({ status:'error', message:'صلاحية غير موجودة' });

    // 2) أدخل في الجدول الوسيط (تجاهل الخطأ لو مسجّلة مسبقاً)
    await db.execute(
      'INSERT IGNORE INTO user_permissions (user_id, permission_id) VALUES (?,?)',
      [userId, perm.id]
    );
    res.json({ status:'success', message:'تم إضافة الصلاحية' });
  } catch (err) {
    console.error('❌ addUserPermission error:', err);
    res.status(500).json({ status:'error', message:'حدث خطأ في السيرفر' });
  }
}

// إزالة صلاحية واحدة
async function removeUserPermission(req, res) {
  const userId = parseInt(req.params.id,10);
  const key    = req.params.key;
  try {
    // جلب permission_id
    const [[perm]] = await db.execute(
      'SELECT id FROM permissions WHERE `key` = ?',
      [key]
    );
    if (!perm) return res.status(404).json({ status:'error', message:'صلاحية غير موجودة' });

    // احذف
    await db.execute(
      'DELETE FROM user_permissions WHERE user_id = ? AND permission_id = ?',
      [userId, perm.id]
    );
    res.json({ status:'success', message:'تم إزالة الصلاحية' });
  } catch (err) {
    console.error('❌ removeUserPermission error:', err);
    res.status(500).json({ status:'error', message:'حدث خطأ في السيرفر' });
  }
}

module.exports = {
  getUserPermissions,
  updateUserPermissions,
  addUserPermission,
  removeUserPermission
};
