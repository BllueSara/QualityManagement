const express = require('express');
const router  = express.Router();

const {
  getUserPendingCommitteeApprovals,
  handleCommitteeApproval,
  getAssignedCommitteeApprovals,
  delegateCommitteeApproval,
  getProxyCommitteeApprovals
} = require('../controllers/committeeApprovalController');

// 1. Pending approvals for the user
router.get('/', getUserPendingCommitteeApprovals);

// 2. Approve / reject
router.post('/:contentId/approve', handleCommitteeApproval);

// 3. All committees assigned to me or created by me
router.get('/assigned-to-me', getAssignedCommitteeApprovals);

// 4. Delegate my approval
router.post('/:id/delegate', delegateCommitteeApproval);

// 5. View approvals where I'm proxy
router.get('/proxy', getProxyCommitteeApprovals);

module.exports = router;
