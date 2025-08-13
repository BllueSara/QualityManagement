const Ticket = require('../models/ticketModel');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { logAction } = require('../models/logger');
const { insertNotification } = require('../models/notfications-utils');
const jwt = require('jsonwebtoken');
const Reply = require('../models/replyModel');
const mysql = require('mysql2/promise');

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
  console.log('🟢 [createTicket] بداية الدالة');
  if (!req.user || !req.user.id) {
    console.error('❌ طلب بدون توكن أو مستخدم غير معرف (createTicket):', {
      headers: req.headers,
      body: req.body,
      url: req.originalUrl
    });
    return res.status(401).json({ status: 'error', message: 'محتاج توكن (createTicket)' });
  }
  try {
    console.log('🟢 [createTicket] قبل upload');
    upload(req, res, async (err) => {
      console.log('🟢 [createTicket] دخل upload callback');
      if (err) {
        console.error('Multer error:', err);
        return res.status(400).json({ error: err.message });
      }
      try {
        // --- الكود الحالي بالكامل هنا ---
        console.log('--- req.body ---');
        console.log(req.body);
        console.log('--- req.files ---');
        if (req.files && req.files.length) {
          req.files.forEach(f => {
            console.log(`File: ${f.originalname}, Saved as: ${f.filename}, Path: ${f.path}, Type: ${f.mimetype}`);
          });
        } else {
          console.log('No files uploaded');
        }

        // تحقق من وجود harm_level_id
        if (!req.body.harm_level_id) {
          console.log('🔴 [createTicket] لا يوجد harm_level_id');
          return res.status(400).json({ error: 'مستوى الضرر مطلوب' });
        }

        // 1) فك JSON لمصفوفة التصنيفات
        let classifications = [];
        if (req.body.classifications) {
          try {
            classifications = JSON.parse(req.body.classifications);
            console.log('Parsed classifications:', classifications);
          } catch (e) {
            console.error('Error parsing classifications:', e);
            return res.status(400).json({ error: 'تصنيف غير صالح' });
          }
        }
        
        // التحقق من أن التصنيفات موجودة
        if (!classifications || classifications.length === 0) {
          return res.status(400).json({ error: 'يجب اختيار تصنيف واحد على الأقل' });
        }

        // 2) فك JSON لمصفوفة أنواع المرضى
        let patient_types = [];
        if (req.body.patient_types) {
          try {
            patient_types = JSON.parse(req.body.patient_types);
          } catch (e) {
            patient_types = req.body.patient_types ? [req.body.patient_types] : [];
          }
        }

        // 3) تنظيف البيانات - تحويل القيم الفارغة إلى null
        const cleanData = {
          ...req.body,
          harm_level_id: req.body.harm_level_id,
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
          classifications,
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
            ar: `تم إنشاء حدث عارض جديد: ${ticketId}`,
            en: `Created new OVR: ${ticketId}`
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

        // 8) إرسال إشعار إنشاء التذكرة
        try {
          await insertNotification(
            req.user.id,
            'تم إنشاء تقرير OVR جديد',
            `تم إنشاء تقرير OVR جديد برقم ${ticketId}`,
            'ticket'
          );
        } catch (notificationErr) {
          console.error('Notification error:', notificationErr);
        }

        // 9) أرسل الرد
        console.log('🟢 [createTicket] قبل return النهائي (إرسال الرد للفرونتند)');
        return res.status(201).json({
          status: 'success',
          message: 'تم إنشاء الحدث العارض بنجاح',
          data: { id: ticketId }
        });
      } catch (error) {
        console.error('❌ [createTicket] خطأ داخل upload callback:', error);
        return res.status(500).json({ message: 'خطأ داخلي أثناء إنشاء التذكرة', error: error.message });
      }
    });
    console.log('🔴 [createTicket] بعد upload (لن تظهر غالباً)');
  } catch (error) {
    console.error('OVR error:', error);
    console.error('FULL ERROR:', JSON.stringify(error, null, 2));
    return res.status(500).json({ message: 'Error creating OVR.', error: error.message, stack: error.stack });
  }
};

