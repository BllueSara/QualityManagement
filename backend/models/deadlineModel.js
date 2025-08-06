const mysql = require('mysql2/promise');

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'Quality'
});

// إنشاء جدول المواعيد النهائية إذا لم يكن موجوداً
async function createDeadlinesTable() {
  try {
    // أولاً، تحقق من وجود الجدول
    const [tables] = await db.execute(`SHOW TABLES LIKE 'content_deadlines'`);
    
    if (tables.length === 0) {
      // إنشاء الجدول الجديد
      await db.execute(`
        CREATE TABLE content_deadlines (
          id INT AUTO_INCREMENT PRIMARY KEY,
          content_id VARCHAR(50) NOT NULL,
          content_type ENUM('department', 'committee') NOT NULL,
          approver_id INT NOT NULL,
          deadline_date DATETIME NOT NULL,
          status ENUM('active', 'expired', 'completed') DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_content (content_id, content_type),
          INDEX idx_approver (approver_id),
          INDEX idx_status (status),
          INDEX idx_deadline (deadline_date)
        )
      `);
      console.log('تم إنشاء جدول content_deadlines بنجاح');
    } else {
      console.log('جدول content_deadlines موجود بالفعل');
      // تحقق من نوع البيانات في العمود content_id
      try {
        const [columns] = await db.execute(`DESCRIBE content_deadlines`);
        
        const contentIdColumn = columns.find(col => col.Field === 'content_id');
        
        if (contentIdColumn && contentIdColumn.Type.includes('int')) {
          // تغيير نوع البيانات من INT إلى VARCHAR
          await db.execute(`ALTER TABLE content_deadlines MODIFY COLUMN content_id VARCHAR(50) NOT NULL`);
          console.log('تم تحديث نوع البيانات للعمود content_id');
        }
      } catch (alterError) {
        console.log('لا حاجة لتحديث هيكل الجدول:', alterError.message);
      }
    }
  } catch (error) {
    // إذا كان الخطأ بسبب وجود الجدول بالفعل، تجاهل الخطأ
    if (error.code === 'ER_TABLE_EXISTS_ERROR') {
      console.log('جدول content_deadlines موجود بالفعل');
      return;
    }
    console.error('Error creating/updating deadlines table:', error);
    throw error;
  }
}

// إضافة موعد نهائي جديد
async function addDeadline(contentId, contentType, approverId, deadlineDate) {
  try {
    // تحويل contentId إلى نص إذا كان رقم
    const contentIdStr = String(contentId);
    
    const [result] = await db.execute(
      `INSERT INTO content_deadlines 
       (content_id, content_type, approver_id, deadline_date)
       VALUES (?, ?, ?, ?)`,
      [contentIdStr, contentType, approverId, deadlineDate]
    );
    
    return result.insertId;
  } catch (error) {
    console.error('Error adding deadline:', error);
    throw error;
  }
}

// جلب المواعيد النهائية لمحتوى معين
async function getDeadlinesByContent(contentId, contentType) {
  try {
    // تحويل contentId إلى نص إذا كان رقم
    const contentIdStr = String(contentId);
    
    const [rows] = await db.execute(
      `SELECT cd.*, u.username, u.email, d.name as department_name,
              CASE 
                WHEN cd.content_type = 'department' THEN COALESCE(c.title, 'محتوى قسم غير محدد')
                WHEN cd.content_type = 'committee' THEN COALESCE(cc.title, 'محتوى لجنة غير محدد')
                ELSE 'محتوى غير محدد'
              END as content_title,
              CASE 
                WHEN cd.content_type = 'department' THEN COALESCE(dept.name, 'قسم غير محدد')
                WHEN cd.content_type = 'committee' THEN COALESCE(com.name, 'لجنة غير محددة')
                ELSE 'مصدر غير محدد'
              END as source_name,
              CASE 
                WHEN cd.content_type = 'department' THEN COALESCE(dept.name, 'قسم غير محدد')
                WHEN cd.content_type = 'committee' THEN COALESCE(com.name, 'لجنة غير محددة')
                ELSE 'مصدر غير محدد'
              END as department_or_committee_name,
              CASE 
                WHEN cd.content_type = 'department' THEN COALESCE(dept.type, 'نوع غير محدد')
                WHEN cd.content_type = 'committee' THEN NULL
                ELSE NULL
              END as content_type_name
       FROM content_deadlines cd
       JOIN users u ON cd.approver_id = u.id
       LEFT JOIN departments d ON u.department_id = d.id
       LEFT JOIN contents c ON (REPLACE(cd.content_id, 'dept-', '') = c.id AND cd.content_type = 'department')
       LEFT JOIN committee_contents cc ON (REPLACE(cd.content_id, 'comm-', '') = cc.id AND cd.content_type = 'committee')
       LEFT JOIN folders f ON c.folder_id = f.id
       LEFT JOIN departments dept ON f.department_id = dept.id
       LEFT JOIN committee_folders cf ON cc.folder_id = cf.id
       LEFT JOIN committees com ON cf.committee_id = com.id
       WHERE cd.content_id = ? AND cd.content_type = ?
       ORDER BY cd.deadline_date ASC`,
      [contentIdStr, contentType]
    );
    return rows;
  } catch (error) {
    console.error('Error getting deadlines by content:', error);
    throw error;
  }
}

