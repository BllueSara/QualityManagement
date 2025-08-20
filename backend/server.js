// server.js
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const mysql = require('mysql2/promise');

const app = express();

// Serve static files from all directories

app.use(express.static(path.join(__dirname)));
app.use(express.static(path.join(__dirname, '..')));
app.use(express.static(path.join(__dirname, '..', '..')));


// Routers
const authRouter             = require('./routes/auth');
const usersRouter            = require('./routes/users.routes');
const permsDefRouter         = require('./routes/permissionsDef.routes');
const permsRouter            = require('./routes/permissions.routes');
const deptRouter             = require('./routes/departments');
const folderRouter           = require('./routes/folderRoutes');
const folderContentRouter    = require('./routes/folderContentRoutes');
const contentRouter          = require('./routes/contentRoutes');
const approvalRouter         = require('./routes/approvalRoutes');
const ticketRouter           = require('./routes/ticketRoutes');
const pendingApprovalRoutes = require('./routes/pendingApprovals.routes');
const pendingCommitteeApprovalRoutes = require('./routes/pendingCommitteeApprovals.routes');
const dashboardRouter = require('./routes/dashboardRoutes');
const committeesRoutes = require('./routes/committees');
const committeeApprovalRoutes = require('./routes/committeeApprovalRoutes');
const globalContentRouter = require('./routes/globalContentRoutes');
const reportsRoutes = require('./routes/reportsRoutes');
const ticketReportRoutes = require('./routes/ticketReportRoutes');
const logsRoutes = require('./routes/logsRoutes');
const jobTitlesRoutes = require('./routes/jobTitles');
const jobNamesRoutes = require('./routes/jobNames');
const deadlineRoutes = require('./routes/deadlineRoutes');
const protocolRoutes = require('./routes/protocolRoutes');
const protocolModel = require('./models/protocolModel');
const deletedItemsRoutes = require('./routes/deletedItemsRoutes');
const { setupSoftDelete } = require('./setup-soft-delete');

 





app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', require('express').static('uploads'));

// Mounting API endpoints
app.use('/api/auth',        authRouter);
app.use('/api/users', permsRouter);
app.use('/api/users',       usersRouter);
app.use('/api/permissions/definitions', permsDefRouter);
app.use('/api/departments', deptRouter);
app.use('/api/tickets',     ticketRouter);
app.use('/api/committees',  (req, res, next) => {
  // console.log('Request hitting /api/committees route');
  next();
}, committeesRoutes);

// folders nested under departments
app.use('/api/departments/:departmentId/folders', folderRouter);
// ✅ هذا الصحيح
app.use('/api/folders', folderRouter);


// contents nested under folders
app.use('/api/folders', folderContentRouter);




// global content endpoints (my-uploads)
app.use('/api/contents', contentRouter);

app.use('/api/approvals', approvalRouter);


app.use('/api/pending-approvals', pendingApprovalRoutes);
app.use('/api/pending-committee-approvals', pendingCommitteeApprovalRoutes);
app.use('/api/committee-approvals', committeeApprovalRoutes);

app.use('/api/dashboard', dashboardRouter);
app.use('/api/reports', reportsRoutes);
app.use('/api/tickets/report', ticketReportRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/job-titles', jobTitlesRoutes);
app.use('/api/job-names', jobNamesRoutes);
app.use('/api/deadlines', deadlineRoutes);
app.use('/api/protocols', protocolRoutes);
app.use('/api/deleted-items', deletedItemsRoutes);
app.use('/api/super-admin', require('./routes/superAdmin.routes'));
app.use('/api', globalContentRouter); // 👈 هذا يعطيك: /api/content-names

// Ensure all committee routes are correctly loaded

// serve static frontend
app.use('/', express.static(path.join(__dirname, '../frontend')));

app.get('/health', (req, res) => res.send('OK'));
app.use((err, req, res, next) => {
  // console.error(err);
  res.status(500).json({ status: 'error', message: 'Internal Server Error' });
});

// دالة تنظيف السجلات القديمة عند بدء التطبيق
const cleanupOldLogs = async () => {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    
    // حذف جميع السجلات بالنيابة التي لا تتوافق مع active_delegations
    const [result] = await pool.execute(`
      DELETE FROM approval_logs 
      WHERE signed_as_proxy = 1 
      AND delegated_by IS NOT NULL
      AND (delegated_by, approver_id) NOT IN (
        SELECT ad.user_id, ad.delegate_id 
        FROM active_delegations ad
      )
    `);
    await pool.end();
  } catch (err) {
    // يمكن إبقاء رسالة الخطأ الأساسية فقط
    console.error('خطأ في تنظيف approval_logs:', err);
  }
};

