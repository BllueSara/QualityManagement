// permissions.js

// Toast notification function
function showToast(message, type = 'info', duration = 3000) {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    background-color: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
    color: #fff;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    opacity: 0;
    transform: translateY(-20px);
    transition: opacity 0.5s ease, transform 0.5s ease;
  `;

  toastContainer.appendChild(toast);

  // Force reflow
  toast.offsetWidth;

  // Show the toast
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  }, 10);

  // Set a timeout to remove the toast
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 500);
  }, duration);
}

const apiBase      = 'http://localhost:3006/api';
let authToken      = localStorage.getItem('token') || null;
let selectedUserId = null;
let myPermsSet     = new Set(); // صلاحيات المستخدم الحالي
let editUserRole = null;

// عناصر الـ DOM
const userList      = document.getElementById('user-list');
const userSearch    = document.getElementById('user-search');
const profileName   = document.getElementById('profile-name');
const profileStatus = document.getElementById('profile-status');
const profileDept   = document.getElementById('profile-department');
const profileRoleEl = document.getElementById('profile-role');
const permissionsSection = document.querySelector('.permission-section');
const btnDeleteUser = document.getElementById('btn-delete-user');
const btnResetPwd   = document.getElementById('btn-reset-password');
const btnChangeRole = document.getElementById('btn-change-role');
const btnAddUser    = document.getElementById('add-user-btn');
const btnClearCache = document.getElementById('btn-clear-cache');

// إضافة زر إلغاء التفويضات
const btnRevokeDelegations = document.createElement('button');
btnRevokeDelegations.id = 'btn-revoke-delegations';
btnRevokeDelegations.textContent = getTranslation('revoke-delegations') || 'إلغاء التفويضات';
btnRevokeDelegations.style = 'margin: 0 8px; background: #e53e3e; color: #fff; border: none; border-radius: 6px; padding: 8px 18px; font-size: 1rem; cursor: pointer;';
btnRevokeDelegations.onclick = openRevokeDelegationsPopup;
// إضافة الزر بجانب زر إضافة مستخدم
if (btnAddUser && btnAddUser.parentNode) {
  btnAddUser.parentNode.insertBefore(btnRevokeDelegations, btnAddUser.nextSibling);
}
// إظهار الزر فقط إذا كان للمستخدم صلاحية (admin أو من لديه صلاحية revoke_delegations)
btnRevokeDelegations.style.display = 'none';

// زر مسح الكاش ميموري - للادمن فقط
if (btnClearCache) {
  btnClearCache.onclick = async () => {
    // تحقق من أن المستخدم admin
    const authToken = localStorage.getItem('token') || '';
    const payload = JSON.parse(atob(authToken.split('.')[1] || '{}'));
    const myRole = payload.role;
    
    if (myRole !== 'admin') {
      showToast('هذا الزر متاح للادمن فقط', 'warning');
      return;
    }
    
    if (!confirm('هل أنت متأكد من مسح الكاش ميموري للموقع؟ هذا سيؤدي إلى إعادة تحميل الصفحة.')) {
      return;
    }
    
    try {
      // مسح localStorage
      const keysToKeep = ['token', 'language']; // نحتفظ بالتوكن واللغة
      const allKeys = Object.keys(localStorage);
      allKeys.forEach(key => {
        if (!keysToKeep.includes(key)) {
          localStorage.removeItem(key);
        }
      });
      
      // مسح sessionStorage
      sessionStorage.clear();
      
      // مسح الكاش ميموري للمتصفح
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      
      // مسح IndexedDB إذا كان موجود
      if ('indexedDB' in window) {
        const databases = await indexedDB.databases();
        databases.forEach(db => {
          if (db.name) {
            indexedDB.deleteDatabase(db.name);
          }
        });
      }
      
      showToast('تم مسح الكاش ميموري بنجاح. سيتم إعادة تحميل الصفحة الآن.', 'success');
      
      // إعادة تحميل الصفحة بعد ثانيتين
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (error) {
      console.error('خطأ في مسح الكاش ميموري:', error);
      showToast('حدث خطأ أثناء مسح الكاش ميموري: ' + error.message, 'error');
    }
  };
}

// زر سحب الملفات
const btnRevokeFiles = document.getElementById('btn-revoke-files');
if (btnRevokeFiles) {
  btnRevokeFiles.onclick = async () => {
    if (!selectedUserId) return showToast(getTranslation('please-select-user') || 'الرجاء اختيار مستخدم أولاً', 'warning');
    
    try {
      // جلب الملفات من API
      const files = await fetchJSON(`${apiBase}/users/${selectedUserId}/approvals-sequence-files`);
      
      // بناء Popup
      const overlay = document.createElement('div');
      overlay.style = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.35);z-index:9999;display:flex;align-items:center;justify-content:center;';
      
      const box = document.createElement('div');
      box.style = 'background:#fff;padding:38px 38px 28px 38px;border-radius:18px;max-width:700px;min-width:420px;text-align:center;box-shadow:0 4px 32px #0003;max-height:80vh;overflow:auto;display:flex;flex-direction:column;align-items:center;';
      
      box.innerHTML = `
        <div style='display:flex;align-items:center;justify-content:center;margin-bottom:22px;'>
          <i class="fas fa-exclamation-triangle" style="color:#e53e3e;font-size:2em;margin-left:14px;"></i>
          <span style='font-size:1.45rem;font-weight:700;'>${getTranslation('revoke_files') || 'سحب الملفات من المستخدم'}</span>
        </div>
      `;
      
      if (!files.length) {
        box.innerHTML += `<div style='margin:24px 0 12px 0;color:#888;font-size:1.05em;'>${getTranslation('no-contents') || 'لا يوجد ملفات في التسلسل'}</div>`;
        // زر إغلاق إذا لا يوجد ملفات
        const btnClose = document.createElement('button');
        btnClose.textContent = getTranslation('cancel') || 'إغلاق';
        btnClose.style = 'margin-top:18px;background:#888;color:#fff;border:none;border-radius:6px;padding:8px 24px;font-size:1rem;cursor:pointer;';
        btnClose.onclick = () => document.body.removeChild(overlay);
        box.appendChild(btnClose);
      } else {
        box.innerHTML += `<div style='width:100%;text-align:right;margin-bottom:16px;font-size:1.13em;'>${getTranslation('select-files-to-revoke') || 'اختر الملفات التي تريد سحبها:'}</div>`;
        
        // شبكة الملفات (جدول)
        const table = document.createElement('table');
        table.style = 'width:100%;margin-bottom:18px;border-collapse:collapse;text-align:right;';
        table.innerHTML = `
          <thead>
            <tr style="background:#f5f5f5;">
              <th style="padding:12px 8px;border-bottom:2px solid #ddd;"></th>
              <th style="padding:12px 8px;border-bottom:2px solid #ddd;">${getTranslation('file-name') || 'اسم الملف'}</th>
              <th style="padding:12px 8px;border-bottom:2px solid #ddd;">${getTranslation('department-or-committee') || 'القسم/اللجنة'}</th>
              <th style="padding:12px 8px;border-bottom:2px solid #ddd;">${getTranslation('folder-name') || 'المجلد'}</th>
            </tr>
          </thead>
          <tbody></tbody>
        `;
        const tbody = table.querySelector('tbody');
        files.forEach(f => {
          const tr = document.createElement('tr');
          tr.style = 'border-bottom:1px solid #eee;';
          tr.innerHTML = `
            <td style="padding:10px 8px;text-align:center;"><input type='checkbox' id='file-chk-${f.id}' value='${f.id}' style='accent-color:#e53e3e;width:18px;height:18px;cursor:pointer;'></td>
            <td style="padding:10px 8px;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><label for='file-chk-${f.id}' style='cursor:pointer;font-weight:500;'>${f.title}</label></td>
            <td style="padding:10px 8px;max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${f.type === 'department' ? (f.departmentName || '—') : (f.committeeName || '—')}</td>
            <td style="padding:10px 8px;max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${f.folderName || '—'}</td>
          `;
          tbody.appendChild(tr);
        });
        box.appendChild(table);
        
        // أزرار بجانب بعض
        const btnsRow = document.createElement('div');
        btnsRow.style = 'display:flex;gap:18px;justify-content:center;margin-top:16px;width:100%';
        
        const btnConfirm = document.createElement('button');
        btnConfirm.id = 'confirm-revoke-files';
        btnConfirm.textContent = getTranslation('revoke_files') || 'سحب المحدد';
        btnConfirm.style = 'background:#e53e3e;color:#fff;border:none;border-radius:10px;padding:13px 40px;font-size:1.13em;font-weight:600;cursor:pointer;transition:background 0.2s;';
        
        const btnClose = document.createElement('button');
        btnClose.textContent = getTranslation('cancel') || 'إغلاق';
        btnClose.style = 'background:#888;color:#fff;border:none;border-radius:10px;padding:10px 38px;font-size:1.08em;cursor:pointer;transition:background 0.2s;';
        btnClose.onmouseover = () => btnClose.style.background = '#555';
        btnClose.onmouseout = () => btnClose.style.background = '#888';
        btnClose.onclick = () => document.body.removeChild(overlay);
        
        btnsRow.appendChild(btnConfirm);
        btnsRow.appendChild(btnClose);
        box.appendChild(btnsRow);
        
        // إضافة حدث الضغط بعد تعريف الزر وإضافته للـ DOM
        btnConfirm.addEventListener('click', async () => {
          const checked = Array.from(box.querySelectorAll('input[type=checkbox]:checked')).map(i => i.value);
          if (!checked.length) return showToast('اختر ملف واحد على الأقل', 'warning');
          
          try {
            await fetchJSON(`${apiBase}/users/${selectedUserId}/revoke-files`, {
              method: 'POST',
              body: JSON.stringify({ fileIds: checked })
            });
            showToast('تم سحب الملفات المحددة', 'success');
            document.body.removeChild(overlay);
          } catch (error) {
            showToast('فشل في سحب الملفات: ' + error.message, 'error');
          }
        });
      }
      
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      
    } catch (error) {
      showToast('فشل في جلب الملفات: ' + error.message, 'error');
    }
  };
}

// popup تعديل الدور
const rolePopup     = document.getElementById('role-popup');
const roleSelect    = document.getElementById('role-select');
const btnSaveRole   = document.getElementById('btn-save-role');
const btnCancelRole = document.getElementById('btn-cancel-role');
const departmentSelect = document.getElementById('department');

// زر تعديل معلومات المستخدم
const btnEditUserInfo = document.getElementById('btn-edit-user-info');
const editUserModal = document.getElementById('editUserModal');
const editUserName = document.getElementById('editUserName');
const editEmployeeNumber = document.getElementById('editEmployeeNumber');
const editDepartment = document.getElementById('editDepartment');
const editEmail = document.getElementById('editEmail');
const btnCancelEditUser = document.getElementById('cancelEditUser');
const btnSaveEditUser = document.getElementById('saveEditUser');

  // في البداية أخفِ قسم الصلاحيات
  permissionsSection.style.display = 'none';
  
  // إخفاء زر سحب الملفات في البداية
  if (btnRevokeFiles) {
    btnRevokeFiles.style.display = 'none';
  }

// =====================
// Helper: fetch with auth
// =====================
async function fetchJSON(url, opts = {}) {
  opts.headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
  };

  const res = await fetch(url, opts);

  // حاول نقرأ الـ JSON حتى لو كان خطأ
  let body;
  try {
    body = await res.json();
  } catch {
    body = {};
  }

  // لو غير OK، خُذ الرسالة من body أو fallback على status
  if (!res.ok) {
    const msg = body.message || body.error || `حدث خطأ (رمز ${res.status})`;

    if (res.status === 401) {
      showToast('غير مسموح: يرجى تسجيل الدخول مجدداً', 'error');
    } else {
      showToast(msg, 'error');
    }

    throw new Error(msg);
  }

  // لو OK، رجع data أو الجسم كله
  return body.data ?? body;
}

// =====================
// Load current user permissions
// =====================
async function loadMyPermissions() {
  if (!authToken) return;
  try {
    const payload = JSON.parse(atob(authToken.split('.')[1] || '{}'));
    const myId = payload.id;
    const perms = await fetchJSON(`${apiBase}/users/${myId}/permissions`);
    myPermsSet = new Set(perms);
    
    // إظهار زر سحب الملفات إذا كان admin أو لديه صلاحية revoke_files
    const myRole = payload.role;
    if (btnRevokeFiles) {
      if (myRole === 'admin' || myPermsSet.has('revoke_files')) {
        // لا نعرض الزر هنا، سيتم عرضه عند اختيار مستخدم
        // btnRevokeFiles.style.display = '';
      } else {
        btnRevokeFiles.style.display = 'none';
      }
    }
    
    // إظهار زر مسح الكاش ميموري للادمن فقط
    if (btnClearCache) {
      btnClearCache.style.display = (myRole === 'admin') ? '' : 'none';
    }
  } catch (e) {
    showToast('فشل جلب صلاحياتي.', 'error');
  }
}
async function fetchDepartments() {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${apiBase}/departments`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error('فشل في جلب الأقسام');
    }

    if (!Array.isArray(result)) {
      throw new Error('الرد ليس مصفوفة أقسام');
    }

    // تحديث القائمة المنسدلة
