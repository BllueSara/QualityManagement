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
  const {
    event_date, event_time, event_location,
    reporting_dept_id, responding_dept_id, other_depts,
    patient_name, medical_record_no, dob, gender,
    report_type, report_short_desc, event_description,
    reporter_name, report_date, reporter_position,
    reporter_phone, reporter_email, actions_taken,
    had_injury, injury_type,
    attachments,
    classification,
    patient_types    // ← تأكد أنك مرّرت هذا الحقل من الـ front-end
  } = ticketData;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1) إدراج التذكرة
    const [result] = await connection.query(
      `INSERT INTO tickets (
         event_date, event_time, event_location,
         reporting_dept_id, responding_dept_id, other_depts,
         patient_name, medical_record_no, dob, gender,
         report_type, report_short_desc, event_description,
         reporter_name, report_date, reporter_position,
         reporter_phone, reporter_email, actions_taken,
         had_injury, injury_type,
         status, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'جديد', ?)`,
      [
        event_date, event_time, event_location,
        reporting_dept_id, responding_dept_id, other_depts,
        patient_name, medical_record_no, dob, gender,
        report_type, report_short_desc, event_description,
        reporter_name, report_date, reporter_position,
        reporter_phone, reporter_email, actions_taken,
        had_injury, injury_type,
        userId
      ]
    );
    const ticketId = result.insertId;

    // 2) إدراج التصنيفات
    if (Array.isArray(classification) && classification.length) {
      const vals = classification.map(cat => [ticketId, cat]);
      await connection.query(
        `INSERT INTO ticket_classifications (ticket_id, classification) VALUES ?`,
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
       VALUES (?, 'جديد', ?, 'تم إنشاء التذكرة')`,
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
    // 1) جلب صلاحيات المستخدم من جدول user_permissions
    const [permRows] = await conn.query(
      `SELECT p.permission_key 
       FROM permissions p
       JOIN user_permissions up ON up.permission_id = p.id
       WHERE up.user_id = ?`,
      [userId]
    );
    const userPerms = new Set(permRows.map(r => r.permission_key));

    // إذا ادمن أو لديه صلاحية view_tickets => يرى كل التذاكر
    const canViewAll = (userRole === 'admin') || userPerms.has('view_tickets');

    let sql, params = [];

    if (canViewAll) {
      // للمشرف أو من يملك view_tickets: كل التذاكر مع آخر حالة
      sql = `
        SELECT
          t.id,
          t.event_date,
          t.event_time,
          t.event_location,
          rd.name        AS reporting_dept,
          sd.name        AS responding_dept,
          latest.status  AS current_status,
          u.username     AS created_by,
          t.created_at
        FROM tickets t
        LEFT JOIN departments rd ON t.reporting_dept_id = rd.id
        LEFT JOIN departments sd ON t.responding_dept_id = sd.id
        LEFT JOIN users u      ON t.created_by = u.id

        LEFT JOIN (
          SELECT h1.ticket_id, h1.status
          FROM ticket_status_history h1
          INNER JOIN (
            SELECT ticket_id, MAX(id) AS max_id
            FROM ticket_status_history
            GROUP BY ticket_id
          ) h2 ON h1.ticket_id = h2.ticket_id AND h1.id = h2.max_id
        ) AS latest ON latest.ticket_id = t.id

        ORDER BY t.created_at DESC
      `;
    } else {
      // للمستخدم العادي بدون صلاحية عرض الكل: فقط التذاكر المحوَّلة إليه والحالة 'تم الإرسال'
      sql = `
        SELECT
          t.id,
          t.event_date,
          t.event_time,
          t.event_location,
          rd.name        AS reporting_dept,
          sd.name        AS responding_dept,
          latest.status  AS current_status,
          u.username     AS created_by,
          t.created_at
        FROM tickets t
        LEFT JOIN departments rd ON t.reporting_dept_id = rd.id
        LEFT JOIN departments sd ON t.responding_dept_id = sd.id
        LEFT JOIN users u      ON t.created_by = u.id

        LEFT JOIN (
          SELECT h1.ticket_id, h1.status
          FROM ticket_status_history h1
          INNER JOIN (
            SELECT ticket_id, MAX(id) AS max_id
            FROM ticket_status_history
            GROUP BY ticket_id
          ) h2 ON h1.ticket_id = h2.ticket_id AND h1.id = h2.max_id
        ) AS latest ON latest.ticket_id = t.id

        WHERE EXISTS (
          SELECT 1
          FROM ticket_assignments ta
          WHERE ta.ticket_id   = t.id
            AND ta.assigned_to = ?
        )

        ORDER BY t.created_at DESC
      `;
      params.push(userId);
    }

    const [rows] = await conn.query(sql, params);
    return rows;

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
      LEFT JOIN users u      ON t.created_by = u.id
    `;
    const params = [];
    if (userRole !== 'admin') {
      // تصفية فقط على التذاكر التي أنشأها المستخدم
      sql += ` WHERE t.created_by = ?`;
      params.push(userId);
    }
    sql += ` ORDER BY t.created_at DESC`;
    const [rows] = await conn.query(sql, params);
    return rows;
  } finally {
    conn.release();
  }
}


