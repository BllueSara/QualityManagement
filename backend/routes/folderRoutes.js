// routes/folderRoutes.js
const express = require('express');
const router  = express.Router({ mergeParams: true });
const { getFolders, createFolder, updateFolder, deleteFolder, getFolderById } = require('../controllers/folderController');

// GET  /api/departments/:departmentId/folders
router.get('/',            getFolders);
// POST /api/departments/:departmentId/folders
router.post('/',           createFolder);
// GET  /api/departments/:departmentId/folders/:folderId
router.get('/:folderId',   getFolderById);
// PUT  /api/departments/:departmentId/folders/:folderId
router.put('/:folderId',   updateFolder);
// DELETE /api/departments/:departmentId/folders/:folderId
router.delete('/:folderId',deleteFolder);

module.exports = router;
