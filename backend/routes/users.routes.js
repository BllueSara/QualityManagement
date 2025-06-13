const express = require('express');
const { authenticateToken } = require('../controllers/authController');
const {
  getUsers,
  getUserById,
  addUser,
  updateUser,
  deleteUser,
  changeUserRole,
  adminResetPassword,
  getRoles,
  getLogs,
  getNotifications,
  markAsRead,
  deleteNotification
} = require('../controllers/usersController');

const router = express.Router();

// 1) أولاً الراوت العام
router.get('/',                   authenticateToken, getUsers);
router.get('/logs',               authenticateToken, getLogs);

// 2) الراوت الخاص بجلب الأدوار — لازم يكون قبل('/:id')
router.get('/roles',              authenticateToken, getRoles);

// 3) الراوتس المرتبطة بالـ notifications
router.get('/:id/notifications',          authenticateToken, getNotifications);
router.put('/:id/notifications/:nid/read',authenticateToken, markAsRead);
router.delete('/:id/notifications/:nid',  authenticateToken, deleteNotification);

// 4) الباقي اللي يستخدم الـ :id
router.get('/:id',                authenticateToken, getUserById);
router.post('/',                  authenticateToken, addUser);
router.put('/:id',                authenticateToken, updateUser);
router.delete('/:id',             authenticateToken, deleteUser);
router.put('/:id/role',           authenticateToken, changeUserRole);
router.put('/:id/reset-password', authenticateToken, adminResetPassword);

module.exports = router;
