const express = require('express');
const router = express.Router();
const { getDepartments } = require('../controllers/departmentController');

// مسار جلب الأقسام
router.get('/', getDepartments);

module.exports = router; 