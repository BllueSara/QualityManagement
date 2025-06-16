const mysql = require('mysql2/promise');
const multer = require('multer');
const jwt = require('jsonwebtoken');

const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'Quality'
});

// Helper for notifications, logs, etc. (implement as needed)
// const { insertNotification } = require('../models/notfications-utils');
// const { logAction } = require('../models/logger');

// ========== Committees CRUD ==========
exports.getCommittees = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM committees');
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ message: 'خطأ في جلب اللجان', error });
    }
};

exports.getCommittee = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM committees WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'اللجنة غير موجودة' });
        res.status(200).json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'خطأ في جلب اللجنة', error });
    }
};

exports.addCommittee = async (req, res) => {
    try {
        const { name } = req.body;
        const imagePath = req.file ? req.file.path.replace(/\\/g, '/') : null;
        if (!name || !imagePath) return res.status(400).json({ message: 'اسم اللجنة والصورة مطلوبان' });
        const [exists] = await db.execute('SELECT id FROM committees WHERE name = ?', [name]);
        if (exists.length > 0) return res.status(409).json({ message: 'هذه اللجنة موجودة بالفعل' });
        const [result] = await db.execute('INSERT INTO committees (name, image) VALUES (?, ?)', [name, imagePath]);
        res.status(201).json({ message: 'تم إضافة اللجنة بنجاح', committeeId: result.insertId });
    } catch (error) {
        res.status(500).json({ message: 'خطأ في إضافة اللجنة', error });
    }
};

exports.updateCommittee = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        const imagePath = req.file ? req.file.path.replace(/\\/g, '/') : null;
        if (!name) return res.status(400).json({ message: 'اسم اللجنة مطلوب' });
        let query = 'UPDATE committees SET name = ?';
        let params = [name];
        if (imagePath) {
            query += ', image = ?';
            params.push(imagePath);
        }
        query += ', updated_at = CURRENT_TIMESTAMP WHERE id = ?';
        params.push(id);
        const [result] = await db.execute(query, params);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'اللجنة غير موجودة' });
        res.status(200).json({ message: 'تم تعديل اللجنة بنجاح' });
    } catch (error) {
        res.status(500).json({ message: 'خطأ في تعديل اللجنة', error });
    }
};

exports.deleteCommittee = async (req, res) => {
    try {
        const { id } = req.params;
        // Check for related folders/contents
        const [related] = await db.execute('SELECT COUNT(*) as count FROM committee_folders f JOIN committee_contents c ON f.id = c.folder_id WHERE f.committee_id = ?', [id]);
        if (related[0].count > 0) return res.status(400).json({ message: 'لا يمكن حذف اللجنة لوجود محتويات مرتبطة بها' });
        const [result] = await db.execute('DELETE FROM committees WHERE id = ?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'اللجنة غير موجودة' });
        res.status(200).json({ message: 'تم حذف اللجنة بنجاح' });
    } catch (error) {
        res.status(500).json({ message: 'خطأ في حذف اللجنة', error });
    }
};

// ========== Folders CRUD ==========
exports.getFolders = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM committee_folders WHERE committee_id = ?', [req.params.committeeId]);
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ message: 'خطأ في جلب المجلدات', error });
    }
};

exports.getFolder = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM committee_folders WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'المجلد غير موجود' });
        res.status(200).json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'خطأ في جلب المجلد', error });
    }
};

exports.addFolder = async (req, res) => {
    try {
        const { name } = req.body;
        const { committeeId } = req.params;
        // استخرج userId من التوكن
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ message: 'مطلوب تسجيل الدخول' });
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const created_by = decoded.id;

        if (!name || !created_by) return res.status(400).json({ message: 'اسم المجلد ومعرّف المنشئ مطلوبان' });
        const [result] = await db.execute('INSERT INTO committee_folders (name, committee_id, created_by) VALUES (?, ?, ?)', [name, committeeId, created_by]);
        res.status(201).json({ message: 'تم إضافة المجلد بنجاح', folderId: result.insertId });
    } catch (error) {
        res.status(500).json({ message: 'خطأ في إضافة المجلد', error });
    }
};

exports.updateFolder = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        if (!name) return res.status(400).json({ message: 'اسم المجلد مطلوب' });
        const [result] = await db.execute('UPDATE committee_folders SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [name, id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'المجلد غير موجود' });
        res.status(200).json({ message: 'تم تعديل المجلد بنجاح' });
    } catch (error) {
        res.status(500).json({ message: 'خطأ في تعديل المجلد', error });
    }
};

exports.deleteFolder = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.execute('DELETE FROM committee_folders WHERE id = ?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'المجلد غير موجود' });
        res.status(200).json({ message: 'تم حذف المجلد بنجاح' });
    } catch (error) {
        res.status(500).json({ message: 'خطأ في حذف المجلد', error });
    }
};

