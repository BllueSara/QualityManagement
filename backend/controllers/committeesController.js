const mysql = require('mysql2/promise');
const multer = require('multer');
const jwt = require('jsonwebtoken');

const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'Quality'
});

// Helper for notifications, logs, etc. (implement as needed)
// const { insertNotification } = require('../models/notfications-utils');
 const { logAction } = require('../models/logger');

// دالة مساعدة لاستخراج اسم اللجنة باللغة المناسبة
function getCommitteeNameByLanguage(committeeNameData, userLanguage = 'ar') {
    try {
        // إذا كان الاسم JSON يحتوي على اللغتين
        if (typeof committeeNameData === 'string' && committeeNameData.startsWith('{')) {
            const parsed = JSON.parse(committeeNameData);
            return parsed[userLanguage] || parsed['ar'] || committeeNameData;
        }
        // إذا كان نص عادي
        return committeeNameData || 'غير معروف';
    } catch (error) {
        // في حالة فشل التحليل، إرجاع النص كما هو
        return committeeNameData || 'غير معروف';
    }
}

// دالة مساعدة لاستخراج لغة المستخدم من التوكن
function getUserLanguageFromToken(token) {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return decoded.language || 'ar'; // افتراضي عربي
    } catch (error) {
        return 'ar'; // افتراضي عربي
    }
}

// ========== Committees CRUD ==========
exports.getCommittees = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM committees');
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ message: 'خطأ في جلب اللجان', error });
    }
};

exports.getCommittee = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM committees WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'اللجنة غير موجودة' });
        res.status(200).json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'خطأ في جلب اللجنة', error });
    }
};

exports.addCommittee = async (req, res) => {
    try {
      const { name } = req.body;
      const imagePath = req.file ? req.file.path.replace(/\\/g, '/') : null;
  
      if (!name || !imagePath) {
        return res.status(400).json({ message: 'اسم اللجنة والصورة مطلوبان' });
      }
  
      const [exists] = await db.execute('SELECT id FROM committees WHERE name = ?', [name]);
      if (exists.length > 0) {
        return res.status(409).json({ message: 'هذه اللجنة موجودة بالفعل' });
      }
  
      const [result] = await db.execute('INSERT INTO committees (name, image) VALUES (?, ?)', [name, imagePath]);
      const committeeId = result.insertId;
  
      // ✅ استخراج userId من التوكن
      const token = req.headers.authorization?.split(' ')[1];
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;
  
        // ✅ تسجيل اللوق قبل الرد
        await logAction(
          userId,
          'add_committee',
          `تمت إضافة لجنة جديدة: ${name}`,
          'committee',
          committeeId
        );
      }
  
      // ✅ الآن نرد على العميل
      res.status(201).json({ message: 'تم إضافة اللجنة بنجاح', committeeId });
  
    } catch (error) {
      console.error('Error in addCommittee:', error);
      res.status(500).json({ message: 'خطأ في إضافة اللجنة' });
    }
  };
  

  exports.updateCommittee = async (req, res) => {
    try {
      const { id } = req.params;
      const { name } = req.body;
      const imagePath = req.file ? req.file.path.replace(/\\/g, '/') : null;
  
      if (!name) {
        return res.status(400).json({ message: 'اسم اللجنة مطلوب' });
      }
  
      let query = 'UPDATE committees SET name = ?';
      let params = [name];
  
      if (imagePath) {
        query += ', image = ?';
        params.push(imagePath);
      }
  
      query += ', updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      params.push(id);
  
      const [result] = await db.execute(query, params);
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'اللجنة غير موجودة' });
      }
  
      // استخراج userId من التوكن
      const token = req.headers.authorization?.split(' ')[1];
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;
  
        try {
          await logAction(
            userId,
            'update_committee',
            `تم تعديل اللجنة: ${name}`,
            'committee',
            id
          );
        } catch (logErr) {
          console.error('logAction error:', logErr);
        }
      }
  
      res.status(200).json({ message: 'تم تعديل اللجنة بنجاح' });
  
    } catch (error) {
      console.error('updateCommittee error:', error);
      res.status(500).json({ message: 'خطأ في تعديل اللجنة', error });
    }
  };
  

