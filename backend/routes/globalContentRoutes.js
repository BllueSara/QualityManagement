// routes/contentRoutes.js
const express = require('express');
const {
  getContentNames,
  addContentName,
  updateContentName,
  deleteContentName
} = require('../controllers/contentController');

const router = express.Router();

// 🔁 Routes مستقلة لا تتأثر بـ /:folderId
router.get('/content-names', getContentNames);
router.post('/content-names', addContentName);
router.put('/content-names/:id', updateContentName);
router.delete('/content-names/:id', deleteContentName);

module.exports = router;