const lang = localStorage.getItem('language') || 'ar';
const selectText = lang === 'ar' ? 'اختر القسم' : 'Select Department';
departmentSelect.innerHTML = `<option value="">${selectText}</option>`;


    result.forEach(dept => {
      const option = document.createElement('option');
      option.value = dept.id;
let name = dept.name;
try {
  if (typeof name === 'string' && name.trim().startsWith('{')) {
    name = JSON.parse(name);
  }
  option.textContent = typeof name === 'object'
    ? (name[lang] || name.ar || name.en || '')
    : name;
} catch {
  option.textContent = '';
}

      departmentSelect.appendChild(option);
    });
  } catch (error) {
    console.error('🚨 fetchDepartments error:', error);
    showToast('خطأ في جلب الأقسام.', 'error');
  }
}




// =====================
// 1) Load Users
// =====================
async function loadUsers() {
  const users = await fetchJSON(`${apiBase}/users`);
  userList.innerHTML = '';
  users.forEach(u => {
    const div = document.createElement('div');
    div.className = 'user-item';
    div.dataset.id = u.id;
    div.innerHTML = `
      <i class=\"fas fa-user-circle user-avatar-icon\"></i>
      <div class=\"user-info\">
        <div class=\"user-name\">${u.name}</div>
        <div class=\"user-email\">${u.email}</div>
      </div>
      <span class=\"user-status ${u.status}\"></span>
    `;
    div.addEventListener('click', () => selectUser(u.id));
    userList.append(div);
  });
  
  // إخفاء زر سحب الملفات عند تحميل المستخدمين
  if (btnRevokeFiles) {
    btnRevokeFiles.style.display = 'none';
  }
  
  // لا نحتاج لإخفاء زر مسح الكاش ميموري هنا - سيتم التحكم به في loadMyPermissions
}