exports.deleteCommittee = async (req, res) => {
    try {
        const { id } = req.params;
        // Check for related folders/contents
        const [related] = await db.execute('SELECT COUNT(*) as count FROM committee_folders f JOIN committee_contents c ON f.id = c.folder_id WHERE f.committee_id = ?', [id]);
        if (related[0].count > 0) return res.status(400).json({ message: 'لا يمكن حذف اللجنة لوجود محتويات مرتبطة بها' });
        const [result] = await db.execute('DELETE FROM committees WHERE id = ?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'اللجنة غير موجودة' });
        res.status(200).json({ message: 'تم حذف اللجنة بنجاح' });
    } catch (error) {
        res.status(500).json({ message: 'خطأ في حذف اللجنة', error });
    }
};

// ========== Folders CRUD ==========
exports.getFolders = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM committee_folders WHERE committee_id = ?', [req.params.committeeId]);
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ message: 'خطأ في جلب المجلدات', error });
    }
};

exports.getFolder = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM committee_folders WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'المجلد غير موجود' });
        res.status(200).json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'خطأ في جلب المجلد', error });
    }
};

exports.addFolder = async (req, res) => {
    try {
        const { name } = req.body;
        const { committeeId } = req.params;
        // استخرج userId من التوكن
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ message: 'مطلوب تسجيل الدخول' });
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const created_by = decoded.id;

        if (!name || !created_by) return res.status(400).json({ message: 'اسم المجلد ومعرّف المنشئ مطلوبان' });
        
        // جلب اسم اللجنة باللغة المناسبة
        let committeeName = '';
        const [comRows] = await db.execute('SELECT name FROM committees WHERE id = ?', [committeeId]);
        if (comRows.length > 0) {
            const userLanguage = getUserLanguageFromToken(token);
            committeeName = getCommitteeNameByLanguage(comRows[0].name, userLanguage);
        }
        
        const [result] = await db.execute('INSERT INTO committee_folders (name, committee_id, created_by) VALUES (?, ?, ?)', [name, committeeId, created_by]);
        
        // ✅ تسجيل اللوق بعد نجاح إضافة المجلد
        try {
            const logDescription = committeeName 
                ? `تمت إضافة مجلد جديد: ${name} في لجنة: ${committeeName}`
                : `تمت إضافة مجلد جديد: ${name}`;
                
            await logAction(
                created_by,
                'add_folder',
                logDescription,
                'folder',
                result.insertId
            );
        } catch (logErr) {
            console.error('logAction error:', logErr);
        }
        
        res.status(201).json({ message: 'تم إضافة المجلد بنجاح', folderId: result.insertId });
    } catch (error) {
        res.status(500).json({ message: 'خطأ في إضافة المجلد', error });
    }
};

