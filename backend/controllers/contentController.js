const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const { logAction } = require('../models/logger');
const { insertNotification } = require('../models/notfications-utils');

const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'Quality',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadDir = path.join(__dirname, '../../uploads/content_files'); // تأكد أنه مسار مطلق من backend
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname) || '.pdf';
      cb(null, `${uniqueSuffix}${ext}`);
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

        // جلب معلومات المجلد
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

        // بناء استعلام المحتوى
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

        // إذا لم يكن المستخدم مسؤول، أظهر فقط المعتمدة أو المرفوعة منه
        if (decodedToken.role !== 'admin') {
            query += ' AND c.is_approved = 1 AND c.approval_status = "approved"';
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
        res.status(500).json({ message: 'خطأ في جلب المحتويات' });
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
      const filePath = req.file ? path.posix.join('content_files', req.file.filename) : null;

  
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

  
      // 1) إضافة المحتوى
      const [result] = await connection.execute(
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
  
      const contentId = result.insertId;
  
      // 2) إضافة الـ approvers وربطهم
      if (Array.isArray(approvers_required)) {
        for (const userId of approvers_required) {
          await connection.execute(
            `INSERT INTO content_approvers (content_id, user_id, assigned_at)
             VALUES (?, ?, NOW())`,
            [contentId, userId]
          );
  
          await connection.execute(
            `INSERT INTO approval_logs (content_id, approver_id)
             VALUES (?, ?)`,
            [contentId, userId]
          );
        }
      }
  
      connection.release();
  
      res.status(201).json({
        status: 'success',
        message: 'تم رفع المحتوى بنجاح وهو في انتظار الاعتمادات اللازمة',
        contentId: contentId,
        isApproved: false,
        status: 'pending'
      });
    } catch (error) {
      res.status(500).json({ message: 'خطأ في إضافة المحتوى' });
    }
  };
  

// تحديث محتوى موجود
const updateContent = async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ status: 'error', message: 'غير مصرح: لا يوجد توكن' });
      }
  
      const token = authHeader.split(' ')[1];
      const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decodedToken.id;
  
      const originalId = req.params.contentId;
      const { title, notes } = req.body;
      const filePath = req.file ? path.join('content_files', req.file.filename).replace(/\\/g, '/') : null;
  
      const connection = await db.getConnection();
  
      // جلب المحتوى القديم (بما في ذلك approvers_required)
      const [oldContent] = await connection.execute(
        'SELECT folder_id, approvers_required FROM contents WHERE id = ?',
        [originalId]
      );
      if (!oldContent.length) {
        return res.status(404).json({ status: 'error', message: 'المحتوى الأصلي غير موجود' });
      }
  
      const folderId = oldContent[0].folder_id;
      const originalApproversRequired = oldContent[0].approvers_required; // جلب الموافقين المطلوبين من المحتوى القديم
  
      // ✅ تجاهل التحقق من التكرار إذا كان التعديل على نفس العنوان
      const [duplicateCheck] = await connection.execute(
        'SELECT id FROM contents WHERE title = ? AND folder_id = ? AND id != ?',
        [title, folderId, originalId]
      );
      if (duplicateCheck.length > 0) {
        return res.status(409).json({ status: 'error', message: 'يوجد محتوى آخر بنفس العنوان في هذا المجلد.' });
      }
  
      // إنشاء النسخة الجديدة
      const [insertResult] = await connection.execute(
        `INSERT INTO contents (
          title, file_path, notes, folder_id,
          approval_status, is_approved,
          created_by, approvers_required, approvals_log,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'pending', 0, ?, ?, ?, NOW(), NOW())`,
        [
          title,
          filePath,
          notes || null,
          folderId,
          userId,
          originalApproversRequired, // استخدم الموافقين المطلوبين من المحتوى الأصلي
          JSON.stringify([])
        ]
      );
  
      const newContentId = insertResult.insertId;
  
      connection.release();
  
      return res.status(201).json({
        status: 'success',
        message: '✅ تم إنشاء نسخة جديدة من المحتوى وهي بانتظار الاعتماد',
        contentId: newContentId
      });
  
    } catch (err) {
      res.status(500).json({ message: 'خطأ في إنشاء نسخة محدثة' });
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
        res.status(500).json({ message: 'خطأ في حذف المحتوى' });
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

        const filePathFull = path.join(__dirname, '../../uploads', content[0].file_path);

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
        res.status(500).json({ message: 'خطأ في تحميل المحتوى' });
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
        res.status(500).json({ message: 'خطأ في جلب المحتوى' });
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

        // التحقق من أن المستخدم لم يعتمد مسبقاً
        const approvalsLog = JSON.parse(content[0].approvals_log || '[]');
        const hasApproved = approvalsLog.some(log => log.user_id === decodedToken.id);
        if (hasApproved) {
            connection.release();
            return res.status(400).json({ 
                status: 'error',
                message: 'لقد قمت بالاعتماد على هذا المحتوى مسبقاً.' 
            });
        }

        // إضافة اعتماد جديد إلى سجل التواقيع
        const newApproval = {
            user_id: decodedToken.id,
            username: decodedToken.username,
            approved: approved,
            notes: notes || null,
            timestamp: new Date().toISOString()
        };
        approvalsLog.push(newApproval);

        // عدد الموافقين المطلوبين
        const approversRequired = JSON.parse(content[0].approvers_required || '[]');
        const approvedCount = approvalsLog.filter(log => log.approved).length;
        const isApproved = approvedCount >= approversRequired.length;

        // في حالة الاعتماد النهائي، استخدم pending_file_path كـ file_path إن وجد
        let filePathToSet = content[0].file_path;
        if (isApproved && content[0].pending_file_path) {
            // حذف الملف القديم
            const oldFilePath = path.join('./uploads', content[0].file_path);
            if (fs.existsSync(oldFilePath)) {
                fs.unlinkSync(oldFilePath);
            }

            // تعيين الملف الجديد
            filePathToSet = content[0].pending_file_path;
        }

        await connection.execute(
            `UPDATE contents 
             SET approvals_log = ?,
                 is_approved = ?,
                 approval_status = ?,
                 approved_by = ?,
                 file_path = ?,
                 pending_file_path = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [
                JSON.stringify(approvalsLog),
                isApproved ? 1 : 0,
                isApproved ? 'approved' : 'pending',
                isApproved ? decodedToken.id : null,
                filePathToSet,
                contentId
            ]
        );

        connection.release();

        res.json({
            status: 'success',
            message: isApproved 
                ? 'تم اعتماد المحتوى بنجاح وتم تفعيل التحديث الجديد.'
                : 'تم تسجيل اعتمادك بنجاح. في انتظار باقي المعتمدين.',
            isApproved,
            approvalStatus: isApproved ? 'approved' : 'pending'
        });

    } catch (error) {
        res.status(500).json({ message: 'خطأ في اعتماد المحتوى' });
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
           CONCAT('dept-', c.id) AS id,
           c.title,
           c.file_path AS filePath,
           c.created_at AS createdAt,
           c.is_approved,
           c.approval_status,
           f.name AS folderName,
           COALESCE(d.name, '-') AS source_name
         FROM contents c
         JOIN folders f ON c.folder_id = f.id
         LEFT JOIN departments d ON f.department_id = d.id
         WHERE c.created_by = ?
         ORDER BY c.created_at DESC`,
        [userId]
      );
      
      const data = rows.map(r => ({
        id:             r.id,
        title:          r.title,
        fileUrl:        r.filePath,
        createdAt:      r.createdAt,
        is_approved:    r.is_approved,
        approval_status: r.approval_status,
        folderName:     r.folderName,
        source_name:    r.source_name,
        type:           'department'
      }));
  
      return res.json({ status: 'success', data });

    } catch (err) {
      res.status(500).json({ status: 'error', message: 'خطأ في جلب المحتويات التي رفعتها' });
    }
  };

