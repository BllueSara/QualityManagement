// controllers/pendingApprovalsController.js
const mysql = require('mysql2/promise');
const jwt   = require('jsonwebtoken');
const { logAction } = require('../models/logger');
const { insertNotification } = require('../models/notfications-utils');
const { getFullNameSQLWithAliasAndFallback } = require('../models/userUtils');

function getUserLang(req) {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    try {
      const token = auth.slice(7);
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      return payload.lang || 'ar';
    } catch (err) {
      return 'ar';
    }
  }
  return 'ar';
}

function getLocalizedName(nameField, lang) {
  if (!nameField) return '';
  // Check if it's already a parsed object
  if (typeof nameField === 'object' && nameField !== null) {
    return nameField[lang] || nameField['ar'] || '';
  }
  if (typeof nameField === 'string') {
    try {
      // Try to parse it as JSON
      const nameObj = JSON.parse(nameField);
      return nameObj[lang] || nameObj['ar'] || nameField;
    } catch (e) {
      // If parsing fails, return the original string
      return nameField;
    }
  }
  // For any other type, convert to string and return
  return String(nameField);
}

async function getUserPerms(pool, userId) {
  const [rows] = await pool.execute(`
    SELECT p.permission_key
    FROM permissions p
    JOIN user_permissions up ON up.permission_id = p.id
    WHERE up.user_id = ? AND p.deleted_at IS NULL
  `, [userId]);
  return new Set(rows.map(r => r.permission_key));
}

exports.getPendingApprovals = async (req, res) => {
  // 1) فكّ JWT
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ status:'error', message:'Unauthorized' });
  }
  let payload;
  try {
    payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ status:'error', message:'Invalid token' });
  }
  const userId   = payload.id;
  const userRole = payload.role;

  // 2) افتح الاتصال
  const pool = mysql.createPool({
    host:            process.env.DB_HOST,
    user:            process.env.DB_USER,
    password:        process.env.DB_PASSWORD,
    database:        process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit:       0
  });

  try {
    // 3) جلب صلاحيات المستخدم
    const permsSet = await getUserPerms(pool, userId);
    const canViewAll = userRole === 'admin' || userRole === 'super_admin' || permsSet.has('transfer_credits');

    let params = [];

    // Query for department contents only
    const departmentContentQuery = `
        SELECT
            c.id,
            c.title,
            c.file_path,
            c.approval_status,
            GROUP_CONCAT(DISTINCT ${getFullNameSQLWithAliasAndFallback('u2')} ORDER BY ca.sequence_number) AS assigned_approvers,
            d.name AS source_name,
            f.name AS folder_name,
            ${getFullNameSQLWithAliasAndFallback('u')} AS created_by_username,
            'department_content' AS content_type,
            c.approvers_required,
            c.created_at,
            c.start_date,
            c.end_date
        FROM contents c
        JOIN folders f ON c.folder_id = f.id
        JOIN departments d ON f.department_id = d.id
        JOIN users u ON c.created_by = u.id
        LEFT JOIN content_approvers ca ON ca.content_id = c.id
        LEFT JOIN users u2 ON ca.user_id = u2.id
        WHERE c.approval_status = 'pending' AND c.deleted_at IS NULL AND f.deleted_at IS NULL AND d.deleted_at IS NULL AND u.deleted_at IS NULL
        ${!canViewAll ? `AND (EXISTS (SELECT 1 FROM content_approvers WHERE content_id = c.id AND user_id = ?) OR c.created_by = ?)` : ''}
        GROUP BY c.id
    `;

    if (!canViewAll) {
        params.push(userId, userId);
    }

    const [rows] = await pool.execute(departmentContentQuery, params);

    // Parse approvers_required JSON string into an array for easier frontend use
    rows.forEach(row => {
        // The mysql2 driver should already parse JSON columns. 
        // We just need to ensure it's an array for frontend logic, handling potential non-array values gracefully.
        if (!Array.isArray(row.approvers_required)) {
            row.approvers_required = [];
        }
    });

    return res.json({ status: 'success', data: rows });

  } catch (err) {
    // console.error('Error in getPendingApprovals (department content):', err);
    res.status(500).json({ status: 'error', message: 'خطأ في جلب الموافقات المعلقة (محتوى القسم)' });
  } finally {
    await pool.end();
  }
};

