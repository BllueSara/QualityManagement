// manage-settings.js
const apiBase = 'http://localhost:3006/api';

// دالة إظهار التوست - خارج DOMContentLoaded لتكون متاحة في كل مكان
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

    // Force reflow to ensure animation plays from start
    toast.offsetWidth; 

    // تفعيل التوست
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Set a timeout to remove the toast
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 500);
    }, duration);
}

document.addEventListener('DOMContentLoaded', async function() {
    // Get references to elements
    const addDepartmentBtn = document.getElementById('addDepartmentBtn');
    const addClassificationBtn = document.getElementById('addClassificationBtn');
    const addHarmLevelBtn = document.getElementById('addHarmLevelBtn');

    // Search inputs
    const departmentSearch = document.getElementById('departmentSearch');
    const classificationSearch = document.getElementById('classificationSearch');
    const harmLevelSearch = document.getElementById('harmLevelSearch');

    // Lists containers
    const departmentsList = document.getElementById('departmentsList');
    const classificationsList = document.getElementById('classificationsList');
    const harmLevelsList = document.getElementById('harmLevelsList');

    // Modal elements
    const addDepartmentModal = document.getElementById('addDepartmentModal');
    const editDepartmentModal = document.getElementById('editDepartmentModal');
    const addClassificationModal = document.getElementById('addClassificationModal');
    const editClassificationModal = document.getElementById('editClassificationModal');
    const addHarmLevelModal = document.getElementById('addHarmLevelModal');
    const editHarmLevelModal = document.getElementById('editHarmLevelModal');
    const deleteModal = document.getElementById('deleteModal');

    // Store data
    let departments = [];
    let classifications = [];
    let harmLevels = [];
    let currentDeleteType = '';
    let currentDeleteId = '';

    // Permissions state
    const permissions = { canAdd: false, canEdit: false, canDelete: false };

    // Utility functions
    function getToken() { 
        return localStorage.getItem('token'); 
    }

    function getUserId() {
        const token = getToken();
        if (!token) return null;
        try {
            const payload = token.split('.')[1];
            const decoded = JSON.parse(atob(payload));
            return decoded.id || decoded.userId || decoded.sub || null;
        } catch (e) {
            console.warn('Failed to decode token for user ID:', e);
            return null;
        }
    }

    function checkAuth() {
        if (!getToken()) {
            showToast(getTranslation('please-login'), 'warning');
            window.location.href = 'login.html';
        }
    }

    function getCurrentLang() {
        return localStorage.getItem('language') === 'en' ? 'en' : 'ar';
    }

    function getTranslation(key) {
        const lang = getCurrentLang();
        return window.translations?.[lang]?.[key] || key;
    }

    // Fetch user permissions
    async function fetchPermissions() {
        const userId = getUserId();
        if (!userId) return;

        const headers = { 'Authorization': `Bearer ${getToken()}` };

        // جلب دور المستخدم
        const userRes = await fetch(`${apiBase}/users/${userId}`, { headers });
        const { data: user } = await userRes.json();
        const role = user.role;
        if (role === 'admin') {
            permissions.canAdd = permissions.canEdit = permissions.canDelete = true;
        }

        // جلب قائمة الصلاحيات
        const permsRes = await fetch(`${apiBase}/users/${userId}/permissions`, { headers });
        const { data: perms } = await permsRes.json();

        console.log('raw permissions:', perms);

        // تعامُل مع النصوص و objects
        const keys = perms.map(p => 
            (typeof p === 'string' ? p : p.permission)
        );
        console.log('mapped keys:', keys);

        // ضبط صلاحيات العرض للأقسام فقط
        if (keys.includes('add_section'))    permissions.canAdd    = true;
        if (keys.includes('edit_section'))   permissions.canEdit   = true;
        if (keys.includes('delete_section')) permissions.canDelete = true;

        // تحديث عرض أزرار الأقسام
        updateDepartmentButtons();
    }

    // تحديث عرض أزرار الأقسام بناءً على الصلاحيات
    function updateDepartmentButtons() {
        const addDepartmentBtn = document.getElementById('addDepartmentBtn');
        if (addDepartmentBtn) {
            addDepartmentBtn.style.display = permissions.canAdd ? 'flex' : 'none';
        }
    }

    // Modal functions
    function openModal(modal) { 
        modal.style.display = 'flex'; 
    }

    function closeModal(modal) { 
        modal.style.display = 'none'; 
        clearModalInputs(modal);
    }

    function clearModalInputs(modal) {
        const inputs = modal.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            if (input.type !== 'hidden') {
                input.value = '';
            }
        });
        
        // Clear file inputs specifically
        const fileInputs = modal.querySelectorAll('input[type="file"]');
        fileInputs.forEach(input => {
            input.value = '';
        });
    }

    // Fetch data functions
    async function fetchDepartments() {
        try {
            const response = await fetch(`${apiBase}/departments/all`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (!response.ok) throw new Error(`Failed to fetch departments: ${response.status}`);
            
            const result = await response.json();
            console.log('📦 Raw departments response:', result);
            
            // معالجة الاستجابة - قد تكون مصفوفة مباشرة أو كائن مع data
            departments = Array.isArray(result) ? result : (result.data || []);
            renderDepartments(departments);
            console.log('✅ Departments loaded:', departments);
        } catch (error) {
            console.error('❌ Error fetching departments:', error);
            departmentsList.innerHTML = '<div class="error">خطأ في تحميل الأقسام: ' + error.message + '</div>';
        }
    }

    async function fetchClassifications() {
        try {
            const lang = getCurrentLang();
            const response = await fetch(`${apiBase}/tickets/classifications?lang=${lang}`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (!response.ok) throw new Error('Failed to fetch classifications');
            
            const result = await response.json();
            classifications = result.data || [];
            renderClassifications(classifications);
            console.log('✅ Classifications loaded:', classifications);
        } catch (error) {
            console.error('❌ Error fetching classifications:', error);
            classificationsList.innerHTML = '<div class="error">خطأ في تحميل التصنيفات</div>';
        }
    }

    async function fetchHarmLevels() {
        try {
            const lang = getCurrentLang();
            const response = await fetch(`${apiBase}/tickets/harm-levels?lang=${lang}`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (!response.ok) throw new Error('Failed to fetch harm levels');
            
            const result = await response.json();
            harmLevels = result.data || [];
            renderHarmLevels(harmLevels);
            console.log('✅ Harm levels loaded:', harmLevels);
        } catch (error) {
            console.error('❌ Error fetching harm levels:', error);
            harmLevelsList.innerHTML = '<div class="error">خطأ في تحميل مستويات الضرر</div>';
        }
    }

    // Render functions
    function renderDepartments(items) {
        const lang = getCurrentLang();
        
        if (items.length === 0) {
            departmentsList.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-search"></i>
                    <div>${getTranslation('no-departments')}</div>
                </div>
            `;
            return;
        }

        departmentsList.innerHTML = items.map(dept => {
            let deptName = 'غير محدد';
            
            if (dept.name) {
                try {
                    // إذا كان الاسم كائن JSON
                    if (typeof dept.name === 'string' && dept.name.trim().startsWith('{')) {
                        const parsed = JSON.parse(dept.name);
                        deptName = parsed[lang] || parsed['ar'] || parsed['en'] || dept.name;
                    }
                    // إذا كان الاسم كائن مباشرة
                    else if (typeof dept.name === 'object' && dept.name !== null) {
                        deptName = dept.name[lang] || dept.name['ar'] || dept.name['en'] || JSON.stringify(dept.name);
                    }
                    // إذا كان نص عادي
                    else {
                        deptName = dept.name;
                    }
                } catch (error) {
                    console.warn('⚠️ خطأ في معالجة اسم القسم:', dept.name, error);
                    deptName = typeof dept.name === 'string' ? dept.name : 'غير محدد';
                }
            }

            let actions = '';
            if (permissions.canEdit || permissions.canDelete) {
                actions = '<div class="item-actions">';
                if (permissions.canEdit) {
                    actions += `<button class="edit-btn" onclick="handleEditDepartment(${dept.id})">
                        <i class="fas fa-edit"></i> ${getTranslation('edit')}
                    </button>`;
                }
                if (permissions.canDelete) {
                    actions += `<button class="delete-btn" onclick="handleDeleteDepartment(${dept.id})">
                        <i class="fas fa-trash"></i> ${getTranslation('delete')}
                    </button>`;
                }
                actions += '</div>';
            }

            return `
                <div class="item-row" data-id="${dept.id}">
                    <div class="item-info">
                        <div class="item-name">${deptName}</div>
                        <div class="item-description">ID: ${dept.id}</div>
                    </div>
                    ${actions}
                </div>
            `;
        }).join('');
    }

    function renderClassifications(items) {
        const lang = getCurrentLang();
        
        if (items.length === 0) {
            classificationsList.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-search"></i>
                    <div>${getTranslation('no-classifications')}</div>
                </div>
            `;
            return;
        }

        classificationsList.innerHTML = items.map(cls => {
            return `
                <div class="item-row" data-id="${cls.id}">
                    <div class="item-info">
                        <div class="item-name">${cls.name}</div>
                        <div class="item-description">ID: ${cls.id}</div>
                    </div>
                    <div class="item-actions">
                        <button class="edit-btn" onclick="handleEditClassification(${cls.id})">
                            <i class="fas fa-edit"></i> ${getTranslation('edit')}
                        </button>
                        <button class="delete-btn" onclick="handleDeleteClassification(${cls.id})">
                            <i class="fas fa-trash"></i> ${getTranslation('delete')}
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderHarmLevels(items) {
        const lang = getCurrentLang();
        
        if (items.length === 0) {
            harmLevelsList.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-search"></i>
                    <div>${getTranslation('no-harm-levels')}</div>
                </div>
            `;
            return;
        }

        harmLevelsList.innerHTML = items.map(hl => {
            return `
                <div class="item-row" data-id="${hl.id}">
                    <div class="item-info">
                        <div class="item-name">${hl.desc || getTranslation('no-description')}</div>
                    </div>
                    <div class="item-actions">
                        <button class="edit-btn" onclick="handleEditHarmLevel(${hl.id})">
                            <i class="fas fa-edit"></i> ${getTranslation('edit')}
                        </button>
                        <button class="delete-btn" onclick="handleDeleteHarmLevel(${hl.id})">
                            <i class="fas fa-trash"></i> ${getTranslation('delete')}
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Search functions
    function filterDepartments(searchTerm) {
        const lang = getCurrentLang();
        const filtered = departments.filter(dept => {
            let deptName = 'غير محدد';
            
            if (dept.name) {
                try {
                    // إذا كان الاسم كائن JSON
                    if (typeof dept.name === 'string' && dept.name.trim().startsWith('{')) {
                        const parsed = JSON.parse(dept.name);
                        deptName = parsed[lang] || parsed['ar'] || parsed['en'] || dept.name;
                    }
                    // إذا كان الاسم كائن مباشرة
                    else if (typeof dept.name === 'object' && dept.name !== null) {
                        deptName = dept.name[lang] || dept.name['ar'] || dept.name['en'] || JSON.stringify(dept.name);
                    }
                    // إذا كان نص عادي
                    else {
                        deptName = dept.name;
                    }
                } catch (error) {
                    console.warn('⚠️ خطأ في معالجة اسم القسم للفلترة:', dept.name, error);
                    deptName = typeof dept.name === 'string' ? dept.name : 'غير محدد';
                }
            }
            
            return deptName.toLowerCase().includes(searchTerm.toLowerCase());
        });
        renderDepartments(filtered);
    }

    function filterClassifications(searchTerm) {
        const filtered = classifications.filter(cls => 
            cls.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        renderClassifications(filtered);
    }

    function filterHarmLevels(searchTerm) {
        const filtered = harmLevels.filter(hl => 
            (hl.desc && hl.desc.toLowerCase().includes(searchTerm.toLowerCase()))
        );
        renderHarmLevels(filtered);
    }

    // Event listeners for search
    departmentSearch.addEventListener('input', (e) => {
        filterDepartments(e.target.value);
    });

    classificationSearch.addEventListener('input', (e) => {
        filterClassifications(e.target.value);
    });

    harmLevelSearch.addEventListener('input', (e) => {
        filterHarmLevels(e.target.value);
    });

    // Add button handlers
    addDepartmentBtn.addEventListener('click', () => openModal(addDepartmentModal));
    addClassificationBtn.addEventListener('click', () => openModal(addClassificationModal));
    addHarmLevelBtn.addEventListener('click', () => openModal(addHarmLevelModal));

    // Global handlers (will be called from HTML)
    window.handleEditDepartment = (id) => {
        const department = departments.find(d => d.id == id);
        if (department) {
            try {
                const parsedName = JSON.parse(department.name);
                document.getElementById('editDepartmentId').value = department.id;
                document.getElementById('editDepartmentNameAr').value = parsedName.ar || '';
                document.getElementById('editDepartmentNameEn').value = parsedName.en || '';
            } catch {
                document.getElementById('editDepartmentId').value = department.id;
                document.getElementById('editDepartmentNameAr').value = department.name || '';
                document.getElementById('editDepartmentNameEn').value = '';
            }
            
            // Set department type if the field exists
            const editDepartmentType = document.getElementById('editDepartmentType');
            if (editDepartmentType) {
                editDepartmentType.value = department.type || 'main';
            }
            
            // Set has sub departments if the fields exist
            const hasSubDepartments = department.has_sub_departments || department.hasSubDepartments;
            const editHasSubDepartmentsYes = document.getElementById('editHasSubDepartmentsYes');
            const editHasSubDepartmentsNo = document.getElementById('editHasSubDepartmentsNo');
            
            if (editHasSubDepartmentsYes && editHasSubDepartmentsNo) {
                if (hasSubDepartments) {
                    editHasSubDepartmentsYes.checked = true;
                    editHasSubDepartmentsNo.checked = false;
                } else {
                    editHasSubDepartmentsYes.checked = false;
                    editHasSubDepartmentsNo.checked = true;
                }
            }
            
            // Clear the image input
            document.getElementById('editDepartmentImage').value = '';
            openModal(editDepartmentModal);
        }
    };

    window.handleDeleteDepartment = (id) => {
        currentDeleteType = 'department';
        currentDeleteId = id;
        openModal(deleteModal);
    };

    window.handleEditClassification = (id) => {
        const classification = classifications.find(c => c.id == id);
        if (classification) {
            // For now, we'll need to fetch the full classification data
            // since we only have the name in the list
            fetchClassificationDetails(id);
        }
    };

    window.handleDeleteClassification = (id) => {
        currentDeleteType = 'classification';
        currentDeleteId = id;
        openModal(deleteModal);
    };

    window.handleEditHarmLevel = (id) => {
        const harmLevel = harmLevels.find(h => h.id == id);
        if (harmLevel) {
            // For now, we'll need to fetch the full harm level data
            fetchHarmLevelDetails(id);
        }
    };

    window.handleDeleteHarmLevel = (id) => {
        currentDeleteType = 'harm-level';
        currentDeleteId = id;
        openModal(deleteModal);
    };

    // Fetch details for editing
    async function fetchClassificationDetails(id) {
        try {
            const response = await fetch(`${apiBase}/tickets/classifications/${id}`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (!response.ok) throw new Error('Failed to fetch classification details');
            
            const result = await response.json();
            const classification = result.data;
            
            document.getElementById('editClassificationId').value = classification.id;
            document.getElementById('editClassificationNameAr').value = classification.name_ar || '';
            document.getElementById('editClassificationNameEn').value = classification.name_en || '';
            
            openModal(editClassificationModal);
        } catch (error) {
            console.error('❌ Error fetching classification details:', error);
            showToast('خطأ في جلب تفاصيل التصنيف', 'error');
        }
    }

    async function fetchHarmLevelDetails(id) {
        try {
            const response = await fetch(`${apiBase}/tickets/harm-levels/${id}`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (!response.ok) throw new Error('Failed to fetch harm level details');
            
            const result = await response.json();
            const harmLevel = result.data;
            
            document.getElementById('editHarmLevelId').value = harmLevel.id;
            document.getElementById('editHarmLevelDescAr').value = harmLevel.desc_ar || '';
            document.getElementById('editHarmLevelDescEn').value = harmLevel.desc_en || '';
            
            openModal(editHarmLevelModal);
        } catch (error) {
            console.error('❌ Error fetching harm level details:', error);
            showToast('خطأ في جلب تفاصيل مستوى الضرر', 'error');
        }
    }

    // Save handlers
    document.getElementById('saveAddDepartment').addEventListener('click', async () => {
        if (!permissions.canAdd) return;

        const type = document.getElementById('departmentType')?.value || 'main';
        const nameAr = document.getElementById('departmentNameAr').value.trim();
        const nameEn = document.getElementById('departmentNameEn').value.trim();
        const file = document.getElementById('departmentImage').files[0];
        const hasSubDepartments = document.getElementById('hasSubDepartmentsYes')?.checked || false;
        
        if (!nameAr || !nameEn) {
            showToast(getTranslation('please-enter-all-required-data') || 'الرجاء إدخال الاسم بالعربية والإنجليزية.', 'warning');
            return;
        }

        const name = JSON.stringify({ ar: nameAr, en: nameEn });
        const formData = new FormData();
        formData.append('name', name);
        formData.append('type', type);
        formData.append('parentId', null); // الأقسام الرئيسية ليس لها أب
        formData.append('hasSubDepartments', hasSubDepartments);
        if (file) {
            formData.append('image', file);
        }

        try {
            const response = await fetch(`${apiBase}/departments`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${getToken()}` },
                body: formData
            });
            
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Failed to add department');
            
            showToast(getTranslation('department-added-success') || 'تم إضافة القسم بنجاح', 'success');
            closeModal(addDepartmentModal);
            await fetchDepartments();
        } catch (error) {
            console.error('❌ Error adding department:', error);
            showToast(getTranslation('error-adding-department') || 'خطأ في إضافة القسم', 'error');
        }
    });

    document.getElementById('saveEditDepartment').addEventListener('click', async () => {
        if (!permissions.canEdit) return;

        const id = document.getElementById('editDepartmentId').value;
        const type = document.getElementById('editDepartmentType')?.value || 'main';
        const nameAr = document.getElementById('editDepartmentNameAr').value.trim();
        const nameEn = document.getElementById('editDepartmentNameEn').value.trim();
        const file = document.getElementById('editDepartmentImage').files[0];
        const hasSubDepartments = document.getElementById('editHasSubDepartmentsYes')?.checked || false;
        
        if (!id || !nameAr || !nameEn) {
            showToast(getTranslation('please-enter-all-required-data') || 'الرجاء إدخال الاسم بالعربية والإنجليزية.', 'warning');
            return;
        }

        const name = JSON.stringify({ ar: nameAr, en: nameEn });
        const formData = new FormData();
        formData.append('name', name);
        formData.append('type', type);
        formData.append('parentId', null); // الأقسام الرئيسية ليس لها أب
        formData.append('hasSubDepartments', hasSubDepartments);
        if (file) formData.append('image', file);

        try {
            const response = await fetch(`${apiBase}/departments/${id}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${getToken()}` },
                body: formData
            });
            
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Failed to update department');
            
            showToast(getTranslation('department-updated-success') || 'تم تحديث القسم بنجاح', 'success');
            closeModal(editDepartmentModal);
            await fetchDepartments();
        } catch (error) {
            console.error('❌ Error updating department:', error);
            showToast(getTranslation('error-updating-department') || 'خطأ في تحديث القسم', 'error');
        }
    });

    document.getElementById('saveAddClassification').addEventListener('click', async () => {
        const nameAr = document.getElementById('classificationNameAr').value.trim();
        const nameEn = document.getElementById('classificationNameEn').value.trim();
        
        if (!nameAr || !nameEn) {
            showToast(getTranslation('please-enter-both-names') || 'الرجاء إدخال الاسم بالعربية والإنجليزية', 'warning');
            return;
        }

        try {
            const response = await fetch(`${apiBase}/tickets/classifications`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name_ar: nameAr,
                    name_en: nameEn
                })
            });
            
            if (!response.ok) throw new Error('Failed to add classification');
            
            showToast(getTranslation('classification-added-success') || 'تم إضافة التصنيف بنجاح', 'success');
            closeModal(addClassificationModal);
            await fetchClassifications();
        } catch (error) {
            console.error('❌ Error adding classification:', error);
            showToast(getTranslation('error-adding-classification') || 'خطأ في إضافة التصنيف', 'error');
        }
    });

    document.getElementById('saveEditClassification').addEventListener('click', async () => {
        const id = document.getElementById('editClassificationId').value;
        const nameAr = document.getElementById('editClassificationNameAr').value.trim();
        const nameEn = document.getElementById('editClassificationNameEn').value.trim();
        
        if (!id || !nameAr || !nameEn) {
            showToast(getTranslation('please-enter-both-names') || 'الرجاء إدخال الاسم بالعربية والإنجليزية', 'warning');
            return;
        }

        try {
            const response = await fetch(`${apiBase}/tickets/classifications/${id}`, {
                method: 'PUT',
                headers: { 
                    'Authorization': `Bearer ${getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name_ar: nameAr,
                    name_en: nameEn
                })
            });
            
            if (!response.ok) throw new Error('Failed to update classification');
            
            showToast(getTranslation('classification-updated-success') || 'تم تحديث التصنيف بنجاح', 'success');
            closeModal(editClassificationModal);
            await fetchClassifications();
        } catch (error) {
            console.error('❌ Error updating classification:', error);
            showToast(getTranslation('error-updating-classification') || 'خطأ في تحديث التصنيف', 'error');
        }
    });

    document.getElementById('saveAddHarmLevel').addEventListener('click', async () => {
        const descAr = document.getElementById('harmLevelDescAr').value.trim();
        const descEn = document.getElementById('harmLevelDescEn').value.trim();
        
        if (!descAr || !descEn) {
            showToast('الرجاء إدخال الوصف بالعربية والإنجليزية', 'warning');
            return;
        }

        try {
            const response = await fetch(`${apiBase}/tickets/harm-levels`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    description_ar: descAr,
                    description_en: descEn
                })
            });
            
            if (!response.ok) throw new Error('Failed to add harm level');
            
            const result = await response.json();
            const message = result.code ? 
                `تم إضافة مستوى الضرر بنجاح. الكود: ${result.code}` : 
                (getTranslation('harm-level-added-success') || 'تم إضافة مستوى الضرر بنجاح');
            
            showToast(message, 'success');
            closeModal(addHarmLevelModal);
            await fetchHarmLevels();
        } catch (error) {
            console.error('❌ Error adding harm level:', error);
            showToast(getTranslation('error-adding-harm-level') || 'خطأ في إضافة مستوى الضرر', 'error');
        }
    });

    document.getElementById('saveEditHarmLevel').addEventListener('click', async () => {
        const id = document.getElementById('editHarmLevelId').value;
        const descAr = document.getElementById('editHarmLevelDescAr').value.trim();
        const descEn = document.getElementById('editHarmLevelDescEn').value.trim();
        
        if (!id || !descAr || !descEn) {
            showToast('الرجاء إدخال الوصف بالعربية والإنجليزية', 'warning');
            return;
        }

        try {
            const response = await fetch(`${apiBase}/tickets/harm-levels/${id}`, {
                method: 'PUT',
                headers: { 
                    'Authorization': `Bearer ${getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    description_ar: descAr,
                    description_en: descEn
                })
            });
            
            if (!response.ok) throw new Error('Failed to update harm level');
            
            showToast(getTranslation('harm-level-updated-success') || 'تم تحديث مستوى الضرر بنجاح', 'success');
            closeModal(editHarmLevelModal);
            await fetchHarmLevels();
        } catch (error) {
            console.error('❌ Error updating harm level:', error);
            showToast(getTranslation('error-updating-harm-level') || 'خطأ في تحديث مستوى الضرر', 'error');
        }
    });

    // Delete confirmation
    document.getElementById('confirmDelete').addEventListener('click', async () => {
        if (!currentDeleteType || !currentDeleteId) return;

        try {
            let endpoint = '';
            switch (currentDeleteType) {
                case 'department':
                    endpoint = `${apiBase}/departments/${currentDeleteId}`;
                    break;
                case 'classification':
                    endpoint = `${apiBase}/tickets/classifications/${currentDeleteId}`;
                    break;
                case 'harm-level':
                    endpoint = `${apiBase}/tickets/harm-levels/${currentDeleteId}`;
                    break;
            }

            const response = await fetch(endpoint, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            
            if (!response.ok) throw new Error('Failed to delete item');
            
            showToast(getTranslation('item-deleted-success') || 'تم حذف العنصر بنجاح', 'success');
            closeModal(deleteModal);
            
            // Refresh data
            switch (currentDeleteType) {
                case 'department':
                    await fetchDepartments();
                    break;
                case 'classification':
                    await fetchClassifications();
                    break;
                case 'harm-level':
                    await fetchHarmLevels();
                    break;
            }
        } catch (error) {
            console.error('❌ Error deleting item:', error);
            showToast(getTranslation('error-deleting-item') || 'خطأ في حذف العنصر', 'error');
        }
    });

    // Cancel buttons
    document.getElementById('cancelAddDepartment').addEventListener('click', () => closeModal(addDepartmentModal));
    document.getElementById('cancelEditDepartment').addEventListener('click', () => closeModal(editDepartmentModal));
    document.getElementById('cancelAddClassification').addEventListener('click', () => closeModal(addClassificationModal));
    document.getElementById('cancelEditClassification').addEventListener('click', () => closeModal(editClassificationModal));
    document.getElementById('cancelAddHarmLevel').addEventListener('click', () => closeModal(addHarmLevelModal));
    document.getElementById('cancelEditHarmLevel').addEventListener('click', () => closeModal(editHarmLevelModal));
    document.getElementById('cancelDelete').addEventListener('click', () => closeModal(deleteModal));

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal);
        });
    });

    // Button event listeners
    addDepartmentBtn.addEventListener('click', () => {
        if (!permissions.canAdd) return;
        openModal(addDepartmentModal);
    });

    addClassificationBtn.addEventListener('click', () => {
        openModal(addClassificationModal);
    });

    addHarmLevelBtn.addEventListener('click', () => {
        openModal(addHarmLevelModal);
    });

    // Search event listeners
    departmentSearch.addEventListener('input', (e) => filterDepartments(e.target.value));
    classificationSearch.addEventListener('input', (e) => filterClassifications(e.target.value));
    harmLevelSearch.addEventListener('input', (e) => filterHarmLevels(e.target.value));

    // Language change handler
    window.addEventListener('languageChanged', async () => {
        await fetchClassifications();
        await fetchHarmLevels();
        updatePlaceholders();
        updateDepartmentButtons();
    });

    // Update placeholders based on current language
    function updatePlaceholders() {
        const lang = getCurrentLang();
        const placeholders = document.querySelectorAll('[data-translate-placeholder]');
        
        placeholders.forEach(element => {
            const key = element.getAttribute('data-translate-placeholder');
            const translation = getTranslation(key);
            if (translation && translation !== key) {
                element.placeholder = translation;
            }
        });
        
        // Also update all elements with data-translate attribute
        const translatableElements = document.querySelectorAll('[data-translate]');
        translatableElements.forEach(element => {
            const key = element.getAttribute('data-translate');
            const translation = getTranslation(key);
            if (translation && translation !== key) {
                element.textContent = translation;
            }
        });
    }

    // Initialize
    checkAuth();
    await fetchPermissions();
    await fetchDepartments();
    await fetchClassifications();
    await fetchHarmLevels();
    updatePlaceholders();
    
    // Update placeholders on page load
    setTimeout(() => {
        updatePlaceholders();
    }, 100);
    
    // Also update placeholders when DOM is fully loaded
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            updatePlaceholders();
        }, 200);
    });
});

