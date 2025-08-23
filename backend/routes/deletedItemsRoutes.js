const express = require('express');
const router = express.Router();
const { getDeletedItems } = require('../utils/softDelete');
const { authenticateToken } = require('../controllers/authController');

/**
 * جلب العناصر المحذوفة للمستخدم الحالي
 * GET /api/deleted-items/:table
 */
router.get('/:table', authenticateToken, async (req, res) => {
    try {
        const { table } = req.params;
        const userId = req.user.id;
        

        // الجداول المسموح بها
        const allowedTables = [
            'departments', 
            'committees', 
            'protocols', 
            'committee_folders',
            'committee_contents',
            'folders',
            'contents',
            'tickets'
        ];
        
        if (!allowedTables.includes(table)) {
            return res.status(400).json({
                status: 'error',
                message: 'جدول غير مسموح'
            });
        }
        
        // جلب العناصر المحذوفة مع فلترة حسب المستخدم الحالي
        let deletedItems = [];
        
        console.log(`جاري جلب العناصر المحذوفة من جدول: ${table} للمستخدم: ${userId}`);
        
        switch (table) {
            case 'departments':
                // جلب الأقسام المحذوفة - نعرض فقط الأقسام التي حذفها المستخدم
                deletedItems = await getDeletedItemsByUser(table, userId, 'deleted_by');
                break;
                
            case 'committees':
                // جلب اللجان المحذوفة - نعرض فقط اللجان التي حذفها المستخدم
                deletedItems = await getDeletedItemsByUser(table, userId, 'deleted_by');
                break;
                
            case 'protocols':
                // جلب البروتوكولات المحذوفة التي حذفها المستخدم
                deletedItems = await getDeletedItemsByUser(table, userId, 'deleted_by');
                break;
                
            case 'committee_folders':
                // جلب المجلدات المحذوفة التي حذفها المستخدم
                deletedItems = await getDeletedItemsByUser(table, userId, 'deleted_by');
                break;
                
            case 'committee_contents':
                // جلب المحتويات المحذوفة التي حذفها المستخدم
                deletedItems = await getDeletedItemsByUser(table, userId, 'deleted_by');
                break;
                
            case 'folders':
                // جلب المجلدات المحذوفة التي حذفها المستخدم
                deletedItems = await getDeletedItemsByUser(table, userId, 'deleted_by');
                break;
                
            case 'contents':
                // جلب المحتويات المحذوفة التي حذفها المستخدم
                deletedItems = await getDeletedItemsByUser(table, userId, 'deleted_by');
                break;
                
            case 'tickets':
                // جلب التذاكر المحذوفة التي حذفها المستخدم
                deletedItems = await getDeletedItemsByUser(table, userId, 'deleted_by');
                break;
                
            default:
                deletedItems = [];
        }
        
        console.log(`تم العثور على ${deletedItems.length} عنصر محذوف`);
        
        
        res.status(200).json({
            status: 'success',
            data: deletedItems
        });
        
    } catch (error) {
        console.error('خطأ في جلب العناصر المحذوفة:', error);
        res.status(500).json({
            status: 'error',
            message: 'حدث خطأ في جلب العناصر المحذوفة'
        });
    }
});

/**
 * دالة مساعدة لجلب العناصر المحذوفة حسب المستخدم
 */
async function getDeletedItemsByUser(table, userId, userField) {
    const { db } = require('../utils/softDelete');
    
    try {
        let query, params;
        
        if (userField) {
            // إذا كان هناك حقل userField، استخدمه في الفلترة
            query = `
                SELECT t.*, 
                       u.username as deleted_by_username
                FROM ${table} t
                LEFT JOIN users u ON u.id = t.deleted_by
                WHERE t.deleted_at IS NOT NULL 
                AND t.${userField} = ?
                ORDER BY t.deleted_at DESC
            `;
            params = [userId];
        } else {
            // إذا لم يكن هناك userField، جلب جميع العناصر المحذوفة (للمستخدمين المسؤولين)
            query = `
                SELECT t.*, 
                       u.username as deleted_by_username
                FROM ${table} t
                LEFT JOIN users u ON u.id = t.deleted_by
                WHERE t.deleted_at IS NOT NULL 
                ORDER BY t.deleted_at DESC
            `;
            params = [];
        }
        

        
        const [rows] = await db.execute(query, params);

        
        return rows;
    } catch (error) {
        console.error(`خطأ في جلب العناصر المحذوفة من ${table}:`, error);
        return [];
    }
}

