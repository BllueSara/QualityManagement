const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const { authenticateToken, } = require('../controllers/authController');
const { 
    getClassifications, 
    getClassificationById,
    createClassification,
    updateClassification,
    deleteClassification,
    getHarmLevels,
    getHarmLevelById,
    createHarmLevel,
    updateHarmLevel,
    deleteHarmLevel
} = require('../controllers/ticketController');

router.get('/classifications', authenticateToken, getClassifications);
router.get('/classifications/:id', authenticateToken, getClassificationById);
router.post('/classifications', authenticateToken, createClassification);
router.put('/classifications/:id', authenticateToken, updateClassification);
router.delete('/classifications/:id', authenticateToken, deleteClassification);

router.get('/harm-levels', authenticateToken, getHarmLevels);
router.get('/harm-levels/:id', authenticateToken, getHarmLevelById);
router.post('/harm-levels', authenticateToken, createHarmLevel);
router.put('/harm-levels/:id', authenticateToken, updateHarmLevel);
router.delete('/harm-levels/:id', authenticateToken, deleteHarmLevel);

// Get all departments
router.get('/departments', authenticateToken, ticketController.getDepartments);

// Create a new ticket
router.post('/', authenticateToken, ticketController.createTicket);

// Get all tickets
router.get('/assigned', authenticateToken, ticketController.getAssignedTickets);

router.get('/', authenticateToken, ticketController.getAllTickets);

// Get a single ticket
router.get('/:id', authenticateToken, ticketController.getTicket);

// Update a ticket
router.put('/:id', authenticateToken, ticketController.updateTicket);

// Delete a ticket
router.delete('/:id', authenticateToken, ticketController.deleteTicket);

// Assign a ticket

// Get ticket status history
router.get('/:id/history', authenticateToken, ticketController.getTicketStatusHistory);

router.post('/:id/replies', authenticateToken, ticketController.addReply);

router.post('/:id/assign', authenticateToken, ticketController.assignToUsers);

// جلب المستخدمين المكلفين بتذكرة معينة
router.get('/:id/assign', authenticateToken, ticketController.getTicketAssignees);

// GET /api/tickets/assigned
router.get('/:id/track', authenticateToken, ticketController.trackTicket);

// POST /api/tickets/log-view - تسجيل عرض التذكرة
router.post('/log-view', authenticateToken, ticketController.logTicketView);

module.exports = router; 