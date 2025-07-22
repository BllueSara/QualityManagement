const mysql = require('mysql2/promise');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const path = require('path');

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
        // إذا كان الاسم object يحتوي على اللغتين
        if (typeof committeeNameData === 'object' && committeeNameData !== null) {
            // إذا كان object يحتوي على خصائص اللغة
            if (committeeNameData[userLanguage]) {
                return committeeNameData[userLanguage];
            }
            if (committeeNameData['ar']) {
                return committeeNameData['ar'];
            }
            if (committeeNameData['en']) {
                return committeeNameData['en'];
            }
            // إذا لم تكن هناك خصائص لغة، جرب الخصائص الأخرى
            if (committeeNameData.name) {
                return committeeNameData.name;
            }
            if (committeeNameData.title) {
                return committeeNameData.title;
            }
            if (committeeNameData.text) {
                return committeeNameData.text;
            }
            if (committeeNameData.value) {
                return committeeNameData.value;
            }
            // كحل أخير، إرجاع string representation
            const result = JSON.stringify(committeeNameData);
            return result;
        }
        // إذا كان الاسم JSON string يحتوي على اللغتين
        if (typeof committeeNameData === 'string' && committeeNameData.startsWith('{')) {
            const parsed = JSON.parse(committeeNameData);
            return parsed[userLanguage] || parsed['ar'] || parsed['en'] || committeeNameData;
        }
        // إذا كان نص عادي
        return committeeNameData || 'غير معروف';
    } catch (error) {
        console.error('Error in getCommitteeNameByLanguage:', error);
        // في حالة فشل التحليل، إرجاع النص كما هو
        return String(committeeNameData) || 'غير معروف';
    }
}

