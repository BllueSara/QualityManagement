DROP DATABASE IF EXISTS Quality;
CREATE DATABASE Quality;
USE Quality;

-- 1. جدول الأقسام (departments)
CREATE TABLE departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    image VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
-- 2. جدول المستخدمين (users)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    department_id INT,
   role ENUM('admin','sub-admin','user') NOT NULL DEFAULT 'user',
    reset_token VARCHAR(128) NULL,
    reset_token_expires DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 3. جدول المجلدات (folders)
CREATE TABLE folders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    department_id INT NOT NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 4. جدول المحتويات (contents)
CREATE TABLE contents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    notes TEXT,
    folder_id INT NOT NULL,
    created_by INT NOT NULL,
    approval_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    approvers_required JSON,
    approvals_log JSON,
    is_approved BOOLEAN DEFAULT FALSE,
    approved_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 5. جدول سجل الموافقات (approval_logs)
CREATE TABLE approval_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    content_id INT NOT NULL,
    approver_id INT NOT NULL,
    status ENUM('pending', 'approved', 'rejected') NOT NULL,
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (content_id) REFERENCES contents(id) ON DELETE CASCADE,
    FOREIGN KEY (approver_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- صلاحيات النظام
CREATE TABLE permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  permission_key VARCHAR(100) NOT NULL UNIQUE,  -- بدل "key"
  description   VARCHAR(255)
);

-- جدول الربط بين المستخدم والصلاحيات
CREATE TABLE user_permissions (
  user_id       INT NOT NULL,
  permission_id INT NOT NULL,
  PRIMARY KEY (user_id, permission_id),
  INDEX idx_user (user_id),
  INDEX idx_perm (permission_id),
  FOREIGN KEY (user_id)       REFERENCES users(id)       ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);
-- إدراج كل الصلاحيات دفعة وحدة
INSERT INTO permissions (permission_key, description) VALUES
  ('add_section',      'إضافة قسم'),
  ('edit_section',     'تعديل قسم'),
  ('delete_section',   'حذف قسم'),
  ('add_content',      'إضافة محتوى'),
  ('edit_content',     'تعديل محتوى'),
  ('delete_content',   'حذف محتوى'),
  ('transfer_tickets', 'تحويل تذاكر'),
  ('track_tickets',    'تتبع التذاكر'),
  ('transfer_credits', 'تحويل اعتمادات'),
  ('track_credits',    'تتبع اعتمادات'),
  ('sign',             'توقيع'),
  ('sign_on_behalf',   'توقيع بالنيابة'),
  ('view_tickets',     'عرض التذاكر'),
  ('view_credits',     'عرض الاعتمادات'),
  ('add_user',         'إضافة مستخدم'),
  ('change_role',      'تغيير الدور'),
  ('delete_user',      'حذف حساب'),
  ('change_password',  'تغيير كلمة السر');

INSERT INTO permissions (permission_key,description) VALUES
  ('add_folder','إضافة مجلد'),
  ('edit_folder','تعديل مجلد'),
  ('delete_folder','حذف مجلد');
INSERT INTO permissions (permission_key, description) VALUES
  ('edit_ticket',   'تعديل التذاكر'),
  ('delete_ticket', 'حذف التذاكر');