exports.updateFolder = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        if (!name) return res.status(400).json({ message: 'اسم المجلد مطلوب' });
        
        // جلب الاسم القديم وcommittee_id قبل التحديث
        const [oldNameRows] = await db.execute('SELECT name, committee_id FROM committee_folders WHERE id = ?', [id]);
        if (oldNameRows.length === 0) return res.status(404).json({ message: 'المجلد غير موجود' });
        const oldName = oldNameRows[0].name;
        const committeeId = oldNameRows[0].committee_id;
        
        // جلب اسم اللجنة باللغة المناسبة
        let committeeName = '';
        if (committeeId) {
            const [comRows] = await db.execute('SELECT name FROM committees WHERE id = ?', [committeeId]);
            if (comRows.length > 0) {
                const token = req.headers.authorization?.split(' ')[1];
                const userLanguage = token ? getUserLanguageFromToken(token) : 'ar';
                committeeName = getCommitteeNameByLanguage(comRows[0].name, userLanguage);
            }
        }
        
        const [result] = await db.execute('UPDATE committee_folders SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [name, id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'المجلد غير موجود' });
        
        // ✅ تسجيل اللوق بعد نجاح تعديل المجلد
        const token = req.headers.authorization?.split(' ')[1];
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.id;
            
            try {
                const logDescription = committeeName 
                    ? `تم تعديل مجلد من: ${oldName} إلى: ${name} في لجنة: ${committeeName}`
                    : `تم تعديل مجلد من: ${oldName} إلى: ${name}`;
                
                await logAction(
                    userId,
                    'update_folder',
                    logDescription,
                    'folder',
                    id
                );
            } catch (logErr) {
                console.error('logAction error:', logErr);
            }
        }
        
        res.status(200).json({ message: 'تم تعديل المجلد بنجاح' });
    } catch (error) {
        res.status(500).json({ message: 'خطأ في تعديل المجلد', error });
    }
};

exports.deleteFolder = async (req, res) => {
    try {
      const { id } = req.params;
      // جلب اسم المجلد وcommittee_id قبل الحذف
      const [nameRows] = await db.execute('SELECT name, committee_id FROM committee_folders WHERE id = ?', [id]);
      const folderName = nameRows.length > 0 ? nameRows[0].name : 'غير معروف';
      const committeeId = nameRows.length > 0 ? nameRows[0].committee_id : null;
      
      // جلب اسم اللجنة باللغة المناسبة
      let committeeName = '';
      if (committeeId) {
        const [comRows] = await db.execute('SELECT name FROM committees WHERE id = ?', [committeeId]);
        if (comRows.length > 0) {
          const token = req.headers.authorization?.split(' ')[1];
          const userLanguage = token ? getUserLanguageFromToken(token) : 'ar';
          committeeName = getCommitteeNameByLanguage(comRows[0].name, userLanguage);
        }
      }

      const [result] = await db.execute('DELETE FROM committee_folders WHERE id = ?', [id]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'المجلد غير موجود' });
      }
  
      // استخراج userId من التوكن
      const token = req.headers.authorization?.split(' ')[1];
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;
  
        try {
          await logAction(
            userId,
            'delete_folder',
            `تم حذف المجلد: ${folderName} من لجنة: ${committeeName}`,
            'folder',
            id
          );
        } catch (logErr) {
          console.error('logAction error:', logErr);
        }
      }
  
      res.status(200).json({ message: 'تم حذف المجلد بنجاح' });
    } catch (error) {
      console.error('deleteFolder error:', error);
      res.status(500).json({ message: 'خطأ في حذف المجلد', error });
    }
  };
  

// ========== Contents CRUD ==========
exports.getContents = async (req, res) => {
    try {
        // Get user role from token
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ message: 'مطلوب تسجيل الدخول' });
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const isAdmin = decoded.role === 'admin';

        // Build query based on user role
        let query = `
            SELECT 
                c.*,
                u.username as created_by_username,
                a.username as approved_by_username
            FROM committee_contents c
            LEFT JOIN users u ON c.created_by = u.id
            LEFT JOIN users a ON c.approved_by = a.id
            WHERE c.folder_id = ?
        `;
        let params = [req.params.folderId];

        // If not admin, only show approved content
        if (!isAdmin) {
            query += ' AND c.approval_status = "approved"';
        }

        query += ' ORDER BY c.created_at DESC';

        const [rows] = await db.execute(query, params);
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ message: 'خطأ في جلب المحتويات', error });
    }
};

exports.getContent = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM committee_contents WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'المحتوى غير موجود' });
        res.status(200).json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'خطأ في جلب المحتوى', error });
    }
};

