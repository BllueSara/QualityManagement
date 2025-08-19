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
                    protocol_time TIME,
                    room VARCHAR(200),
                    department_id INT,
                    folder_id INT,
                    committee_id INT,
                    created_by INT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    status ENUM('active', 'inactive', 'deleted') DEFAULT 'active',
                    approval_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
                    is_approved BOOLEAN DEFAULT FALSE,
                    approved_by INT,
                    file_path VARCHAR(500),
                    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
                    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
                    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL,
                    FOREIGN KEY (committee_id) REFERENCES committees(id) ON DELETE SET NULL
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
                    recommendations TEXT,
                    responsibility VARCHAR(200),
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

            // جدول المناقشات الجانبية
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS protocol_side_discussions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    topic_id INT NOT NULL,
                    content TEXT NOT NULL,
                    duration VARCHAR(100),
                    end_date DATE,
                    recommendations TEXT,
                    responsibility VARCHAR(200),
                    discussion_order INT DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (topic_id) REFERENCES protocol_topics(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);

            console.log('Protocol tables initialized successfully');

            // إضافة الأعمدة الجديدة للجداول الموجودة مسبقاً
            try {
                // إضافة الأعمدة الجديدة لجدول protocols إذا لم تكن موجودة
                try {
                    await this.pool.execute(`ALTER TABLE protocols ADD COLUMN protocol_time TIME`);
                    console.log('Added protocol_time column to protocols table');
                } catch (error) {
                    if (error.code === 'ER_DUP_FIELDNAME') {
                        console.log('protocol_time column already exists in protocols table');
                    } else {
                        throw error;
                    }
                }

                try {
                    await this.pool.execute(`ALTER TABLE protocols ADD COLUMN room VARCHAR(200)`);
                    console.log('Added room column to protocols table');
                } catch (error) {
                    if (error.code === 'ER_DUP_FIELDNAME') {
                        console.log('room column already exists in protocols table');
                    } else {
                        throw error;
                    }
                }

                // إضافة الأعمدة الجديدة لجدول protocol_topics إذا لم تكن موجودة
                try {
                    await this.pool.execute(`ALTER TABLE protocol_topics ADD COLUMN recommendations TEXT`);
                    console.log('Added recommendations column to protocol_topics table');
                } catch (error) {
                    if (error.code === 'ER_DUP_FIELDNAME') {
                        console.log('recommendations column already exists in protocol_topics table');
                    } else {
                        throw error;
                    }
                }

                try {
                    await this.pool.execute(`ALTER TABLE protocol_topics ADD COLUMN responsibility VARCHAR(200)`);
                    console.log('Added responsibility column to protocol_topics table');
                } catch (error) {
                    if (error.code === 'ER_DUP_FIELDNAME') {
                        console.log('responsibility column already exists in protocol_topics table');
                    } else {
                        throw error;
                    }
                }

                // إضافة الأعمدة الجديدة لجدول protocol_side_discussions إذا لم تكن موجودة
                try {
                    await this.pool.execute(`ALTER TABLE protocol_side_discussions ADD COLUMN recommendations TEXT`);
                    console.log('Added recommendations column to protocol_side_discussions table');
                } catch (error) {
                    if (error.code === 'ER_DUP_FIELDNAME') {
                        console.log('recommendations column already exists in protocol_side_discussions table');
                    } else {
                        throw error;
                    }
                }

                try {
                    await this.pool.execute(`ALTER TABLE protocol_side_discussions ADD COLUMN responsibility VARCHAR(200)`);
                    console.log('Added responsibility column to protocol_side_discussions table');
                } catch (error) {
                    if (error.code === 'ER_DUP_FIELDNAME') {
                        console.log('responsibility column already exists in protocol_side_discussions table');
                    } else {
                        throw error;
                    }
                }

                console.log('New columns added to existing tables successfully');
            } catch (alterError) {
                console.log('Error adding new columns:', alterError.message);
            }
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
                'INSERT INTO protocols (title, protocol_date, protocol_time, room, department_id, folder_id, committee_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    protocolData.protocolTitle, 
                    protocolData.protocolDate,
                    protocolData.protocolTime || null,
                    protocolData.room || null,
                    (protocolData.assignmentType === 'department' || protocolData.assignmentType === 'both') ? (protocolData.departmentId || null) : null,
                    protocolData.folderId || null,
                    (protocolData.assignmentType === 'committee' || protocolData.assignmentType === 'both') ? (protocolData.committeeId || null) : null,
                    userId
                ]
            );

            const protocolId = protocolResult.insertId;

            // إدراج مواضيع المحضر
            if (protocolData.topics && protocolData.topics.length > 0) {
                for (let i = 0; i < protocolData.topics.length; i++) {
                    const topic = protocolData.topics[i];
                    const [topicResult] = await connection.execute(
                        'INSERT INTO protocol_topics (protocol_id, subject, discussion, duration, end_date, recommendations, responsibility, topic_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                        [
                            protocolId,
                            topic.subject,
                            topic.discussion,
                            topic.duration || null,
                            topic.endDate || null,
                            topic.recommendations || null,
                            topic.responsibility || null,
                            i + 1
                        ]
                    );

                    const topicId = topicResult.insertId;

                    // إدراج المناقشات الجانبية للموضوع
                    if (topic.sideDiscussions && Array.isArray(topic.sideDiscussions) && topic.sideDiscussions.length > 0) {
                        for (let j = 0; j < topic.sideDiscussions.length; j++) {
                            const sideDiscussion = topic.sideDiscussions[j];
                            if (sideDiscussion.content && sideDiscussion.content.trim()) {
                                await connection.execute(
                                    'INSERT INTO protocol_side_discussions (topic_id, content, duration, end_date, recommendations, responsibility, discussion_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
                                    [
                                        topicId,
                                        sideDiscussion.content.trim(),
                                        sideDiscussion.duration || null,
                                        sideDiscussion.endDate || null,
                                        sideDiscussion.recommendations || null,
                                        sideDiscussion.responsibility || null,
                                        j + 1
                                    ]
                                );
                            }
                        }
                    }
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
            // جلب معلومات المستخدم وصلاحياته
            const [userInfo] = await this.pool.execute(`
                SELECT role, department_id FROM users WHERE id = ?
            `, [userId]);

            if (userInfo.length === 0) {
                throw new Error('المستخدم غير موجود');
            }

            const userRole = userInfo[0].role;
            const userDepartmentId = userInfo[0].department_id;

            let query = `
                SELECT 
                    p.id,
                    p.title,
                    p.protocol_date,
                    p.created_at,
                    p.status,
                    p.approval_status,
                    p.is_approved,
                    p.department_id,
                    p.folder_id,
                    p.committee_id,
                    d.name as department_name,
                    f.name as folder_name,
                    c.name as committee_name,
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
                LEFT JOIN departments d ON p.department_id = d.id
                LEFT JOIN folders f ON p.folder_id = f.id
                LEFT JOIN committees c ON p.committee_id = c.id
                LEFT JOIN protocol_topics pt ON p.id = pt.protocol_id
                WHERE p.deleted_at IS NULL
            `;

            const params = [];

            // إذا لم يكن المستخدم أدمن، يرى المحاضر التي رفعها أو هو معتمد عليها
            if (userRole !== 'admin') {
                query += ` AND (
                    p.created_by = ? OR 
                    EXISTS (
                        SELECT 1 FROM protocol_approvers pa 
                        WHERE pa.protocol_id = p.id AND pa.user_id = ?
                    )
                )`;
                params.push(userId, userId);
            }

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
            // جلب معلومات المستخدم وصلاحياته
            const [userInfo] = await this.pool.execute(`
                SELECT role, department_id FROM users WHERE id = ?
            `, [userId]);

            if (userInfo.length === 0) {
                throw new Error('المستخدم غير موجود');
            }

            const userRole = userInfo[0].role;
            const userDepartmentId = userInfo[0].department_id;

            // جلب بيانات المحضر
            let query = `
                SELECT 
                    p.id, p.title, 
                    DATE_FORMAT(p.protocol_date, '%Y-%m-%d') as protocol_date,
                    COALESCE(p.protocol_time, '') as protocol_time,
                    COALESCE(p.room, '') as room,
                    p.department_id,
                    p.folder_id,
                    p.committee_id,
                    p.created_by, p.created_at, p.updated_at, p.status, p.approval_status,
                    p.is_approved, p.approved_by, p.file_path,
                    d.name as department_name,
                    f.name as folder_name,
                    c.name as committee_name,
                    CONCAT(
                        COALESCE(u.first_name, ''),
                        CASE WHEN u.second_name IS NOT NULL AND u.second_name != '' THEN CONCAT(' ', u.second_name) ELSE '' END,
                        CASE WHEN u.third_name IS NOT NULL AND u.third_name != '' THEN CONCAT(' ', u.third_name) ELSE '' END,
                        CASE WHEN u.last_name IS NOT NULL AND u.last_name != '' THEN CONCAT(' ', u.last_name) ELSE '' END
                    ) as created_by_name
                FROM protocols p
                LEFT JOIN users u ON p.created_by = u.id
                LEFT JOIN departments d ON p.department_id = d.id
                LEFT JOIN folders f ON p.folder_id = f.id
                LEFT JOIN committees c ON p.committee_id = c.id
                WHERE p.id = ? AND p.deleted_at IS NULL
            `;

            const params = [protocolId];

            // إذا لم يكن المستخدم أدمن، يرى المحاضر التي رفعها أو هو معتمد عليها
            if (userRole !== 'admin') {
                query += ` AND (
                    p.created_by = ? OR 
                    EXISTS (
                        SELECT 1 FROM protocol_approvers pa 
                        WHERE pa.protocol_id = p.id AND pa.user_id = ?
                    )
                )`;
                params.push(userId, userId);
            }

            const [protocols] = await this.pool.execute(query, params);

            if (protocols.length === 0) {
                return null;
            }

            const protocol = protocols[0];

            // جلب مواضيع المحضر مع المناقشات الجانبية
            const [topics] = await this.pool.execute(
                `SELECT 
                    id, protocol_id, subject, discussion, duration, end_date, 
                    COALESCE(recommendations, '') as recommendations,
                    COALESCE(responsibility, '') as responsibility,
                    topic_order, created_at, updated_at
                FROM protocol_topics WHERE protocol_id = ? ORDER BY topic_order`,
                [protocolId]
            );

            // جلب المناقشات الجانبية لكل موضوع
            for (let topic of topics) {
                const [sideDiscussions] = await this.pool.execute(
                    `SELECT 
                        id, topic_id, content, duration, end_date,
                        COALESCE(recommendations, '') as recommendations,
                        COALESCE(responsibility, '') as responsibility,
                        discussion_order, created_at, updated_at
                    FROM protocol_side_discussions WHERE topic_id = ? ORDER BY discussion_order`,
                    [topic.id]
                );
                topic.sideDiscussions = sideDiscussions;
            }

            // جلب معتمدي المحضر
            const [approvers] = await this.pool.execute(
                `SELECT 
                    pa.*,
                    CONCAT(
                        COALESCE(u.first_name, ''),
                        CASE WHEN u.second_name IS NOT NULL AND u.second_name != '' THEN CONCAT(' ', u.second_name) ELSE '' END,
                        CASE WHEN u.third_name IS NOT NULL AND u.third_name != '' THEN CONCAT(' ', u.third_name) ELSE '' END,
                        CASE WHEN u.last_name IS NOT NULL AND u.last_name != '' THEN CONCAT(' ', u.last_name) ELSE '' END
                    ) as approver_name,
                    u.first_name,
                    u.second_name,
                    u.third_name,
                    u.last_name,
                    jt.title as job_title,
                    jn.name as job_name
                FROM protocol_approvers pa
                LEFT JOIN users u ON pa.user_id = u.id
                LEFT JOIN job_titles jt ON u.job_title_id = jt.id
                LEFT JOIN job_names jn ON u.job_name_id = jn.id
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
                'SELECT id FROM protocols WHERE id = ? AND deleted_at IS NULL',
                [protocolId]
            );

            if (existingProtocol.length === 0) {
                throw new Error('المحضر غير موجود');
            }

            // إعادة تعيين حالة المحضر ليعود لمرحلة الاعتماد من جديد
            await connection.execute(
                'UPDATE protocols SET title = ?, protocol_date = ?, protocol_time = ?, room = ?, department_id = ?, folder_id = ?, committee_id = ?, is_approved = 0, approval_status = "pending", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [
                    protocolData.protocolTitle, 
                    protocolData.protocolDate,
                    protocolData.protocolTime || null,
                    protocolData.room || null,
                    (protocolData.assignmentType === 'department' || protocolData.assignmentType === 'both') ? (protocolData.departmentId || null) : null,
                    protocolData.folderId || null,
                    (protocolData.assignmentType === 'committee' || protocolData.assignmentType === 'both') ? (protocolData.committeeId || null) : null,
                    protocolId
                ]
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
                    const [topicResult] = await connection.execute(
                        'INSERT INTO protocol_topics (protocol_id, subject, discussion, duration, end_date, recommendations, responsibility, topic_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                        [
                            protocolId,
                            topic.subject,
                            topic.discussion,
                            topic.duration || null,
                            topic.endDate || null,
                            topic.recommendations || null,
                            topic.responsibility || null,
                            i + 1
                        ]
                    );

                    const topicId = topicResult.insertId;

                    // إدراج المناقشات الجانبية للموضوع
                    if (topic.sideDiscussions && Array.isArray(topic.sideDiscussions) && topic.sideDiscussions.length > 0) {
                        for (let j = 0; j < topic.sideDiscussions.length; j++) {
                            const sideDiscussion = topic.sideDiscussions[j];
                            if (sideDiscussion.content && sideDiscussion.content.trim()) {
                                await connection.execute(
                                    'INSERT INTO protocol_side_discussions (topic_id, content, duration, end_date, recommendations, responsibility, discussion_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
                                    [
                                        topicId,
                                        sideDiscussion.content.trim(),
                                        sideDiscussion.duration || null,
                                        sideDiscussion.endDate || null,
                                        sideDiscussion.recommendations || null,
                                        sideDiscussion.responsibility || null,
                                        j + 1
                                    ]
                                );
                            }
                        }
                    }
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

    // حذف محضر (soft delete)
    async deleteProtocol(protocolId, userId) {
        try {
            const [result] = await this.pool.execute(
                'UPDATE protocols SET deleted_at = NOW(), deleted_by = ? WHERE id = ? AND deleted_at IS NULL',
                [userId, protocolId]
            );

            if (result.affectedRows === 0) {
                throw new Error('المحضر غير موجود');
            }

            return { success: true, message: 'تم حذف المحضر بنجاح' };
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
                WHERE deleted_at IS NULL AND created_by = ?
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
                  AND p.deleted_at IS NULL
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
                WHERE pal.protocol_id = ? AND pal.status != 'sender_signature'
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

    // جلب المحاضر المرتبطة بمجلد معين
    async getProtocolsByFolder(folderId, userId) {
        try {
            // جلب معلومات المستخدم وصلاحياته
            const [userInfo] = await this.pool.execute(`
                SELECT role, department_id FROM users WHERE id = ?
            `, [userId]);

            if (userInfo.length === 0) {
                throw new Error('المستخدم غير موجود');
            }

            const userRole = userInfo[0].role;
            const userDepartmentId = userInfo[0].department_id;

            let query = `
                SELECT 
                    p.id,
                    p.title,
                    p.protocol_date,
                    p.created_at,
                    p.status,
                    p.approval_status,
                    p.is_approved,
                    p.file_path,
                    p.department_id,
                    p.committee_id,
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
                WHERE p.folder_id = ? AND p.deleted_at IS NULL
            `;

            const params = [folderId];

            // إذا لم يكن المستخدم أدمن، يرى المحاضر التي رفعها أو هو معتمد عليها
            if (userRole !== 'admin') {
                query += ` AND (
                    p.created_by = ? OR 
                    EXISTS (
                        SELECT 1 FROM protocol_approvers pa 
                        WHERE pa.protocol_id = p.id AND pa.user_id = ?
                    )
                )`;
                params.push(userId, userId);
            }

            query += ` GROUP BY p.id ORDER BY p.created_at DESC`;

            const [protocols] = await this.pool.execute(query, params);

            return protocols;
        } catch (error) {
            console.error('Error getting protocols by folder:', error);
            throw error;
        }
    }
}

module.exports = new ProtocolModel();
