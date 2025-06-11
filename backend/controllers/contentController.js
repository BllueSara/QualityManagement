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
        const uploadDir = './uploads/content_files';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max file size
    }
});

// جلب جميع المحتويات لمجلد معين
const getContentsByFolderId = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                status: 'error',
                message: 'غير مصرح: لا يوجد توكن أو التوكن غير صالح' 
            });
        }

        const token = authHeader.split(' ')[1];
        let decodedToken;
        try {
            decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            return res.status(401).json({ 
                status: 'error',
                message: 'غير مصرح: توكن غير صالح' 
            });
        }

        const folderId = req.params.folderId;
        const connection = await db.getConnection();

        // جلب معلومات المجلد والقسم
        const [folder] = await connection.execute(
            `SELECT 
                f.id,
                f.name,
                f.department_id,
                d.name as department_name,
                f.created_by,
                u.username as created_by_username
            FROM folders f 
            JOIN departments d ON f.department_id = d.id
            LEFT JOIN users u ON f.created_by = u.id
            WHERE f.id = ?`,
            [folderId]
        );

        if (folder.length === 0) {
            connection.release();
            return res.status(404).json({ 
                status: 'error',
                message: 'المجلد غير موجود' 
            });
        }

        // جلب المحتويات
        let query = `
            SELECT 
                c.id, 
                c.title, 
                c.notes,
                c.file_path AS fileUrl, 
                c.approval_status,
                c.is_approved,
                c.approved_by,
                c.approvals_log,
                c.approvers_required,
                c.created_at,
                c.updated_at,
                u.username as created_by_username,
                a.username as approved_by_username
            FROM contents c
            LEFT JOIN users u ON c.created_by = u.id
            LEFT JOIN users a ON c.approved_by = a.id
            WHERE c.folder_id = ?
        `;
        let params = [folderId];

        // إذا لم يكن المستخدم admin، قم بتصفية المحتويات حسب حالة الموافقة
        if (decodedToken.role !== 'admin') {
            query += ' AND (c.is_approved = 1 OR c.created_by = ?)';
            params.push(decodedToken.id);
        }

        query += ' ORDER BY c.created_at DESC';

        const [contents] = await connection.execute(query, params);

        connection.release();
        res.json({
            status: 'success',
            message: 'تم جلب المحتويات بنجاح',
            folder: {
                id: folder[0].id,
                name: folder[0].name,
                department_id: folder[0].department_id,
                department_name: folder[0].department_name,
                created_by: folder[0].created_by,
                created_by_username: folder[0].created_by_username
            },
            data: contents
        });
    } catch (error) {
        console.error('خطأ في جلب المحتويات:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'حدث خطأ في الخادم' 
        });
    }
};

