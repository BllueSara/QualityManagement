// routes/contentRoutes.js
const express = require('express');
const router  = express.Router();
const { getMyUploadedContent } = require('../controllers/contentController');

// GET /api/contents/my-uploads
router.get('/my-uploads', getMyUploadedContent);

module.exports = router;
