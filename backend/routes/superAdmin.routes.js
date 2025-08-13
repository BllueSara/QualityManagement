const express = require('express');
const router = express.Router();
const {
    checkSuperAdminAuth,
    getDeletedStatistics,
    getDeletedItemsByTable,
    getAllDeletedItems,
    restoreDeletedItem,
    restoreAllItemsByTable,
    restoreAllItems,
    permanentDeleteItem,
    permanentDeleteAllByTable,
    permanentDeleteAllItems
} = require('../controllers/superAdminController');

// تطبيق middleware التحقق من صلاحيات السوبر أدمن على جميع المسارات
router.use(checkSuperAdminAuth);

// جلب إحصائيات العناصر المحذوفة
router.get('/deleted-stats', getDeletedStatistics);

// جلب جميع العناصر المحذوفة من جميع الجداول
router.get('/deleted-all', getAllDeletedItems);

// جلب العناصر المحذوفة لجدول معين
router.get('/deleted/:table', getDeletedItemsByTable);

// استرجاع عنصر محذوف
router.post('/restore/:table/:id', restoreDeletedItem);

// استرجاع جميع العناصر المحذوفة من جدول معين
router.post('/restore-all/:table', restoreAllItemsByTable);

// استرجاع جميع العناصر المحذوفة من جميع الجداول
router.post('/restore-all', restoreAllItems);

// حذف عنصر نهائياً
router.delete('/permanent-delete/:table/:id', permanentDeleteItem);

// حذف جميع العناصر المحذوفة لجدول معين نهائياً
router.delete('/permanent-delete-all/:table', permanentDeleteAllByTable);

// حذف جميع العناصر المحذوفة من جميع الجداول نهائياً
router.delete('/permanent-delete-all', permanentDeleteAllItems);

module.exports = router;