// Get all tickets
exports.getAllTickets = async (req, res) => {
  if (!req.user || !req.user.id) {
    console.error('❌ طلب بدون توكن أو مستخدم غير معرف (getAllTickets):', {
      headers: req.headers,
      body: req.body,
      url: req.originalUrl
    });
    return res.status(401).json({ status: 'error', message: 'محتاج توكن (getAllTickets)' });
  }
  try {
    console.log('userRole:', req.user.role, 'userId:', req.user.id);
    const tickets = await Ticket.findAll(req.user.id, req.user.role);
    res.json({ status: 'success', data: tickets });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'حدث خطأ داخلي' });
  }
};
exports.getAssignedTickets = async (req, res) => {
  try {
    const tickets = await Ticket.findAllAndAssignments(req.user.id, req.user.role);
    res.json({ status: 'success', data: tickets });
  } catch (err) {
    console.error('Error in getAssignedTickets:', err);
    res.status(500).json({ status: 'error', message: 'حدث خطأ داخلي في جلب التذاكر المكلفة' });
  }
};

// Get a single ticket
exports.getTicket = async (req, res) => {
  if (!req.user || !req.user.id) {
    console.error('❌ طلب بدون توكن أو مستخدم غير معرف (getTicket):', {
      headers: req.headers,
      body: req.body,
      url: req.originalUrl
    });
    return res.status(401).json({ status: 'error', message: 'محتاج توكن (getTicket)' });
  }
  try {
    const ticket = await Ticket.findById(req.params.id, req.user.id, req.user.role);

        if (!ticket) {
            return res.status(404).json({ message: 'OVR not found.' });
        }

        res.json(ticket);
    } catch (error) {
        console.error('❌ [getTicket] خطأ في جلب التذكرة:', error);
        console.error('❌ [getTicket] تفاصيل الخطأ:', {
          message: error.message,
          stack: error.stack,
          ticketId: req.params.id,
          userId: req.user?.id,
          userRole: req.user?.role
        });
        res.status(500).json({ 
          status: 'error', 
          message: 'حدث خطأ داخلي في جلب التذكرة',
          details: error.message 
        });
    }
};

// Update a ticket
// controllers/ticketController.js

