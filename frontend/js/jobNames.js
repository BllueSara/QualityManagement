// دالة تحميل المسميات (job_names)
async function loadJobNames() {
    try {
        const response = await fetch('http://localhost:3006/api/job-names');
        const result = await response.json();
        
        if (result.success) {
            return result.data;
        } else {
            console.error('خطأ في تحميل المسميات:', result.message);
            return [];
        }
    } catch (error) {
        console.error('خطأ في تحميل المسميات:', error);
        return [];
    }
}

// دالة إضافة مسمى جديد
async function addJobName(name) {
    try {
        const response = await fetch('http://localhost:3006/api/job-names', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name })
        });
        
        const result = await response.json();
        
        if (result.success) {
            return result.data;
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('خطأ في إضافة المسمى:', error);
        throw error;
    }
}

// دالة تحديث قائمة المسميات في select
function updateJobNamesSelect(selectElement, jobNames, selectedValue = '') {
    // حفظ القيمة المحددة حالياً
    const currentValue = selectElement.value;
    
    // مسح الخيارات الموجودة (مع الاحتفاظ بالخيارات الخاصة)
    const specialOptions = Array.from(selectElement.querySelectorAll('option[value^="__"]'));
    selectElement.innerHTML = '';
    
    // إعادة إضافة الخيارات الخاصة
    specialOptions.forEach(option => {
        selectElement.appendChild(option.cloneNode(true));
    });
    
    // إضافة الخيارات الجديدة
    jobNames.forEach(jobName => {
        const option = document.createElement('option');
        option.value = jobName.id;
        option.textContent = jobName.name;
        selectElement.appendChild(option);
    });
    
    // إعادة تحديد القيمة السابقة إذا كانت موجودة
    if (selectedValue && selectElement.querySelector(`option[value="${selectedValue}"]`)) {
        selectElement.value = selectedValue;
    } else if (currentValue && selectElement.querySelector(`option[value="${currentValue}"]`)) {
        selectElement.value = currentValue;
    }
}

// منع التهيئة المتكررة على مستوى الملف
if (window.jobNamesScriptLoaded) {
    console.log('Job names script already loaded, exiting...');
    throw new Error('Script already loaded');
}
window.jobNamesScriptLoaded = true;

// متغير لتتبع حالة التهيئة
let jobNamesInitialized = false;

// دالة تهيئة إدارة المسميات
function initializeJobNamesManagement() {
    // تجنب التهيئة المتكررة
    if (jobNamesInitialized || window.jobNamesGlobalInitialized || window.jobNamesInitializing) {
        console.log('Job names already initialized, skipping...');
        return;
    }
    jobNamesInitialized = true;
    window.jobNamesGlobalInitialized = true;
    window.jobNamesInitializing = true;
    
    // البحث عن جميع عناصر select للمسميات
    const jobNameSelects = document.querySelectorAll('select[name="job_name"], #reg-job-name');
    
    jobNameSelects.forEach(select => {
        // تحميل المسميات عند تحميل الصفحة - مرة واحدة فقط
        if (!select.hasAttribute('data-job-names-loaded') && !select.hasAttribute('data-job-names-loading') && !select.hasAttribute('data-job-names-requested')) {
            select.setAttribute('data-job-names-requested', 'true');
            select.setAttribute('data-job-names-loading', 'true');
            loadJobNames().then(jobNames => {
                updateJobNamesSelect(select, jobNames);
                select.setAttribute('data-job-names-loaded', 'true');
                select.removeAttribute('data-job-names-loading');
            }).catch(() => {
                select.removeAttribute('data-job-names-loading');
            });
        }
        
        // مراقبة التغييرات - إزالة event listeners السابقة لتجنب التكرار
        if (typeof jobNameSelectChangeHandler !== 'undefined') {
            select.removeEventListener('change', jobNameSelectChangeHandler);
        }
        select.addEventListener('change', jobNameSelectChangeHandler);
    });
    
    function jobNameSelectChangeHandler() {
        if (this.value === '__ADD_NEW_JOB_NAME__') {
            // إظهار modal إضافة مسمى جديد
            const modal = document.getElementById('addJobNameModal');
            if (modal) {
                modal.style.display = 'flex';
            }
        }
    }
    
    // إعداد modal إضافة مسمى جديد
    const addJobNameModal = document.getElementById('addJobNameModal');
    if (addJobNameModal && !addJobNameModal.hasAttribute('data-events-added')) {
        const saveBtn = addJobNameModal.querySelector('#saveAddJobName');
        const cancelBtn = addJobNameModal.querySelector('#cancelAddJobName');
        const nameInput = addJobNameModal.querySelector('#jobNameName');
        
        // حفظ المسمى الجديد
        saveBtn.addEventListener('click', async () => {
            const name = nameInput.value.trim();
            if (!name) {
                alert('يرجى إدخال اسم المسمى');
                return;
            }
            
            try {
                const newJobName = await addJobName(name);
                
                // إغلاق modal
                addJobNameModal.style.display = 'none';
                nameInput.value = '';
                
                // إضافة المسمى الجديد للقوائم بدون إعادة تحميل كاملة
                jobNameSelects.forEach(select => {
                    // إضافة الخيار الجديد
                    const newOption = document.createElement('option');
                    newOption.value = newJobName.id;
                    newOption.textContent = newJobName.name;
                    
                    // إضافة الخيار قبل خيار "إضافة جديد"
                    const addNewOption = select.querySelector('option[value="__ADD_NEW_JOB_NAME__"]');
                    if (addNewOption) {
                        select.insertBefore(newOption, addNewOption);
                    } else {
                        select.appendChild(newOption);
                    }
                    
                    // تحديد المسمى الجديد
                    select.value = newJobName.id;
                });
                
                showToast('تم إضافة المسمى بنجاح', 'success');
            } catch (error) {
                showToast(error.message, 'error');
            }
        });
        
        // إلغاء
        cancelBtn.addEventListener('click', () => {
            addJobNameModal.style.display = 'none';
            nameInput.value = '';
        });
        
        // إغلاق modal عند النقر خارجه
        addJobNameModal.addEventListener('click', (e) => {
            if (e.target === addJobNameModal) {
                addJobNameModal.style.display = 'none';
                nameInput.value = '';
            }
        });
        
        // علامة أن الأحداث تم إضافتها
        addJobNameModal.setAttribute('data-events-added', 'true');
    }
    
    // إعادة تعيين flag التهيئة
    window.jobNamesInitializing = false;
}

// دالة عرض رسالة toast
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    toastContainer.appendChild(toast);
    
    // إزالة toast بعد 3 ثوان
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 3000);
}

// تصدير الدوال للاستخدام في ملفات أخرى - مرة واحدة فقط
if (!window.jobNamesManager) {
    window.jobNamesManager = {
        loadJobNames,
        addJobName,
        updateJobNamesSelect,
        initializeJobNamesManagement
    };
}

