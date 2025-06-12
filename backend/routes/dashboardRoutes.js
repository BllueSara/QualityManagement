const express = require('express');
const router = express.Router();
const {
  getStats,
  getClosedWeek
} = require('../controllers/dashboardController');

// GET /api/dashboard/stats
router.get('/stats', getStats);

// GET /api/dashboard/closed-week
router.get('/closed-week', getClosedWeek);

module.exports = router;