exports.updateTicket = async (req, res) => {
  if (!req.user || !req.user.id) {
    console.error('❌ طلب بدون توكن أو مستخدم غير معرف (updateTicket):', {
      headers: req.headers,
      body: req.body,
      url: req.originalUrl
    });
    return res.status(401).json({ status: 'error', message: 'محتاج توكن (updateTicket)' });
  }
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
        harm_level_id: req.body.harm_level_id,
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

      // تحقق إذا التغيير الوحيد هو status من 'جديد' إلى 'تم الإرسال'
      const onlyStatusChangedToSent =
        oldTicket.status === 'جديد' &&
        newTicket.status === 'تم الإرسال' &&
        oldTicket.event_date === newTicket.event_date &&
        oldTicket.event_time === newTicket.event_time &&
        oldTicket.event_location === newTicket.event_location &&
        oldTicket.reporting_dept_id === newTicket.reporting_dept_id &&
        oldTicket.responding_dept_id === newTicket.responding_dept_id &&
        oldTicket.other_depts === newTicket.other_depts &&
        oldTicket.patient_name === newTicket.patient_name &&
        oldTicket.medical_record_no === newTicket.medical_record_no &&
        oldTicket.dob === newTicket.dob &&
        oldTicket.gender === newTicket.gender &&
        oldTicket.report_type === newTicket.report_type &&
        oldTicket.report_short_desc === newTicket.report_short_desc &&
        oldTicket.event_description === newTicket.event_description &&
        oldTicket.reporter_name === newTicket.reporter_name &&
        oldTicket.report_date === newTicket.report_date &&
        oldTicket.reporter_position === newTicket.reporter_position &&
        oldTicket.reporter_phone === newTicket.reporter_phone &&
        oldTicket.reporter_email === newTicket.reporter_email &&
        oldTicket.actions_taken === newTicket.actions_taken &&
        oldTicket.had_injury === newTicket.had_injury &&
        oldTicket.injury_type === newTicket.injury_type;

      // تسجيل اللوق وإرسال الإشعار فقط إذا لم يكن التغيير الوحيد هو status من جديد إلى تم الإرسال
      if (!onlyStatusChangedToSent) {
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
        try {
          const ticketTitle = newTicket.title || `تقرير OVR رقم ${req.params.id}`;
          await insertNotification(
            req.user.id,
            'تم تحديث تقرير OVR',
            `تم تحديث تقرير OVR برقم ${req.params.id}`,
            'update'
          );
        } catch (notificationErr) {
          console.error('Notification error:', notificationErr);
        }
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

    // 5) إرسال إشعار حذف التذكرة
    try {
      const ticketTitle = ticket?.title || `تقرير OVR رقم ${req.params.id}`;
      await insertNotification(
        req.user.id,
        'تم حذف تقرير OVR',
        `تم حذف تقرير OVR برقم ${req.params.id}`,
        'delete'
      );
    } catch (notificationErr) {
      console.error('Notification error:', notificationErr);
    }

    // 6) ردّ النجاح
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

    // 6) إرسال إشعار تعيين التذكرة
    try {
      const ticketTitle = updatedTicket.title || `تقرير OVR رقم ${ticketId}`;
      await insertNotification(
        req.user.id,
        'تم تعيين تقرير OVR',
        `تم تعيين تقرير OVR برقم ${ticketId} إلى: ${assigneesInfo}`,
        'assignment'
      );
    } catch (notificationErr) {
      console.error('Notification error:', notificationErr);
    }

    // 7) أرسل الحدث عارض كاملة مع التصنيفات
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
      'SELECT status FROM tickets WHERE id = ? AND deleted_at IS NULL',
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
    const sql = `SELECT username FROM users WHERE id IN (${placeholders}) AND deleted_at IS NULL`;
    const [assigneeUsers] = await db.execute(sql, newAssigneeIds);
    const assigneeNames = assigneeUsers.map(u => u.username).join(', ');

    // 5) نفّذ التعيين للمستخدمين الجدد فقط
    await Ticket.assignUsers(ticketId, newAssigneeIds, req.user.id);

    // 6) إرسال إشعار (مع بريد إلكتروني) لكل مستخدم جديد
    const { sendAssignmentNotification } = require('../models/notfications-utils');
    for (const userId of newAssigneeIds) {
      await sendAssignmentNotification(
        userId,
        ticketId,
        assigneeNames,
        null // يمكنك تمرير عنوان التذكرة إذا توفر
      );
    }

    // 7) سجّل اللّوج
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

exports.getClassifications = async (req, res) => {
  try {
    const lang = req.query.lang === 'en' ? 'en' : 'ar';
    const db = await mysql.createPool({
      host:     process.env.DB_HOST || 'localhost',
      user:     process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'Quality'
    });
    const [rows] = await db.query('SELECT id, name_ar, name_en FROM classifications WHERE deleted_at IS NULL');
    const data = rows.map(row => ({
      id: row.id,
      name: lang === 'en' ? row.name_en : row.name_ar
    }));
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getClassificationById = async (req, res) => {
  try {
    const { id } = req.params;
    const db = await mysql.createPool({
      host:     process.env.DB_HOST || 'localhost',
      user:     process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'Quality'
    });
    
    const [rows] = await db.query('SELECT id, name_ar, name_en FROM classifications WHERE id = ? AND deleted_at IS NULL', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'التصنيف غير موجود.' });
    }
    
    res.json({ status: 'success', data: rows[0] });
  } catch (err) {
    console.error('getClassificationById error:', err);
    res.status(500).json({ status: 'error', message: 'فشل جلب التصنيف.' });
  }
};

exports.getHarmLevels = async (req, res) => {
  try {
    const lang = req.query.lang === 'en' ? 'en' : 'ar';
    const db = await mysql.createPool({
      host:     process.env.DB_HOST || 'localhost',
      user:     process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'Quality'
    });
    const [rows] = await db.query('SELECT id, code, name_ar, name_en, desc_ar, desc_en FROM harm_levels WHERE deleted_at IS NULL');
    const data = rows.map(row => ({
      id: row.id,
      code: row.code,
      name: lang === 'en' ? row.name_en : row.name_ar,
      desc: lang === 'en' ? row.desc_en : row.desc_ar
    }));
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getHarmLevelById = async (req, res) => {
  try {
    const { id } = req.params;
    const db = await mysql.createPool({
      host:     process.env.DB_HOST || 'localhost',
      user:     process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'Quality'
    });
    
    const [rows] = await db.query('SELECT id, code, name_ar, name_en, desc_ar, desc_en FROM harm_levels WHERE id = ? AND deleted_at IS NULL', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'مستوى الضرر غير موجود.' });
    }
    
    res.json({ status: 'success', data: rows[0] });
  } catch (err) {
    console.error('getHarmLevelById error:', err);
    res.status(500).json({ status: 'error', message: 'فشل جلب مستوى الضرر.' });
  }
};

// Create Classification
exports.createClassification = async (req, res) => {
  try {
    const { name_ar, name_en } = req.body;
    
    if (!name_ar || !name_en) {
      return res.status(400).json({ status: 'error', message: 'الاسم بالعربية والإنجليزية مطلوب.' });
    }
    
    const db = await mysql.createPool({
      host:     process.env.DB_HOST || 'localhost',
      user:     process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'Quality'
    });
    
    const [result] = await db.query(
      'INSERT INTO classifications (name_ar, name_en) VALUES (?, ?)',
      [name_ar, name_en]
    );
    
    // تسجيل اللوق
    try {
      const logDescription = {
        ar: `تم إضافة تصنيف جديد: ${name_ar}`,
        en: `Added new classification: ${name_en}`
      };
      await logAction(
        req.user.id,
        'create_classification',
        JSON.stringify(logDescription),
        'classification',
        result.insertId
      );
    } catch (logErr) {
      console.error('logAction error:', logErr);
    }
    
    res.json({ status: 'success', message: 'تم إضافة التصنيف بنجاح.', id: result.insertId });
  } catch (err) {
    console.error('createClassification error:', err);
    res.status(500).json({ status: 'error', message: 'فشل إضافة التصنيف.' });
  }
};

// Update Classification
exports.updateClassification = async (req, res) => {
  try {
    const { id } = req.params;
    const { name_ar, name_en } = req.body;
    
    if (!name_ar || !name_en) {
      return res.status(400).json({ status: 'error', message: 'الاسم بالعربية والإنجليزية مطلوب.' });
    }
    
    const db = await mysql.createPool({
      host:     process.env.DB_HOST || 'localhost',
      user:     process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'Quality'
    });
    
    // جلب البيانات القديمة قبل التحديث
    const [oldData] = await db.query('SELECT name_ar, name_en FROM classifications WHERE id = ?', [id]);
    
    await db.query(
      'UPDATE classifications SET name_ar = ?, name_en = ? WHERE id = ?',
      [name_ar, name_en, id]
    );
    
    // تسجيل اللوق
    try {
      const logDescription = {
        ar: `تم تحديث التصنيف: ${oldData[0]?.name_ar || 'غير معروف'} → ${name_ar}`,
        en: `Updated classification: ${oldData[0]?.name_en || 'Unknown'} → ${name_en}`
      };
      await logAction(
        req.user.id,
        'update_classification',
        JSON.stringify(logDescription),
        'classification',
        id
      );
    } catch (logErr) {
      console.error('logAction error:', logErr);
    }
    
    res.json({ status: 'success', message: 'تم تحديث التصنيف بنجاح.' });
  } catch (err) {
    console.error('updateClassification error:', err);
    res.status(500).json({ status: 'error', message: 'فشل تحديث التصنيف.' });
  }
};

// Delete Classification
exports.deleteClassification = async (req, res) => {
  try {
    const { id } = req.params;
    
    const db = await mysql.createPool({
      host:     process.env.DB_HOST || 'localhost',
      user:     process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'Quality'
    });
    
    // جلب البيانات قبل الحذف
    const [classificationData] = await db.query('SELECT name_ar, name_en FROM classifications WHERE id = ?', [id]);
    
    if (classificationData.length === 0) {
      return res.status(404).json({ status: 'error', message: 'التصنيف غير موجود.' });
    }
    
    // Check if classification is used in tickets
    const [tickets] = await db.query(
      'SELECT COUNT(*) as count FROM ticket_classifications WHERE classification_id = ?',
      [id]
    );
    
    if (tickets[0].count > 0) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'لا يمكن حذف التصنيف لأنه مستخدم في تذاكر موجودة.' 
      });
    }
    
    await db.query('UPDATE classifications SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL', [id]);
    
    // تسجيل اللوق
    try {
      const logDescription = {
        ar: `تم حذف التصنيف: ${classificationData[0].name_ar}`,
        en: `Deleted classification: ${classificationData[0].name_en}`
      };
      await logAction(
        req.user.id,
        'delete_classification',
        JSON.stringify(logDescription),
        'classification',
        id
      );
    } catch (logErr) {
      console.error('logAction error:', logErr);
    }
    
    res.json({ status: 'success', message: 'تم حذف التصنيف بنجاح.' });
  } catch (err) {
    console.error('deleteClassification error:', err);
    res.status(500).json({ status: 'error', message: 'فشل حذف التصنيف.' });
  }
};