exports.addContent = async (req, res) => {
    try {
      const { title, notes, approvers_required } = req.body;
      const { folderId } = req.params;
      const filePath = req.file ? req.file.path.replace(/\\/g, '/') : null;
  
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ message: 'مطلوب تسجيل الدخول' });
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const created_by = decoded.id;
  
      if (!title || !filePath || !created_by) {
        return res.status(400).json({ message: 'العنوان والملف ومعرّف المنشئ مطلوبة' });
      }
  
      // جلب اسم اللجنة باللغة المناسبة
      let committeeName = '';
      const [comRows] = await db.execute('SELECT com.name FROM committees com JOIN committee_folders cf ON com.id = cf.committee_id WHERE cf.id = ?', [folderId]);
      if (comRows.length > 0) {
        const userLanguage = getUserLanguageFromToken(token);
        committeeName = getCommitteeNameByLanguage(comRows[0].name, userLanguage);
      }
  
      const [result] = await db.execute(
        'INSERT INTO committee_contents (title, file_path, notes, folder_id, created_by, approvers_required) VALUES (?, ?, ?, ?, ?, ?)',
        [title, filePath, notes, folderId, created_by, approvers_required]
      );
  
      const contentId = result.insertId;
  
      // 🔹 تسجيل اللوق
      try {
        const logDescription = committeeName 
          ? `تمت إضافة محتوى بعنوان: ${title} في لجنة: ${committeeName}`
          : `تمت إضافة محتوى بعنوان: ${title}`;
          
        await logAction(
          created_by,
          'add_content',
          logDescription,
          'content',
          contentId
        );
      } catch (logErr) {
        console.error('logAction error:', logErr);
      }
  
      res.status(201).json({ message: 'تم إضافة المحتوى بنجاح', contentId });
  
    } catch (error) {
      console.error('addContent error:', error);
      res.status(500).json({ message: 'خطأ في إضافة المحتوى', error });
    }
  };
  

  exports.updateContent = async (req, res) => {
    try {
      const { id } = req.params;
      const { title, notes } = req.body;
      const filePath = req.file ? req.file.path.replace(/\\/g, '/') : null;

      // جلب العنوان القديم وfolder_id قبل التحديث
      const [oldRows] = await db.execute('SELECT title, folder_id FROM committee_contents WHERE id = ?', [id]);
      if (!oldRows.length) {
        return res.status(404).json({ message: 'المحتوى غير موجود' });
      }
      const oldTitle = oldRows[0].title;
      const folderId = oldRows[0].folder_id;
      
      // جلب اسم اللجنة باللغة المناسبة
      let committeeName = '';
      if (folderId) {
        const [comRows] = await db.execute('SELECT com.name FROM committees com JOIN committee_folders cf ON com.id = cf.committee_id WHERE cf.id = ?', [folderId]);
        if (comRows.length > 0) {
          const token = req.headers.authorization?.split(' ')[1];
          const userLanguage = token ? getUserLanguageFromToken(token) : 'ar';
          committeeName = getCommitteeNameByLanguage(comRows[0].name, userLanguage);
        }
      }

      let query = 'UPDATE committee_contents SET title = ?, notes = ?';
      let params = [title, notes];
      if (filePath) {
        query += ', file_path = ?';
        params.push(filePath);
      }
      query += ', updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      params.push(id);

      const [result] = await db.execute(query, params);
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'المحتوى غير موجود' });
      }

      // استخراج userId من التوكن
      const token = req.headers.authorization?.split(' ')[1];
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        try {
          const logDescription = committeeName 
            ? `تم تعديل محتوى من: ${oldTitle} إلى: ${title} في لجنة: ${committeeName}`
            : `تم تعديل محتوى من: ${oldTitle} إلى: ${title}`;
            
          await logAction(
            userId,
            'update_content',
            logDescription,
            'content',
            id
          );
        } catch (logErr) {
          console.error('logAction error:', logErr);
        }
      }

      res.status(200).json({ message: 'تم تعديل المحتوى بنجاح' });
    } catch (error) {
      console.error('updateContent error:', error);
      res.status(500).json({ message: 'خطأ في تعديل المحتوى', error });
    }
  };
  

