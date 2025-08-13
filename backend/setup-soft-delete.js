/**
 * Script لإعداد نظام Soft Delete
 * يقوم بإضافة حقول deleted_at و deleted_by لجميع الجداول
 */

const { addSoftDeleteColumns, updateProtocolsTable } = require('./utils/softDelete');

async function setupSoftDelete() {
    console.log('🚀 بدء إعداد نظام Soft Delete...\n');
    
    try {
        // إضافة حقول soft delete للجداول
        console.log('📦 إضافة حقول soft delete للجداول...');
        await addSoftDeleteColumns();
        
        console.log('\n📋 تحديث جدول protocols...');
        await updateProtocolsTable();
        
        console.log('\n✅ تم إعداد نظام Soft Delete بنجاح!');
        console.log('\n📝 الخطوات التالية:');
        console.log('1. تأكد من أن جميع الاستعلامات تتضمن "AND deleted_at IS NULL"');
        console.log('2. قم بتحديث جميع دوال الحذف لاستخدام UPDATE بدلاً من DELETE');
        console.log('3. استخدم صفحة السوبر أدمن لإدارة العناصر المحذوفة');
        
    } catch (error) {
        console.error('❌ خطأ في إعداد نظام Soft Delete:', error);
        // لا نخرج من العملية عند استيراد الدالة في السيرفر
        if (require.main === module) {
            process.exit(1);
        }
        throw error; // إعادة رمي الخطأ للتعامل معه في السيرفر
    }
    
    // لا نخرج من العملية عند استيراد الدالة في السيرفر
    if (require.main === module) {
        process.exit(0);
    }
}

// تشغيل السكريبت
if (require.main === module) {
    setupSoftDelete();
}

module.exports = { setupSoftDelete };
