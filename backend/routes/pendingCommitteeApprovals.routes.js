const express = require('express');
const router = express.Router();
const controller = require('../controllers/pendingCommitteeApprovalController');

router.get('/', controller.getPendingApprovals);
router.post('/send', controller.sendApprovalRequest);

module.exports = router; 