CREATE TABLE IF NOT EXISTS tickets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    event_date DATE NOT NULL,
    event_time ENUM('صباحاً', 'مساءً') NOT NULL,
    event_location VARCHAR(255) NOT NULL,
    reporting_dept_id INT NOT NULL,
    responding_dept_id INT NOT NULL,
    other_depts TEXT NOT NULL,
    patient_name VARCHAR(255),
    medical_record_no VARCHAR(50),
    dob DATE,
    gender ENUM('ذكر', 'أنثى'),
    report_type ENUM('حادث', 'حدث قابل للتبليغ', 'حدث جسيم', 'تنبيه خطأ', 'وضع غير آمن') NOT NULL,
    report_short_desc TEXT,
    event_description TEXT NOT NULL,
    reporter_name VARCHAR(255) NOT NULL,
    report_date DATE NOT NULL,
    reporter_position VARCHAR(255) NOT NULL,
    reporter_phone VARCHAR(20) NOT NULL,
    reporter_email VARCHAR(255) NOT NULL,
    actions_taken TEXT NOT NULL,
    had_injury ENUM('نعم', 'لا'),
    injury_type ENUM('جسدية', 'نفسية'),
    status ENUM('جديد', 'قيد المراجعة', 'تم الحل', 'مغلق') DEFAULT 'جديد',
    created_by INT NOT NULL,
    assigned_to INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (reporting_dept_id) REFERENCES departments(id),
    FOREIGN KEY (responding_dept_id) REFERENCES departments(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Create ticket classifications table
CREATE TABLE IF NOT EXISTS ticket_classifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    ticket_id INT NOT NULL,
    classification VARCHAR(255) NOT NULL,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Create ticket patient types table
CREATE TABLE IF NOT EXISTS ticket_patient_types (
    id INT PRIMARY KEY AUTO_INCREMENT,
    ticket_id INT NOT NULL,
    patient_type VARCHAR(255) NOT NULL,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Create ticket attachments table
CREATE TABLE IF NOT EXISTS ticket_attachments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    ticket_id INT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    path VARCHAR(255) NOT NULL,
    mimetype VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Create ticket status history table
CREATE TABLE IF NOT EXISTS ticket_status_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    ticket_id INT NOT NULL,
    status ENUM('جديد', 'قيد المراجعة', 'تم الحل', 'مغلق') NOT NULL,
    changed_by INT NOT NULL,
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- Create ticket assignments table
CREATE TABLE IF NOT EXISTS ticket_assignments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    ticket_id INT NOT NULL,
    assigned_to INT NOT NULL,
    assigned_by INT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
    comments TEXT,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    FOREIGN KEY (assigned_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci; 

DROP TABLE IF EXISTS ticket_replies;
CREATE TABLE IF NOT EXISTS ticket_replies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT NOT NULL,
  author_id INT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE tickets
  MODIFY status
    ENUM('جديد','قيد الإنتظار','تم الإرسال','قيد المراجعة','تم الحل','مغلق')
    DEFAULT 'جديد';

ALTER TABLE ticket_status_history
  MODIFY status
    ENUM('جديد','قيد الإنتظار','تم الإرسال','قيد المراجعة','تم الحل','مغلق')
    DEFAULT 'جديد';

-- جدول يربط المحتوى بالمعتمدين المطلوبين
CREATE TABLE content_approvers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  content_id INT NOT NULL,
  user_id INT NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (content_id) REFERENCES contents(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


ALTER TABLE approval_logs ADD signature LONGTEXT;
ALTER TABLE approval_logs ADD UNIQUE KEY unique_approver (content_id, approver_id);



ALTER TABLE approval_logs
ADD COLUMN signed_as_proxy TINYINT(1) DEFAULT 0 AFTER approver_id;

ALTER TABLE approval_logs
ADD COLUMN electronic_signature VARCHAR(255) NULL AFTER signature;

ALTER TABLE approval_logs
ADD COLUMN delegated_by INT NULL AFTER approver_id;

CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL, -- المستخدم المستهدف بالإشعار
  title VARCHAR(255) NOT NULL, -- عنوان الإشعار
  message TEXT NOT NULL, -- تفاصيل الإشعار
  is_read BOOLEAN DEFAULT FALSE, -- هل تم قراءة الإشعار
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


CREATE TABLE activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT, -- من قام بالنشاط
  action VARCHAR(255) NOT NULL, -- نوع الحدث (مثلاً: "تفويض", "توقيع", "إنشاء ملف")
  reference_type ENUM('content', 'folder', 'user', 'approval', 'notification') NOT NULL, -- نوع العنصر المتأثر
  reference_id INT NOT NULL, -- رقم العنصر المتأثر (مثل رقم الملف)
  description TEXT, -- تفاصيل إضافية
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- غيّر دور المستخدم صاحب المعرف 123 إلى admin
UPDATE users
SET role = 'admin',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 1;

INSERT INTO departments (name, image) VALUES
  ('الطوارئ الطبية',          'uploads/images/emergence.png'),
  ('خدمات الأسنان',           'uploads/images/dentals.jpeg'),
  ('التعقيم المركزي (CSSD)',  'uploads/images/cssd.jpeg'),
  ('رعاية التخدير',           'uploads/images/ans.jpg');

INSERT INTO permissions (permission_key, description) VALUES
  ('grant_permissions', 'منح الصلاحيات'),
  ('view_logs',         'عرض السجلات'),
  ('view_dashboard',    'عرض لوحة التحكم');

-- جدول اللجان
CREATE TABLE IF NOT EXISTS committees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    image VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- جدول مجلدات اللجان
CREATE TABLE IF NOT EXISTS committee_folders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    committee_id INT NOT NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (committee_id) REFERENCES committees(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- جدول محتويات مجلدات اللجان
CREATE TABLE IF NOT EXISTS committee_contents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    notes TEXT,
    folder_id INT NOT NULL,
    created_by INT NOT NULL,
    approval_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    approvers_required JSON,
    approvals_log JSON,
    is_approved BOOLEAN DEFAULT FALSE,
    approved_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (folder_id) REFERENCES committee_folders(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- جدول سجل موافقات محتويات اللجان
CREATE TABLE IF NOT EXISTS committee_approval_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    content_id INT NOT NULL,
    approver_id INT NOT NULL,
    status ENUM('pending', 'approved', 'rejected') NOT NULL,
    comments TEXT,
    signature LONGTEXT,
    signed_as_proxy TINYINT(1) DEFAULT 0,
    electronic_signature VARCHAR(255) NULL,
    delegated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (content_id) REFERENCES committee_contents(id) ON DELETE CASCADE,
    FOREIGN KEY (approver_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (delegated_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_approver (content_id, approver_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- جدول يربط محتويات اللجان بالمعتمدين المطلوبين (MISSING TABLE)
CREATE TABLE committee_content_approvers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  content_id INT NOT NULL,
  user_id INT NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (content_id) REFERENCES committee_contents(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
); 