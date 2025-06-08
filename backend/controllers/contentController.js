const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const multer = require('multer');
require('dotenv').config();

const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'Quality',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// إعدادات تخزين multer للمحتويات
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // تأكد أن هذا المسار موجود في مجلد uploads
        cb(null, './uploads/content_files'); 
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// جلب جميع المحتويات لمجلد معين
const getContentsByFolderId = async (req, res) => {
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

        const folderId = req.params.folderId; // تم تغيير departmentId إلى folderId
        const connection = await db.getConnection();

        // التحقق من وجود المجلد
        const [folder] = await connection.execute(
            'SELECT name FROM folders WHERE id = ?',
            [folderId]
        );

        if (folder.length === 0) {
            connection.release();
            return res.status(404).json({ message: 'المجلد غير موجود' });
        }

        // جلب المحتويات بناءً على folder_id
        const [contents] = await connection.execute(
            'SELECT * FROM contents WHERE folder_id = ? ORDER BY created_at DESC',
            [folderId]
        );

        connection.release();
        res.json({
            message: 'تم جلب المحتويات بنجاح',
            folderName: folder[0].name, // تم تغيير departmentName إلى folderName
            data: contents
        });
    } catch (error) {
        console.error('خطأ في جلب المحتويات:', error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
};

// إضافة محتوى جديد لمجلد معين
const addContent = async (req, res) => {
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

        const folderId = req.params.folderId; // تم تغيير departmentId إلى folderId
        const { title, notes } = req.body;
        const filePath = req.file ? req.file.path.replace(/\\/g, '/') : null;
        const connection = await db.getConnection();

        if (!folderId || !title || !filePath) {
            connection.release();
            return res.status(400).json({ message: 'معرف المجلد والعنوان والملف مطلوبون.' }); // تم تغيير الرسالة
        }

        // التحقق من وجود المجلد
        const [folder] = await connection.execute(
            'SELECT id FROM folders WHERE id = ?',
            [folderId]
        );

        if (folder.length === 0) {
            connection.release();
            return res.status(404).json({ message: 'المجلد غير موجود' });
        }

        const [result] = await connection.execute(
            'INSERT INTO contents (title, file_path, notes, folder_id) VALUES (?, ?, ?, ?)', // تم تغيير department_id إلى folder_id
            [title, filePath, notes, folderId]
        );

        connection.release();
        res.status(201).json({
            message: 'تم إضافة المحتوى بنجاح',
            contentId: result.insertId
        });
    } catch (error) {
        console.error('خطأ في إضافة المحتوى:', error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
};

// تحديث محتوى موجود
const updateContent = async (req, res) => {
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

        const contentId = req.params.contentId;
        const { title, notes, folderId } = req.body; // إضافة folderId للحالة التي يتطلب التعديل تغيير المجلد
        const filePath = req.file ? req.file.path.replace(/\\/g, '/') : null;
        const connection = await db.getConnection();

        let query = 'UPDATE contents SET title = ?, notes = ?';
        let params = [title, notes];

        if (filePath) {
            query += ', file_path = ?';
            params.push(filePath);
        }
        // إذا تم توفير folderId، قم بتحديثه
        if (folderId) {
            query += ', folder_id = ?';
            params.push(folderId);
        }

        query += ' WHERE id = ?';
        params.push(contentId);

        const [result] = await connection.execute(query, params);

        connection.release();

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'المحتوى غير موجود' });
        }

        res.json({ message: 'تم تحديث المحتوى بنجاح' });
    } catch (error) {
        console.error('خطأ في تحديث المحتوى:', error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
};

// حذف محتوى
const deleteContent = async (req, res) => {
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

        const contentId = req.params.contentId;
        const connection = await db.getConnection();

        const [result] = await connection.execute(
            'DELETE FROM contents WHERE id = ?',
            [contentId]
        );

        connection.release();

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'المحتوى غير موجود' });
        }

        res.json({ message: 'تم حذف المحتوى بنجاح' });
    } catch (error) {
        console.error('خطأ في حذف المحتوى:', error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
};

module.exports = {
    getContentsByFolderId,
    addContent,
    updateContent,
    deleteContent
}; 