exports.deleteContent = async (req, res) => {
    try {
      const { id } = req.params;

      // جلب العنوان وfolder_id قبل الحذف
      const [nameRows] = await db.execute('SELECT title, folder_id FROM committee_contents WHERE id = ?', [id]);
      const contentTitle = nameRows.length > 0 ? nameRows[0].title : 'غير معروف';
      const folderId = nameRows.length > 0 ? nameRows[0].folder_id : null;
      
      // جلب اسم اللجنة باللغة المناسبة
      let committeeName = '';
      if (folderId) {
        const [comRows] = await db.execute('SELECT com.name FROM committees com JOIN committee_folders cf ON com.id = cf.committee_id WHERE cf.id = ?', [folderId]);
        if (comRows.length > 0) {
          const token = req.headers.authorization?.split(' ')[1];
          const userLanguage = token ? getUserLanguageFromToken(token) : 'ar';
          committeeName = getCommitteeNameByLanguage(comRows[0].name, userLanguage);
        }
      }
  
      const [result] = await db.execute('DELETE FROM committee_contents WHERE id = ?', [id]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'المحتوى غير موجود' });
      }
  
      // استخراج userId من التوكن
      const token = req.headers.authorization?.split(' ')[1];
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;
  
        try {
          const logDescription = committeeName 
            ? `تم حذف محتوى: ${contentTitle} من لجنة: ${committeeName}`
            : `تم حذف محتوى: ${contentTitle}`;
            
          await logAction(
            userId,
            'delete_content',
            logDescription,
            'content',
            id
          );
        } catch (logErr) {
          console.error('logAction error:', logErr);
        }
      }
  
      res.status(200).json({ message: 'تم حذف المحتوى بنجاح' });
    } catch (error) {
      console.error('deleteContent error:', error);
      res.status(500).json({ message: 'خطأ في حذف المحتوى', error });
    }
  };
  

// New function to get content uploaded by the current user
exports.getMyUploadedCommitteeContents = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ message: 'مطلوب تسجيل الدخول' });
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        // console.log('Fetching committee contents for userId:', userId); // Debug log: Check which userId is being used

        const [rows] = await db.execute(`
            SELECT
                CONCAT('comm-', cc.id) AS id,
                cc.title,
                cc.file_path,
                cc.approval_status AS is_approved,
                cc.created_at,
                cf.name AS folderName,
                com.name AS source_name
            FROM committee_contents cc
            JOIN committee_folders cf ON cc.folder_id = cf.id
            JOIN committees com ON cf.committee_id = com.id
            WHERE cc.created_by = ?
            ORDER BY cc.created_at DESC
        `, [userId]);

        // console.log('Fetched committee content rows:', rows); // Debug log: See what data is returned from the query

        res.status(200).json({ status: 'success', data: rows });
    } catch (error) {
        // console.error('Error fetching my uploaded committee contents:', error);
        res.status(500).json({ status: 'error', message: 'خطأ في جلب المحتويات المرفوعة للجان' });
    }
};

// ========== Approvals & Signatures ==========
exports.getApprovals = async (req, res) => {
    try {
        const { contentId } = req.params;
        const [rows] = await db.execute('SELECT * FROM committee_approval_logs WHERE content_id = ?', [contentId]);
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ message: 'خطأ في جلب سجل الاعتمادات', error });
    }
};

