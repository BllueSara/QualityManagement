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
    upload(req, res, async (err) => {
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

      // 2) فك JSON لمصفوفة أنواع المرضى
      let patient_types = [];
      if (req.body.patient_types) {
        try {
          patient_types = JSON.parse(req.body.patient_types);
        } catch (e) {
          // إذا فشل الفك، اعتبره قيمة واحدة
          patient_types = req.body.patient_types ? [req.body.patient_types] : [];
        }
      }

      // 3) تنظيف البيانات - تحويل القيم الفارغة إلى null
      const cleanData = {
        ...req.body,
        // الحقول الاختيارية - تحويل القيم الفارغة إلى null
        other_depts: req.body.other_depts || null,
        patient_name: req.body.patient_name || null,
        medical_record_no: req.body.medical_record_no || null,
        dob: req.body.dob || null,
        gender: req.body.gender || null,
        report_short_desc: req.body.report_short_desc || null,
        had_injury: req.body.had_injury || null,
        injury_type: req.body.injury_type || null,
        attachments: req.files
          ? req.files.map(file => ({
              filename: file.filename,
              path: file.path,
              mimetype: file.mimetype
            }))
          : [],
        classification,
        patient_types
      };

      // 4) انشئ الحدث عارض في الموديل، وارجع الـ ID
      const ticketId = await Ticket.create(cleanData, req.user.id);

      // 5) جلب الحدث عارض للتأكد من وجود الحقل title
      const createdTicket = await Ticket.findById(
        ticketId,
        req.user.id,
        req.user.role
      );

      // 6) استخرج العنوان (قد يكون JSON أو نص)
      const rawTitle = createdTicket?.title || cleanData.report_short_desc || `حدث عارض رقم ${ticketId}`;
      const userLang = getUserLang(req);
      const localizedTitle = getLocalizedName(rawTitle, userLang) || rawTitle;

      // 7) تسجيل اللوق بعد نجاح الإنشاء
      try {
        const logDescription = {
          ar: `تم إنشاء حدث عارض جديد: ${localizedTitle}`,
          en: `Created new OVR: ${localizedTitle}`
        };
        await logAction(
          req.user.id,
          'create_ticket',
          JSON.stringify(logDescription),
          'ticket',
          ticketId
        );
      } catch (logErr) {
        console.error('logAction error:', logErr);
      }

      // 8) أرسل الرد
      return res.status(201).json({
        status: 'success',
        message: 'تم إنشاء الحدث العارض بنجاح',
        data: { id: ticketId }
      });
    });
  } catch (error) {
    console.error('OVR error:', error);
    return res.status(500).json({ message: 'Error creating OVR.' });
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
            return res.status(404).json({ message: 'OVR not found.' });
        }

        res.json(ticket);
    } catch (error) {
        // console.error(error);
        res.status(500).json({ message: 'Error fetching OVR.' });
    }
};

// Update a ticket
// controllers/ticketController.js

