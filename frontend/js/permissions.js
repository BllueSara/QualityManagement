// permissions.js

const apiBase      = 'http://localhost:3006/api';
let authToken      = localStorage.getItem('token') || null;
let selectedUserId = null;

// عناصر الـ DOM
const userList      = document.getElementById('user-list');
const userSearch    = document.getElementById('user-search');
const profileName   = document.getElementById('profile-name');
const profileStatus = document.getElementById('profile-status');
const deptSelect    = document.getElementById('department');

// عناصر الـ popup تعديل الدور
const roleButton    = document.getElementById('btn-change-role');
const rolePopup     = document.getElementById('role-popup');
const roleSelect    = document.getElementById('role-select');
const btnSaveRole   = document.getElementById('btn-save-role');
const btnCancelRole = document.getElementById('btn-cancel-role');
const profileDept    = document.getElementById('profile-department');
const profileRoleEl  = document.getElementById('profile-role');

// =====================
// Helper: fetch with auth
// =====================
async function fetchJSON(url, opts = {}) {
  opts.headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
  };
  const res  = await fetch(url, opts);
  const json = await res.json();
  if (!res.ok) {
    if (res.status === 401) alert('غير مسموح: يرجى تسجيل الدخول مجدداً');
    throw new Error(`HTTP ${res.status}`);
  }
  return json.data || json;
}

// =====================
// 1) Load Users
// =====================
async function loadUsers() {
  const users = await fetchJSON(`${apiBase}/users`);
  userList.innerHTML = '';
  users.forEach(u => {
    const div = document.createElement('div');
    div.className  = 'user-item';
    div.dataset.id = u.id;
    div.innerHTML = `
      <i class="fas fa-user-circle user-avatar-icon"></i>
      <div class="user-info">
        <div class="user-name">${u.name}</div>
        <div class="user-email">${u.email}</div>
      </div>
      <span class="user-status ${u.status==='active'?'active':''}"></span>
    `;
    div.addEventListener('click', () => selectUser(u.id));
    userList.append(div);
  });
}

// =====================
// 2) Select User
// =====================
async function selectUser(id) {
  selectedUserId = id;
  // تمييز
  document.querySelectorAll('.user-item')
    .forEach(el => el.classList.toggle('active', el.dataset.id == id));

  // بيانات المستخدم
  const u = await fetchJSON(`${apiBase}/users/${id}`);
  profileName.textContent   = u.name;
  profileStatus.textContent = u.status==='active'?'غير نشط':' نشط';
  profileStatus.classList.toggle('active', u.status==='active');
  const extra = document.getElementById('profile-extra');
  extra.style.display = 'flex';
  document.getElementById('profile-department').textContent = u.departmentName || '—';
  document.getElementById('profile-role')      .textContent = u.role           || '—';

  // أدوار
  const roles = await fetchJSON(`${apiBase}/roles`);
  roleSelect.innerHTML = roles
    .map(r => `<option value="${r}" ${u.role===r?'selected':''}>${r}</option>`)
    .join('');
roleButton.onclick = () => {
  rolePopup.classList.add('show');
};
  // صلاحيات
  const perms = await fetchJSON(`${apiBase}/users/${id}/permissions`);
  const permsSet = new Set(perms);
  document.querySelectorAll('.permission-item .switch').forEach(label => {
    const input = label.querySelector('input[type="checkbox"]');
const key = label.dataset.key;
    input.checked = permsSet.has(key);
    input.onchange = null;
    input.addEventListener('change', async () => {
      const method = input.checked ? 'POST' : 'DELETE';
      try {
        await fetchJSON(
          `${apiBase}/users/${id}/permissions/${encodeURIComponent(key)}`,
          { method }
        );
      } catch {
        input.checked = !input.checked;
        alert('فشل تحديث الصلاحية');
      }
    });
  });
}

// =====================
// 3) Role Popup Handlers
// =====================
btnCancelRole.addEventListener('click', () => {
  rolePopup.classList.remove('show');
});