// Create Harm Level
exports.createHarmLevel = async (req, res) => {
  try {
    const { description_ar, description_en } = req.body;
    
    if (!description_ar || !description_en) {
      return res.status(400).json({ status: 'error', message: 'الوصف بالعربية والإنجليزية مطلوب.' });
    }
    
    const db = await mysql.createPool({
      host:     process.env.DB_HOST || 'localhost',
      user:     process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'Quality'
    });
    
    // إنشاء الكود تلقائياً (A, B, C, D, E, F, G, H, I, J, K, ...)
    const [existingCodes] = await db.query('SELECT code FROM harm_levels ORDER BY code');
    let newCode = 'A';
    
    if (existingCodes.length > 0) {
      // البحث عن آخر حرف مستخدم
      const lastCode = existingCodes[existingCodes.length - 1].code;
      if (lastCode && lastCode.length === 1) {
        const lastCharCode = lastCode.charCodeAt(0);
        if (lastCharCode >= 65 && lastCharCode <= 90) { // A-Z
          newCode = String.fromCharCode(lastCharCode + 1);
        }
      }
    }
    
    // إنشاء أسماء مختصرة (حرف واحد فقط)
    // تحويل الحرف الإنجليزي إلى عربي
    const arabicLetters = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط', 'ي', 'ك', 'ل', 'م', 'ن', 'س', 'ع', 'ف', 'ص', 'ق', 'ر', 'ش', 'ت', 'ث', 'خ', 'ذ', 'ض'];
    const englishLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
    
    const index = englishLetters.indexOf(newCode);
    const name_ar = index >= 0 ? arabicLetters[index] : newCode;
    const name_en = newCode;
    
    const [result] = await db.query(
      'INSERT INTO harm_levels (code, name_ar, name_en, desc_ar, desc_en) VALUES (?, ?, ?, ?, ?)',
      [newCode, name_ar, name_en, description_ar || '', description_en || '']
    );
    
    // تسجيل اللوق
    try {
      const logDescription = {
        ar: `تم إضافة مستوى ضرر جديد: ${name_ar} (${newCode}) - ${description_ar}`,
        en: `Added new harm level: ${name_en} (${newCode}) - ${description_en}`
      };
      await logAction(
        req.user.id,
        'create_harm_level',
        JSON.stringify(logDescription),
        'harm_level',
        result.insertId
      );
    } catch (logErr) {
      console.error('logAction error:', logErr);
    }
    
    res.json({ 
      status: 'success', 
      message: `تم إضافة مستوى الضرر بنجاح. الكود: ${newCode}`, 
      id: result.insertId,
      code: newCode
    });
  } catch (err) {
    console.error('createHarmLevel error:', err);
    res.status(500).json({ status: 'error', message: 'فشل إضافة مستوى الضرر.' });
  }
};