exports.updateTicket = async (req, res) => {
  try {
    upload(req, res, async function (err) {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      const userLang = getUserLang(req);

      const oldTicket = await Ticket.findById(req.params.id);

      const classifications = Array.isArray(req.body.classification)
        ? req.body.classification
        : req.body.classification
          ? [req.body.classification]
          : [];

      const patient_types = Array.isArray(req.body.patient_types)
        ? req.body.patient_types
        : req.body.patient_types
          ? [req.body.patient_types]
          : [];

      const ticketData = {
        ...req.body,
        classifications,
        patient_types,
        attachments: req.files
          ? req.files.map(f => ({ filename: f.filename, path: f.path, mimetype: f.mimetype }))
          : []
      };

      await Ticket.update(req.params.id, ticketData, req.user.id);

      const newTicket = await Ticket.findById(req.params.id);

      const changesAr = [];
      const changesEn = [];

      if (oldTicket.responding_dept_name !== newTicket.responding_dept_name) {
        changesAr.push(`القسم المستجيب: '${oldTicket.responding_dept_name}' → '${newTicket.responding_dept_name}'`);
        changesEn.push(`Responding Dept: '${oldTicket.responding_dept_name}' → '${newTicket.responding_dept_name}'`);
      }

      if (oldTicket.reporting_dept_name !== newTicket.reporting_dept_name) {
        changesAr.push(`القسم المُبلغ: '${oldTicket.reporting_dept_name}' → '${newTicket.reporting_dept_name}'`);
        changesEn.push(`Reporting Dept: '${oldTicket.reporting_dept_name}' → '${newTicket.reporting_dept_name}'`);
      }

      // أضف هنا أي حقول إضافية حسب الحاجة

      if (changesAr.length > 0) {
        const identifierAr = `رقم ${req.params.id}`;
        const identifierEn = `ID ${req.params.id}`;

        const logDescription = {
          ar: `تم تحديث الحدث العارض ${identifierAr}: ${changesAr.join(', ')}`,
          en: `Updated OVR ${identifierEn}: ${changesEn.join(', ')}`
        };

        await logAction(
          req.user.id,
          'update_ticket',
          JSON.stringify(logDescription),
          'ticket',
          req.params.id
        );
      }

      return res.json({ message: 'تم تحديث الحدث العارض بنجاح' });
    });
  } catch (error) {
    console.error('Error in updateTicket:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Delete a ticket
exports.deleteTicket = async (req, res) => {
  try {
    // 1) جلب بيانات الحدث عارض قبل الحذف
    const ticket = await Ticket.findById(
      req.params.id,
      req.user.id,
      req.user.role
    );

    // 2) حذف الحدث عارض
    await Ticket.delete(req.params.id);

    // 3) تحضير العنوان المترجم
    const rawTitle = ticket?.title || null;
    // عربي
    const titleAr = rawTitle
      ? getLocalizedName(rawTitle, 'ar')
      : `رقم ${req.params.id}`;
    // إنجليزي
    const titleEn = rawTitle
      ? getLocalizedName(rawTitle, 'en')
      : `ID ${req.params.id}`;

    // 4) تسجيل اللوق
    try {
      const logDescription = {
        ar: `تم حذف الحدث العارض: ${titleAr}`,
        en: `Deleted OVR: ${titleEn}`
      };
      await logAction(
        req.user.id,
        'delete_ticket',
        JSON.stringify(logDescription),
        'ticket',
        req.params.id
      );
    } catch (logErr) {
      console.error('logAction error:', logErr);
    }

    // 5) ردّ النجاح
    return res.json({ message: 'تم حذف الحدث العارض بنجاح' });
  } catch (error) {
    console.error('Error in delete OVR:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Assign a ticket
// Assign a ticket
exports.assignTicket = async (req, res) => {
  try {
    const ticketId = req.params.id;
    let { assignedTo, comments } = req.body;
    const userLang = getUserLang(req);

    // 1) فكّ JSON لو كان string
    if (typeof assignedTo === 'string') {
      try {
        assignedTo = JSON.parse(assignedTo);
      } catch {
        assignedTo = [assignedTo];
      }
    }
    const assigneeIds = Array.isArray(assignedTo) ? assignedTo : [assignedTo];

    // 2) تأكد من وجود الحدث عارض وحالتها
    const before = await Ticket.findById(ticketId, req.user.id, req.user.role);
    if (!before) {
      return res.status(404).json({ status: 'error', message: 'الحدث العارض غير موجودة' });
    }
    if (['مغلق','closed'].includes(before.status)) {
      return res.status(400).json({ status: 'error', message: 'لا يمكن تحويل الحدث العارض مغلق' });
    }

    // 3) نفّذ التعيين (موديلك الحالي يدعم ID واحد فقط)
    await Ticket.assignTicket(ticketId, assigneeIds[0], req.user.id, comments);

    // 4) جلب الحدث عارض المحدثة (بما فيها classifications)
    const updatedTicket = await Ticket.findById(ticketId, req.user.id, req.user.role);

    // 5) سجل اللوج
    const assigneesInfo = updatedTicket.assigned_to_name
      ? updatedTicket.assigned_to_name
      : assigneeIds.join(', ');
    const identifierAr = `رقم ${ticketId}`;
    const identifierEn = `ID ${ticketId}`;
    const logDescription = {
      ar: `تم تعيين الحدث العارض ${identifierAr} إلى: ${assigneesInfo}`,
      en: `Assigned OVR ${identifierEn} to: ${assigneesInfo}`
    };
    await logAction(
      req.user.id,
      'assign_ticket',
      JSON.stringify(logDescription),
      'ticket',
      ticketId
    );

    // 6) أرسل الحدث عارض كاملة مع التصنيفات
    return res.json({
      status: 'success',
      message: 'تم تعيين الحدث العارض بنجاح',
      data: updatedTicket
    });

  } catch (error) {
    console.error('Error in assign OVR:', error);
    return res.status(500).json({ status: 'error', message: error.message });
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

        // 1) فكّ التوكن واستخراج الـ userId
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        // 2) جلب لغة المستخدم
        const userLang = getUserLang(req);

        // 3) جلب الحدث عارض (بما في ذلك الحقل title)
        const ticket = await Ticket.findById(ticketId, userId, decoded.role);

        // 4) استخراج العنوان وتحويله حسب اللغة
        const rawTitle = ticket && ticket.title ? ticket.title : null;
        const title = rawTitle
            ? getLocalizedName(rawTitle, userLang)
            : ` ${ticketId}`;

        // 5) إنشاء الرد
const newReply = await Ticket.addReply(ticketId, userId, text);

        
        // 6) تسجيل الحدث في اللوغ
        const logDescription = {
            ar: `تم إضافة رد على الحدث العارض: ${title}`,
            en: `Added reply to OVR: ${title}`
        };
        await logAction(
            userId,
            'add_reply',
            JSON.stringify(logDescription),
            'ticket',
            ticketId
        );
        
return res.status(201).json({
  message: 'Reply added and OVR closed if needed.',
  reply: newReply
});
    } catch (err) {
        console.error('Error in addReply:', err);
        return res.status(500).json({ message: 'Error adding reply.' });
    }
};

exports.assignToUsers = async (req, res) => {
  const ticketId = req.params.id;
  let assigneeIds = req.body.assignees; 

  try {
    // فكّ JSON إذا لزم
    if (typeof assigneeIds === 'string') {
      assigneeIds = JSON.parse(assigneeIds);
    }
    if (!Array.isArray(assigneeIds) || assigneeIds.length === 0) {
      return res.status(400).json({ error: 'assignees must be a non-empty array' });
    }

    // 1) جلب pool
    const mysql = require('mysql2/promise');
    const db = mysql.createPool({
      host:     process.env.DB_HOST || 'localhost',
      user:     process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'Quality'
    });

    // 2) التحقق من حالة الحدث عارض - منع تحويل التذاكر المغلقة
    const [ticketRows] = await db.execute(
      'SELECT status FROM tickets WHERE id = ?',
      [ticketId]
    );
    
    if (ticketRows.length === 0) {
      return res.status(404).json({ error: 'الحدث العارض غير موجود' });
    }
    
    const ticketStatus = ticketRows[0].status;
    if (ticketStatus === 'مغلق' || ticketStatus === 'closed') {
      return res.status(400).json({ 
        error: 'لا يمكن تحويل الحدث العارض لأنه مغلق',
        status: 'closed'
      });
    }

    // 3) جلب المستخدمين المكلفين مسبقاً لمنع التحويل لنفس الشخص مرتين
    const [existingAssignments] = await db.execute(
      'SELECT assigned_to FROM ticket_assignments WHERE ticket_id = ?',
      [ticketId]
    );
    
    const existingAssigneeIds = existingAssignments.map(a => a.assigned_to);
    const newAssigneeIds = assigneeIds.filter(id => !existingAssigneeIds.includes(parseInt(id)));
    
    if (newAssigneeIds.length === 0) {
      return res.status(400).json({ 
        error: 'جميع المستخدمين المحددين مكلفون بالفعل بهذا الحدث العارض',
        status: 'already_assigned'
      });
    }

    // 4) جلب أسماء المكلَّفين الجدد فقط
    const placeholders = newAssigneeIds.map(() => '?').join(',');
    const sql = `SELECT username FROM users WHERE id IN (${placeholders})`;
    const [assigneeUsers] = await db.execute(sql, newAssigneeIds);
    const assigneeNames = assigneeUsers.map(u => u.username).join(', ');

    // 5) نفّذ التعيين للمستخدمين الجدد فقط
    await Ticket.assignUsers(ticketId, newAssigneeIds, req.user.id);

    // 6) سجّل اللّوج
    const identifierAr = `رقم ${ticketId}`;
    const identifierEn = `ID ${ticketId}`;
    const logDescription = {
      ar: `تم تعيين الحدث العارض ${identifierAr} ل : ${assigneeNames}`,
      en: `Assigned OVR ${identifierEn} to  : ${assigneeNames}`
    };
    await logAction(
      req.user.id,
      'assign_ticket_multiple',
      JSON.stringify(logDescription),
      'ticket',
      ticketId
    );

    return res.json({ 
      status: 'success',
      message: `تم تحويل الحدث العارض إلى ${assigneeNames}`,
      assignedCount: newAssigneeIds.length,
      skippedCount: assigneeIds.length - newAssigneeIds.length
    });
  } catch (error) {
    console.error('assignToUsers error:', error);
    return res.status(500).json({ error: error.message });
  }
};

// GET /api/tickets/:id/track
exports.trackTicket = async (req, res) => {
  const ticketId = req.params.id;
  try {
    const data = await Ticket.track(ticketId);
    if (!data) return res.status(404).json({ status:'error', message:'الحدث العارض غير موجود' });

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

// إشعار عند إغلاق الحدث عارض
exports.closeTicket = async (req, res) => {
    try {
        const ticketId = req.params.id;
        
        // Fetch ticket details for logging
        const ticket = await Ticket.findById(ticketId, req.user.id, req.user.role);
        
        // تحديث حالة الحدث عارض إلى مغلق
        await Ticket.updateStatus(ticketId, 'مغلق', req.user.id);
        
        // ✅ تسجيل اللوق بعد نجاح إغلاق الحدث عارض
        try {
          const logDescription = {
            ar: `تم إغلاق الحدث العارض: ${ticket ? ticket.title : `رقم ${ticketId}`}`,
            en: `Closed OVR: ${ticket ? ticket.title : `ID ${ticketId}`}`
          };
          
          await logAction(req.user.id, 'close_ticket', JSON.stringify(logDescription), 'ticket', ticketId);
        } catch (logErr) {
          console.error('logAction error:', logErr);
        }
        
        // جلب صاحب الحدث عارض
        if (ticket && ticket.created_by) {
            await insertNotification(
                ticket.created_by,
                'تم إغلاق الحدث العارض',
                `تم إغلاق حدثك العارض رقم ${ticketId}.`,
                'ticket'
            );
        }
        res.json({ message: 'تم إغلاق الحدث العارض بنجاح' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// جلب المستخدمين المكلفين بحدث عارض معينة
exports.getTicketAssignees = async (req, res) => {
  const ticketId = req.params.id;
  
  try {
    const mysql = require('mysql2/promise');
    const db = mysql.createPool({
      host:     process.env.DB_HOST || 'localhost',
      user:     process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'Quality'
    });

    const [assignees] = await db.execute(
      `SELECT ta.assigned_to, u.username, d.name AS department_name
       FROM ticket_assignments ta
       JOIN users u ON ta.assigned_to = u.id
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE ta.ticket_id = ?`,
      [ticketId]
    );

    return res.json({
      status: 'success',
      assignees: assignees.map(a => ({
        id: a.assigned_to,
        username: a.username,
        department: a.department_name
      }))
    });
  } catch (error) {
    console.error('getTicketAssignees error:', error);
    return res.status(500).json({ error: error.message });
  }
};

// دالة تسجيل عرض التذكرة
exports.logTicketView = async (req, res) => {
  try {
    const { ticketId, ticketTitle } = req.body;
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'Token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const actionType = 'view_ticket';
    const description = JSON.stringify({
      ar: `عرض الحدث العارض رقم ${ticketId}`,
      en: `Viewed OVR number ${ticketId}`
    });

    // تحويل ticketId إلى رقم صحيح
    const numericTicketId = parseInt(ticketId) || 0;
    
    // التحقق من صحة الرقم
    if (numericTicketId <= 0) {
      return res.status(400).json({ message: 'Invalid ticket ID' });
    }

    // تسجيل اللوق
    await logAction(userId, actionType, description, 'ticket', numericTicketId);

    res.json({ status: 'success', message: 'Ticket view logged successfully' });
  } catch (error) {
    console.error('Error logging ticket view:', error);
    res.status(500).json({ message: 'Failed to log ticket view' });
  }
};
