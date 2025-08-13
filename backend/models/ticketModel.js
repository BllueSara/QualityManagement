const mysql = require('mysql2/promise');

const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'Quality'
});

class Ticket {
// models/Ticket.js
static async create(ticketData, userId) {
  const allowedGenders = ['ذكر', 'أنثى', 'male', 'female'];
  const {
    event_date, event_time, event_location,
    reporting_dept_id, responding_dept_id, other_depts,
    patient_name, medical_record_no, dob, gender,
    report_type, report_short_desc, event_description,
    reporter_name,  reporter_position,
    reporter_phone, reporter_email, actions_taken,
    had_injury, injury_type,
    attachments,
    classifications,
    patient_types,
    harm_level_id // <-- استخدم هذا بدلاً من level_of_harm
  } = ticketData;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // تأكد أن gender صحيح
    const safeGender = (gender === undefined || gender === null || gender === '' || gender === 'null' || !allowedGenders.includes(gender)) ? null : gender;

    // 1) إدراج التذكرة
    const [result] = await connection.query(
      `INSERT INTO tickets (
         event_date, event_time, event_location,
         reporting_dept_id, responding_dept_id, other_depts,
         patient_name, medical_record_no, dob, gender,
         report_type, report_short_desc, event_description,
         reporter_name, reporter_position,
         reporter_phone, reporter_email, actions_taken,
         had_injury, injury_type,
         harm_level_id,
         status, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,  ?, ?, ?, ?, ?, ?, ?, ?, ?, 'جديد', ?)`,
      [
        event_date, event_time, event_location,
        reporting_dept_id, responding_dept_id, other_depts,
        patient_name, medical_record_no, dob, safeGender,
        report_type, report_short_desc, event_description,
        reporter_name, reporter_position,
        reporter_phone, reporter_email, actions_taken,
        had_injury, injury_type,
        harm_level_id, // <-- هنا
        userId
      ]
    );
    const ticketId = result.insertId;

    // 2) إدراج التصنيفات
    if (Array.isArray(classifications) && classifications.length) {
      const vals = classifications.map(catId => [ticketId, catId]);
      await connection.query(
        `INSERT INTO ticket_classifications (ticket_id, classification_id) VALUES ?`,
        [vals]
      );
    }

    // 3) إدراج أنواع المرضى
    if (Array.isArray(patient_types) && patient_types.length) {
      const pts = patient_types.map(pt => [ticketId, pt]);
      await connection.query(
        `INSERT INTO ticket_patient_types (ticket_id, patient_type) VALUES ?`,
        [pts]
      );
    }

    // 4) إدراج المرفقات (لاحظ عمود file_path)
    if (attachments && attachments.length) {
      const attachVals = attachments.map(f =>
        [ticketId, f.filename, f.path, f.mimetype]
      );
      await connection.query(
        `INSERT INTO ticket_attachments (ticket_id, filename, path, mimetype) VALUES ?`,
        [attachVals]
      );
    }

    // 5) سجل الحالة الابتدائية
    await connection.query(
      `INSERT INTO ticket_status_history (ticket_id, status, changed_by, comments)
       VALUES (?, 'جديد', ?, 'تم إنشاء الحدث العارض')`,
      [ticketId, userId]
    );

    await connection.commit();
    return ticketId;

  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}
static async findAllAndAssignments(userId, userRole) {
  const conn = await db.getConnection();
  try {
    // 1) صلاحيات المستخدم
    const [permRows] = await conn.query(
      `SELECT p.permission_key
       FROM permissions p
       JOIN user_permissions up ON up.permission_id = p.id
       WHERE up.user_id = ? AND p.deleted_at IS NULL`,
      [userId]
    );
    const userPerms = new Set(permRows.map(r => r.permission_key));
    const canViewAll = userRole === 'admin' || userRole === 'manager_ovr' || userPerms.has('view_tickets');

    // 2) SQL مع تجميع التصنيفات بشكل موثوق
    let baseSQL = `
      SELECT
        t.id,
        t.event_date,
        t.event_time,
        t.event_location,
        rd.name       AS reporting_dept,
        sd.name       AS responding_dept,
        latest.status AS current_status,
        u.username    AS created_by,
        t.created_at,
        -- لو ما فيه تصنيفات نرجع []، وإلا نجمعهم
        COALESCE(
          NULLIF(JSON_ARRAYAGG(
            CASE 
              WHEN c.name_ar IS NOT NULL THEN c.name_ar 
              ELSE NULL 
            END
          ), JSON_ARRAY(NULL)), 
          JSON_ARRAY()
        ) AS classifications
      FROM tickets t
      LEFT JOIN departments rd ON t.reporting_dept_id = rd.id AND rd.deleted_at IS NULL
      LEFT JOIN departments sd ON t.responding_dept_id = sd.id AND sd.deleted_at IS NULL
      LEFT JOIN users u       ON t.created_by = u.id AND u.deleted_at IS NULL
      LEFT JOIN (
        SELECT h1.ticket_id, h1.status
        FROM ticket_status_history h1
        INNER JOIN (
          SELECT ticket_id, MAX(id) AS max_id
          FROM ticket_status_history
          GROUP BY ticket_id
        ) h2 ON h1.ticket_id = h2.ticket_id AND h1.id = h2.max_id
      ) AS latest ON latest.ticket_id = t.id
      LEFT JOIN ticket_classifications tc ON tc.ticket_id = t.id
      LEFT JOIN classifications c ON tc.classification_id = c.id
    `;

    // 3) شرط لغير الأدمن
    let whereClause = '';
    const params = [];
    // إضافة شرط المحذوفة إلى WHERE clause أولاً
    whereClause = 'WHERE t.deleted_at IS NULL';
    
    if (!canViewAll) {
      whereClause = `
        WHERE t.deleted_at IS NULL AND EXISTS (
          SELECT 1
          FROM ticket_assignments ta
          WHERE ta.ticket_id   = t.id
            AND ta.assigned_to = ?
        )
      `;
      params.push(userId);
    }

    // 4) لازم GROUP BY بسبب COUNT/JSON_ARRAYAGG
    const orderClause = `
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `;

    const sql = baseSQL + whereClause + orderClause;

    // 5) جلب النتائج
    const [rows] = await conn.query(sql, params);

    // 6) حوّل حقل classifications من JSON string لمصفوفة JS
    const tickets = rows.map(r => ({
      ...r,
      classifications: (() => {
        try {
          if (typeof r.classifications === 'string') {
            const parsed = JSON.parse(r.classifications);
            return Array.isArray(parsed) ? parsed : [];
          }
          return Array.isArray(r.classifications) ? r.classifications : [];
        } catch (e) {
          console.error('Error parsing classifications for ticket', r.id, ':', e);
          return [];
        }
      })()
    }));

    return tickets;

  } finally {
    conn.release();
  }
}




static async findAll(userId, userRole) {
  const conn = await db.getConnection();
  try {
    let sql = `
      SELECT
        t.id,
        t.event_date,
        t.event_time,
        t.event_location,
        rd.name   AS reporting_dept,
        sd.name   AS responding_dept,
        t.status,
        u.username AS created_by,
        t.created_at
      FROM tickets t
      LEFT JOIN departments rd ON t.reporting_dept_id = rd.id
      LEFT JOIN departments sd ON t.responding_dept_id = sd.id
      LEFT JOIN users u      ON t.created_by = u.id AND u.deleted_at IS NULL
    `;
    const params = [];
    if (userRole !== 'admin' && userRole !== 'manager_ovr') {
      // تصفية فقط على التذاكر التي أنشأها المستخدم
      sql += ` WHERE t.deleted_at IS NULL AND t.created_by = ?`;
      params.push(userId);
    } else {
      // للأدمن، عرض جميع التذاكر غير المحذوفة
      sql += ` WHERE t.deleted_at IS NULL`;
    }
    sql += ` ORDER BY t.created_at DESC`;
    const [rows] = await conn.query(sql, params);
    return rows;
  } finally {
    conn.release();
  }
}


static async findById(id, userId, userRole) {
  const conn = await db.getConnection();
  try {
    if (!id) {
      throw new Error('معرف التذكرة مطلوب');
    }
    
    console.log('🔍 [findById] جلب التذكرة رقم:', id, 'للمستخدم:', userId, 'الرول:', userRole);
    // 1) جلب بيانات التذكرة الأساسية مع بيانات مستوى الضرر
    let ticket;
    try {
      const [tickets] = await conn.query(`
        SELECT 
          t.*, 
          rd.name AS reporting_dept_name, 
          sd.name AS responding_dept_name,
          CONCAT(
            COALESCE(u1.first_name, ''),
            CASE WHEN u1.second_name IS NOT NULL AND u1.second_name != '' THEN CONCAT(' ', u1.second_name) ELSE '' END,
            CASE WHEN u1.third_name IS NOT NULL AND u1.third_name != '' THEN CONCAT(' ', u1.third_name) ELSE '' END,
            CASE WHEN u1.last_name IS NOT NULL AND u1.last_name != '' THEN CONCAT(' ', u1.last_name) ELSE '' END
          ) AS created_by_name,
          CONCAT(
            COALESCE(u2.first_name, ''),
            CASE WHEN u2.second_name IS NOT NULL AND u2.second_name != '' THEN CONCAT(' ', u2.second_name) ELSE '' END,
            CASE WHEN u2.third_name IS NOT NULL AND u2.third_name != '' THEN CONCAT(' ', u2.third_name) ELSE '' END,
            CASE WHEN u2.last_name IS NOT NULL AND u2.last_name != '' THEN CONCAT(' ', u2.last_name) ELSE '' END
          ) AS assigned_to_name,
          h.code AS harm_level_code,
          h.name_ar AS harm_level_name_ar,
          h.name_en AS harm_level_name_en,
          h.desc_ar AS harm_level_desc_ar,
          h.desc_en AS harm_level_desc_en
        FROM tickets t
        LEFT JOIN departments rd ON t.reporting_dept_id = rd.id
        LEFT JOIN departments sd ON t.responding_dept_id = sd.id
        LEFT JOIN users u1 ON t.created_by   = u1.id AND u1.deleted_at IS NULL
        LEFT JOIN users u2 ON t.assigned_to  = u2.id AND u2.deleted_at IS NULL
        LEFT JOIN harm_levels h ON t.harm_level_id = h.id
        WHERE t.id = ? AND t.deleted_at IS NULL
      `, [id]);

      if (tickets.length === 0) {
        console.log('❌ [findById] التذكرة غير موجودة:', id);
        return null;
      }
      ticket = tickets[0];
      console.log('✅ [findById] تم جلب بيانات التذكرة الأساسية');
    } catch (error) {
      console.error('❌ [findById] خطأ في جلب بيانات التذكرة الأساسية:', error);
      throw error;
    }

    // أضف بيانات مستوى الضرر كمفتاح فرعي
    try {
      ticket.harm_level = {
        id: ticket.harm_level_id,
        code: ticket.harm_level_code,
        name_ar: ticket.harm_level_name_ar,
        name_en: ticket.harm_level_name_en,
        desc_ar: ticket.harm_level_desc_ar,
        desc_en: ticket.harm_level_desc_en
      };
      
      // تأكد من أن البيانات موجودة
      if (!ticket.harm_level.id) {
        ticket.harm_level = null;
      }
      console.log('✅ [findById] تم معالجة بيانات مستوى الضرر');
    } catch (error) {
      console.error('❌ [findById] خطأ في معالجة بيانات مستوى الضرر:', error);
      ticket.harm_level = null;
    }

    // 2) المرفقات
    try {
      const [attachments] = await conn.query(
        `SELECT id, filename, path, mimetype, created_at
         FROM ticket_attachments
         WHERE ticket_id = ?`,
        [id]
      );
      ticket.attachments = attachments;
      console.log('✅ [findById] تم جلب المرفقات:', attachments.length);
    } catch (error) {
      console.error('❌ [findById] خطأ في جلب المرفقات:', error);
      ticket.attachments = [];
    }

    // 3) سجل الحالات
    try {
      const [history] = await conn.query(
        `SELECT
           h.id, h.status, h.comments, h.created_at,
           CONCAT(
             COALESCE(u.first_name, ''),
             CASE WHEN u.second_name IS NOT NULL AND u.second_name != '' THEN CONCAT(' ', u.second_name) ELSE '' END,
             CASE WHEN u.third_name IS NOT NULL AND u.third_name != '' THEN CONCAT(' ', u.third_name) ELSE '' END,
             CASE WHEN u.last_name IS NOT NULL AND u.last_name != '' THEN CONCAT(' ', u.last_name) ELSE '' END
           ) AS changed_by_name
         FROM ticket_status_history h
         LEFT JOIN users u ON h.changed_by = u.id
         WHERE h.ticket_id = ?
         ORDER BY h.created_at DESC`,
        [id]
      );
      ticket.status_history = history;
      console.log('✅ [findById] تم جلب سجل الحالات:', history.length);
    } catch (error) {
      console.error('❌ [findById] خطأ في جلب سجل الحالات:', error);
      ticket.status_history = [];
    }

    // 4) التصنيفات
    try {
      const [classifications] = await conn.query(
        `SELECT c.id, c.name_ar, c.name_en
         FROM ticket_classifications tc
         JOIN classifications c ON tc.classification_id = c.id
         WHERE tc.ticket_id = ?`,
        [id]
      );
      ticket.classifications = classifications.map(r => r.id);
      ticket.classification_details = classifications.map(r => ({
        id: r.id,
        name_ar: r.name_ar,
        name_en: r.name_en
      }));
      console.log('✅ [findById] تم جلب التصنيفات:', ticket.classifications);
      console.log('✅ [findById] تفاصيل التصنيفات:', ticket.classification_details);
    } catch (error) {
      console.error('❌ [findById] خطأ في جلب التصنيفات:', error);
      ticket.classifications = [];
      ticket.classification_details = [];
    }

    // 5) أنواع المرضى
    try {
      const [patientTypes] = await conn.query(
        `SELECT patient_type
         FROM ticket_patient_types
         WHERE ticket_id = ?`,
        [id]
      );
      ticket.patient_types = patientTypes.map(r => r.patient_type);
      console.log('✅ [findById] تم جلب أنواع المرضى:', ticket.patient_types);
    } catch (error) {
      console.error('❌ [findById] خطأ في جلب أنواع المرضى:', error);
      ticket.patient_types = [];
    }

    // 6) الردود
    try {
      const [replies] = await conn.query(
        `SELECT
           r.id, r.text, r.created_at,
           u.username AS author
         FROM ticket_replies r
         LEFT JOIN users u ON r.author_id = u.id
         WHERE r.ticket_id = ?
         ORDER BY r.created_at ASC`,
        [id]
      );
      ticket.replies = replies;
      console.log('✅ [findById] تم جلب الردود:', replies.length);
    } catch (error) {
      console.error('❌ [findById] خطأ في جلب الردود:', error);
      ticket.replies = [];
    }

    console.log('✅ [findById] تم إكمال جلب جميع بيانات التذكرة بنجاح');
    return ticket;

  } finally {
    conn.release();
  }
}



// في ملف backend/models/ticketModel.js

// في ملف backend/models/ticketModel.js

static async update(id, ticketData, userId) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1) جلب بيانات التذكرة الأصلية
    const [origRows] = await connection.query(
      'SELECT * FROM tickets WHERE id = ?',
      [id]
    );
    if (origRows.length === 0) {
      throw new Error('التذكرة غير موجودة');
    }
    const orig = origRows[0];
    const currentStatus = orig.status;

    const allowedGenders = ['ذكر', 'أنثى', 'male', 'female'];

    // 2) فك التدمير مع قيم افتراضية من orig
    let {
      event_date     = orig.event_date,
      event_time     = orig.event_time,
      event_location = orig.event_location,
      reporting_dept_id  = orig.reporting_dept_id,
      responding_dept_id = orig.responding_dept_id,
      other_depts       = orig.other_depts ?? null,
      patient_name      = orig.patient_name ?? null,
      medical_record_no = orig.medical_record_no ?? null,
      dob               = orig.dob ?? null,
      gender            = orig.gender,
      report_type       = orig.report_type ?? null,
      report_short_desc = orig.report_short_desc ?? null,
      event_description = orig.event_description ?? null,
      reporter_name     = orig.reporter_name ?? null,
      reporter_position = orig.reporter_position ?? null,
      reporter_phone    = orig.reporter_phone ?? null,
      reporter_email    = orig.reporter_email ?? null,
      actions_taken     = orig.actions_taken ?? null,
      had_injury,
      injury_type,
      status            = orig.status,
      attachments       = [],
      harm_level_id     = orig.harm_level_id 
    } = ticketData;

    // 2.1) معالجة الحقول الاختيارية
    // other_depts, patient_name, ... فعلتها ضمن defaults أعلى
    // تأكد من صحة gender
    gender = allowedGenders.includes(gender) ? gender : null;

    // had_injury: إذا جاء '' أو undefined اعتبره null
    had_injury = (had_injury === undefined || had_injury === '') 
                  ? null 
                  : had_injury;

    // injury_type:
    // - لو المفتاح غير موجود: خليه زي ما كان في DB
    if (ticketData.injury_type === undefined) {
      injury_type = orig.injury_type;
    } else {
      // لو جاء '' اعتبره null، وإلا استخدم القيمة
      injury_type = (injury_type === '') ? null : injury_type;
    }



    // لو أرسل attachments كمصفوفة:
    if (Array.isArray(ticketData.attachments)) {
      attachments = ticketData.attachments;
    }

    // 3) تحديث جدول tickets
    await connection.query(
      `UPDATE tickets SET
         event_date         = ?,
         event_time         = ?,
         event_location     = ?,
         reporting_dept_id  = ?,
         responding_dept_id = ?,
         other_depts        = ?,
         patient_name       = ?,
         medical_record_no  = ?,
         dob                = ?,
         gender             = ?,
         report_type        = ?,
         report_short_desc  = ?,
         event_description  = ?,
         reporter_name      = ?,
         reporter_position  = ?,
         reporter_phone     = ?,
         reporter_email     = ?,
         actions_taken      = ?,
         had_injury         = ?,
         injury_type        = ?,
         harm_level_id      = ?, 
         status             = ?,
         updated_at         = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        event_date,
        event_time,
        event_location,
        reporting_dept_id,
        responding_dept_id,
        other_depts,
        patient_name,
        medical_record_no,
        dob,
        gender,
        report_type,
        report_short_desc,
        event_description,
        reporter_name,
        reporter_position,
        reporter_phone,
        reporter_email,
        actions_taken,
        had_injury,
        injury_type,
        harm_level_id, 
        status,
        id
      ]
    );

    // 4) تحديث patient_type في ticket_patient_types
    await connection.query(
      'DELETE FROM ticket_patient_types WHERE ticket_id = ?',
      [id]
    );
    if (ticketData.patient_type) {
      await connection.query(
        'INSERT INTO ticket_patient_types (ticket_id, patient_type) VALUES (?, ?)',
        [id, ticketData.patient_type]
      );
    }

    // 5) تحديث التصنيفات فقط إذا أُرسلت
    if (ticketData.classifications !== undefined && Array.isArray(ticketData.classifications) && ticketData.classifications.length > 0) {
      await connection.query(
        'DELETE FROM ticket_classifications WHERE ticket_id = ?',
        [id]
      );
      const clsVals = ticketData.classifications.map(c => [id, c]);
      await connection.query(
        'INSERT INTO ticket_classifications (ticket_id, classification_id) VALUES ?',
        [clsVals]
      );
    }

    // 6) إضافة مرفقات جديدة
    if (attachments.length > 0) {
      const attVals = attachments.map(att => [
        id, att.filename, att.path, att.mimetype
      ]);
      await connection.query(
        `INSERT INTO ticket_attachments 
           (ticket_id, filename, path, mimetype) 
         VALUES ?`,
        [attVals]
      );
    }

    // 7) تسجيل تغيير الحالة
    if (status && status !== currentStatus) {
      await connection.query(
        `INSERT INTO ticket_status_history
           (ticket_id, status, changed_by, comments)
         VALUES (?, ?, ?, ?)`,
        [
          id,
          status,
          userId,
          ticketData.status_comments || 'تم تحديث حالة الحدث العارض'
        ]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}




    static async delete(id) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Apply soft delete to ticket instead of permanent deletion
            await connection.query('UPDATE tickets SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL', [id]);

            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async assignTicket(ticketId, assignedTo, userId, comments) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Update ticket assignment
            await connection.query(
                'UPDATE tickets SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [assignedTo, ticketId]
            );

            // Log assignment in status history
            await connection.query(
                `INSERT INTO ticket_status_history (ticket_id, status, changed_by, comments) 
                 VALUES (?, 'assigned', ?, ?)`,
                [ticketId, userId, comments || 'تم تعيين الحدث العارض']
            );

            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async getStatusHistory(ticketId) {
        const connection = await db.getConnection();
        try {
            const [history] = await connection.query(
                `SELECT h.*, u.username as changed_by_name
                 FROM ticket_status_history h
                 LEFT JOIN users u ON h.changed_by = u.id
                 WHERE h.ticket_id = ?
                 ORDER BY h.changed_at DESC`,
                [ticketId]
            );
            return history;
        } finally {
            connection.release();
        }
    }

    static async getDepartments() {
        const connection = await db.getConnection();
        try {
            const [departments] = await connection.query('SELECT id, name FROM departments ORDER BY name');
            return departments;
        } finally {
            connection.release();
        }
    }
static async addReply(ticketId, authorId, text) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1) أدخل الرد
    const [result] = await conn.query(
      'INSERT INTO ticket_replies (ticket_id, author_id, text) VALUES (?, ?, ?)',
      [ticketId, authorId, text]
    );
    const replyId = result.insertId;

    // 2) جيب الرد المضاف مع اسم الكاتب
    const [rows] = await conn.query(
      `SELECT r.id, r.text, r.created_at, u.username AS author
       FROM ticket_replies r
       JOIN users u ON u.id = r.author_id
       WHERE r.id = ?`,
      [replyId]
    );
    const newReply = rows[0];

    // 3) تحقق إذا المؤلف هو من المكلفين
    const [assignees] = await conn.query(
      'SELECT assigned_to FROM ticket_assignments WHERE ticket_id = ?',
      [ticketId]
    );
const isAssignee = assignees.some(a => a.assigned_to === authorId);

if (isAssignee) {
  // تحقق من عدد المكلفين الكلي
  const totalAssignees = assignees.map(a => a.assigned_to);

  // تحقق من من ردوا من المكلفين
  const [replyAuthors] = await conn.query(
    `SELECT DISTINCT author_id
     FROM ticket_replies
     WHERE ticket_id = ?
       AND author_id IN (?)`,
    [ticketId, totalAssignees]
  );

  const repliedUserIds = replyAuthors.map(r => r.author_id);

  const allResponded = totalAssignees.every(assigneeId =>
    repliedUserIds.includes(assigneeId)
  );

  if (allResponded) {
    // أغلق التذكرة
    await conn.query(
      `INSERT INTO ticket_status_history
         (ticket_id, status, changed_by)
       VALUES (?, ?, ?)`,
      [ticketId, 'مغلق', authorId]
    );

    await conn.query(
      `UPDATE tickets
         SET status = ?
       WHERE id = ?`,
      ['مغلق', ticketId]
    );
  }
}


    await conn.commit();
    return newReply;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}


// في backend/models/ticketModel.js
static async assignUsers(ticketId, assignees = [], changedBy, comments) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1) إضافة التعيينات
    if (Array.isArray(assignees) && assignees.length) {
      const vals = assignees.map(userId => [
        ticketId,
        userId,
        changedBy,
        comments || null
      ]);
      await conn.query(
        `INSERT INTO ticket_assignments
           (ticket_id, assigned_to, assigned_by, comments)
         VALUES ?`,
        [vals]
      );
    }

    // 2) تسجيل حالة "تم الإرسال" لكل مستخدم مكلّف
    for (const userId of assignees) {
      const [rows] = await conn.query(
        'SELECT username FROM users WHERE id = ?',
        [userId]
      );
      const username = rows[0]?.username || `ID:${userId}`;

      await conn.query(
        `INSERT INTO ticket_status_history
           (ticket_id, status, changed_by, comments)
         VALUES (?, 'تم الإرسال', ?, ?)`,
        [ticketId, changedBy, `تم الإرسال إلى ${username}`]
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}


static async track(ticketId) {
  const conn = await db.getConnection();
  try {
    // 1) بيانات التذكرة الأساسية
    const [[ticket]] = await conn.query(
      `SELECT 
         t.id, t.report_short_desc AS title, t.status AS current_status, t.created_at,
         u1.username AS created_by,
         rd.name AS reporting_dept_name,
         sd.name AS responding_dept_name
       FROM tickets t
       LEFT JOIN users u1 ON t.created_by = u1.id AND u1.deleted_at IS NULL
       LEFT JOIN departments rd ON t.reporting_dept_id = rd.id
       LEFT JOIN departments sd ON t.responding_dept_id = sd.id
       WHERE t.id = ? AND t.deleted_at IS NULL`,
      [ticketId]
    );
    if (!ticket) return null;

    // 2) سجل الحالات (مع اسم المستخدم والقسم)
    const [history] = await conn.query(
      `SELECT 
         h.status,
         h.comments,
         h.created_at,
         u.username AS changed_by,
         d.name     AS department_name
       FROM ticket_status_history h
       LEFT JOIN users u ON h.changed_by = u.id AND u.deleted_at IS NULL
       LEFT JOIN departments d ON u.department_id = d.id AND d.deleted_at IS NULL
       WHERE h.ticket_id = ?
       ORDER BY h.created_at ASC`,
      [ticketId]
    );

    // 3) الردود (نفس التنسيق – ونحدد status = 'رد')
    const [replies] = await conn.query(
      `SELECT 
         r.text AS comments,
         r.created_at,
         u.username AS changed_by,
         d.name     AS department_name,
         'رد'      AS status
       FROM ticket_replies r
       LEFT JOIN users u ON r.author_id = u.id AND u.deleted_at IS NULL
       LEFT JOIN departments d ON u.department_id = d.id AND d.deleted_at IS NULL
       WHERE r.ticket_id = ?
       ORDER BY r.created_at ASC`,
      [ticketId]
    );

    // 4) دمج السجل مع الردود وترتيبهم حسب الزمن
    const timeline = [...history, ...replies].sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    );

    // 5) المكلفين
    const [assignees] = await conn.query(
      `SELECT u.id, u.username, d.name AS department
       FROM ticket_assignments ta
       JOIN users u ON ta.assigned_to = u.id AND u.deleted_at IS NULL
       LEFT JOIN departments d ON u.department_id = d.id AND d.deleted_at IS NULL
       WHERE ta.ticket_id = ?`,
      [ticketId]
    );

    return { ticket, timeline, assignees };
  } finally {
    conn.release();
  }
}


}



module.exports = Ticket;  