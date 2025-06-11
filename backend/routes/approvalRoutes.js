const express = require('express');
const router  = express.Router();
const {
  getUserPendingApprovals,
  handleApproval
} = require('../controllers/approvalController');

// صفحة اعتماداتي
router.get('/',     getUserPendingApprovals);

// اعتماد/رفض محتوى
router.post('/:contentId/approve', handleApproval);

module.exports = router;
