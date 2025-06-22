const Ticket = require('../models/ticketModel');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { logAction } = require('../models/logger');
const { insertNotification } = require('../models/notfications-utils');
const jwt = require('jsonwebtoken');
const Reply = require('../models/replyModel');

function getUserLang(req) {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    try {
      const token = auth.slice(7);
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      return payload.lang || 'ar';
    } catch (err) {
      return 'ar';
    }
  }
  return 'ar';
}

function getLocalizedName(nameField, lang) {
  if (!nameField) return '';
  // Check if it's already a parsed object
  if (typeof nameField === 'object' && nameField !== null) {
    return nameField[lang] || nameField['ar'] || '';
  }
  if (typeof nameField === 'string') {
    try {
      // Try to parse it as JSON
      const nameObj = JSON.parse(nameField);
      return nameObj[lang] || nameObj['ar'] || nameField;
    } catch (e) {
      // If parsing fails, return the original string
      return nameField;
    }
  }
  // For any other type, convert to string and return
  return String(nameField);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads/tickets';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('نوع الملف غير مسموح به'));
        }
    }
}).array('attachments', 5);

// Get all departments
exports.getDepartments = async (req, res) => {
    try {
        const departments = await Ticket.getDepartments();
        res.json(departments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create a new ticket
exports.createTicket = async (req, res) => {
  try {
    upload(req, res, async function (err) {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      // 1) فك JSON لمصفوفة التصنيفات
      let classification = [];
      if (req.body.classification) {
        try {
          classification = JSON.parse(req.body.classification);
        } catch (e) {
          return res.status(400).json({ error: 'تصنيف غير صالح' });
        }
      }

      // 2) جهّز بيانات التذكرة
      const ticketData = {
        ...req.body,
        attachments: req.files
          ? req.files.map(file => ({
              filename: file.filename,
              path: file.path,
              mimetype: file.mimetype
            }))
          : [],
        classification   // ← أضف هنا المصفوفة
      };

      // 3) انشئ التذكرة في الموديل
      const ticketId = await Ticket.create(ticketData, req.user.id);

      // 4) Add to logs
      const userLang = getUserLang(req);
      const logMessage = userLang === 'en' 
        ? `Created new ticket: '${req.body.title}' in department '${req.body.department}'`
        : `أنشأ تذكرة جديدة: '${req.body.title}' في القسم '${req.body.department}'`;
      await logAction(req.user.id, 'create_ticket', logMessage, 'ticket', ticketId);

      // ✅ تسجيل اللوق بعد نجاح إنشاء التذكرة
      try {
        const logDescription = {
          ar: `تم إنشاء تذكرة جديدة: ${req.body.title}`,
          en: `Created new ticket: ${req.body.title}`
        };
        
        await logAction(req.user.id, 'create_ticket', JSON.stringify(logDescription), 'ticket', ticketId);
      } catch (logErr) {
        console.error('logAction error:', logErr);
      }

      // 5) أعِد الاستجابة
      res.status(201).json({
        status: 'success',
        message: 'تم إنشاء التذكرة بنجاح',
        data: { id: ticketId }
      });
    });
  } catch (error) {
    // console.error('createTicket error:', error);
    res.status(500).json({ message: 'Error creating ticket.' });
  }
};


// Get all tickets
exports.getAllTickets = async (req, res) => {
  try {
    const tickets = await Ticket.findAll(req.user.id, req.user.role);
    res.json({ status: 'success', data: tickets });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'حدث خطأ داخلي' });
  }
};
exports.getAssignedTickets = async (req, res) => {
  const tickets = await Ticket.findAllAndAssignments(req.user.id, req.user.role);
  res.json({ status: 'success', data: tickets });
};


// Get a single ticket
exports.getTicket = async (req, res) => {
    try {
        const ticket = await Ticket.findById(
            req.params.id,
            req.user.id,
            req.user.role
        );

        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found.' });
        }

        res.json(ticket);
    } catch (error) {
        // console.error(error);
        res.status(500).json({ message: 'Error fetching ticket.' });
    }
};

// Update a ticket
// controllers/ticketController.js

