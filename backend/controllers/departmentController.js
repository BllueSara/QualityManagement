const mysql = require('mysql2/promise');

const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'Quality'
});
const { logAction } = require('../models/logger');

const getDepartments = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT id, name, image, created_at, updated_at FROM departments');
        res.status(200).json({
            status: 'success',
            data: rows
        });
    } catch (error) {
        console.error('خطأ في جلب الأقسام:', error);
        res.status(500).json({
            status: 'error',
            message: 'حدث خطأ أثناء جلب الأقسام'
        });
    }
};

const addDepartment = async (req, res) => {
    try {
        const { name } = req.body;
        const imagePath = req.file ? req.file.path.replace(/\\/g, '/') : null;

        if (!name || !imagePath) {
            return res.status(400).json({
                status: 'error',
                message: 'اسم القسم والصورة مطلوبان'
            });
        }

        // التحقق مما إذا كان القسم موجودًا بالفعل
        const [existingDepartments] = await db.execute(
            'SELECT id FROM departments WHERE name = ?',
            [name]
        );

        if (existingDepartments.length > 0) {
            return res.status(409).json({
                status: 'error',
                message: 'هذا القسم موجود بالفعل'
            });
        }

        const [result] = await db.execute(
            'INSERT INTO departments (name, image, created_at, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
            [name, imagePath]
        );

        res.status(201).json({
            status: 'success',
            message: 'تم إضافة القسم بنجاح',
            departmentId: result.insertId
        });

    } catch (error) {
        console.error('خطأ في إضافة القسم:', error);
        res.status(500).json({
            status: 'error',
            message: 'حدث خطأ أثناء إضافة القسم'
        });
    }
};

const updateDepartment = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        const imagePath = req.file ? req.file.path.replace(/\\/g, '/') : null;

        if (!name) {
            return res.status(400).json({
                status: 'error',
                message: 'اسم القسم مطلوب للتعديل'
            });
        }

        let query = 'UPDATE departments SET name = ?, updated_at = CURRENT_TIMESTAMP';
        let params = [name];

        if (imagePath) {
            query += ', image = ?';
            params.push(imagePath);
        }

        query += ' WHERE id = ?';
        params.push(id);

        const [result] = await db.execute(query, params);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'القسم غير موجود'
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'تم تعديل القسم بنجاح'
        });

    } catch (error) {
        console.error('خطأ في تعديل القسم:', error);
        res.status(500).json({
            status: 'error',
            message: 'حدث خطأ أثناء تعديل القسم'
        });
    }
};

const deleteDepartment = async (req, res) => {
    try {
        const { id } = req.params;

        // التحقق من وجود محتويات مرتبطة بالقسم
        const [relatedContents] = await db.execute(
            'SELECT COUNT(*) as count FROM folders f JOIN contents c ON f.id = c.folder_id WHERE f.department_id = ?',
            [id]
        );

        if (relatedContents[0].count > 0) {
            return res.status(400).json({
                status: 'error',
                message: 'لا يمكن حذف القسم لوجود محتويات مرتبطة به'
            });
        }

        const [result] = await db.execute(
            'DELETE FROM departments WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'القسم غير موجود'
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'تم حذف القسم بنجاح'
        });

    } catch (error) {
        console.error('خطأ في حذف القسم:', error);
        res.status(500).json({
            status: 'error',
            message: 'حدث خطأ أثناء حذف القسم'
        });
    }
};

module.exports = {
    getDepartments,
    addDepartment,
    updateDepartment,
    deleteDepartment
}; 