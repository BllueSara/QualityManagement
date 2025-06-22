// committee.js
const apiBase = 'http://localhost:3006/api';

document.addEventListener('DOMContentLoaded', async () => {
  // DOM elements
  const addBtn      = document.getElementById('addCommitteeButton');
  const saveAddBtn  = document.getElementById('saveAddCommittee');
  const cancelAdd   = document.getElementById('cancelAddCommittee');
  const addModal    = document.getElementById('addCommitteeModal');

  const editModal   = document.getElementById('editCommitteeModal');
  const saveEditBtn = document.getElementById('saveEditCommittee');
  const cancelEdit  = document.getElementById('cancelEditCommittee');
  const editIdInput = document.getElementById('editCommitteeId');
  const editName    = document.getElementById('editCommitteeName');
  const editImage   = document.getElementById('editCommitteeImage');

  const deleteModal = document.getElementById('deleteCommitteeModal');
  const confirmDel  = document.getElementById('confirmDeleteCommittee');
  const cancelDel   = document.getElementById('cancelDeleteCommittee');

  const grid        = document.getElementById('committeesGrid');
  const searchInput = document.querySelector('.search-bar input');

  const addCommitteeNameArInput = document.getElementById('committeeNameAr');
  const addCommitteeNameEnInput = document.getElementById('committeeNameEn');
  const editCommitteeNameArInput = document.getElementById('editCommitteeNameAr');
  const editCommitteeNameEnInput = document.getElementById('editCommitteeNameEn');

  // Auth helpers
  function getToken() {
    return localStorage.getItem('token');
  }
  function getUserId() {
    const token = getToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.id || payload.userId || payload.sub || null;
    } catch {
      return null;
    }
  }
  function authHeaders() {
    return { 'Authorization': `Bearer ${getToken()}` };
  }
  function checkAuth() {
    if (!getToken()) {
      alert(getTranslation('please-login'));
      return window.location.href = 'login.html';
    }
  }

  // permissions state
  const permissions = { canAdd: false, canEdit: false, canDelete: false };

  // fetch user role & permissions
  async function fetchPermissions() {
    const userId = getUserId();
    if (!userId) return;

    // 1) get user to check role
    const userRes = await fetch(`${apiBase}/users/${userId}`, {
      headers: authHeaders()
    });
    const { data: user } = await userRes.json();
    if (user.role === 'admin') {
      permissions.canAdd = permissions.canEdit = permissions.canDelete = true;
    }

    // 2) get explicit permissions
    const permsRes = await fetch(`${apiBase}/users/${userId}/permissions`, {
      headers: authHeaders()
    });
    const { data: perms } = await permsRes.json();
    const keys = perms.map(p => typeof p === 'string' ? p : p.permission_key || p.permission);

    if (keys.includes('add_committee'))    permissions.canAdd    = true;
    if (keys.includes('edit_committee'))   permissions.canEdit   = true;
    if (keys.includes('delete_committee')) permissions.canDelete = true;
  }

  function updateAddButton() {
    addBtn.style.display = permissions.canAdd ? 'inline-block' : 'none';
  }

  function showModal(m) { m.style.display = 'flex'; }
  function hideModal(m) {
    m.style.display = 'none';
    // reset inputs
    if (m === addModal) {
      document.getElementById('committeeName').value = '';
      document.getElementById('committeeImage').value = '';
    }
    if (m === editModal) {
      editIdInput.value = '';
      editName.value     = '';
      editImage.value    = '';
    }
  }

  // load & render
  async function loadCommittees() {
    try {
      const res = await fetch(`${apiBase}/committees`, {
        headers: authHeaders()
      });
      const list = await res.json();
      if (!res.ok) throw new Error(list.message);
      
      grid.innerHTML = '';
      list.forEach(item => {
        const card = createCard(item);
        grid.appendChild(card);
      });

      // wire up edit/delete icons only if allowed
      if (permissions.canEdit) {
        grid.querySelectorAll('.edit-icon')
            .forEach(btn => btn.addEventListener('click', onEditClick));
      }
      if (permissions.canDelete) {
        grid.querySelectorAll('.delete-icon')
            .forEach(btn => btn.addEventListener('click', onDeleteClick));
      }
    } catch (err) {
      console.error('Error fetching committees:', err);
      alert(getTranslation('error-fetching-committees'));
    }
  }

  function createCard(committee) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = committee.id;

    let icons = '';
    if (permissions.canEdit || permissions.canDelete) {
      icons = `<div class="card-icons">`;
      if (permissions.canEdit) {
        icons += `<button class="edit-icon" data-id="${committee.id}" data-name='${committee.name}' aria-label="${getTranslation('edit')}">
                    <img src="../images/edit.svg" alt="${getTranslation('edit')}">
                  </button>`;
      }
      if (permissions.canDelete) {
        icons += `<button class="delete-icon" data-id="${committee.id}" aria-label="${getTranslation('delete')}">
                    <img src="../images/delet.svg" alt="${getTranslation('delete')}">
                  </button>`;
      }
      icons += `</div>`;
    }

    // استخراج الاسم حسب اللغة
    let committeeName;
    try {
      const parsed = JSON.parse(committee.name);
      const lang = localStorage.getItem('language') || 'ar';
      committeeName = parsed[lang] || parsed['ar'] || committee.name;
    } catch {
      committeeName = committee.name;
    }

const imgSrc = `http://localhost:3006/${committee.image}`;


    card.innerHTML = `
      ${icons}
      <div class="card-icon bg-orange">
        <img src="${imgSrc}" alt="${committeeName}">
      </div>
      <div class="card-title">${committeeName}</div>
    `;

    card.addEventListener('click', () => {
      window.location.href = `committee-content.html?committeeId=${committee.id}`;
    });

    return card;
  }

  // event handlers
  function onEditClick(e) {
    e.stopPropagation();
    const el = e.currentTarget;
    const id = el.dataset.id;
    const nameData = el.dataset.name;
    editIdInput.value = id;
    try {
      const parsedName = JSON.parse(nameData);
      editCommitteeNameArInput.value = parsedName.ar || '';
      editCommitteeNameEnInput.value = parsedName.en || '';
    } catch {
      editCommitteeNameArInput.value = nameData || '';
      editCommitteeNameEnInput.value = '';
    }
    showModal(editModal);
  }

  function onDeleteClick(e) {
    e.stopPropagation();
    const id = e.currentTarget.dataset.id;
    deleteModal.dataset.committeeId = id;
    showModal(deleteModal);
  }

  // Add committee
  addBtn.addEventListener('click', () => showModal(addModal));
  saveAddBtn.addEventListener('click', async () => {
    if (!permissions.canAdd) return;
    const nameAr = addCommitteeNameArInput.value.trim();
    const nameEn = addCommitteeNameEnInput.value.trim();
    const file = document.getElementById('committeeImage').files[0];
    if (!nameAr || !nameEn || !file) {
      alert('الرجاء إدخال الاسم بالعربية والإنجليزية واختيار صورة.');
      return;
    }
    const name = JSON.stringify({ ar: nameAr, en: nameEn });
    const fd = new FormData();
    fd.append('name', name);
    if (file) fd.append('image', file);
    try {
      const res = await fetch(`${apiBase}/committees`, {
        method: 'POST',
  headers: {
    'Authorization': `Bearer ${getToken()}`
  },        body: fd
      });
      const msg = await res.json();
      if (!res.ok) throw new Error(msg.message || getTranslation('error-adding-committee'));
      alert(getTranslation('committee-added-success'));
      hideModal(addModal);
      loadCommittees();
    } catch (err) {
      console.error(err);
    }
  });
  cancelAdd.addEventListener('click', () => hideModal(addModal));

  // Edit committee
  saveEditBtn.addEventListener('click', async () => {
    if (!permissions.canEdit) return;
    const id = editIdInput.value;
    const nameAr = editCommitteeNameArInput.value.trim();
    const nameEn = editCommitteeNameEnInput.value.trim();
    const file = editImage.files[0];
    if (!id || !nameAr || !nameEn) {
      alert('الرجاء إدخال الاسم بالعربية والإنجليزية.');
      return;
    }
    const name = JSON.stringify({ ar: nameAr, en: nameEn });
    const fd = new FormData();
    fd.append('name', name);
    if (file) fd.append('image', file);
    try {
      const res = await fetch(`${apiBase}/committees/${id}`, {
        method: 'PUT',
  headers: {
    'Authorization': `Bearer ${getToken()}`
  },        body: fd
      });
      const msg = await res.json();
      if (!res.ok) throw new Error(msg.message || getTranslation('error-updating-committee'));
      alert(getTranslation('committee-updated-success'));
      hideModal(editModal);
      loadCommittees();
    } catch (err) {
      console.error(err);
    }
  });
  cancelEdit.addEventListener('click', () => hideModal(editModal));

  // Delete committee
  confirmDel.addEventListener('click', async () => {
    if (!permissions.canDelete) return;
    const id = deleteModal.dataset.committeeId;
    try {
      const res = await fetch(`${apiBase}/committees/${id}`, {
        method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${getToken()}`
  },      });
      const msg = await res.json();
      if (!res.ok) throw new Error(msg.message || getTranslation('error-deleting-committee'));
      
      alert(getTranslation('committee-deleted-success'));
      hideModal(deleteModal);
      loadCommittees();
    } catch (err) {
      console.error(err);
      alert(getTranslation('error-deleting-committee'));
    }
  });
  cancelDel.addEventListener('click', () => hideModal(deleteModal));

  // Search filter
  searchInput.addEventListener('input', ({ target }) => {
    const term = target.value.toLowerCase();
    grid.querySelectorAll('.card').forEach(c => {
      const title = c.querySelector('.card-title').textContent.toLowerCase();
      c.style.display = title.includes(term) ? '' : 'none';
    });
  });

  // Close modals when clicking overlay
  document.querySelectorAll('.modal-overlay').forEach(m => {
    m.addEventListener('click', e => {
      if (e.target === m) hideModal(m);
    });
  });

  // init sequence
  checkAuth();
  await fetchPermissions();
  updateAddButton();
  loadCommittees();
});
