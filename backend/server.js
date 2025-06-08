require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const mysql = require('mysql2');
const authRoutes = require('./routes/auth');
const departmentRoutes = require('./routes/departments');
const port = 3000;

// Middleware
app.use(cors()); // السماح بالطلبات من الفرونت
app.use(express.json());

// إضافة مسارات المصادقة
app.use('/api/auth', authRoutes);

// إضافة مسارات الأقسام
app.use('/api/departments', departmentRoutes);

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,     // اليوزر (root أو غيره)
    password: process.env.DB_PASSWORD, // كلمة المرور
    database: process.env.DB_NAME  // اسم قاعدة البيانات
});
  
// هنا نتأكد ان الاتصال شغال
db.connect((err) => {
    if (err) {
        console.error('❌ MySQL connection error:', err); // لو في خطأ، يطبع رسالة خطأ
    } else {
        console.log('✅ Connected to MySQL!'); // لو كل شي تمام، يطبع تم الاتصال
    }
});

// Route افتراضي
app.get('/', (req, res) => {
    res.send('الخادم يعمل بشكل صحيح!');
});

// تشغيل الخادم
app.listen(port, () => {
    console.log(`الخادم يعمل على http://localhost:${port}`);
});