/**
 * GET /api/content-names
 * جلب كل أسماء المحتويات
 */
const getContentNames = async (req, res) => {
  try {
    const conn = await db.getConnection();
    const [rows] = await conn.execute(
      'SELECT id, name FROM content_names ORDER BY name ASC'
    );
    conn.release();
    return res.json({ status: 'success', data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'فشل جلب أسماء المحتويات.' });
  }
};

/**
 * POST /api/content-names
 * إضافة اسم محتوى جديد
 */
const addContentName = async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'الاسم مطلوب.' });
  }
  try {
    const conn = await db.getConnection();
    const [result] = await conn.execute(
      'INSERT INTO content_names (name) VALUES (?)',
      [name]
    );
    conn.release();
    return res.status(201).json({
      status: 'success',
      message: '✅ تم إضافة اسم المحتوى بنجاح',
      contentNameId: result.insertId
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: '❌ فشل في إضافة اسم المحتوى.' });
  }
};

/**
 * PUT /api/content-names/:id
 * تعديل اسم محتوى وتحديث كل المحتويات التي تستخدم الاسم القديم
 */
const updateContentName = async (req, res) => {
  const { id }   = req.params;
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'الاسم الجديد مطلوب.' });
  }

  const conn = await db.getConnection();
  try {
    const [rows] = await conn.execute(
      'SELECT name FROM content_names WHERE id = ?',
      [id]
    );
    if (!rows.length) {
      conn.release();
      return res.status(404).json({ message: '❌ لم يتم العثور على اسم المحتوى.' });
    }
    const oldName = rows[0].name;

    const [result] = await conn.execute(
      'UPDATE content_names SET name = ? WHERE id = ?',
      [name, id]
    );
    if (result.affectedRows === 0) {
      conn.release();
      return res.status(404).json({ message: '❌ لم يتم تحديث اسم المحتوى.' });
    }

    await conn.execute(
      'UPDATE contents SET name = ? WHERE name = ?',
      [name, oldName]
    );

    conn.release();
    return res.json({
      status: 'success',
      message: '✅ تم تعديل اسم المحتوى وكل المحتويات المرتبطة بنجاح'
    });
  } catch (err) {
    conn.release();
    console.error(err);
    return res.status(500).json({ message: '❌ فشل في تعديل اسم المحتوى.' });
  }
};

/**
 * DELETE /api/content-names/:id
 * حذف اسم المحتوى
 */
const deleteContentName = async (req, res) => {
  const { id } = req.params;
  try {
    const conn = await db.getConnection();
    const [result] = await conn.execute(
      'DELETE FROM content_names WHERE id = ?',
      [id]
    );
    conn.release();
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '❌ اسم المحتوى غير موجود أو تم حذفه مسبقاً.' });
    }
    return res.json({ status: 'success', message: '✅ تم حذف اسم المحتوى بنجاح' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: '❌ فشل في حذف اسم المحتوى.' });
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
      getContentNames,
  addContentName,
  updateContentName,
  deleteContentName,
    upload
  };
  