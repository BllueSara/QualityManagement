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
      'SELECT id FROM departments WHERE id = ?', 
      [departmentId]
    );
    if (!dept.length) {
      conn.release();
      return res.status(404).json({ message: 'القسم غير موجود.' });
    }

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
    await logAction(decoded.id, 'create_folder', `تم إنشاء مجلد باسم: ${name}`, 'folder', result.insertId);

    return res.status(201).json({
      message: 'تم إضافة المجلد بنجاح',
      folderId: result.insertId
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'خطأ في الخادم.' });
  }
};

// الدوال التالية تبقى كما هي:
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

    const [rows] = await conn.execute('SELECT * FROM folders WHERE id = ?', [folderId]);
    if (!rows.length) {
      conn.release();
      return res.status(404).json({ message: 'المجلد غير موجود.' });
    }

    await conn.execute(
      `UPDATE folders 
       SET name = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [name, folderId]
    );

    conn.release();
    await logAction(decoded.id, 'update_folder', `تعديل اسم المجلد إلى: ${name}`, 'folder', folderId);

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

    // تحقق من وجود المجلد
    const [folder] = await conn.execute('SELECT * FROM folders WHERE id = ?', [folderId]);
    if (!folder.length) {
      conn.release();
      return res.status(404).json({ message: 'المجلد غير موجود.' });
    }

    // حذف كل المحتويات المرتبطة أولاً
    await conn.execute('DELETE FROM contents WHERE folder_id = ?', [folderId]);

    // ثم حذف المجلد
    await conn.execute('DELETE FROM folders WHERE id = ?', [folderId]);

    conn.release();
    await logAction(decoded.id, 'delete_folder', `تم حذف مجلد: ${folder[0].name}`, 'folder', folderId);

    return res.json({ message: 'تم حذف المجلد بنجاح.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'حدث خطأ في الخادم أثناء حذف المجلد.' });
  }
};

module.exports = {
  getFolders,
  createFolder,
  updateFolder,
  getFolderById,
  deleteFolder
};
