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
    user: process.env.EMAIL_USER || 'medi.servee1@gmail.com',
    pass: process.env.EMAIL_PASS || 'gfcf qtwc lucm rdfd'
  }
});

const sendMail = promisify(transporter.sendMail.bind(transporter));

// 1) تسجيل مستخدم جديد
const register = async (req, res) => {
  try {
    const { username, email, password, department_id, role } = req.body;

    // تأكد من توافر الحقول الأساسية
    if (!username || !email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'اسم المستخدم والبريد الإلكتروني وكلمة المرور مطلوبة'
      });
    }

    // تحقق من صحة البريد
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        status: 'error',
        message: 'البريد الإلكتروني غير صالح'
      });
    }

    // تأكد من طول كلمة المرور
    if (password.length < 6) {
      return res.status(400).json({
        status: 'error',
        message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'
      });
    }

    // تحقق من عدم تكرار المستخدم أو البريد
    const [existing] = await db.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );
    if (existing.length > 0) {
      return res.status(409).json({
        status: 'error',
        message: 'اسم المستخدم أو البريد الإلكتروني مستخدم مسبقاً'
      });
    }

    // التحقق من وجود الأقسام إذا تم تحديد قسم
    if (department_id) {
      const [departments] = await db.execute('SELECT id FROM departments WHERE id = ?', [department_id]);
      if (departments.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'القسم المحدد غير موجود'
        });
      }
    }

    // شفر كلمة المرور
    const hashedPassword = await bcrypt.hash(password, 10);

    // تحديد الدور الافتراضي إذا لم يتم تحديده
    const userRole = role || 'user';

    // أدخل المستخدم
    const [result] = await db.execute(
      `INSERT INTO users (
        username, 
        email, 
        password, 
        department_id, 
        role,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [username, email, hashedPassword, department_id || null, userRole]
    );

    const userId = result.insertId;

    // أنشئ توكن يحتوي على معلومات المستخدم
    const token = jwt.sign(
      { 
        id: userId, 
        email, 
        department_id, 
        role: userRole,
        username 
      },
      process.env.JWT_SECRET,
    );

    res.status(201).json({
      status: 'success',
      message: 'تم إنشاء الحساب وتسجيل الدخول تلقائياً',
      token,
      user: {
        id: userId,
        username,
        email,
        department_id,
        role: userRole
      }
    });

  } catch (error) {
    console.error('خطأ في التسجيل:', error);
    res.status(500).json({
      status: 'error',
      message: 'حدث خطأ أثناء التسجيل'
    });
  }
};

// 2) تسجيل الدخول
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'البريد الإلكتروني وكلمة المرور مطلوبان'
      });
    }

    // جلب المستخدم مع معلومات القسم
    const [rows] = await db.execute(
      `SELECT 
        u.id, 
        u.username, 
        u.email, 
        u.password, 
        u.department_id,
        u.role,
        d.name as department_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.email = ?`,
      [email]
    );

    const user = rows[0];
    if (!user) {
      return res.status(400).json({
        status: 'error',
        message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
      });
    }

    // تحقق من كلمة المرور
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        status: 'error',
        message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
      });
    }

    // أنشئ توكن
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        department_id: user.department_id, 
        role: user.role,
        username: user.username
      },
      process.env.JWT_SECRET,
    );

    res.status(200).json({
      status: 'success',
      message: 'تم تسجيل الدخول بنجاح',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        department_id: user.department_id,
        department_name: user.department_name,
        role: user.role
      }
    });

  } catch (error) {
    console.error('خطأ في تسجيل الدخول:', error);
    res.status(500).json({
      status: 'error',
      message: 'حدث خطأ أثناء تسجيل الدخول'
    });
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
    console.error('❌ forgot-password error:', err);
    res.status(500).json({ 
      status: 'error', 
      message: 'حدث خطأ أثناء إرسال الرابط' 
    });
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
    console.error('❌ reset-password error:', err);
    res.status(500).json({ 
      status: 'error', 
      message: 'حدث خطأ أثناء إعادة الضبط' 
    });
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
    console.error('خطأ في إعادة تعيين كلمة المرور:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'حدث خطأ أثناء إعادة تعيين كلمة المرور'
    });
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
