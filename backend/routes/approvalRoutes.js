const express = require('express');
const router  = express.Router();
const {
  getUserPendingApprovals,
  handleApproval,
  getAssignedApprovals,
  delegateApproval,
  getProxyApprovals,
  acceptProxyDelegation,
  revokeAllDelegations,
  cleanupOldApprovalLogs
} = require('../controllers/approvalController');



router.get('/', getUserPendingApprovals);
router.post('/:contentId/approve', handleApproval);
router.get('/assigned-to-me', getAssignedApprovals);
router.post('/:id/delegate', delegateApproval);
// دالة التفويض الفردي الجديدة
router.post('/delegate-single', require('../controllers/approvalController').delegateSingleApproval);
// API endpoints للبوب أب اقرار التفويض
router.post('/delegations/single', require('../controllers/approvalController').delegateSingleApproval);
router.post('/delegations/bulk', require('../controllers/approvalController').delegateAllApprovalsUnified);
// جلب التفويضات الفردية للأقسام
router.get('/single-delegations/:userId', require('../controllers/approvalController').getSingleDelegations);
// معالجة التفويضات الفردية للأقسام (قبول/رفض)
router.post('/single-delegation-unified/process', require('../controllers/approvalController').processSingleDelegationUnified);
router.get('/proxy', getProxyApprovals);
router.post('/proxy/accept/:id', acceptProxyDelegation);
router.post('/proxy/accept-all-unified', require('../controllers/approvalController').acceptAllProxyDelegationsUnified);
router.post('/delegate-all-unified', require('../controllers/approvalController').delegateAllApprovalsUnified);
router.delete('/delegations/by-user/:userId', revokeAllDelegations);
// إلغاء تفويض ملف واحد (عادي)
router.delete('/:id/delegation', require('../controllers/approvalController').revokeDelegation);
// جلب كل التفويضات النشطة التي أعطاها مستخدم معيّن
router.get('/delegated-by/:userId', require('../controllers/approvalController').getDelegationsByUser);
// جلب التفويضات المعلقة الموحدة (أقسام ولجان)
router.get('/pending-delegations-unified/:userId', require('../controllers/approvalController').getPendingDelegationsUnified);
// معالجة التفويض المباشر الموحد (أقسام ولجان)
router.post('/direct-delegation-unified/process', require('../controllers/approvalController').processDirectDelegationUnified);
// معالجة التفويض الجماعي الموحد (أقسام ولجان)
router.post('/bulk-delegation-unified/process', require('../controllers/approvalController').processBulkDelegationUnified);

// جلب ملخص التفويضات لمستخدم معين
router.get('/delegation-summary/:userId', require('../controllers/approvalController').getDelegationSummaryByUser);

// جلب سجلات التفويضات لمستخدم معين
router.get('/delegation-logs/:userId/:delegatorId', require('../controllers/approvalController').getDelegationLogs);

// جلب حالة موافقة المستخدم مع مفوض معين
router.get('/user-approval-status/:userId/:delegatorId', require('../controllers/approvalController').getUserApprovalStatus);

// دالة تشخيص لفحص التفويضات (للتطوير فقط)
router.get('/debug-delegations/:userId', require('../controllers/approvalController').debugDelegations);

// فحص نوع التفويض في active_delegations
router.get('/check-delegation-type/:delegateId/:delegatorId', require('../controllers/approvalController').checkActiveDelegationType);

// جلب بيانات تأكيد التفويض للمفوض له
router.post('/delegation-confirmation-data', require('../controllers/approvalController').getDelegationConfirmationData);

// جلب اقرارات التفويض للمدير
router.get('/delegation-confirmations', require('../controllers/approvalController').getDelegationConfirmations);

// تنظيف السجلات القديمة من approval_logs (للمشرفين فقط)
router.post('/cleanup-old-logs', cleanupOldApprovalLogs);

module.exports = router;
