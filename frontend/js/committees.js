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
      alert('يرجى تسجيل الدخول أولاً.');
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
    const res = await fetch(`${apiBase}/committees`, {
      headers: authHeaders()
    });
    const list = await res.json();
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
  }

  function createCard(committee) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = committee.id;

    let icons = '';
    if (permissions.canEdit || permissions.canDelete) {
      icons = `<div class="card-icons">`;
      if (permissions.canEdit) {
        icons += `<button class="edit-icon" data-id="${committee.id}" aria-label="تعديل">
                    <img src="../images/edit.svg" alt="تعديل">
                  </button>`;
      }
      if (permissions.canDelete) {
        icons += `<button class="delete-icon" data-id="${committee.id}" aria-label="حذف">
                    <img src="../images/delet.svg" alt="حذف">
                  </button>`;
      }
      icons += `</div>`;
    }

    const imgPath = committee.image
      ? (committee.image.startsWith('/uploads/')
          ? committee.image
          : `/${committee.image.replace(/^\/+/, '')}`)
      : '/images/committee.svg';

    card.innerHTML = `
      ${icons}
      <div class="card-icon bg-orange">
        <img src="${apiBase}${imgPath}" alt="${committee.name}">
      </div>
      <div class="card-title">${committee.name}</div>
    `;

    card.addEventListener('click', () => {
      window.location.href = `committee-content.html?committeeId=${committee.id}`;
    });

    return card;
  }

  // event handlers
  function onEditClick(e) {
    e.stopPropagation();
    const id = e.currentTarget.dataset.id;
    fetch(`${apiBase}/committees/${id}`, { headers: authHeaders() })
      .then(r => r.json())
      .then(data => {
        editIdInput.value = data.id;
        editName.value    = data.name;
        showModal(editModal);
      })
      .catch(() => alert('خطأ في جلب بيانات اللجنة'));
  }

  function onDeleteClick(e) {
    e.stopPropagation();
    const id = e.currentTarget.dataset.id;
    editIdInput.value = id;
    showModal(deleteModal);
  }

  // Add committee
  addBtn.addEventListener('click', () => showModal(addModal));
  saveAddBtn.addEventListener('click', async () => {
    if (!permissions.canAdd) return;
    const name = document.getElementById('committeeName').value;
    const file = document.getElementById('committeeImage').files[0];
    if (!name) return alert('الرجاء إدخال اسم اللجنة');
    const fd = new FormData();
    fd.append('name', name);
    if (file) fd.append('image', file);

    const res = await fetch(`${apiBase}/committees`, {
      method: 'POST',
      headers: authHeaders(),
      body: fd
    });
    const msg = await res.json();
    if (!res.ok) return alert(msg.message || 'فشل الإضافة');
    hideModal(addModal);
    loadCommittees();
  });
  cancelAdd.addEventListener('click', () => hideModal(addModal));

  // Edit committee
  saveEditBtn.addEventListener('click', async () => {
    if (!permissions.canEdit) return;
    const id = editIdInput.value;
    const name = editName.value;
    if (!name) return alert('الرجاء إدخال اسم اللجنة');
    const fd = new FormData();
    fd.append('name', name);
    if (editImage.files[0]) fd.append('image', editImage.files[0]);

    const res = await fetch(`${apiBase}/committees/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: fd
    });
    const msg = await res.json();
    if (!res.ok) return alert(msg.message || 'فشل التعديل');
    hideModal(editModal);
    loadCommittees();
  });
  cancelEdit.addEventListener('click', () => hideModal(editModal));

  // Delete committee
  confirmDel.addEventListener('click', async () => {
    if (!permissions.canDelete) return;
    const id = editIdInput.value;
    const res = await fetch(`${apiBase}/committees/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    const msg = await res.json();
    if (!res.ok) return alert(msg.message || 'فشل الحذف');
    hideModal(deleteModal);
    loadCommittees();
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

  // init sequence
  checkAuth();
  await fetchPermissions();
  updateAddButton();
  loadCommittees();
});