// جلب المواعيد النهائية المنتهية الصلاحية
async function getExpiredDeadlines() {
  try {
    // المواعيد محفوظة بتوقيت UTC، لذا نقارن مع الوقت الحالي مباشرة
    const [rows] = await db.execute(
      `SELECT cd.*, u.username, u.email, d.name as department_name,
              CASE 
                WHEN cd.content_type = 'department' THEN COALESCE(c.title, 'محتوى قسم غير محدد')
                WHEN cd.content_type = 'committee' THEN COALESCE(cc.title, 'محتوى لجنة غير محدد')
                ELSE 'محتوى غير محدد'
              END as content_title,
              CASE 
                WHEN cd.content_type = 'department' THEN COALESCE(dept.name, 'قسم غير محدد')
                WHEN cd.content_type = 'committee' THEN COALESCE(com.name, 'لجنة غير محددة')
                ELSE 'مصدر غير محدد'
              END as source_name,
              CASE 
                WHEN cd.content_type = 'department' THEN COALESCE(dept.name, 'قسم غير محدد')
                WHEN cd.content_type = 'committee' THEN COALESCE(com.name, 'لجنة غير محددة')
                ELSE 'مصدر غير محدد'
              END as department_or_committee_name,
                            CASE 
                WHEN cd.content_type = 'department' THEN COALESCE(dept.type, 'نوع غير محدد')
                WHEN cd.content_type = 'committee' THEN NULL
                ELSE NULL
              END as content_type_name
        FROM content_deadlines cd
        JOIN users u ON cd.approver_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN contents c ON (REPLACE(cd.content_id, 'dept-', '') = c.id AND cd.content_type = 'department')
        LEFT JOIN committee_contents cc ON (REPLACE(cd.content_id, 'comm-', '') = cc.id AND cd.content_type = 'committee')
        LEFT JOIN folders f ON c.folder_id = f.id
        LEFT JOIN departments dept ON f.department_id = dept.id
        LEFT JOIN committee_folders cf ON cc.folder_id = cf.id
        LEFT JOIN committees com ON cf.committee_id = com.id
        WHERE cd.status = 'active' AND cd.deadline_date < NOW()`
    );
    
    return rows;
  } catch (error) {
    console.error('Error getting expired deadlines:', error);
    throw error;
  }
}

// تحديث حالة الموعد النهائي
async function updateDeadlineStatus(deadlineId, status) {
  try {
    await db.execute(
      `UPDATE content_deadlines 
       SET status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, deadlineId]
    );
  } catch (error) {
    console.error('Error updating deadline status:', error);
    throw error;
  }
}

// حذف المواعيد النهائية لمحتوى معين
async function deleteDeadlinesByContent(contentId, contentType) {
  try {
    // تحويل contentId إلى نص إذا كان رقم
    const contentIdStr = String(contentId);
    
    await db.execute(
      `DELETE FROM content_deadlines 
       WHERE content_id = ? AND content_type = ?`,
      [contentIdStr, contentType]
    );
  } catch (error) {
    console.error('Error deleting deadlines by content:', error);
    throw error;
  }
}

// جلب المواعيد النهائية النشطة لمستخدم معين
async function getActiveDeadlinesByUser(userId) {
  try {
    const [rows] = await db.execute(
      `SELECT cd.*, 
              CASE 
                WHEN cd.content_type = 'department' THEN c.title
                WHEN cd.content_type = 'committee' THEN cc.title
                ELSE '-'
              END as content_title,
              CASE 
                WHEN cd.content_type = 'department' THEN COALESCE(dept.name, '-')
                WHEN cd.content_type = 'committee' THEN COALESCE(com.name, '-')
                ELSE '-'
              END as source_name,
              CASE 
                WHEN cd.content_type = 'department' THEN COALESCE(dept.name, 'قسم غير محدد')
                WHEN cd.content_type = 'committee' THEN COALESCE(com.name, 'لجنة غير محددة')
                ELSE 'مصدر غير محدد'
              END as department_or_committee_name,
                            CASE 
                WHEN cd.content_type = 'department' THEN COALESCE(dept.type, 'نوع غير محدد')
                WHEN cd.content_type = 'committee' THEN NULL
                ELSE NULL
              END as content_type_name
        FROM content_deadlines cd
        LEFT JOIN contents c ON (REPLACE(cd.content_id, 'dept-', '') = c.id AND cd.content_type = 'department')
        LEFT JOIN committee_contents cc ON (REPLACE(cd.content_id, 'comm-', '') = cc.id AND cd.content_type = 'committee')
        LEFT JOIN folders f ON c.folder_id = f.id
        LEFT JOIN departments dept ON f.department_id = dept.id
        LEFT JOIN committee_folders cf ON cc.folder_id = cf.id
        LEFT JOIN committees com ON cf.committee_id = com.id
        WHERE cd.approver_id = ? AND cd.status = 'active'
        ORDER BY cd.deadline_date ASC`,
      [userId]
    );
    return rows;
  } catch (error) {
    console.error('Error getting active deadlines by user:', error);
    throw error;
  }
}

module.exports = {
  createDeadlinesTable,
  addDeadline,
  getDeadlinesByContent,
  getExpiredDeadlines,
  updateDeadlineStatus,
  deleteDeadlinesByContent,
  getActiveDeadlinesByUser
}; 