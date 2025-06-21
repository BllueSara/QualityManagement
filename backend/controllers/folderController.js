// backend/controllers/folderController.js
const mysql = require('mysql2/promise');
const jwt   = require('jsonwebtoken');
require('dotenv').config();

const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
const { logAction } = require('../models/logger');
const { insertNotification } = require('../models/notfications-utils');

// دالة مساعدة لاستخراج اسم القسم باللغة المناسبة
function getDepartmentNameByLanguage(departmentNameData, userLanguage = 'ar') {
    try {
        // إذا كان الاسم JSON يحتوي على اللغتين
        if (typeof departmentNameData === 'string' && departmentNameData.startsWith('{')) {
            const parsed = JSON.parse(departmentNameData);
            return parsed[userLanguage] || parsed['ar'] || departmentNameData;
        }
        // إذا كان نص عادي
        return departmentNameData || 'غير معروف';
    } catch (error) {
        // في حالة فشل التحليل، إرجاع النص كما هو
        return departmentNameData || 'غير معروف';
    }
}

// دالة مساعدة لاستخراج لغة المستخدم من التوكن
function getUserLanguageFromToken(token) {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return decoded.language || 'ar'; // افتراضي عربي
    } catch (error) {
        return 'ar'; // افتراضي عربي
    }
}

/**
 * GET /api/departments/:departmentId/folders
 */
const getFolders = async (req, res) => {
  try {
    // مصادقة
    const h = req.headers.authorization;
    if (!h?.startsWith('Bearer ')) 
      return res.status(401).json({ message: 'غير مصرح.' });
    let decoded;
    try { decoded = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET); }
    catch { return res.status(401).json({ message: 'توكن غير صالح.' }); }

    // نقرأ departmentId من params
    const departmentId = req.params.departmentId;
    if (!departmentId) 
      return res.status(400).json({ message: 'معرف القسم مطلوب.' });

    const conn = await pool.getConnection();

    // تحقق من وجود القسم
    const [dept] = await conn.execute(
      'SELECT id, name FROM departments WHERE id = ?', 
      [departmentId]
    );
    if (!dept.length) {
      conn.release();
      return res.status(404).json({ message: 'القسم غير موجود.' });
    }

    // جلب المجلدات
    const [folders] = await conn.execute(
      `SELECT f.id, f.name, f.created_at, u.username AS created_by
       FROM folders f
       LEFT JOIN users u ON u.id = f.created_by
       WHERE f.department_id = ?
       ORDER BY f.created_at DESC`,
      [departmentId]
    );

    conn.release();
    return res.json({
      message: 'تم جلب المجلدات بنجاح',
      department: { id: dept[0].id, name: dept[0].name },
      data: folders
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'خطأ في الخادم.' });
  }
};

/**
 * POST /api/departments/:departmentId/folders
 */
