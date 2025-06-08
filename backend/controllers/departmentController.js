const mysql = require('mysql2/promise');

// إنشاء اتصال قاعدة البيانات
const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'Quality'
});

// دالة جلب الأقسام
const getDepartments = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT id, name FROM departments');
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

module.exports = {
    getDepartments
}; 