// إضافة محتوى جديد لمجلد معين
const addContent = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                status: 'error',
                message: 'غير مصرح: لا يوجد توكن أو التوكن غير صالح' 
            });
        }

        const token = authHeader.split(' ')[1];
        let decodedToken;
        try {
            decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            return res.status(401).json({ 
                status: 'error',
                message: 'غير مصرح: توكن غير صالح' 
            });
        }

        const folderId = req.params.folderId;
        const { title, notes, approvers_required } = req.body;
        const filePath = req.file ? path.join('content_files', req.file.filename).replace(/\\/g, '/') : null;
        const connection = await db.getConnection();

        if (!folderId || !title || !filePath) {
            connection.release();
            return res.status(400).json({ 
                status: 'error',
                message: 'معرف المجلد والعنوان والملف مطلوبون.' 
            });
        }

        // التحقق من وجود المجلد
        const [folder] = await connection.execute(
            'SELECT id, department_id FROM folders WHERE id = ?',
            [folderId]
        );

        if (folder.length === 0) {
            connection.release();
            return res.status(404).json({ 
                status: 'error',
                message: 'المجلد غير موجود' 
            });
        }

        // التحقق من عدم وجود محتوى بنفس العنوان
        const [existingContent] = await connection.execute(
            'SELECT id FROM contents WHERE title = ? AND folder_id = ?',
            [title, folderId]
        );

        if (existingContent.length > 0) {
            connection.release();
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(409).json({ 
                status: 'error',
                message: 'يوجد محتوى بنفس العنوان في هذا المجلد بالفعل.' 
            });
        }

        // إضافة المحتوى
        const [result] = await db.execute(
            `INSERT INTO contents (
                title, 
                file_path, 
                notes,
                folder_id, 
                approval_status,
                is_approved,
                created_by,
                approvers_required,
                approvals_log,
                created_at,
                updated_at
            ) VALUES (?, ?, ?, ?, 'pending', 0, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [
                title, 
                filePath, 
                notes || null,
                folderId, 
                decodedToken.id,
                approvers_required ? JSON.stringify(approvers_required) : null,
                JSON.stringify([])
            ]
        );

        connection.release();
        
        res.status(201).json({
            status: 'success',
            message: 'تم رفع المحتوى بنجاح وهو في انتظار الاعتمادات اللازمة',
            contentId: result.insertId,
            isApproved: false,
            status: 'pending'
        });
    } catch (error) {
        console.error('خطأ في إضافة المحتوى:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'حدث خطأ في الخادم' 
        });
    }
};

// تحديث محتوى موجود
const updateContent = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                status: 'error',
                message: 'غير مصرح: لا يوجد توكن أو التوكن غير صالح' 
            });
        }

        const token = authHeader.split(' ')[1];
        let decodedToken;
        try {
            decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            return res.status(401).json({ 
                status: 'error',
                message: 'غير مصرح: توكن غير صالح' 
            });
        }

        const contentId = req.params.contentId;
        const { title, notes } = req.body;
        const filePath = req.file ? path.join('content_files', req.file.filename).replace(/\\/g, '/') : null;
        const connection = await db.getConnection();

        // التحقق من صلاحيات المستخدم
        const [content] = await connection.execute(
            'SELECT folder_id, file_path, created_by, is_approved FROM contents WHERE id = ?',
            [contentId]
        );

        if (content.length === 0) {
            connection.release();
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(404).json({ 
                status: 'error',
                message: 'المحتوى غير موجود.' 
            });
        }

        // فقط منشئ المحتوى أو المشرف يمكنه تعديل المحتوى
        if (content[0].created_by !== decodedToken.id && decodedToken.role !== 'admin') {
            connection.release();
            return res.status(403).json({ 
                status: 'error',
                message: 'ليس لديك صلاحية لتعديل هذا المحتوى.' 
            });
        }

        // لا يمكن تعديل محتوى معتمد
        if (content[0].is_approved && decodedToken.role !== 'admin') {
            connection.release();
            return res.status(403).json({ 
                status: 'error',
                message: 'لا يمكن تعديل محتوى معتمد.' 
            });
        }

        const folderIdForCheck = content[0].folder_id;
        const oldFilePath = content[0].file_path;

        // التحقق من عدم وجود محتوى آخر بنفس العنوان
        const [existingContent] = await connection.execute(
            'SELECT id FROM contents WHERE title = ? AND folder_id = ? AND id != ?',
            [title, folderIdForCheck, contentId]
        );

        if (existingContent.length > 0) {
            connection.release();
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(409).json({ 
                status: 'error',
                message: 'يوجد محتوى آخر بنفس العنوان في هذا المجلد بالفعل.' 
            });
        }

        // تحديث المحتوى
        let query = `
            UPDATE contents 
            SET title = ?, 
                notes = ?, 
                updated_at = CURRENT_TIMESTAMP
        `;
        let params = [title, notes || null];

        if (filePath) {
            query += ', file_path = ?';
            params.push(filePath);
        }

        query += ' WHERE id = ?';
        params.push(contentId);

        await connection.execute(query, params);

        // حذف الملف القديم إذا تم رفع ملف جديد
        if (filePath && oldFilePath) {
            const oldFilePathFull = path.join('./uploads', oldFilePath);
            if (fs.existsSync(oldFilePathFull)) {
                fs.unlinkSync(oldFilePathFull);
            }
        }

        connection.release();
        res.json({
            status: 'success',
            message: 'تم تحديث المحتوى بنجاح'
        });
    } catch (error) {
        console.error('خطأ في تحديث المحتوى:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'حدث خطأ في الخادم' 
        });
    }
};

// حذف محتوى
const deleteContent = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                status: 'error',
                message: 'غير مصرح: لا يوجد توكن أو التوكن غير صالح' 
            });
        }

        const token = authHeader.split(' ')[1];
        let decodedToken;
        try {
            decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            return res.status(401).json({ 
                status: 'error',
                message: 'غير مصرح: توكن غير صالح' 
            });
        }

        const contentId = req.params.contentId;
        const connection = await db.getConnection();

        // التحقق من صلاحيات المستخدم
        const [content] = await connection.execute(
            'SELECT file_path, created_by, is_approved FROM contents WHERE id = ?',
            [contentId]
        );

        if (content.length === 0) {
            connection.release();
            return res.status(404).json({ 
                status: 'error',
                message: 'المحتوى غير موجود.' 
            });
        }

        // فقط منشئ المحتوى أو المشرف يمكنه حذف المحتوى
        if (content[0].created_by !== decodedToken.id && decodedToken.role !== 'admin') {
            connection.release();
            return res.status(403).json({ 
                status: 'error',
                message: 'ليس لديك صلاحية لحذف هذا المحتوى.' 
            });
        }

        // لا يمكن حذف محتوى معتمد
        if (content[0].is_approved && decodedToken.role !== 'admin') {
            connection.release();
            return res.status(403).json({ 
                status: 'error',
                message: 'لا يمكن حذف محتوى معتمد.' 
            });
        }

        // حذف الملف
        const filePath = path.join('./uploads', content[0].file_path);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // حذف المحتوى من قاعدة البيانات
        await connection.execute('DELETE FROM contents WHERE id = ?', [contentId]);

        connection.release();
        res.json({
            status: 'success',
            message: 'تم حذف المحتوى بنجاح'
        });
    } catch (error) {
        console.error('خطأ في حذف المحتوى:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'حدث خطأ في الخادم' 
        });
    }
};

// تحميل محتوى
const downloadContent = async (req, res) => {
    try {
        const contentId = req.params.contentId;
        const connection = await db.getConnection();

        const [content] = await connection.execute(
            'SELECT file_path, title FROM contents WHERE id = ?',
            [contentId]
        );

        if (content.length === 0) {
            connection.release();
            return res.status(404).json({ 
                status: 'error',
                message: 'المحتوى غير موجود.' 
            });
        }

        const filePath = path.join('./uploads', content[0].file_path);
        if (!fs.existsSync(filePath)) {
            connection.release();
            return res.status(404).json({ 
                status: 'error',
                message: 'الملف غير موجود.' 
            });
        }

        connection.release();
        res.download(filePath, content[0].title);
    } catch (error) {
        console.error('خطأ في تحميل المحتوى:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'حدث خطأ في الخادم' 
        });
    }
};

// جلب محتوى محدد
const getContentById = async (req, res) => {
    try {
        const contentId = req.params.contentId;
        const connection = await db.getConnection();

        const [content] = await connection.execute(
            `SELECT 
                c.*,
                u.username as created_by_username,
                a.username as approved_by_username
            FROM contents c
            LEFT JOIN users u ON c.created_by = u.id
            LEFT JOIN users a ON c.approved_by = a.id
            WHERE c.id = ?`,
            [contentId]
        );

        if (content.length === 0) {
            connection.release();
            return res.status(404).json({ 
                status: 'error',
                message: 'المحتوى غير موجود.' 
            });
        }

        connection.release();
        res.json({
            status: 'success',
            data: content[0]
        });
    } catch (error) {
        console.error('خطأ في جلب المحتوى:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'حدث خطأ في الخادم' 
        });
    }
};

// الموافقة على محتوى
const approveContent = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                status: 'error',
                message: 'غير مصرح: لا يوجد توكن أو التوكن غير صالح' 
            });
        }

        const token = authHeader.split(' ')[1];
        let decodedToken;
        try {
            decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            return res.status(401).json({ 
                status: 'error',
                message: 'غير مصرح: توكن غير صالح' 
            });
        }

        const contentId = req.params.contentId;
        const { approved, notes } = req.body;
        const connection = await db.getConnection();

        // التحقق من وجود المحتوى
        const [content] = await connection.execute(
            'SELECT * FROM contents WHERE id = ?',
            [contentId]
        );

        if (content.length === 0) {
            connection.release();
            return res.status(404).json({ 
                status: 'error',
                message: 'المحتوى غير موجود.' 
            });
        }

        // التحقق من أن المستخدم لم يقم بالاعتماد مسبقاً
        const approvalsLog = JSON.parse(content[0].approvals_log || '[]');
        const hasApproved = approvalsLog.some(log => log.user_id === decodedToken.id);
        if (hasApproved) {
            connection.release();
            return res.status(400).json({ 
                status: 'error',
                message: 'لقد قمت بالاعتماد على هذا المحتوى مسبقاً.' 
            });
        }

        // إضافة الاعتماد الجديد
        const newApproval = {
            user_id: decodedToken.id,
            username: decodedToken.username,
            approved: approved,
            notes: notes || null,
            timestamp: new Date().toISOString()
        };
        approvalsLog.push(newApproval);

        // تحديث حالة الاعتماد
        const approversRequired = JSON.parse(content[0].approvers_required || '[]');
        const approvedCount = approvalsLog.filter(log => log.approved).length;
        const isApproved = approvedCount >= approversRequired.length;

        await connection.execute(
            `UPDATE contents 
             SET approvals_log = ?,
                 is_approved = ?,
                 approval_status = ?,
                 approved_by = ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [
                JSON.stringify(approvalsLog),
                isApproved ? 1 : 0,
                isApproved ? 'approved' : 'pending',
                isApproved ? decodedToken.id : null,
                contentId
            ]
        );

        connection.release();
        res.json({
            status: 'success',
            message: isApproved ? 'تم اعتماد المحتوى بنجاح' : 'تم تسجيل اعتمادك بنجاح',
            isApproved,
            approvalStatus: isApproved ? 'approved' : 'pending'
        });
    } catch (error) {
        console.error('خطأ في اعتماد المحتوى:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'حدث خطأ في الخادم' 
        });
    }
};



