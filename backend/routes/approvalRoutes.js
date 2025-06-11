const express = require('express');
const router  = express.Router();
const {
  getUserPendingApprovals,
  handleApproval,
  getAssignedApprovals // ✅ أضف هذا
} = require('../controllers/approvalController');



router.get('/', getUserPendingApprovals); // /api/approvals

router.post('/:contentId/approve', handleApproval); 
router.get('/assigned-to-me', getAssignedApprovals);



module.exports = router;
