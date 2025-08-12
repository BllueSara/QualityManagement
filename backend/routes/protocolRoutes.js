const express = require('express');
const router = express.Router();
const protocolController = require('../controllers/protocolController');
const { authenticateToken } = require('../controllers/authController');

router.use(authenticateToken); // Apply authentication to all routes

// Basic CRUD operations
router.post('/', protocolController.createProtocol);
router.get('/', protocolController.getAllProtocols);
// جلب المحاضر المرتبطة بمجلد معين
router.get('/folder/:folderId', protocolController.getProtocolsByFolder);
// Specific routes MUST come before generic '/:id'
router.get('/pending/approvals', protocolController.getPendingApprovals);
router.get('/track/:id', protocolController.getProtocolTrack);
router.get('/:id/approvals', protocolController.getApprovalLogs);
router.post('/:id/approve', protocolController.handleApproval);
router.post('/:id/approvers', protocolController.addApprover);
router.get('/:id/pdf', protocolController.downloadPDF);
router.get('/:id', protocolController.getProtocolById);
router.put('/:id', protocolController.updateProtocol);
router.delete('/:id', protocolController.deleteProtocol);

// Approval operations (moved above)

// Protocol delegations (like departments/committees)
router.get('/single-delegations/:userId', protocolController.getSingleDelegations);
router.post('/single-delegation-unified/process', protocolController.processSingleProtocolDelegationUnified);
router.post('/bulk-delegation-unified/process', protocolController.processBulkProtocolDelegationUnified);

// Delegation operations
router.post('/delegate-single', protocolController.delegateSingleProtocolApproval);
router.post('/delegate-all-unified', protocolController.delegateAllProtocolApprovals);
router.post('/delegation-confirmation-data', protocolController.getDelegationConfirmationData);
router.post('/new-delegation-confirmation-data', protocolController.getDelegationConfirmationData);
router.post('/existing-delegation-confirmation-data', protocolController.getExistingDelegationConfirmationData);

// Delegation management (like departments/committees)
router.get('/delegation-summary/:userId', protocolController.getProtocolDelegationSummaryByUser);
router.delete('/delegations/by-user/:delegatorId', protocolController.revokeProtocolDelegations);

// PDF operations (moved above)

// Statistics
router.get('/stats/summary', protocolController.getProtocolStats);

// Development/initialization
router.post('/init/tables', protocolController.initializeTables);

module.exports = router;
