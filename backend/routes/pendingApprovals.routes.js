const express = require('express');
const router = express.Router();
const controller = require('../controllers/pendingApprovalController');

router.get('/', controller.getPendingApprovals);
router.post('/send', controller.sendApprovalRequest);
router.put('/update-approvers', controller.updateApprovers);

module.exports = router;
