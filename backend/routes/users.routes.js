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

// Users endpoints
router.get('/',                   authenticateToken, getUsers);     
router.get('/logs', authenticateToken, getLogs);                          // GET /api/users/logs
// Notifications endpoints
router.get('/:id/notifications',          authenticateToken, getNotifications);     // GET /api/users/:id/notifications
router.put('/:id/notifications/:id/read', authenticateToken, markAsRead);          // PUT /api/users/:id/notifications/:id/read
router.delete('/:id/notifications/:id',   authenticateToken, deleteNotification);  // DELETE /api/users/:id/notifications/:id          // GET /api/users
router.get('/:id',                authenticateToken, getUserById);            // GET /api/users/:id
router.post('/',                  authenticateToken, addUser);               // POST /api/users
router.put('/:id',                authenticateToken, updateUser);            // PUT /api/users/:id
router.delete('/:id',             authenticateToken, deleteUser);            // DELETE /api/users/:id
router.put('/:id/role',           authenticateToken, changeUserRole);       // PUT /api/users/:id/role
router.put('/:id/reset-password', authenticateToken, adminResetPassword); // PUT /api/users/:id/reset-password
router.get('/roles',              authenticateToken, getRoles);               // GET /api/users/roles

// Logs endpoint

module.exports = router;