/**
 * دالة مساعدة لجلب العناصر المحذوفة في اللجان حسب المستخدم
 * تجلب فقط العناصر التي حذفها المستخدم نفسه
 */
async function getCommitteeDeletedItemsByUser(table, userId) {
    const { db } = require('../utils/softDelete');
    
    try {
        // جلب اللجان التي ينتمي إليها المستخدم
        const [userCommittees] = await db.execute(`
            SELECT committee_id FROM committee_users 
            WHERE user_id = ? AND deleted_at IS NULL
        `, [userId]);
        
        console.log(`getCommitteeDeletedItemsByUser: لجان المستخدم:`, userCommittees);
        
        if (userCommittees.length === 0) {
            console.log(`getCommitteeDeletedItemsByUser: المستخدم لا ينتمي لأي لجنة`);
            return [];
        }
        
        const committeeIds = userCommittees.map(c => c.committee_id);
        const placeholders = committeeIds.map(() => '?').join(',');
        console.log(`getCommitteeDeletedItemsByUser: معرفات اللجان:`, committeeIds);
        
        const query = `
            SELECT t.*, 
                   u.username as deleted_by_username,
                   c.name as committee_name
            FROM ${table} t
            LEFT JOIN users u ON u.id = t.deleted_by
            LEFT JOIN committees c ON c.id = t.committee_id
            WHERE t.deleted_at IS NOT NULL 
            AND t.deleted_by = ?
            AND t.committee_id IN (${placeholders})
            ORDER BY t.deleted_at DESC
        `;
        
        console.log(`getCommitteeDeletedItemsByUser: الاستعلام: ${query}`);
        console.log(`getCommitteeDeletedItemsByUser: المعاملات:`, [userId, ...committeeIds]);
        
        const [rows] = await db.execute(query, [userId, ...committeeIds]);
        
        console.log(`getCommitteeDeletedItemsByUser: تم العثور على ${rows.length} عنصر من جدول ${table}`);
        
        return rows;
    } catch (error) {
        console.error(`خطأ في جلب العناصر المحذوفة من ${table}:`, error);
        return [];
    }
}

/**
 * دالة مساعدة لجلب العناصر المحذوفة في الأقسام حسب المستخدم
 * تجلب فقط العناصر التي حذفها المستخدم نفسه
 */
async function getDepartmentDeletedItemsByUser(table, userId) {
    const { db } = require('../utils/softDelete');
    
    try {
        // جلب القسم الذي ينتمي إليه المستخدم
        const [userDepartment] = await db.execute(`
            SELECT department_id FROM users 
            WHERE id = ? AND deleted_at IS NULL
        `, [userId]);
        
        console.log(`getDepartmentDeletedItemsByUser: معلومات المستخدم:`, userDepartment);
        
        if (userDepartment.length === 0 || !userDepartment[0].department_id) {
            console.log(`getDepartmentDeletedItemsByUser: المستخدم لا ينتمي لأي قسم`);
            return [];
        }
        
        const departmentId = userDepartment[0].department_id;
        console.log(`getDepartmentDeletedItemsByUser: قسم المستخدم: ${departmentId}`);
        
        // بناء الاستعلام حسب نوع الجدول
        let query, params;
        
        if (table === 'contents') {
            // جدول contents يحتوي على folder_id وليس department_id
            // نعرض فقط المحتويات التي حذفها المستخدم من المجلدات التي تنتمي للقسم
            query = `
                SELECT t.*, 
                       u.username as deleted_by_username,
                       d.name as department_name,
                       f.name as folder_name
                FROM ${table} t
                LEFT JOIN users u ON u.id = t.deleted_by
                LEFT JOIN folders f ON f.id = t.folder_id
                LEFT JOIN departments d ON d.id = f.department_id
                WHERE t.deleted_at IS NOT NULL 
                AND t.deleted_by = ?
                AND f.department_id = ?
                ORDER BY t.deleted_at DESC
            `;
            params = [userId, departmentId];
        } else if (table === 'folders') {
            // جدول folders يحتوي على department_id مباشرة
            // نعرض فقط المجلدات التي حذفها المستخدم من القسم
            query = `
                SELECT t.*, 
                   u.username as deleted_by_username,
                   d.name as department_name
                FROM ${table} t
                LEFT JOIN users u ON u.id = t.deleted_by
                LEFT JOIN departments d ON d.id = t.department_id
                WHERE t.deleted_at IS NOT NULL 
                AND t.deleted_by = ?
                AND t.department_id = ?
                ORDER BY t.deleted_at DESC
            `;
            params = [userId, departmentId];
        } else {
            // الجداول الأخرى تحتوي على department_id مباشرة
            // نعرض فقط العناصر التي حذفها المستخدم من القسم
            query = `
                SELECT t.*, 
                   u.username as deleted_by_username,
                   d.name as department_name
                FROM ${table} t
                LEFT JOIN users u ON u.id = t.deleted_by
                LEFT JOIN departments d ON d.id = t.department_id
                WHERE t.deleted_at IS NOT NULL 
                AND t.deleted_by = ?
                AND t.department_id = ?
                ORDER BY t.deleted_at DESC
            `;
            params = [userId, departmentId];
        }
        
        console.log(`getDepartmentDeletedItemsByUser: الاستعلام: ${query}`);
        console.log(`getDepartmentDeletedItemsByUser: المعاملات:`, params);
        
        const [rows] = await db.execute(query, params);
        
        console.log(`getDepartmentDeletedItemsByUser: تم العثور على ${rows.length} عنصر من جدول ${table}`);
        
        return rows;
    } catch (error) {
        console.error(`خطأ في جلب العناصر المحذوفة من ${table}:`, error);
        return [];
    }
}

