// server.js
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

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





app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mounting API endpoints
app.use('/api/auth',        authRouter);
app.use('/api/users',       usersRouter);
app.use('/api/permissions/definitions', permsDefRouter);
app.use('/api/permissions', permsRouter);
app.use('/api/departments', deptRouter);
app.use('/api/tickets',     ticketRouter);

// folders nested under departments
app.use('/api/departments/:departmentId/folders', folderRouter);

// contents nested under folders
app.use('/api/folders', folderContentRouter);

// global content endpoints (my-uploads)
app.use('/api/contents', contentRouter);

app.use('/api/approvals', approvalRouter);


app.use('/api/pending-approvals', pendingApprovalRoutes);

// serve static frontend
app.use('/', express.static(path.join(__dirname, '../frontend')));

app.get('/health', (req, res) => res.send('OK'));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ status: 'error', message: 'Internal Server Error' });
});

const PORT = process.env.PORT || 3006;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
