// routes/folderContentRoutes.js
const express = require('express');
const router  = express.Router();
const { 
  getContentsByFolderId, 
  addContent, 
  updateContent, 
  deleteContent, 
  downloadContent,
  getContentById,
  approveContent
} = require('../controllers/contentController');

// GET  /api/folders/:folderId/contents
router.get('/:folderId/contents', getContentsByFolderId);
// POST /api/folders/:folderId/contents
router.post('/:folderId/contents', addContent);
// PUT  /api/contents/:contentId
router.put('/contents/:contentId', updateContent);
// DELETE /api/contents/:contentId
router.delete('/contents/:contentId', deleteContent);
// GET  /api/contents/:contentId
router.get('/contents/:contentId', getContentById);
// GET  /api/contents/:contentId/download
router.get('/contents/:contentId/download', downloadContent);
// POST /api/contents/:contentId/approve
router.post('/contents/:contentId/approve', approveContent);

module.exports = router;