// إضافة scheduler للمواعيد النهائية
const deadlineModel = require('./models/deadlineModel');
const { insertNotification } = require('./models/notfications-utils');

// إنشاء جدول المواعيد النهائية عند بدء التطبيق
deadlineModel.createDeadlinesTable().then(() => {
  // console.log('✅ Deadlines table created/verified successfully');
}).catch(err => {
  // console.error('❌ Error creating deadlines table:', err);
});

// دالة لاستخراج النص العربي من JSON object (للإيميل)
function extractArabicText(text) {
  if (!text) return '';
  
  try {
    // محاولة تحليل النص كـ JSON
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      // إذا كان JSON object، استخدم النص العربي
      return parsed.ar || parsed.arabic || text;
    }
  } catch (e) {
    // إذا لم يكن JSON، استخدم النص كما هو
  }
  
  return text;
}

// دالة للحفاظ على JSON object كما هو (للإشعارات)
function preserveJsonText(text) {
  if (!text) return '';
  
  try {
    // محاولة تحليل النص كـ JSON
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      // إذا كان JSON object، احتفظ به كما هو
      return text;
    }
  } catch (e) {
    // إذا لم يكن JSON، استخدم النص كما هو
  }
  
  return text;
}

// دالة فحص المواعيد النهائية المنتهية الصلاحية
const checkExpiredDeadlines = async () => {
  try {
    const expiredDeadlines = await deadlineModel.getExpiredDeadlines();
    
    for (const deadline of expiredDeadlines) {
      await deadlineModel.updateDeadlineStatus(deadline.id, 'expired');
      
      // بناء رسالة الإشعار حسب نوع المحتوى
      let notificationMessage;
      
      if (deadline.content_type === 'department') {
        // للمحتوى من قسم: إظهار نوع القسم + اسم القسم + نوع المحتوى
        let departmentName = deadline.department_or_committee_name || deadline.source_name;
        const contentTypeName = deadline.content_type_name || '';
        const departmentType = deadline.department_type || 'department';
        
        // ترجمة نوع القسم
        let typeText;
        switch (departmentType) {
          case 'administration':
            typeText = 'إدارة';
            break;
          case 'executive_administration':
            typeText = 'إدارة تنفيذية';
            break;
          default:
            typeText = 'قسم';
        }
        
        // رسالة للإشعارات (تحتوي على JSON object)
        const notificationDepartmentName = preserveJsonText(departmentName);
        const notificationMessage = `انتهت مهلة الاعتماد للمحتوى "${deadline.content_title}" من ${typeText} "${notificationDepartmentName}". يرجى مراجعة المحتوى والاعتماد عليه في أقرب وقت ممكن.`;
        
        // رسالة للإيميل (تحتوي على النص العربي)
        const emailDepartmentName = extractArabicText(departmentName);
        const emailMessage = `انتهت مهلة الاعتماد للمحتوى "${deadline.content_title}" من ${typeText} "${emailDepartmentName}". يرجى مراجعة المحتوى والاعتماد عليه في أقرب وقت ممكن.`;
        
        await insertNotification(
          deadline.approver_id,
          'انتهت مهلة الاعتماد',
          notificationMessage,
          'alert',
          { emailMessage } // تمرير رسالة الإيميل المنفصلة
        );
      } else {
        // للمحتوى من لجنة: إظهار اسم اللجنة فقط (لأنه يبدأ بـ "لجنة")
        let committeeName = deadline.department_or_committee_name || deadline.source_name;
        
        // رسالة للإشعارات (تحتوي على JSON object)
        const notificationCommitteeName = preserveJsonText(committeeName);
        const notificationMessage = `انتهت مهلة الاعتماد للمحتوى "${deadline.content_title}" من "${notificationCommitteeName}". يرجى مراجعة المحتوى والاعتماد عليه في أقرب وقت ممكن.`;
        
        // رسالة للإيميل (تحتوي على النص العربي)
        const emailCommitteeName = extractArabicText(committeeName);
        const emailMessage = `انتهت مهلة الاعتماد للمحتوى "${deadline.content_title}" من "${emailCommitteeName}". يرجى مراجعة المحتوى والاعتماد عليه في أقرب وقت ممكن.`;
        
        await insertNotification(
          deadline.approver_id,
          'انتهت مهلة الاعتماد',
          notificationMessage,
          'alert',
          { emailMessage } // تمرير رسالة الإيميل المنفصلة
        );
      }
    }
  } catch (error) {
    console.error('خطأ في فحص المواعيد النهائية:', error);
  }
};

