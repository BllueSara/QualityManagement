

ALTER TABLE folders ADD COLUMN type ENUM('public', 'private', 'shared') DEFAULT 'public' NOT NULL;




     ALTER TABLE committee_approval_logs MODIFY status ENUM('pending','approved','rejected','accepted','sender_signature');
     ALTER TABLE approval_logs MODIFY status ENUM('pending','approved','rejected','accepted','sender_signature');
     
     
     
     
     -- تحديث جدول المحاضر لإضافة الأعمدة الجديدة
-- تشغيل هذا الملف في قاعدة البيانات لتحديث الجدول

-- إضافة الأعمدة الجديدة
ALTER TABLE protocols 
ADD COLUMN department_id INT AFTER protocol_date,
ADD COLUMN folder_id INT AFTER department_id,
ADD COLUMN committee_id INT AFTER folder_id;

-- إضافة المفاتيح الأجنبية
ALTER TABLE protocols 
ADD CONSTRAINT fk_protocols_department 
FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;

ALTER TABLE protocols 
ADD CONSTRAINT fk_protocols_folder 
FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL;

ALTER TABLE protocols 
ADD CONSTRAINT fk_protocols_committee 
FOREIGN KEY (committee_id) REFERENCES committees(id) ON DELETE SET NULL;

-- التحقق من التحديث
DESCRIBE protocols;

ALTER TABLE protocols 
ADD COLUMN assignment_type ENUM('department', 'committee', 'both') DEFAULT 'department' AFTER committee_id;
