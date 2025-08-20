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

    // Query for committee contents only
    const committeeContentQuery = `
        SELECT
            CONCAT('comm-', cc.id) AS id,
            cc.title,
            cc.file_path,
            cc.approval_status,
            GROUP_CONCAT(DISTINCT ${getFullNameSQLWithAliasAndFallback('u2')} ORDER BY cca.sequence_number) AS assigned_approvers,
            com.name AS source_name,
            cf.name AS folder_name,
            ${getFullNameSQLWithAliasAndFallback('u')} AS created_by_username,
            'committee' AS type,
            cc.approvers_required,
            cc.created_at,
            cc.start_date,
            cc.end_date
        FROM committee_contents cc
        JOIN committee_folders cf ON cc.folder_id = cf.id
        JOIN committees com ON cf.committee_id = com.id
        JOIN users u ON cc.created_by = u.id
        LEFT JOIN committee_content_approvers cca ON cca.content_id = cc.id
        LEFT JOIN users u2 ON cca.user_id = u2.id
        WHERE cc.approval_status = 'pending' AND cc.deleted_at IS NULL AND cf.deleted_at IS NULL AND com.deleted_at IS NULL AND u.deleted_at IS NULL
        ${!canViewAll ? `AND (EXISTS (SELECT 1 FROM committee_content_approvers WHERE content_id = cc.id AND user_id = ?) OR cc.created_by = ?)` : ''}
        AND NOT EXISTS (
          SELECT 1 FROM committee_approval_logs cal
          WHERE cal.content_id = cc.id
            AND cal.delegated_by = ?
            AND cal.signed_as_proxy = 1
            AND cal.status = 'pending'
        )
        GROUP BY cc.id
    `;

    if (!canViewAll) {
        params.push(userId, userId, userId);
    } else {
        params.push(userId, userId);
    }

    const [rows] = await pool.execute(committeeContentQuery, params);

    // Parse approvers_required JSON string into an array for easier frontend use
    rows.forEach(row => {
        if (typeof row.approvers_required === 'string') {
            try {
                row.approvers_required = JSON.parse(row.approvers_required);
            } catch (e) {
                row.approvers_required = [];
            }
        } else if (row.approvers_required === null || !Array.isArray(row.approvers_required)) {
            row.approvers_required = [];
        }
    });

    return res.json({ status: 'success', data: rows });

  } catch (err) {
    res.status(500).json({ status: 'error', message: 'خطأ في جلب الموافقات المعلقة (محتوى اللجنة)' });
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

  let { contentId, approvers, approversWithRoles } = req.body;

  // إذا كان contentId يحتوي على بادئة (مثل 'comm-' أو 'dept-')، قم بإزالتها للحصول على الرقم الأصلي
  if (typeof contentId === 'string' && contentId.includes('-')) {
    contentId = parseInt(contentId.split('-')[1], 10);
  }

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
        `SELECT cc.title, com.name as committee_name FROM committee_contents cc
         JOIN committee_folders cf ON cc.folder_id = cf.id
         JOIN committees com ON cf.committee_id = com.id
         WHERE cc.id = ? AND cc.deleted_at IS NULL AND cf.deleted_at IS NULL AND com.deleted_at IS NULL`,
        [contentId]
    );

    // معالجة التفويضات - تحديد المعتمدين النهائيين
    const finalApprovers = [];
    for (const approverId of approvers) {
      // تحقق إذا كان هذا المعتمد مفوض له لشخص آخر (من active_delegations)
      const [proxyRows] = await conn.execute(
        'SELECT delegate_id FROM active_delegations WHERE user_id = ?',
        [approverId]
      );
      
      if (proxyRows.length > 0) {
        // هذا المعتمد مفوض له، أضف المفوض له بدلاً منه
        const delegateeId = proxyRows[0].delegate_id;
        if (!finalApprovers.includes(delegateeId)) {
          finalApprovers.push(delegateeId);
        }
      } else {
        // تحقق إذا كان هذا المعتمد مفوض له لشخص آخر (من active_delegations)
        const [delegationRows] = await conn.execute(
          'SELECT user_id FROM active_delegations WHERE delegate_id = ?',
          [approverId]
        );
        
        if (delegationRows.length) {
          // هذا مفوض له، أضفه فقط (لا تضيف المفوض الأصلي)
          if (!finalApprovers.includes(approverId)) {
            finalApprovers.push(approverId); // أضف المفوض له فقط
          }
        } else {
          // هذا ليس مفوض له، أضفه
          if (!finalApprovers.includes(approverId)) {
            finalApprovers.push(approverId);
          }
        }
      }
    }
    
    // إضافة التفويض المزدوج - إذا كان المستخدم في قائمة المعتمدين ومفوض له أيضاً
    for (const approverId of approvers) {
      // تحقق إذا كان هذا المعتمد مفوض له لشخص آخر
      const [proxyRows] = await conn.execute(
        'SELECT delegate_id FROM active_delegations WHERE user_id = ?',
        [approverId]
      );
      
      if (proxyRows.length > 0) {
        // هذا المعتمد مفوض له، أضفه مرة ثانية للتفويض المزدوج
        const delegateeId = proxyRows[0].delegate_id;
        if (finalApprovers.includes(delegateeId)) {
          // أضف نسخة ثانية للتفويض المزدوج
          finalApprovers.push(delegateeId);
        }
      }
    }

    // حماية ضد قائمة فارغة
    console.log('DEBUG approvers:', approvers);
    console.log('DEBUG finalApprovers:', finalApprovers);
    if (finalApprovers.length === 0) {
      return res.status(400).json({ status: 'error', message: 'لا يوجد معتمدين صالحين بعد معالجة التفويضات.' });
    }

    // جلب أسماء المعتمدين للـ logging
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

    // 1) اقرأ المعتمدين الحاليين (IDs) من committee_content_approvers
    const [rows] = await conn.execute(
      `SELECT user_id FROM committee_content_approvers WHERE content_id = ?`,
      [contentId]
    );
    const existing = rows.map(r => r.user_id);

    // 2) احسب الجدد فقط
    const toAdd = finalApprovers.filter(id => !existing.includes(id));

    // 3) أدخل الجدد فقط، وسجّل لهم سجلّ اعتماد
    const processedUsers = new Set(); // لتجنب التكرار
    
    for (let i = 0; i < toAdd.length; i++) {
      const userId = toAdd[i];
      if (processedUsers.has(userId)) continue; // تجنب التكرار
      
      // حساب رقم التسلسل (بعد المعتمدين الموجودين)
      const sequenceNumber = existing.length + i + 1;
      
      await conn.execute(
        `INSERT INTO committee_content_approvers (content_id, user_id, sequence_number) VALUES (?, ?, ?)`,
        [contentId, userId, sequenceNumber]
      );
      
      // تحقق إذا كان هذا المستخدم مفوض له
      const [delegationRows] = await conn.execute(
        'SELECT user_id FROM active_delegations WHERE delegate_id = ?',
        [userId]
      );
      
      // الحصول على الدور المحدد لهذا المستخدم
      const userRole = roleMap.get(userId) || 'approved';
      
      if (delegationRows.length) {
        // هذا مفوض له، أضف سجل بالنيابة فقط
        await conn.execute(
          `INSERT INTO committee_approval_logs
             (content_id, approver_id, status, comments, signed_as_proxy, delegated_by, approval_role, created_at)
           VALUES (?, ?, 'pending', NULL, 1, ?, ?, CURRENT_TIMESTAMP)`,
          [contentId, userId, delegationRows[0].user_id, userRole]
        );
      } else {
        // هذا معتمد عادي، أضف سجل عادي
        await conn.execute(
          `INSERT INTO committee_approval_logs
             (content_id, approver_id, status, comments, signed_as_proxy, delegated_by, approval_role, created_at)
           VALUES (?, ?, 'pending', NULL, 0, NULL, ?, CURRENT_TIMESTAMP)`,
          [contentId, userId, userRole]
        );
      }
      
      processedUsers.add(userId);
      
      await insertNotification(
        userId,
        'تم تفويضك للتوقيع',
        `تم تفويضك للتوقيع على ملف لجنة جديد رقم ${contentId}`,
        'proxy'
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
          'SELECT permanent_delegate_id FROM users WHERE id = ? AND deleted_at IS NULL',
          [userId]
        );
        
        if (delegationRows.length && delegationRows[0].permanent_delegate_id) {
          // أضف سجل بالنيابة إضافي
          // الحصول على الدور المحدد لهذا المستخدم
          const userRole = roleMap.get(userId) || 'approved';
          
          await conn.execute(
            `INSERT INTO committee_approval_logs
               (content_id, approver_id, status, comments, signed_as_proxy, delegated_by, approval_role, created_at)
             VALUES (?, ?, 'pending', NULL, 1, ?, ?, CURRENT_TIMESTAMP)`,
            [contentId, userId, delegationRows[0].permanent_delegate_id, userRole]
          );
        }
      }
    }

    // 4) دمج القديم مع القادم في الحقل approvers_required
    const merged = Array.from(new Set([...existing, ...finalApprovers]));
    await conn.execute(
      `UPDATE committee_contents 
         SET approval_status     = 'pending', 
             approvers_required  = ?, 
             updated_at          = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [JSON.stringify(merged), contentId]
    );

    // Add to logs
    const committeeNameAR = getLocalizedName(contentDetails.committee_name, 'ar');
    const committeeNameEN = getLocalizedName(contentDetails.committee_name, 'en');
    const titleAR = getLocalizedName(contentDetails.title, 'ar');
    const titleEN = getLocalizedName(contentDetails.title, 'en');
    
    const logDescription = {
        ar: `أرسل محتوى اللجنة '${titleAR}' في اللجنة '${committeeNameAR}' للموافقة إلى: ${approverNames}`,
        en: `Sent committee content '${titleEN}' in committee '${committeeNameEN}' for approval to: ${approverNames}`
    };
    await logAction(userId, 'send_committee_approval_request', JSON.stringify(logDescription), 'committee_content', contentId);

    await conn.commit();
    res.json({ status:'success', message:'تم الإرسال بنجاح' });
  } catch (err) {
    await conn.rollback();
    console.error('Send Committee Approval Error:', err); // أضف هذه السطر
    res.status(500).json({ status: 'error', message: 'فشل إرسال طلب الاعتماد', error: err.message }); // أضف err.message مؤقتًا
  } finally {
    conn.release();
    await pool.end();
  }
};

exports.delegateCommitteeApproval = async (req, res) => {
    const { contentId, delegateTo, notes } = req.body;
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

    if (!contentId || !delegateTo) {
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
            `SELECT cc.title, com.name as committee_name FROM committee_contents cc
             JOIN committee_folders cf ON cc.folder_id = cf.id
             JOIN committees com ON cf.committee_id = com.id
             WHERE cc.id = ? AND cc.deleted_at IS NULL AND cf.deleted_at IS NULL AND com.deleted_at IS NULL`,
            [contentId]
        );

        const [[delegateeUser]] = await conn.execute(`
            SELECT
              CONCAT(
                COALESCE(first_name, ''),
                CASE WHEN second_name IS NOT NULL AND second_name != '' THEN CONCAT(' ', second_name) ELSE '' END,
                CASE WHEN third_name IS NOT NULL AND third_name != '' THEN CONCAT(' ', third_name) ELSE '' END,
                CASE WHEN last_name IS NOT NULL AND last_name != '' THEN CONCAT(' ', last_name) ELSE '' END
              ) AS full_name
            FROM users WHERE id = ?`,
            [delegateTo]
        );

        await conn.beginTransaction();

        // Mark the current approver as delegated in committee_approval_logs
        await conn.execute(
            `UPDATE committee_approval_logs
             SET status = 'delegated',
                 comments = ?,
                 delegated_by = ?
             WHERE content_id = ? AND approver_id = ?`,
            [notes, delegateTo, contentId, currentUserId]
        );

        // Add the new delegatee as a pending approver if they are not already listed
        await conn.execute(
            `INSERT INTO committee_content_approvers (content_id, user_id, assigned_at) VALUES (?, ?, NOW())
             ON DUPLICATE KEY UPDATE assigned_at = NOW()`,
            [contentId, delegateTo]
        );

        // Add a new pending approval log for the delegatee if not already there
        await conn.execute(
            `INSERT INTO committee_approval_logs (content_id, approver_id, status, approval_role, created_at)
             VALUES (?, ?, 'pending', 'approved', CURRENT_TIMESTAMP)
             ON DUPLICATE KEY UPDATE status = 'pending', approval_role = 'approved', created_at = CURRENT_TIMESTAMP`,
            [contentId, delegateTo]
        );

        // Add to logs
        const committeeNameAR = getLocalizedName(contentDetails.committee_name, 'ar');
        const committeeNameEN = getLocalizedName(contentDetails.committee_name, 'en');
        const titleAR = getLocalizedName(contentDetails.title, 'ar');
        const titleEN = getLocalizedName(contentDetails.title, 'en');

        const logDescription = {
          ar: `تم تفويض الموافقة على محتوى اللجنة: '${titleAR}' في اللجنة: '${committeeNameAR}' إلى: ${delegateeUser.full_name}`,
          en: `Delegated approval for committee content: '${titleEN}' in committee: '${committeeNameEN}' to: ${delegateeUser.full_name}`
        };
        
        await logAction(currentUserId, 'delegate_committee_approval', JSON.stringify(logDescription), 'committee_content', contentId);

        await conn.commit();
        res.status(200).json({ status: 'success', message: 'تم تفويض الاعتماد بنجاح' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ status: 'error', message: 'فشل تفويض الاعتماد' });
    } finally {
        conn.release();
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

  let { contentId, approvers } = req.body;

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

    // حذف جميع المعتمدين الحاليين
    await conn.execute(
      'DELETE FROM committee_content_approvers WHERE content_id = ?',
      [contentId]
    );

    // إضافة المعتمدين الجدد
    if (approvers.length > 0) {
      const values = approvers.map(approverId => [contentId, approverId]);
      await conn.query(
        'INSERT INTO committee_content_approvers (content_id, user_id) VALUES ?',
        [values]
      );

      // ملاحظة: assigned_approvers يتم حسابه ديناميكياً في الاستعلامات باستخدام GROUP_CONCAT
      // لذلك لا نحتاج لتحديثه هنا
    }

    await conn.commit();
    pool.end();

    res.json({ status: 'success', message: 'تم تحديث قائمة المعتمدين بنجاح' });
  } catch (error) {
    await conn.rollback();
    pool.end();
    console.error('Error updating committee approvers:', error);
    res.status(500).json({ status: 'error', message: 'خطأ في تحديث المعتمدين' });
  }
}; 