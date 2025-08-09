const mysql = require('mysql2/promise');

class ProtocolModel {
    constructor() {
        this.pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'Quality'
        });
    }

    // إنشاء جداول المحاضر إذا لم تكن موجودة
    async initializeTables() {
        try {
            // جدول المحاضر الرئيسي
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS protocols (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    title VARCHAR(500) NOT NULL,
                    protocol_date DATE NOT NULL,
                    created_by INT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    status ENUM('active', 'inactive', 'deleted') DEFAULT 'active',
                    approval_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
                    is_approved BOOLEAN DEFAULT FALSE,
                    approved_by INT,
                    file_path VARCHAR(500),
                    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);

            // جدول مواضيع المحضر
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS protocol_topics (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    protocol_id INT NOT NULL,
                    subject VARCHAR(500) NOT NULL,
                    discussion TEXT NOT NULL,
                    duration VARCHAR(100),
                    end_date DATE,
                    topic_order INT DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (protocol_id) REFERENCES protocols(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);

            // جدول معتمدي المحاضر
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS protocol_approvers (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    protocol_id INT NOT NULL,
                    user_id INT NOT NULL,
                    sequence_number INT DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (protocol_id) REFERENCES protocols(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    UNIQUE KEY unique_protocol_user (protocol_id, user_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);

            // جدول سجلات اعتماد المحاضر
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS protocol_approval_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    protocol_id INT NOT NULL,
                    approver_id INT NOT NULL,
                    delegated_by INT,
                    signed_as_proxy BOOLEAN DEFAULT FALSE,
                    status ENUM('pending', 'approved', 'rejected', 'accepted','sender_signature') DEFAULT 'pending',
                    signature TEXT,
                    electronic_signature BOOLEAN DEFAULT FALSE,
                    comments TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (protocol_id) REFERENCES protocols(id) ON DELETE CASCADE,
                    FOREIGN KEY (approver_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (delegated_by) REFERENCES users(id) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);

            console.log('Protocol tables initialized successfully');
        } catch (error) {
            console.error('Error initializing protocol tables:', error);
            throw error;
        }
    }

    // إنشاء محضر جديد
    async createProtocol(protocolData, userId) {
        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();

            // إدراج المحضر الرئيسي
            const [protocolResult] = await connection.execute(
                'INSERT INTO protocols (title, protocol_date, created_by) VALUES (?, ?, ?)',
                [protocolData.protocolTitle, protocolData.protocolDate, userId]
            );

            const protocolId = protocolResult.insertId;

            // إدراج مواضيع المحضر
            if (protocolData.topics && protocolData.topics.length > 0) {
                for (let i = 0; i < protocolData.topics.length; i++) {
                    const topic = protocolData.topics[i];
                    await connection.execute(
                        'INSERT INTO protocol_topics (protocol_id, subject, discussion, duration, end_date, topic_order) VALUES (?, ?, ?, ?, ?, ?)',
                        [
                            protocolId,
                            topic.subject,
                            topic.discussion,
                            topic.duration || null,
                            topic.endDate || null,
                            i + 1
                        ]
                    );
                }
            }


            await connection.commit();
            return { success: true, protocolId, message: 'تم إنشاء المحضر بنجاح' };
        } catch (error) {
            await connection.rollback();
            console.error('Error creating protocol:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    // جلب جميع المحاضر
    async getAllProtocols(userId, filters = {}) {
        try {
            let query = `
                SELECT 
                    p.id,
                    p.title,
                    p.protocol_date,
                    p.created_at,
                    p.status,
                    p.approval_status,
                    p.is_approved,
                    CONCAT(
                        COALESCE(u.first_name, ''),
                        CASE WHEN u.second_name IS NOT NULL AND u.second_name != '' THEN CONCAT(' ', u.second_name) ELSE '' END,
                        CASE WHEN u.third_name IS NOT NULL AND u.third_name != '' THEN CONCAT(' ', u.third_name) ELSE '' END,
                        CASE WHEN u.last_name IS NOT NULL AND u.last_name != '' THEN CONCAT(' ', u.last_name) ELSE '' END
                    ) as created_by_name,
                    COUNT(pt.id) as topics_count,
                    MAX(pt.end_date) as latest_end_date
                FROM protocols p
                LEFT JOIN users u ON p.created_by = u.id
                LEFT JOIN protocol_topics pt ON p.id = pt.protocol_id
                WHERE p.status != 'deleted'
            `;

            const params = [];

            // إضافة فلتر المستخدم إذا لم يكن مدير
            if (filters.userOnly) {
                query += ' AND p.created_by = ?';
                params.push(userId);
            }

            // إضافة فلتر البحث
            if (filters.search) {
                query += ' AND (p.title LIKE ? OR pt.subject LIKE ? OR pt.discussion LIKE ?)';
                const searchTerm = `%${filters.search}%`;
                params.push(searchTerm, searchTerm, searchTerm);
            }

            query += ' GROUP BY p.id ORDER BY p.created_at DESC';

            const [protocols] = await this.pool.execute(query, params);
            return protocols;
        } catch (error) {
            console.error('Error getting protocols:', error);
            throw error;
        }
    }

    // جلب محضر واحد مع مواضيعه
    async getProtocolById(protocolId, userId) {
        try {
            // جلب بيانات المحضر
            const [protocols] = await this.pool.execute(
                `SELECT 
                    p.*,
                    CONCAT(
                        COALESCE(u.first_name, ''),
                        CASE WHEN u.second_name IS NOT NULL AND u.second_name != '' THEN CONCAT(' ', u.second_name) ELSE '' END,
                        CASE WHEN u.third_name IS NOT NULL AND u.third_name != '' THEN CONCAT(' ', u.third_name) ELSE '' END,
                        CASE WHEN u.last_name IS NOT NULL AND u.last_name != '' THEN CONCAT(' ', u.last_name) ELSE '' END
                    ) as created_by_name
                FROM protocols p
                LEFT JOIN users u ON p.created_by = u.id
                WHERE p.id = ? AND p.status != 'deleted'
            `,
                [protocolId]
            );

            if (protocols.length === 0) {
                return null;
            }

            const protocol = protocols[0];

            // جلب مواضيع المحضر
            const [topics] = await this.pool.execute(
                'SELECT * FROM protocol_topics WHERE protocol_id = ? ORDER BY topic_order',
                [protocolId]
            );

            // جلب معتمدي المحضر
            const [approvers] = await this.pool.execute(
                `SELECT 
                    pa.*,
                    CONCAT(
                        COALESCE(u.first_name, ''),
                        CASE WHEN u.second_name IS NOT NULL AND u.second_name != '' THEN CONCAT(' ', u.second_name) ELSE '' END,
                        CASE WHEN u.third_name IS NOT NULL AND u.third_name != '' THEN CONCAT(' ', u.third_name) ELSE '' END,
                        CASE WHEN u.last_name IS NOT NULL AND u.last_name != '' THEN CONCAT(' ', u.last_name) ELSE '' END
                    ) as approver_name
                FROM protocol_approvers pa
                LEFT JOIN users u ON pa.user_id = u.id
                WHERE pa.protocol_id = ? ORDER BY pa.sequence_number
                `,
                [protocolId]
            );

            // جلب سجلات الاعتماد
            const [approvalLogs] = await this.pool.execute(
                `SELECT 
                    pal.*,
                    CONCAT(
                        COALESCE(u.first_name, ''),
                        CASE WHEN u.second_name IS NOT NULL AND u.second_name != '' THEN CONCAT(' ', u.second_name) ELSE '' END,
                        CASE WHEN u.third_name IS NOT NULL AND u.third_name != '' THEN CONCAT(' ', u.third_name) ELSE '' END,
                        CASE WHEN u.last_name IS NOT NULL AND u.last_name != '' THEN CONCAT(' ', u.last_name) ELSE '' END
                    ) as approver_name,
                    CONCAT(
                        COALESCE(u2.first_name, ''),
                        CASE WHEN u2.second_name IS NOT NULL AND u2.second_name != '' THEN CONCAT(' ', u2.second_name) ELSE '' END,
                        CASE WHEN u2.third_name IS NOT NULL AND u2.third_name != '' THEN CONCAT(' ', u2.third_name) ELSE '' END,
                        CASE WHEN u2.last_name IS NOT NULL AND u2.last_name != '' THEN CONCAT(' ', u2.last_name) ELSE '' END
                    ) as delegated_by_name
                FROM protocol_approval_logs pal
                LEFT JOIN users u ON pal.approver_id = u.id
                LEFT JOIN users u2 ON pal.delegated_by = u2.id
                WHERE pal.protocol_id = ? ORDER BY pal.created_at
                `,
                [protocolId]
            );

            protocol.topics = topics;
            protocol.approvers = approvers;
            protocol.approvalLogs = approvalLogs;
            return protocol;
        } catch (error) {
            console.error('Error getting protocol by ID:', error);
            throw error;
        }
    }

    // تحديث محضر
    async updateProtocol(protocolId, protocolData, userId) {
        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();

            // التحقق من وجود المحضر
            const [existingProtocol] = await connection.execute(
                'SELECT id FROM protocols WHERE id = ? AND status != "deleted"',
                [protocolId]
            );

            if (existingProtocol.length === 0) {
                throw new Error('المحضر غير موجود');
            }

            // إعادة تعيين حالة المحضر ليعود لمرحلة الاعتماد من جديد
            await connection.execute(
                'UPDATE protocols SET title = ?, protocol_date = ?, is_approved = 0, approval_status = "pending", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [protocolData.protocolTitle, protocolData.protocolDate, protocolId]
            );

            // مسح سجلات الاعتمادات السابقة للمحضر لإعادة دورة الاعتماد
            await connection.execute(
                'DELETE FROM protocol_approval_logs WHERE protocol_id = ?',
                [protocolId]
            );

            // حذف المواضيع القديمة
            await connection.execute(
                'DELETE FROM protocol_topics WHERE protocol_id = ?',
                [protocolId]
            );

            // إدراج المواضيع الجديدة
            if (protocolData.topics && protocolData.topics.length > 0) {
                for (let i = 0; i < protocolData.topics.length; i++) {
                    const topic = protocolData.topics[i];
                    await connection.execute(
                        'INSERT INTO protocol_topics (protocol_id, subject, discussion, duration, end_date, topic_order) VALUES (?, ?, ?, ?, ?, ?)',
                        [
                            protocolId,
                            topic.subject,
                            topic.discussion,
                            topic.duration || null,
                            topic.endDate || null,
                            i + 1
                        ]
                    );
                }
            }

            await connection.commit();
            return { success: true, message: 'تم تحديث المحضر بنجاح' };
        } catch (error) {
            await connection.rollback();
            console.error('Error updating protocol:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    // حذف محضر (حذف كامل مع الاعتماد على CASCADE للجداول التابعة)
    async deleteProtocol(protocolId, userId) {
        try {
            const [result] = await this.pool.execute(
                'DELETE FROM protocols WHERE id = ?',
                [protocolId]
            );

            if (result.affectedRows === 0) {
                throw new Error('المحضر غير موجود');
            }

            return { success: true, message: 'تم حذف المحضر كاملاً بنجاح' };
        } catch (error) {
            console.error('Error deleting protocol:', error);
            throw error;
        }
    }

    // جلب إحصائيات المحاضر
    async getProtocolStats(userId) {
        try {
            const [stats] = await this.pool.execute(`
                SELECT 
                    COUNT(*) as total_protocols,
                    COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) as today_protocols,
                    COUNT(CASE WHEN DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 END) as this_week_protocols
                FROM protocols 
                WHERE status != 'deleted' AND created_by = ?
            `, [userId]);

            return stats[0];
        } catch (error) {
            console.error('Error getting protocol stats:', error);
            throw error;
        }
    }

    // إضافة معتمد لمحضر
    async addApprover(protocolId, userId, sequenceNumber = null) {
        try {
            if (sequenceNumber === null) {
                // إضافة في النهاية
                const [maxSeq] = await this.pool.execute(
                    'SELECT MAX(sequence_number) as max_seq FROM protocol_approvers WHERE protocol_id = ?',
                    [protocolId]
                );
                sequenceNumber = (maxSeq[0].max_seq || 0) + 1;
            }

            await this.pool.execute(
                'INSERT INTO protocol_approvers (protocol_id, user_id, sequence_number) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE sequence_number = ?',
                [protocolId, userId, sequenceNumber, sequenceNumber]
            );

            return { success: true, message: 'تم إضافة المعتمد بنجاح' };
        } catch (error) {
            console.error('Error adding approver:', error);
            throw error;
        }
    }

    // جلب المحاضر المعلقة للمستخدم
    async getPendingApprovals(userId) {
        try {
            const [rows] = await this.pool.execute(`
                SELECT 
                    p.id,
                    p.title,
                    p.protocol_date,
                    p.approval_status,
                    p.is_approved,
                    p.file_path,
                    p.created_at,
                    pa.sequence_number,
                    CONCAT(
                        COALESCE(u.first_name, ''),
                        CASE WHEN u.second_name IS NOT NULL AND u.second_name != '' THEN CONCAT(' ', u.second_name) ELSE '' END,
                        CASE WHEN u.third_name IS NOT NULL AND u.third_name != '' THEN CONCAT(' ', u.third_name) ELSE '' END,
                        CASE WHEN u.last_name IS NOT NULL AND u.last_name != '' THEN CONCAT(' ', u.last_name) ELSE '' END
                    ) as created_by_name,
                    (SELECT COUNT(*) FROM protocol_topics WHERE protocol_id = p.id) as topics_count,
                    (SELECT MAX(end_date) FROM protocol_topics WHERE protocol_id = p.id) as latest_end_date,
                    (SELECT GROUP_CONCAT(
                        CONCAT(
                            COALESCE(u2.first_name, ''),
                            CASE WHEN u2.second_name IS NOT NULL AND u2.second_name != '' THEN CONCAT(' ', u2.second_name) ELSE '' END,
                            CASE WHEN u2.third_name IS NOT NULL AND u2.third_name != '' THEN CONCAT(' ', u2.third_name) ELSE '' END,
                            CASE WHEN u2.last_name IS NOT NULL AND u2.last_name != '' THEN CONCAT(' ', u2.last_name) ELSE '' END
                        ) ORDER BY pa2.sequence_number SEPARATOR ','
                    ) FROM protocol_approvers pa2 
                    LEFT JOIN users u2 ON pa2.user_id = u2.id 
                    WHERE pa2.protocol_id = p.id) as assigned_approvers
                FROM protocols p
                JOIN protocol_approvers pa ON p.id = pa.protocol_id
                LEFT JOIN users u ON p.created_by = u.id
                WHERE p.is_approved = 0
                  AND pa.user_id = ?
                  -- استبعاد الحالات التي قام فيها المستخدم بتفويض شخص آخر وقَبِل التفويض (لا تظهر له)
                  AND NOT EXISTS (
                    SELECT 1 FROM protocol_approval_logs pal_ex
                    WHERE pal_ex.protocol_id = p.id
                      AND pal_ex.delegated_by = ?
                      AND pal_ex.signed_as_proxy = 1
                      AND pal_ex.status = 'accepted'
                  )
                  AND NOT EXISTS (
                    SELECT 1 FROM protocol_approval_logs pal
                    WHERE pal.protocol_id = p.id
                      AND pal.approver_id = ?
                      AND pal.status = 'approved'
                  )
                  AND NOT EXISTS (
                    SELECT 1
                    FROM protocol_approvers pa_prev
                    WHERE pa_prev.protocol_id = p.id
                      AND pa_prev.sequence_number < pa.sequence_number
                      AND NOT EXISTS (
                        SELECT 1 FROM protocol_approval_logs pal_prev
                        WHERE pal_prev.protocol_id = p.id
                          AND (
                            (pal_prev.approver_id = pa_prev.user_id AND pal_prev.status = 'approved')
                            OR
                            (pal_prev.delegated_by = pa_prev.user_id AND pal_prev.signed_as_proxy = 1 AND pal_prev.status IN ('approved','accepted'))
                          )
                      )
                  )
                ORDER BY pa.sequence_number
            `, [userId, userId, userId]);

            return rows;
        } catch (error) {
            console.error('Error getting pending approvals:', error);
            throw error;
        }
    }

    // معالجة اعتماد محضر
    async handleApproval(protocolId, approverId, approved, signature, electronicSignature, notes, delegatedBy = null, isProxy = false) {
        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();

            // إدراج سجل الاعتماد
            await connection.execute(`
                INSERT INTO protocol_approval_logs (
                    protocol_id, approver_id, delegated_by, signed_as_proxy, 
                    status, signature, electronic_signature, comments, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE 
                    status = VALUES(status),
                    signature = VALUES(signature),
                    electronic_signature = VALUES(electronic_signature),
                    comments = VALUES(comments),
                    created_at = NOW()
            `, [
                protocolId,
                approverId,
                delegatedBy,
                isProxy ? 1 : 0,
                approved ? 'approved' : 'rejected',
                signature || null,
                electronicSignature || false,
                notes || ''
            ]);

            // التحقق من اكتمال الاعتماد
            const [remainingApprovers] = await connection.execute(`
                SELECT COUNT(*) as count
                FROM protocol_approvers pa
                WHERE pa.protocol_id = ? 
                  AND NOT EXISTS (
                    SELECT 1 FROM protocol_approval_logs pal
                    WHERE pal.protocol_id = pa.protocol_id
                      AND pal.approver_id = pa.user_id
                      AND pal.status = 'approved'
                  )
            `, [protocolId]);

            // إذا اكتمل الاعتماد، تحديث حالة المحضر
            if (remainingApprovers[0].count === 0 && approved) {
                await connection.execute(`
                    UPDATE protocols 
                    SET is_approved = 1, approval_status = 'approved', approved_by = ?, updated_at = NOW()
                    WHERE id = ?
                `, [approverId, protocolId]);
            }

            await connection.commit();
            return { 
                success: true, 
                message: 'تم التوقيع بنجاح',
                isComplete: remainingApprovers[0].count === 0
            };
        } catch (error) {
            await connection.rollback();
            console.error('Error handling approval:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    // جلب سجل الاعتمادات للمحضر
    async getApprovalLogs(protocolId) {
        try {
            const [rows] = await this.pool.execute(`
                SELECT 
                    pal.id,
                    pal.protocol_id,
                    pal.approver_id,
                    pal.delegated_by,
                    pal.signed_as_proxy,
                    pal.status,
                    pal.signature,
                    pal.electronic_signature,
                    pal.comments,
                    pal.created_at,
                    CONCAT(
                        COALESCE(u.first_name, ''),
                        CASE WHEN u.second_name IS NOT NULL AND u.second_name != '' THEN CONCAT(' ', u.second_name) ELSE '' END,
                        CASE WHEN u.third_name IS NOT NULL AND u.third_name != '' THEN CONCAT(' ', u.third_name) ELSE '' END,
                        CASE WHEN u.last_name IS NOT NULL AND u.last_name != '' THEN CONCAT(' ', u.last_name) ELSE '' END
                    ) AS approver_name,
                    u.national_id AS approver_id_number,
                    jt.title AS approver_job_title,
                    u.department_id AS approver_department_id,
                    d.name AS approver_department_name
                FROM protocol_approval_logs pal
                LEFT JOIN users u ON pal.approver_id = u.id
                LEFT JOIN departments d ON u.department_id = d.id
                LEFT JOIN job_titles jt ON u.job_title_id = jt.id
                WHERE pal.protocol_id = ?
                ORDER BY pal.created_at ASC
            `, [protocolId]);

            return rows;
        } catch (error) {
            console.error('Error getting approval logs:', error);
            throw error;
        }
    }

    // تحديث مسار ملف PDF
    async updatePdfPath(protocolId, filePath) {
        try {
            await this.pool.execute(
                'UPDATE protocols SET file_path = ? WHERE id = ?',
                [filePath, protocolId]
            );
            return { success: true, message: 'تم تحديث مسار الملف بنجاح' };
        } catch (error) {
            console.error('Error updating PDF path:', error);
            throw error;
        }
    }
}

module.exports = new ProtocolModel();
