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

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadPendingApprovals();
    await initDropdowns();
  } catch (err) {
    console.error('Error initializing page:', err);
  }
});

async function loadPendingApprovals() {
  const [departmentApprovals, committeeApprovals] = await Promise.all([
    fetchJSON(`${apiBase}/pending-approvals`),
    fetchJSON(`${apiBase}/pending-committee-approvals`)
  ]);

  const rawApprovals = [...departmentApprovals, ...committeeApprovals];

  const tbody = document.querySelector('.approvals-table tbody');
  tbody.innerHTML = '';

  // Get current user ID for prioritization
  const token = localStorage.getItem('token');
  const decodedToken = token ? JSON.parse(atob(token.split('.')[1])) : null;
  const currentUserId = decodedToken ? decodedToken.id : null;

  // Sort approvals: items where current user is required approver first, then by created_at
  const approvals = rawApprovals.sort((a, b) => {
    const aIsAssigned = currentUserId && a.approvers_required && a.approvers_required.includes(currentUserId);
    const bIsAssigned = currentUserId && b.approvers_required && b.approvers_required.includes(currentUserId);

    if (aIsAssigned && !bIsAssigned) return -1;
    if (!aIsAssigned && bIsAssigned) return 1;

    return new Date(b.created_at) - new Date(a.created_at);
  });

  const baseUrl = apiBase.replace('/api', ''); // For constructing file URLs

  approvals.forEach(item => {
    const assignedApproverNames = item.assigned_approvers ? item.assigned_approvers.split(',').map(a => a.trim()) : [];
    const hasApprovers = assignedApproverNames.length > 0;

    const approverBadges = assignedApproverNames.map(name => {
      return `<span class="badge">${name}</span>`;
    }).join('');

    // Determine content type display
    let contentTypeText = '';
    if (item.content_type === 'department_content') {
      contentTypeText = `تقرير قسم`;
    } else if (item.content_type === 'committee_content') {
      contentTypeText = `ملف لجنة`;
    }

    const tr = document.createElement('tr');
    tr.dataset.id = item.id;

    tr.innerHTML = `
      <td>
        ${item.title}
        <div class="content-meta">(${contentTypeText} - ${item.source_name})</div>
      </td>
      <td>
        <div class="dropdown-custom" data-type="dept">
          <button class="dropdown-btn">اختر القسم</button>
          <div class="dropdown-content">
            <input type="text" class="dropdown-search" placeholder="ابحث...">
          </div>
        </div>
      </td>
      <td>
        <div class="dropdown-custom" data-type="users">
          <button class="dropdown-btn" disabled>اختر القسم أولاً</button>
          <div class="dropdown-content">
            <input class="dropdown-search" placeholder="ابحث...">
          </div>
        </div>
      </td>
      <td class="selected-cell">${approverBadges}</td>
      <td>
        <span class="${hasApprovers ? 'badge-sent' : 'badge-pending'}">
          ${hasApprovers ? 'تم الإرسال' : 'بانتظار الإرسال'}
        </span>
      </td>
      <td>
        <button class="btn-send" ${hasApprovers ? 'disabled' : ''} style="padding:6px 12px;">
          ${hasApprovers ? '<i class="bi bi-check-circle"></i> تم الإرسال' : '<i class="bi bi-send"></i> إرسال'}
        </button>
        ${item.file_path ? `<button class="btn-view" data-file-path="${item.file_path}" style="margin-right: 5px; padding: 6px 12px;">
          <i class="bi bi-eye"></i> عرض
        </button>` : ''}
      </td>
    `;

    tbody.appendChild(tr);

    // Add event listener for the view button
    const viewButton = tr.querySelector('.btn-view');
    if (viewButton) {
      viewButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent row click from interfering
        const filePath = e.currentTarget.dataset.filePath;
        if (filePath) {
          window.open(`${baseUrl}/${filePath}`, '_blank');
        } else {
          showToast('رابط الملف غير متوفر.', 'error');
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
    deptList.innerHTML = `<input type="text" class="dropdown-search" placeholder="ابحث القسم...">`;
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
          deptBtn.textContent = 'اختر القسم';
          selectedUsers = [];
        } else if (selectedDepts.length === 1) {
          deptBtn.textContent = selectedDepts[0].name;
        } else {
          deptBtn.textContent = `${selectedDepts.length} أقسام`;
        }
        deptList.classList.remove('active');
        await rebuildUsersList();
        row.querySelector('.selected-cell').innerHTML = '';
      });
    })();

    async function rebuildUsersList() {
      const uBtn  = userDrop.querySelector('.dropdown-btn');
      const uList = userDrop.querySelector('.dropdown-content');
      uList.innerHTML = `<input type="text" class="dropdown-search" placeholder="ابحث الشخص...">`;

      if (!selectedDepts.length) {
        uBtn.disabled = true;
        uBtn.textContent = 'اختر القسم أولاً';
        return;
      }

      uBtn.disabled = false;
      uBtn.textContent = selectedUsers.length ? `${selectedUsers.length} مختار` : 'اختر الأشخاص';

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

        btn.textContent = selectedUsers.length ? `${selectedUsers.length} مختار` : 'اختر الأشخاص';

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
        alert('الرجاء اختيار مستخدمين أولاً.');
        return;
      }

      const contentId = row.dataset.id;
      const approvers = selectedUsers.map(u => parseInt(u.id));
      const contentType = row.querySelector('.content-meta').textContent.includes('لجنة') ? 'committee' : 'department';
      const endpoint = contentType === 'committee' ? 'pending-committee-approvals/send' : 'pending-approvals/send';

      try {
        const response = await fetchJSON(`${apiBase}/${endpoint}`, {
          method: 'POST',
          body: JSON.stringify({ contentId, approvers })
        });

        if (response.status === 'success') {
          // تحديث واجهة المستخدم
          const statusSpan = row.querySelector('.badge-pending') || row.querySelector('.badge-sent');
          if (statusSpan) {
            statusSpan.classList.remove('badge-pending');
            statusSpan.classList.add('badge-sent');
            statusSpan.textContent = 'تم الإرسال';
          }

          const selectedCell = row.querySelector('.selected-cell');
          selectedCell.innerHTML = '';
          selectedUsers.forEach(u => {
            const badge = document.createElement('span');
            badge.className = 'badge';
            badge.textContent = u.name;
            selectedCell.appendChild(badge);
          });

          // تحديث قائمة الموافقات المعلقة
          await loadPendingApprovals();
        } else {
          showToast('فشل إرسال المعتمدين', 'error');
        }
      } catch (err) {
        console.error('فشل الإرسال:', err);
        showToast('فشل إرسال المعتمدين', 'error');
      }
    });
  });
}
