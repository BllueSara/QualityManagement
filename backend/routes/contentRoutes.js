// routes/contentRoutes.js
const express = require('express');
const multer  = require('multer');
const { getMyUploadedContent, addContent } = require('../controllers/contentController');

const router = express.Router();

// وسطح التخزين في مجلّد uploads (أو عدّل على كيفما تحب)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename:    (req, file, cb) => {
    // اسم الملف مع timestamp لتفادي التكرار
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// GET /api/contents/my-uploads
router.get('/my-uploads', getMyUploadedContent);

// POST /api/contents
// • الحقل النصّي title في req.body  
// • الملف في req.file
router.post(
  '/',
  upload.single('file'),   // يستخدم حقل form-data اسمه "file"
  addContent
);

module.exports = router;
