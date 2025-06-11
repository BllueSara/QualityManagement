const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const { authenticateToken, checkRole } = require('../controllers/authController');

// Get all departments
router.get('/departments', authenticateToken, ticketController.getDepartments);

// Create a new ticket
router.post('/', authenticateToken, ticketController.createTicket);

// Get all tickets
router.get('/', authenticateToken, ticketController.getAllTickets);

// Get a single ticket
router.get('/:id', authenticateToken, ticketController.getTicket);

// Update a ticket
router.put('/:id', authenticateToken, ticketController.updateTicket);

// Delete a ticket
router.delete('/:id', authenticateToken, checkRole(['admin']), ticketController.deleteTicket);

// Assign a ticket
router.post('/:id/assign', authenticateToken, checkRole(['admin', 'manager']), ticketController.assignTicket);

// Get ticket status history
router.get('/:id/history', authenticateToken, ticketController.getTicketStatusHistory);

module.exports = router; 