/**
 * GET /api/contents/my-uploads
 * يرجّع الملفات التي رفعها المستخدم الحالي
 */
const getMyUploadedContent = async (req, res) => {
    try {
      // 1) التحقق من التوكن
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ status: 'error', message: 'غير مصرح: لا يوجد توكن.' });
      }
      const token = authHeader.split(' ')[1];
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch {
        return res.status(401).json({ status: 'error', message: 'غير مصرح: توكن غير صالح.' });
      }
      const userId = decoded.id;
  
      // 2) جلب الملفات المرتبطة بالمستخدم
      const [rows] = await db.execute(
        `SELECT 
           c.id,
           c.title,
           c.file_path AS filePath,
           c.created_at AS createdAt,
           f.name       AS folderName,
           d.name       AS departmentName
         FROM contents c
         JOIN folders    f ON c.folder_id     = f.id
         JOIN departments d ON f.department_id = d.id
         WHERE c.created_by = ?
         ORDER BY c.created_at DESC`,
        [userId]
      );
  
      // 3) نجهز روابط التحميل
      const host     = req.get('host');
      const protocol = req.protocol;
      const data = rows.map(r => ({
        id:             r.id,
        title:          r.title,
        fileUrl:        `${protocol}://${host}/${r.filePath}`,
        createdAt:      r.createdAt,
        folderName:     r.folderName,
        departmentName: r.departmentName
      }));
  
      return res.json({ status: 'success', data });
    } catch (err) {
      console.error('Error getMyUploadedContent:', err);
      return res.status(500).json({ status: 'error', message: 'حدث خطأ في الخادم.' });
    }
  };
  
  module.exports = {
    getMyUploadedContent,
    getContentsByFolderId,
    addContent,
    updateContent,
    deleteContent,
    downloadContent,
    getContentById,
    approveContent,
    upload
  };
  

// في أسفل contentController.js
module.exports = {
    getMyUploadedContent,
    getContentsByFolderId,
    addContent,
    updateContent,
    deleteContent,
    downloadContent,
    getContentById,
    approveContent,
    upload
  };
  