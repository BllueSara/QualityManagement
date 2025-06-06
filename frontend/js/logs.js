 /**
 * script.js
 * ------------- 
 * منطق الفلترة والبحث في صفحة "سجلات النظام".
 * نفترض أن جدول السجلات محمّل مسبقًا في الذاكرة (DOM).
 */

document.addEventListener('DOMContentLoaded', function () {
    // 1. الحصول على المراجع لعناصر الفلترة والزرّين والجدول
    const fromDateInput   = document.getElementById('from-date');      // حقل "من تاريخ"
    const toDateInput     = document.getElementById('to-date');        // حقل "إلى تاريخ"
    const actionTypeSelect= document.getElementById('action-type');    // قائمة نوع الإجراء
    const userNameSelect  = document.getElementById('user-name');      // قائمة المستخدمين
    const searchInput     = document.getElementById('search-input');   // حقل البحث
    const applyBtn        = document.getElementById('apply-filter');   // زر "تطبيق التصفية"
    const resetBtn        = document.getElementById('reset-filter');   // زر "إعادة التعيين"
    const logsBody        = document.getElementById('logs-body');      // جسم الجدول (<tbody>)

    // 2. دالة تبين أو تخفي صفوف الجدول بناءً على شروط الفلترة
    function filterTable() {
        // قراءة القيم المدخلة في حقول الفلترة
        const fromDateValue    = fromDateInput.value ? new Date(fromDateInput.value) : null;
        const toDateValue      = toDateInput.value   ? new Date(toDateInput.value)   : null;
        const selectedAction   = actionTypeSelect.value;
        const selectedUser     = userNameSelect.value;
        const searchKeyword    = searchInput.value.trim().toLowerCase();

        // المرور على كل صف داخل <tbody>
        Array.from(logsBody.rows).forEach(row => {
            // قراءة قيم data-attributes من السطر
            const rowDateStr   = row.getAttribute('data-date');          // مثال: "2024-01-22T09:15:00"
            const rowDate      = rowDateStr ? new Date(rowDateStr) : null;
            const rowUser      = row.getAttribute('data-user') || '';
            const rowAction    = row.getAttribute('data-action') || '';
            const rowText      = row.innerText.trim().toLowerCase();     // نص كامل الصف لأجل البحث النصي

            let isVisible = true; // افتراض: نُظهر الصفّ ما لم يُخالف شرطًا

            // 2.1. فلترة التاريخ (إن تم تحديد “من تاريخ” أو “إلى تاريخ”)
            if (fromDateValue && rowDate) {
                // إذا كان تاريخ الصف أقلّ من "من تاريخ" => أخفِه
                if (rowDate < fromDateValue) {
                    isVisible = false;
                }
            }
            if (isVisible && toDateValue && rowDate) {
                // إذا كان تاريخ الصف أكبر من "إلى تاريخ" (في نهاية اليوم) => أخفِه
                // نضيف آخر اليوم لليوم المحدد في toDateValue
                const endOfToDate = new Date(toDateValue);
                endOfToDate.setHours(23, 59, 59);
                if (rowDate > endOfToDate) {
                    isVisible = false;
                }
            }

            // 2.2. فلترة اسم المستخدم (إن اختار المستخدم قيمة غير فارغة)
            if (isVisible && selectedUser) {
                if (rowUser !== selectedUser) {
                    isVisible = false;
                }
            }

            // 2.3. فلترة نوع الإجراء (إن اختار قيمة غير فارغة)
            if (isVisible && selectedAction) {
                if (rowAction !== selectedAction) {
                    isVisible = false;
                }
            }

            // 2.4. البحث النصي (إن كان هناك كلمة للبحث)
            if (isVisible && searchKeyword) {
                if (!rowText.includes(searchKeyword)) {
                    isVisible = false;
                }
            }

            // أخيرًا، إظهار الصف أو إخفاؤه
            row.style.display = isVisible ? '' : 'none';
        });
    }

    // 3. دالة لإعادة تهيئة (Reset) جميع الفلاتر وإظهار كل الصفوف
    function resetFilters() {
        fromDateInput.value    = '';
        toDateInput.value      = '';
        actionTypeSelect.value = '';
        userNameSelect.value   = '';
        searchInput.value      = '';

        // إظهار كل الصفوف
        Array.from(logsBody.rows).forEach(row => {
            row.style.display = '';
        });
    }

    // 4. إضافة مستمع إلى زرّ "تطبيق التصفية"
    applyBtn.addEventListener('click', function (e) {
        e.preventDefault(); // منع السلوك الافتراضي (إن وُجد)
        filterTable();
    });

    // 5. إضافة مستمع إلى زرّ "إعادة التعيين"
    resetBtn.addEventListener('click', function (e) {
        e.preventDefault();
        resetFilters();
    });

    // 6. إضافة مستمع عند كتابة نص في حقل البحث ليُنفّذ البحث فوريًا
    searchInput.addEventListener('input', function () {
        filterTable();
    });
});
