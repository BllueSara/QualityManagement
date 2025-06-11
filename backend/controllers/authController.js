const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { promisify } = require('util');
const mysql = require('mysql2/promise');

const router = express.Router();

const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'Quality'
});
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'medi.servee1@gmail.com',
    pass: 'gfcf qtwc lucm rdfd'
  }
});
const sendMail = promisify(transporter.sendMail.bind(transporter));

const register = async (req, res) => {
    try {
        const { username, email, password, department_id } = req.body;

        if (!username || !email || !password) {
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

        // تحديد الدور بناءً على اسم المستخدم
        const isAdmin = username.toLowerCase() === 'admin';
        
        // إذا كان المستخدم ليس admin، يجب تحديد القسم
        if (!isAdmin && !department_id) {
            return res.status(400).json({
                status: 'error',
                message: 'القسم مطلوب للمستخدمين العاديين'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // إدخال المستخدم في قاعدة البيانات
        const [result] = await db.execute(
            'INSERT INTO users (username, email, password, department_id, role) VALUES (?, ?, ?, ?, ?)',
            [username, email, hashedPassword, isAdmin ? null : department_id, isAdmin ? 'admin' : 'user']
        );

        const userId = result.insertId;
        const token = jwt.sign(
            { 
                id: userId, 
                email: email, 
                department_id: isAdmin ? null : department_id,
                role: isAdmin ? 'admin' : 'user'
            },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(201).json({
            status: 'success',
            message: 'تم إنشاء الحساب بنجاح وتسجيل الدخول تلقائياً',
            token: token,
            userId: userId,
            role: isAdmin ? 'admin' : 'user'
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
            'SELECT id, username, email, password, department_id, role FROM users WHERE email = ?',
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
            { id: user.id, email: user.email, department_id: user.department_id, role: user.role },
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
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ status: 'error', message: 'البريد الإلكتروني مطلوب' });

  try {
    const [rows] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (rows.length === 0) return res.status(404).json({ status: 'error', message: 'البريد الإلكتروني غير مسجل' });
    const userId = rows[0].id;

    const token   = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600 * 1000);

    await db.execute(
      'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
      [token, expires, userId]
    );

const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/html/reset-password.html?token=${token}`;
    await sendMail({
      from: 'medi.servee1@gmail.com',
      to: email,
      subject: 'إعادة ضبط كلمة المرور',
      html: `
        <p>لقد طلبت إعادة ضبط كلمة المرور لموقع الجودة. اضغط على الرابط التالي:</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة.</p>
      `
    });

    res.json({ status: 'success', message: 'تم إرسال رابط إعادة الضبط إلى بريدك الإلكتروني.' });
  } catch (err) {
    console.error('❌ forgot-password error:', err);
    res.status(500).json({ status: 'error', message: 'حدث خطأ أثناء إرسال الرابط' });
  }
};

/**
 * POST /reset-password/:token
 * يعالج رابط إعادة الضبط ويحدِّث كلمة المرور
 */
const resetPassword = async (req, res) => {
  const token       = req.params.token;
  const { newPassword } = req.body;
  if (!newPassword) return res.status(400).json({ status: 'error', message: 'كلمة المرور الجديدة مطلوبة' });

  try {
    const [rows] = await db.execute(
      'SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > NOW()',
      [token]
    );
    if (rows.length === 0) return res.status(400).json({ status: 'error', message: 'التوكن غير صالح أو منتهي الصلاحية' });
    const userId = rows[0].id;

    const hashed = await bcrypt.hash(newPassword, 12);
    await db.execute(
      `UPDATE users
         SET password = ?, reset_token = NULL, reset_token_expires = NULL
       WHERE id = ?`,
      [hashed, userId]
    );

    res.json({ status: 'success', message: 'تم إعادة ضبط كلمة المرور بنجاح.' });
  } catch (err) {
    console.error('❌ reset-password error:', err);
    res.status(500).json({ status: 'error', message: 'حدث خطأ أثناء إعادة الضبط' });
  }
};


const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/, '');
  if (!token) return res.status(401).json({ status: 'error', message: 'محتاج توكن' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ status: 'error', message: 'توكن غير صالح' });
    req.user = user;
    next();
  });
};
const adminResetPassword = async (req, res) => {
  const userId = req.params.id;
  const { newPassword } = req.body;
  if (!newPassword) {
    return res.status(400).json({ status: 'error', message: 'كلمة المرور جديدة مطلوبة' });
  }

  try {
    // تشفير الكلمة الجديدة
    const hashed = await bcrypt.hash(newPassword, 12);

    // تحديث قاعدة البيانات
    await db.execute(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashed, userId]
    );

    res.json({ status: 'success', message: 'تم تحديث كلمة المرور بنجاح.' });
  } catch (err) {
    console.error('❌ admin reset-password error:', err);
    res.status(500).json({ status: 'error', message: 'حدث خطأ أثناء التحديث' });
  }
};

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  authenticateToken,    // صدِّر الميدل وير أيضًا
  adminResetPassword    // دالة المسؤول
};
