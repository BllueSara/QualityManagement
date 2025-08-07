const express = require('express');
const router  = express.Router();

const {
  getUserPendingCommitteeApprovals,
  handleCommitteeApproval,
  getAssignedCommitteeApprovals,
  delegateCommitteeApproval,
  getProxyCommitteeApprovals,
  acceptProxyDelegationCommittee,
  acceptAllProxyDelegationsCommittee,
  revokeAllCommitteeDelegations
} = require('../controllers/committeeApprovalController');

// 1. Pending approvals for the user
router.get('/', getUserPendingCommitteeApprovals);

// 2. All committees assigned to me or created by me
router.get('/assigned-to-me', getAssignedCommitteeApprovals);

// 3. Specific delegation routes (must come before parameterized routes)
router.post('/delegate-single', require('../controllers/committeeApprovalController').delegateSingleCommitteeApproval);

router.post('/committee-delegations/single', require('../controllers/committeeApprovalController').delegateSingleCommitteeApproval);
router.post('/committee-delegations/bulk', require('../controllers/committeeApprovalController').delegateAllCommitteeApprovalsUnified);
router.post('/single-delegation-unified/process', require('../controllers/committeeApprovalController').processSingleCommitteeDelegationUnified);

// 4. Parameterized routes (must come after specific routes)
router.post('/:contentId/approve', handleCommitteeApproval);
router.post('/:id/delegate', delegateCommitteeApproval);

// 5. View approvals where I'm proxy
router.get('/proxy', getProxyCommitteeApprovals);

// 6. Accept proxy delegation
router.post('/proxy/accept/:id', acceptProxyDelegationCommittee);

router.post('/proxy/accept-all', acceptAllProxyDelegationsCommittee);

// جلب التفويضات الفردية للجان
router.get('/single-delegations/:userId', require('../controllers/committeeApprovalController').getSingleCommitteeDelegations);

// إلغاء جميع تفويضات اللجان التي أعطاها مستخدم معيّن
router.delete('/delegations/by-user/:userId', revokeAllCommitteeDelegations);

// إلغاء تفويض ملف لجنة واحد
router.delete('/:id/delegation', require('../controllers/committeeApprovalController').revokeCommitteeDelegation);

// جلب كل تفويضات اللجان النشطة التي أعطاها مستخدم معيّن
router.get('/delegated-by/:userId', require('../controllers/committeeApprovalController').getCommitteeDelegationsByUser);

// جلب ملخص الأشخاص الذين تم تفويضهم من المستخدم الحالي في تفويضات اللجان
router.get('/delegation-summary/:userId', require('../controllers/committeeApprovalController').getCommitteeDelegationSummaryByUser);

// جلب سجلات التفويضات للجان لمستخدم معين
router.get('/delegation-logs/:userId/:delegatorId', require('../controllers/committeeApprovalController').getCommitteeDelegationLogs);

// فحص نوع التفويض في active_delegations للجان
router.get('/check-delegation-type/:delegateId/:delegatorId', require('../controllers/committeeApprovalController').checkActiveCommitteeDelegationType);

module.exports = router;