// Update Harm Level
exports.updateHarmLevel = async (req, res) => {
  try {
    const { id } = req.params;
    const { description_ar, description_en } = req.body;
    
    if (!description_ar || !description_en) {
      return res.status(400).json({ status: 'error', message: 'الوصف بالعربية والإنجليزية مطلوب.' });
    }
    
    const db = await mysql.createPool({
      host:     process.env.DB_HOST || 'localhost',
      user:     process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'Quality'
    });
    
    // جلب البيانات القديمة قبل التحديث
    const [oldData] = await db.query('SELECT code, desc_ar, desc_en FROM harm_levels WHERE id = ?', [id]);
    
    if (oldData.length === 0) {
      return res.status(404).json({ status: 'error', message: 'مستوى الضرر غير موجود.' });
    }
    
    // الحصول على الكود الحالي
    const currentCode = oldData[0].code || 'A';
    
    // تحويل الحرف الإنجليزي إلى عربي
    const arabicLetters = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط', 'ي', 'ك', 'ل', 'م', 'ن', 'س', 'ع', 'ف', 'ص', 'ق', 'ر', 'ش', 'ت', 'ث', 'خ', 'ذ', 'ض'];
    const englishLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
    
    const index = englishLetters.indexOf(currentCode);
    const name_ar = index >= 0 ? arabicLetters[index] : currentCode;
    const name_en = currentCode;
    
    // تحديث البيانات بدون تغيير الكود
    await db.query(
      'UPDATE harm_levels SET name_ar = ?, name_en = ?, desc_ar = ?, desc_en = ? WHERE id = ?',
      [name_ar, name_en, description_ar || '', description_en || '', id]
    );
    
    // تسجيل اللوق
    try {
      const logDescription = {
        ar: `تم تحديث مستوى الضرر ${currentCode}: ${oldData[0].desc_ar} → ${description_ar}`,
        en: `Updated harm level ${currentCode}: ${oldData[0].desc_en} → ${description_en}`
      };
      await logAction(
        req.user.id,
        'update_harm_level',
        JSON.stringify(logDescription),
        'harm_level',
        id
      );
    } catch (logErr) {
      console.error('logAction error:', logErr);
    }
    
    res.json({ status: 'success', message: 'تم تحديث مستوى الضرر بنجاح.' });
  } catch (err) {
    console.error('updateHarmLevel error:', err);
    res.status(500).json({ status: 'error', message: 'فشل تحديث مستوى الضرر.' });
  }
};

