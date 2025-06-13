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
            alert('يرجى تسجيل الدخول أولاً.');
            window.location.href = 'login.html';
        }
    }
    checkAuth();

    // Permissions state
    const permissions = { canAdd: false, canEdit: false, canDelete: false };

    // Fetch user permissions
async function fetchPermissions() {
  const userId = getUserId();
  if (!userId) return;

  const headers = { 'Authorization': `Bearer ${getToken()}` };

  // جلب دور المستخدم
  const userRes      = await fetch(`${apiBase}/users/${userId}`, { headers });
  const { data: user } = await userRes.json();
  const role = user.role;
  if (role === 'admin' || role === 'sub-admin') {
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
            addDepartmentNameInput.value = '';
            addDepartmentImageInput.value = '';
        } else if (modal === editDepartmentModal) {
            editDepartmentIdInput.value = '';
            editDepartmentNameInput.value = '';
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
            result.data.forEach(dept => {
                const card = document.createElement('div');
                card.className = 'card';
                card.dataset.id = dept.id;

                let icons = '';
                if (permissions.canEdit || permissions.canDelete) {
                    icons = '<div class="card-icons">';
                    if (permissions.canEdit) icons += `<a href="#" class="edit-icon" data-id="${dept.id}" data-name="${dept.name}"><img src="../images/edit.svg" alt="تعديل"></a>`;
                    if (permissions.canDelete) icons += `<a href="#" class="delete-icon" data-id="${dept.id}"><img src="../images/delet.svg" alt="حذف"></a>`;
                    icons += '</div>';
                }

                card.innerHTML = icons +
                    `<div class="card-icon bg-blue"><img src="http://localhost:3006/${dept.image}" alt="${dept.name}"></div>` +
                    `<div class="card-title">${dept.name}</div>`;
                cardsGrid.appendChild(card);

                card.addEventListener('click', e => {
                    if (e.target.closest('.card-icons')) return;
                    window.location.href = `department-content.html?departmentId=${dept.id}`;
                });
            });

            if (permissions.canEdit) document.querySelectorAll('.edit-icon').forEach(el => el.addEventListener('click', handleEdit));
            if (permissions.canDelete) document.querySelectorAll('.delete-icon').forEach(el => el.addEventListener('click', handleDeleteOpen));

        } catch (err) {
            console.error('Error fetching departments:', err);
            alert(err.message);
        }
    }

    // Handlers for edit/delete open
    function handleEdit(e) {
        e.preventDefault(); e.stopPropagation();
        const el = e.currentTarget;
        editDepartmentIdInput.value = el.dataset.id;
        editDepartmentNameInput.value = el.dataset.name;
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
        const name = addDepartmentNameInput.value;
        const file = addDepartmentImageInput.files[0];
        if (!name || !file) return alert('اسم القسم والصورة مطلوبان.');
        const fd = new FormData(); fd.append('name', name); fd.append('image', file);
        try {
            const res = await fetch('http://localhost:3006/api/departments', { method: 'POST', headers: { 'Authorization': `Bearer ${getToken()}` }, body: fd });
            const r = await res.json(); if (!res.ok) throw new Error(r.message);
            alert(r.message); closeModal(addDepartmentModal); fetchDepartments();
        } catch (err) { console.error(err); alert(err.message); }
    });

    // Edit department
    editModalSaveBtn.addEventListener('click', async () => {
        if (!permissions.canEdit) return;
        const id = editDepartmentIdInput.value;
        const name = editDepartmentNameInput.value;
        if (!id || !name) return alert('اسم القسم مطلوب للتعديل.');
        const fd = new FormData(); fd.append('name', name);
        const file = editDepartmentImageInput.files[0]; if (file) fd.append('image', file);
        try {
            const res = await fetch(`http://localhost:3006/api/departments/${id}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${getToken()}` }, body: fd });
            const r = await res.json(); if (!res.ok) throw new Error(r.message);
            alert(r.message); closeModal(editDepartmentModal); fetchDepartments();
        } catch (err) { console.error(err); alert(err.message); }
    });

    // Delete department
    deleteModalConfirmBtn.addEventListener('click', async () => {
        if (!permissions.canDelete) return;
        const id = deleteDepartmentModal.dataset.departmentId;
        try {
            const res = await fetch(`http://localhost:3006/api/departments/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${getToken()}` } });
            const r = await res.json(); if (!res.ok) throw new Error(r.message);
            alert(r.message); closeModal(deleteDepartmentModal); fetchDepartments();
        } catch (err) { console.error(err); alert(err.message); }
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
