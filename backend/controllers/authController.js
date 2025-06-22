const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { promisify } = require('util');
const mysql = require('mysql2/promise');
const { logAction } = require('../models/logger');

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
    user: process.env.EMAIL_USER || 'medi.servee1@gmail.com',
    pass: process.env.EMAIL_PASS || 'gfcf qtwc lucm rdfd'
  }
});

const sendMail = promisify(transporter.sendMail.bind(transporter));

// 1) تسجيل مستخدم جديد
const register = async (req, res) => {
  try {
    const { username, email, password, department_id, role, employee_number } = req.body;

    // 1) الحقول الأساسية
    if (!username || !email || !password ) {
      return res.status(400).json({
        status: 'error',
        message: 'اسم المستخدم، البريد الإلكتروني، كلمة المرور   '
      });
    }

    // 2) تحقق من صحة البريد
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        status: 'error',
        message: 'البريد الإلكتروني غير صالح'
      });
    }

    // 3) تحقق من طول كلمة المرور
    if (password.length < 6) {
      return res.status(400).json({
        status: 'error',
        message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'
      });
    }

    // 4) تحقق من عدم تكرار اسم مستخدم أو بريد أو رقم وظيفي
    const [existing] = await db.execute(
      `SELECT id FROM users 
       WHERE username = ? OR email = ? OR employee_number = ?`,
      [username, email, employee_number]
    );
    if (existing.length > 0) {
      return res.status(409).json({
        status: 'error',
        message: 'اسم المستخدم أو البريد الإلكتروني أو الرقم الوظيفي مستخدم مسبقاً'
      });
    }

    // 5) تحقق من وجود القسم
    if (department_id) {
      const [deps] = await db.execute('SELECT id FROM departments WHERE id = ?', [department_id]);
      if (deps.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'القسم المحدد غير موجود'
        });
      }
    }

    // 6) تشفير كلمة المرور
    const hashedPassword = await bcrypt.hash(password, 10);

    // 7) دور المستخدم
    const userRole = role || 'user';

    // 8) إدخال المستخدم
    const [result] = await db.execute(
      `INSERT INTO users 
        (username, email, employee_number, password, department_id, role, created_at, updated_at)
       VALUES (?,       ?,     ?,                 ?,        ?,             ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [username, email, employee_number, hashedPassword, department_id || null, userRole]
    );
    const userId = result.insertId;

    // 9) إنشاء JWT
    const token = jwt.sign(
      { id: userId, username, email, employee_number, department_id, role: userRole },
      process.env.JWT_SECRET
    );

     const logDescription = {
            ar: 'تم تسجيل مستخدم جديد: ' + username,
            en: 'Registered new user: ' + username
        };
        
    await logAction(
      userId,
      'register_user',
JSON.stringify(logDescription),      'user',
      userId
    );
    

    // 10) ردّ العميل
    res.status(201).json({
      status: 'success',
      message: 'تم إنشاء الحساب وتسجيل الدخول تلقائياً',
      token,
      user: { id: userId, username, email, employee_number, department_id, role: userRole }
    });

  } catch (error) {
    console.error('Register Error:', error);
    res.status(500).json({ status: 'error', message: 'خطأ في التسجيل' });
  }
};


// 2) تسجيل الدخول
const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'حقل الدخول وكلمة المرور مطلوبان'
      });
    }

    // جلب المستخدم عبر username أو email أو employee_number
    const [rows] = await db.execute(
      `SELECT 
         u.id, u.username, u.email, u.password,
         u.employee_number,
         u.department_id, u.role,
         u.status,
         d.name AS department_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.username = ? OR u.email = ? OR u.employee_number = ?`,
      [identifier, identifier, identifier]
    );
    const user = rows[0];
    if (!user) {
      return res.status(400).json({
        status: 'error',
        message: 'بيانات الدخول أو كلمة المرور غير صحيحة'
      });
    }
    // **منع تسجيل الدخول إذا كانت الحالة غير نشطة**
    if (user.status !== 'active') {
      return res.status(403).json({
        status: 'error',
        message: 'حسابك معطل، لا يمكنك تسجيل الدخول'
      });
    }
    // تحقق من كلمة المرور
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        status: 'error',
        message: 'بيانات الدخول أو كلمة المرور غير صحيحة'
      });
    }
const [departmentRows] = await db.query(
  'SELECT name FROM departments WHERE id = ?',
  [user.department_id]
);

const departmentName = departmentRows[0]?.name || '';
    // إنشاء التوكن
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        employee_number: user.employee_number,
        department_id: user.department_id,
            department_name: departmentName, // ✅ أضف اسم القسم هنا

        role: user.role
      },
      process.env.JWT_SECRET
    );



    

    // ✅ تسجيل اللوق بعد نجاح تسجيل الدخول
    try {
        const logDescription = {
            ar: 'تم تسجيل الدخول',
            en: 'User logged in'
        };
        
        await logAction(user.id, 'login', JSON.stringify(logDescription), 'user', user.id);
    } catch (logErr) {
        console.error('logAction error:', logErr);
    }

    res.status(200).json({
      status: 'success',
      message: 'تم تسجيل الدخول بنجاح',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        employee_number: user.employee_number,
        department_id: user.department_id,
        department_name: user.department_name,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'خطأ في تسجيل الدخول' });
  }
};


// 3) نسيان كلمة المرور
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'البريد الإلكتروني مطلوب' 
    });
  }

  try {
    const [rows] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(404).json({ 
        status: 'error', 
        message: 'البريد الإلكتروني غير مسجل' 
      });
    }

    const userId = rows[0].id;
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600 * 1000);

    await db.execute(
      `UPDATE users 
       SET reset_token = ?, 
           reset_token_expires = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [token, expires, userId]
    );

    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
    await sendMail({
      from: process.env.EMAIL_USER || 'medi.servee1@gmail.com',
      to: email,
      subject: 'إعادة ضبط كلمة المرور',
      html: `
        <p>لقد طلبت إعادة ضبط كلمة المرور لموقع الجودة. اضغط على الرابط التالي:</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة.</p>
        <p>ينتهي الرابط خلال ساعة واحدة.</p>
      `
    });

    res.json({ 
      status: 'success', 
      message: 'تم إرسال رابط إعادة الضبط إلى بريدك الإلكتروني.' 
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to send reset link.' });
  }
};