exports.approveContent = async (req, res) => {
    try {
        const { contentId } = req.params;
        const { approver_id, status, comments, signature, signed_as_proxy, electronic_signature, delegated_by } = req.body;
        
        // تحقق من وجود السجل
        const [exists] = await db.execute('SELECT * FROM committee_approval_logs WHERE content_id = ? AND approver_id = ?', [contentId, approver_id]);
        if (exists.length > 0) {
            // تحديث السجل
            await db.execute('UPDATE committee_approval_logs SET status = ?, comments = ?, signature = ?, signed_as_proxy = ?, electronic_signature = ?, delegated_by = ?, created_at = CURRENT_TIMESTAMP WHERE content_id = ? AND approver_id = ?', [status, comments, signature, signed_as_proxy, electronic_signature, delegated_by, contentId, approver_id]);
        } else {
            // إضافة سجل جديد
            await db.execute('INSERT INTO committee_approval_logs (content_id, approver_id, status, comments, signature, signed_as_proxy, electronic_signature, delegated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [contentId, approver_id, status, comments, signature, signed_as_proxy, electronic_signature, delegated_by]);
        }
        
        // تحديث حالة الموافقة في المحتوى
        await db.execute('UPDATE committee_contents SET approval_status = ? WHERE id = ?', [status, contentId]);
        
        // ✅ تسجيل اللوق بعد نجاح الاعتماد أو الرفض
        const token = req.headers.authorization?.split(' ')[1];
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.id;
            
            try {
                await logAction(
                    userId,
                    status === 'approved' ? 'approve_content' : 'reject_content',
                    `تم ${status === 'approved' ? 'اعتماد' : 'رفض'} المحتوى من قبل ${decoded.id}`,
                    'committee_content',
                    contentId
                );
            } catch (logErr) {
                console.error('logAction error:', logErr);
            }
        }
        
        res.status(200).json({ message: 'تم تحديث الاعتماد بنجاح' });
    } catch (error) {
        res.status(500).json({ message: 'خطأ في تحديث الاعتماد', error });
    }
};

// New function to track committee content
exports.trackCommitteeContent = async (req, res) => {
    try {
        const { contentId } = req.params;

        // 1. Get content details
        const [contentRows] = await db.execute(`
            SELECT 
                cc.id,
                cc.title,
                cc.file_path,
                cc.approval_status,
                cc.created_at,
                cf.name AS folderName,
                com.name AS source_name
            FROM committee_contents cc
            JOIN committee_folders cf ON cc.folder_id = cf.id
            JOIN committees com ON cf.committee_id = com.id
            WHERE cc.id = ?
        `, [contentId]);

        if (contentRows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'المحتوى غير موجود.' });
        }
        const content = contentRows[0];

        // 2. Get approval timeline (logs)
        const [timelineRows] = await db.execute(`
            SELECT 
                cal.status,
                cal.comments,
                cal.created_at,
                u.username AS approver,
                com.name AS department -- This will be committee name
            FROM committee_approval_logs cal
            JOIN users u ON cal.approver_id = u.id
            JOIN committee_contents cc ON cal.content_id = cc.id
            JOIN committee_folders cf ON cc.folder_id = cf.id
            JOIN committees com ON cf.committee_id = com.id
            WHERE cal.content_id = ?
            ORDER BY cal.created_at ASC
        `, [contentId]);

        // 3. Get pending approvers
        const [pendingApproversRows] = await db.execute(`
            SELECT
                u.username AS approver,
                com.name AS department
            FROM committee_content_approvers cca
            JOIN users u ON cca.user_id = u.id
            JOIN committee_contents cc ON cca.content_id = cc.id
            JOIN committee_folders cf ON cc.folder_id = cf.id
            JOIN committees com ON cf.committee_id = com.id
            WHERE cca.content_id = ? AND NOT EXISTS (
                SELECT 1 FROM committee_approval_logs cal
                WHERE cal.content_id = cca.content_id AND cal.approver_id = cca.user_id AND cal.status = 'approved'
            )
        `, [contentId]);

        res.json({
            status: 'success',
            content,
            timeline: timelineRows,
            pending: pendingApproversRows
        });

    } catch (error) {
        // console.error('Error tracking committee content:', error);
        res.status(500).json({ status: 'error', message: 'خطأ في تتبع محتوى اللجنة.' });
    }
}; 
// 1) جلب الأسماء
exports.getFolderNames = async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, name FROM committee_folder_names ORDER BY name ASC'
    );
    res.status(200).json({ data: rows });
  } catch (err) {
    res.status(500).json({ message: 'فشل في جلب أسماء المجلدات', error: err });
  }
};