// تشغيل فحص المواعيد النهائية كل 5 دقائق
setInterval(checkExpiredDeadlines, 5 * 60 * 1000);

// إنشاء جدول المواعيد النهائية عند بدء التطبيق
const initializeDeadlines = async () => {
  try {
    await deadlineModel.createDeadlinesTable();
    console.log('تم تهيئة جدول المواعيد النهائية بنجاح');
  } catch (error) {
    console.error('خطأ في إنشاء جدول المواعيد النهائية:', error);
    // لا نريد إيقاف الخادم بسبب خطأ في إنشاء الجدول
    console.log('سيستمر الخادم في العمل رغم خطأ إنشاء الجدول');
  }
};

// إنشاء جداول المحاضر عند بدء التطبيق
const initializeProtocols = async () => {
  try {
    await protocolModel.initializeTables();
    console.log('تم تهيئة جداول المحاضر بنجاح');
  } catch (error) {
    console.error('خطأ في إنشاء جداول المحاضر:', error);
    // لا نريد إيقاف الخادم بسبب خطأ في إنشاء الجدول
    console.log('سيستمر الخادم في العمل رغم خطأ إنشاء الجدول');
  }
};

// تهيئة جدول job_names عند بدء التطبيق
const initializeJobNames = async () => {
  try {
    const { initJobNamesTable } = require('./controllers/jobNamesController');
    
    // إنشاء request و response وهمية لاستدعاء الدالة
    const mockReq = {};
    const mockRes = {
      json: (data) => {
        if (data.success) {
          console.log('✅ تم تهيئة جدول job_names بنجاح:', data.message);
        } else {
          console.log('⚠️ لم يتم تهيئة جدول job_names:', data.message);
        }
      },
      status: (code) => ({
        json: (data) => {
          console.log('❌ خطأ في تهيئة جدول job_names:', data.message);
        }
      })
    };
    
    await initJobNamesTable(mockReq, mockRes);
  } catch (error) {
    console.error('خطأ في تهيئة جدول job_names:', error);
    // لا نريد إيقاف الخادم بسبب خطأ في إنشاء الجدول
    console.log('سيستمر الخادم في العمل رغم خطأ إنشاء الجدول');
  }
};

// تهيئة نظام Soft Delete عند بدء التطبيق
const initializeSoftDelete = async () => {
  try {
    await setupSoftDelete();
    console.log('✅ تم تهيئة نظام Soft Delete بنجاح');
  } catch (error) {
    console.error('❌ خطأ في تهيئة نظام Soft Delete:', error);
    // لا نريد إيقاف الخادم بسبب خطأ في تهيئة Soft Delete
    console.log('سيستمر الخادم في العمل رغم خطأ تهيئة Soft Delete');
  }
};

// تهيئة حقل approval_role عند بدء التطبيق
const initializeApprovalRoles = async () => {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    const conn = await pool.getConnection();
    
    try {
      // التحقق من وجود حقل approval_role في جدول approval_logs
      try {
        await conn.execute(`
          ALTER TABLE approval_logs 
          ADD COLUMN approval_role VARCHAR(50) DEFAULT 'approved'
        `);
        console.log('✅ تم إضافة حقل approval_role لجدول approval_logs');
      } catch (columnExistsError) {
        if (columnExistsError.code === 'ER_DUP_FIELDNAME') {
          console.log('ℹ️ حقل approval_role موجود بالفعل في جدول approval_logs');
        } else {
          throw columnExistsError;
        }
      }

      // التحقق من وجود حقل approval_role في جدول committee_approval_logs
      try {
        await conn.execute(`
          ALTER TABLE committee_approval_logs 
          ADD COLUMN approval_role VARCHAR(50) DEFAULT 'approved'
        `);
        console.log('✅ تم إضافة حقل approval_role لجدول committee_approval_logs');
      } catch (columnExistsError) {
        if (columnExistsError.code === 'ER_DUP_FIELDNAME') {
          console.log('ℹ️ حقل approval_role موجود بالفعل في جدول committee_approval_logs');
        } else {
          throw columnExistsError;
        }
      }

      // تحديث الاعتمادات الموجودة
      await conn.execute(`
        UPDATE approval_logs 
        SET approval_role = 'approved' 
        WHERE approval_role IS NULL
      `);
      console.log('✅ تم تحديث الاعتمادات الموجودة في approval_logs');

      await conn.execute(`
        UPDATE committee_approval_logs 
        SET approval_role = 'approved' 
        WHERE approval_role IS NULL
      `);
      console.log('✅ تم تحديث الاعتمادات الموجودة في committee_approval_logs');

    } finally {
      conn.release();
      await pool.end();
    }
    
    console.log('✅ تم تهيئة حقل approval_role بنجاح');
  } catch (error) {
    console.error('❌ خطأ في تهيئة حقل approval_role:', error);
    // لا نريد إيقاف الخادم بسبب خطأ في إضافة الحقل
    console.log('سيستمر الخادم في العمل رغم خطأ إضافة حقل approval_role');
  }
};

