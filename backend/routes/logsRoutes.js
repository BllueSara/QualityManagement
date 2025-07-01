const express = require('express');
const { logContentView } = require('../controllers/contentController');
const router = express.Router();

// POST /api/logs/content-view - تسجيل عرض المحتوى
router.post('/content-view', logContentView);

module.exports = router; 