const express = require('express');
const router = express.Router();
const { getApprovalsReports } = require('../controllers/reportsController');

// جلب تقارير الاعتمادات (القسم + اللجنة)
router.get('/approvals', getApprovalsReports);

module.exports = router; 