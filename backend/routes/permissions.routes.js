const express = require('express');
const { authenticateToken } = require('../controllers/authController');
const {
  getUserPermissions,
  updateUserPermissions,
  addUserPermission,
  removeUserPermission
} = require('../controllers/permissionsController');

const router = express.Router();

// جلب وتحديث دفعة واحدة
router.get(  '/users/:id/permissions',      authenticateToken, getUserPermissions);
router.put(  '/users/:id/permissions',      authenticateToken, updateUserPermissions);

// إضافة/إزالة جزئية
router.post(   '/users/:id/permissions/:key',  authenticateToken, addUserPermission);
router.delete( '/users/:id/permissions/:key',  authenticateToken, removeUserPermission);

module.exports = router;
