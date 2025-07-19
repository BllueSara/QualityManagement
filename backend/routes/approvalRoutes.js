const express = require('express');
const router  = express.Router();
const {
  getUserPendingApprovals,
  handleApproval,
  getAssignedApprovals,
  delegateApproval,
  getProxyApprovals,
  acceptProxyDelegation,
  acceptAllProxyDelegations,
  revokeAllDelegations
} = require('../controllers/approvalController');



router.get('/', getUserPendingApprovals);
router.post('/:contentId/approve', handleApproval);
router.get('/assigned-to-me', getAssignedApprovals);
router.post('/:id/delegate', delegateApproval);
router.get('/proxy', getProxyApprovals);
router.post('/proxy/accept/:id', acceptProxyDelegation);
router.post('/proxy/accept-all', acceptAllProxyDelegations);
router.post('/delegate-all', require('../controllers/approvalController').delegateAllApprovals);
router.post('/bulk-delegation/process', require('../controllers/approvalController').processBulkDelegation);
router.delete('/delegations/by-user/:userId', revokeAllDelegations);
// إلغاء تفويض ملف واحد (عادي)
router.delete('/:id/delegation', require('../controllers/approvalController').revokeDelegation);
// جلب كل التفويضات النشطة التي أعطاها مستخدم معيّن
router.get('/delegated-by/:userId', require('../controllers/approvalController').getDelegationsByUser);
// جلب ملخص الأشخاص الذين تم تفويضهم من المستخدم الحالي
router.get('/delegation-summary/:userId', require('../controllers/approvalController').getDelegationSummaryByUser);

module.exports = router;
