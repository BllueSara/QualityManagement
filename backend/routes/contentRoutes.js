const express = require('express');
const router = express.Router();
const multer = require('multer');
const { getContentsByFolderId, addContent, updateContent, deleteContent, downloadContent, getContentById, approveContent } = require('../controllers/contentController');

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

// مسار لجلب جميع المحتويات لمجلد معين
router.get('/folders/:folderId/contents', getContentsByFolderId);

// مسار لإضافة محتوى جديد لمجلد معين (مع تحميل الملف)
router.post('/folders/:folderId/contents', upload.single('file'), addContent);

// مسار لتعديل محتوى موجود (مع تحميل الملف اختياريًا)
router.put('/contents/:contentId', upload.single('file'), updateContent);

// مسار لحذف محتوى
router.delete('/contents/:contentId', deleteContent);

// مسار لتنزيل محتوى
router.get('/contents/:contentId/download', downloadContent);

// مسار لجلب محتوى حسب المعرف
router.get('/contents/:contentId', getContentById);

// مسار للموافقة على محتوى
router.post('/contents/:contentId/approve', approveContent);

module.exports = router; 