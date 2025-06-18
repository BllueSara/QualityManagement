const apiBase = 'http://localhost:3006/api';
const authToken = localStorage.getItem('token') || null;

async function fetchJSON(url, opts = {}) {
  opts.headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
  };
  const res = await fetch(url, opts);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText}`);
  }
  const contentType = res.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) {
    const json = await res.json();
    return json.data ?? json;
  } else {
    return await res.text();
  }
}

// Show Toast Function
function showToast(message, type = 'info', duration = 3000) {
  const toastContainer = document.getElementById('toast-container') || document.createElement('div');
  toastContainer.id = 'toast-container';
  document.body.appendChild(toastContainer);

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, duration);
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Set initial direction based on language
    const currentLang = localStorage.getItem('language') || 'ar';
    updatePageDirection(currentLang);
    
    await loadPendingApprovals();
    await initDropdowns();
  } catch (err) {
    console.error('Error initializing page:', err);
  }
});

// Add function to update page direction
function updatePageDirection(lang) {
  const mainContent = document.querySelector('.file-card');
  if (mainContent) {
    mainContent.dir = lang === 'ar' ? 'rtl' : 'ltr';
    mainContent.style.textAlign = lang === 'ar' ? 'right' : 'left';
  }

  // Update table direction
  const table = document.querySelector('.approvals-table');
  if (table) {
    table.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }

  // Update dropdowns direction
  document.querySelectorAll('.dropdown-custom').forEach(dropdown => {
    dropdown.dir = lang === 'ar' ? 'rtl' : 'ltr';
  });

  // Update search inputs direction
  document.querySelectorAll('.dropdown-search').forEach(input => {
    input.dir = lang === 'ar' ? 'rtl' : 'ltr';
  });

  // Update buttons direction
  document.querySelectorAll('.btn-send, .btn-view').forEach(btn => {
    btn.dir = lang === 'ar' ? 'rtl' : 'ltr';
  });

  // Update badges direction
  document.querySelectorAll('.badge').forEach(badge => {
    badge.dir = lang === 'ar' ? 'rtl' : 'ltr';
  });
}

// Add event listener for language changes
window.addEventListener('storage', function(e) {
  if (e.key === 'language') {
    const lang = localStorage.getItem('language') || 'ar';
    updatePageDirection(lang);
  }
});

async function loadPendingApprovals() {
  const [departmentApprovals, committeeApprovals] = await Promise.all([
    fetchJSON(`${apiBase}/pending-approvals`),
    fetchJSON(`${apiBase}/pending-committee-approvals`)
  ]);

  // DEBUG: Log raw data from backend
  console.log('DEBUG: Raw Department Pending Approvals Data:', JSON.parse(JSON.stringify(departmentApprovals)));
  console.log('DEBUG: Raw Committee Pending Approvals Data:', JSON.parse(JSON.stringify(committeeApprovals)));

  const uniqueApprovalsMap = new Map();
  
  // إضافة محتويات الأقسام أولاً
  (departmentApprovals || []).forEach(item => {
    uniqueApprovalsMap.set(item.id, { ...item, type: 'department' });
  });
  
  // إضافة محتويات اللجان (ستحل محل أي تكرارات بنفس الـ ID)
  (committeeApprovals || []).forEach(item => {
    uniqueApprovalsMap.set(item.id, { ...item, type: 'committee' });
  });

  const rawApprovals = Array.from(uniqueApprovalsMap.values());

  // DEBUG: Log rawApprovals after initial mapping and de-duplication
  console.log('DEBUG: Raw Approvals after initial mapping and de-duplication:', JSON.parse(JSON.stringify(rawApprovals)));

  const tbody = document.querySelector('.approvals-table tbody');
  tbody.innerHTML = '';

  const token = localStorage.getItem('token');
  const decodedToken = token ? JSON.parse(atob(token.split('.')[1])) : null;
  const currentUserId = decodedToken ? decodedToken.id : null;

  const approvals = rawApprovals.sort((a, b) => {
    // Ensure approvers_required is an array before checking includes
    const aApprovers = Array.isArray(a.approvers_required) ? a.approvers_required : (a.approvers_required ? JSON.parse(a.approvers_required) : []);
    const bApprovers = Array.isArray(b.approvers_required) ? b.approvers_required : (b.approvers_required ? JSON.parse(b.approvers_required) : []);

    const aIsAssigned = currentUserId && aApprovers.includes(currentUserId);
    const bIsAssigned = currentUserId && bApprovers.includes(currentUserId);

    if (aIsAssigned && !bIsAssigned) return -1;
    if (!aIsAssigned && bIsAssigned) return 1;

    return new Date(b.created_at) - new Date(a.created_at);
  });

  const baseUrl = apiBase.replace('/api', '') + '/uploads';

  approvals.forEach(item => {
    // DEBUG: Log each item before rendering
    console.log('DEBUG: Rendering item:', JSON.parse(JSON.stringify(item)));
    const assignedApproverNames = item.assigned_approvers ? item.assigned_approvers.split(',').map(a => a.trim()) : [];
    const hasApprovers = assignedApproverNames.length > 0;

    const approverBadges = assignedApproverNames.map(name => {
      return `<span class="badge">${name}</span>`;
    }).join('');

    const contentType = item.type === 'committee' ? getTranslation('committee-file') : getTranslation('department-report');

    const tr = document.createElement('tr');
    tr.dataset.id = item.id;
    tr.dataset.type = item.type;

    tr.innerHTML = `
      <td>
        ${item.title}
        <div class="content-meta">(${contentType} - ${item.source_name})</div>
      </td>
      <td>
        <div class="dropdown-custom" data-type="dept">
          <button class="dropdown-btn">${getTranslation('select-department')}</button>
          <div class="dropdown-content">
            <input type="text" class="dropdown-search" placeholder="${getTranslation('search-department')}">
          </div>
        </div>
      </td>
      <td>
        <div class="dropdown-custom" data-type="users">
          <button class="dropdown-btn" disabled>${getTranslation('select-department-first')}</button>
          <div class="dropdown-content">
            <input class="dropdown-search" placeholder="${getTranslation('search-person')}">
          </div>
        </div>
      </td>
      <td class="selected-cell">${approverBadges}</td>
      <td>
        <span class="${hasApprovers ? 'badge-sent' : 'badge-pending'}">
          ${hasApprovers ? getTranslation('sent') : getTranslation('waiting-send')}
        </span>
      </td>
      <td>
        <button class="btn-send" ${hasApprovers ? 'disabled' : ''} style="padding:6px 12px;">
          ${hasApprovers ? `<i class="bi bi-check-circle"></i> ${getTranslation('sent')}` : `<i class="bi bi-send"></i> ${getTranslation('send')}`}
        </button>
        ${item.file_path ? `<button class="btn-view" data-file-path="${item.file_path}" style="margin-right: 5px; padding: 6px 12px;">
          <i class="bi bi-eye"></i> ${getTranslation('view')}
        </button>` : ''}
      </td>
    `;

    tbody.appendChild(tr);

    const viewButton = tr.querySelector('.btn-view');
    if (viewButton) {
      viewButton.addEventListener('click', (e) => {
        e.stopPropagation();
        const filePath = e.currentTarget.dataset.filePath;
        console.log('DEBUG: filePath from data-file-path:', filePath);
        console.log('DEBUG: baseUrl:', baseUrl);
        if (filePath) {
          window.open(`${baseUrl}/${filePath}`, '_blank');
        } else {
          showToast(getTranslation('file-link-unavailable'), 'error');
        }
      });
    }
  });
}

async function initDropdowns() {
  const departments = await fetchJSON(`${apiBase}/departments`);
  document.querySelectorAll('tbody tr').forEach(row => {
    const deptDrop = row.querySelector('[data-type=dept]');
    const userDrop = row.querySelector('[data-type=users]');
    const sendBtn  = row.querySelector('.btn-send');

    if (!sendBtn || sendBtn.disabled) return;

    let selectedDepts = [];
    let selectedUsers = [];

    const deptBtn  = deptDrop.querySelector('.dropdown-btn');
    const deptList = deptDrop.querySelector('.dropdown-content');
    deptList.innerHTML = `<input type="text" class="dropdown-search" placeholder="${getTranslation('search-department')}">`;
    departments.forEach(d => {
      const itm = document.createElement('div');
      itm.className     = 'dropdown-item';
      itm.dataset.value = d.id;
      itm.textContent   = d.name;
      deptList.appendChild(itm);
    });

    (function setupDeptDropdown() {
      const search = deptList.querySelector('.dropdown-search');
      deptBtn.addEventListener('click', e => {
        e.stopPropagation();
        deptList.classList.toggle('active');
      });
      document.addEventListener('click', () => deptList.classList.remove('active'));
      deptList.addEventListener('click', e => e.stopPropagation());
      search.addEventListener('input', () => {
        const v = search.value.trim();
        deptList.querySelectorAll('.dropdown-item').forEach(i => {
          i.style.display = i.textContent.includes(v) ? 'block' : 'none';
        });
      });
      deptList.addEventListener('click', async e => {
        if (!e.target.classList.contains('dropdown-item')) return;
        const item = e.target;
        item.classList.toggle('selected');
        selectedDepts = Array.from(deptList.querySelectorAll('.dropdown-item.selected'))
                              .map(i => ({ id: i.dataset.value, name: i.textContent }));
        if (selectedDepts.length === 0) {
          deptBtn.textContent = getTranslation('select-department');
          selectedUsers = [];
        } else if (selectedDepts.length === 1) {
          deptBtn.textContent = selectedDepts[0].name;
        } else {
          deptBtn.textContent = `${selectedDepts.length} ${getTranslation('departments-count')}`;
        }
        deptList.classList.remove('active');
        await rebuildUsersList();
        row.querySelector('.selected-cell').innerHTML = '';
      });
    })();

    async function rebuildUsersList() {
      const uBtn  = userDrop.querySelector('.dropdown-btn');
      const uList = userDrop.querySelector('.dropdown-content');
      uList.innerHTML = `<input type="text" class="dropdown-search" placeholder="${getTranslation('search-person')}">`;

      if (!selectedDepts.length) {
        uBtn.disabled = true;
        uBtn.textContent = getTranslation('select-department-first');
        return;
      }

      uBtn.disabled = false;
      uBtn.textContent = selectedUsers.length ? `${selectedUsers.length} ${getTranslation('selected-count')}` : getTranslation('select-people');

      for (const dept of selectedDepts) {
        const divider = document.createElement('div');
        divider.className = 'dropdown-divider';
        divider.textContent = dept.name;
        uList.appendChild(divider);

        let users = [];
        try {
          users = await fetchJSON(`${apiBase}/users?departmentId=${dept.id}`);
        } catch (err) {
          console.warn(`لم يتم العثور على مستخدمين للقسم ${dept.id}`, err);
        }

        users.forEach(u => {
          const item = document.createElement('div');
          item.className = 'dropdown-item';
          item.textContent = u.name;
          item.dataset.deptId = dept.id;
          item.dataset.userId = u.id;
          if (selectedUsers.some(x => x.id === u.id)) {
            item.classList.add('selected');
          }
          uList.appendChild(item);
        });
      }

      const search = uList.querySelector('.dropdown-search');
      search.addEventListener('input', () => {
        const v = search.value.trim();
        uList.querySelectorAll('.dropdown-item').forEach(i => {
          i.style.display = i.textContent.includes(v) ? 'block' : 'none';
        });
      });
    }

    (function setupUsersDropdown() {
      const btn  = userDrop.querySelector('.dropdown-btn');
      const list = userDrop.querySelector('.dropdown-content');
      btn.addEventListener('click', e => {
        e.stopPropagation();
        list.classList.toggle('active');
      });
      document.addEventListener('click', () => list.classList.remove('active'));
      list.addEventListener('click', e => e.stopPropagation());
      list.addEventListener('click', e => {
        if (!e.target.classList.contains('dropdown-item')) return;
        const item = e.target;
        const name = item.textContent;
        const deptId = item.dataset.deptId;
        const userId = item.dataset.userId;

        if (item.classList.toggle('selected')) {
          selectedUsers.push({ id: userId, name, deptId });
        } else {
          selectedUsers = selectedUsers.filter(x => x.id !== userId);
        }

        btn.textContent = selectedUsers.length ? `${selectedUsers.length} ${getTranslation('selected-count')}` : getTranslation('select-people');

        const selCell = row.querySelector('.selected-cell');
        selCell.innerHTML = '';
        selectedUsers.forEach(u => {
          const badge = document.createElement('span');
          badge.className = 'badge';
          const deptName = selectedDepts.find(d => d.id === u.deptId)?.name || '';
          badge.textContent = `${u.name} (${deptName})`;
          selCell.appendChild(badge);
        });
      });
    })();

    sendBtn.addEventListener('click', async () => {
      if (!selectedUsers.length) {
        alert(getTranslation('please-select-users'));
        return;
      }

      const contentId = row.dataset.id;
      const contentType = row.dataset.type;
      const approvers = selectedUsers.map(u => parseInt(u.id));
      const endpoint = contentType === 'committee' ? 'pending-committee-approvals/send' : 'pending-approvals/send';

      try {
        const response = await fetchJSON(`${apiBase}/${endpoint}`, {
          method: 'POST',
          body: JSON.stringify({ contentId, approvers })
        });

        if (response.status === 'success') {
          const statusSpan = row.querySelector('.badge-pending') || row.querySelector('.badge-sent');
          if (statusSpan) {
            statusSpan.classList.remove('badge-pending');
            statusSpan.classList.add('badge-sent');
            statusSpan.textContent = getTranslation('sent');
          }

          const selectedCell = row.querySelector('.selected-cell');
          selectedCell.innerHTML = '';
          selectedUsers.forEach(u => {
            const badge = document.createElement('span');
            badge.className = 'badge';
            badge.textContent = u.name;
            selectedCell.appendChild(badge);
          });

          await loadPendingApprovals();
        } else {
          showToast(getTranslation('send-failed'), 'error');
        }
      } catch (err) {
        console.error('فشل الإرسال:', err);
        showToast(getTranslation('send-failed'), 'error');
      }
    });
  });
}
