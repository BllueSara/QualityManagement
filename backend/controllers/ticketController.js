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

            const ticketData = {
                ...req.body,
                attachments: req.files ? req.files.map(file => ({
                    filename: file.filename,
                    path: file.path,
                    mimetype: file.mimetype
                })) : []
            };

            const ticketId = await Ticket.create(ticketData, req.user.id);
            res.status(201).json({ message: 'تم إنشاء التذكرة بنجاح', ticketId });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get all tickets
exports.getAllTickets = async (req, res) => {
    try {
        const tickets = await Ticket.findAll(req.user.id, req.user.role);
        res.json(tickets);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get a single ticket
exports.getTicket = async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id, req.user.id, req.user.role);
        if (!ticket) {
            return res.status(404).json({ error: 'التذكرة غير موجودة' });
        }
        res.json(ticket);
    } catch (error) {
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