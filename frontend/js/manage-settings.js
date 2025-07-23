// manage-settings.js
const apiBase = 'http://localhost:3006/api';

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
            alert(getTranslation('please-login'));
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
    }

    // Fetch data functions
    async function fetchDepartments() {
        try {
            const response = await fetch(`${apiBase}/departments`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (!response.ok) throw new Error('Failed to fetch departments');
            
            const data = await response.json();
            departments = data;
            renderDepartments(departments);
            console.log('✅ Departments loaded:', departments);
        } catch (error) {
            console.error('❌ Error fetching departments:', error);
            departmentsList.innerHTML = '<div class="error">خطأ في تحميل الأقسام</div>';
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
            let deptName;
            try {
                const parsed = JSON.parse(dept.name);
                deptName = parsed[lang] || parsed['ar'] || dept.name;
            } catch {
                deptName = dept.name;
            }

            return `
                <div class="item-row" data-id="${dept.id}">
                    <div class="item-info">
                        <div class="item-name">${deptName}</div>
                        <div class="item-description">ID: ${dept.id}</div>
                    </div>
                    <div class="item-actions">
                        <button class="edit-btn" onclick="handleEditDepartment(${dept.id})">
                            <i class="fas fa-edit"></i> ${getTranslation('edit')}
                        </button>
                        <button class="delete-btn" onclick="handleDeleteDepartment(${dept.id})">
                            <i class="fas fa-trash"></i> ${getTranslation('delete')}
                        </button>
                    </div>
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
            let deptName;
            try {
                const parsed = JSON.parse(dept.name);
                deptName = parsed[lang] || parsed['ar'] || dept.name;
            } catch {
                deptName = dept.name;
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
            alert('خطأ في جلب تفاصيل التصنيف');
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
            alert('خطأ في جلب تفاصيل مستوى الضرر');
        }
    }

    // Save handlers
    document.getElementById('saveAddDepartment').addEventListener('click', async () => {
        const nameAr = document.getElementById('departmentNameAr').value.trim();
        const nameEn = document.getElementById('departmentNameEn').value.trim();
        
        if (!nameAr || !nameEn) {
            alert(getTranslation('please-enter-both-names') || 'الرجاء إدخال الاسم بالعربية والإنجليزية');
            return;
        }

        const name = JSON.stringify({ ar: nameAr, en: nameEn });
        const formData = new FormData();
        formData.append('name', name);

        try {
            const response = await fetch(`${apiBase}/departments`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${getToken()}` },
                body: formData
            });
            
            if (!response.ok) throw new Error('Failed to add department');
            
            alert(getTranslation('department-added-success') || 'تم إضافة القسم بنجاح');
            closeModal(addDepartmentModal);
            await fetchDepartments();
        } catch (error) {
            console.error('❌ Error adding department:', error);
            alert(getTranslation('error-adding-department') || 'خطأ في إضافة القسم');
        }
    });

    document.getElementById('saveEditDepartment').addEventListener('click', async () => {
        const id = document.getElementById('editDepartmentId').value;
        const nameAr = document.getElementById('editDepartmentNameAr').value.trim();
        const nameEn = document.getElementById('editDepartmentNameEn').value.trim();
        
        if (!id || !nameAr || !nameEn) {
            alert(getTranslation('please-enter-both-names') || 'الرجاء إدخال الاسم بالعربية والإنجليزية');
            return;
        }

        const name = JSON.stringify({ ar: nameAr, en: nameEn });
        const formData = new FormData();
        formData.append('name', name);

        try {
            const response = await fetch(`${apiBase}/departments/${id}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${getToken()}` },
                body: formData
            });
            
            if (!response.ok) throw new Error('Failed to update department');
            
            alert(getTranslation('department-updated-success') || 'تم تحديث القسم بنجاح');
            closeModal(editDepartmentModal);
            await fetchDepartments();
        } catch (error) {
            console.error('❌ Error updating department:', error);
            alert(getTranslation('error-updating-department') || 'خطأ في تحديث القسم');
        }
    });

    document.getElementById('saveAddClassification').addEventListener('click', async () => {
        const nameAr = document.getElementById('classificationNameAr').value.trim();
        const nameEn = document.getElementById('classificationNameEn').value.trim();
        
        if (!nameAr || !nameEn) {
            alert(getTranslation('please-enter-both-names') || 'الرجاء إدخال الاسم بالعربية والإنجليزية');
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
            
            alert(getTranslation('classification-added-success') || 'تم إضافة التصنيف بنجاح');
            closeModal(addClassificationModal);
            await fetchClassifications();
        } catch (error) {
            console.error('❌ Error adding classification:', error);
            alert(getTranslation('error-adding-classification') || 'خطأ في إضافة التصنيف');
        }
    });

    document.getElementById('saveEditClassification').addEventListener('click', async () => {
        const id = document.getElementById('editClassificationId').value;
        const nameAr = document.getElementById('editClassificationNameAr').value.trim();
        const nameEn = document.getElementById('editClassificationNameEn').value.trim();
        
        if (!id || !nameAr || !nameEn) {
            alert(getTranslation('please-enter-both-names') || 'الرجاء إدخال الاسم بالعربية والإنجليزية');
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
            
            alert(getTranslation('classification-updated-success') || 'تم تحديث التصنيف بنجاح');
            closeModal(editClassificationModal);
            await fetchClassifications();
        } catch (error) {
            console.error('❌ Error updating classification:', error);
            alert(getTranslation('error-updating-classification') || 'خطأ في تحديث التصنيف');
        }
    });

    document.getElementById('saveAddHarmLevel').addEventListener('click', async () => {
        const descAr = document.getElementById('harmLevelDescAr').value.trim();
        const descEn = document.getElementById('harmLevelDescEn').value.trim();
        
        if (!descAr || !descEn) {
            alert('الرجاء إدخال الوصف بالعربية والإنجليزية');
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
            
            alert(message);
            closeModal(addHarmLevelModal);
            await fetchHarmLevels();
        } catch (error) {
            console.error('❌ Error adding harm level:', error);
            alert(getTranslation('error-adding-harm-level') || 'خطأ في إضافة مستوى الضرر');
        }
    });

    document.getElementById('saveEditHarmLevel').addEventListener('click', async () => {
        const id = document.getElementById('editHarmLevelId').value;
        const descAr = document.getElementById('editHarmLevelDescAr').value.trim();
        const descEn = document.getElementById('editHarmLevelDescEn').value.trim();
        
        if (!id || !descAr || !descEn) {
            alert('الرجاء إدخال الوصف بالعربية والإنجليزية');
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
            
            alert(getTranslation('harm-level-updated-success') || 'تم تحديث مستوى الضرر بنجاح');
            closeModal(editHarmLevelModal);
            await fetchHarmLevels();
        } catch (error) {
            console.error('❌ Error updating harm level:', error);
            alert(getTranslation('error-updating-harm-level') || 'خطأ في تحديث مستوى الضرر');
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
            
            alert(getTranslation('item-deleted-success') || 'تم حذف العنصر بنجاح');
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
            alert(getTranslation('error-deleting-item') || 'خطأ في حذف العنصر');
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

    // Language change handler
    window.addEventListener('languageChanged', async () => {
        await fetchClassifications();
        await fetchHarmLevels();
        updatePlaceholders();
    });

    // Update placeholders based on current language
    function updatePlaceholders() {
        const lang = getCurrentLang();
        const placeholders = document.querySelectorAll('[data-translate-placeholder]');
        
        placeholders.forEach(element => {
            const key = element.getAttribute('data-translate-placeholder');
            const translation = getTranslation(key);
            if (translation) {
                element.placeholder = translation;
            }
        });
    }

    // Initialize
    checkAuth();
    await fetchDepartments();
    await fetchClassifications();
    await fetchHarmLevels();
    updatePlaceholders();
});

// Global function for back button
window.goBack = () => window.history.back(); 