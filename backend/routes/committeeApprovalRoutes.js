const express = require('express');
const router = express.Router();
const { getAssignedApprovals } = require('../controllers/approvalController');
const { delegateCommitteeApproval } = require('../controllers/pendingCommitteeApprovalController');

router.get('/assigned-to-me', getAssignedApprovals);
router.post('/:contentId/delegate', delegateCommitteeApproval);

module.exports = router; 