// دالة مساعدة لاستخراج اسم المحتوى باللغة المناسبة
function getContentNameByLanguage(contentNameData, userLanguage = 'ar') {
    try {
        // إذا كان الاسم object يحتوي على اللغتين
        if (typeof contentNameData === 'object' && contentNameData !== null) {
            // إذا كان object يحتوي على خصائص اللغة
            if (contentNameData[userLanguage]) {
                return contentNameData[userLanguage];
            }
            if (contentNameData['ar']) {
                return contentNameData['ar'];
            }
            if (contentNameData['en']) {
                return contentNameData['en'];
            }
            // إذا لم تكن هناك خصائص لغة، جرب الخصائص الأخرى
            if (contentNameData.name) {
                return contentNameData.name;
            }
            if (contentNameData.title) {
                return contentNameData.title;
            }
            if (contentNameData.text) {
                return contentNameData.text;
            }
            if (contentNameData.value) {
                return contentNameData.value;
            }
            // كحل أخير، إرجاع string representation
            const result = JSON.stringify(contentNameData);
            return result;
        }
        // إذا كان الاسم JSON string يحتوي على اللغتين
        if (typeof contentNameData === 'string' && contentNameData.startsWith('{')) {
            const parsed = JSON.parse(contentNameData);
            return parsed[userLanguage] || parsed['ar'] || parsed['en'] || contentNameData;
        }
        // إذا كان نص عادي
        return contentNameData || 'غير معروف';
    } catch (error) {
        console.error('Error in getContentNameByLanguage:', error);
        // في حالة فشل التحليل، إرجاع النص كما هو
        return String(contentNameData) || 'غير معروف';
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
        // استخراج معلومات المستخدم من التوكن
        const token = req.headers.authorization?.split(' ')[1];
        let userId = null;
        let userRole = null;
        let canViewOwnCommittees = false;

        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                userId = decoded.id;
                userRole = decoded.role;

                // جلب صلاحيات المستخدم
                const [permRows] = await db.execute(`
                    SELECT p.permission_key
                    FROM permissions p
                    JOIN user_permissions up ON up.permission_id = p.id
                    WHERE up.user_id = ?
                `, [userId]);
                
                const userPermissions = new Set(permRows.map(r => r.permission_key));
                canViewOwnCommittees = userPermissions.has('view_own_committees');
            } catch (error) {
                console.error('Error decoding token:', error);
            }
        }

        let query = 'SELECT * FROM committees';
        let params = [];

        // إذا كان المستخدم admin أو ليس لديه صلاحية view_own_committees، اجلب كل اللجان
        if (userRole === 'admin' || !canViewOwnCommittees) {
            query = 'SELECT * FROM committees';
        } else {
            // إذا كان لديه صلاحية view_own_committees، تحقق من وجود لجان مختارة
            if (userId) {
                // تحقق من وجود لجان مختارة للمستخدم
                const [userCommittees] = await db.execute(`
                    SELECT COUNT(*) as count FROM user_committees WHERE user_id = ?
                `, [userId]);
                
                if (userCommittees[0].count > 0) {
                    // إذا كان لديه لجان مختارة، اجلبها
                    query = `
                        SELECT DISTINCT c.* 
                        FROM committees c
                        JOIN user_committees uc ON c.id = uc.committee_id
                        WHERE uc.user_id = ?
                        ORDER BY c.name
                    `;
                    params = [userId];
                } else {
                    // إذا لم يكن لديه لجان مختارة، اجلب كل اللجان
                    query = 'SELECT * FROM committees';
                }
            } else {
                // إذا لم يكن هناك userId، اجلب كل اللجان
                query = 'SELECT * FROM committees';
            }
        }

        const [rows] = await db.execute(query, params);
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error in getCommittees:', error);
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
      // Save relative path instead of full system path
      const imagePath = req.file ? path.posix.join('backend', 'uploads', 'images', req.file.filename) : null;
  
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
  
        // ✅ تسجيل اللوق بعد نجاح إضافة اللجنة
        try {
          const logDescription = {
            ar: `تمت إضافة لجنة جديدة: ${getCommitteeNameByLanguage(name, 'ar')}`,
            en: `Added new committee: ${getCommitteeNameByLanguage(name, 'en')}`
          };
          
          await logAction(
            userId,
            'add_committee',
            JSON.stringify(logDescription),
            'committee',
            committeeId
          );
        } catch (logErr) {
          console.error('logAction error:', logErr);
        }
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
      // Save relative path instead of full system path
      const imagePath = req.file ? path.posix.join('backend', 'uploads', 'images', req.file.filename) : null;
  
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
          const logDescription = {
            ar: `تم تعديل اللجنة: ${getCommitteeNameByLanguage(name, 'ar')}`,
            en: `Updated committee: ${getCommitteeNameByLanguage(name, 'en')}`
          };
          
          await logAction(
            userId,
            'update_committee',
            JSON.stringify(logDescription),
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
        
        // جلب اسم اللجنة قبل الحذف للتسجيل
        const [[committeeDetails]] = await db.execute('SELECT name FROM committees WHERE id = ?', [id]);
        if (!committeeDetails) {
            return res.status(404).json({ message: 'اللجنة غير موجودة' });
        }
        
        // Check for related folders/contents
        const [related] = await db.execute('SELECT COUNT(*) as count FROM committee_folders f JOIN committee_contents c ON f.id = c.folder_id WHERE f.committee_id = ?', [id]);
        if (related[0].count > 0) return res.status(400).json({ message: 'لا يمكن حذف اللجنة لوجود محتويات مرتبطة بها' });
        
        const [result] = await db.execute('DELETE FROM committees WHERE id = ?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'اللجنة غير موجودة' });
        
        // ✅ تسجيل اللوق بعد نجاح حذف اللجنة
        try {
            const token = req.headers.authorization?.split(' ')[1];
            if (token) {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const userId = decoded.id;
                
                const logDescription = {
                    ar: `تم حذف اللجنة: ${getCommitteeNameByLanguage(committeeDetails.name, 'ar')}`,
                    en: `Deleted committee: ${getCommitteeNameByLanguage(committeeDetails.name, 'en')}`
                };
                
                await logAction(userId, 'delete_committee', JSON.stringify(logDescription), 'committee', id);
            }
        } catch (logErr) {
            console.error('logAction error:', logErr);
        }
        
        res.status(200).json({ message: 'تم حذف اللجنة بنجاح' });
    } catch (error) {
        res.status(500).json({ message: 'خطأ في حذف اللجنة', error });
    }
};

