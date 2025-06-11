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
  getRoles
} = require('../controllers/usersController');

const router = express.Router();

// جميع المسارات مفصولة، بدون تكرار /users
router.get('/',                 authenticateToken, getUsers);              // GET /api/users
router.get('/:id',             authenticateToken, getUserById);           // GET /api/users/:id
router.post('/',               authenticateToken, addUser);               // POST /api/users
router.put('/:id',             authenticateToken, updateUser);            // PUT /api/users/:id
router.delete('/:id',          authenticateToken, deleteUser);            // DELETE /api/users/:id
router.put('/:id/role',        authenticateToken, changeUserRole);        // PUT /api/users/:id/role
router.put('/:id/reset-password', authenticateToken, adminResetPassword);// PUT /api/users/:id/reset-password
router.get('/roles',           authenticateToken, getRoles);              // GET /api/users/roles

module.exports = router;
