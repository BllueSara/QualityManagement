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

// 2. Approve / reject
router.post('/:contentId/approve', handleCommitteeApproval);

// 3. All committees assigned to me or created by me
router.get('/assigned-to-me', getAssignedCommitteeApprovals);

// 4.1. Delegate single committee approval (لا يضيف إلى active_delegations) - يجب أن يكون أولاً
router.post('/delegate-single', require('../controllers/committeeApprovalController').delegateSingleCommitteeApproval);

// 4. Delegate my approval
router.post('/:id/delegate', delegateCommitteeApproval);

// 5. View approvals where I'm proxy
router.get('/proxy', getProxyCommitteeApprovals);

// 6. Accept proxy delegation
router.post('/proxy/accept/:id', acceptProxyDelegationCommittee);

router.post('/proxy/accept-all', acceptAllProxyDelegationsCommittee);

// جلب التفويضات الفردية للجان
router.get('/single-delegations/:userId', require('../controllers/committeeApprovalController').getSingleCommitteeDelegations);
// معالجة التفويضات الفردية للجان (قبول/رفض)
router.post('/single-delegation-unified/process', require('../controllers/committeeApprovalController').processSingleCommitteeDelegationUnified);

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
