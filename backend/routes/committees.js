const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const committeesController = require('../controllers/committeesController');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'image') {
      cb(null, path.join(__dirname, '../uploads/images'));
    } else if (file.fieldname === 'file') {
      cb(null, path.join(__dirname, '../uploads/content_files'));
    } else {
      cb(new Error('Unrecognized field'), null);
    }
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// 🟢 ثابتة أولاً: Folder Name APIs
router.get('/folder-names', committeesController.getFolderNames);
router.post('/folder-names', committeesController.addFolderName);
router.put('/folder-names/:id', committeesController.updateFolderName);
router.delete('/folder-names/:id', committeesController.deleteFolderName);

// 🟢 ثابتة أولاً: Content Title APIs
router.get('/content-titles', committeesController.getContentTitles);
router.post('/content-titles', committeesController.addContentTitle);
router.put('/content-titles/:id', committeesController.updateContentTitle);
router.delete('/content-titles/:id', committeesController.deleteContentTitle);

// 🟢 Approval routes
router.get('/contents/:contentId/approvals', committeesController.getApprovals);
router.post('/contents/:contentId/approve', committeesController.approveContent);

// 🟢 Content routes
router.get('/contents/my-uploads', committeesController.getMyUploadedCommitteeContents);
router.get('/contents/track/:contentId', committeesController.trackCommitteeContent);
router.get('/contents/:id', committeesController.getContent);
router.put('/contents/:id', upload.single('file'), committeesController.updateContent);
router.delete('/contents/:id', committeesController.deleteContent);

// 🟢 Folder routes
router.get('/folders/:id', committeesController.getFolder);
router.get('/folders/:folderId/contents', committeesController.getContents);
router.post('/folders/:folderId/contents', upload.single('file'), committeesController.addContent);
router.put('/folders/:id', committeesController.updateFolder);
router.delete('/folders/:id', committeesController.deleteFolder);

// 🟢 Committee folders (based on committeeId)
router.get('/:committeeId/folders', committeesController.getFolders);
router.post('/:committeeId/folders', committeesController.addFolder);

// 🟢 Committee main
router.get('/', committeesController.getCommittees);
router.post('/', upload.single('image'), committeesController.addCommittee);
router.put('/:id', upload.single('image'), committeesController.updateCommittee);
router.delete('/:id', committeesController.deleteCommittee);
router.get('/:id', committeesController.getCommittee);  // هذا آخر واحد لأنه ديناميكي


module.exports = router; 