/**
 * دالة مساعدة لجلب التذاكر المحذوفة حسب المستخدم
 */
async function getTicketsDeletedItemsByUser(table, userId) {
    const { db } = require('../utils/softDelete');
    
    try {
        // جلب التذاكر المحذوفة التي أنشأها المستخدم أو المخصصة له
        const query = `
            SELECT t.*, 
                   u.username as deleted_by_username
            FROM ${table} t
            LEFT JOIN users u ON u.id = t.deleted_by
            WHERE t.deleted_at IS NOT NULL 
            AND (t.created_by = ? OR t.assigned_to = ?)
            ORDER BY t.deleted_at DESC
        `;
        
        console.log(`getTicketsDeletedItemsByUser: الاستعلام: ${query}`);
        console.log(`getTicketsDeletedItemsByUser: المعاملات:`, [userId, userId]);
        
        const [rows] = await db.execute(query, [userId, userId]);
        
        console.log(`getTicketsDeletedItemsByUser: تم العثور على ${rows.length} عنصر من جدول ${table}`);
        
        return rows;
    } catch (error) {
        console.error(`خطأ في جلب التذاكر المحذوفة من ${table}:`, error);
        return [];
    }
}

/**
 * دالة اختبار لفحص قاعدة البيانات
 * GET /api/deleted-items/debug/:table
 */
router.get('/debug/:table', authenticateToken, async (req, res) => {
    try {
        const { table } = req.params;
        const userId = req.user.id;
        
        const { db } = require('../utils/softDelete');
        
        // فحص جميع العناصر المحذوفة في الجدول
        const [allDeleted] = await db.execute(`
            SELECT COUNT(*) as total_deleted FROM ${table} WHERE deleted_at IS NOT NULL
        `);
        
        // فحص العناصر التي حذفها المستخدم
        const [userDeleted] = await db.execute(`
            SELECT COUNT(*) as user_deleted FROM ${table} WHERE deleted_at IS NOT NULL AND deleted_by = ?
        `, [userId]);
        
        // فحص معلومات المستخدم
        const [userInfo] = await db.execute(`
            SELECT id, username, department_id FROM users WHERE id = ?
        `, [userId]);
        
        res.status(200).json({
            status: 'success',
            debug_info: {
                table,
                user_id: userId,
                user_info: userInfo[0],
                total_deleted: allDeleted[0].total_deleted,
                user_deleted: userDeleted[0].user_deleted
            }
        });
        
    } catch (error) {
        console.error('خطأ في فحص قاعدة البيانات:', error);
        res.status(500).json({
            status: 'error',
            message: 'حدث خطأ في فحص قاعدة البيانات',
            error: error.message
        });
    }
});

module.exports = router;