// 4) إعادة تعيين كلمة المرور
const resetPassword = async (req, res) => {
  const token = req.params.token;
  const { newPassword } = req.body;
  
  if (!newPassword) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'كلمة المرور الجديدة مطلوبة' 
    });
  }

  try {
    const [rows] = await db.execute(
      'SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > NOW()',
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'التوكن غير صالح أو منتهي الصلاحية' 
      });
    }

    const userId = rows[0].id;
    const hashed = await bcrypt.hash(newPassword, 12);

    await db.execute(
      `UPDATE users
       SET password = ?, 
           reset_token = NULL, 
           reset_token_expires = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [hashed, userId]
    );

    res.json({ 
      status: 'success', 
      message: 'تم إعادة ضبط كلمة المرور بنجاح.' 
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to reset password.' });
  }
};

// 5) التحقق من التوكن
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/, '');
  
  if (!token) {
    return res.status(401).json({ 
      status: 'error', 
      message: 'محتاج توكن' 
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ 
        status: 'error', 
        message: 'توكن غير صالح' 
      });
    }
    req.user = user;
    next();
  });
};

// 6) إعادة تعيين كلمة المرور من قبل المدير
const adminResetPassword = async (req, res) => {
  const userId = req.params.id;
  const { newPassword } = req.body;
  
  if (!newPassword) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'كلمة المرور جديدة مطلوبة' 
    });
  }

  try {
    // تشفير الكلمة الجديدة
    const hashed = await bcrypt.hash(newPassword, 12);

    // تحديث كلمة المرور
    const [result] = await db.execute(
      `UPDATE users 
       SET password = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [hashed, userId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ 
        status: 'error', 
        message: 'المستخدم غير موجود' 
      });
    }

    res.status(200).json({ 
      status: 'success',
      message: 'تم إعادة تعيين كلمة المرور بنجاح'
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في إعادة تعيين كلمة المرور' });
  }
};
function checkRole(allowedRoles = []) {
  return (req, res, next) => {
    const user = req.user;
    if (!user || !user.role) {
      return res.status(401).json({ status: 'error', message: 'مستخدم غير مصادق' });
    }
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ status: 'error', message: 'ليس لديك صلاحية الوصول إلى هذا القسم' });
    }
    next();
  };
}
module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  authenticateToken,
  adminResetPassword,
  checkRole
};