// =====================
// 2) Select User
// =====================
async function selectUser(id) {
  const authToken = localStorage.getItem('token') || '';
  const jwtPayload = JSON.parse(atob(authToken.split('.')[1] || '{}'));

  // 2) فعل العرض للمستخدم المحدد
  selectedUserId = id;
  document.querySelectorAll('.user-item')
    .forEach(el => el.classList.toggle('active', el.dataset.id == id));
    
  // إخفاء زر سحب الملفات مؤقتاً حتى يتم تحميل بيانات المستخدم
  if (btnRevokeFiles) {
    btnRevokeFiles.style.display = 'none';
  }
  
  // إخفاء قسم الصلاحيات مؤقتاً
  permissionsSection.style.display = 'none';

  // 3) جلب بيانات المستخدم وتحديث الواجهة
  const u = await fetchJSON(`${apiBase}/users/${id}`);
profileName.textContent = u.name;

// 1) عرض الحالة مع الترجمة
const isActive = u.status === 'active';
profileStatus.textContent = getTranslation(
  isActive ? 'status_active' : 'status_inactive'
);
profileStatus.classList.toggle('active',   isActive);
profileStatus.classList.toggle('inactive', !isActive);
profileStatus.style.cursor = 'pointer';
profileStatus.title = getTranslation(
  isActive ? 'status_confirm_inactive' : 'status_confirm_active'
);

// 2) ربط حدث التغيير مع التأكيد المترجم
profileStatus.onclick = async () => {
  // تحقق: لا يمكن تغيير حالة مستخدم admin
  if (u.role === 'admin') {
    return;
  }
  // تحقق: فقط admin أو من لديه change_status يمكنه التغيير
  const payload = JSON.parse(atob(authToken.split('.')[1] || '{}'));
  const myRole = payload.role;
  if (!(myRole === 'admin' || myPermsSet.has('change_status'))) {
    return;
  }

  const newStatus = profileStatus.classList.contains('active')
    ? 'inactive'
    : 'active';

  // جملة التأكيد المترجمة
  const confirmMsg = `${getTranslation('confirm_status_change')} "` +
    `${getTranslation(newStatus === 'active' ? 'status_active' : 'status_inactive')}"؟`;

  if (!confirm(confirmMsg)) return;

  try {
    await fetchJSON(`${apiBase}/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus })
    });

    // 3) حدّث الواجهة بعد التغيير
    const nowActive = newStatus === 'active';
    profileStatus.textContent = getTranslation(
      nowActive ? 'status_active' : 'status_inactive'
    );
    profileStatus.classList.toggle('active',   nowActive);
    profileStatus.classList.toggle('inactive', !nowActive);
    profileStatus.title = getTranslation(
      nowActive ? 'status_confirm_inactive' : 'status_confirm_active'
    );

    // 4) طرد نفسك لو عطّلت حسابك
    if (Number(id) === payload.id && newStatus === 'inactive') {
      showToast(getTranslation('logout_due_to_deactivation'), 'warning');
      localStorage.removeItem('token');
      window.location.href = '/frontend/html/login.html';
    }
  } catch {
    showToast(getTranslation('status_change_failed'), 'error');
  }
};



try {
  const lang = localStorage.getItem('language') || 'ar';
  const name = typeof u.departmentName === 'string' && u.departmentName.trim().startsWith('{')
    ? JSON.parse(u.departmentName)[lang] || JSON.parse(u.departmentName).ar || JSON.parse(u.departmentName).en
    : u.departmentName;
  profileDept.textContent = name || '—';
} catch (err) {
  profileDept.textContent = '—';
}
  profileRoleEl.textContent = u.role           || '—';
document.querySelector('.user-profile-header')?.classList.add('active');

  // دور المستخدم الحالي
  const payload = JSON.parse(atob(authToken.split('.')[1] || '{}'));
  const myRole = payload.role;
  const isAdmin = myRole === 'admin';

  // زر إضافة مستخدم
  btnAddUser.style.display = (isAdmin || myPermsSet.has('add_user')) ? '' : 'none';

  // إذا الهدف Admin: أخفِ القسم كامل وأزرار الإدارة
  if (u.role === 'admin') {
    permissionsSection.style.display = 'none';
    btnDeleteUser.style.display = 'none';
    btnResetPwd.style.display   = 'none';
    btnChangeRole.style.display = 'none';
    if (btnRevokeFiles) {
      btnRevokeFiles.style.display = 'none';
    }
    return;
  }

  // أظهر قسم الصلاحيات للمستخدمين غير Admin
  permissionsSection.style.display = '';

  // أزرار الحذف وإعادة التعيين وتغيير الدور
  btnDeleteUser.style.display = (isAdmin || myPermsSet.has('delete_user')) ? '' : 'none';
  btnResetPwd.style.display   = (isAdmin || myPermsSet.has('change_password')) ? '' : 'none';
  btnChangeRole.style.display = (isAdmin || myPermsSet.has('change_role')) ? '' : 'none';
  
  // إظهار زر سحب الملفات إذا كان admin أو لديه صلاحية revoke_files
  if (btnRevokeFiles) {
    btnRevokeFiles.style.display = (isAdmin || myPermsSet.has('revoke_files')) ? '' : 'none';
  }

  // جلب الأدوار للمستخدمين غير Admin
  const roles = await fetchJSON(`${apiBase}/users/roles`);
  console.log('Roles from API:', roles);
  // إظهار manager_ovr فقط للادمن
  let filteredRoles = roles;
  console.log('isAdmin:', isAdmin);
  if (!isAdmin) {
    filteredRoles = roles.filter(r => r !== 'manager_ovr');
  }
  roleSelect.innerHTML = filteredRoles.map(r => `
    <option value="${r}" ${u.role===r?'selected':''}>${r}</option>
  `).join('');
  btnChangeRole.onclick = () => rolePopup.classList.add('show');

  // صلاحيات المستخدم المستهدف
  const targetPerms = await fetchJSON(`${apiBase}/users/${id}/permissions`);
  const targetSet = new Set(targetPerms);
  const canGrant = isAdmin || myPermsSet.has('grant_permissions');

  document.querySelectorAll('.permission-item').forEach(item => {
    const label = item.querySelector('.switch');
    const input = label.querySelector('input[type="checkbox"]');
    const key   = label.dataset.key;

    // إظهار البنود: Admin يرى الكل، ومُخول grant يرى فقط ما يملكه
    if (!isAdmin && myRole !== 'admin' && !myPermsSet.has(key) && key !== 'grant_permissions') {
      item.style.display = 'none';
    } else {
      item.style.display = '';
    }

    // تأشير الحالة
    input.checked = targetSet.has(key);
    input.disabled = !(isAdmin || myPermsSet.has(key));
    input.onchange = async () => {
      const checked = input.checked;
      try {
        const method = checked ? 'POST' : 'DELETE';
        await fetchJSON(`${apiBase}/users/${id}/permissions/${encodeURIComponent(key)}`, { method });
      } catch {
        input.checked = !checked;
        showToast('فشل تحديث الصلاحية', 'error');
      }
    };
  });

  // إظهار الدروب داون إذا كانت الصلاحية مفعلة
  const viewOwnCommitteesCheckbox = document.querySelector('label.switch[data-key="view_own_committees"] input[type="checkbox"]');
  const committeesDropdown = document.getElementById('committees-dropdown');
  if (viewOwnCommitteesCheckbox && committeesDropdown) {
    if (targetSet.has('view_own_committees')) {
      committeesDropdown.style.display = 'block';
      loadUserCommittees(id); // تحميل لجان المستخدم المختارة
    } else {
      committeesDropdown.style.display = 'none';
    }
  }

  // تحميل اللجان المختارة للمستخدم
  await loadUserCommittees(id);

  // إظهار الزر حسب الصلاحية عند اختيار المستخدم
  showEditUserInfoButton(u);

  // إظهار زر إلغاء التفويضات فقط إذا كان admin أو لديه صلاحية grant_permissions
  btnRevokeDelegations.style.display = (isAdmin || myPermsSet.has('grant_permissions')) ? '' : 'none';
  
  // إظهار زر سحب الملفات إذا كان admin أو لديه صلاحية revoke_files
  if (btnRevokeFiles) {
    if (isAdmin || myPermsSet.has('revoke_files')) {
      btnRevokeFiles.style.display = '';
    } else {
      btnRevokeFiles.style.display = 'none';
    }
  }
  
  // لا نحتاج للتحكم في زر مسح الكاش ميموري هنا - سيتم التحكم به في loadMyPermissions
}


// handlers role popup
btnCancelRole.addEventListener('click', () => rolePopup.classList.remove('show'));
btnSaveRole.addEventListener('click', async () => {
  if (!selectedUserId) return showToast('اختر مستخدماً أولاً', 'warning');
  const newRole = roleSelect.value;
  try {
    await fetchJSON(`${apiBase}/users/${selectedUserId}/role`, { method: 'PUT', body: JSON.stringify({ role: newRole }) });
    profileRoleEl.textContent = newRole;
    rolePopup.classList.remove('show');
    showToast('تم تغيير الدور', 'success');
  } catch {
    showToast('فشل تغيير الدور', 'error');
  }
});

// Delete User
btnDeleteUser.addEventListener('click', async () => {
  if (!selectedUserId) {
    return showToast('اختر مستخدماً أولاً', 'warning');
  }
  if (!confirm('هل أنت متأكد من حذف هذا المستخدم؟')) {
    return;
  }

  try {
    const result = await fetchJSON(`${apiBase}/users/${selectedUserId}`, {
      method: 'DELETE'
    });
    showToast(result.message || 'تم حذف المستخدم بنجاح', 'success');
    loadUsers();
  } catch (err) {
    console.error('خطأ في حذف المستخدم:', err);
    // err.message هنا يحمل "خطأ في حذف المستخدم" أو الرسالة الخاصة من السيرفر
    showToast(err.message, 'error');
  }
});


// Reset Password
btnResetPwd.addEventListener('click', async () => {
  if (!selectedUserId) return showToast('اختر مستخدماً أولاً', 'warning');
  const newPassword = prompt('أدخل كلمة المرور الجديدة للمستخدم:');
  if (!newPassword) return;
  try {
    await fetchJSON(`${apiBase}/users/${selectedUserId}/reset-password`, { method: 'PUT', body: JSON.stringify({ newPassword }) });
    showToast('تم تحديث كلمة المرور بنجاح', 'success');
  } catch (err) {
    showToast('فشل إعادة التعيين: ' + err.message, 'error');
  }
});

// Search Users
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
document.querySelector('.modal-title').textContent = getTranslation('add-user');
    ['userName','email','password'].forEach(id => {
      document.getElementById(id).value = '';
        fetchDepartments(); // ✅ هنا تستدعي الأقسام وتعبئها

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
  name: document.getElementById('userName').value,
  departmentId: document.getElementById('department').value,
  email: document.getElementById('email').value,
  password: document.getElementById('password').value,
  role: document.getElementById('role')?.value || 'user',
  employeeNumber: document.getElementById('employeeNumber').value  // ✅ أضف هذا
};

console.log('🚀 departmentId:', data.departmentId);

        console.log('🚀 Sending user data:', data);

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
    if (!selectedUserId) return showToast('اختر مستخدماً أولاً', 'warning');
    window.location = `${apiBase}/users/${selectedUserId}/export/excel`;
  });
}
const btnPdf = document.getElementById('btn-export-pdf');
if (btnPdf) {
  btnPdf.addEventListener('click', () => {
    if (!selectedUserId) return showToast('اختر مستخدماً أولاً', 'warning');
    window.location = `${apiBase}/users/${selectedUserId}/export/pdf`;
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  if (!authToken) return console.log('لا يوجد توكن؛ الرجاء تسجيل الدخول');
  await loadMyPermissions();

  loadUsers();
  initializeCommitteesDropdown();
  
  // إخفاء زر سحب الملفات في البداية
  if (btnRevokeFiles) {
    btnRevokeFiles.style.display = 'none';
  }
  
  // لا نحتاج لإخفاء زر مسح الكاش ميموري هنا - سيتم التحكم به في loadMyPermissions
});

// =====================
// Committees Dropdown Functionality
// =====================
let selectedCommittees = new Set();
let allCommittees = [];

async function initializeCommitteesDropdown() {
  console.log('🚀 Initializing committees dropdown...');
  const dropdown = document.getElementById('committees-dropdown');
  const dropdownBtn = dropdown?.querySelector('.dropdown-btn');
  const dropdownContent = dropdown?.querySelector('.dropdown-content');
  const searchInput = dropdown?.querySelector('.committee-search');
  const committeesList = dropdown?.querySelector('.committees-list');

  console.log('🔍 Dropdown elements found:', {
    dropdown: !!dropdown,
    dropdownBtn: !!dropdownBtn,
    dropdownContent: !!dropdownContent,
    searchInput: !!searchInput,
    committeesList: !!committeesList
  });

  if (!dropdown || !dropdownBtn || !dropdownContent || !searchInput || !committeesList) {
    console.log('❌ Dropdown elements not found');
    return;
  }

  // Load committees
  await loadAllCommittees();

  // Toggle dropdown
  dropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownContent.classList.toggle('show');
    dropdownBtn.classList.toggle('active');
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target)) {
      dropdownContent.classList.remove('show');
      dropdownBtn.classList.remove('active');
    }
  });

  // Search functionality
  searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const items = committeesList.querySelectorAll('.committee-item');
    
    items.forEach(item => {
      const label = item.querySelector('label').textContent.toLowerCase();
      item.style.display = label.includes(searchTerm) ? 'flex' : 'none';
    });
  });

  // Handle committee selection
  committeesList.addEventListener('change', (e) => {
    if (e.target.type === 'checkbox') {
      const committeeId = e.target.value;
      const committeeName = e.target.nextElementSibling.textContent;
      
      if (e.target.checked) {
        selectedCommittees.add(committeeId);
        e.target.closest('.committee-item').classList.add('selected');
      } else {
        selectedCommittees.delete(committeeId);
        e.target.closest('.committee-item').classList.remove('selected');
      }
      
      updateDropdownButtonText();
      
      // Save to database when selection changes
      if (selectedUserId) {
        saveUserCommittees();
      }
    }
  });
}

async function loadAllCommittees() {
  console.log('🔄 Loading all committees...');
  try {
    const response = await fetch(`${apiBase}/committees`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (!response.ok) throw new Error('Failed to fetch committees');
    
    allCommittees = await response.json();
    console.log('✅ Loaded committees:', allCommittees.length);
    renderCommitteesList();
  } catch (error) {
    console.error('❌ Error loading committees:', error);
  }
}

async function loadUserCommittees(userId) {
  console.log('🔄 Loading committees for user:', userId);
  try {
    const response = await fetch(`${apiBase}/users/${userId}/committees`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    console.log('📡 Response status:', response.status);
    
    if (response.ok) {
      const userCommittees = await response.json();
      console.log('✅ User committees loaded:', userCommittees);
      selectedCommittees = new Set(userCommittees.map(c => c.id.toString()));
      console.log('📝 Selected committees set:', Array.from(selectedCommittees));
      renderCommitteesList();
      updateDropdownButtonText();
    } else {
      console.log('❌ Failed to load user committees, status:', response.status);
      const errorText = await response.text();
      console.log('❌ Error response:', errorText);
    }
  } catch (error) {
    console.error('❌ Error loading user committees:', error);
  }
}

async function saveUserCommittees() {
  if (!selectedUserId) return;
  
  try {
    const response = await fetch(`${apiBase}/users/${selectedUserId}/committees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        committeeIds: Array.from(selectedCommittees).map(id => parseInt(id))
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to save committees');
    }
  } catch (error) {
    console.error('Error saving user committees:', error);
  }
}

function renderCommitteesList() {
  console.log('🎨 Rendering committees list...');
  const committeesList = document.querySelector('.committees-list');
  if (!committeesList) {
    console.log('❌ Committees list element not found');
    return;
  }

  committeesList.innerHTML = '';
  const lang = localStorage.getItem('language') || 'ar';
  console.log('📝 Rendering', allCommittees.length, 'committees for language:', lang);
  console.log('📝 Selected committees:', Array.from(selectedCommittees));

  allCommittees.forEach(committee => {
    const item = document.createElement('div');
    item.className = 'committee-item';
    
    let committeeName;
    try {
      const parsed = JSON.parse(committee.name);
      committeeName = parsed[lang] || parsed['ar'] || committee.name;
    } catch {
      committeeName = committee.name;
    }

    const isSelected = selectedCommittees.has(committee.id.toString());
    console.log(`📋 Committee ${committee.id} (${committeeName}): ${isSelected ? 'SELECTED' : 'not selected'}`);

    item.innerHTML = `
      <input type="checkbox" id="committee-${committee.id}" value="${committee.id}" ${isSelected ? 'checked' : ''}>
      <label for="committee-${committee.id}">${committeeName}</label>
    `;

    if (isSelected) {
      item.classList.add('selected');
    }

    committeesList.appendChild(item);
  });
  setCommitteeSearchPlaceholder();
  console.log('✅ Committees list rendered successfully');
}

function updateDropdownButtonText() {
  console.log('🔄 Updating dropdown button text...');
  const dropdownBtn = document.querySelector('.dropdown-btn span');
  if (!dropdownBtn) {
    console.log('❌ Dropdown button span not found');
    return;
  }

  console.log('📝 Selected committees count:', selectedCommittees.size);

  if (selectedCommittees.size === 0) {
    dropdownBtn.textContent = getTranslation('select-committees');
    console.log('✅ Set button text to:', getTranslation('select-committees'));
  } else if (selectedCommittees.size === 1) {
    const committeeId = Array.from(selectedCommittees)[0];
    const committee = allCommittees.find(c => c.id.toString() === committeeId);
    if (committee) {
      const lang = localStorage.getItem('language') || 'ar';
      let committeeName;
      try {
        const parsed = JSON.parse(committee.name);
        committeeName = parsed[lang] || parsed['ar'] || committee.name;
      } catch {
        committeeName = committee.name;
      }
      dropdownBtn.textContent = committeeName;
      console.log('✅ Set button text to single committee:', committeeName);
    }
  } else {
    dropdownBtn.textContent = `${selectedCommittees.size} ${getTranslation('committee-selected')}`;
    console.log('✅ Set button text to multiple committees:', `${selectedCommittees.size} ${getTranslation('committee-selected')}`);
  }
}

// Update search placeholder translation in dropdown
function setCommitteeSearchPlaceholder() {
  const searchInput = document.querySelector('.committee-search');
  if (searchInput) {
    searchInput.placeholder = getTranslation('search-committee-placeholder');
  }
}

// Call setCommitteeSearchPlaceholder on language change and after rendering dropdown
window.addEventListener('languageChanged', setCommitteeSearchPlaceholder);
document.addEventListener('DOMContentLoaded', setCommitteeSearchPlaceholder);

// Show/hide dropdown based on permission checkbox
document.addEventListener('change', (e) => {
  console.log('🔍 Change event detected:', e.target);
  
  if (e.target.type === 'checkbox') {
    const label = e.target.closest('.switch');
    console.log('🔍 Label found:', label);
    console.log('🔍 Label data-key:', label?.dataset?.key);
    
    if (label && label.dataset.key === 'view_own_committees') {
      console.log('✅ Found view_own_committees checkbox, updating dropdown visibility');
      const dropdown = document.getElementById('committees-dropdown');
      console.log('🔍 Dropdown element:', dropdown);
      
      if (dropdown) {
        dropdown.style.display = e.target.checked ? 'block' : 'none';
        console.log('✅ Dropdown visibility changed to:', e.target.checked ? 'block' : 'none');
        if (e.target.checked && selectedUserId) {
          // تحميل لجان المستخدم مباشرة عند التفعيل
          loadUserCommittees(selectedUserId);
        }
      }
    }
  }
});

// إظهار الزر حسب الصلاحية عند اختيار المستخدم
async function showEditUserInfoButton(u) {
  const authToken = localStorage.getItem('token') || '';
  const payload = JSON.parse(atob(authToken.split('.')[1] || '{}'));
  const myRole = payload.role;
  const myId = payload.id;
  // إذا كان المستخدم المستهدف admin، فقط admin نفسه يمكنه التعديل
  if (u.role === 'admin') {
    if (myRole === 'admin' && Number(u.id) === Number(myId)) {
      btnEditUserInfo.style.display = '';
    } else {
      btnEditUserInfo.style.display = 'none';
    }
    return;
  }
  // غير admin: admin أو من لديه الصلاحية
  if (myRole === 'admin' || myPermsSet.has('change_user_info')) {
    btnEditUserInfo.style.display = '';
  } else {
    btnEditUserInfo.style.display = 'none';
  }
}

// عند الضغط على زر تعديل معلومات المستخدم
if (btnEditUserInfo) {
  btnEditUserInfo.addEventListener('click', async () => {
    if (!selectedUserId) return;
    // جلب بيانات المستخدم الحالي
    const u = await fetchJSON(`${apiBase}/users/${selectedUserId}`);
    const authToken = localStorage.getItem('token') || '';
    const payload = JSON.parse(atob(authToken.split('.')[1] || '{}'));
    // تحقق: إذا كان المستهدف admin، فقط admin نفسه يمكنه التعديل
    if (u.role === 'admin' && !(payload.role === 'admin' && Number(u.id) === Number(payload.id))) {
      return;
    }
    editUserName.value = u.name || '';
    editEmployeeNumber.value = u.employee_number || '';
    editEmail.value = u.email || '';
    editUserRole = u.role || null;
    // جلب الأقسام وتعبئة الدروب داون
    await fetchDepartmentsForEditModal(u.departmentId, u.departmentName);
    editUserModal.style.display = 'flex';
  });
}

// دالة لجلب الأقسام وتعبئة الدروب داون مع اختيار القسم الحالي
async function fetchDepartmentsForEditModal(selectedId, selectedName) {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${apiBase}/departments`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const result = await response.json();
    if (!Array.isArray(result)) throw new Error('الرد ليس مصفوفة أقسام');
    const lang = localStorage.getItem('language') || 'ar';
    const selectText = lang === 'ar' ? 'اختر القسم' : 'Select Department';
    editDepartment.innerHTML = `<option value="">${selectText}</option>`;
    result.forEach(dept => {
      const option = document.createElement('option');
      option.value = dept.id;
      let name = dept.name;
      try {
        if (typeof name === 'string' && name.trim().startsWith('{')) {
          name = JSON.parse(name);
        }
        option.textContent = typeof name === 'object'
          ? (name[lang] || name.ar || name.en || '')
          : name;
      } catch {
        option.textContent = '';
      }
      if (dept.id == selectedId) option.selected = true;
      editDepartment.appendChild(option);
    });
  } catch (error) {
    showToast('خطأ في جلب الأقسام.', 'error');
  }
}

// إغلاق المودال
if (btnCancelEditUser) {
  btnCancelEditUser.addEventListener('click', () => {
    editUserModal.style.display = 'none';
  });
}

// حفظ التعديلات
if (btnSaveEditUser) {
  btnSaveEditUser.addEventListener('click', async () => {
    if (!selectedUserId) return;
    // تحقق من الحقول المطلوبة
    if (!editUserName.value.trim() || !editEmployeeNumber.value.trim() || !editDepartment.value || !editEmail.value.trim()) {
      showToast('جميع الحقول مطلوبة.', 'warning');
      return;
    }
    const data = {
      name: editUserName.value,
      employee_number: editEmployeeNumber.value,
      departmentId: editDepartment.value,
      email: editEmail.value,
      role: editUserRole
    };
    try {
      await fetchJSON(`${apiBase}/users/${selectedUserId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      editUserModal.style.display = 'none';
      await selectUser(selectedUserId); // تحديث بيانات العرض
      showToast('تم تحديث معلومات المستخدم بنجاح', 'success');
    } catch (err) {
      showToast('فشل تحديث معلومات المستخدم: ' + err.message, 'error');
    }
  });
}

