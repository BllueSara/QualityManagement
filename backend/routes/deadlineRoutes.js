const express = require('express');
const router = express.Router();
const deadlineController = require('../controllers/deadlineController');
const { authenticateToken } = require('../controllers/authController');

// تعيين مواعيد نهائية للمعتمدين
router.post('/set-deadlines', authenticateToken, deadlineController.setDeadlines);

// جلب المواعيد النهائية لمحتوى معين
router.get('/:contentType/:contentId', authenticateToken, deadlineController.getDeadlines);

// جلب المواعيد النهائية النشطة للمستخدم الحالي
router.get('/user/active', authenticateToken, deadlineController.getUserDeadlines);

// فحص المواعيد النهائية المنتهية الصلاحية (للمشرفين)
router.post('/check-expired', authenticateToken, deadlineController.checkExpiredDeadlines);

// حذف المواعيد النهائية لمحتوى معين
router.delete('/:contentType/:contentId', authenticateToken, deadlineController.deleteDeadlines);

module.exports = router; 