// Delete Harm Level
exports.deleteHarmLevel = async (req, res) => {
  try {
    const { id } = req.params;
    
    const db = await mysql.createPool({
      host:     process.env.DB_HOST || 'localhost',
      user:     process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'Quality'
    });
    
    // جلب البيانات قبل الحذف
    const [harmLevelData] = await db.query('SELECT code, desc_ar, desc_en FROM harm_levels WHERE id = ?', [id]);
    
    if (harmLevelData.length === 0) {
      return res.status(404).json({ status: 'error', message: 'مستوى الضرر غير موجود.' });
    }
    
    // Check if harm level is used in tickets (only active tickets)
    const [tickets] = await db.query(
      'SELECT COUNT(*) as count FROM tickets WHERE harm_level_id = ? AND deleted_at IS NULL',
      [id]
    );
    
    if (tickets[0].count > 0) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'لا يمكن حذف مستوى الضرر لأنه مستخدم في تذاكر موجودة.' 
      });
    }
    
    await db.query('UPDATE harm_levels SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL', [id]);
    
    // تسجيل اللوق
    try {
      const logDescription = {
        ar: `تم حذف مستوى الضرر ${harmLevelData[0].code}: ${harmLevelData[0].desc_ar}`,
        en: `Deleted harm level ${harmLevelData[0].code}: ${harmLevelData[0].desc_en}`
      };
      await logAction(
        req.user.id,
        'delete_harm_level',
        JSON.stringify(logDescription),
        'harm_level',
        id
      );
    } catch (logErr) {
      console.error('logAction error:', logErr);
    }
    
    res.json({ status: 'success', message: 'تم حذف مستوى الضرر بنجاح.' });
  } catch (err) {
    console.error('deleteHarmLevel error:', err);
    res.status(500).json({ status: 'error', message: 'فشل حذف مستوى الضرر.' });
  }
};