exports.updateTicket = async (req, res) => {
  try {
    // نفّذ الـ upload أولاً
    upload(req, res, async function (err) {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      // Fetch old ticket details for logging
      const oldTicket = await Ticket.findById(req.params.id, req.user.id, req.user.role);

      // 1) فك التصنيفات إلى مصفوفة
      const classifications = Array.isArray(req.body.classification)
        ? req.body.classification
        : req.body.classification
          ? [req.body.classification]
          : [];

      // 2) (اختياري) فك أنواع المرضى بنفس المنطق لو تستخدم هذا الحقل
      const patient_types = Array.isArray(req.body.patient_types)
        ? req.body.patient_types
        : req.body.patient_types
          ? [req.body.patient_types]
          : [];

      // 3) جهّز بيانات التذكرة مع إضافة الحقول الجديدة
      const ticketData = {
        ...req.body,
        classifications,      // هنا المصفوفة
        patient_types,        // لو تستخدم patient_types
        attachments: req.files
          ? req.files.map(file => ({
              filename: file.filename,
              path: file.path,
              mimetype: file.mimetype
            }))
          : []
      };

      // 4) نفّذ التحديث بالموديل
      await Ticket.update(req.params.id, ticketData, req.user.id);

      // 5) Add to logs
      const userLang = getUserLang(req);
      let logMessage;
      
      if (oldTicket) {
        const changes = [];
        if (req.body.title && req.body.title !== oldTicket.title) {
          changes.push(userLang === 'en' 
            ? `title: '${oldTicket.title}' → '${req.body.title}'`
            : `العنوان: '${oldTicket.title}' → '${req.body.title}'`);
        }
        if (req.body.department && req.body.department !== oldTicket.department) {
          changes.push(userLang === 'en' 
            ? `department: '${oldTicket.department}' → '${req.body.department}'`
            : `القسم: '${oldTicket.department}' → '${req.body.department}'`);
        }
        if (req.body.status && req.body.status !== oldTicket.status) {
          changes.push(userLang === 'en' 
            ? `status: '${oldTicket.status}' → '${req.body.status}'`
            : `الحالة: '${oldTicket.status}' → '${req.body.status}'`);
        }
        
        if (changes.length > 0) {
          logMessage = userLang === 'en' 
            ? `Updated ticket '${oldTicket.title}': ${changes.join(', ')}`
            : `حدث التذكرة '${oldTicket.title}': ${changes.join(', ')}`;
        } else {
          logMessage = userLang === 'en' 
            ? `Updated ticket '${oldTicket.title}' (no significant changes)`
            : `حدث التذكرة '${oldTicket.title}' (لا توجد تغييرات مهمة)`;
        }
      } else {
        logMessage = userLang === 'en' 
          ? `Updated ticket ID ${req.params.id}`
          : `حدث التذكرة رقم ${req.params.id}`;
      }
      
      await logAction(req.user.id, 'update_ticket', logMessage, 'ticket', req.params.id);

      return res.json({ message: 'تم تحديث التذكرة بنجاح' });
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
};


// Delete a ticket
exports.deleteTicket = async (req, res) => {
    try {
        // Fetch ticket details for logging
        const ticket = await Ticket.findById(req.params.id, req.user.id, req.user.role);
        
        await Ticket.delete(req.params.id);
        
        // Add to logs
        const userLang = getUserLang(req);
        const logMessage = userLang === 'en' 
          ? `Deleted ticket: '${ticket ? ticket.title : `ID ${req.params.id}`}'`
          : `حذف التذكرة: '${ticket ? ticket.title : `رقم ${req.params.id}`}'`;
        await logAction(req.user.id, 'delete_ticket', logMessage, 'ticket', req.params.id);
        
        res.json({ message: 'تم حذف التذكرة بنجاح' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Assign a ticket
exports.assignTicket = async (req, res) => {
    try {
        const { assignedTo, comments } = req.body;
        
        // Fetch ticket details for logging
        const ticket = await Ticket.findById(req.params.id, req.user.id, req.user.role);
        
        // Fetch assignee details for logging
        const mysql = require('mysql2/promise');
        const db = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'Quality'
        });
        
        const [[assigneeDetails]] = await db.execute(
            'SELECT username FROM users WHERE id = ?',
            [assignedTo]
        );
        
        await Ticket.assignTicket(req.params.id, assignedTo, req.user.id, comments);
        
        // Add to logs
        const userLang = getUserLang(req);
        const logMessage = userLang === 'en' 
          ? `Assigned ticket '${ticket ? ticket.title : `ID ${req.params.id}`}' to: ${assigneeDetails ? assigneeDetails.username : `User ${assignedTo}`}`
          : `عين التذكرة '${ticket ? ticket.title : `رقم ${req.params.id}`}' إلى: ${assigneeDetails ? assigneeDetails.username : `المستخدم ${assignedTo}`}`;
        await logAction(req.user.id, 'assign_ticket', logMessage, 'ticket', req.params.id);
        
        res.json({ message: 'تم تعيين التذكرة بنجاح' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get ticket status history
exports.getTicketStatusHistory = async (req, res) => {
    try {
        const history = await Ticket.getStatusHistory(req.params.id);
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.addReply = async (req, res) => {
    try {
        const ticketId = req.params.id;
        const { text } = req.body;
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        // Fetch ticket details for logging
        const ticket = await Ticket.findById(ticketId, userId, decoded.role);

        await Reply.create({ ticketId, text, authorId: userId });
        
        // Add to logs
        const userLang = getUserLang(req);
        const logDescription = {
            ar: `تم إضافة رد على التذكرة: ${ticket ? ticket.title : `رقم ${ticketId}`}`,
            en: `Added reply to ticket: ${ticket ? ticket.title : `ID ${ticketId}`}`
        };
        
        await logAction(userId, 'add_reply', JSON.stringify(logDescription), 'ticket', ticketId);
        
        res.status(201).json({ message: 'Reply added successfully.' });
    } catch (err) {
        // console.error(err);
        res.status(500).json({ message: 'Error adding reply.' });
    }
};
exports.assignToUsers = async (req, res) => {
  const ticketId = req.params.id;
  const { assignees } = req.body;  // مصفوفة userIds
  
  try {
    // Fetch ticket details for logging
    const ticket = await Ticket.findById(ticketId, req.user.id, req.user.role);
    
    // Fetch assignee details for logging
    const mysql = require('mysql2/promise');
    const db = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'Quality'
    });
    
    const [assigneeUsers] = await db.execute(
        'SELECT username FROM users WHERE id IN (?)',
        [assignees]
    );
    const assigneeNames = assigneeUsers.map(u => u.username).join(', ');
    
    await Ticket.assignUsers(ticketId, assignees, req.user.id);
    
    // Add to logs
    const userLang = getUserLang(req);
    const logMessage = userLang === 'en' 
      ? `Assigned ticket '${ticket ? ticket.title : `ID ${ticketId}`}' to multiple users: ${assigneeNames}`
      : `عين التذكرة '${ticket ? ticket.title : `رقم ${ticketId}`}' لعدة مستخدمين: ${assigneeNames}`;
    await logAction(req.user.id, 'assign_ticket_multiple', logMessage, 'ticket', ticketId);
    
    res.json({ status: 'success' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// GET /api/tickets/:id/track
exports.trackTicket = async (req, res) => {
  const ticketId = req.params.id;
  try {
    const data = await Ticket.track(ticketId);
    if (!data) return res.status(404).json({ status:'error', message:'التذكرة غير موجودة' });

    // شطب المراحل المكتملة
    const done = data.timeline.filter(i => ['مغلق','معتمد'].includes(i.status)).length;
    const total = data.timeline.length + data.assignees.length;
    const progress = total ? Math.round(done/total*100) : 0;

    return res.json({
      status: 'success',
      content:     data.ticket,
      timeline:    data.timeline,
      pending:     data.assignees,
      progress     // إضافي — النسبة المئوية
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status:'error', message:'فشل جلب بيانات التتبع' });
  }
};

// إشعار عند إغلاق التذكرة
exports.closeTicket = async (req, res) => {
    try {
        const ticketId = req.params.id;
        
        // Fetch ticket details for logging
        const ticket = await Ticket.findById(ticketId, req.user.id, req.user.role);
        
        // تحديث حالة التذكرة إلى مغلق
        await Ticket.updateStatus(ticketId, 'مغلق', req.user.id);
        
        // Add to logs
        const userLang = getUserLang(req);
        const logMessage = userLang === 'en' 
          ? `Closed ticket: '${ticket ? ticket.title : `ID ${ticketId}`}'`
          : `أغلق التذكرة: '${ticket ? ticket.title : `رقم ${ticketId}`}'`;
        await logAction(req.user.id, 'close_ticket', logMessage, 'ticket', ticketId);
        
        // جلب صاحب التذكرة
        if (ticket && ticket.created_by) {
            await insertNotification(
                ticket.created_by,
                'تم إغلاق التذكرة',
                `تم إغلاق تذكرتك رقم ${ticketId}.`,
                'ticket'
            );
        }
        res.json({ message: 'تم إغلاق التذكرة بنجاح' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