// ========== Contents CRUD ==========
exports.getContents = async (req, res) => {
    try {
        // Get user role from token
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ message: 'مطلوب تسجيل الدخول' });
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const isAdmin = decoded.role === 'admin';

        // Build query based on user role
        let query = `
            SELECT 
                c.*,
                u.username as created_by_username,
                a.username as approved_by_username
            FROM committee_contents c
            LEFT JOIN users u ON c.created_by = u.id
            LEFT JOIN users a ON c.approved_by = a.id
            WHERE c.folder_id = ?
        `;
        let params = [req.params.folderId];

        // If not admin, only show approved content
        if (!isAdmin) {
            query += ' AND c.approval_status = "approved"';
        }

        query += ' ORDER BY c.created_at DESC';

        const [rows] = await db.execute(query, params);
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ message: 'خطأ في جلب المحتويات', error });
    }
};

exports.getContent = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM committee_contents WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'المحتوى غير موجود' });
        res.status(200).json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'خطأ في جلب المحتوى', error });
    }
};

exports.addContent = async (req, res) => {
    try {
        const { title, notes, approvers_required } = req.body;
        const { folderId } = req.params;
        const filePath = req.file ? req.file.path.replace(/\\/g, '/') : null;
        // استخرج userId من التوكن
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ message: 'مطلوب تسجيل الدخول' });
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const created_by = decoded.id;
        if (!title || !filePath || !created_by) return res.status(400).json({ message: 'العنوان والملف ومعرّف المنشئ مطلوبة' });
        const [result] = await db.execute('INSERT INTO committee_contents (title, file_path, notes, folder_id, created_by, approvers_required) VALUES (?, ?, ?, ?, ?, ?)', [title, filePath, notes, folderId, created_by, approvers_required]);
        res.status(201).json({ message: 'تم إضافة المحتوى بنجاح', contentId: result.insertId });
    } catch (error) {
        res.status(500).json({ message: 'خطأ في إضافة المحتوى', error });
    }
};

exports.updateContent = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, notes } = req.body;
        const filePath = req.file ? req.file.path.replace(/\\/g, '/') : null;
        let query = 'UPDATE committee_contents SET title = ?, notes = ?';
        let params = [title, notes];
        if (filePath) {
            query += ', file_path = ?';
            params.push(filePath);
        }
        query += ', updated_at = CURRENT_TIMESTAMP WHERE id = ?';
        params.push(id);
        const [result] = await db.execute(query, params);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'المحتوى غير موجود' });
        res.status(200).json({ message: 'تم تعديل المحتوى بنجاح' });
    } catch (error) {
        res.status(500).json({ message: 'خطأ في تعديل المحتوى', error });
    }
};

exports.deleteContent = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.execute('DELETE FROM committee_contents WHERE id = ?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'المحتوى غير موجود' });
        res.status(200).json({ message: 'تم حذف المحتوى بنجاح' });
    } catch (error) {
        res.status(500).json({ message: 'خطأ في حذف المحتوى', error });
    }
};

// ========== Approvals & Signatures ==========
exports.getApprovals = async (req, res) => {
    try {
        const { contentId } = req.params;
        const [rows] = await db.execute('SELECT * FROM committee_approval_logs WHERE content_id = ?', [contentId]);
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ message: 'خطأ في جلب سجل الاعتمادات', error });
    }
};

exports.approveContent = async (req, res) => {
    try {
        const { contentId } = req.params;
        const { approver_id, status, comments, signature, signed_as_proxy, electronic_signature, delegated_by } = req.body;
        // تحقق من وجود السجل
        const [exists] = await db.execute('SELECT * FROM committee_approval_logs WHERE content_id = ? AND approver_id = ?', [contentId, approver_id]);
        if (exists.length > 0) {
            // تحديث السجل
            await db.execute('UPDATE committee_approval_logs SET status = ?, comments = ?, signature = ?, signed_as_proxy = ?, electronic_signature = ?, delegated_by = ?, created_at = CURRENT_TIMESTAMP WHERE content_id = ? AND approver_id = ?', [status, comments, signature, signed_as_proxy, electronic_signature, delegated_by, contentId, approver_id]);
        } else {
            // إضافة سجل جديد
            await db.execute('INSERT INTO committee_approval_logs (content_id, approver_id, status, comments, signature, signed_as_proxy, electronic_signature, delegated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [contentId, approver_id, status, comments, signature, signed_as_proxy, electronic_signature, delegated_by]);
        }
        // تحديث حالة الموافقة في المحتوى
        await db.execute('UPDATE committee_contents SET approval_status = ? WHERE id = ?', [status, contentId]);
        res.status(200).json({ message: 'تم تحديث الاعتماد بنجاح' });
    } catch (error) {
        res.status(500).json({ message: 'خطأ في تحديث الاعتماد', error });
    }
}; 