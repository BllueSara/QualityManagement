const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
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
        let decodedToken;
        try {
            decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            return res.status(401).json({ message: 'غير مصرح: توكن غير صالح' });
        }

        const folderId = req.params.folderId;
        const connection = await db.getConnection();

        const [folder] = await connection.execute(
            'SELECT name, department_id FROM folders WHERE id = ?',
            [folderId]
        );

        if (folder.length === 0) {
            connection.release();
            return res.status(404).json({ message: 'المجلد غير موجود' });
        }

        let query = 'SELECT id, title, created_at, file_path AS fileUrl, is_approved FROM contents WHERE folder_id = ?';
        let params = [folderId];

        // إذا لم يكن المستخدم admin، قم بتصفية المحتويات حسب حالة الموافقة فقط
        if (decodedToken.role !== 'admin') {
            query += ' AND is_approved = 1'; // فقط المحتويات المعتمدة للمستخدمين العاديين
        }

        query += ' ORDER BY created_at DESC';

        const [contents] = await connection.execute(query, params);

        connection.release();
        res.json({
            message: 'تم جلب المحتويات بنجاح',
            folderName: folder[0].name,
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
        let decodedToken;
        try {
            decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            return res.status(401).json({ message: 'غير مصرح: توكن غير صالح' });
        }

        const folderId = req.params.folderId;
        const { title } = req.body;
        const filePath = req.file ? path.join('content_files', req.file.filename).replace(/\\/g, '/') : null;
        const connection = await db.getConnection();

        if (!folderId || !title || !filePath) {
            connection.release();
            return res.status(400).json({ message: 'معرف المجلد والعنوان والملف مطلوبون.' });
        }

        const [folder] = await connection.execute(
            'SELECT id, department_id FROM folders WHERE id = ?',
            [folderId]
        );

        if (folder.length === 0) {
            connection.release();
            return res.status(404).json({ message: 'المجلد غير موجود' });
        }

        const [existingContent] = await connection.execute(
            'SELECT id FROM contents WHERE title = ? AND folder_id = ?',
            [title, folderId]
        );

        if (existingContent.length > 0) {
            connection.release();
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(409).json({ message: 'يوجد محتوى بنفس العنوان في هذا المجلد بالفعل.' });
        }

        const isApproved = 0; // المحتوى يحتاج دائماً إلى موافقة، بغض النظر عن دور المستخدم

        const [result] = await db.execute(
            'INSERT INTO contents (title, file_path, folder_id, is_approved, created_by) VALUES (?, ?, ?, ?, ?)',
            [title, filePath, folderId, isApproved, decodedToken.id]
        );

        connection.release();
        
        res.status(201).json({
            message: 'تم رفع المحتوى بنجاح وهو في انتظار الاعتمادات اللازمة',
            contentId: result.insertId,
            isApproved: false,
            status: 'pending'
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
        const { title, folderId } = req.body;
        const filePath = req.file ? path.join('content_files', req.file.filename).replace(/\\/g, '/') : null;
        const connection = await db.getConnection();

        const [currentContent] = await connection.execute(
            'SELECT folder_id, file_path FROM contents WHERE id = ?',
            [contentId]
        );

        if (currentContent.length === 0) {
            connection.release();
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(404).json({ message: 'المحتوى غير موجود.' });
        }

        const folderIdForCheck = currentContent[0].folder_id;
        const oldFilePath = currentContent[0].file_path;

        const [existingContent] = await connection.execute(
            'SELECT id FROM contents WHERE title = ? AND folder_id = ? AND id != ?',
            [title, folderIdForCheck, contentId]
        );

        if (existingContent.length > 0) {
            connection.release();
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(409).json({ message: 'يوجد محتوى آخر بنفس العنوان في هذا المجلد بالفعل.' });
        }

        let query = 'UPDATE contents SET title = ?';
        let params = [title];

        if (filePath) {
            if (oldFilePath && fs.existsSync(path.join(__dirname, '../uploads', oldFilePath))) {
                fs.unlinkSync(path.join(__dirname, '../uploads', oldFilePath));
            }
            query += ', file_path = ?';
            params.push(filePath);
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

        const [content] = await connection.execute(
            'SELECT file_path FROM contents WHERE id = ?',
            [contentId]
        );

        if (content.length > 0 && content[0].file_path) {
            const filePathToDelete = path.join(__dirname, '../uploads', content[0].file_path);
            if (fs.existsSync(filePathToDelete)) {
                fs.unlinkSync(filePathToDelete);
            }
        }

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

// تنزيل محتوى
const downloadContent = async (req, res) => {
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

        const [content] = await connection.execute(
            'SELECT file_path, title, is_approved FROM contents WHERE id = ?',
            [contentId]
        );

        connection.release();

        if (content.length === 0) {
            return res.status(404).json({ message: 'المحتوى غير موجود' });
        }

        if (!content[0].is_approved) {
            return res.status(403).json({ message: 'لا يمكن تنزيل المحتوى غير المعتمد.' });
        }

        const filePath = path.join(__dirname, '../uploads', content[0].file_path);
        const fileName = content[0].title;

        if (fs.existsSync(filePath)) {
            res.download(filePath, fileName, (err) => {
                if (err) {
                    console.error('Error downloading file:', err);
                    res.status(500).json({ message: 'حدث خطأ أثناء تنزيل الملف.' });
                }
            });
        } else {
            res.status(404).json({ message: 'الملف غير موجود على الخادم.' });
        }

    } catch (error) {
        console.error('خطأ في تنزيل المحتوى:', error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
};

// جلب محتوى حسب المعرف
const getContentById = async (req, res) => {
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

        const [content] = await connection.execute(
            'SELECT id, title, file_path, folder_id, is_approved FROM contents WHERE id = ?',
            [contentId]
        );

        connection.release();

        if (content.length === 0) {
            return res.status(404).json({ message: 'المحتوى غير موجود.' });
        }

        res.json({ message: 'تم جلب المحتوى بنجاح', data: content[0] });

    } catch (error) {
        console.error('خطأ في جلب المحتوى حسب المعرف:', error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
};

// الموافقة على محتوى
const approveContent = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'غير مصرح: لا يوجد توكن أو التوكن غير صالح' });
        }
        const token = authHeader.split(' ')[1];
        let decodedToken;
        try {
            decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            return res.status(401).json({ message: 'غير مصرح: توكن غير صالح' });
        }

        if (decodedToken.role !== 'admin') {
            return res.status(403).json({ message: 'غير مصرح: يجب أن تكون مدير للموافقة على المحتوى' });
        }

        const contentId = req.params.contentId;
        const connection = await db.getConnection();

        const [content] = await connection.execute(
            `SELECT c.*, d.name as department_name
             FROM contents c
             JOIN users u ON c.created_by = u.id
             JOIN folders f ON c.folder_id = f.id
             JOIN departments d ON f.department_id = d.id
             WHERE c.id = ?`,
            [contentId]
        );

        if (content.length === 0) {
            connection.release();
            return res.status(404).json({ message: 'المحتوى غير موجود' });
        }

        await connection.execute(
            'UPDATE contents SET is_approved = 1, approved_by = ?, approved_at = NOW() WHERE id = ?',
            [decodedToken.id, contentId]
        );

        connection.release();
        res.json({
            message: 'تمت الموافقة على المحتوى بنجاح',
            content: {
                id: contentId,
                title: content[0].title,
                department: content[0].department_name
            }
        });
    } catch (error) {
        console.error('خطأ في الموافقة على المحتوى:', error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
};

module.exports = {
    getContentsByFolderId,
    addContent,
    updateContent,
    deleteContent,
    downloadContent,
    getContentById,
    approveContent
}; 