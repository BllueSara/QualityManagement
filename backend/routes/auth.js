const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/authController');

// مسار التسجيل
router.post('/register', register);

// مسار تسجيل الدخول
router.post('/login', login);

module.exports = router; 