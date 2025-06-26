const express = require('express');
const router = express.Router();
const { getClosedTicketsReport } = require('../controllers/ticketReportController');

router.get('/closed-tickets', getClosedTicketsReport);

module.exports = router; 