// وفي حفظ التعديل:
btnSaveRole.addEventListener('click', async () => {
  if (!selectedUserId) return alert('اختر مستخدماً أولاً');
  const newRole = roleSelect.value;
  try {
    await fetchJSON(`${apiBase}/users/${selectedUserId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role: newRole })
    });
    // صحّح هنا:
    profileRoleEl.textContent = newRole;
    rolePopup.classList.remove('show');
    alert('تم تغيير الدور');
  } catch {
    alert('فشل تغيير الدور');
  }
});

// =====================
// 4) Delete User
// =====================
document.getElementById('btn-delete-user')?.addEventListener('click', async () => {
  if (!selectedUserId) return alert('اختر مستخدماً أولاً');
  if (!confirm('هل أنت متأكد؟')) return;
  await fetchJSON(`${apiBase}/users/${selectedUserId}`, { method: 'DELETE' });
  await loadUsers();
});

// =====================
// 5) Reset Password
// =====================
// ابحث عن المستمع الحالي لـ btn-reset-password واستبدله بهذا:
const btnResetPassword = document.getElementById('btn-reset-password');
if (btnResetPassword) {
  btnResetPassword.addEventListener('click', async () => {
    if (!selectedUserId) return alert('اختر مستخدماً أولاً');
    const newPassword = prompt('أدخل كلمة المرور الجديدة للمستخدم:');
    if (!newPassword) return; // إذا ألغى الإدخال
    try {
      await fetchJSON(
        `${apiBase}/users/${selectedUserId}/reset-password`,
        {
          method: 'POST',
          body: JSON.stringify({ newPassword })
        }
      );
      alert('تم تحديث كلمة المرور بنجاح');
    } catch (err) {
      console.error(err);
      alert('فشل إعادة التعيين: ' + err.message);
    }
  });
}

// =====================
// 6) Search Users
// =====================
userSearch?.addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  document.querySelectorAll('.user-item').forEach(el => {
    const name  = el.querySelector('.user-name').textContent.toLowerCase();
    const email = el.querySelector('.user-email').textContent.toLowerCase();
    el.style.display = (name.includes(q)||email.includes(q)) ? 'flex' : 'none';
  });
});




// =====================
// 8) Open Add/Edit Modal
// =====================
const btnAdd = document.getElementById('add-user-btn');
if (btnAdd) {
  btnAdd.addEventListener('click', () => {
    selectedUserId = null;
    document.getElementById('addUserModal').style.display = 'flex';
    document.querySelector('.modal-title').textContent = 'إضافة مستخدم جديد';
    ['userName','jobTitle','email','password'].forEach(id => {
      document.getElementById(id).value = '';
    });
  });
}
const btnCancel = document.getElementById('cancelAddUser');
if (btnCancel) {
  btnCancel.addEventListener('click', () => {
    document.getElementById('addUserModal').style.display = 'none';
  });
}

// =====================
// 9) Save or Update User
// =====================
const btnSaveUser = document.getElementById('saveUser');
if (btnSaveUser) {
  btnSaveUser.addEventListener('click', async () => {
    const data = {
      name:         document.getElementById('userName').value,
      jobTitle:     document.getElementById('jobTitle').value,
      departmentId: document.getElementById('department').value,
      email:        document.getElementById('email').value,
      password:     document.getElementById('password').value,
      role:         document.getElementById('role')?.value || 'user'
    };
    const method = selectedUserId ? 'PUT' : 'POST';
    const url    = selectedUserId
      ? `${apiBase}/users/${selectedUserId}`
      : `${apiBase}/users`;
    await fetchJSON(url, { method, body: JSON.stringify(data) });
    document.getElementById('addUserModal').style.display = 'none';
    await loadUsers();
  });
}

// =====================
// 10) Export Excel/PDF
// =====================
const btnExcel = document.getElementById('btn-export-excel');
if (btnExcel) {
  btnExcel.addEventListener('click', () => {
    if (!selectedUserId) return alert('اختر مستخدماً أولاً');
    window.location = `${apiBase}/users/${selectedUserId}/export/excel`;
  });
}
const btnPdf = document.getElementById('btn-export-pdf');
if (btnPdf) {
  btnPdf.addEventListener('click', () => {
    if (!selectedUserId) return alert('اختر مستخدماً أولاً');
    window.location = `${apiBase}/users/${selectedUserId}/export/pdf`;
  });
}

// =====================
// Initialize on load
// =====================
document.addEventListener('DOMContentLoaded', () => {
  if (authToken) {
    loadUsers();
  } else {
    console.log('لا يوجد توكن؛ الرجاء تسجيل الدخول');
  }
});
