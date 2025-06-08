const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// إنشاء اتصال قاعدة البيانات
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// الحصول على جميع مجلدات قسم معين
const getFolders = async (req, res) => {
    try {
        // منطق التحقق من التوكن (JWT) هنا
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'غير مصرح: لا يوجد توكن أو التوكن غير صالح' });
        }
        const token = authHeader.split(' ')[1];
        try {
            jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            return res.status(401).json({ message: 'غير مصرح: توكن غير صالح' });
        }
        // نهاية منطق التحقق من التوكن

        const departmentId = req.params.departmentId;
        const connection = await pool.getConnection();

        // التحقق من وجود القسم
        const [department] = await connection.execute(
            'SELECT name FROM departments WHERE id = ?',
            [departmentId]
        );

        if (department.length === 0) {
            connection.release();
            return res.status(404).json({ message: 'القسم غير موجود' });
        }

        // جلب المجلدات
        const [folders] = await connection.execute(
            'SELECT * FROM folders WHERE department_id = ? ORDER BY created_at DESC',
            [departmentId]
        );

        connection.release();
        res.json({
            message: 'تم جلب المجلدات بنجاح',
            departmentName: department[0].name,
            data: folders
        });
    } catch (error) {
        console.error('خطأ في جلب المجلدات:', error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
};

// إضافة مجلد جديد
const createFolder = async (req, res) => {
    try {
        // منطق التحقق من التوكن (JWT) هنا
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'غير مصرح: لا يوجد توكن أو التوكن غير صالح' });
        }
        const token = authHeader.split(' ')[1];
        try {
            jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            return res.status(401).json({ message: 'غير مصرح: توكن غير صالح' });
        }
        // نهاية منطق التحقق من التوكن

        const departmentId = req.params.departmentId;
        const { name } = req.body;
        const connection = await pool.getConnection();

        // التحقق من وجود القسم
        const [department] = await connection.execute(
            'SELECT id FROM departments WHERE id = ?',
            [departmentId]
        );

        if (department.length === 0) {
            connection.release();
            return res.status(404).json({ message: 'القسم غير موجود' });
        }

        // إضافة المجلد
        const [result] = await connection.execute(
            'INSERT INTO folders (name, department_id) VALUES (?, ?)',
            [name, departmentId]
        );

        connection.release();
        res.status(201).json({
            message: 'تم إضافة المجلد بنجاح',
            folderId: result.insertId
        });
    } catch (error) {
        console.error('خطأ في إضافة المجلد:', error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
};

// تحديث مجلد
const updateFolder = async (req, res) => {
    try {
        // منطق التحقق من التوكن (JWT) هنا
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'غير مصرح: لا يوجد توكن أو التوكن غير صالح' });
        }
        const token = authHeader.split(' ')[1];
        try {
            jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            return res.status(401).json({ message: 'غير مصرح: توكن غير صالح' });
        }
        // نهاية منطق التحقق من التوكن

        const folderId = req.params.folderId;
        const { name } = req.body;
        const connection = await pool.getConnection();

        // تحديث المجلد
        const [result] = await connection.execute(
            'UPDATE folders SET name = ? WHERE id = ?',
            [name, folderId]
        );

        connection.release();

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'المجلد غير موجود' });
        }

        res.json({ message: 'تم تحديث المجلد بنجاح' });
    } catch (error) {
        console.error('خطأ في تحديث المجلد:', error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
};

// جلب مجلد واحد بواسطة المعرف
const getFolderById = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'غير مصرح: لا يوجد توكن أو التوكن غير صالح' });
        }
        const token = authHeader.split(' ')[1];
        try {
            jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            return res.status(401).json({ message: 'غير مصرح: توكن غير صالح' });
        }

        const folderId = req.params.folderId;
        const connection = await pool.getConnection();

        const [folder] = await connection.execute(
            'SELECT id, name FROM folders WHERE id = ?',
            [folderId]
        );

        connection.release();

        if (folder.length === 0) {
            return res.status(404).json({ message: 'المجلد غير موجود' });
        }

        res.json({ message: 'تم جلب المجلد بنجاح', data: folder[0] });
    } catch (error) {
        console.error('خطأ في جلب المجلد:', error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
};

// حذف مجلد
const deleteFolder = async (req, res) => {
    try {
        // منطق التحقق من التوكن (JWT) هنا
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'غير مصرح: لا يوجد توكن أو التوكن غير صالح' });
        }
        const token = authHeader.split(' ')[1];
        try {
            jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            return res.status(401).json({ message: 'غير مصرح: توكن غير صالح' });
        }
        // نهاية منطق التحقق من التوكن

        const folderId = req.params.folderId;
        const connection = await pool.getConnection();

        // حذف المجلد
        const [result] = await connection.execute(
            'DELETE FROM folders WHERE id = ?',
            [folderId]
        );

        connection.release();

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'المجلد غير موجود' });
        }

        res.json({ message: 'تم حذف المجلد بنجاح' });
    } catch (error) {
        console.error('خطأ في حذف المجلد:', error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
};

module.exports = {
    getFolders,
    createFolder,
    updateFolder,
    deleteFolder,
    getFolderById
}; 