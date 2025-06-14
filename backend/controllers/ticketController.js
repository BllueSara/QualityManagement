const Ticket = require('../models/ticketModel');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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

      // 4) أعِد الاستجابة
      res.status(201).json({
        status: 'success',
        message: 'تم إنشاء التذكرة بنجاح',
        data: { id: ticketId }
      });
    });
  } catch (error) {
    console.error('createTicket error:', error);
    res.status(500).json({ error: 'فشل في إنشاء التذكرة' });
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
    console.log('→ getTicket called with params.id =', req.params.id);
    console.log('   req.user =', req.user);

    const ticket = await Ticket.findById(
      req.params.id,
      req.user.id,
      req.user.role
    );
    console.log('   findById result =', ticket);

    if (!ticket) {
      return res
        .status(404)
        .json({ error: 'التذكرة غير موجودة أو لا تملك صلاحية الوصول' });
    }
    res.json(ticket);
  } catch (error) {
    console.error('‼ Error in getTicket:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update a ticket
exports.updateTicket = async (req, res) => {
    try {
        upload(req, res, async function (err) {
            if (err) {
                return res.status(400).json({ error: err.message });
            }

            const ticketData = {
                ...req.body,
                attachments: req.files ? req.files.map(file => ({
                    filename: file.filename,
                    path: file.path,
                    mimetype: file.mimetype
                })) : []
            };

            await Ticket.update(req.params.id, ticketData, req.user.id);
            res.json({ message: 'تم تحديث التذكرة بنجاح' });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Delete a ticket
exports.deleteTicket = async (req, res) => {
    try {
        await Ticket.delete(req.params.id);
        res.json({ message: 'تم حذف التذكرة بنجاح' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Assign a ticket
exports.assignTicket = async (req, res) => {
    try {
        const { assignedTo, comments } = req.body;
        await Ticket.assignTicket(req.params.id, assignedTo, req.user.id, comments);
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
    const userId   = req.user.id;
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'النص لا يمكن أن يكون فارغاً' });
    }

    // ندعو الموديل ليضيف الرد
    const newReply = await Ticket.addReply(ticketId, userId, text.trim());
    // نعيد البيانات للمستخدم
    res.status(201).json(newReply);

  } catch (err) {
    console.error('‼ Error in addReply:', err);
    res.status(500).json({ message: err.message });
  }
};
exports.assignToUsers = async (req, res) => {
  const ticketId = req.params.id;
  const { assignees } = req.body;  // مصفوفة userIds
  await Ticket.assignUsers(ticketId, assignees, req.user.id);
  res.json({ status: 'success' });
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
