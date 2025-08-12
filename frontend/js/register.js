// ======================
// دالة إظهار التوست
// ======================
function showToast(message, type = 'info', duration = 3000) {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    // Force reflow
    toast.offsetWidth;

    setTimeout(() => toast.classList.add('show'), 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    }, duration);
}

// ======================
// حماية من التهيئة المكررة
// ======================
if (window.registerScriptInitialized) {
    console.warn("register.js already initialized. Skipping...");
} else {
    window.registerScriptInitialized = true;

            // متغيرات حماية للـ API
        window.departmentsLoaded = false;
        window.jobTitlesLoaded = false;
        window.jobNamesLoaded = false;

    // تهيئة اللغة لمرة واحدة
    if (!window.languageInitialized) {
        if (typeof initializeLanguage === 'function') initializeLanguage();
        if (typeof initializeLanguageSwitcher === 'function') initializeLanguageSwitcher();
        if (typeof initializeLanguageUI === 'function') initializeLanguageUI();
        window.languageInitialized = true;
    }

    document.addEventListener('DOMContentLoaded', function () {
        console.log('register.js script loaded (first init)');

        const registerForm = document.getElementById('registerForm');
        const departmentSelect = document.getElementById('reg-department');
        const firstNameInput = document.getElementById('reg-first-name');
        const secondNameInput = document.getElementById('reg-second-name');
        const thirdNameInput = document.getElementById('reg-third-name');
        const lastNameInput = document.getElementById('reg-last-name');
        const usernameInput = document.getElementById('reg-username');
        const departmentGroup = document.getElementById('departmentGroup');
        const employeeInput = document.getElementById('reg-employee');
        const employeeGroup = document.getElementById('employeeGroup');
        const jobTitleGroup = document.getElementById('jobTitleGroup');
        const firstNameGroup = document.getElementById('firstNameGroup');
        const secondNameGroup = document.getElementById('secondNameGroup');
        const thirdNameGroup = document.getElementById('thirdNameGroup');
        const lastNameGroup = document.getElementById('lastNameGroup');
        const nationalIdGroup = document.getElementById('nationalIdGroup');
        const nationalIdInput = document.getElementById('reg-national-id');

        const jobTitleSelect = document.getElementById('reg-job-title');
        const jobNameSelect = document.getElementById('reg-job-name');



        function checkUsernameAndToggleFields() {
            const username = usernameInput.value.trim().toLowerCase();
            const jobNameGroup = document.getElementById('jobNameGroup');
            const jobNameSelect = document.getElementById('reg-job-name');
            
            if (username === 'admin') {
                [
                    firstNameGroup,
                    secondNameGroup,
                    thirdNameGroup,
                    lastNameGroup,
                    departmentGroup,
                    employeeGroup,
                    jobTitleGroup,
                    jobNameGroup,
                    nationalIdGroup
                ].forEach(el => {
                    if (el) el.style.display = 'none';
                });

                [
                    firstNameInput,
                    lastNameInput,
                    departmentSelect,
                    employeeInput,
                    document.getElementById('reg-job-title'),
                    jobNameSelect,
                    nationalIdInput
                ].forEach(el => {
                    if (el) el.removeAttribute('required');
                });

                [
                    firstNameInput,
                    secondNameInput,
                    thirdNameInput,
                    lastNameInput,
                    departmentSelect,
                    employeeInput,
                    document.getElementById('reg-job-title'),
                    jobNameSelect,
                    nationalIdInput
                ].forEach(el => {
                    if (el) el.value = '';
                });

            } else {
                [
                    firstNameGroup,
                    secondNameGroup,
                    thirdNameGroup,
                    lastNameGroup,
                    departmentGroup,
                    employeeGroup,
                    jobTitleGroup,
                    jobNameGroup,
                    nationalIdGroup
                ].forEach(el => {
                    if (el) el.style.display = 'block';
                });

                [
                    firstNameInput,
                    lastNameInput,
                    departmentSelect,
                    employeeInput,
                    document.getElementById('reg-job-title'),
                    jobNameSelect,
                    nationalIdInput
                ].forEach(el => {
                    if (el) el.setAttribute('required', 'required');
                });
            }
        }

        function validateNationalId(nationalId) {
            return /^\d{10}$/.test(nationalId) && !nationalId.startsWith('0');
        }

        // ======================
        // تحميل الأقسام
        // ======================
        async function fetchDepartments() {
            if (window.departmentsLoaded) return;
            try {
                console.log('🔍 Fetching departments...');
                const response = await fetch('http://10.99.28.23:3006/api/departments/all');
                if (!response.ok) throw new Error(`فشل جلب الأقسام: ${response.status}`);
                const result = await response.json();
                console.log('🔍 Departments response:', result);
                
                const departments = Array.isArray(result) ? result : (result.data || []);
                console.log('🔍 Departments array:', departments);
                
                if (!departmentSelect) {
                    console.error('❌ departmentSelect element not found');
                    return;
                }
                
                const lang = localStorage.getItem('language') || 'ar';
                departmentSelect.innerHTML = `<option value="">${lang === 'ar' ? 'اختر القسم' : 'Select Department'}</option>`;
                
                departments.forEach(dept => {
                    let parsed;
                    try { parsed = JSON.parse(dept.name); }
                    catch { parsed = { ar: dept.name, en: dept.name }; }
                    const label = parsed[lang] ?? parsed.ar ?? parsed.en;
                    const opt = document.createElement('option');
                    opt.value = dept.id;
                    opt.textContent = label;
                    departmentSelect.appendChild(opt);
                });
                
                console.log('✅ Departments loaded successfully:', departments.length, 'items');
                window.departmentsLoaded = true;
            } catch (err) {
                console.error('❌ Error fetching departments:', err);
                showToast(err.message, 'error');
            }
        }

        // ======================
        // تحميل المسميات الإدارية
        // ======================
        async function fetchJobTitles() {
            if (window.jobTitlesLoaded) return;
            try {
                console.log('🔍 Fetching job titles...');
                const response = await fetch('http://10.99.28.23:3006/api/job-titles');
                if (!response.ok) throw new Error(`فشل جلب المناصب الإدارية: ${response.status}`);
                const result = await response.json();
                console.log('🔍 Job titles response:', result);
                
                const jobTitles = Array.isArray(result) ? result : (result.data || []);
                console.log('🔍 Job titles array:', jobTitles);
                
                if (!jobTitleSelect) {
                    console.error('❌ jobTitleSelect element not found');
                    return;
                }
                
                const lang = localStorage.getItem('language') || 'ar';
                jobTitleSelect.innerHTML = `<option value="">${lang === 'ar' ? 'اختر المنصب الإداري' : 'Select Administrative Position'}</option>`;
                
                jobTitles.forEach(jobTitle => {
                    const opt = document.createElement('option');
                    opt.value = jobTitle.id;
                    opt.textContent = jobTitle.title;
                    jobTitleSelect.appendChild(opt);
                });
                
                console.log('✅ Job titles loaded successfully:', jobTitles.length, 'items');
                window.jobTitlesLoaded = true;
            } catch (err) {
                console.error('❌ Error fetching job titles:', err);
                showToast(err.message, 'error');
            }
        }

        // ======================
        // تحميل المسميات الوظيفية (Job Names)
        // ======================
        async function fetchJobNames() {
            if (window.jobNamesLoaded) return;
            try {
                console.log('🔍 Fetching job names...');
                const response = await fetch('http://10.99.28.23:3006/api/job-names');
                if (!response.ok) throw new Error(`فشل جلب المسميات الوظيفية: ${response.status}`);
                const result = await response.json();
                console.log('🔍 Job names response:', result);
                
                const jobNames = Array.isArray(result) ? result : (result.data || []);
                console.log('🔍 Job names array:', jobNames);
                
                if (!jobNameSelect) {
                    console.error('❌ jobNameSelect element not found');
                    return;
                }
                
                const lang = localStorage.getItem('language') || 'ar';
                jobNameSelect.innerHTML = `<option value="">${lang === 'ar' ? 'اختر المسمى الوظيفي' : 'Select Job Name'}</option>`;
                
                jobNames.forEach(jobName => {
                    const opt = document.createElement('option');
                    opt.value = jobName.id;
                    opt.textContent = jobName.name;
                    jobNameSelect.appendChild(opt);
                });
                
                console.log('✅ Job names loaded successfully:', jobNames.length, 'items');
                window.jobNamesLoaded = true;
            } catch (err) {
                console.error('❌ Error fetching job names:', err);
                showToast(err.message, 'error');
            }
        }

        // ======================
        // الاستدعاء مرة واحدة فقط
        // ======================
        console.log('🔍 Starting to fetch data...');
        console.log('🔍 departmentSelect exists:', !!departmentSelect);
        console.log('🔍 jobTitleSelect exists:', !!jobTitleSelect);
        console.log('🔍 jobNameSelect exists:', !!jobNameSelect);
        
        if (departmentSelect) {
            fetchDepartments();
        } else {
            console.error('❌ departmentSelect not found, skipping departments fetch');
        }
        
        if (jobTitleSelect) {
            fetchJobTitles();
        } else {
            console.error('❌ jobTitleSelect not found, skipping job titles fetch');
        }
        
        if (jobNameSelect) {
            fetchJobNames();
        } else {
            console.error('❌ jobNameSelect not found, skipping job names fetch');
        }

        // ======================
        // منع تكرار storage event من نفس الصفحة
        // ======================
        if (!window.registerStorageListener) {
            window.addEventListener('storage', function (e) {
                if (e.key === 'language' && e.oldValue !== e.newValue) {
                    window.departmentsLoaded = false;
                    window.jobTitlesLoaded = false;
                    window.jobNamesLoaded = false;
                    fetchDepartments();
                    fetchJobTitles();
                    fetchJobNames();
                }
            });
            window.registerStorageListener = true;
        }

        // ======================
        // إعداد الأحداث
        // ======================
        
        // مراقبة تغييرات اسم المستخدم
        usernameInput.addEventListener('input', checkUsernameAndToggleFields);
        usernameInput.addEventListener('blur', checkUsernameAndToggleFields);
        checkUsernameAndToggleFields();

        // مراقبة تغييرات رقم الهوية
        nationalIdInput.addEventListener('input', function() {
            const value = this.value;
            this.value = value.replace(/[^0-9]/g, '');
            if (value.length > 10) {
                this.value = value.slice(0, 10);
            }
        });

        nationalIdInput.addEventListener('blur', function() {
            const value = this.value.trim();
            if (value && !validateNationalId(value)) {
                showToast('رقم الهوية يجب أن يكون 10 أرقام ولا يبدأ بصفر', 'error');
                this.focus();
            }
        });



        // ======================
        // معالجة النموذج
        // ======================
        if (registerForm) {
            registerForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const username = usernameInput.value.trim();
                const isAdmin = username.toLowerCase() === 'admin';
                
                // التحقق من البيانات المطلوبة
                if (!username) {
                    showToast('اسم المستخدم مطلوب', 'error');
                    return;
                }
                
                const email = document.getElementById('reg-email')?.value.trim();
                if (!email) {
                    showToast('البريد الإلكتروني مطلوب', 'error');
                    return;
                }
                
                const password = document.getElementById('reg-password')?.value;
                const confirmPassword = document.getElementById('reg-confirm-password')?.value;
                
                if (password !== confirmPassword) {
                    showToast('كلمتا المرور غير متطابقتين', 'error');
                    return;
                }
                
                // التحقق من البيانات الإضافية للمستخدمين العاديين
                if (!isAdmin) {
                    if (!firstNameInput.value.trim() || !lastNameInput.value.trim()) {
                        showToast('الاسم الأول واسم العائلة مطلوبان', 'error');
                        return;
                    }
                    
                    if (!departmentSelect.value) {
                        showToast('يرجى اختيار القسم', 'error');
                        return;
                    }
                    
                    if (!employeeInput.value.trim()) {
                        showToast('الرقم الوظيفي مطلوب', 'error');
                        return;
                    }
                    
                    if (!document.getElementById('reg-job-title')?.value) {
                        showToast('يرجى اختيار المنصب الإداري', 'error');
                        return;
                    }
                    
                    if (!document.getElementById('reg-job-name')?.value) {
                        showToast('يرجى اختيار المسمى الوظيفي', 'error');
                        return;
                    }
                    
                    if (!nationalIdInput.value.trim()) {
                        showToast('رقم الهوية مطلوب', 'error');
                        return;
                    }
                    
                    if (!validateNationalId(nationalIdInput.value.trim())) {
                        showToast('رقم الهوية غير صحيح', 'error');
                        return;
                    }
                }
                
                const formData = {
                    username: username,
                    email: email,
                    password: password,
                    first_name: isAdmin ? '' : firstNameInput.value.trim(),
                    second_name: isAdmin ? '' : secondNameInput.value.trim(),
                    third_name: isAdmin ? '' : thirdNameInput.value.trim(),
                    last_name: isAdmin ? '' : lastNameInput.value.trim(),
                    department_id: isAdmin ? '' : departmentSelect.value,
                    employee_number: isAdmin ? '' : employeeInput.value.trim(),
                    job_title_id: isAdmin ? '' : document.getElementById('reg-job-title').value,
                    job_name_id: isAdmin ? '' : document.getElementById('reg-job-name').value,
                    national_id: isAdmin ? '' : nationalIdInput.value.trim()
                };
                
                const submitBtn = this.querySelector('button[type="submit"]');
                const originalText = submitBtn.textContent;
                
                try {
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'جاري التسجيل...';
                    
                    const response = await fetch('http://10.99.28.23:3006/api/auth/register', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(formData)
                    });
                    
                    const result = await response.json();
                    
                    if (response.ok) {
                        showToast('تم التسجيل بنجاح! جاري توجيهك للصفحة الرئيسية...', 'success');
                        
                        // حفظ التوكن في localStorage
                        if (result.token) {
                            localStorage.setItem('token', result.token);
                        }
                        
                        // التوجيه للصفحة الرئيسية مباشرة
                        setTimeout(() => {
                            window.location.href = '/frontend/html/index.html';
                        }, 1500);
                    } else {
                        showToast(result.message || 'فشل في التسجيل', 'error');
                    }
                } catch (error) {
                    console.error('خطأ في التسجيل:', error);
                    showToast('حدث خطأ أثناء التسجيل', 'error');
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                }
            });
        }






    });
}  