exports.sendApprovalRequest = async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized' });
  }

  let payload;
  try {
    payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ status: 'error', message: 'Invalid token' });
  }
  const userId = payload.id;
  const userLang = getUserLang(req);

  const { contentId, approvers, approversWithRoles } = req.body;
  if (!contentId || !Array.isArray(approvers) || approvers.length === 0) {
    return res.status(400).json({ status: 'error', message: 'البيانات غير صالحة' });
  }
  
  // إنشاء خريطة للأدوار إذا كانت موجودة
  const roleMap = new Map();
  if (approversWithRoles && Array.isArray(approversWithRoles)) {
    approversWithRoles.forEach(item => {
      if (item.userId && item.role) {
        roleMap.set(item.userId, item.role);
      }
    });
  }

  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
  });
  const conn = await pool.getConnection();
  try {
    // Fetch info for logging
    const [[contentDetails]] = await conn.execute(
        `SELECT c.title, d.name as department_name FROM contents c
         JOIN folders f ON c.folder_id = f.id
         JOIN departments d ON f.department_id = d.id
         WHERE c.id = ? AND c.deleted_at IS NULL AND f.deleted_at IS NULL AND d.deleted_at IS NULL`,
        [contentId]
    );

    // معالجة التفويضات - تحديد المعتمدين النهائيين (محسن للأداء)
    
    // ⚡ تحسين: جلب جميع التفويضات في استعلام واحد للتسريع
    const [allDelegations] = await conn.execute(
      `SELECT user_id, delegate_id FROM active_delegations 
       WHERE user_id IN (${approvers.map(() => '?').join(',')}) 
       OR delegate_id IN (${approvers.map(() => '?').join(',')})`,
      [...approvers, ...approvers]
    );
    
    // ⚡ تحسين: إنشاء خرائط للتفويضات للوصول السريع
    const userToDelegateMap = new Map();
    const delegateToUserMap = new Map();
    
    allDelegations.forEach(row => {
      userToDelegateMap.set(row.user_id, row.delegate_id);
      delegateToUserMap.set(row.delegate_id, row.user_id);
    });
    
    // ⚡ تحسين: معالجة أسرع باستخدام Set بدلاً من array
    const finalApproversSet = new Set();
    
    // معالجة كل معتمد
    for (const approverId of approvers) {
      if (userToDelegateMap.has(approverId)) {
        finalApproversSet.add(userToDelegateMap.get(approverId));
      } else if (delegateToUserMap.has(approverId)) {
        finalApproversSet.add(approverId);
      } else {
        finalApproversSet.add(approverId);
      }
    }
    
    // إضافة التفويض المزدوج
    for (const approverId of approvers) {
      if (userToDelegateMap.has(approverId)) {
        const delegateeId = userToDelegateMap.get(approverId);
        if (finalApproversSet.has(delegateeId)) {
          finalApproversSet.add(delegateeId);
        }
      }
    }
    
    const finalApprovers = Array.from(finalApproversSet);
    // حماية ضد قائمة فارغة
    console.log('DEBUG approvers:', approvers);
    console.log('DEBUG finalApprovers:', finalApprovers);
    if (finalApprovers.length === 0) {
      return res.status(400).json({ status: 'error', message: 'لا يوجد معتمدين صالحين بعد معالجة التفويضات.' });
    }

    const [approverUsers] = await conn.query(`
      SELECT
        CONCAT(
          COALESCE(first_name, ''),
          CASE WHEN second_name IS NOT NULL AND second_name != '' THEN CONCAT(' ', second_name) ELSE '' END,
          CASE WHEN third_name IS NOT NULL AND third_name != '' THEN CONCAT(' ', third_name) ELSE '' END,
          CASE WHEN last_name IS NOT NULL AND last_name != '' THEN CONCAT(' ', last_name) ELSE '' END
        ) AS full_name
      FROM users WHERE id IN (?)`,
      [finalApprovers]
    );
    const approverNames = approverUsers.map(u => u.full_name).join(', ');

    await conn.beginTransaction();

    // 1) اقرأ المعتمدين الحاليين (IDs) من content_approvers
    const [rows] = await conn.execute(
      `SELECT user_id FROM content_approvers WHERE content_id = ?`,
      [contentId]
    );
    const existing = rows.map(r => r.user_id);

    // ⚡ تحسين: احسب الجدد فقط بشكل أسرع باستخدام Set
    const existingSet = new Set(existing);
    const toAdd = finalApprovers.filter(id => !existingSet.has(id));
    const uniqueToAdd = [...new Set(toAdd)];

    // ⚡ تحسين: إدراج مجمع للمعتمدين الجدد
    if (uniqueToAdd.length > 0) {
      // إدراج جميع المعتمدين الجدد في استعلام واحد
      const approverValues = uniqueToAdd.map((userId, index) => 
        `(${contentId}, ${userId}, ${existing.length + index + 1})`
      ).join(', ');
      
      await conn.execute(
        `INSERT INTO content_approvers (content_id, user_id, sequence_number) VALUES ${approverValues}`
      );
    }

    // ⚡ تحسين: جلب جميع التفويضات للمعتمدين الجدد في استعلام واحد (مع حماية من القائمة الفارغة)
    let delegationData = [];
    if (uniqueToAdd.length > 0) {
      const [data] = await conn.execute(
        `SELECT delegate_id, user_id FROM active_delegations WHERE delegate_id IN (${uniqueToAdd.map(() => '?').join(',')})`,
        uniqueToAdd
      );
      delegationData = data;
    }
    
    const delegationMap = new Map();
    delegationData.forEach(row => {
      delegationMap.set(row.delegate_id, row.user_id);
    });

    // ⚡ تحسين: إدراج مجمع لسجلات الاعتماد
    const logValues = [];
    const notificationPromises = [];
    
    for (const userId of uniqueToAdd) {
      const userRole = roleMap.get(userId) || 'approved';
      const delegatedBy = delegationMap.get(userId);
      
      if (delegatedBy) {
        logValues.push(`(${contentId}, ${userId}, 'pending', NULL, 1, ${delegatedBy}, '${userRole}', CURRENT_TIMESTAMP)`);
      } else {
        logValues.push(`(${contentId}, ${userId}, 'pending', NULL, 0, NULL, '${userRole}', CURRENT_TIMESTAMP)`);
      }
      
      // ⚡ تحسين: تجميع الإشعارات للتنفيذ المؤجل
      notificationPromises.push(
        insertNotification(
          userId,
          'تم تفويضك للتوقيع',
          `تم تفويضك للتوقيع على ملف جديد رقم ${contentId}`,
          'proxy'
        )
      );
    }
    
    if (logValues.length > 0) {
      await conn.execute(
        `INSERT INTO approval_logs (content_id, approver_id, status, comments, signed_as_proxy, delegated_by, approval_role, created_at) 
         VALUES ${logValues.join(', ')}`
      );
    }
    
    // 3.5) إضافة سجلات التفويض المزدوج - إذا كان المستخدم موجود مرتين في finalApprovers
    const userCounts = {};
    finalApprovers.forEach(id => {
      userCounts[id] = (userCounts[id] || 0) + 1;
    });
    
    for (const [userId, count] of Object.entries(userCounts)) {
      if (count > 1 && !processedUsers.has(parseInt(userId))) {
        // هذا المستخدم موجود مرتين، أضف سجل بالنيابة إضافي
        const [delegationRows] = await conn.execute(
          'SELECT user_id FROM active_delegations WHERE delegate_id = ?',
          [userId]
        );
        
        if (delegationRows.length) {
          // أضف سجل بالنيابة إضافي
          await conn.execute(
            `INSERT INTO approval_logs
               (content_id, approver_id, status, comments, signed_as_proxy, delegated_by, created_at)
             VALUES (?, ?, 'pending', NULL, 1, ?, CURRENT_TIMESTAMP)`,
            [contentId, userId, delegationRows[0].user_id]
          );
        }
      }
    }

    // 4) دمج القديم مع القادم في الحقل approvers_required
    const merged = Array.from(new Set([...existing, ...finalApprovers]));
    await conn.execute(
      `UPDATE contents 
         SET approval_status     = 'pending', 
             approvers_required  = ?, 
             updated_at          = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [JSON.stringify(merged), contentId]
    );

    // Add to logs
    const localizedDeptNameAR = getLocalizedName(contentDetails.department_name, 'ar');
    const localizedDeptNameEN = getLocalizedName(contentDetails.department_name, 'en');
    const titleAR = getLocalizedName(contentDetails.title, 'ar');
    const titleEN = getLocalizedName(contentDetails.title, 'en');

    const logDescription = {
        ar: `أرسل المحتوى '${titleAR}' في القسم '${localizedDeptNameAR}' للموافقة إلى: ${approverNames}`,
        en: `Sent content '${titleEN}' in department '${localizedDeptNameEN}' for approval to: ${approverNames}`
    };
    await conn.commit();
    
    // ⚡ تحسين: تنفيذ الإشعارات والـ logging في الخلفية لتسريع الاستجابة
    setImmediate(async () => {
      try {
        // تنفيذ جميع الإشعارات المؤجلة
        await Promise.allSettled(notificationPromises);
        
        // تسجيل العملية
        await logAction(userId, 'send_approval_request', JSON.stringify(logDescription), 'content', contentId);
      } catch (bgError) {
        console.error('Background tasks error:', bgError);
      }
    });

    res.status(200).json({ status: 'success', message: 'تم الإرسال بنجاح' });
  } catch (err) {
    await conn.rollback();
    console.error('Send Approval Error:', err); // أضف هذه السطر
    res.status(500).json({ status: 'error', message: 'فشل إرسال طلب الاعتماد', error: err.message }); // أضف err.message مؤقتًا
  } finally {
    conn.release();
    await pool.end();
  }
};

exports.updateApprovers = async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized' });
  }

  let payload;
  try {
    payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ status: 'error', message: 'Invalid token' });
  }

  let { contentId, approvers, removedUserId } = req.body;

  if (typeof contentId === 'string' && contentId.includes('-')) {
    contentId = parseInt(contentId.split('-')[1], 10);
  }

  if (!contentId || !Array.isArray(approvers)) {
    return res.status(400).json({ status: 'error', message: 'البيانات غير صالحة' });
  }

  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
  });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // إذا كان هناك معتمد محدد للحذف، احذفه فقط
    if (removedUserId) {
      await conn.execute(
        'DELETE FROM content_approvers WHERE content_id = ? AND user_id = ?',
        [contentId, removedUserId]
      );
      
      // حذف سجلات الاعتماد المرتبطة
      await conn.execute(
        'DELETE FROM approval_logs WHERE content_id = ? AND approver_id = ? AND status = "pending"',
        [contentId, removedUserId]
      );
      
      // تحديث approvers_required في جدول contents
      await conn.execute(
        'UPDATE contents SET approvers_required = ? WHERE id = ?',
        [JSON.stringify(approvers), contentId]
      );
      
      console.log(`Removed approver ${removedUserId} from content ${contentId}`);
    } else {
      // إذا لم يكن هناك معتمد محدد للحذف، استخدم الطريقة القديمة (حذف وإعادة إدخال)
      // حذف جميع المعتمدين الحاليين
      await conn.execute(
        'DELETE FROM content_approvers WHERE content_id = ?',
        [contentId]
      );

      // إضافة المعتمدين الجدد
      if (approvers.length > 0) {
        const values = approvers.map(approverId => [contentId, approverId]);
        await conn.query(
          'INSERT INTO content_approvers (content_id, user_id) VALUES ?',
          [values]
        );
      }
    }

    await conn.commit();
    pool.end();

    res.json({ status: 'success', message: 'تم تحديث قائمة المعتمدين بنجاح' });
  } catch (error) {
    await conn.rollback();
    pool.end();
    console.error('Error updating approvers:', error);
    res.status(500).json({ status: 'error', message: 'خطأ في تحديث المعتمدين' });
  }
};

exports.delegateApproval = async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized' });
  }

  let payload;
  try {
    payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ status: 'error', message: 'Invalid token' });
  }
  const currentUserId = payload.id;
  const userLang = getUserLang(req);

  const { contentId, delegateeUserId } = req.body;
  if (!contentId || !delegateeUserId) {
    return res.status(400).json({ status: 'error', message: 'البيانات غير صالحة' });
  }

  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
  });
  const conn = await pool.getConnection();
  try {
    // Fetch info for logging
    const [[contentDetails]] = await conn.execute(
        `SELECT c.title, d.name as department_name FROM contents c
         JOIN folders f ON c.folder_id = f.id
         JOIN departments d ON f.department_id = d.id
         WHERE c.id = ? AND c.deleted_at IS NULL AND f.deleted_at IS NULL AND d.deleted_at IS NULL`,
        [contentId]
    );

    const [delegateeUser] = await conn.execute(`
      SELECT
        CONCAT(
          COALESCE(first_name, ''),
          CASE WHEN second_name IS NOT NULL AND second_name != '' THEN CONCAT(' ', second_name) ELSE '' END,
          CASE WHEN third_name IS NOT NULL AND third_name != '' THEN CONCAT(' ', third_name) ELSE '' END,
          CASE WHEN last_name IS NOT NULL AND last_name != '' THEN CONCAT(' ', last_name) ELSE '' END
        ) AS full_name
      FROM users WHERE id = ? AND deleted_at IS NULL`,
      [delegateeUserId]
    );
    const delegateeUsername = delegateeUser.map(u => u.full_name)[0] || '';

    await conn.beginTransaction();

    // 1) اقرأ المعتمدين الحاليين (IDs) من content_approvers
    const [rows] = await conn.execute(
      `SELECT user_id FROM content_approvers WHERE content_id = ?`,
      [contentId]
    );
    const existingApprovers = rows.map(r => r.user_id);

    // 2) احسب الجدد فقط
    const toAdd = [delegateeUserId].filter(id => !existingApprovers.includes(id));

    // 3) أدخل الجدد فقط، وسجّل لهم سجلّ اعتماد
    for (const userId of toAdd) {
      await conn.execute(
        `INSERT INTO content_approvers (content_id, user_id) VALUES (?, ?)`,
        [contentId, userId]
      );
      await conn.execute(
        `INSERT INTO approval_logs
           (content_id, approver_id, status, comments, signed_as_proxy, delegated_by, created_at)
         VALUES (?, ?, 'pending', NULL, 0, NULL, CURRENT_TIMESTAMP)`,
        [contentId, userId]
      );
      await insertNotification(
        userId,
        'تم تفويضك للتوقيع',
        `تم تفويضك للتوقيع على ملف جديد رقم ${contentId}`,
        'proxy'
      );
    }

    // 4) دمج القديم مع القادم في الحقل approvers_required
    const merged = Array.from(new Set([...existingApprovers, ...toAdd]));
    await conn.execute(
      `UPDATE contents 
         SET approval_status     = 'pending', 
             approvers_required  = ?, 
             updated_at          = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [JSON.stringify(merged), contentId]
    );

    // Add to logs
    const localizedDepartmentNameAR = getLocalizedName(contentDetails.department_name, 'ar');
    const localizedDepartmentNameEN = getLocalizedName(contentDetails.department_name, 'en');
    const titleAR = getLocalizedName(contentDetails.title, 'ar');
    const titleEN = getLocalizedName(contentDetails.title, 'en');

    const logDescription = {
      ar: `تم تفويض الموافقة على المحتوى: '${titleAR}' في القسم: '${localizedDepartmentNameAR}' إلى: ${delegateeUsername}`,
      en: `Delegated approval for content: '${titleEN}' in department: '${localizedDepartmentNameEN}' to: ${delegateeUsername}`
    };
    
    await logAction(currentUserId, 'delegate_approval', JSON.stringify(logDescription), 'content', contentId);

    await conn.commit();
    res.status(200).json({ status: 'success', message: 'تم الإرسال بنجاح' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ status: 'error', message: 'فشل إرسال طلب الاعتماد' });
  } finally {
    conn.release();
    await pool.end();
  }
};