// ========== Folders CRUD ==========
exports.getFolders = async (req, res) => {
    try {
        const committeeId = req.params.committeeId;
        
        // جلب المجلدات مع اسم اللجنة
        const [rows] = await db.execute(`
            SELECT cf.*, c.name as committee_name 
            FROM committee_folders cf 
            JOIN committees c ON cf.committee_id = c.id 
            WHERE cf.committee_id = ?
        `, [committeeId]);
        
        // جلب اسم اللجنة للاستجابة
        const [committeeRows] = await db.execute('SELECT name FROM committees WHERE id = ?', [committeeId]);
        const committeeName = committeeRows.length > 0 ? committeeRows[0].name : '';
        
        res.status(200).json({
            data: rows,
            committeeName: committeeName
        });
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
            const logDescription = {
                ar: `تمت إضافة مجلد جديد: ${getContentNameByLanguage(name, 'ar')} في لجنة: ${getCommitteeNameByLanguage(comRows[0].name, 'ar')}`,
                en: `Added new folder: ${getContentNameByLanguage(name, 'en')} in committee: ${getCommitteeNameByLanguage(comRows[0].name, 'en')}`
            };
            
            await logAction(
                created_by,
                'add_folder',
                JSON.stringify(logDescription),
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
                const logDescription = {
                    ar: `تم تعديل مجلد من: ${getContentNameByLanguage(oldName, 'ar')} إلى: ${getContentNameByLanguage(name, 'ar')} في لجنة: ${getCommitteeNameByLanguage(comRows[0].name, 'ar')}`,
                    en: `Updated folder from: ${getContentNameByLanguage(oldName, 'en')} to: ${getContentNameByLanguage(name, 'en')} in committee: ${getCommitteeNameByLanguage(comRows[0].name, 'en')}`
                };
                
                await logAction(
                    userId,
                    'update_folder',
                    JSON.stringify(logDescription),
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
          const logDescription = {
              ar: `تم حذف المجلد: ${getContentNameByLanguage(folderName, 'ar')} من لجنة: ${getCommitteeNameByLanguage(comRows[0].name, 'ar')}`,
              en: `Deleted folder: ${getContentNameByLanguage(folderName, 'en')} from committee: ${getCommitteeNameByLanguage(comRows[0].name, 'en')}`
          };
          
          await logAction(
            userId,
            'delete_folder',
            JSON.stringify(logDescription),
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

        const folderId = req.params.folderId;

        // جلب معلومات المجلد أولاً
        const [folderRows] = await db.execute(
            `SELECT 
                cf.id,
                cf.name,
                cf.committee_id,
                com.name as committee_name
            FROM committee_folders cf 
            JOIN committees com ON cf.committee_id = com.id
            WHERE cf.id = ?`,
            [folderId]
        );

        if (folderRows.length === 0) {
            return res.status(404).json({ message: 'المجلد غير موجود' });
        }

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
        let params = [folderId];

        // If not admin, only show approved content
        if (!isAdmin) {
            query += ' AND c.approval_status = "approved"';
        }

        query += ' ORDER BY c.created_at DESC';

        const [rows] = await db.execute(query, params);
        
        res.status(200).json({
            status: 'success',
            message: 'تم جلب المحتويات بنجاح',
            folderName: folderRows[0].name,
            folder: {
                id: folderRows[0].id,
                name: folderRows[0].name,
                committee_id: folderRows[0].committee_id,
                committee_name: folderRows[0].committee_name
            },
            data: rows
        });
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
      const { title, notes, approvers_required, force_approved } = req.body;
      const { folderId } = req.params;
      // Save the path including backend directory since multer saves to backend/uploads/content_files
      const filePath = req.file ? path.posix.join('backend', 'uploads', 'content_files', req.file.filename) : null;
  
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

      // منطق الاعتماد الفوري
      let approval_status = 'pending';
      if (force_approved === 'true' || force_approved === true) {
        approval_status = 'approved';
      }

      const [result] = await db.execute(
        'INSERT INTO committee_contents (title, file_path, notes, folder_id, created_by, approvers_required, approval_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [title, filePath, notes, folderId, created_by, approvers_required, approval_status]
      );
  
      const contentId = result.insertId;
  
      // 🔹 تسجيل اللوق
      try {
        const logDescription = {
          ar: `تمت إضافة محتوى بعنوان: ${getContentNameByLanguage(title, 'ar')} في لجنة: ${getCommitteeNameByLanguage(comRows[0].name, 'ar')}`,
          en: `Added content with title: ${getContentNameByLanguage(title, 'en')} in committee: ${getCommitteeNameByLanguage(comRows[0].name, 'en')}`
        };
        
        await logAction(
          created_by,
          'add_content',
          JSON.stringify(logDescription),
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
  

// إنشاء نسخة جديدة بدلاً من التعديل المباشر
exports.updateContent = async (req, res) => {
  try {
    // 1) التحقّق من التوثيق
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ status: 'error', message: 'غير مصرح: لا يوجد توكن' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    const userLang = getUserLanguageFromToken(token);

    // 2) باراميترات الطلب
    const originalId = req.params.id;          // المعرف الأصلي
    const { title, notes } = req.body;
    // multer يحفظ الملف في backend/uploads/content_files
    const filePath = req.file
      ? path.posix.join('backend', 'uploads', 'content_files', req.file.filename)
      : null;

    // 3) افتح اتصال جديد
    const connection = await db.getConnection();

    // 4) جلب بيانات المحتوى الأصلي
    const [oldRows] = await connection.execute(
      `SELECT folder_id, title, approvers_required
       FROM committee_contents
       WHERE id = ?`,
      [originalId]
    );
    if (!oldRows.length) {
      connection.release();
      return res.status(404).json({ status: 'error', message: 'المحتوى الأصلي غير موجود' });
    }
    const { folder_id: folderId, title: oldTitle, approvers_required } = oldRows[0];

    // 5) جلب اسم اللجنة للوج
    let committeeName = '';
    if (folderId) {
      const [cf] = await connection.execute(
        `SELECT com.name
         FROM committees com
         JOIN committee_folders cf ON com.id = cf.committee_id
         WHERE cf.id = ?`,
        [folderId]
      );
      if (cf.length) {
        committeeName = getCommitteeNameByLanguage(cf[0].name, userLang);
      }
    }

    // 6) إدراج سجل جديد بنسخة المراجعة
    const [insertRes] = await connection.execute(
      `INSERT INTO committee_contents (
         title,
         notes,
         file_path,
         folder_id,
         created_by,
         approvers_required,
         approvals_log,
         created_at,
         updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        title,
        notes || null,
        filePath,
        folderId,
        userId,
        approvers_required,
        JSON.stringify([])    // نبدأ بسجل خالي للموافقات
      ]
    );
    const newContentId = insertRes.insertId;

    // 7) تسجيل اللوق باللغة المناسبة
    try {
      const logDescription = {
        ar: `تم تحديث محتوى من: ${getContentNameByLanguage(oldTitle, 'ar')} إلى: ${getContentNameByLanguage(title, 'ar')} في لجنة: ${getCommitteeNameByLanguage(committeeName, 'ar')}`,
        en: `Updated content from: ${getContentNameByLanguage(oldTitle, 'en')} to: ${getContentNameByLanguage(title, 'en')} in committee: ${getCommitteeNameByLanguage(committeeName, 'en')}`
      };
      await logAction(
        userId,
        'update_content',
        JSON.stringify(logDescription),
        'content',
        newContentId
      );
    } catch (logErr) {
      console.error('logAction error:', logErr);
    }

    connection.release();

    // 8) استجابة API
    return res.status(201).json({
      status: 'success',
      message: '✅ تم إنشاء نسخة جديدة من المحتوى وهي بانتظار الاعتماد',
      contentId: newContentId
    });
  } catch (err) {
    console.error('updateContent error:', err);
    return res.status(500).json({ status: 'error', message: 'خطأ في إنشاء نسخة محدثة' });
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
          // جلب اسم اللجنة مرة أخرى للتسجيل
          const [comRows] = await db.execute('SELECT com.name FROM committees com JOIN committee_folders cf ON com.id = cf.committee_id WHERE cf.id = ?', [folderId]);
          
          const logDescription = {
            ar: `تم حذف محتوى: ${getContentNameByLanguage(contentTitle, 'ar')} من لجنة: ${getCommitteeNameByLanguage(comRows[0].name, 'ar')}`,
            en: `Deleted content: ${getContentNameByLanguage(contentTitle, 'en')} from committee: ${getCommitteeNameByLanguage(comRows[0].name, 'en')}`
          };
          
          await logAction(
            userId,
            'delete_content',
            JSON.stringify(logDescription),
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
                const logDescription = {
                    ar: `تم ${status === 'approved' ? 'اعتماد' : 'رفض'} المحتوى`,
                    en: `Content ${status === 'approved' ? 'approved' : 'rejected'}`
                };
                
                await logAction(
                    userId,
                    status === 'approved' ? 'approve_content' : 'reject_content',
                    JSON.stringify(logDescription),
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
      const userLanguage = getUserLanguageFromToken(token);
      
      try {
        const folderNameInLanguage = getContentNameByLanguage(name, userLanguage);
        await logAction(
          userId,
          'add_folder_name',
          `تمت إضافة اسم مجلد جديد للجان: ${folderNameInLanguage}`,
          'folder',
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
      const userLanguage = getUserLanguageFromToken(token);
      
      try {
        const oldFolderNameInLanguage = getContentNameByLanguage(oldName, userLanguage);
        const newFolderNameInLanguage = getContentNameByLanguage(name, userLanguage);
        await logAction(
          userId,
          'update_folder_name',
          `تم تعديل اسم مجلد للجان من: ${oldFolderNameInLanguage} إلى: ${newFolderNameInLanguage}`,
          'folder',
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
        const folderNameInLanguage = getContentNameByLanguage(folderName, userLanguage);
        await logAction(
          userId,
          'delete_folder_name',
          `تم حذف اسم مجلد للجان: ${folderNameInLanguage}`,
          'folder',
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
      const userLanguage = getUserLanguageFromToken(token);
      
      try {
        const contentTitleInLanguage = getContentNameByLanguage(name, userLanguage);
        await logAction(
          userId,
          'add_content_title',
          `تمت إضافة عنوان محتوى جديد للجان: ${contentTitleInLanguage}`,
          'content',
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
      const userLanguage = getUserLanguageFromToken(token);
      
      try {
        const oldContentTitleInLanguage = getContentNameByLanguage(oldName, userLanguage);
        const newContentTitleInLanguage = getContentNameByLanguage(name, userLanguage);
        await logAction(
          userId,
          'update_content_title',
          `تم تعديل عنوان محتوى للجان من: ${oldContentTitleInLanguage} إلى: ${newContentTitleInLanguage}`,
          'content',
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
      const userLanguage = getUserLanguageFromToken(token);
      
      try {
        const contentTitleInLanguage = getContentNameByLanguage(contentTitle, userLanguage);
        await logAction(
          userId,
          'delete_content_title',
          `تم حذف عنوان محتوى للجان: ${contentTitleInLanguage}`,
          'content',
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