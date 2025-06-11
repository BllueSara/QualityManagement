const express = require('express');
const { authenticateToken } = require('../controllers/authController');
const {
  getUsers, getUserById, addUser,
  updateUser, deleteUser,
  changeUserRole, adminResetPassword ,getRoles
} = require('../controllers/usersController');
const router = express.Router();

router.get(   '/users',                 authenticateToken, getUsers);
router.get(   '/users/:id',             authenticateToken, getUserById);
router.post(  '/users',                 authenticateToken, addUser);
router.put(   '/users/:id',             authenticateToken, updateUser);
router.delete('/users/:id',             authenticateToken, deleteUser);
router.put(   '/users/:id/role',        authenticateToken, changeUserRole);
router.put(   '/users/:id/reset-password', authenticateToken, adminResetPassword);
router.get('/roles', authenticateToken, getRoles);

module.exports = router;
