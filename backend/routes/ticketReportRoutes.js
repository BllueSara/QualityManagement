const express = require('express');
const router = express.Router();
const { getClosedTicketsReport } = require('../controllers/ticketReportController');
const { getClassifications } = require('../controllers/ticketController');
const { authenticateToken } = require('../controllers/authController');

router.get('/closed-tickets', authenticateToken, getClosedTicketsReport);
router.get('/classifications', authenticateToken, getClassifications);

module.exports = router; 