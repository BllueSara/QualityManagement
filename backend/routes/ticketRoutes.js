const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const { authenticateToken, checkRole } = require('../controllers/authController');

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
router.delete('/:id', authenticateToken, checkRole(['admin']), ticketController.deleteTicket);

// Assign a ticket

// Get ticket status history
router.get('/:id/history', authenticateToken, ticketController.getTicketStatusHistory);

router.post('/:id/replies', authenticateToken, ticketController.addReply);

router.post('/:id/assign', authenticateToken, ticketController.assignToUsers);

// GET /api/tickets/assigned

module.exports = router; 