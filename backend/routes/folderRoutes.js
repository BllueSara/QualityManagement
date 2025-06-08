const express = require('express');
const router = express.Router();
const folderController = require('../controllers/folderController');
// const authMiddleware = require('../middleware/authMiddleware'); // تم إزالته

// تطبيق middleware المصادقة على جميع المسارات (تم إزالته)
// router.use(authMiddleware);

// مسارات المجلدات
router.get('/departments/:departmentId/folders', folderController.getFolders);
router.get('/folders/:folderId', folderController.getFolderById);
router.post('/departments/:departmentId/folders', folderController.createFolder);
router.put('/folders/:folderId', folderController.updateFolder);
router.delete('/folders/:folderId', folderController.deleteFolder);

module.exports = router; 