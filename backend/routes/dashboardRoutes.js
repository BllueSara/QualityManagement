const express = require('express');
const router = express.Router();
const {
  getStats,
  getClosedWeek,
  exportDashboardExcel,
  getDepartmentStats,
  getCommitteeStats,
  getMonthlyPerformance,
  getProtocolStats
} = require('../controllers/dashboardController');

// GET /api/dashboard/stats
router.get('/stats', getStats);

// GET /api/dashboard/closed-week
router.get('/closed-week', getClosedWeek);

// GET /api/dashboard/export-excel
router.get('/export-excel', exportDashboardExcel);

// GET /api/dashboard/department-stats
router.get('/department-stats', getDepartmentStats);

// GET /api/dashboard/committee-stats
router.get('/committee-stats', getCommitteeStats);

// GET /api/dashboard/monthly-performance
router.get('/monthly-performance', getMonthlyPerformance);

// GET /api/dashboard/protocol-stats
router.get('/protocol-stats', getProtocolStats);

module.exports = router;