const createFolder = async (req, res) => {
  try {
    // مصادقة
    const h = req.headers.authorization;
    if (!h?.startsWith('Bearer ')) 
      return res.status(401).json({ message: 'غير مصرح.' });
    let decoded;
    try { decoded = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET); }
    catch { return res.status(401).json({ message: 'توكن غير صالح.' }); }

    // اقرأ departmentId من params
    const departmentId = req.params.departmentId;
    const { name }     = req.body;
    if (!departmentId || !name) 
      return res.status(400).json({ message: 'معرف القسم واسم المجلد مطلوبان.' });

    const conn = await pool.getConnection();

    // تحقق من القسم
    const [dept] = await conn.execute(
      'SELECT id, name FROM departments WHERE id = ?', 
      [departmentId]
    );
    if (!dept.length) {
      conn.release();
      return res.status(404).json({ message: 'القسم غير موجود.' });
    }

    // جلب اسم القسم باللغة المناسبة
    const userLanguage = getUserLanguageFromToken(h.split(' ')[1]);
    const departmentName = getDepartmentNameByLanguage(dept[0].name, userLanguage);

    // تحقق عدم التكرار
    const [exists] = await conn.execute(
      'SELECT id FROM folders WHERE department_id = ? AND name = ?',
      [departmentId, name]
    );
    if (exists.length) {
      conn.release();
      return res.status(409).json({ message: 'المجلد موجود بالفعل.' });
    }

    // إضافة المجلد
    const [result] = await conn.execute(
      `INSERT INTO folders 
         (name, department_id, created_by, created_at, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [name, departmentId, decoded.id]
    );

    conn.release();
    
    // ✅ تسجيل اللوق بعد نجاح إضافة المجلد
    try {
      const logDescription = `تم إنشاء مجلد باسم: ${name} في قسم: ${departmentName}`;
      await logAction(decoded.id, 'create_folder', logDescription, 'folder', result.insertId);
    } catch (logErr) {
      console.error('logAction error:', logErr);
    }
    
    await insertNotification(
      decoded.id,
      'مجلد جديد',
      `تم إنشاء مجلد جديد باسم "${name}" في القسم`,
      'add'
    );
    return res.status(201).json({
      message: 'تم إضافة المجلد بنجاح',
      folderId: result.insertId
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'خطأ في الخادم.' });
  }
};

/**
 * PUT /api/folders/:folderId
 */
const updateFolder = async (req, res) => {
  try {
    const h = req.headers.authorization;
    if (!h?.startsWith('Bearer ')) 
      return res.status(401).json({ message: 'غير مصرح.' });
    let decoded;
    try {
      decoded = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'توكن غير صالح.' });
    }

    const folderId = req.params.folderId;
    const { name } = req.body;

    if (!folderId || !name)
      return res.status(400).json({ message: 'معرف المجلد والاسم مطلوبان.' });

    const conn = await pool.getConnection();

    // جلب المجلد القديم مع اسم القسم
    const [rows] = await conn.execute(
      'SELECT f.*, d.name as department_name FROM folders f JOIN departments d ON f.department_id = d.id WHERE f.id = ?', 
      [folderId]
    );
    if (!rows.length) {
      conn.release();
      return res.status(404).json({ message: 'المجلد غير موجود.' });
    }

    const oldName = rows[0].name;
    const departmentId = rows[0].department_id;

    // جلب اسم القسم باللغة المناسبة
    const userLanguage = getUserLanguageFromToken(h.split(' ')[1]);
    const departmentName = getDepartmentNameByLanguage(rows[0].department_name, userLanguage);

    await conn.execute(
      `UPDATE folders 
       SET name = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [name, folderId]
    );

    conn.release();
    
    // ✅ تسجيل اللوق بعد نجاح تعديل المجلد
    try {
      const logDescription = `تم تعديل مجلد من: ${oldName} إلى: ${name} في قسم: ${departmentName}`;
      await logAction(decoded.id, 'update_folder', logDescription, 'folder', folderId);
    } catch (logErr) {
      console.error('logAction error:', logErr);
    }

    res.json({ message: 'تم تحديث اسم المجلد بنجاح.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ أثناء تعديل المجلد.' });
  }
};

const getFolderById = async (req, res) => {
  try {
    const folderId = req.params.folderId;
    if (!folderId)
      return res.status(400).json({ message: 'معرف المجلد مطلوب.' });

    const conn = await pool.getConnection();

    const [rows] = await conn.execute(
      `SELECT 
         f.id, f.name AS title, f.department_id, f.created_at, f.updated_at,
         u.username AS created_by_username,
         d.name AS department_name
       FROM folders f
       LEFT JOIN users u ON f.created_by = u.id
       LEFT JOIN departments d ON f.department_id = d.id
       WHERE f.id = ?`,
      [folderId]
    );

    conn.release();

    if (!rows.length)
      return res.status(404).json({ message: 'المجلد غير موجود.' });

    res.json({ status: 'success', data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'حدث خطأ في الخادم أثناء جلب المجلد.' });
  }
};


