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
  const [departmentApprovals, committeeApprovals, protocolApprovals] = await Promise.all([
    fetchJSON(`${apiBase}/pending-approvals`),
    fetchJSON(`${apiBase}/pending-committee-approvals`),
    fetchJSON(`${apiBase}/protocols/pending/approvals`)
  ]);

  // DEBUG: Log raw data from backend
  

  const uniqueApprovalsMap = new Map();
  
  // إضافة محتويات الأقسام أولاً
  (departmentApprovals || []).forEach(item => {
    uniqueApprovalsMap.set(item.id, { ...item, type: 'department' });
  });
  
  // إضافة محتويات اللجان (ستحل محل أي تكرارات بنفس الـ ID)
  (committeeApprovals || []).forEach(item => {
    uniqueApprovalsMap.set(item.id, { ...item, type: 'committee' });
  });

  // إضافة المحاضر (ستحل محل أي تكرارات بنفس الـ ID)
  (protocolApprovals || []).forEach(item => {
    // تأكد أن approvers_required مصفوفة
    let approversReq = item.approvers_required;
    try {
      if (typeof approversReq === 'string') {
        approversReq = JSON.parse(approversReq || '[]');
      }
    } catch { approversReq = []; }
    uniqueApprovalsMap.set(item.id, { ...item, type: 'protocol', approvers_required: approversReq });
  });

  const rawApprovals = Array.from(uniqueApprovalsMap.values());

  // DEBUG: Log rawApprovals after initial mapping and de-duplication
  

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

  approvals.forEach(item => {
    // 1) افصل الأسماء المرسَلة سابقًا
    const assignedNamesRaw = item.assigned_approvers || item.assignedApprovers || '';
    const assignedApproverNames = assignedNamesRaw
      ? assignedNamesRaw.split(',').map(a => a.trim()).filter(Boolean)
      : [];
    const hasApprovers = assignedApproverNames.length > 0;

    // 2) ابني badges من الأسماء مع أرقام التسلسل
    // الأسماء تأتي مرتبة من GROUP_CONCAT ORDER BY ca.sequence_number
    const approverBadges = assignedApproverNames
      .map((name, index) => {
        const sequenceNumber = index + 1; // ترتيب حسب الترتيب في GROUP_CONCAT
        const isFirst = sequenceNumber === 1;
        const badgeColor = isFirst ? '#28a745' : '#6c757d';
        return `<span class="badge" style="background-color: ${badgeColor}; color: white;" data-sequence="${sequenceNumber}">${sequenceNumber}. ${name}</span>`;
      })
      .join('');

    const contentType = item.type === 'committee'
      ? getTranslation('committee-file')
      : item.type === 'protocol'
      ? getTranslation('protocol-file') || 'محضر'
      : getTranslation('department-report');

    // 3) أنشئ العنصر <tr> وخزن الأسماء في data-assigned-names
    const tr = document.createElement('tr');
    tr.dataset.id             = item.id;
    tr.dataset.type           = item.type;
    tr.dataset.assignedNames  = JSON.stringify(assignedApproverNames);
    // لو الـ item.approvers_required من السيرفر هو array من الأي ديز:
    const assignedApproverIds = Array.isArray(item.approvers_required)
      ? item.approvers_required
      : JSON.parse(item.approvers_required || '[]');
    tr.dataset.assignedIds = JSON.stringify(assignedApproverIds);
    

    // 4) الغِ innerHTML القديمة أو أضف فوقها
    tr.innerHTML = `
      <td>
${parseLocalizedName(item.title)}
        <div class="content-meta">(${contentType} - ${parseLocalizedName(item.source_name)})</div>
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
        <button class="btn-send" style="padding:6px 12px;">
          <i class="bi ${hasApprovers ? 'bi-plus-circle' : 'bi-send'}"></i>
          ${hasApprovers ? getTranslation('add-more') : getTranslation('send')}
          <span style="font-size: 10px; margin-left: 4px; opacity: 0.8;">(${getTranslation('sequential')})</span>
        </button>
                 <button class="btn-deadline" data-content-id="${item.id}" data-content-type="${item.type}" data-content-title="${item.title}" data-source-name="${item.source_name || ''}" title="${getTranslation('set-deadline')}">
           <i class="bi bi-clock"></i> ${getTranslation('set-deadline')}
         </button>
        ${item.file_path
          ? `<button class="btn-view" data-file-path="${item.file_path}" style="margin-right:5px;padding:6px 12px;">
               <i class="bi bi-eye"></i> ${getTranslation('view')}
             </button>`
          : ''}
      </td>
    `;

    tbody.appendChild(tr);

    // 5) زوّد مستمع للعرض إذا لزم الأمر
    const viewButton = tr.querySelector('.btn-view');
    if (viewButton) {
      viewButton.addEventListener('click', async e => {
        e.stopPropagation();

        // تسجيل عرض المحتوى
        try {
          let numericItemId = item.id;
          if (typeof item.id === 'string') {
            if (item.id.includes('-')) {
              const match = item.id.match(/\d+$/);
              numericItemId = match ? match[0] : item.id;
            } else {
              numericItemId = parseInt(item.id) || item.id;
            }
          } else {
            numericItemId = parseInt(item.id) || item.id;
          }
          if (!numericItemId || numericItemId <= 0) {
            console.warn('Invalid content ID:', item.id);
            return;
          }
          await fetchJSON(`${apiBase}/contents/log-view`, {
            method: 'POST',
            body: JSON.stringify({
              contentId: numericItemId,
              contentType: item.type || 'department',
              contentTitle: item.title,
              sourceName: item.source_name,
              folderName: item.folder_name || item.folderName || ''
            })
          });
        } catch (err) {
          console.error('Failed to log content view:', err);
          // لا نوقف العملية إذا فشل تسجيل اللوق
        }

        // تحقق من وجود file_path في item مباشرة (مثل approvals-recived.js)
        if (!item || !item.file_path) {
          showToast(getTranslation('file-link-unavailable'), 'error');
          return;
        }
        
        let filePath = item.file_path;
        
        // للتأكد من القيمة


        // استخدام نفس منطق approvals-recived.js
        const baseApiUrl = apiBase.replace('/api', '');
        let fileBaseUrl;

        // حالة ملفات اللجان (مسار يبدأ بـ backend/uploads/)
        if (filePath.startsWith('backend/uploads/')) {
          fileBaseUrl = `${baseApiUrl}/backend/uploads`;
          // شيل البادئة بالكامل
          filePath = filePath.replace(/^backend\/uploads\//, '');
        }
        // حالة ملفات الأقسام (مسار يبدأ بـ uploads/)
        else if (filePath.startsWith('uploads/')) {
          fileBaseUrl = `${baseApiUrl}/uploads`;
          // شيل البادئة
          filePath = filePath.replace(/^uploads\//, '');
        }
        // أي حالة ثانية نفترض نفس مجلد uploads
        else {
          fileBaseUrl = `${baseApiUrl}/uploads`;
        }

        const url = `${fileBaseUrl}/${filePath}`;

                 window.open(url, '_blank');
       });
     }

     // إضافة event listener لزر المواعيد النهائية
     const deadlineButton = tr.querySelector('.btn-deadline');
     if (deadlineButton) {
       deadlineButton.addEventListener('click', (e) => {
         e.preventDefault();
         const contentId = deadlineButton.dataset.contentId;
         const contentType = deadlineButton.dataset.contentType;
         const contentTitle = deadlineButton.dataset.contentTitle;
         const sourceName = deadlineButton.dataset.sourceName;
         
         openDeadlineModal(contentId, contentType, contentTitle, sourceName);
       });
     }
   });
 }

async function initDropdowns() {
  const departments = await fetchJSON(`${apiBase}/departments/all`);
  document.querySelectorAll('tbody tr').forEach(row => {
    const deptDrop = row.querySelector('[data-type=dept]');
    const userDrop = row.querySelector('[data-type=users]');
    const sendBtn  = row.querySelector('.btn-send');

    if (!sendBtn) return;
    let selectedDepts = [];
    let selectedUsers = [];
    let selectionCounter = 0; // عداد لترتيب الاختيار

    const deptBtn  = deptDrop.querySelector('.dropdown-btn');
    const deptList = deptDrop.querySelector('.dropdown-content');
    deptList.innerHTML = `<input type="text" class="dropdown-search" placeholder="${getTranslation('search-department')}">`;
    departments.forEach(d => {
      const itm = document.createElement('div');
      itm.className     = 'dropdown-item';
      itm.dataset.value = d.id;
      let name = d.name;
      const lang = localStorage.getItem('language') || 'ar';
      try {
        const parsed = typeof name === 'string' ? JSON.parse(name) : name;
        name = parsed[lang] || parsed.ar || parsed.en || '';
      } catch {}

      itm.textContent = name;
      itm.dataset.label = name;
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
        // لا تغلق القائمة هنا! (تم حذف deptList.classList.remove('active');)
        await rebuildUsersList();
      });
    })();

    async function rebuildUsersList() {
      // تغذية المستخدمين حسب الأقسام للمحاضر أيضًا
      const uBtn  = userDrop.querySelector('.dropdown-btn');
      const uList = userDrop.querySelector('.dropdown-content');
      uList.innerHTML = `<input type="text" class="dropdown-search" placeholder="${getTranslation('search-person')}">`;
      const existingAssignedNames = JSON.parse(row.dataset.assignedNames || '[]');

      if (!selectedDepts.length) {
        uBtn.disabled = true;
        uBtn.textContent = getTranslation('select-department-first');
        return;
      }

      uBtn.disabled = false;
      uBtn.textContent = selectedUsers.length ? `${selectedUsers.length} ${getTranslation('selected-count')}` : getTranslation('select-people');
      
      // إعادة بناء القائمة المعروضة للمعتمدين المختارين
      const selCell = row.querySelector('.selected-cell');
      if (selCell && selectedUsers.length > 0) {
        selCell.innerHTML = '';
        
        // ترتيب المعتمدين حسب وقت الاختيار
        const sortedUsers = selectedUsers.sort((a, b) => a.selectedAt - b.selectedAt);
        
        // إعادة تعيين العداد ليكون أكبر من أكبر قيمة موجودة
        const maxSelectedAt = Math.max(...selectedUsers.map(u => u.selectedAt || 0));
        selectionCounter = maxSelectedAt;
        
        sortedUsers.forEach((u, index) => {
          const badge = document.createElement('span');
          badge.className = 'badge';
          badge.dataset.sequence = index + 1;
          
          const lang = localStorage.getItem('language') || 'ar';
          const dept = selectedDepts.find(d => d.id === u.deptId);
          let deptName = dept?.name || '';

          try {
            const parsed = typeof deptName === 'string' ? JSON.parse(deptName) : deptName;
            deptName = parsed?.[lang] || parsed?.ar || parsed?.en || '';
          } catch {}

          // إضافة رقم التسلسل مع الاسم
          badge.textContent = `${index + 1}. ${u.name} (${deptName})`;
          
          // إضافة لون مختلف للمعتمد الأول
          if (index === 0) {
            badge.style.backgroundColor = '#28a745'; // أخضر للمعتمد الأول
            badge.style.color = 'white';
          } else {
            badge.style.backgroundColor = '#6c757d'; // رمادي للمعتمدين الآخرين
            badge.style.color = 'white';
          }
          
          selCell.appendChild(badge);
        });
      }

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
          if (existingAssignedNames.includes(u.name)) return;
          const item = document.createElement('div');
          item.className = 'dropdown-item';
          item.textContent = u.name;
          item.dataset.deptId = dept.id;
          item.dataset.userId = u.id;
          const existingUser = selectedUsers.find(x => x.id === u.id);
          if (existingUser) {
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
          // إضافة المعتمد مع حفظ ترتيب الاختيار
          selectionCounter++;
          selectedUsers.push({ id: userId, name, deptId, selectedAt: selectionCounter });
        } else {
          // إزالة المعتمد
          selectedUsers = selectedUsers.filter(x => x.id !== userId);
        }

        btn.textContent = selectedUsers.length ? `${selectedUsers.length} ${getTranslation('selected-count')}` : getTranslation('select-people');

        const selCell = row.querySelector('.selected-cell');
        selCell.innerHTML = '';
        
        // ترتيب المعتمدين حسب وقت الاختيار
        const sortedUsers = selectedUsers.sort((a, b) => a.selectedAt - b.selectedAt);
        
        sortedUsers.forEach((u, index) => {
          const badge = document.createElement('span');
          badge.className = 'badge';
          badge.dataset.sequence = index + 1;
          
          const lang = localStorage.getItem('language') || 'ar';
          const dept = selectedDepts.find(d => d.id === u.deptId);
          let deptName = dept?.name || '';

          try {
            const parsed = typeof deptName === 'string' ? JSON.parse(deptName) : deptName;
            deptName = parsed?.[lang] || parsed?.ar || parsed?.en || '';
          } catch {}

          // إضافة رقم التسلسل مع الاسم
          badge.textContent = `${index + 1}. ${u.name} (${deptName})`;
          
          // إضافة لون مختلف للمعتمد الأول
          if (index === 0) {
            badge.style.backgroundColor = '#28a745'; // أخضر للمعتمد الأول
            badge.style.color = 'white';
          } else {
            badge.style.backgroundColor = '#6c757d'; // رمادي للمعتمدين الآخرين
            badge.style.color = 'white';
          }
          
          selCell.appendChild(badge);
        });
      });
    })();

    // داخل initDropdowns، بعد ربط الـ dropdowns وأيقونة Send
    sendBtn.addEventListener('click', async () => {
      // تحقق من وجود row قبل المتابعة
      if (!row) {
        showToast('حدث خطأ: لم يتم العثور على الصف.', 'error');
        return;
      }
      // 1) أقرأ الأسماء المخزّنة حالياً
      const existingAssignedNames = row.dataset.assignedNames
        ? JSON.parse(row.dataset.assignedNames)
        : [];
      const existingIds = row.dataset.assignedIds
        ? JSON.parse(row.dataset.assignedIds)
        : [];

      // 2) جلب اللي اختارهم المستخدم
      const userItems = row.querySelectorAll('[data-type="users"] .dropdown-item.selected');
      const newUsers  = Array.from(userItems)
        .map(el => ({ id: +el.dataset.userId, name: el.textContent.trim() }))
        .filter(u => !existingAssignedNames.includes(u.name));

      if (!newUsers.length) {
        return alert(getTranslation('no-new-approvers'));
      }

      // 3) جلب الترتيب من الواجهة المعروضة حالياً
      const selCell = row.querySelector('.selected-cell');
      const displayedBadges = selCell.querySelectorAll('.badge');
      
      // إنشاء خريطة للترتيب المعروض
      const displayOrder = new Map();
      displayedBadges.forEach((badge, index) => {
        const badgeText = badge.textContent;
        // استخراج الاسم من النص (إزالة رقم التسلسل)
        const nameMatch = badgeText.match(/\d+\.\s*(.+?)(?:\s*\(|$)/);
        if (nameMatch) {
          const name = nameMatch[1].trim();
          displayOrder.set(name, index + 1);
        }
      });
      
      // إذا لم تكن هناك badges معروضة، استخدم ترتيب الاختيار
      let sortedNewUsers;
      if (displayedBadges.length === 0) {
        sortedNewUsers = newUsers.sort((a, b) => {
          const aSelected = selectedUsers.find(u => u.id === a.id);
          const bSelected = selectedUsers.find(u => u.id === b.id);
          return (aSelected?.selectedAt || 0) - (bSelected?.selectedAt || 0);
        });
      } else {
        // ترتيب المعتمدين الجدد حسب الترتيب المعروض
        sortedNewUsers = newUsers.sort((a, b) => {
          const aOrder = displayOrder.get(a.name) || 999;
          const bOrder = displayOrder.get(b.name) || 999;
          return aOrder - bOrder;
        });
      }
      
      const allNames = existingAssignedNames.concat(sortedNewUsers.map(u => u.name));
      const allIds   = existingIds.concat(sortedNewUsers.map(u => u.id));

      // 4) أرسل الـ API
      const contentId = row.dataset.id;
      const isProtocol = row.dataset.type === 'protocol';
      const endpoint  = row.dataset.type === 'committee'
        ? 'pending-committee-approvals/send'
        : 'pending-approvals/send';

      try {
        let resp;
        if (isProtocol) {
          // إرسال المعتمدين للمحضر عبر إضافة كل معتمد بتسلسله
          const baseSequence = existingIds.length;
          await Promise.all(
            sortedNewUsers.map((u, index) =>
              fetchJSON(`${apiBase}/protocols/${contentId}/approvers`, {
                method: 'POST',
                body: JSON.stringify({ userId: u.id, sequenceNumber: baseSequence + index + 1 })
              })
            )
          );
          resp = { status: 'success' };
        } else {
          resp = await fetchJSON(`${apiBase}/${endpoint}`, {
            method: 'POST',
            body: JSON.stringify({ contentId, approvers: allIds })
          });
        }
        if (resp.status === 'success') {
          // 5) حدّث الواجهة
          const selCell = row.querySelector('.selected-cell');
          if (!selCell) {
            showToast('حدث خطأ: لم يتم العثور على خلية المختارين.', 'error');
            return;
          }
          
          // إعادة بناء القائمة كاملة بالترتيب الصحيح
          selCell.innerHTML = '';
          
          // إضافة جميع المعتمدين (القديم + الجديد) بالترتيب الصحيح
          for (let index = 0; index < allNames.length; index++) {
            const name = allNames[index];
            const badge = document.createElement('span');
            badge.className = 'badge';
            const sequenceNumber = index + 1;
            badge.dataset.sequence = sequenceNumber;
            
            // تحقق إذا كان هذا المستخدم مفوض له
            const isNewUser = sortedNewUsers.some(u => u.name === name);
            if (isNewUser) {
              const newUser = sortedNewUsers.find(u => u.name === name);
              try {
                const delegationResponse = await fetchJSON(`${apiBase}/users/${newUser.id}/delegation-status`);
                if (delegationResponse && delegationResponse.delegated_by) {
                  // هذا مفوض له، أضف إشارة مع رقم التسلسل
                  badge.textContent = `${sequenceNumber}. ${name} (مفوض له)`;
                  badge.style.backgroundColor = '#ff6b6b'; // لون مختلف للمفوض له
                } else {
                  badge.textContent = `${sequenceNumber}. ${name}`;
                  // لون حسب الترتيب
                  if (sequenceNumber === 1) {
                    badge.style.backgroundColor = '#28a745'; // أخضر للمعتمد الأول
                  } else {
                    badge.style.backgroundColor = '#6c757d'; // رمادي للمعتمدين الآخرين
                  }
                }
              } catch (err) {
                // إذا فشل التحقق، استخدم الاسم العادي مع رقم التسلسل
                badge.textContent = `${sequenceNumber}. ${name}`;
                if (sequenceNumber === 1) {
                  badge.style.backgroundColor = '#28a745';
                } else {
                  badge.style.backgroundColor = '#6c757d';
                }
              }
            } else {
              // معتمد قديم
              badge.textContent = `${sequenceNumber}. ${name}`;
              if (sequenceNumber === 1) {
                badge.style.backgroundColor = '#28a745'; // أخضر للمعتمد الأول
              } else {
                badge.style.backgroundColor = '#6c757d'; // رمادي للمعتمدين الآخرين
              }
            }
            
            badge.style.color = 'white';
            selCell.appendChild(badge);
          }

          // 6) خزّن القيم الجديدة في الـ data-attributes
          row.dataset.assignedNames = JSON.stringify(allNames);
          row.dataset.assignedIds   = JSON.stringify(allIds);

          showToast(getTranslation('add-more-success'), 'success');

          // 7) أعد تحميل الـ rows علشان تخزن الـ attributes الجديدة
          await loadPendingApprovals();
          await initDropdowns();
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

function parseLocalizedName(name) {
  const lang = localStorage.getItem('language') || 'ar';
  try {
    const parsed = typeof name === 'string' ? JSON.parse(name) : name;
    return parsed?.[lang] || parsed?.ar || parsed?.en || '';
  } catch {
    return name;
  }
}

// ===== وظائف المواعيد النهائية =====

let currentDeadlineData = {
  contentId: null,
  contentType: null,
  contentTitle: null,
  sourceName: null
};

// فتح النافذة المنبثقة للمواعيد النهائية
async function openDeadlineModal(contentId, contentType, contentTitle, sourceName) {
  try {
    currentDeadlineData = {
      contentId,
      contentType,
      contentTitle,
      sourceName
    };

    // تحديث معلومات المحتوى في النافذة
    document.getElementById('deadlineContentTitle').textContent = `${getTranslation('title')}: ${parseLocalizedName(contentTitle)}`;
    document.getElementById('deadlineContentType').textContent = `${getTranslation('type')}: ${contentType === 'committee' ? getTranslation('committee-file') : getTranslation('department-report')}`;
    // جلب المعتمدين الحاليين
    let row = document.querySelector(`tr[data-id="${contentId}"]`);
    if (!row) {
      // إذا لم يتم العثور على الصف، جرب البحث بالبادئة
      const prefix = contentType === 'department' ? 'dept-' : 'comm-';
      const prefixedId = `${prefix}${contentId}`;
      row = document.querySelector(`tr[data-id="${prefixedId}"]`);
    }
    if (!row) {
      showToast('لم يتم العثور على بيانات المحتوى', 'error');
      return;
    }

    const assignedNames = JSON.parse(row.dataset.assignedNames || '[]');
    const assignedIds = JSON.parse(row.dataset.assignedIds || '[]');

    if (assignedNames.length === 0) {
      showToast('لا يوجد معتمدين محددين لهذا المحتوى', 'error');
      return;
    }

    // إذا كانت assignedIds فارغة ولكن assignedNames موجودة، نحتاج لجلب الـ IDs
    if (assignedIds.length === 0 && assignedNames.length > 0) {
      showToast('يتم جلب بيانات المعتمدين...', 'info');
      
      try {
        // جلب الـ IDs من الخادم
        const response = await fetch(`${apiBase}/users/get-ids-by-names`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
          },
          body: JSON.stringify({ names: assignedNames })
        });
        
                 if (response.ok) {
           const data = await response.json();
           if (data.userIds && data.userIds.length > 0) {
             // تحديث assignedIds
             assignedIds.length = 0;
             assignedIds.push(...data.userIds);
           }
         }
      } catch (error) {
        console.error('Error fetching user IDs:', error);
        showToast('فشل في جلب بيانات المعتمدين', 'error');
        return;
      }
    }

    // بناء قائمة المعتمدين في النافذة
    const deadlineList = document.getElementById('deadlineList');
    deadlineList.innerHTML = '';

    for (let i = 0; i < assignedNames.length; i++) {
      const name = assignedNames[i];
      const userId = assignedIds[i];
      
      const deadlineItem = document.createElement('div');
      deadlineItem.className = 'deadline-item';
      deadlineItem.innerHTML = `
        <div class="deadline-item-info">
          <div class="deadline-item-name">${i + 1}. ${name}</div>
          <div class="deadline-item-department">${getTranslation('approver')}</div>
        </div>
        <div class="deadline-time-inputs">
          <div class="deadline-time-group">
            <label>${getTranslation('days')}</label>
            <input type="number" class="deadline-time-input" id="days_${userId}" min="0" max="365" value="1">
          </div>
          <div class="deadline-time-group">
            <label>${getTranslation('hours')}</label>
            <input type="number" class="deadline-time-input" id="hours_${userId}" min="0" max="23" value="0">
          </div>
          <div class="deadline-time-group">
            <label>${getTranslation('minutes')}</label>
            <input type="number" class="deadline-time-input" id="minutes_${userId}" min="0" max="59" value="0">
          </div>
        </div>
      `;
      deadlineList.appendChild(deadlineItem);
    }

    // عرض النافذة المنبثقة
    document.getElementById('deadlineModal').style.display = 'block';

  } catch (error) {
    console.error('Error opening deadline modal:', error);
    showToast('حدث خطأ أثناء فتح نافذة المواعيد النهائية', 'error');
  }
}

// إغلاق النافذة المنبثقة
function closeDeadlineModal() {
  document.getElementById('deadlineModal').style.display = 'none';
  currentDeadlineData = {
    contentId: null,
    contentType: null,
    contentTitle: null,
    sourceName: null
  };
}

// حفظ المواعيد النهائية
async function saveDeadlines() {
  try {
    const { contentId, contentType } = currentDeadlineData;
    
    if (!contentId || !contentType) {
      showToast('بيانات غير صحيحة', 'error');
      return;
    }

    let row = document.querySelector(`tr[data-id="${contentId}"]`);
    if (!row) {
      // إذا لم يتم العثور على الصف، جرب البحث بالبادئة
      const prefix = contentType === 'department' ? 'dept-' : 'comm-';
      const prefixedId = `${prefix}${contentId}`;
      row = document.querySelector(`tr[data-id="${prefixedId}"]`);
    }
    if (!row) {
      showToast('لم يتم العثور على بيانات المحتوى', 'error');
      return;
    }

    const assignedIds = JSON.parse(row.dataset.assignedIds || '[]');
    const deadlines = [];

    // جمع البيانات من النافذة
    for (const userId of assignedIds) {
      const daysInput = document.getElementById(`days_${userId}`);
      const hoursInput = document.getElementById(`hours_${userId}`);
      const minutesInput = document.getElementById(`minutes_${userId}`);
      
      if (daysInput && hoursInput && minutesInput) {
        const days = parseInt(daysInput.value) || 0;
        const hours = parseInt(hoursInput.value) || 0;
        const minutes = parseInt(minutesInput.value) || 0;
        
        if (days > 0 || hours > 0 || minutes > 0) {
          deadlines.push({
            approverId: userId,
            days,
            hours,
            minutes
          });
        }
      }
    }

    if (deadlines.length === 0) {
      showToast('يرجى تحديد وقت (أيام، ساعات، أو دقائق) لمعتمد واحد على الأقل', 'warning');
      return;
    }

    // إرسال البيانات إلى الخادم
    const response = await fetch(`${apiBase}/deadlines/set-deadlines`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
      },
      body: JSON.stringify({
        contentId,
        contentType,
        deadlines
      })
    });

    const responseData = await response.json();

    if (responseData.status === 'success') {
      showToast('تم تعيين المواعيد النهائية بنجاح', 'success');
      closeDeadlineModal();
      
      // تحديث الواجهة لعرض المواعيد النهائية
      await loadPendingApprovals();
    } else {
      showToast('فشل في تعيين المواعيد النهائية', 'error');
    }

  } catch (error) {
    console.error('Error saving deadlines:', error);
    showToast('حدث خطأ أثناء حفظ المواعيد النهائية', 'error');
  }
}

// إغلاق النافذة المنبثقة عند النقر خارجها
document.addEventListener('click', function(event) {
  const modal = document.getElementById('deadlineModal');
  const modalContent = document.querySelector('.deadline-modal-content');
  
  if (event.target === modal) {
    closeDeadlineModal();
  }
});

// إغلاق النافذة المنبثقة عند الضغط على ESC
document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape') {
    closeDeadlineModal();
  }
});