// دالة فتح popup إلغاء التفويضات
async function openRevokeDelegationsPopup() {
  if (!selectedUserId) return showToast(getTranslation('please-select-user'), 'warning');
  // جلب ملخص الأشخاص المفوض لهم (ملفات + لجان)
  let fileDelegates = [];
  let committeeDelegates = [];
  try {
    // جلب ملخص الملفات
    const res = await fetch(`${apiBase}/approvals/delegation-summary/${selectedUserId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const json = await res.json();
    if (json.status === 'success' && Array.isArray(json.data)) {
      fileDelegates = json.data;
    }
    // جلب ملخص اللجان
    const resComm = await fetch(`${apiBase}/committee-approvals/delegation-summary/${selectedUserId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const jsonComm = await resComm.json();
    if (jsonComm.status === 'success' && Array.isArray(jsonComm.data)) {
      committeeDelegates = jsonComm.data;
    }
  } catch (err) {
    showToast(getTranslation('error-occurred'), 'error');
    return;
  }
  // بناء popup
  const overlay = document.createElement('div');
  overlay.style = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.4);z-index:9999;display:flex;align-items:center;justify-content:center;';
  const box = document.createElement('div');
  box.style = 'background:#fff;padding:32px 24px;border-radius:12px;max-width:600px;min-width:340px;text-align:center;box-shadow:0 2px 16px #0002;max-height:80vh;overflow:auto;';
  box.innerHTML = `<div style='font-size:1.2rem;margin-bottom:18px;'>${getTranslation('revoke-delegations')} (${getTranslation('by-person')})</div>`;
  if (fileDelegates.length === 0 && committeeDelegates.length === 0) {
    box.innerHTML += `<div style='margin:24px 0;'>${getTranslation('no-active-delegations')}</div>`;
  } else {
    if (fileDelegates.length > 0) {
      box.innerHTML += `<div style='font-weight:bold;margin:12px 0 6px;'>${getTranslation('file-delegations')}:</div>`;
      fileDelegates.forEach(d => {
        box.innerHTML += `<div style='margin:8px 0;padding:8px 0;border-bottom:1px solid #eee;display:flex;align-items:center;justify-content:space-between;'>
          <span style='flex:1;text-align:right;'>${d.approver_name || d.email || getTranslation('user') + ' ' + d.approver_id} <span style='color:#888;font-size:0.95em;'>(${getTranslation('files-count')}: ${d.files_count})</span></span>
          <button style='background:#e53e3e;color:#fff;border:none;border-radius:6px;padding:4px 16px;cursor:pointer;margin-right:12px;' onclick='window.__revokeAllToUser(${selectedUserId},${d.approver_id},false,this)'>${getTranslation('revoke-delegations')}</button>
        </div>`;
      });
    }
    if (committeeDelegates.length > 0) {
      box.innerHTML += `<div style='font-weight:bold;margin:18px 0 6px;'>${getTranslation('committee-delegations')}:</div>`;
      committeeDelegates.forEach(d => {
        box.innerHTML += `<div style='margin:8px 0;padding:8px 0;border-bottom:1px solid #eee;display:flex;align-items:center;justify-content:space-between;'>
          <span style='flex:1;text-align:right;'>${d.approver_name || d.email || getTranslation('user') + ' ' + d.approver_id} <span style='color:#888;font-size:0.95em;'>(${getTranslation('files-count')}: ${d.files_count})</span></span>
          <button style='background:#e53e3e;color:#fff;border:none;border-radius:6px;padding:4px 16px;cursor:pointer;margin-right:12px;' onclick='window.__revokeAllToUser(${selectedUserId},${d.approver_id},true,this)'>${getTranslation('revoke-delegations')}</button>
        </div>`;
      });
    }
  }
  // زر إغلاق
  const btnClose = document.createElement('button');
  btnClose.textContent = getTranslation('cancel') || 'إغلاق';
  btnClose.style = 'margin-top:18px;background:#888;color:#fff;border:none;border-radius:6px;padding:8px 24px;font-size:1rem;cursor:pointer;';
  btnClose.onclick = () => document.body.removeChild(overlay);
  box.appendChild(btnClose);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  // دالة إلغاء التفويض بالكامل (تربط على window)
  window.__revokeAllToUser = async function(delegatorId, delegateeId, isCommittee, btn) {
    if (!confirm(getTranslation('confirm-revoke-all') || 'هل أنت متأكد من إلغاء جميع التفويضات لهذا الشخص؟')) return;
    btn.disabled = true;
    btn.textContent = '...';
    try {
      const url = isCommittee
        ? `${apiBase}/committee-approvals/delegations/by-user/${delegatorId}?to=${delegateeId}`
        : `${apiBase}/approvals/delegations/by-user/${delegatorId}?to=${delegateeId}`;
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const json = await res.json();
      if (json.status === 'success') {
        btn.parentNode.style.opacity = '0.5';
        btn.textContent = getTranslation('revoked') || 'تم الإلغاء';
        btn.disabled = true;
        setTimeout(() => {
          const stillActive = overlay.querySelectorAll('button:not([disabled])').length;
          if (!stillActive) {
            document.body.removeChild(overlay);
            loadUsers();
          }
        }, 700);
      } else {
        btn.disabled = false;
        btn.textContent = getTranslation('revoke-delegations');
        showToast(json.message || getTranslation('error-occurred'), 'error');
      }
    } catch (err) {
      btn.disabled = false;
      btn.textContent = getTranslation('revoke-delegations');
      showToast(getTranslation('error-occurred'), 'error');
    }
  };
}