// تهيئة حقل super_admin في جدول users وإضافة الصلاحيات الجديدة
const initializeSuperAdminAndPermissions = async () => {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    const conn = await pool.getConnection();
    
    try {
      // إضافة حقل super_admin في جدول users
      try {
        await conn.execute(`
          ALTER TABLE users
          MODIFY COLUMN role ENUM('admin','sub-admin','user','manager_ovr','super_admin') NOT NULL DEFAULT 'user'
        `);
        console.log('✅ تم تحديث حقل role في جدول users ليشمل super_admin');
      } catch (columnExistsError) {
        if (columnExistsError.code === 'ER_DUP_FIELDNAME') {
          console.log('ℹ️ حقل super_admin موجود بالفعل في جدول users');
        } else {
          throw columnExistsError;
        }
      }

      // إضافة الصلاحيات الجديدة في جدول permissions
      const newPermissions = [
        { name: 'clear_cache', description: 'مسح الكاش ميموري' },
        { name: 'view_delegation_confirmations', description: 'عرض اقرارات التفويض' }
      ];

      for (const permission of newPermissions) {
        try {
          await conn.execute(`
            INSERT INTO permissions (permission_key, description) 
            VALUES (?, ?)
          `, [permission.name, permission.description]);
          console.log(`✅ تم إضافة صلاحية: ${permission.name}`);
        } catch (insertError) {
          if (insertError.code === 'ER_DUP_ENTRY') {
            console.log(`ℹ️ صلاحية ${permission.name} موجودة بالفعل`);
          } else {
            throw insertError;
          }
        }
      }

    } finally {
      conn.release();
      await pool.end();
    }
    
    console.log('✅ تم تهيئة حقل super_admin والصلاحيات الجديدة بنجاح');
  } catch (error) {
    console.error('❌ خطأ في تهيئة حقل super_admin والصلاحيات الجديدة:', error);
    // لا نريد إيقاف الخادم بسبب خطأ في إضافة الحقل
    console.log('سيستمر الخادم في العمل رغم خطأ إضافة حقل super_admin والصلاحيات الجديدة');
  }
};

const PORT = process.env.PORT || 3006;
app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  
  try {
    await cleanupOldLogs();
  } catch (error) {
    console.error('خطأ في تنظيف السجلات القديمة:', error);
  }
  
  try {
    await initializeDeadlines();
  } catch (error) {
    console.error('خطأ في تهيئة المواعيد النهائية:', error);
  }
  
  try {
    await initializeProtocols();
  } catch (error) {
    console.error('خطأ في تهيئة جداول المحاضر:', error);
  }
  
  try {
    await initializeJobNames();
  } catch (error) {
    console.error('خطأ في تهيئة جدول job_names:', error);
  }
  
  try {
    await initializeSoftDelete();
  } catch (error) {
    console.error('خطأ في تهيئة Soft Delete:', error);
  }

  try {
    await initializeApprovalRoles();
  } catch (error) {
    console.error('خطأ في تهيئة حقل approval_role:', error);
  }

  try {
    await initializeSuperAdminAndPermissions();
  } catch (error) {
    console.error('خطأ في تهيئة حقل super_admin والصلاحيات الجديدة:', error);
  }

  try {
    await checkExpiredDeadlines();
  } catch (error) {
    console.error('خطأ في فحص المواعيد النهائية:', error);
  }
});
