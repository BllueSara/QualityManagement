const mysql = require('mysql2/promise');

const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Rawad12-',
    database: process.env.DB_NAME || 'Quality'
});

/**
 * إضافة حقل deleted_at للجداول التي لا تحتويه
 */
const addSoftDeleteColumns = async () => {
    const tables = [
        'users',
        'departments', 
        'folders',
        'contents',
        'committees',
        'committee_folders',
        'committee_contents',
        'tickets',
        'job_names',
        'job_titles',
        'permissions',
        'classifications',
        'harm_levels'
    ];

    for (const table of tables) {
        try {
            // تحقق من وجود العمود أولاً
            const [columns] = await db.execute(`SHOW COLUMNS FROM ${table} LIKE 'deleted_at'`);
            
            if (columns.length === 0) {
                // إضافة العمود إذا لم يكن موجوداً
                await db.execute(`
                    ALTER TABLE ${table} 
                    ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL,
                    ADD COLUMN deleted_by INT NULL DEFAULT NULL,
                    ADD INDEX idx_deleted_at (deleted_at)
                `);
                console.log(`✅ تم إضافة حقول soft delete إلى جدول ${table}`);
            } else {
                console.log(`⚠️ حقول soft delete موجودة بالفعل في جدول ${table}`);
            }
        } catch (error) {
            console.error(`❌ خطأ في إضافة حقول soft delete لجدول ${table}:`, error.message);
        }
    }
};

/**
 * تحديث جدول protocols لاستخدام deleted_at بدلاً من status
 */
const updateProtocolsTable = async () => {
    try {
        // تحقق من وجود العمود deleted_at
        const [columns] = await db.execute(`SHOW COLUMNS FROM protocols LIKE 'deleted_at'`);
        
        if (columns.length === 0) {
            await db.execute(`
                ALTER TABLE protocols 
                ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL,
                ADD COLUMN deleted_by INT NULL DEFAULT NULL,
                ADD INDEX idx_protocols_deleted_at (deleted_at)
            `);
            
            // تحويل السجلات التي لها status = 'deleted'
            await db.execute(`
                UPDATE protocols 
                SET deleted_at = NOW() 
                WHERE status = 'deleted'
            `);
            
            console.log('✅ تم تحديث جدول protocols لاستخدام soft delete');
        }
    } catch (error) {
        console.error('❌ خطأ في تحديث جدول protocols:', error.message);
    }
};

/**
 * دالة soft delete للجداول
 */
const softDelete = async (table, id, deletedBy = null) => {
    try {
        const [result] = await db.execute(`
            UPDATE ${table} 
            SET deleted_at = NOW(), deleted_by = ? 
            WHERE id = ? AND deleted_at IS NULL
        `, [deletedBy, id]);
        
        return result.affectedRows > 0;
    } catch (error) {
        console.error(`خطأ في soft delete من جدول ${table}:`, error);
        throw error;
    }
};

/**
 * دالة استرجاع العناصر المحذوفة
 */
const restoreDeleted = async (table, id) => {
    try {
        const [result] = await db.execute(`
            UPDATE ${table} 
            SET deleted_at = NULL, deleted_by = NULL 
            WHERE id = ? AND deleted_at IS NOT NULL
        `, [id]);
        
        return result.affectedRows > 0;
    } catch (error) {
        console.error(`خطأ في استرجاع من جدول ${table}:`, error);
        throw error;
    }
};

/**
 * دالة الحذف النهائي (للسوبر أدمن فقط)
 */
const permanentDelete = async (table, id) => {
    try {
        const [result] = await db.execute(`
            DELETE FROM ${table} WHERE id = ? AND deleted_at IS NOT NULL
        `, [id]);
        
        return result.affectedRows > 0;
    } catch (error) {
        console.error(`خطأ في الحذف النهائي من جدول ${table}:`, error);
        throw error;
    }
};

/**
 * جلب العناصر المحذوفة لجدول معين
 */
const getDeletedItems = async (table, limit = 100, offset = 0) => {
    try {
        // تأكد من أن المعاملات أرقام ومنع SQL injection
        const numLimit = Math.max(1, Math.min(1000, parseInt(limit) || 100));
        const numOffset = Math.max(0, parseInt(offset) || 0);
        
        const [rows] = await db.execute(`
            SELECT t.*, 
                   u.username as deleted_by_username
            FROM ${table} t
            LEFT JOIN users u ON u.id = t.deleted_by
            WHERE t.deleted_at IS NOT NULL 
            ORDER BY t.deleted_at DESC 
            LIMIT ${numOffset}, ${numLimit}
        `);
        
        return rows;
    } catch (error) {
        console.error(`خطأ في جلب العناصر المحذوفة من جدول ${table}:`, error);
        throw error;
    }
};

/**
 * تعديل جميع الاستعلامات لتجاهل العناصر المحذوفة
 */
const addDeletedFilter = (sql, alias = '') => {
    const tablePrefix = alias ? `${alias}.` : '';
    
    // إذا كان الاستعلام يحتوي على WHERE clause
    if (sql.toLowerCase().includes('where')) {
        return sql.replace(
            /where/i,
            `WHERE ${tablePrefix}deleted_at IS NULL AND`
        );
    } else {
        // إذا لم يكن هناك WHERE clause
        return sql + ` WHERE ${tablePrefix}deleted_at IS NULL`;
    }
};

/**
 * إحصائيات العناصر المحذوفة
 */
const getDeletedStats = async () => {
    const tables = [
        'users', 'departments', 'folders', 'contents', 
        'committees', 'committee_folders', 'committee_contents',
        'tickets', 'protocols', 'job_names', 'job_titles',
        'permissions', 'classifications', 'harm_levels'
    ];
    
    const stats = {};
    
    for (const table of tables) {
        try {
            const [result] = await db.execute(`
                SELECT COUNT(*) as count FROM ${table} WHERE deleted_at IS NOT NULL
            `);
            stats[table] = result[0].count;
        } catch (error) {
            stats[table] = 0;
        }
    }
    
    return stats;
};

module.exports = {
    addSoftDeleteColumns,
    updateProtocolsTable,
    softDelete,
    restoreDeleted,
    permanentDelete,
    getDeletedItems,
    addDeletedFilter,
    getDeletedStats,
    db
};