// 2) إضافة اسم جديد
exports.addFolderName = async (req, res) => {
  try {
    const { name } = req.body;
    const [result] = await db.execute(
      'INSERT INTO committee_folder_names (name) VALUES (?)',
      [name]
    );
    
    // ✅ تسجيل اللوق بعد نجاح إضافة اسم المجلد
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id;
      
      try {
        await logAction(
          userId,
          'add_folder_name',
          `تمت إضافة اسم مجلد جديد للجان: ${name}`,
          'folder_name',
          result.insertId
        );
      } catch (logErr) {
        console.error('logAction error:', logErr);
      }
    }
    
    res.status(201).json({ id: result.insertId, name });
  } catch (err) {
    res.status(500).json({ message: 'فشل في إضافة اسم المجلد', error: err });
  }
};

// 3) تحديث اسم
exports.updateFolderName = async (req, res) => {
const { id }   = req.params;
  const { name } = req.body;

  if (!name) return res.status(400).json({ message: '❌ الاسم الجديد مطلوب.' });

  const conn = await db.getConnection();
  try {
    // 1) جلب الاسم القديم من جدول committee_folder_names
    const [rows] = await conn.execute(
      'SELECT name FROM committee_folder_names WHERE id = ?',
      [id]
    );
    if (!rows.length) {
      conn.release();
      return res.status(404).json({ message: '❌ لم يتم العثور على اسم المجلد.' });
    }
    const oldName = rows[0].name;

    // 2) تحديث الاسم في جدول committee_folder_names
    const [result] = await conn.execute(
      'UPDATE committee_folder_names SET name = ? WHERE id = ?',
      [name, id]
    );
    if (result.affectedRows === 0) {
      conn.release();
      return res.status(404).json({ message: '❌ لم يتم تحديث اسم المجلد.' });
    }

    // 3) تحديث الاسم في جدول committee_folders المرتبط بالاسم القديم
    await conn.execute(
      'UPDATE committee_folders SET name = ? WHERE name = ?',
      [name, oldName]
    );

    // ✅ تسجيل اللوق بعد نجاح تعديل اسم المجلد
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id;
      
      try {
        await logAction(
          userId,
          'update_folder_name',
          `تم تعديل اسم مجلد للجان من: ${oldName} إلى: ${name}`,
          'folder_name',
          id
        );
      } catch (logErr) {
        console.error('logAction error:', logErr);
      }
    }

    conn.release();
    return res.json({
      status: 'success',
      message: '✅ تم تعديل الاسم في الجداول المرتبطة بنجاح'
    });
  } catch (err) {
    conn.release();
    console.error(err);
    return res.status(500).json({ message: '❌ فشل في تعديل الاسم.' });
  }
};

// 4) حذف اسم
exports.deleteFolderName = async (req, res) => {
  try {
    const { id } = req.params;
    
    // جلب الاسم قبل الحذف لتسجيله في اللوق
    const [nameRows] = await db.execute('SELECT name FROM committee_folder_names WHERE id = ?', [id]);
    const folderName = nameRows.length > 0 ? nameRows[0].name : 'غير معروف';
    
    await db.execute('DELETE FROM committee_folder_names WHERE id = ?', [id]);
    
    // ✅ تسجيل اللوق بعد نجاح حذف اسم المجلد
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id;
      
      try {
        await logAction(
          userId,
          'delete_folder_name',
          `تم حذف اسم مجلد للجان: ${folderName}`,
          'folder_name',
          id
        );
      } catch (logErr) {
        console.error('logAction error:', logErr);
      }
    }
    
    res.status(200).json({ message: 'تم الحذف بنجاح' });
  } catch (err) {
    res.status(500).json({ message: 'فشل في حذف الاسم', error: err });
  }
};


