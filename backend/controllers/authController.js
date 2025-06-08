// استيراد المكتبات المطلوبة
const bcrypt = require('bcryptjs'); // لتشفير كلمة المرور
const mysql = require('mysql2/promise'); // للتعامل مع قاعدة البيانات
const jwt = require('jsonwebtoken'); // استيراد مكتبة jsonwebtoken

// إنشاء اتصال قاعدة البيانات
const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'Quality'
});

// دالة التسجيل
const register = async (req, res) => {
    try {
        // استخراج البيانات من الطلب
        const { username, email, password, department_id } = req.body;

        // التحقق من وجود جميع البيانات المطلوبة
        if (!username || !email || !password || !department_id) {
            return res.status(400).json({
                status: 'error',
                message: 'جميع الحقول مطلوبة'
            });
        }

        // التحقق من صحة البريد الإلكتروني
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                status: 'error',
                message: 'البريد الإلكتروني غير صالح'
            });
        }

        // التحقق من طول كلمة المرور
        if (password.length < 6) {
            return res.status(400).json({
                status: 'error',
                message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'
            });
        }

        // التحقق من وجود المستخدم مسبقاً
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

        // تشفير كلمة المرور
        const hashedPassword = await bcrypt.hash(password, 10);

        // إدخال المستخدم الجديد في قاعدة البيانات
        const [result] = await db.execute(
            'INSERT INTO users (username, email, password, department_id) VALUES (?, ?, ?, ?)',
            [username, email, hashedPassword, department_id]
        );

        const userId = result.insertId;
        // إنشاء توكن JWT للمستخدم الجديد
        const token = jwt.sign({ id: userId, email: email, department_id: department_id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        // إرسال رسالة نجاح مع التوكن
        res.status(201).json({
            status: 'success',
            message: 'تم إنشاء الحساب بنجاح وتسجيل الدخول تلقائياً',
            token: token, // إرسال التوكن إلى الواجهة الأمامية
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

// دالة تسجيل الدخول
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // التحقق من وجود جميع البيانات المطلوبة
        if (!email || !password) {
            return res.status(400).json({
                status: 'error',
                message: 'البريد الإلكتروني وكلمة المرور مطلوبان'
            });
        }

        // البحث عن المستخدم بواسطة البريد الإلكتروني
        const [users] = await db.execute(
            'SELECT id, username, email, password, department_id FROM users WHERE email = ?',
            [email]
        );

        const user = users[0];

        // التحقق مما إذا كان المستخدم موجوداً
        if (!user) {
            return res.status(400).json({
                status: 'error',
                message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
            });
        }

        // مقارنة كلمة المرور المدخلة بكلمة المرور المشفرة
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({
                status: 'error',
                message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
            });
        }

        // إنشاء توكن JWT للمستخدم
        const token = jwt.sign(
            { id: user.id, email: user.email, department_id: user.department_id },
            process.env.JWT_SECRET,
            { expiresIn: '1h' } // التوكن صالح لمدة ساعة واحدة
        );

        // إرسال رسالة نجاح مع التوكن
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