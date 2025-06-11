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
const updateFolder  = async (req, res) => { /* ... */ };
const getFolderById = async (req, res) => { /* ... */ };
const deleteFolder  = async (req, res) => { /* ... */ };

module.exports = {
  getFolders,
  createFolder,
  updateFolder,
  getFolderById,
  deleteFolder
};