// 🟢 جلب كل عناوين المحتوى
exports.getContentTitles = async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT id, name FROM committee_content_titles ORDER BY id DESC');
    res.json({ status: 'success', data: rows });
  } catch (err) {
    console.error('❌ getContentTitles error:', err);
    res.status(500).json({ status: 'error', message: 'فشل في جلب العناوين' });
  }
};

// 🟢 إضافة عنوان جديد
exports.addContentTitle = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'الاسم مطلوب' });

    const [result] = await db.execute('INSERT INTO committee_content_titles (name) VALUES (?)', [name]);
    
    // ✅ تسجيل اللوق بعد نجاح إضافة عنوان المحتوى
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id;
      
      try {
        await logAction(
          userId,
          'add_content_title',
          `تمت إضافة عنوان محتوى جديد للجان: ${name}`,
          'content_title',
          result.insertId
        );
      } catch (logErr) {
        console.error('logAction error:', logErr);
      }
    }
    
    res.status(201).json({ id: result.insertId, name });
  } catch (err) {
    console.error('❌ addContentTitle error:', err);
    res.status(500).json({ message: 'فشل في إضافة العنوان' });
  }
};

// 🟢 تعديل عنوان
exports.updateContentTitle = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) return res.status(400).json({ message: 'الاسم الجديد مطلوب' });

    // 1) جلب الاسم القديم
    const [rows] = await db.execute('SELECT name FROM committee_content_titles WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ message: 'العنوان غير موجود' });

    const oldName = rows[0].name;

    // 2) تحديث الاسم في جدول العناوين
    const [updateTitle] = await db.execute(
      'UPDATE committee_content_titles SET name = ? WHERE id = ?',
      [name, id]
    );
    if (updateTitle.affectedRows === 0)
      return res.status(404).json({ message: 'فشل في تحديث العنوان' });

    // 3) تحديث الاسم في جدول المحتويات المرتبط بنفس الاسم
    await db.execute(
      'UPDATE committee_contents SET title = ? WHERE title = ?',
      [name, oldName]
    );

    // ✅ تسجيل اللوق بعد نجاح تعديل عنوان المحتوى
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id;
      
      try {
        await logAction(
          userId,
          'update_content_title',
          `تم تعديل عنوان محتوى للجان من: ${oldName} إلى: ${name}`,
          'content_title',
          id
        );
      } catch (logErr) {
        console.error('logAction error:', logErr);
      }
    }

    res.json({
      status: 'success',
      message: '✅ تم تحديث العنوان وكل المحتويات المرتبطة به',
      id,
      name
    });
  } catch (err) {
    console.error('❌ updateContentTitle error:', err);
    res.status(500).json({ message: 'فشل في تحديث العنوان', error: err });
  }
};


// 🟢 حذف عنوان
exports.deleteContentTitle = async (req, res) => {
  try {
    const { id } = req.params;

    // جلب الاسم قبل الحذف لتسجيله في اللوق
    const [nameRows] = await db.execute('SELECT name FROM committee_content_titles WHERE id = ?', [id]);
    const contentTitle = nameRows.length > 0 ? nameRows[0].name : 'غير معروف';

    const [result] = await db.execute('DELETE FROM committee_content_titles WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'العنوان غير موجود' });

    // ✅ تسجيل اللوق بعد نجاح حذف عنوان المحتوى
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id;
      
      try {
        await logAction(
          userId,
          'delete_content_title',
          `تم حذف عنوان محتوى للجان: ${contentTitle}`,
          'content_title',
          id
        );
      } catch (logErr) {
        console.error('logAction error:', logErr);
      }
    }

    res.json({ message: 'تم الحذف بنجاح' });
  } catch (err) {
    console.error('❌ deleteContentTitle error:', err);
    res.status(500).json({ message: 'فشل في حذف العنوان' });
  }
};