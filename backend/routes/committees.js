const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const committeesController = require('../controllers/committeesController');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './uploads/images');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// Committee routes
router.get('/', committeesController.getCommittees);
router.get('/:id', committeesController.getCommittee);
router.post('/', upload.single('image'), committeesController.addCommittee);
router.put('/:id', upload.single('image'), committeesController.updateCommittee);
router.delete('/:id', committeesController.deleteCommittee);

// Folder routes
router.get('/:committeeId/folders', committeesController.getFolders);
router.get('/folders/:id', committeesController.getFolder);
router.post('/:committeeId/folders', committeesController.addFolder);
router.put('/folders/:id', committeesController.updateFolder);
router.delete('/folders/:id', committeesController.deleteFolder);

// Content routes
router.get('/contents/my-uploads', committeesController.getMyUploadedCommitteeContents);
router.get('/contents/track/:contentId', committeesController.trackCommitteeContent);
router.get('/contents/:id', committeesController.getContent);
router.get('/folders/:folderId/contents', committeesController.getContents);
router.post('/folders/:folderId/contents', upload.single('file'), committeesController.addContent);
router.put('/contents/:id', upload.single('file'), committeesController.updateContent);
router.delete('/contents/:id', committeesController.deleteContent);

// Approval routes
router.get('/contents/:contentId/approvals', committeesController.getApprovals);
router.post('/contents/:contentId/approve', committeesController.approveContent);

module.exports = router; 