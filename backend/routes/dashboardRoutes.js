const express = require('express');
const router = express.Router();
const {
  getStats,
  getClosedWeek,
  exportDashboardExcel
} = require('../controllers/dashboardController');

// GET /api/dashboard/stats
router.get('/stats', getStats);

// GET /api/dashboard/closed-week
router.get('/closed-week', getClosedWeek);

// GET /api/dashboard/export-excel
router.get('/export-excel', exportDashboardExcel);

module.exports = router;