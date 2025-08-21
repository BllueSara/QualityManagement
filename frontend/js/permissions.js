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

const apiBase      = ' http://localhost:3006/api';
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
const profileJobTitle = document.getElementById('profile-job-title');
// const profileJobName = document.getElementById('profile-job-name');
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

// إضافة زر عرض اقرارات التفويض
const btnViewDelegationConfirmations = document.getElementById('btn-view-delegation-confirmations');
if (btnViewDelegationConfirmations) {
  btnViewDelegationConfirmations.onclick = openDelegationConfirmationsModal;
}

// زر مسح الكاش ميموري - للادمن فقط
if (btnClearCache) {
  btnClearCache.onclick = async () => {
    // تحقق من أن المستخدم admin أو لديه صلاحية clear_cache
    const authToken = localStorage.getItem('token') || '';
    const payload = await safeGetUserInfo(authToken);
    if (!payload) {
      showToast('خطأ في جلب معلومات المستخدم', 'error');
      return;
    }
    const myRole = payload.role;
    
    if (myRole !== 'super_admin' && !myPermsSet.has('clear_cache')) {
      showToast('هذا الزر متاح للسوبر ادمن أو من لديه صلاحية مسح الكاش فقط', 'warning');
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
            <td style="padding:10px 8px;max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${
              f.type === 'department' 
                ? (f.departmentName || '—') 
                : (f.type === 'committee' 
                    ? (f.committeeName || '—') 
                    : 'محضر')
            }</td>
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
            showToast('تم سحب الملفات المحددة وإعادة ترتيب التسلسل', 'success');
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
const editFirstName = document.getElementById('editFirstName');
const editSecondName = document.getElementById('editSecondName');
const editThirdName = document.getElementById('editThirdName');
const editLastName = document.getElementById('editLastName');
const editUsername = document.getElementById('editUsername');
const editEmployeeNumber = document.getElementById('editEmployeeNumber');
const editNationalId = document.getElementById('editNationalId');
const editJobTitle = document.getElementById('editJobTitle');
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
    const payload = await safeGetUserInfo(authToken);
    if (!payload) return;
    const myId = payload.id;
    const perms = await fetchJSON(`${apiBase}/users/${myId}/permissions`);
    myPermsSet = new Set(perms);
    
    // إظهار زر سحب الملفات إذا كان admin أو لديه صلاحية revoke_files
    const myRole = payload.role;
    if (btnRevokeFiles) {
      if (myRole === 'super_admin' || myPermsSet.has('revoke_files')) {
        // لا نعرض الزر هنا، سيتم عرضه عند اختيار مستخدم
        // btnRevokeFiles.style.display = '';
      } else {
        btnRevokeFiles.style.display = 'none';
      }
    }
    
    // إظهار زر مسح الكاش ميموري للسوبر ادمن فقط أو من لديه صلاحية
    if (btnClearCache) {
      btnClearCache.style.display = (myRole === 'super_admin' || myPermsSet.has('clear_cache')) ? '' : 'none';
    }
    
    // إظهار زر إلغاء التفويضات إذا كان super_admin أو لديه صلاحية revoke_delegations
    if (btnRevokeDelegations) {
      btnRevokeDelegations.style.display = (myRole === 'super_admin' || myPermsSet.has('revoke_delegations')) ? '' : 'none';
    }
    
    // إظهار زر عرض اقرارات التفويض إذا كان super_admin أو لديه صلاحية view_delegation_confirmations
    const btnViewDelegationConfirmations = document.getElementById('btn-view-delegation-confirmations');
    if (btnViewDelegationConfirmations) {
      btnViewDelegationConfirmations.style.display = (myRole === 'super_admin' || myPermsSet.has('view_delegation_confirmations')) ? '' : 'none';
    }

  } catch (e) {
    showToast('فشل جلب صلاحياتي.', 'error');
  }
}
async function fetchDepartments() {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('لا يوجد توكن مصادقة');
    }

    const response = await fetch(`${apiBase}/departments/all`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🚨 Department API error:', response.status, errorText);
      throw new Error(`فشل في جلب الأقسام (${response.status})`);
    }

    const result = await response.json();

    // Handle both array and object with data property
    const departments = Array.isArray(result) ? result : (result.data || []);

    if (!Array.isArray(departments)) {
      console.error('🚨 Invalid departments response format:', result);
      throw new Error('الرد ليس مصفوفة أقسام');
    }

    // تحديث القائمة المنسدلة
    const lang = localStorage.getItem('language') || 'ar';
    const selectText = lang === 'ar' ? 'اختر القسم' : 'Select Department';
    departmentSelect.innerHTML = `<option value="">${selectText}</option>`;

    departments.forEach(dept => {
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
    showToast('خطأ في جلب الأقسام: ' + error.message, 'error');
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
  const jwtPayload = await safeGetUserInfo(authToken);
  if (!jwtPayload) {
    showToast('خطأ في جلب معلومات المستخدم', 'error');
    return;
  }

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
  if (u.role === 'admin' || u.role === 'super_admin') {
    return;
  }
  // تحقق: فقط admin أو من لديه change_status يمكنه التغيير
  const payload = await safeGetUserInfo(authToken);
  if (!payload) return;
  const myRole = payload.role;
    if (!(myRole === 'admin' || myRole === 'super_admin' || myPermsSet.has('change_status'))) {
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
  profileJobTitle.textContent = u.job_title    || '—';
document.querySelector('.user-profile-header')?.classList.add('active');

  // دور المستخدم الحالي
  const payload = await safeGetUserInfo(authToken);
  if (!payload) return;
  const myRole = payload.role;
  const isAdmin = myRole === 'admin' || myRole === 'super_admin';

  // زر إضافة مستخدم
  btnAddUser.style.display = (isAdmin || myPermsSet.has('add_user')) ? '' : 'none';

  // إذا الهدف Admin: أخفِ القسم كامل وأزرار الإدارة
  if (u.role === 'admin' || u.role === 'super_admin') {
    permissionsSection.style.display = 'none';
    btnDeleteUser.style.display = 'none';
    btnResetPwd.style.display   = 'none';
    btnChangeRole.style.display = 'none';
    if (btnRevokeFiles) {
      btnRevokeFiles.style.display = 'none';
    }
    // لا نضع return هنا لنسمح بتنفيذ showEditUserInfoButton
  }

  // أظهر قسم الصلاحيات للمستخدمين غير Admin
  permissionsSection.style.display = '';

  // أزرار الحذف وإعادة التعيين وتغيير الدور
  btnDeleteUser.style.display = (isAdmin || myPermsSet.has('delete_user')) ? '' : 'none';
  btnResetPwd.style.display   = (isAdmin || myPermsSet.has('change_password')) ? '' : 'none';
  btnChangeRole.style.display = (isAdmin || myPermsSet.has('change_role')) ? '' : 'none';
  
  // إظهار زر سحب الملفات إذا كان super_admin أو لديه صلاحية revoke_files
  if (btnRevokeFiles) {
    if (myRole === 'super_admin' || myPermsSet.has('revoke_files')) {
      btnRevokeFiles.style.display = '';
    } else {
      btnRevokeFiles.style.display = 'none';
    }
  }

  // جلب الأدوار للمستخدمين غير Admin
  const roles = await fetchJSON(`${apiBase}/users/roles`);
  // إظهار manager_ovr فقط للادمن
  let filteredRoles = roles;
  
  if (!isAdmin) {
    filteredRoles = roles.filter(r => r !== 'manager_ovr');
  }
  
  // إخفاء super_admin من الجميع إلا إذا كان المستخدم الحالي super_admin
  const currentUserRole = (await safeGetUserInfo(authToken))?.role;
  if (currentUserRole !== 'super_admin') {
    filteredRoles = filteredRoles.filter(r => r !== 'super_admin');
  }
  
  roleSelect.innerHTML = filteredRoles.map(r => `
    <option value="${r}" ${u.role===r?'selected':''}>${r}</option>
  `).join('');
  btnChangeRole.onclick = () => rolePopup.classList.add('show');

  // صلاحيات المستخدم المستهدف
  const targetPerms = await fetchJSON(`${apiBase}/users/${id}/permissions`);
  const targetSet = new Set(targetPerms);
  const canGrant = isAdmin || myPermsSet.has('grant_permissions');
  const canGrantAll = isAdmin || myPermsSet.has('grant_all_permissions');

  document.querySelectorAll('.permission-item').forEach(item => {
    const label = item.querySelector('.switch');
    const input = label.querySelector('input[type="checkbox"]');
    const key   = label.dataset.key;

    // إظهار البنود: Admin يرى الكل، ومُخول grant يرى فقط ما يملكه، ومُخول grant_all_permissions يرى الكل
    if (!isAdmin && myRole !== 'admin' && myRole !== 'super_admin' && !myPermsSet.has(key) && key !== 'grant_permissions' && key !== 'grant_all_permissions' && !canGrantAll) {
      item.style.display = 'none';
    } else {
      item.style.display = '';
    }
    
    // إخفاء الصلاحيات الحساسة إذا لم يكن المستخدم يملكها (إلا إذا كان super_admin)
    const sensitivePermissions = ['clear_cache', 'view_delegation_confirmations', 'revoke_files', 'revoke_delegations'];
    if (sensitivePermissions.includes(key) && myRole !== 'super_admin' && !myPermsSet.has(key)) {
      item.style.display = 'none';
    }

    // تأشير الحالة
    input.checked = targetSet.has(key);
    
    // تمكين الصلاحيات: Admin يمكنه منح الكل، ومُخول grant يمكنه منح ما يملكه، ومُخول grant_all_permissions يمكنه منح الكل
    // للصلاحيات الحساسة: يجب أن يكون المستخدم super_admin أو لديه الصلاحية نفسها (لا يمكن منحها عبر grant_all_permissions)
    if (sensitivePermissions.includes(key)) {
      input.disabled = !(myRole === 'super_admin' || myPermsSet.has(key));
    } else {
    input.disabled = !(isAdmin || myPermsSet.has(key) || canGrantAll);
    }
    
    // معالجة خاصة لصلاحية "منح جميع الصلاحيات"
    if (key === 'grant_all_permissions') {
      input.onchange = async () => {
        const checked = input.checked;
        try {
          if (checked) {
            // إذا تم تفعيل "منح جميع الصلاحيات"، فعّل جميع الصلاحيات
            await fetchJSON(`${apiBase}/users/${id}/grant-all-permissions`, { 
              method: 'POST',
              body: JSON.stringify({ grantAll: true })
            });
            // تحديث جميع الصلاحيات لتظهر مفعلة (باستثناء الصلاحيات المستثناة)
            // ملاحظة: هذه الصلاحيات لا تُمنح تلقائياً ولكن يمكن منحها يدوياً
            const excludedPermissions = [
              'disable_tickets',           // اخفاء الاحداث العارضة
              'disable_departments',       // اخفاء الاقسام
              'disable_comittees',         // اخفاء اللجان
              'disable_approvals',         // اخفاء الاعتمادات
              'disable_notifications',     // إلغاء الإشعارات
              'disable_emails',            // إلغاء الإيميلات
              'disable_logs',              // إلغاء اللوقز
              'view_own_department',       // عرض القسم الموجود
              'view_own_committees',       // عرض اللجان الحالية
              'view_reports_by_person_tickets',    // عرض تقارير الاحداث العارضة للشخص
              'view_reports_by_person_approvals'   // عرض تقارير الاعتمادات للشخص
            ];
            
            document.querySelectorAll('.permission-item').forEach(otherItem => {
              const otherLabel = otherItem.querySelector('.switch');
              const otherInput = otherLabel.querySelector('input[type="checkbox"]');
              const otherKey = otherLabel.dataset.key;
              if (otherKey !== 'grant_all_permissions' && !excludedPermissions.includes(otherKey)) {
                otherInput.checked = true;
              }
            });
            showToast('تم منح جميع الصلاحيات بنجاح', 'success');
          } else {
            // إذا تم إلغاء "منح جميع الصلاحيات"، ألغِ جميع الصلاحيات
            await fetchJSON(`${apiBase}/users/${id}/grant-all-permissions`, { 
              method: 'POST',
              body: JSON.stringify({ grantAll: false })
            });
            // تحديث جميع الصلاحيات لتظهر ملغية
            document.querySelectorAll('.permission-item').forEach(otherItem => {
              const otherLabel = otherItem.querySelector('.switch');
              const otherInput = otherLabel.querySelector('input[type="checkbox"]');
              const otherKey = otherLabel.dataset.key;
              if (otherKey !== 'grant_all_permissions') {
                otherInput.checked = false;
              }
            });
            showToast('تم إلغاء جميع الصلاحيات بنجاح', 'success');
          }
        } catch (error) {
          input.checked = !checked;
          showToast('فشل تحديث الصلاحيات: ' + error.message, 'error');
        }
      };
    } else {
      // معالجة عادية للصلاحيات الأخرى
      input.onchange = async () => {
        const checked = input.checked;
        try {
          const method = checked ? 'POST' : 'DELETE';
          await fetchJSON(`${apiBase}/users/${id}/permissions/${encodeURIComponent(key)}`, { method });
          
          // إذا تم إلغاء أي صلاحية، ألغِ "منح جميع الصلاحيات" تلقائياً
          if (!checked && targetSet.has('grant_all_permissions')) {
            const grantAllInput = document.querySelector('label.switch[data-key="grant_all_permissions"] input[type="checkbox"]');
            if (grantAllInput) {
              grantAllInput.checked = false;
              await fetchJSON(`${apiBase}/users/${id}/permissions/grant_all_permissions`, { method: 'DELETE' });
            }
          }
        } catch {
          input.checked = !checked;
          showToast('فشل تحديث الصلاحية', 'error');
        }
      };
    }
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

  // إظهار زر إلغاء التفويضات فقط إذا كان super_admin أو لديه صلاحية revoke_delegations
  btnRevokeDelegations.style.display = (myRole === 'super_admin' || myPermsSet.has('revoke_delegations')) ? '' : 'none';
  
  // إظهار زر سحب الملفات إذا كان super_admin أو لديه صلاحية revoke_files
  if (btnRevokeFiles) {
    if (myRole === 'super_admin' || myPermsSet.has('revoke_files')) {
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
    ['userName','userSecondName','userThirdName','userLastName','email','password'].forEach(id => {
      document.getElementById(id).value = '';
    });
    fetchDepartments(); // ✅ هنا تستدعي الأقسام وتعبئها
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
    // جمع الأسماء
    const firstName = document.getElementById('userName').value.trim();
    const secondName = document.getElementById('userSecondName').value.trim();
    const thirdName = document.getElementById('userThirdName').value.trim();
    const lastName = document.getElementById('userLastName').value.trim();
    const username = document.getElementById('userName').value.trim();
    
    // تحقق من الحقول المطلوبة
    if (!firstName || !lastName || !username) {
      showToast('الاسم الأول واسم العائلة واسم المستخدم مطلوبان.', 'warning');
      return;
    }
    
    // تحقق من المسمى الوظيفي إذا كان موجوداً
    const jobName = document.getElementById('jobName');
    if (jobName && !jobName.value.trim()) {
      showToast('يرجى اختيار المسمى الوظيفي.', 'warning');
      return;
    }
    
    // بناء الاسم الكامل
    const names = [firstName, secondName, thirdName, lastName].filter(name => name);
    const fullName = names.join(' ');

    const data = {
      name: username,
      first_name: firstName,
      second_name: secondName,
      third_name: thirdName,
      last_name: lastName,
      departmentId: document.getElementById('department').value,
      email: document.getElementById('email').value,
      password: document.getElementById('password').value,
      role: document.getElementById('role')?.value || 'user',
      employeeNumber: document.getElementById('employeeNumber').value,
      job_title_id: document.getElementById('jobTitle').value,
      job_name_id: document.getElementById('jobName') ? document.getElementById('jobName').value : ''
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
        if (!authToken) return;
  await loadMyPermissions();

  loadUsers();
  initializeCommitteesDropdown();
  initializeSectionButtons();
  
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
  
  const dropdown = document.getElementById('committees-dropdown');
  const dropdownBtn = dropdown?.querySelector('.dropdown-btn');
  const dropdownContent = dropdown?.querySelector('.dropdown-content');
  const searchInput = dropdown?.querySelector('.committee-search');
  const committeesList = dropdown?.querySelector('.committees-list');



  if (!dropdown || !dropdownBtn || !dropdownContent || !searchInput || !committeesList) {

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

  try {
    const response = await fetch(`${apiBase}/committees`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (!response.ok) throw new Error('Failed to fetch committees');
    
    allCommittees = await response.json();

    renderCommitteesList();
  } catch (error) {
    console.error('❌ Error loading committees:', error);
  }
}

async function loadUserCommittees(userId) {

  try {
    const response = await fetch(`${apiBase}/users/${userId}/committees`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    

    
    if (response.ok) {
      const userCommittees = await response.json();
      selectedCommittees = new Set(userCommittees.map(c => c.id.toString()));
      renderCommitteesList();
      updateDropdownButtonText();
    } else {
      const errorText = await response.text();
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
  const committeesList = document.querySelector('.committees-list');
  if (!committeesList) {
    return;
  }

  committeesList.innerHTML = '';
  const lang = localStorage.getItem('language') || 'ar';

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
}

function updateDropdownButtonText() {
  const dropdownBtn = document.querySelector('.dropdown-btn span');
  if (!dropdownBtn) {
    return;
  }

  if (selectedCommittees.size === 0) {
    dropdownBtn.textContent = getTranslation('select-committees');
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
    }
  } else {
    dropdownBtn.textContent = `${selectedCommittees.size} ${getTranslation('committee-selected')}`;
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
  if (e.target.type === 'checkbox') {
    const label = e.target.closest('.switch');
    
    if (label && label.dataset.key === 'view_own_committees') {
      const dropdown = document.getElementById('committees-dropdown');
      
      if (dropdown) {
        dropdown.style.display = e.target.checked ? 'block' : 'none';
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
  const payload = await safeGetUserInfo(authToken);
  if (!payload) return;
  const myRole = payload.role;
  const myId = payload.id;
  
  // إذا كان المستخدم المستهدف admin
  if (u.role === 'admin' || u.role === 'super_admin') {
    // فقط admin نفسه يمكنه تعديل معلوماته
    if ((myRole === 'admin' || myRole === 'super_admin') && Number(u.id) === Number(myId)) {
      btnEditUserInfo.style.display = '';
    } else {
      btnEditUserInfo.style.display = 'none';
    }
    return;
  }
  
  // للمستخدمين غير admin: admin أو من لديه الصلاحية يمكنه التعديل
  if (myRole === 'admin' || myRole === 'super_admin' || myPermsSet.has('change_user_info')) {
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
    const payload = await safeGetUserInfo(authToken);
    if (!payload) return;
    
    // تحقق: إذا كان المستهدف admin، فقط admin نفسه يمكنه التعديل
    if (u.role === 'admin' && !((payload.role === 'admin' || payload.role === 'super_admin') && Number(u.id) === Number(payload.id))) {
      showToast('لا يمكن تعديل معلومات admin آخر', 'warning');
      return;
    }
    
    // تعبئة الأسماء المنفصلة مباشرة من البيانات
    editFirstName.value = u.first_name || '';
    editSecondName.value = u.second_name || '';
    editThirdName.value = u.third_name || '';
    editLastName.value = u.last_name || '';
    editUsername.value = u.username || '';
    
    editEmployeeNumber.value = u.employee_number || '';
    editNationalId.value = u.national_id || '';
    // جلب المسميات الوظيفية وتعبئة الدروب داون
    await fetchJobTitlesForEditModal(u.job_title_id, u.job_title);
    editEmail.value = u.email || '';
    editUserRole = u.role || null;
    
    // جلب المسميات الوظيفية وتعبئة الدروب داون
    await fetchJobNamesForEditModal(u.job_name_id, u.job_name);
    
    // جلب الأقسام وتعبئة الدروب داون
    await fetchDepartmentsForEditModal(u.departmentId, u.departmentName);
    
    // Handle "Add New Job Title" selection in edit modal
    editJobTitle.addEventListener('change', function() {
      if (this.value === '__ADD_NEW_JOB_TITLE__') {
        this.value = '';
        document.getElementById('addJobTitleModal').style.display = 'flex';
      }
    });
    
    // Handle "Add New Job Name" selection in edit modal
    if (editJobName) {
      editJobName.addEventListener('change', function() {
        if (this.value === '__ADD_NEW_JOB_NAME__') {
          this.value = '';
          document.getElementById('addJobNameModal').style.display = 'flex';
        }
      });
    }
    
    // إضافة التحقق من صحة رقم الهوية أثناء الكتابة
    editNationalId.addEventListener('input', function() {
      const value = this.value;
      // السماح فقط بالأرقام
      this.value = value.replace(/[^0-9]/g, '');
      
      // التحقق من الطول
      if (value.length > 10) {
        this.value = value.slice(0, 10);
      }
    });

    editNationalId.addEventListener('blur', function() {
      const value = this.value.trim();
      if (value && !/^[1-9]\d{9}$/.test(value)) {
        showToast('رقم الهوية الوطنية أو الإقامة غير صحيح. يجب أن يكون 10 أرقام ولا يبدأ بصفر.', 'warning');
      }
    });

    editUserModal.style.display = 'flex';
  });
}

// دالة لجلب المسميات الوظيفية وتعبئة الدروب داون مع اختيار المسمى الحالي
async function fetchJobTitlesForEditModal(selectedId, selectedTitle) {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('لا يوجد توكن مصادقة');
    }

    const response = await fetch(`${apiBase}/job-titles`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🚨 Job Titles API error (edit modal):', response.status, errorText);
      throw new Error(`فشل في جلب المسميات الوظيفية (${response.status})`);
    }

    const result = await response.json();
    
    // Handle both array and object with data property
    const jobTitles = Array.isArray(result) ? result : (result.data || []);
    
    if (!Array.isArray(jobTitles)) {
      console.error('🚨 Invalid job titles response format (edit modal):', result);
      throw new Error('الرد ليس مصفوفة مسميات وظيفية');
    }
    
    const lang = localStorage.getItem('language') || 'ar';
            const selectText = lang === 'ar' ? 'اختر المنصب الإداري' : 'Select Administrative Position';
    editJobTitle.innerHTML = `<option value="">${selectText}</option>`;
    
    jobTitles.forEach(jobTitle => {
      const option = document.createElement('option');
      option.value = jobTitle.id;
      option.textContent = jobTitle.title;
      if (selectedId && Number(jobTitle.id) === Number(selectedId)) {
        option.selected = true;
      }
      editJobTitle.appendChild(option);
    });
    
    // Add "Add New Job Title" option
    const addNewOption = document.createElement('option');
    addNewOption.value = '__ADD_NEW_JOB_TITLE__';
    addNewOption.textContent = getTranslation('add-new-job-title');
    editJobTitle.appendChild(addNewOption);
  } catch (error) {
    console.error('❌ Error fetching job titles for edit modal:', error);
    showToast('فشل في جلب المسميات الوظيفية: ' + error.message, 'error');
  }
}

// دالة لجلب الأقسام وتعبئة الدروب داون مع اختيار القسم الحالي
async function fetchDepartmentsForEditModal(selectedId, selectedName) {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('لا يوجد توكن مصادقة');
    }

    const response = await fetch(`${apiBase}/departments/all`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🚨 Department API error (edit modal):', response.status, errorText);
      throw new Error(`فشل في جلب الأقسام (${response.status})`);
    }

    const result = await response.json();
    
    // Handle both array and object with data property
    const departments = Array.isArray(result) ? result : (result.data || []);
    
    if (!Array.isArray(departments)) {
      console.error('🚨 Invalid departments response format (edit modal):', result);
      throw new Error('الرد ليس مصفوفة أقسام');
    }
    
    const lang = localStorage.getItem('language') || 'ar';
    const selectText = lang === 'ar' ? 'اختر القسم' : 'Select Department';
    editDepartment.innerHTML = `<option value="">${selectText}</option>`;
    
    departments.forEach(dept => {
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

    console.log('✅ Successfully loaded', departments.length, 'departments for edit modal');
  } catch (error) {
    console.error('🚨 fetchDepartmentsForEditModal error:', error);
    showToast('خطأ في جلب الأقسام: ' + error.message, 'error');
  }
}

// دالة لجلب المسميات الوظيفية وتعبئة الدروب داون مع اختيار المسمى الحالي
async function fetchJobNamesForEditModal(selectedId, selectedName) {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('لا يوجد توكن مصادقة');
    }

    const response = await fetch(`${apiBase}/job-names`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🚨 Job Names API error (edit modal):', response.status, errorText);
      throw new Error(`فشل في جلب المسميات (${response.status})`);
    }

    const result = await response.json();
    
    // Handle both array and object with data property
    const jobNames = Array.isArray(result) ? result : (result.data || []);
    
    if (!Array.isArray(jobNames)) {
      console.error('🚨 Invalid job names response format (edit modal):', result);
      throw new Error('الرد ليس مصفوفة مسميات');
    }
    
    const editJobName = document.getElementById('editJobName');
    if (editJobName) {
      const lang = localStorage.getItem('language') || 'ar';
      const selectText = lang === 'ar' ? 'اختر المسمى الوظيفي' : 'Select Job Name';
      editJobName.innerHTML = `<option value="">${selectText}</option>`;
      
      jobNames.forEach(jobName => {
        const option = document.createElement('option');
        option.value = jobName.id;
        option.textContent = jobName.name;
        if (selectedId && Number(jobName.id) === Number(selectedId)) {
          option.selected = true;
        }
        editJobName.appendChild(option);
      });
      
      // Add "Add New Job Name" option
      const addNewOption = document.createElement('option');
      addNewOption.value = '__ADD_NEW_JOB_NAME__';
      addNewOption.textContent = getTranslation('add-new-job-name') || 'إضافة مسمى جديد';
      editJobName.appendChild(addNewOption);
    }

    console.log('✅ Successfully loaded', jobNames.length, 'job names for edit modal');
  } catch (error) {
    console.error('🚨 fetchJobNamesForEditModal error:', error);
    showToast('خطأ في جلب المسميات: ' + error.message, 'error');
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
    
    // جمع الأسماء
    const firstName = editFirstName.value.trim();
    const secondName = editSecondName.value.trim();
    const thirdName = editThirdName.value.trim();
    const lastName = editLastName.value.trim();
    const username = editUsername.value.trim();
    
    // تحقق من الحقول المطلوبة
    // للادمن: فقط الاسم الأول واسم العائلة واسم المستخدم مطلوبة
    // للمستخدمين الآخرين: جميع الحقول مطلوبة
    const isAdmin = editUserRole === 'admin' || editUserRole === 'super_admin';
    
    if (isAdmin) {
      // للادمن: فقط الحقول الأساسية مطلوبة
      if (!firstName || !lastName || !username) {
        showToast('الاسم الأول واسم العائلة واسم المستخدم مطلوبة للادمن.', 'warning');
        return;
      }
    } else {
          // للمستخدمين الآخرين: جميع الحقول مطلوبة
    if (!firstName || !lastName || !username || !editEmployeeNumber.value.trim() || !editJobTitle.value.trim() || !editJobName.value.trim() || !editDepartment.value || !editEmail.value.trim()) {
      showToast('الاسم الأول واسم العائلة واسم المستخدم وجميع الحقول الأخرى مطلوبة.', 'warning');
      return;
    }
    }
    
    // التحقق من صحة رقم الهوية إذا تم إدخاله
    const nationalId = editNationalId.value.trim();
    if (nationalId && !/^[1-9]\d{9}$/.test(nationalId)) {
      showToast('رقم الهوية الوطنية أو الإقامة غير صحيح. يجب أن يكون 10 أرقام ولا يبدأ بصفر.', 'warning');
      return;
    }

    // بناء الاسم الكامل
    const names = [firstName, secondName, thirdName, lastName].filter(name => name);
    const fullName = names.join(' ');
    
    const data = {
      name: username,
      first_name: firstName,
      second_name: secondName,
      third_name: thirdName,
      last_name: lastName,
      employee_number: editEmployeeNumber.value,
      national_id: editNationalId.value,
      job_title_id: editJobTitle.value,
      job_name_id: editJobName ? editJobName.value : '',
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

// دالة إلغاء التفويض بالكامل (تربط على window)
// المعاملات:
// - delegatorId: معرف المستخدم المفوض (صاحب الصلاحيات)
// - delegateeId: معرف المستخدم المفوض إليه (الذي تم تفويضه)
// - isCommittee: نوع التفويض (0=ملفات، 1=لجان، 2=محاضر)
// - btn: عنصر الزر المضغوط عليه
window.__revokeAllToUser = async function(delegatorId, delegateeId, isCommittee, btn) {
  if (!confirm(getTranslation('confirm-revoke-all') || 'هل أنت متأكد من إلغاء جميع التفويضات لهذا الشخص؟')) return;
  btn.disabled = true;
  btn.textContent = '...';
  try {
    let url;
    if (isCommittee === 2) {
      // محاضر
      url = `${apiBase}/protocols/delegations/by-user/${delegatorId}?to=${delegateeId}`;
    } else if (isCommittee === 1) {
      // لجان
      url = `${apiBase}/committee-approvals/delegations/by-user/${delegatorId}?to=${delegateeId}`;
    } else {
      // ملفات
      url = `${apiBase}/approvals/delegations/by-user/${delegatorId}?to=${delegateeId}`;
    }
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
        // البحث عن overlay الأب للزر
        const overlay = btn.closest('div[style*="position:fixed"]');
        if (overlay) {
          const stillActive = overlay.querySelectorAll('button:not([disabled])').length;
          if (!stillActive) {
            document.body.removeChild(overlay);
            loadUsers();
          }
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

// Manage Users Functions
function initializeManageUsers() {
  const btnManageUsers = document.getElementById('btn-manage-users');
  if (btnManageUsers) {
    btnManageUsers.addEventListener('click', () => {
      window.location.href = 'manage-users.html';
    });
  }
}

// Job Titles Management Functions
let currentEditingJobTitleId = null;

// Initialize job titles management
function initializeJobTitlesManagement() {
  const btnManageJobTitles = document.getElementById('btn-manage-job-titles');
  const btnAddJobTitle = document.getElementById('btn-add-job-title');
  const cancelJobTitles = document.getElementById('cancelJobTitles');
  const saveJobTitle = document.getElementById('saveJobTitle');
  const cancelAddEditJobTitle = document.getElementById('cancelAddEditJobTitle');
  const jobTitleName = document.getElementById('jobTitleName');
  const addEditJobTitleTitle = document.getElementById('addEditJobTitleTitle');

  // Open job titles management modal
  btnManageJobTitles.addEventListener('click', openJobTitlesModal);

  // Close job titles management modal
  cancelJobTitles.addEventListener('click', () => {
    document.getElementById('jobTitlesModal').style.display = 'none';
  });

  // Add new job title button
  btnAddJobTitle.addEventListener('click', () => {
    currentEditingJobTitleId = null;
    jobTitleName.value = '';
    addEditJobTitleTitle.textContent = getTranslation('add-job-title');
    document.getElementById('addEditJobTitleModal').style.display = 'flex';
  });

  // Save job title
  saveJobTitle.addEventListener('click', saveJobTitleHandler);

  // Cancel add/edit job title
  cancelAddEditJobTitle.addEventListener('click', () => {
    document.getElementById('addEditJobTitleModal').style.display = 'none';
  });

  // Close modal when clicking outside
  window.addEventListener('click', (event) => {
    const jobTitlesModal = document.getElementById('jobTitlesModal');
    const addEditJobTitleModal = document.getElementById('addEditJobTitleModal');
    if (event.target === jobTitlesModal) {
      jobTitlesModal.style.display = 'none';
    }
    if (event.target === addEditJobTitleModal) {
      addEditJobTitleModal.style.display = 'none';
    }
  });
}

// Job Names Management Functions
let currentEditingJobNameId = null;

// Initialize job names management
function initializeJobNamesManagement() {
  const btnManageJobNames = document.getElementById('btn-manage-job-names');
  const btnAddJobName = document.getElementById('btn-add-job-name');
  const cancelJobNames = document.getElementById('cancelJobNames');
  const saveJobName = document.getElementById('saveJobName');
  const cancelAddEditJobName = document.getElementById('cancelAddEditJobName');
  const jobNameName = document.getElementById('jobNameName');
  const addEditJobNameTitle = document.getElementById('addEditJobNameTitle');

  // Open job names management modal
  if (btnManageJobNames) {
    btnManageJobNames.addEventListener('click', openJobNamesModal);
  }

  // Close job names management modal
  if (cancelJobNames) {
    cancelJobNames.addEventListener('click', () => {
      document.getElementById('jobNamesModal').style.display = 'none';
    });
  }

  // Add new job name button
  if (btnAddJobName) {
    btnAddJobName.addEventListener('click', () => {
      currentEditingJobNameId = null;
      jobNameName.value = '';
      addEditJobNameTitle.textContent = getTranslation('add-job-name');
      document.getElementById('addEditJobNameModal').style.display = 'flex';
    });
  }

  // Save job name
  if (saveJobName) {
    saveJobName.addEventListener('click', saveJobNameHandler);
  }

  // Cancel add/edit job name
  if (cancelAddEditJobName) {
    cancelAddEditJobName.addEventListener('click', () => {
      document.getElementById('addEditJobNameModal').style.display = 'none';
    });
  }

  // Close modal when clicking outside
  window.addEventListener('click', (event) => {
    const jobNamesModal = document.getElementById('jobNamesModal');
    const addEditJobNameModal = document.getElementById('addEditJobNameModal');
    if (event.target === jobNamesModal) {
      jobNamesModal.style.display = 'none';
    }
    if (event.target === addEditJobNameModal) {
      addEditJobNameModal.style.display = 'none';
    }
  });
}

// Open job titles management modal
async function openJobTitlesModal() {
  document.getElementById('jobTitlesModal').style.display = 'flex';
  await loadJobTitles();
}

// Open job names management modal
async function openJobNamesModal() {
  document.getElementById('jobNamesModal').style.display = 'flex';
  await loadJobNames();
}

// Load job titles
async function loadJobTitles() {
  try {
    const response = await fetch(`${apiBase}/job-titles`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await response.json();
    
    if (data.success) {
      renderJobTitlesList(data.data);
    } else {
      showToast(data.message || getTranslation('error-occurred'), 'error');
    }
  } catch (error) {
    console.error('Error loading job titles:', error);
    showToast(getTranslation('error-occurred'), 'error');
  }
}

// Load job names
async function loadJobNames() {
  try {
    const response = await fetch(`${apiBase}/job-names`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await response.json();
    
    if (data.success) {
      renderJobNamesList(data.data);
    } else {
      showToast(data.message || getTranslation('error-occurred'), 'error');
    }
  } catch (error) {
    console.error('Error loading job names:', error);
    showToast(getTranslation('error-occurred'), 'error');
  }
}

// Render job titles list
function renderJobTitlesList(jobTitles) {
  const jobTitlesList = document.getElementById('jobTitlesList');
  
  if (jobTitles.length === 0) {
    jobTitlesList.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">لا توجد مسميات وظيفية</div>';
    return;
  }

  jobTitlesList.innerHTML = jobTitles.map(jobTitle => `
    <div class="job-title-item">
      <div class="job-title-name">${jobTitle.title}</div>
      <div class="job-title-actions">
        <button class="btn-edit" onclick="editJobTitleHandler(${jobTitle.id}, '${jobTitle.title}')">
          <i class="fas fa-edit"></i> ${getTranslation('edit') || 'تعديل'}
        </button>
        <button class="btn-delete" onclick="deleteJobTitle(${jobTitle.id})">
          <i class="fas fa-trash"></i> ${getTranslation('delete') || 'حذف'}
        </button>
      </div>
    </div>
  `).join('');
}

// Render job names list
function renderJobNamesList(jobNames) {
  const jobNamesList = document.getElementById('jobNamesList');
  
  if (jobNames.length === 0) {
    jobNamesList.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">لا توجد مسميات</div>';
    return;
  }

  jobNamesList.innerHTML = jobNames.map(jobName => `
    <div class="job-name-item">
      <div class="job-name-name">${jobName.name}</div>
      <div class="job-name-actions">
        <button class="btn-edit" onclick="editJobNameHandler(${jobName.id}, '${jobName.name}')">
          <i class="fas fa-edit"></i> ${getTranslation('edit') || 'تعديل'}
        </button>
        <button class="btn-delete" onclick="deleteJobName(${jobName.id})">
          <i class="fas fa-trash"></i> ${getTranslation('delete') || 'حذف'}
        </button>
      </div>
    </div>
  `).join('');
}

// Edit job title
function editJobTitleHandler(id, title) {
  currentEditingJobTitleId = id;
  document.getElementById('jobTitleName').value = title;
  document.getElementById('addEditJobTitleTitle').textContent = getTranslation('edit-job-title');
  document.getElementById('addEditJobTitleModal').style.display = 'flex';
}

// Edit job name
function editJobNameHandler(id, name) {
  currentEditingJobNameId = id;
  document.getElementById('jobNameName').value = name;
  document.getElementById('addEditJobNameTitle').textContent = getTranslation('edit-job-name') || 'تعديل المسمى الوظيفي';
  document.getElementById('addEditJobNameModal').style.display = 'flex';
}

// Delete job title
async function deleteJobTitle(id) {
  if (!confirm(getTranslation('confirm-delete-job-title'))) {
    return;
  }

  try {
    const response = await fetch(`${apiBase}/job-titles/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await response.json();
    
    if (data.success) {
      showToast(getTranslation('job-title-deleted'), 'success');
      await loadJobTitles();
    } else {
      showToast(data.message || getTranslation('cannot-delete-job-title'), 'error');
    }
  } catch (error) {
    console.error('Error deleting job title:', error);
    showToast(getTranslation('error-occurred'), 'error');
  }
}

// Delete job name
async function deleteJobName(id) {
  if (!confirm(getTranslation('confirm-delete-job-name') || 'هل تريد حذف هذا المسمى؟')) {
    return;
  }

  try {
    const response = await fetch(`${apiBase}/job-names/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await response.json();
    
    if (data.success) {
      showToast(getTranslation('job-name-deleted') || 'تم حذف المسمى بنجاح', 'success');
      await loadJobNames();
    } else {
      showToast(data.message || getTranslation('cannot-delete-job-name') || 'لا يمكن حذف المسمى', 'error');
    }
  } catch (error) {
    console.error('Error deleting job name:', error);
    showToast(getTranslation('error-occurred'), 'error');
  }
}

// Save job title handler
async function saveJobTitleHandler() {
  const jobTitleName = document.getElementById('jobTitleName').value.trim();
  
  if (!jobTitleName) {
    showToast(getTranslation('enter-job-title'), 'warning');
    return;
  }

  try {
    const url = currentEditingJobTitleId 
      ? `${apiBase}/job-titles/${currentEditingJobTitleId}`
      : `${apiBase}/job-titles`;
    
    const method = currentEditingJobTitleId ? 'PUT' : 'POST';
    
    const response = await fetch(url, {
      method: method,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title: jobTitleName })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast(
        currentEditingJobTitleId 
          ? getTranslation('job-title-updated')
          : getTranslation('job-title-added'), 
        'success'
      );
      document.getElementById('addEditJobTitleModal').style.display = 'none';
      await loadJobTitles();
    } else {
      showToast(data.message || getTranslation('error-occurred'), 'error');
    }
  } catch (error) {
    console.error('Error saving job title:', error);
    showToast(getTranslation('error-occurred'), 'error');
  }
}

// Save job name handler
async function saveJobNameHandler() {
  const jobNameName = document.getElementById('jobNameName').value.trim();
  
  if (!jobNameName) {
    showToast(getTranslation('enter-job-name') || 'الرجاء إدخال المسمى', 'warning');
    return;
  }

  try {
    const url = currentEditingJobNameId 
      ? `${apiBase}/job-names/${currentEditingJobNameId}`
      : `${apiBase}/job-names`;
    
    const method = currentEditingJobNameId ? 'PUT' : 'POST';
    
    const response = await fetch(url, {
      method: method,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: jobNameName })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast(
        currentEditingJobNameId 
          ? getTranslation('job-name-updated') || 'تم تحديث المسمى بنجاح'
          : getTranslation('job-name-added') || 'تم إضافة المسمى بنجاح', 
        'success'
      );
      document.getElementById('addEditJobNameModal').style.display = 'none';
      await loadJobNames();
    } else {
      showToast(data.message || getTranslation('error-occurred'), 'error');
    }
  } catch (error) {
    console.error('Error saving job name:', error);
    showToast(getTranslation('error-occurred'), 'error');
  }
}

// Load job titles for dropdown
async function loadJobTitlesForDropdown(selectElement, selectedValue = '') {
  try {
    const response = await fetch(`${apiBase}/job-titles`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await response.json();
    
    if (data.success) {
      // Clear existing options except the first one
              selectElement.innerHTML = '<option value="" data-translate="select-job-title">اختر المنصب الإداري</option>';
      
      // Add job titles
      data.data.forEach(jobTitle => {
        const option = document.createElement('option');
        option.value = jobTitle.id;
        option.textContent = jobTitle.title;
        if (jobTitle.id.toString() === selectedValue.toString()) {
          option.selected = true;
        }
        selectElement.appendChild(option);
      });
      
      // Add "Add New Job Title" option
      const addNewOption = document.createElement('option');
      addNewOption.value = '__ADD_NEW_JOB_TITLE__';
      addNewOption.textContent = getTranslation('add-new-job-title');
      selectElement.appendChild(addNewOption);
    }
  } catch (error) {
    console.error('Error loading job titles for dropdown:', error);
  }
}

// Load job names for dropdown
async function loadJobNamesForDropdown(selectElement, selectedValue = '') {
  try {
    const response = await fetch(`${apiBase}/job-names`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await response.json();
    
    if (data.success) {
      // Clear existing options except the first one
      selectElement.innerHTML = '<option value="" data-translate="select-job-name">اختر المسمى الوظيفي</option>';
      
      // Add job names
      data.data.forEach(jobName => {
        const option = document.createElement('option');
        option.value = jobName.id;
        option.textContent = jobName.name;
        if (jobName.id.toString() === selectedValue.toString()) {
          option.selected = true;
        }
        selectElement.appendChild(option);
      });
      
      // Add "Add new" option
      const addNewOption = document.createElement('option');
      addNewOption.value = '__ADD_NEW_JOB_NAME__';
      addNewOption.textContent = getTranslation('add-new-job-name') || 'إضافة مسمى جديد';
      selectElement.appendChild(addNewOption);
    }
  } catch (error) {
    console.error('Error loading job names for dropdown:', error);
  }
}

// Initialize job titles for add user modal
function initializeJobTitlesForAddUser() {
  const jobTitleSelect = document.getElementById('jobTitle');
  
  // Load job titles when modal opens
  btnAddUser.addEventListener('click', async () => {
    await loadJobTitlesForDropdown(jobTitleSelect);
  });
  
  // Handle "Add New Job Title" selection
  jobTitleSelect.addEventListener('change', function() {
    if (this.value === '__ADD_NEW_JOB_TITLE__') {
      this.value = '';
      document.getElementById('addJobTitleModal').style.display = 'flex';
    }
  });
}

// Initialize job names for add user modal
function initializeJobNamesForAddUser() {
  const jobNameSelect = document.getElementById('jobName');
  
  // Load job names when modal opens
  btnAddUser.addEventListener('click', async () => {
    await loadJobNamesForDropdown(jobNameSelect);
  });
  
  // Handle "Add New Job Name" selection
  jobNameSelect.addEventListener('change', function() {
    if (this.value === '__ADD_NEW_JOB_NAME__') {
      this.value = '';
      document.getElementById('addJobNameModal').style.display = 'flex';
    }
  });
}

// Handle add new job title from add user modal
function initializeAddJobTitleFromUserModal() {
  const saveAddJobTitle = document.getElementById('saveAddJobTitle');
  const cancelAddJobTitle = document.getElementById('cancelAddJobTitle');
  const jobTitleNameForUser = document.getElementById('jobTitleNameForUser');
  
  saveAddJobTitle.addEventListener('click', async () => {
    const title = jobTitleNameForUser.value.trim();
    
    if (!title) {
      showToast(getTranslation('enter-job-title'), 'warning');
      return;
    }
    
    try {
      const response = await fetch(`${apiBase}/job-titles`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title })
      });
      
      const data = await response.json();
      
      if (data.success) {
        showToast(getTranslation('job-title-added'), 'success');
        document.getElementById('addJobTitleModal').style.display = 'none';
        jobTitleNameForUser.value = '';
        
        // Refresh job titles dropdowns
        await loadJobTitlesForDropdown(document.getElementById('jobTitle'));
        await fetchJobTitlesForEditModal('', ''); // Refresh edit modal dropdown
        
        // Select the newly added job title in the active modal
        const activeModal = document.getElementById('addUserModal').style.display === 'flex' ? 'addUserModal' : 'editUserModal';
        if (activeModal === 'addUserModal') {
          document.getElementById('jobTitle').value = data.data.id;
        } else {
          document.getElementById('editJobTitle').value = data.data.id;
        }
      } else {
        showToast(data.message || getTranslation('error-occurred'), 'error');
      }
    } catch (error) {
      console.error('Error adding job title:', error);
      showToast(getTranslation('error-occurred'), 'error');
    }
  });
  
  cancelAddJobTitle.addEventListener('click', () => {
    document.getElementById('addJobTitleModal').style.display = 'none';
    jobTitleNameForUser.value = '';
  });
  
  // Close modal when clicking outside
  window.addEventListener('click', (event) => {
    const modal = document.getElementById('addJobTitleModal');
    if (event.target === modal) {
      modal.style.display = 'none';
      jobTitleNameForUser.value = '';
    }
  });
}

// Handle add new job name from add user modal
function initializeAddJobNameFromUserModal() {
  const saveAddJobName = document.getElementById('saveAddJobName');
  const cancelAddJobName = document.getElementById('cancelAddJobName');
  const jobNameNameForUser = document.getElementById('jobNameNameForUser');
  
  if (saveAddJobName && cancelAddJobName && jobNameNameForUser) {
    saveAddJobName.addEventListener('click', async () => {
      const name = jobNameNameForUser.value.trim();
      
      if (!name) {
        showToast(getTranslation('enter-job-name') || 'الرجاء إدخال المسمى', 'warning');
        return;
      }
      
      try {
        const response = await fetch(`${apiBase}/job-names`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name })
        });
        
        const data = await response.json();
        
        if (data.success) {
          showToast(getTranslation('job-name-added') || 'تم إضافة المسمى بنجاح', 'success');
          document.getElementById('addJobNameModal').style.display = 'none';
          jobNameNameForUser.value = '';
          
          // Refresh job names dropdowns
          await loadJobNamesForDropdown(document.getElementById('jobName'));
          
          // Also refresh the edit modal dropdown if it exists
          const editJobName = document.getElementById('editJobName');
          if (editJobName) {
            await fetchJobNamesForEditModal('', '');
          }
          
          // Select the newly added job name in the active modal
          const activeModal = document.getElementById('addUserModal').style.display === 'flex' ? 'addUserModal' : 'editUserModal';
          if (activeModal === 'addUserModal') {
            document.getElementById('jobName').value = data.data.id;
          } else {
            document.getElementById('editJobName').value = data.data.id;
          }
        } else {
          showToast(data.message || getTranslation('error-occurred'), 'error');
        }
      } catch (error) {
        console.error('Error adding job name:', error);
        showToast(getTranslation('error-occurred'), 'error');
      }
    });
    
    cancelAddJobName.addEventListener('click', () => {
      document.getElementById('addJobNameModal').style.display = 'none';
      jobNameNameForUser.value = '';
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
      const modal = document.getElementById('addJobNameModal');
      if (event.target === modal) {
        modal.style.display = 'none';
        jobNameNameForUser.value = '';
      }
    });
  }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initializeJobTitlesManagement();
  initializeJobNamesManagement();
  initializeJobTitlesForAddUser();
  initializeJobNamesForAddUser();
  initializeAddJobTitleFromUserModal();
  initializeAddJobNameFromUserModal();
  initializeManageUsers();
});

// =====================
// Section Selection Buttons
// =====================

// تعريف الصلاحيات لكل قسم مع الاستثناءات
const sectionPermissions = {
  general: [
    'view_logs',
    'view_dashboard', 
    'view_reports'
  ],
  departments: [
    'add_section',
    'edit_section', 
    'delete_section'
    // استثناء: view_own_department
  ],
  folder: [
    'add_folder',
    'add_folder_name',
    'edit_folder',
    'edit_folder_name',
    'delete_folder',
    'delete_folder_name'
  ],
  content: [
    'add_content',
    'add_old_content',
    'edit_content',
    'delete_content'
  ],
  committees: [
    'add_committee',
    'edit_committee',
    'delete_committee'
    // استثناء: view_own_committees
  ],
  'committee-folders': [
    'add_folder_committee',
    'add_folder_committee_name',
    'edit_folder_committee',
    'edit_folder_committee_name',
    'delete_folder_committee',
    'delete_folder_committee_name'
  ],
  'committee-content': [
    'add_content_committee',
    'add_approved_content_committee',
    'edit_content_committee',
    'delete_content_committee'
  ],
  tickets: [
    'view_tickets',
    'transfer_tickets',
    'track_tickets',
    'delete_ticket',
    'edit_ticket',
    'manage_ovr_settings'
  ],
  'ticket-reports': [
    'view_all_reports_tickets',
    'download_reports_tickets'
    // استثناء: view_reports_by_person_tickets
  ],
  approvals: [
    'view_credits',
    'transfer_credits',
    'track_credits'
  ],
  'approval-reports': [
    'view_all_reports_approvals',
    'download_reports_approvals'
    // استثناء: view_reports_by_person_approvals
  ],
  signature: [
    'sign',
    'sign_on_behalf',
    'delegate_all',
    'revoke_delegations'
  ],
  accounts: [
    'add_user',
    'change_status',
    'change_role',
    'delete_user',
    'change_password',
    'change_user_info'
  ]
};

// تهيئة أزرار تحديد الأقسام
function initializeSectionButtons() {
  const sectionButtons = document.querySelectorAll('.btn-select-section');
  
  sectionButtons.forEach(button => {
    button.addEventListener('click', () => {
      const section = button.dataset.section;
      selectSectionPermissions(section);
    });
  });
}

// تحديد صلاحيات قسم معين
async function selectSectionPermissions(section) {
  if (!selectedUserId) {
    showToast(getTranslation('please-select-user') || 'الرجاء اختيار مستخدم أولاً', 'warning');
    return;
  }

  const permissions = sectionPermissions[section];
  if (!permissions) {
    showToast('قسم غير معروف', 'error');
    return;
  }

  try {
    // تحديد جميع الصلاحيات في القسم
    const promises = permissions.map(permission => 
      fetchJSON(`${apiBase}/users/${selectedUserId}/permissions/${encodeURIComponent(permission)}`, {
        method: 'POST'
      })
    );

    await Promise.all(promises);

    // تحديث الواجهة
    permissions.forEach(permission => {
      const checkbox = document.querySelector(`label.switch[data-key="${permission}"] input[type="checkbox"]`);
      if (checkbox) {
        checkbox.checked = true;
      }
    });

    showToast(`تم تحديد جميع صلاحيات قسم ${getSectionName(section)}`, 'success');
  } catch (error) {
    console.error('خطأ في تحديد صلاحيات القسم:', error);
    showToast('فشل في تحديد صلاحيات القسم: ' + error.message, 'error');
  }
}

// الحصول على اسم القسم باللغة الحالية
function getSectionName(section) {
  const sectionNames = {
    general: getTranslation('general-group') || 'عامّ',
    departments: getTranslation('departments-group') || 'الأقسام',
    folder: getTranslation('folder-group') || 'المجلد',
    content: getTranslation('content-group') || 'المحتوى',
    committees: getTranslation('committees-group') || 'اللجان',
    'committee-folders': getTranslation('committee-folders-group') || 'مجلدات اللجان',
    'committee-content': getTranslation('committee-content-group') || 'محتوى اللجان',
    tickets: getTranslation('tickets-group') || 'التذاكر',
    'ticket-reports': getTranslation('report-group-tickets') || 'تقارير التذاكر',
    approvals: getTranslation('approvals-group') || 'الاعتمادات',
    'approval-reports': getTranslation('report-group-approvals') || 'تقارير الاعتمادات',
    signature: getTranslation('signature-group') || 'التوقيع',
    accounts: getTranslation('accounts-group') || 'الحسابات'
  };
  
  return sectionNames[section] || section;
}

// دالة فتح popup إلغاء التفويضات
async function openRevokeDelegationsPopup() {
  if (!selectedUserId) return showToast(getTranslation('please-select-user'), 'warning');
  // جلب ملخص الأشخاص المفوض لهم (ملفات + لجان + محاضر)
  let fileDelegates = [];
  let committeeDelegates = [];
  let protocolDelegates = [];
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
    // جلب ملخص المحاضر
    const resProt = await fetch(`${apiBase}/protocols/delegation-summary/${selectedUserId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const jsonProt = await resProt.json();
    if (jsonProt.status === 'success' && Array.isArray(jsonProt.data)) {
      protocolDelegates = jsonProt.data;
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
  if (fileDelegates.length === 0 && committeeDelegates.length === 0 && protocolDelegates.length === 0) {
    box.innerHTML += `<div style='margin:24px 0;'>${getTranslation('no-active-delegations')}</div>`;
  } else {
    if (fileDelegates.length > 0) {
      box.innerHTML += `<div style='font-weight:bold;margin:12px 0 6px;'>${getTranslation('file-delegations')}:</div>`;
      // ملفات: إلغاء تفويض selectedUserId (المفوض) إلى d.approver_id (المفوض إليه)
      fileDelegates.forEach(d => {
        box.innerHTML += `<div style='margin:8px 0;padding:8px 0;border-bottom:1px solid #eee;display:flex;align-items:center;justify-content:space-between;'>
          <span style='flex:1;text-align:right;'>${d.approver_name || d.email || getTranslation('user') + ' ' + d.approver_id} <span style='color:#888;font-size:0.95em;'>(${getTranslation('files-count')}: ${d.files_count})</span></span>
          <button style='background:#e53e3e;color:#fff;border:none;border-radius:6px;padding:4px 16px;cursor:pointer;margin-right:12px;' onclick='window.__revokeAllToUser(${selectedUserId},${d.approver_id},false,this)'>${getTranslation('revoke-delegations')}</button>
        </div>`;
      });
    }
    if (committeeDelegates.length > 0) {
      box.innerHTML += `<div style='font-weight:bold;margin:18px 0 6px;'>${getTranslation('committee-delegations')}:</div>`;
      // لجان: إلغاء تفويض selectedUserId (المفوض) إلى d.approver_id (المفوض إليه)
      committeeDelegates.forEach(d => {
        box.innerHTML += `<div style='margin:8px 0;padding:8px 0;border-bottom:1px solid #eee;display:flex:align-items:center;justify-content:space-between;'>
          <span style='flex:1;text-align:right;'>${d.approver_name || d.email || getTranslation('user') + ' ' + d.approver_id} <span style='color:#888;font-size:0.95em;'>(${getTranslation('files-count')}: ${d.files_count})</span></span>
          <button style='background:#e53e3e;color:#fff;border:none;border-radius:6px;padding:4px 16px;cursor:pointer;margin-right:12px;' onclick='window.__revokeAllToUser(${selectedUserId},${d.approver_id},true,this)'>${getTranslation('revoke-delegations')}</button>
        </div>`;
      });
    }
    if (protocolDelegates.length > 0) {
      box.innerHTML += `<div style='font-weight:bold;margin:18px 0 6px;'>${getTranslation('protocol-delegations') || 'تفويضات المحاضر'}:</div>`;
      // محاضر: إلغاء تفويض selectedUserId (المفوض) إلى d.approver_id (المفوض إليه)
      protocolDelegates.forEach(d => {
        box.innerHTML += `<div style='margin:8px 0;padding:8px 0;border-bottom:1px solid #eee;display:flex;align-items:center;justify-content:space-between;'>
          <span style='flex:1;text-align:right;'>${d.approver_name || d.email || getTranslation('user') + ' ' + d.approver_id} <span style='color:#888;font-size:0.95em;'>(${getTranslation('files-count')}: ${d.files_count})</span></span>
          <button style='background:#e53e3e;color:#fff;border:none;border-radius:6px;padding:4px 16px;cursor:pointer;margin-right:12px;' onclick='window.__revokeAllToUser(${selectedUserId},${d.approver_id},2,this)'>${getTranslation('revoke-delegations')}</button>
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
}

// إغلاق المودال عند النقر خارج المحتوى
if (editUserModal) {
  editUserModal.addEventListener('click', function(event) {
    if (event.target === this) {
      editUserModal.style.display = 'none';
    }
  });
}

// دالة فتح modal اقرارات التفويض
async function openDelegationConfirmationsModal() {
  try {
    
    // إظهار loading
    const modal = document.getElementById('delegationConfirmationsModal');
    const listContainer = document.getElementById('delegationConfirmationsList');
    
    if (!modal) {
      console.error('Modal element not found');
      showToast('خطأ في فتح النافذة', 'error');
      return;
    }
    
    if (!listContainer) {
      console.error('List container element not found');
      showToast('خطأ في فتح النافذة', 'error');
      return;
    }
    
    listContainer.innerHTML = '<div style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> جاري التحميل...</div>';
    modal.style.display = 'flex';
    
    // جلب اقرارات التفويض
    const confirmations = await fetchDelegationConfirmations();

    if (!confirmations || confirmations.length === 0) {
      listContainer.innerHTML = `
        <div class="delegation-confirmations-empty">
          <i class="fas fa-clipboard-list"></i>
          <h3>لا توجد اقرارات تفويض</h3>
          <p>لم يتم العثور على أي اقرارات تفويض في النظام حتى الآن</p>
          <p style="font-size: 0.9em; color: #666; margin-top: 10px;">
            اقرارات التفويض تظهر هنا عندما يقوم المستخدمون بتفويض صلاحياتهم للآخرين (الأقسام واللجان والمحاضر)
          </p>
        </div>
      `;
    } else {
      renderDelegationConfirmations(confirmations);
    }
  } catch (error) {
    console.error('Error opening delegation confirmations modal:', error);
    showToast('خطأ في تحميل اقرارات التفويض', 'error');
    
    const listContainer = document.getElementById('delegationConfirmationsList');
    if (listContainer) {
      listContainer.innerHTML = `
        <div class="delegation-confirmations-empty">
          <i class="fas fa-exclamation-triangle"></i>
          <h3>خطأ في التحميل</h3>
          <p>حدث خطأ أثناء تحميل اقرارات التفويض: ${error.message}</p>
        </div>
      `;
    }
  }
}

// دالة إغلاق modal اقرارات التفويض
function closeDelegationConfirmationsModal() {
  const modal = document.getElementById('delegationConfirmationsModal');
  modal.style.display = 'none';
}

// دالة جلب اقرارات التفويض من الخادم
async function fetchDelegationConfirmations() {
    try {
        const currentUserId = await getCurrentUserId();
        if (!currentUserId) {
            console.error('No current user ID found');
            return;
        }

        // Fetch bulk delegations first
        let bulkDelegations = [];
        try {
            const bulkResponse = await fetch(`${apiBase}/approvals/pending-delegations-unified`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            
            if (bulkResponse.ok) {
                const bulkData = await bulkResponse.json();
                
                if (bulkData && Array.isArray(bulkData.data)) {
                    bulkDelegations = bulkData.data;
                } else if (bulkData && Array.isArray(bulkData)) {
                    bulkDelegations = bulkData;
                }
            } else {
                // Fallback to user-specific endpoint
                const userBulkResponse = await fetch(`${apiBase}/approvals/pending-delegations-unified/${currentUserId}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                
                if (userBulkResponse.ok) {
                    const userBulkData = await userBulkResponse.json();
                    
                    if (userBulkData && Array.isArray(userBulkData.data)) {
                        bulkDelegations = userBulkData.data;
                    } else if (userBulkData && Array.isArray(userBulkData)) {
                        bulkDelegations = userBulkData;
                    }
                }
            }
        } catch (bulkError) {
            console.error('Error fetching bulk delegations:', bulkError);
        }



        // Fetch regular delegation confirmations
        let regularConfirmations = [];
        try {
            const confirmationsResponse = await fetch(`${apiBase}/approvals/delegation-confirmations`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            
            if (confirmationsResponse.ok) {
                const confirmationsData = await confirmationsResponse.json();
                
                if (confirmationsData && Array.isArray(confirmationsData.data)) {
                    regularConfirmations = confirmationsData.data;
                } else if (confirmationsData && Array.isArray(confirmationsData)) {
                    regularConfirmations = confirmationsData;
                }
            }
        } catch (confirmationsError) {
            console.error('Error fetching regular confirmations:', confirmationsError);
        }

        // Process bulk delegations into confirmations format
        const bulkConfirmations = [];
        
        for (const bulkDelegation of bulkDelegations) {
            // Extract delegator and delegate IDs with multiple fallback options
            let delegatorId = bulkDelegation.delegated_by || 
                            bulkDelegation.delegation_id || 
                            bulkDelegation.delegator_id || 
                            bulkDelegation.user_id || 
                            bulkDelegation.from_user_id;
            
            let delegateId = bulkDelegation.approver_id || 
                           bulkDelegation.delegate_id || 
                           bulkDelegation.to_user_id;
            
            if (!delegatorId || !delegateId) {
                continue;
            }

            // Note: For bulk delegations, we include ALL of them regardless of current user
            // This allows all users to see bulk delegation confirmations
                
                // Extract user information with multiple fallback options
                let delegatorName = '';
                let delegatorIdNumber = '';
                let delegateName = '';
                let delegateIdNumber = '';

                // Try to get delegator info from direct fields first (based on sample data structure)
                if (bulkDelegation.delegator_name) {
                    delegatorName = bulkDelegation.delegator_name;
                } else if (bulkDelegation.delegator_first_name && bulkDelegation.delegator_last_name) {
                    delegatorName = `${bulkDelegation.delegator_first_name} ${bulkDelegation.delegator_last_name}`.trim();
                } else if (bulkDelegation.delegator_first_name) {
                    delegatorName = bulkDelegation.delegator_first_name;
                }

                if (bulkDelegation.delegator_national_id) {
                    delegatorIdNumber = bulkDelegation.delegator_national_id;
                } else if (bulkDelegation.delegator_employee_number) {
                    delegatorIdNumber = bulkDelegation.delegator_employee_number;
                }

                // Try to get delegate info from direct fields first
                if (bulkDelegation.delegate_name) {
                    delegateName = bulkDelegation.delegate_name;
                } else if (bulkDelegation.delegate_first_name && bulkDelegation.delegate_last_name) {
                    delegateName = `${bulkDelegation.delegate_first_name} ${bulkDelegation.delegate_last_name}`.trim();
                } else if (bulkDelegation.delegate_first_name) {
                    delegateName = bulkDelegation.delegate_first_name;
                }

                if (bulkDelegation.delegate_national_id) {
                    delegateIdNumber = bulkDelegation.delegate_national_id;
                } else if (bulkDelegation.delegate_employee_number) {
                    delegateIdNumber = bulkDelegation.delegate_employee_number;
                }

                // Fallback to nested data if direct fields are not available
                if (!delegatorName && bulkDelegation.delegator_data) {
                    const delegatorData = bulkDelegation.delegator_data.data || bulkDelegation.delegator_data;
                    delegatorName = delegatorData.name || delegatorData.username || delegatorData.first_name || 'Unknown';
                    delegatorIdNumber = delegatorData.national_id || delegatorData.id_number || delegatorData.employee_number || '';
                }

                if (!delegateName && bulkDelegation.approver_data) {
                    const delegateData = bulkDelegation.approver_data.data || bulkDelegation.approver_data;
                    delegateName = delegateData.name || delegateData.username || delegateData.first_name || 'Unknown';
                    delegateIdNumber = delegateData.national_id || delegateData.id_number || delegateData.employee_number || '';
                }

                // Final fallback if still no names
                if (!delegatorName) delegatorName = 'Unknown';
                if (!delegateName) delegateName = 'Unknown';

                // إنشاء بنية البيانات المتوافقة مع renderDelegationConfirmations
                // إنشاء اقرار للمرسل (sender)
                const senderConfirmation = {
                    id: `${bulkDelegation.id || bulkDelegation.delegation_id || bulkDelegation.request_id}_sender`,
                    type: 'bulk',
                    is_bulk: true,
                    delegator_id: delegatorId,
                    delegate_id: delegateId,
                    created_at: bulkDelegation.created_at || bulkDelegation.delegation_date || bulkDelegation.request_date,
                    signature: bulkDelegation.signature || bulkDelegation.electronic_signature || '',
                    electronic_signature: bulkDelegation.electronic_signature || bulkDelegation.signature || '',
                    notes: bulkDelegation.notes || bulkDelegation.comments || '',
                    content_type: bulkDelegation.content_type || 'all',
                    department_id: bulkDelegation.department_id || bulkDelegation.dept_id,
                    department_name: bulkDelegation.department_name || bulkDelegation.dept_name || 'All Departments',
                    delegator: {
                        fullName: delegatorName,
                        idNumber: delegatorIdNumber
                    },
                    delegate: {
                        fullName: delegateName,
                        idNumber: delegateIdNumber
                    },
                    delegation_type: 'sender'
                };

                // إنشاء اقرار للمستقبل (receiver) بدون توقيع
                const receiverConfirmation = {
                    id: `${bulkDelegation.id || bulkDelegation.delegation_id || bulkDelegation.request_id}_receiver`,
                    type: 'bulk',
                    is_bulk: true,
                    delegator_id: delegatorId,
                    delegate_id: delegateId,
                    created_at: bulkDelegation.created_at || bulkDelegation.delegation_date || bulkDelegation.request_date,
                    signature: '', // لا يوجد توقيع للمستقبل
                    electronic_signature: '', // لا يوجد توقيع إلكتروني للمستقبل
                    notes: bulkDelegation.notes || bulkDelegation.comments || '',
                    content_type: bulkDelegation.content_type || 'all',
                    department_id: bulkDelegation.department_id || bulkDelegation.dept_id,
                    department_name: bulkDelegation.department_name || bulkDelegation.dept_name || 'All Departments',
                    delegator: {
                        fullName: delegatorName,
                        idNumber: delegatorIdNumber
                    },
                    delegate: {
                        fullName: delegateName,
                        idNumber: delegateIdNumber
                    },
                    delegation_type: 'receiver'
                };

                bulkConfirmations.push(senderConfirmation);
                bulkConfirmations.push(receiverConfirmation);
        }

        // Combine and sort all confirmations
        const allConfirmations = [...bulkConfirmations, ...regularConfirmations];
        
        // Sort by creation date (newest first)
        allConfirmations.sort((a, b) => {
            const dateA = new Date(a.created_at || 0);
            const dateB = new Date(b.created_at || 0);
            return dateB - dateA;
        });

        return allConfirmations;

    } catch (error) {
        console.error('Error in fetchDelegationConfirmations:', error);
        return [];
    }
}

// دالة استرجاع التوقيع من البيانات المرجعة من الخادم
function getSignatureFromData(confirmation) {
  // electronic_signature هو boolean flag يشير إلى تفعيل التوقيع الإلكتروني
  // signature يحتوي على بيانات التوقيع الفعلية (data URL)
  
  // التحقق من وجود توقيع فعلي
  if (confirmation.signature && 
      typeof confirmation.signature === 'string' && 
      confirmation.signature.trim() !== '') {
    return confirmation.signature;
  }
  
  // إذا لم يكن هناك توقيع فعلي، نتحقق من وجود توقيع إلكتروني
  if (confirmation.electronic_signature && 
      typeof confirmation.electronic_signature === 'string' && 
      confirmation.electronic_signature.trim() !== '') {
    return confirmation.electronic_signature;
  }
  
  return null;
}

// دالة عرض اقرارات التفويض
function renderDelegationConfirmations(confirmations) {
  const listContainer = document.getElementById('delegationConfirmationsList');
  

  
  if (confirmations.length === 0) {
    listContainer.innerHTML = `
      <div class="delegation-confirmations-empty">
        <i class="fas fa-clipboard-list"></i>
        <h3>لا توجد اقرارات تفويض</h3>
        <p>لم يتم العثور على أي اقرارات تفويض في النظام حتى الآن</p>
        <p style="font-size: 0.9em; color: #666; margin-top: 10px;">
          اقرارات التفويض تظهر هنا عندما يقوم المستخدمون بتفويض صلاحياتهم للآخرين (الأقسام واللجان والمحاضر)
        </p>
      </div>
    `;
    return;
  }
  
  const confirmationsHTML = confirmations.map((confirmation, index) => {
    console.log(`Rendering confirmation ${index + 1}:`, confirmation);
    
    const confirmationDate = new Date(confirmation.created_at).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const delegationTypeText = confirmation.is_bulk ? 'تفويض شامل' : 'تفويض فردي';
    const contentTypeText = confirmation.content_type === 'committee' ? 'لجنة' : (confirmation.content_type === 'protocol' ? 'محضر' : 'قسم');

    // تحديد نوع التفويض للمديرين - عرض جميع التفويضات
    let delegationTypeBadge = '';
    let delegationTypeClass = '';
    
    // عرض اقرار منفصل حسب نوع التفويض
    if (confirmation.delegation_type === 'sender') {
      delegationTypeBadge = `<span class="delegation-type-badge sender">اقرار المرسل: ${confirmation.delegator?.fullName || 'غير معروف'}</span>`;
      delegationTypeClass = 'delegation-sender';
    } else if (confirmation.delegation_type === 'receiver') {
      delegationTypeBadge = `<span class="delegation-type-badge receiver">اقرار المستقبل: ${confirmation.delegate?.fullName || 'غير معروف'}</span>`;
      delegationTypeClass = 'delegation-receiver';
    }

    let filesHTML = '';
    if (confirmation.is_bulk) {
      filesHTML = `
        <div class="delegation-confirmation-files">
          <div class="delegation-confirmation-files-summary">
            <i class="fas fa-globe" style="color: #007bff; margin-left: 8px;"></i>
            تفويض شامل لجميع الملفات المعلقة  
          </div>
        </div>
      `;
    } else if (confirmation.files && confirmation.files.length > 0) {
      const filesList = confirmation.files.map(file => `
        <div class="delegation-confirmation-file-item">
          <span class="delegation-confirmation-file-name">${file.title || file.name}</span>
          <span class="delegation-confirmation-file-type">${file.type === 'committee' ? 'لجنة' : (file.type === 'protocol' ? 'محضر' : 'قسم')}</span>
        </div>
      `).join('');
      
      filesHTML = `
        <div class="delegation-confirmation-files">
          <div class="delegation-confirmation-files-list">
            ${filesList}
          </div>
        </div>
      `;
    }

    return `
      <div class="delegation-confirmation-item ${delegationTypeClass} ${confirmation.is_bulk ? 'bulk-delegation' : ''}">
        <div class="delegation-confirmation-header">
          <div class="delegation-confirmation-title-section">
            <h3 class="delegation-confirmation-title">
              ${confirmation.is_bulk ? '<i class="fas fa-globe" style="color: #007bff; margin-left: 8px;"></i>' : ''}
              اقرار تفويض
            </h3>
            ${delegationTypeBadge}
          </div>
          <span class="delegation-confirmation-date">${confirmationDate}</span>
        </div>
        
        <div class="delegation-confirmation-type">
          <span class="delegation-type-indicator ${confirmation.is_bulk ? 'bulk' : 'individual'}">
            ${delegationTypeText}
          </span>
        </div>
        
        <div class="delegation-confirmation-details">
          <div class="delegation-confirmation-section">
            <h4>معلومات الموظف المفوض</h4>
            <div class="delegation-confirmation-info-row">
              <span class="delegation-confirmation-label">الاسم:</span>
              <span class="delegation-confirmation-value">${confirmation.delegator?.fullName || 'غير معروف'}</span>
            </div>
            <div class="delegation-confirmation-info-row">
              <span class="delegation-confirmation-label">رقم الهوية:</span>
              <span class="delegation-confirmation-value">${confirmation.delegator?.idNumber || 'غير محدد'}</span>
            </div>
          </div>
          
          <div class="delegation-confirmation-section">
            <h4>معلومات الموظف المفوض له</h4>
            <div class="delegation-confirmation-info-row">
              <span class="delegation-confirmation-label">الاسم:</span>
              <span class="delegation-confirmation-value">${confirmation.delegate?.fullName || 'غير معروف'}</span>
            </div>
            <div class="delegation-confirmation-info-row">
              <span class="delegation-confirmation-label">رقم الهوية:</span>
              <span class="delegation-confirmation-value">${confirmation.delegate?.idNumber || 'غير محدد'}</span>
            </div>
          </div>
        </div>
        
        <div class="delegation-confirmation-statement">
          ${confirmation.delegation_type === 'sender' 
            ? `أقر الموظف <strong>${confirmation.delegator?.fullName || 'غير معروف'}</strong> 
               ذو رقم الهوية <strong>${confirmation.delegator?.idNumber || 'غير محدد'}</strong> 
               بأنه يفوض الموظف <strong>${confirmation.delegate?.fullName || 'غير معروف'}</strong> 
               ذو رقم الهوية <strong>${confirmation.delegate?.idNumber || 'غير محدد'}</strong> 
               بالتوقيع بالنيابة عنه على ${confirmation.is_bulk ? 'جميع الملفات المعلقة' : 'الملفات المحددة'}.`
            : `أقر الموظف <strong>${confirmation.delegate?.fullName || 'غير معروف'}</strong> 
               ذو رقم الهوية <strong>${confirmation.delegate?.idNumber || 'غير محدد'}</strong> 
               بقبول التفويض من الموظف <strong>${confirmation.delegator?.fullName || 'غير معروف'}</strong> 
               ذو رقم الهوية <strong>${confirmation.delegator?.idNumber || 'غير محدد'}</strong> 
               للتوقيع بالنيابة عنه على ${confirmation.is_bulk ? 'جميع الملفات المعلقة' : 'الملفات المحددة'}.`
          }
        </div>
        
        ${filesHTML}
        
        ${(() => {
          // عرض التوقيع فقط للمرسل (sender) وليس للمستقبل (receiver)
          if (confirmation.delegation_type !== 'sender') {
            return '';
          }
          
          const signature = getSignatureFromData(confirmation);
          if (signature && typeof signature === 'string' && signature.trim() !== '') {
            // التحقق من أن التوقيع يحتوي على بيانات صحيحة
            const isValidSignature = signature.startsWith('data:image') || signature.startsWith('http');
            
            if (isValidSignature) {
              return `
                <div class="delegation-confirmation-signature">
                  <h4>التوقيع الشخصي</h4>
                  <div class="delegation-confirmation-signature-container">
                    <div class="delegation-confirmation-signature-item">
                      <span class="delegation-confirmation-signature-label">التوقيع:</span>
                      <img src="${signature}" alt="التوقيع" class="delegation-confirmation-signature-image" 
                           onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" 
                           onload="console.log('Signature loaded successfully')" />
                      <span class="delegation-confirmation-signature-error" style="display: none; color: #dc3545; font-style: italic;">
                        فشل في تحميل التوقيع
                      </span>
                    </div>
                  </div>
                </div>
              `;
            }
          } else {
            // عرض رسالة عندما لا يوجد توقيع للمرسل فقط
            return `
              <div class="delegation-confirmation-signature">
                <h4>التوقيع الشخصي</h4>
                <div class="delegation-confirmation-signature-container">
                  <div class="delegation-confirmation-signature-item">
                    <span class="delegation-confirmation-signature-label">التوقيع:</span>
                    <span class="delegation-confirmation-signature-missing" style="color: #888; font-style: italic;">
                      لم يتم حفظ توقيع المرسل
                    </span>
                  </div>
                </div>
              </div>
            `;
          }
          return '';
        })()}
      </div>
    `;
  }).join('');

  listContainer.innerHTML = confirmationsHTML;
  console.log('Finished rendering confirmations');
}

// دالة مساعدة للحصول على معرف المستخدم الحالي
async function getCurrentUserId() {
  if (!authToken) return null;
  try {
    const payload = await safeGetUserInfo(authToken);
    return payload ? payload.id : null;
  } catch (e) {
    console.error('Error getting user info:', e);
    return null;
  }
}
