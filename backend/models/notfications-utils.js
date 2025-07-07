// utils/notificationUtils.js
const mysql = require('mysql2/promise');
const nodemailer = require('nodemailer');
const { promisify } = require('util');

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'Quality'
});

// إعداد البريد الإلكتروني
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'medi.servee1@gmail.com',
    pass: process.env.EMAIL_PASS || 'gfcf qtwc lucm rdfd'
  }
});

const sendMail = transporter.sendMail.bind(transporter);

// تصميم HTML احترافي للإشعارات
function getEmailTemplate(notification) {
  const { title, message, type, created_at } = notification;
  
  // تحديد الألوان حسب النوع
  const getTypeColor = (type) => {
    switch(type) {
      case 'ticket': return '#3B82F6'; // أزرق
      case 'approval': return '#10B981'; // أخضر
      case 'signature': return '#8B5CF6'; // بنفسجي
      case 'proxy': return '#F59E0B'; // برتقالي
      case 'add': return '#06B6D4'; // سماوي
      case 'update': return '#F59E0B'; // أصفر
      case 'delete': return '#EF4444'; // أحمر
      case 'close': return '#6B7280'; // رمادي
      case 'alert': return '#F97316'; // برتقالي غامق
      case 'system': return '#6366F1'; // نيلي
      default: return '#6B7280';
    }
  };

  const getTypeIcon = (type) => {
    switch(type) {
      case 'ticket': return '🎫';
      case 'approval': return '✅';
      case 'signature': return '✍️';
      case 'proxy': return '👥';
      case 'add': return '➕';
      case 'update': return '✏️';
      case 'delete': return '🗑️';
      case 'close': return '🔒';
      case 'alert': return '⚠️';
      case 'system': return '⚙️';
      default: return '🔔';
    }
  };

  const typeColor = getTypeColor(type);
  const typeIcon = getTypeIcon(type);
  const date = new Date(created_at).toLocaleDateString('ar-SA');

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>إشعار جديد - نظام الجودة</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #f5f5f5;
          direction: rtl;
        }
        
        .email-container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .header {
          background: linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%);
          color: white;
          padding: 30px 20px;
          text-align: center;
        }
        
        .header h1 {
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 8px;
        }
        
        .header p {
          font-size: 14px;
          opacity: 0.9;
        }
        
        .notification-card {
          margin: 20px;
          padding: 25px;
          border-radius: 8px;
          border-left: 4px solid ${typeColor};
          background-color: #fafafa;
        }
        
        .notification-header {
          display: flex;
          align-items: center;
          margin-bottom: 15px;
        }
        
        .notification-icon {
          font-size: 24px;
          margin-left: 12px;
        }
        
        .notification-title {
          font-size: 18px;
          font-weight: 600;
          color: #1f2937;
        }
        
        .notification-message {
          font-size: 14px;
          color: #4b5563;
          line-height: 1.6;
          margin-bottom: 15px;
        }
        
        .notification-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          color: #6b7280;
          border-top: 1px solid #e5e7eb;
          padding-top: 15px;
        }
        
        .notification-type {
          background-color: ${typeColor};
          color: white;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 500;
        }
        
        .footer {
          background-color: #f9fafb;
          padding: 20px;
          text-align: center;
          border-top: 1px solid #e5e7eb;
        }
        
        .footer p {
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 8px;
        }
        
        .footer a {
          color: #3B82F6;
          text-decoration: none;
        }
        
        @media (max-width: 600px) {
          .email-container {
            margin: 10px;
          }
          
          .notification-card {
            margin: 15px;
            padding: 20px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <h1>نظام الجودة</h1>
          <p>مستشفى الملك عبد العزيز</p>
        </div>
        
        <div class="notification-card">
          <div class="notification-header">
            <span class="notification-icon">${typeIcon}</span>
            <h2 class="notification-title">${title}</h2>
          </div>
          
          <div class="notification-message">
            ${message}
          </div>
          
          <div class="notification-meta">
            <span class="notification-type">${type}</span>
            <span>${date}</span>
          </div>
        </div>
        
        <div class="footer">
          <p>هذا الإشعار تم إرساله من نظام الجودة</p>
          <p>للدخول إلى النظام، <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}">اضغط هنا</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// دالة إدراج إشعار مع إرسال بريد إلكتروني
async function insertNotification(userId, title, message, type = 'ticket') {
  try {
    // 1) إدراج الإشعار في قاعدة البيانات
    const [result] = await db.execute(
      `INSERT INTO notifications 
       (user_id, title, message, type, created_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [userId, title, message, type]
    );

    // 2) إرسال البريد الإلكتروني
    try {
      // جلب معلومات المستخدم
      const [userRows] = await db.execute(
        'SELECT email, username FROM users WHERE id = ?',
        [userId]
      );

      if (userRows.length > 0 && userRows[0].email) {
        const user = userRows[0];
        const notification = {
          title,
          message,
          type,
          created_at: new Date()
        };

        // إرسال البريد الإلكتروني
        await transporter.sendMail({
          from: process.env.EMAIL_USER || 'medi.servee1@gmail.com',
          to: user.email,
          subject: `إشعار جديد: ${title}`,
          html: getEmailTemplate(notification)
        });
      }
    } catch (emailError) {
      console.error('Error sending email notification:', emailError);
      // لا نوقف العملية إذا فشل إرسال البريد
    }

    return result.insertId;
  } catch (error) {
    console.error('Error inserting notification:', error);
    throw error;
  }
}

// دالة إرسال إشعارات التذاكر
async function sendTicketNotification(userId, action, ticketId, ticketTitle) {
  const notifications = {
    create: {
      title: 'تم إنشاء تقرير OVR جديد',
      message: `تم إنشاء تقرير OVR جديد برقم ${ticketId}: ${ticketTitle}`,
      type: 'ticket'
    },
    update: {
      title: 'تم تحديث تقرير OVR',
      message: `تم تحديث تقرير OVR برقم ${ticketId}: ${ticketTitle}`,
      type: 'update'
    },
    close: {
      title: 'تم إغلاق تقرير OVR',
      message: `تم إغلاق تقرير OVR برقم ${ticketId}: ${ticketTitle}`,
      type: 'close'
    },
    assign: {
      title: 'تم تعيين تقرير OVR لك',
      message: `تم تعيين تقرير OVR برقم ${ticketId}: ${ticketTitle} لك`,
      type: 'ticket'
    }
  };

  const notification = notifications[action];
  if (notification) {
    return await insertNotification(userId, notification.title, notification.message, notification.type);
  }
}

// دالة إرسال إشعارات الاعتماد
async function sendApprovalNotification(userId, action, contentId, contentTitle) {
  const notifications = {
    request: {
      title: 'طلب اعتماد جديد',
      message: `طلب اعتماد جديد للمحتوى: ${contentTitle}`,
      type: 'approval'
    },
    approved: {
      title: 'تم اعتماد المحتوى',
      message: `تم اعتماد المحتوى: ${contentTitle}`,
      type: 'approval'
    },
    rejected: {
      title: 'تم رفض المحتوى',
      message: `تم رفض المحتوى: ${contentTitle}`,
      type: 'approval'
    }
  };

  const notification = notifications[action];
  if (notification) {
    return await insertNotification(userId, notification.title, notification.message, notification.type);
  }
}

module.exports = {
  insertNotification,
  sendTicketNotification,
  sendApprovalNotification,
  getEmailTemplate
};
