const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'Quality'
});

const register = async (req, res) => {
    try {
        const { username, email, password, department_id } = req.body;

        if (!username || !email || !password || !department_id) {
            return res.status(400).json({
                status: 'error',
                message: 'جميع الحقول مطلوبة'
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                status: 'error',
                message: 'البريد الإلكتروني غير صالح'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                status: 'error',
                message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'
            });
        }

        const [existingUsers] = await db.execute(
            'SELECT * FROM users WHERE username = ? OR email = ?',
            [username, email]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({
                status: 'error',
                message: 'اسم المستخدم أو البريد الإلكتروني مستخدم مسبقاً'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await db.execute(
            'INSERT INTO users (username, email, password, department_id) VALUES (?, ?, ?, ?)',
            [username, email, hashedPassword, department_id]
        );

        const userId = result.insertId;
        const token = jwt.sign(
            { id: userId, email: email, department_id: department_id },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(201).json({
            status: 'success',
            message: 'تم إنشاء الحساب بنجاح وتسجيل الدخول تلقائياً',
            token: token,
            userId: userId
        });

    } catch (error) {
        console.error('خطأ في التسجيل:', error);
        res.status(500).json({
            status: 'error',
            message: 'حدث خطأ أثناء التسجيل'
        });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                status: 'error',
                message: 'البريد الإلكتروني وكلمة المرور مطلوبان'
            });
        }

        const [users] = await db.execute(
            'SELECT id, username, email, password, department_id FROM users WHERE email = ?',
            [email]
        );

        const user = users[0];

        if (!user) {
            return res.status(400).json({
                status: 'error',
                message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({
                status: 'error',
                message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
            });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, department_id: user.department_id },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(200).json({
            status: 'success',
            message: 'تم تسجيل الدخول بنجاح',
            token: token
        });

    } catch (error) {
        console.error('خطأ في تسجيل الدخول:', error);
        res.status(500).json({
            status: 'error',
            message: 'حدث خطأ أثناء تسجيل الدخول'
        });
    }
};

module.exports = {
    register,
    login
}; 