// Global functions for buttons
window.handleEditDepartment = async (id) => {
    if (!permissions.canEdit) return;
    
    try {
        const response = await fetch(`${apiBase}/departments/${id}`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (!response.ok) throw new Error('Failed to fetch department details');
        
        const department = await response.json();
        let nameAr, nameEn;
        
        try {
            const parsed = JSON.parse(department.name);
            nameAr = parsed.ar || '';
            nameEn = parsed.en || '';
        } catch {
            nameAr = department.name;
            nameEn = department.name;
        }
        
        document.getElementById('editDepartmentId').value = id;
        document.getElementById('editDepartmentNameAr').value = nameAr;
        document.getElementById('editDepartmentNameEn').value = nameEn;
        document.getElementById('editDepartmentImage').value = '';
        
        openModal(editDepartmentModal);
    } catch (error) {
        console.error('❌ Error fetching department details:', error);
        showToast('خطأ في جلب تفاصيل القسم', 'error');
    }
};

window.handleDeleteDepartment = (id) => {
    if (!permissions.canDelete) return;
    currentDeleteType = 'department';
    currentDeleteId = id;
    openModal(deleteModal);
};

window.handleEditClassification = async (id) => {
    try {
        const response = await fetch(`${apiBase}/tickets/classifications/${id}`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (!response.ok) throw new Error('Failed to fetch classification details');
        
        const classification = await response.json();
        
        document.getElementById('editClassificationId').value = id;
        document.getElementById('editClassificationNameAr').value = classification.name_ar || '';
        document.getElementById('editClassificationNameEn').value = classification.name_en || '';
        
        openModal(editClassificationModal);
    } catch (error) {
        console.error('❌ Error fetching classification details:', error);
        showToast('خطأ في جلب تفاصيل التصنيف', 'error');
    }
};

window.handleDeleteClassification = (id) => {
    currentDeleteType = 'classification';
    currentDeleteId = id;
    openModal(deleteModal);
};

window.handleEditHarmLevel = async (id) => {
    try {
        const response = await fetch(`${apiBase}/tickets/harm-levels/${id}`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (!response.ok) throw new Error('Failed to fetch harm level details');
        
        const harmLevel = await response.json();
        
        document.getElementById('editHarmLevelId').value = id;
        document.getElementById('editHarmLevelDescAr').value = harmLevel.desc_ar || '';
        document.getElementById('editHarmLevelDescEn').value = harmLevel.desc_en || '';
        
        openModal(editHarmLevelModal);
    } catch (error) {
        console.error('❌ Error fetching harm level details:', error);
        showToast('خطأ في جلب تفاصيل مستوى الضرر', 'error');
    }
};

window.handleDeleteHarmLevel = (id) => {
    currentDeleteType = 'harm-level';
    currentDeleteId = id;
    openModal(deleteModal);
};

// Global function for back button
window.goBack = () => window.history.back(); 