const deleteFolder = async (req, res) => {
  try {
    const h = req.headers.authorization;
    if (!h?.startsWith('Bearer ')) 
      return res.status(401).json({ message: 'غير مصرح.' });
    let decoded;
    try {
      decoded = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'توكن غير صالح.' });
    }

    const folderId = req.params.folderId;
    if (!folderId) 
      return res.status(400).json({ message: 'معرف المجلد مطلوب.' });

    const conn = await pool.getConnection();

    // تحقق من وجود المجلد مع اسم القسم
    const [folder] = await conn.execute(
      'SELECT f.*, d.name as department_name FROM folders f JOIN departments d ON f.department_id = d.id WHERE f.id = ?', 
      [folderId]
    );
    if (!folder.length) {
      conn.release();
      return res.status(404).json({ message: 'المجلد غير موجود.' });
    }

    const folderName = folder[0].name;
    
    // جلب اسم القسم باللغة المناسبة
    const userLanguage = getUserLanguageFromToken(h.split(' ')[1]);
    const departmentName = getDepartmentNameByLanguage(folder[0].department_name, userLanguage);

    // حذف كل المحتويات المرتبطة أولاً
    await conn.execute('DELETE FROM contents WHERE folder_id = ?', [folderId]);

    // ثم حذف المجلد
    await conn.execute('DELETE FROM folders WHERE id = ?', [folderId]);

    conn.release();
    
    // ✅ تسجيل اللوق بعد نجاح حذف المجلد
    try {
      const logDescription = `تم حذف مجلد: ${folderName} من قسم: ${departmentName}`;
      await logAction(decoded.id, 'delete_folder', logDescription, 'folder', folderId);
    } catch (logErr) {
      console.error('logAction error:', logErr);
    }

    return res.json({ message: 'تم حذف المجلد بنجاح.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'حدث خطأ في الخادم أثناء حذف المجلد.' });
  }
};
const getFolderNames = async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.execute('SELECT id, name FROM folder_names ORDER BY name ASC');
    conn.release();
    return res.json({ status: 'success', data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'فشل جلب أسماء المجلدات.' });
  }
};
const addFolderName = async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'الاسم مطلوب.' });
  }

  try {
    const conn = await pool.getConnection();
    const [result] = await conn.execute(
      'INSERT INTO folder_names (name) VALUES (?)',
      [name]
    );
    
    // ✅ تسجيل اللوق بعد نجاح إضافة اسم المجلد
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id;
      
      try {
        await logAction(
          userId,
          'add_folder_name',
          `تمت إضافة اسم مجلد جديد للأقسام: ${name}`,
          'folder_name',
          result.insertId
        );
      } catch (logErr) {
        console.error('logAction error:', logErr);
      }
    }
    
    conn.release();

    return res.status(201).json({
      status: 'success',
      message: '✅ تم إضافة المجلد بنجاح',
      folderId: result.insertId
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: '❌ فشل في إضافة المجلد.' });
  }
};
const updateFolderName = async (req, res) => {
  const { id }   = req.params;
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'الاسم الجديد مطلوب.' });

  const conn = await pool.getConnection();
  try {
    // 1) جيب الاسم القديم
    const [rows] = await conn.execute(
      'SELECT name FROM folder_names WHERE id = ?',
      [id]
    );
    if (!rows.length) {
      conn.release();
      return res.status(404).json({ message: '❌ لم يتم العثور على اسم المجلد.' });
    }
    const oldName = rows[0].name;

    // 2) حدّث اسم الـ folder_names
    const [result] = await conn.execute(
      'UPDATE folder_names SET name = ? WHERE id = ?',
      [name, id]
    );
    if (result.affectedRows === 0) {
      conn.release();
      return res.status(404).json({ message: '❌ لم يتم تحديث اسم المجلد.' });
    }

    // 3) حدّث أسماء المجلدات في جدول folders اللي كانت بنفس الاسم القديم
    await conn.execute(
      'UPDATE folders SET name = ? WHERE name = ?',
      [name, oldName]
    );

    // ✅ تسجيل اللوق بعد نجاح تعديل اسم المجلد
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id;
      
      try {
        await logAction(
          userId,
          'update_folder_name',
          `تم تعديل اسم مجلد للأقسام من: ${oldName} إلى: ${name}`,
          'folder_name',
          id
        );
      } catch (logErr) {
        console.error('logAction error:', logErr);
      }
    }

    conn.release();
    return res.json({
      status: 'success',
      message: '✅ تم تعديل اسم المجلد وكل المجلدات المرتبطة بنجاح'
    });
  } catch (err) {
    conn.release();
    console.error(err);
    return res.status(500).json({ message: '❌ فشل في تعديل المجلد.' });
  }
};

const deleteFolderName = async (req, res) => {
  const { id } = req.params;

  try {
    const conn = await pool.getConnection();
    
    // جلب الاسم قبل الحذف لتسجيله في اللوق
    const [nameRows] = await conn.execute('SELECT name FROM folder_names WHERE id = ?', [id]);
    const folderName = nameRows.length > 0 ? nameRows[0].name : 'غير معروف';
    
    const [result] = await conn.execute(
      'DELETE FROM folder_names WHERE id = ?',
      [id]
    );
    
    // ✅ تسجيل اللوق بعد نجاح حذف اسم المجلد
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id;
      
      try {
        await logAction(
          userId,
          'delete_folder_name',
          `تم حذف اسم مجلد للأقسام: ${folderName}`,
          'folder_name',
          id
        );
      } catch (logErr) {
        console.error('logAction error:', logErr);
      }
    }
    
    conn.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '❌ المجلد غير موجود أو تم حذفه مسبقاً.' });
    }

    return res.json({
      status: 'success',
      message: '✅ تم حذف المجلد بنجاح'
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: '❌ فشل في حذف المجلد.' });
  }
};


module.exports = {
  getFolders,
  createFolder,
  updateFolder,
  getFolderById,
  deleteFolder,
  getFolderNames,
  addFolderName,
  updateFolderName,
  deleteFolderName

};
