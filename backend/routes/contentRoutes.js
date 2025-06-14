// routes/contentRoutes.js
const express = require('express');
const multer  = require('multer');
const mysql = require('mysql2/promise');
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});
const path = require('path');
const fs = require('fs');

const { getMyUploadedContent, addContent } = require('../controllers/contentController');
const { getContentById } = require('../controllers/contentController');
const { updateContent } = require('../controllers/contentController');


const router = express.Router();


// وسطح التخزين في مجلّد uploads (أو عدّل على كيفما تحب)
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
const upload = multer({ storage });

// GET /api/contents/my-uploads
router.get('/my-uploads', getMyUploadedContent);


// جلب تفاصيل تتبع الطلب
router.get('/track/:id', async (req, res) => {
  const contentId = req.params.id;

  try {
    // جلب معلومات المحتوى نفسه
    const [contentRows] = await db.execute(`
      SELECT c.title, c.approval_status, c.created_at, d.name AS department, f.name AS folder
      FROM contents c
      LEFT JOIN folders f ON c.folder_id = f.id
      LEFT JOIN departments d ON f.department_id = d.id
      WHERE c.id = ?
    `, [contentId]);

    // جلب سجل التواقيع حسب القسم
    const [logs] = await db.execute(`
      SELECT d.name AS department_name, al.status, al.created_at, al.comments
      FROM approval_logs al
      JOIN users u ON al.approver_id = u.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE al.content_id = ?
      ORDER BY al.created_at ASC
    `, [contentId]);

    // جلب الأقسام التي لم توقع بعد
    const [pendingApprovers] = await db.execute(`
      SELECT DISTINCT d.name AS department_name
      FROM content_approvers ca
      JOIN users u ON ca.user_id = u.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE ca.content_id = ?
        AND NOT EXISTS (
          SELECT 1 FROM approval_logs al
          WHERE al.content_id = ca.content_id AND al.approver_id = ca.user_id
        )
    `, [contentId]);

    // إرسال الرد النهائي
    res.json({
      status: 'success',
      content: contentRows[0],
      timeline: logs.map(log => ({
        department: log.department_name || 'غير معروف',
        status: log.status,
        created_at: log.created_at,
        comments: log.comments
      })),
      pending: pendingApprovers.map(p => p.department_name || 'غير معروف')
    });
  } catch (err) {
    console.error('Error fetching track info:', err);
    res.status(500).json({ status: 'error', message: 'فشل جلب بيانات التتبع' });
  }
});

router.get('/:contentId', getContentById);


// POST /api/contents
// • الحقل النصّي title في req.body  
// • الملف في req.file
router.post(
  '/',
  upload.single('file'),   // يستخدم حقل form-data اسمه "file"
  addContent
);


router.put('/:contentId', upload.single('file'), updateContent);


module.exports = router;