static async findById(id) {
  const conn = await db.getConnection();
  try {
    // 1) جلب بيانات التذكرة الأساسية (بدون أي شروط إضافية على الدور)
    const [tickets] = await conn.query(`
      SELECT 
        t.*, 
        rd.name AS reporting_dept_name, 
        sd.name AS responding_dept_name,
        u1.username AS created_by_name,
        u2.username AS assigned_to_name
      FROM tickets t
      LEFT JOIN departments rd ON t.reporting_dept_id = rd.id
      LEFT JOIN departments sd ON t.responding_dept_id = sd.id
      LEFT JOIN users u1 ON t.created_by   = u1.id
      LEFT JOIN users u2 ON t.assigned_to  = u2.id
      WHERE t.id = ?
    `, [id]);

    if (tickets.length === 0) {
      return null;
    }
    const ticket = tickets[0];

    // 2) المرفقات
    const [attachments] = await conn.query(
      `SELECT id, filename, path, mimetype, created_at
       FROM ticket_attachments
       WHERE ticket_id = ?`,
      [id]
    );
    ticket.attachments = attachments;

    // 3) سجل الحالات
    const [history] = await conn.query(
      `SELECT
         h.id, h.status, h.comments, h.created_at,
         u.username AS changed_by_name
       FROM ticket_status_history h
       LEFT JOIN users u ON h.changed_by = u.id
       WHERE h.ticket_id = ?
       ORDER BY h.created_at DESC`,
      [id]
    );
    ticket.status_history = history;

    // 4) التصنيفات
    const [classifications] = await conn.query(
      `SELECT classification
       FROM ticket_classifications
       WHERE ticket_id = ?`,
      [id]
    );
    ticket.classifications = classifications.map(r => r.classification);

    // 5) أنواع المرضى
    const [patientTypes] = await conn.query(
      `SELECT patient_type
       FROM ticket_patient_types
       WHERE ticket_id = ?`,
      [id]
    );
    ticket.patient_types = patientTypes.map(r => r.patient_type);

    // 6) الردود
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

    return ticket;

  } finally {
    conn.release();
  }
}



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

    // 2) فك التدمير مع قيم افتراضية من orig
    let {
      event_date     = orig.event_date,
      event_time     = orig.event_time,
      event_location = orig.event_location,
      reporting_dept_id = orig.reporting_dept_id,
      responding_dept_id = orig.responding_dept_id,
      other_depts       = orig.other_depts,
      patient_name      = orig.patient_name,
      medical_record_no = orig.medical_record_no,
      dob               = orig.dob,
      gender            = orig.gender,
      report_type       = orig.report_type,
      report_short_desc = orig.report_short_desc,
      event_description = orig.event_description,
      reporter_name     = orig.reporter_name,
      report_date       = orig.report_date,
      reporter_position = orig.reporter_position,
      reporter_phone    = orig.reporter_phone,
      reporter_email    = orig.reporter_email,
      actions_taken     = orig.actions_taken,
      had_injury        = orig.had_injury,
      injury_type       = orig.injury_type,
      status            = orig.status,
      attachments       = []
    } = ticketData;

    // القيمة الواحدة للـ patient_type
    let { patient_type = null } = ticketData;

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
         report_date        = ?,
         reporter_position  = ?,
         reporter_phone     = ?,
         reporter_email     = ?,
         actions_taken      = ?,
         had_injury         = ?,
         injury_type        = ?,
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
        report_date,
        reporter_position,
        reporter_phone,
        reporter_email,
        actions_taken,
        had_injury,
        injury_type,
        status,
        id
      ]
    );

    // 4) تحديث patient_type في ticket_patient_types
    // نحذف القديم
    await connection.query(
      'DELETE FROM ticket_patient_types WHERE ticket_id = ?',
      [id]
    );
    // إذا أرسل العميل patient_type غير فارغ
    if (patient_type) {
      await connection.query(
        'INSERT INTO ticket_patient_types (ticket_id, patient_type) VALUES (?, ?)',
        [id, patient_type]
      );
    }

    // 5) تحديث التصنيفات كما سبق (إذا تريد) …
    // مثال:
    if (Array.isArray(ticketData.classifications)) {
      await connection.query(
        'DELETE FROM ticket_classifications WHERE ticket_id = ?',
        [id]
      );
      if (ticketData.classifications.length > 0) {
        const clsVals = ticketData.classifications.map(c => [id, c]);
        await connection.query(
          'INSERT INTO ticket_classifications (ticket_id, classification) VALUES ?',
          [clsVals]
        );
      }
    }

    // 6) إضافة مرفقات جديدة
    if (attachments.length > 0) {
      const attVals = attachments.map(att => [
        id, att.filename, att.path, att.mimetype
      ]);
      await connection.query(
        `INSERT INTO ticket_attachments 
           (ticket_id, filename, filepath, mimetype) 
         VALUES ?`,
        [attVals]
      );
    }

    // 7) تاريخ حالة التذكرة
    if (status && status !== currentStatus) {
      await connection.query(
        `INSERT INTO ticket_status_history
           (ticket_id, status, changed_by, comments)
         VALUES (?, ?, ?, ?)`,
        [
          id,
          status,
          userId,
          ticketData.status_comments || 'تم تحديث حالة التذكرة'
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

            // Delete attachments
            await connection.query('DELETE FROM ticket_attachments WHERE ticket_id = ?', [id]);

            // Delete status history
            await connection.query('DELETE FROM ticket_status_history WHERE ticket_id = ?', [id]);

            // Delete ticket
            await connection.query('DELETE FROM tickets WHERE id = ?', [id]);

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
                [ticketId, userId, comments || 'تم تعيين التذكرة']
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
       LEFT JOIN users u1 ON t.created_by = u1.id
       LEFT JOIN departments rd ON t.reporting_dept_id = rd.id
       LEFT JOIN departments sd ON t.responding_dept_id = sd.id
       WHERE t.id = ?`,
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
       LEFT JOIN users u ON h.changed_by = u.id
       LEFT JOIN departments d ON u.department_id = d.id
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
       LEFT JOIN users u ON r.author_id = u.id
       LEFT JOIN departments d ON u.department_id = d.id
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
       JOIN users u ON ta.assigned_to = u.id
       LEFT JOIN departments d ON u.department_id = d.id
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