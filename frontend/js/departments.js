// departments.js
// Add JavaScript specific to the departments page here
const apiBase      = 'http://localhost:3006/api';

document.addEventListener('DOMContentLoaded', async function() {
    // Get references to elements
    const addDepartmentBtn = document.getElementById('addDepartmentButton');
    const addDepartmentModal = document.getElementById('addDepartmentModal');
    const addModalSaveBtn = document.getElementById('saveAddDepartment');
    const addModalCancelBtn = document.getElementById('cancelAddDepartment');
    const addDepartmentNameInput = document.getElementById('departmentName');
    const addDepartmentImageInput = document.getElementById('departmentImage');
    const cardsGrid = document.querySelector('.cards-grid');

    const editDepartmentModal = document.getElementById('editDepartmentModal');
    const editModalSaveBtn = document.getElementById('saveEditDepartment');
    const editModalCancelBtn = document.getElementById('cancelEditDepartment');
    const editDepartmentIdInput = document.getElementById('editDepartmentId');
    const editDepartmentNameInput = document.getElementById('editDepartmentName');
    const editDepartmentImageInput = document.getElementById('editDepartmentImage');

    const deleteDepartmentModal = document.getElementById('deleteDepartmentModal');
    const deleteModalConfirmBtn = document.getElementById('confirmDeleteDepartment');
    const deleteModalCancelBtn = document.getElementById('cancelDeleteDepartment');
const addDepartmentNameArInput = document.getElementById('departmentNameAr');
const addDepartmentNameEnInput = document.getElementById('departmentNameEn');
const editDepartmentNameArInput = document.getElementById('editDepartmentNameAr');
const editDepartmentNameEnInput = document.getElementById('editDepartmentNameEn');

    // Utility to get token
    function getToken() { return localStorage.getItem('token'); }

    // Decode JWT to extract user ID
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

    // Ensure authentication
    function checkAuth() {
        if (!getToken()) {
            alert(getTranslation('please-login'));
            window.location.href = 'login.html';
        }
    }
    checkAuth();

    // Permissions state
    const permissions = { canAdd: false, canEdit: false, canDelete: false };

    // فتح بوب اب اضافه القسم 
    addDepartmentBtn.addEventListener('click', () => openModal(addDepartmentModal));

    // Fetch user permissions
async function fetchPermissions() {
  const userId = getUserId();
  if (!userId) return;

  const headers = { 'Authorization': `Bearer ${getToken()}` };

  // جلب دور المستخدم
  const userRes      = await fetch(`${apiBase}/users/${userId}`, { headers });
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

  // ضبط صلاحيات العرض
  if (keys.includes('add_section'))    permissions.canAdd    = true;
  if (keys.includes('edit_section'))   permissions.canEdit   = true;
  if (keys.includes('delete_section')) permissions.canDelete = true;
}


    // Modal handlers
    function openModal(modal) { modal.style.display = 'flex'; }
function closeModal(modal) {
  modal.style.display = 'none';

  if (modal === addDepartmentModal) {
    addDepartmentNameArInput.value = '';
    addDepartmentNameEnInput.value = '';
    addDepartmentImageInput.value = '';
  } else if (modal === editDepartmentModal) {
    editDepartmentIdInput.value = '';
    editDepartmentNameArInput.value = '';
    editDepartmentNameEnInput.value = '';
    editDepartmentImageInput.value = '';
  }
}


    // Show/hide Add button
    function updateAddButtonVisibility() {
        if (addDepartmentBtn) addDepartmentBtn.style.display = permissions.canAdd ? '' : 'none';
    }

    // Fetch and render departments
async function fetchDepartments() {
    try {
        const res = await fetch('http://localhost:3006/api/departments', {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.message);

        cardsGrid.innerHTML = '';
        const lang = localStorage.getItem('language') || 'ar';

        result.forEach(dept => {
            const card = document.createElement('div');
            card.className = 'card';
            card.dataset.id = dept.id;

            // ✅ استخراج اسم القسم من JSON حسب اللغة
            let deptName;
            try {
                const parsed = JSON.parse(dept.name);
                deptName = parsed[lang] || parsed['ar'] || dept.name;
            } catch {
                deptName = dept.name;
            }

            let icons = '';
            if (permissions.canEdit || permissions.canDelete) {
                icons = '<div class="card-icons">';
                if (permissions.canEdit)
                    icons += `<a href="#" class="edit-icon" data-id="${dept.id}" data-name='${dept.name}'"><img src="../images/edit.svg" alt="${getTranslation('edit')}"></a>`;

                if (permissions.canDelete)
                    icons += `<a href="#" class="delete-icon" data-id="${dept.id}"><img src="../images/delet.svg" alt="${getTranslation('delete')}"></a>`;
                icons += '</div>';
            }

            card.innerHTML = icons +
                `<div class="card-icon bg-blue"><img src="http://localhost:3006/${dept.image}" alt="${deptName}"></div>` +
                `<div class="card-title">${deptName}</div>`;

            cardsGrid.appendChild(card);

            card.addEventListener('click', e => {
                if (e.target.closest('.card-icons')) return;
                window.location.href = `department-content.html?departmentId=${dept.id}`;
            });
        });

        if (permissions.canEdit)
            document.querySelectorAll('.edit-icon').forEach(el => el.addEventListener('click', handleEdit));
        if (permissions.canDelete)
            document.querySelectorAll('.delete-icon').forEach(el => el.addEventListener('click', handleDeleteOpen));

    } catch (err) {
        console.error('Error fetching departments:', err);
        alert(getTranslation('error-fetching-departments'));
    }
}


    // Handlers for edit/delete open
function handleEdit(e) {
  e.preventDefault();
  e.stopPropagation();

  const el = e.currentTarget;
  editDepartmentIdInput.value = el.dataset.id;

  try {
    const parsedName = JSON.parse(el.dataset.name);
    editDepartmentNameArInput.value = parsedName.ar || '';
    editDepartmentNameEnInput.value = parsedName.en || '';
  } catch {
    editDepartmentNameArInput.value = el.dataset.name || '';
    editDepartmentNameEnInput.value = '';
  }

  openModal(editDepartmentModal);
}

    function handleDeleteOpen(e) {
        e.preventDefault(); e.stopPropagation();
        deleteDepartmentModal.dataset.departmentId = e.currentTarget.dataset.id;
        openModal(deleteDepartmentModal);
    }

    // Add department
addModalSaveBtn.addEventListener('click', async () => {
  if (!permissions.canAdd) return;

  const nameAr = addDepartmentNameArInput.value.trim();
  const nameEn = addDepartmentNameEnInput.value.trim();
  const file   = addDepartmentImageInput.files[0];

  if (!nameAr || !nameEn || !file) {
    alert('الرجاء إدخال الاسم بالعربية والإنجليزية واختيار صورة.');
    return;
  }

  const name = JSON.stringify({ ar: nameAr, en: nameEn });

  const fd = new FormData();
  fd.append('name', name);
  fd.append('image', file);

  try {
    const res = await fetch(`${apiBase}/departments`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` },
      body: fd
    });
    const r = await res.json();
    if (!res.ok) throw new Error(r.message);
    alert(getTranslation('department-added-success'));
    closeModal(addDepartmentModal);
    fetchDepartments();
  } catch (err) {
    console.error(err);
    alert(getTranslation('error-adding-department'));
  }
});


    // Edit department
editModalSaveBtn.addEventListener('click', async () => {
  if (!permissions.canEdit) return;

  const id     = editDepartmentIdInput.value;
  const nameAr = editDepartmentNameArInput.value.trim();
  const nameEn = editDepartmentNameEnInput.value.trim();
  const file   = editDepartmentImageInput.files[0];

  if (!id || !nameAr || !nameEn) {
    alert('الرجاء إدخال الاسم بالعربية والإنجليزية.');
    return;
  }

  const name = JSON.stringify({ ar: nameAr, en: nameEn });

  const fd = new FormData();
  fd.append('name', name);
  if (file) fd.append('image', file);

  try {
    const res = await fetch(`${apiBase}/departments/${id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${getToken()}` },
      body: fd
    });
    const r = await res.json();
    if (!res.ok) throw new Error(r.message);
    alert(getTranslation('department-updated-success'));
    closeModal(editDepartmentModal);
    fetchDepartments();
  } catch (err) {
    console.error(err);
    alert(getTranslation('error-updating-department'));
  }
});


    // Delete department
    deleteModalConfirmBtn.addEventListener('click', async () => {
        if (!permissions.canDelete) return;
        const id = deleteDepartmentModal.dataset.departmentId;
        try {
            const res = await fetch(`http://localhost:3006/api/departments/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${getToken()}` } });
            const r = await res.json(); if (!res.ok) throw new Error(r.message);
            alert(getTranslation('department-deleted-success')); closeModal(deleteDepartmentModal); fetchDepartments();
        } catch (err) { console.error(err); alert(getTranslation('error-deleting-department')); }
    });

    // Cancel buttons
    addModalCancelBtn.addEventListener('click', () => closeModal(addDepartmentModal));
    editModalCancelBtn.addEventListener('click', () => closeModal(editDepartmentModal));
    deleteModalCancelBtn.addEventListener('click', () => closeModal(deleteDepartmentModal));

    // Overlay click closes
    document.querySelectorAll('.modal-overlay').forEach(m => m.addEventListener('click', e => { if (e.target === m) closeModal(m); }));

    // Init
await fetchPermissions();
updateAddButtonVisibility();
await fetchDepartments();

    window.goBack = () => window.history.back();
});
