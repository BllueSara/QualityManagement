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
    event_date,
    event_time,
    event_location,
    reporting_dept_id,   // من formData.get('reportingDept')
    responding_dept_id,  // من formData.get('respondingDept')
    other_depts,         // من formData.get('otherDepts')
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
    attachments
  } = ticketData;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // INSERT يتضمّن نفس عدد الأعمدة ونفس عدد الـ ? placeholders
    const [result] = await connection.query(
      `INSERT INTO tickets (
         event_date,     event_time,   event_location,
         reporting_dept_id, responding_dept_id, other_depts,
         patient_name,   medical_record_no, dob, gender,
         report_type,    report_short_desc, event_description,
         reporter_name,  report_date,  reporter_position,
         reporter_phone, reporter_email, actions_taken,
         had_injury,     injury_type,
         status,         created_by
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

    // إذا في مرفقات
    if (attachments && attachments.length) {
      const vals = attachments.map(f => [ticketId, f.filename, f.path, f.mimetype]);
      await connection.query(
        `INSERT INTO ticket_attachments (ticket_id, filename, filepath, mimetype) VALUES ?`,
        [vals]
      );
    }

    // سجّل التاريخ الابتدائي للحالة
    await connection.query(
      `INSERT INTO ticket_status_history
         (ticket_id, status, changed_by, comments)
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

    static async findAll(userId, userRole) {
        const connection = await db.getConnection();
        try {
            let query = `
                SELECT t.*, 
                       d.name as department_name,
                       u1.username as created_by_name,
                       u2.username as assigned_to_name
                FROM tickets t
                LEFT JOIN departments d ON t.department_id = d.id
                LEFT JOIN users u1 ON t.created_by = u1.id
                LEFT JOIN users u2 ON t.assigned_to = u2.id
            `;

            // Add role-based filtering
            if (userRole !== 'admin') {
                query += ` WHERE t.created_by = ? OR t.assigned_to = ? OR t.department_id IN (
                    SELECT department_id FROM user_departments WHERE user_id = ?
                )`;
            }

            query += ` ORDER BY t.created_at DESC`;

            const [tickets] = await connection.query(
                query,
                userRole !== 'admin' ? [userId, userId, userId] : []
            );

            return tickets;
        } finally {
            connection.release();
        }
    }

    static async findById(id, userId, userRole) {
        const connection = await db.getConnection();
        try {
            let query = `
                SELECT t.*, 
                       d.name as department_name,
                       u1.username as created_by_name,
                       u2.username as assigned_to_name
                FROM tickets t
                LEFT JOIN departments d ON t.department_id = d.id
                LEFT JOIN users u1 ON t.created_by = u1.id
                LEFT JOIN users u2 ON t.assigned_to = u2.id
                WHERE t.id = ?
            `;

            // Add role-based filtering
            if (userRole !== 'admin') {
                query += ` AND (t.created_by = ? OR t.assigned_to = ? OR t.department_id IN (
                    SELECT department_id FROM user_departments WHERE user_id = ?
                ))`;
            }

            const [tickets] = await connection.query(
                query,
                userRole !== 'admin' ? [id, userId, userId, userId] : [id]
            );

            if (tickets.length === 0) {
                return null;
            }

            const ticket = tickets[0];

            // Get attachments
            const [attachments] = await connection.query(
                'SELECT * FROM ticket_attachments WHERE ticket_id = ?',
                [id]
            );
            ticket.attachments = attachments;

            return ticket;
        } finally {
            connection.release();
        }
    }

    static async update(id, ticketData, userId) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Get current ticket status
            const [currentTicket] = await connection.query(
                'SELECT status FROM tickets WHERE id = ?',
                [id]
            );

            if (currentTicket.length === 0) {
                throw new Error('التذكرة غير موجودة');
            }

            const {
                event_date,
                event_time,
                event_location,
                department_id,
                patient_type,
                patient_name,
                patient_id,
                patient_phone,
                report_type,
                report_number,
                report_date,
                report_time,
                report_location,
                report_description,
                classification,
                status,
                attachments
            } = ticketData;

            // Update ticket
            await connection.query(
                `UPDATE tickets SET
                    event_date = ?, event_time = ?, event_location = ?, department_id = ?,
                    patient_type = ?, patient_name = ?, patient_id = ?, patient_phone = ?,
                    report_type = ?, report_number = ?, report_date = ?, report_time = ?,
                    report_location = ?, report_description = ?, classification = ?,
                    status = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?`,
                [
                    event_date, event_time, event_location, department_id,
                    patient_type, patient_name, patient_id, patient_phone,
                    report_type, report_number, report_date, report_time,
                    report_location, report_description, classification,
                    status, id
                ]
            );

            // Insert new attachments if any
            if (attachments && attachments.length > 0) {
                const attachmentValues = attachments.map(attachment => [
                    id,
                    attachment.filename,
                    attachment.path,
                    attachment.mimetype
                ]);

                await connection.query(
                    `INSERT INTO ticket_attachments (ticket_id, filename, filepath, mimetype) VALUES ?`,
                    [attachmentValues]
                );
            }

            // Log status change if status was updated
            if (status && status !== currentTicket[0].status) {
                await connection.query(
                    `INSERT INTO ticket_status_history (ticket_id, status, changed_by, comments) 
                     VALUES (?, ?, ?, ?)`,
                    [id, status, userId, ticketData.status_comments || 'تم تحديث حالة التذكرة']
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
}

module.exports = Ticket; 