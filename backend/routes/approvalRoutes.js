const express = require('express');
const router  = express.Router();
const {
  getUserPendingApprovals,
  handleApproval,
  getAssignedApprovals,
  delegateApproval,
  getProxyApprovals
} = require('../controllers/approvalController');



router.get('/', getUserPendingApprovals);
router.post('/:contentId/approve', handleApproval);
router.get('/assigned-to-me', getAssignedApprovals);
router.post('/:id/delegate', delegateApproval);
router.get('/proxy', getProxyApprovals);

module.exports = router;
