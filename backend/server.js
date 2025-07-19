// server.js
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const mysql = require('mysql2/promise');

const app = express();

// Serve static files from all directories

app.use(express.static(path.join(__dirname)));
app.use(express.static(path.join(__dirname, '..')));
app.use(express.static(path.join(__dirname, '..', '..')));


// Routers
const authRouter             = require('./routes/auth');
const usersRouter            = require('./routes/users.routes');
const permsDefRouter         = require('./routes/permissionsDef.routes');
const permsRouter            = require('./routes/permissions.routes');
const deptRouter             = require('./routes/departments');
const folderRouter           = require('./routes/folderRoutes');
const folderContentRouter    = require('./routes/folderContentRoutes');
const contentRouter          = require('./routes/contentRoutes');
const approvalRouter         = require('./routes/approvalRoutes');
const ticketRouter           = require('./routes/ticketRoutes');
const pendingApprovalRoutes = require('./routes/pendingApprovals.routes');
const pendingCommitteeApprovalRoutes = require('./routes/pendingCommitteeApprovals.routes');
const dashboardRouter = require('./routes/dashboardRoutes');
const committeesRoutes = require('./routes/committees');
const committeeApprovalRoutes = require('./routes/committeeApprovalRoutes');
const globalContentRouter = require('./routes/globalContentRoutes');
const reportsRoutes = require('./routes/reportsRoutes');
const ticketReportRoutes = require('./routes/ticketReportRoutes');
const logsRoutes = require('./routes/logsRoutes');

 





app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', require('express').static('uploads'));

// Mounting API endpoints
app.use('/api/auth',        authRouter);
app.use('/api/users', permsRouter);
app.use('/api/users',       usersRouter);
app.use('/api/permissions/definitions', permsDefRouter);
app.use('/api/departments', deptRouter);
app.use('/api/tickets',     ticketRouter);
app.use('/api/committees',  (req, res, next) => {
  // console.log('Request hitting /api/committees route');
  next();
}, committeesRoutes);

// folders nested under departments
app.use('/api/departments/:departmentId/folders', folderRouter);
// ✅ هذا الصحيح
app.use('/api/folders', folderRouter);


// contents nested under folders
app.use('/api/folders', folderContentRouter);




// global content endpoints (my-uploads)
app.use('/api/contents', contentRouter);

app.use('/api/approvals', approvalRouter);


app.use('/api/pending-approvals', pendingApprovalRoutes);
app.use('/api/pending-committee-approvals', pendingCommitteeApprovalRoutes);
app.use('/api/committee-approvals', committeeApprovalRoutes);

app.use('/api/dashboard', dashboardRouter);
app.use('/api', globalContentRouter); // 👈 هذا يعطيك: /api/content-names
app.use('/api/reports', reportsRoutes);
app.use('/api/tickets/report', ticketReportRoutes);
app.use('/api/logs', logsRoutes);

// Ensure all committee routes are correctly loaded

// serve static frontend
app.use('/', express.static(path.join(__dirname, '../frontend')));

app.get('/health', (req, res) => res.send('OK'));
app.use((err, req, res, next) => {
  // console.error(err);
  res.status(500).json({ status: 'error', message: 'Internal Server Error' });
});

const PORT = process.env.PORT || 3006;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
