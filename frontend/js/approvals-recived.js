// approvals-recived.js
let filteredItems = [];

const apiBase = 'http://localhost:3006/api';
const token = localStorage.getItem('token');
let permissionsKeys = [];
// تم إزالة التصريحات المكررة للمتغيرات العامة لأنها موجودة في sign.js
const currentLang = localStorage.getItem('language') || 'ar'; // تم إزالة التصريح المكرر
let currentPage   = 1;
const itemsPerPage = 5;
let allItems = [];
// بعد تعريف itemsPerPage …
const statusList = ['pending', 'approved', 'rejected'];
let currentGroupIndex = 0;

// متغيرات إضافية مطلوبة
let selectedContentId = null;
let currentSignature = null;
let canvas = null;
let ctx = null;
let modalCache = new Map();
let elementCache = new Map();
let isBulkDelegation = false;

// دالة إظهار التوست - خارج DOMContentLoaded لتكون متاحة في كل مكان
function showToast(message, type = 'info', duration = 3000) {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    // Force reflow to ensure animation plays from start
    toast.offsetWidth; 

    // تفعيل التوست
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Set a timeout to remove the toast
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 500);
    }, duration);
}

// جلب صلاحيات المستخدم
async function fetchPermissions() {
  if (!token) return;
  const payload = JSON.parse(atob(token.split('.')[1] || '{}'));
  const userId = payload.id, role = payload.role;
  if (role === 'admin') {
    permissionsKeys = ['*'];
    return;
  }
  try {
    const res = await fetch(`${apiBase}/users/${userId}/permissions`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return;
    const { data: perms } = await res.json();
    permissionsKeys = perms.map(p => typeof p === 'string' ? p : (p.permission || p.permission_key));
  } catch (e) {
    console.error('Failed to fetch permissions', e);
  }
}

async function fetchJSON(url, opts = {}) {
  opts.headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function getLocalizedName(name) {
  const lang = localStorage.getItem('language') || 'ar';
  try {
    const parsed = typeof name === 'string' ? JSON.parse(name) : name;
    return parsed?.[lang] || parsed?.ar || parsed?.en || name;
  } catch {
    return name;
  }
}
function closeModal(modalId) {
  const modal = getCachedElement(modalId);
  if (modal) {
    // إغلاق فوري بدون تأخير
    modal.style.display = 'none';
    modal.style.opacity = '1';
    modal.style.transition = '';
    
    // تنظيف الذاكرة المؤقتة
    modalCache.delete(modalId);
  }
}

function setupCloseButtons() {
  // إزالة event listeners السابقة لتجنب التكرار
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.removeEventListener('click', handleCloseClick);
    btn.addEventListener('click', handleCloseClick);
  });
  
  // إزالة event listeners السابقة للنقر خارج المودال
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.removeEventListener('click', handleOutsideClick);
    modal.addEventListener('click', handleOutsideClick);
  });
}

// دالة منفصلة لمعالجة النقر على زر الإغلاق
function handleCloseClick(e) {
  e.preventDefault();
  e.stopPropagation();
  const modalId = e.target.dataset.modal || e.target.closest('.modal-overlay')?.id;
  if (modalId) {
    closeModal(modalId);
  }
}

// دالة منفصلة لمعالجة النقر خارج المودال
function handleOutsideClick(e) {
  if (e.target === e.currentTarget) {
    closeModal(e.currentTarget.id);
  }
}
// تعريف deptFilter مرة واحدة في الأعلى
const deptFilter = document.getElementById('deptFilter');

document.addEventListener('DOMContentLoaded', async () => {
  if (!token) return showToast(getTranslation('please-login'), 'error');

  await fetchPermissions();

  // تعريف وإضافة زر تفويض جميع الملفات بالنيابة بعد فلتر الأقسام
  let btnAll = document.getElementById('delegateAllBtn');
  if (btnAll) btnAll.remove();
  // تحقق من الصلاحية قبل إنشاء الزر
  const canBulkDelegate = permissionsKeys.includes('*') || permissionsKeys.includes('grant_permissions') || permissionsKeys.includes('delegate_all');
  if (canBulkDelegate) {
    btnAll = document.createElement('button');
    btnAll.id = 'delegateAllBtn';
    btnAll.className = 'btn-delegate-all';
    btnAll.type = 'button';
    btnAll.innerHTML = `<i class="fas fa-user-friends"></i> ${getTranslation('delegate-all') || 'تفويض جميع الملفات بالنيابة'}`;
    btnAll.style = 'background: #2563eb; color: #fff; padding: 8px 18px; border-radius: 6px; border: none; font-size: 1rem; margin-right: 8px; cursor: pointer; vertical-align: middle;';
    const deptFilter = document.getElementById('deptFilter');
    if (deptFilter && deptFilter.parentNode) {
      deptFilter.parentNode.insertBefore(btnAll, deptFilter.nextSibling);
    }
    // ربط حدث فتح مودال التفويض الجماعي (نفس مودال التفويض العادي)
    btnAll.onclick = function() {
      isBulkDelegation = true;
      selectedContentId = null;
      document.getElementById('delegateDept').value = '';
      document.getElementById('delegateUser').innerHTML = '<option value="" disabled selected>' + (getTranslation('select-user') || 'اختر المستخدم') + '</option>';
      document.getElementById('delegateNotes').value = '';
      openModal('delegateModal');
      loadDepartments();
      document.getElementById('delegateNotes').placeholder = getTranslation('notes-bulk') || 'ملاحظات (تنطبق على جميع الملفات)';
    };
  }

  try {
    const deptResp      = await fetchJSON(`${apiBase}/approvals/assigned-to-me`);
    const commResp      = await fetchJSON(`${apiBase}/committee-approvals/assigned-to-me`);
    const combined      = [...(deptResp.data||[]), ...(commResp.data||[])];
    const uniqueMap     = new Map();
    combined.forEach(item => uniqueMap.set(item.id, item));
    allItems = Array.from(uniqueMap.values());
    filteredItems = allItems;

    await setupFilters(allItems);
    renderApprovals(filteredItems);
  } catch (err) {
    console.error("Error loading approvals:", err);
    showToast(getTranslation('error-loading'), 'error');
  }
document.getElementById("prevPage").addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    renderApprovals(filteredItems);
  }
});

document.getElementById("nextPage").addEventListener("click", () => {
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  if (currentPage < totalPages) {
    currentPage++;
    renderApprovals(filteredItems);
  }
});
  setupSignatureModal();
  setupCloseButtons();

  // ربط زر إرسال سبب الرفض
  const btnSendReason = document.getElementById('btnSendReason');
  if (btnSendReason) {
    btnSendReason.addEventListener('click', async () => {
      const reason = document.getElementById('rejectReason').value.trim();
      if (!reason) return showToast(getTranslation('please-enter-reason'), 'warning');
      const type     = document.querySelector(`tr[data-id="${selectedContentId}"]`).dataset.type;
      const endpoint = type === 'committee' ? 'committee-approvals' : 'approvals';
      try {
        await fetchJSON(`${apiBase}/${endpoint}/${selectedContentId}/approve`, {
          method: 'POST',
          body: JSON.stringify({ approved: false, signature: null, notes: reason })
        });
        showToast(getTranslation('success-rejected'), 'success');
        closeModal('rejectModal');
        updateApprovalStatusInUI(selectedContentId, 'rejected');
      } catch (e) {
        console.error('Failed to send rejection:', e);
        showToast(getTranslation('error-sending'), 'error');
      }
    });
  }

  // **رابط أزرار الباجينشن خارج أي شرط**


// وفي رقم الصفحة:


});

async function setupFilters(items) {
  const deptFilter = document.getElementById('deptFilter');
  const deptSet    = new Set(items.map(i => i.source_name).filter(Boolean));
  deptFilter.innerHTML = `<option value="all">${getTranslation('all-departments')}</option>`;
  deptSet.forEach(name => {
    const opt = document.createElement('option');
    opt.value       = name;
    opt.textContent = getLocalizedName(name);
    deptFilter.appendChild(opt);
  });
  deptFilter.addEventListener('change', applyFilters);
  document.getElementById('statusFilter').addEventListener('change', applyFilters);
  document.getElementById('searchInput').addEventListener('input', applyFilters);
}

// تحسين دالة applyFilters
function applyFilters() {
  currentPage = 1;  // ترجع للصفحة الأولى عند كل فلتر
  const dept       = document.getElementById('deptFilter').value;
  const status     = document.getElementById('statusFilter').value;
  const searchText = document.getElementById('searchInput').value.trim().toLowerCase();

  // خزّن النتيجة في filteredItems
  filteredItems = allItems.filter(i => {
    const localizedTitle = getLocalizedName(i.title).toLowerCase();
    const localizedSource = getLocalizedName(i.source_name).toLowerCase();
    const okDept   = dept === 'all' || i.source_name === dept;
    const okStatus = status === 'all' || i.approval_status === status;
    const okSearch = localizedTitle.includes(searchText) || localizedSource.includes(searchText);
    return okDept && okStatus && okSearch;
  });

  // استخدام throttled render لتحسين الأداء
  throttledRenderApprovals(filteredItems);
}
// تم إزالة التعريف المكرر - الدالة معرفة أدناه

// تم إزالة التعريف المكرر - الدوال معرفة أعلاه

function renderApprovals(items) {
  const tbody = document.getElementById("approvalsBody");
  tbody.innerHTML = "";

  // 1) إجمالي العناصر والفهارس
  const totalItems = items.length;
  const startIdx   = (currentPage - 1) * itemsPerPage;
  const endIdx     = Math.min(startIdx + itemsPerPage, totalItems);

  // 2) فرز وحساب القطع
  const sorted    = items.slice().sort((a, b) => {
    const order = { pending: 0, rejected: 1, approved: 2 };
    return order[a.approval_status] - order[b.approval_status];
  });
  const pageItems = sorted.slice(startIdx, endIdx);

  // 3) إنشاء الصفوف
  const canSign = permissionsKeys.includes('*') || permissionsKeys.includes('sign');
  const canDel  = permissionsKeys.includes('*') || permissionsKeys.includes('sign_on_behalf');

  pageItems.forEach(item => {
    const tr = document.createElement("tr");
    tr.dataset.id     = item.id;
    tr.dataset.status = item.approval_status;
    tr.dataset.source = item.source_name;
    tr.dataset.type   = item.type;

    let actions = "";
    if (item.approval_status === 'pending') {
      actions += `<button class="btn-sign"><i class="fas fa-user-check"></i> ${getTranslation('sign')}</button>`;
      actions += `<button class="btn-delegate"><i class="fas fa-user-friends"></i> ${getTranslation('delegate')}</button>`;
      actions += `<button class="btn-qr"><i class="fas fa-qrcode"></i> ${getTranslation('electronic')}</button>`;
      actions += `<button class="btn-reject"><i class="fas fa-times"></i> ${getTranslation('reject')}</button>`;
      actions += `<button class="btn-preview"><i class="fas fa-eye"></i> ${getTranslation('preview')}</button>`;
    }
    // إضافة زر تتبع الطلب لجميع الحالات
    actions += `<button class="btn-track" data-id="${item.id}" data-type="${item.type}">${getTranslation('track')}</button>`;

    const contentType = item.type === 'committee'
      ? getTranslation('committee-file')
      : getTranslation('department-report');

    // Debug: طباعة البيانات للتحقق
    console.log('Item data:', item);
    console.log('Start date:', item.start_date);
    console.log('End date:', item.end_date);
    console.log('Created at:', item.created_at);
    console.log('Updated at:', item.updated_at);
    
    // تنسيق التواريخ
    const formatDate = (dateString) => {
      if (!dateString) return '-';
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '-';
        return date.toLocaleDateString(localStorage.getItem('language') === 'ar' ? 'ar-EG' : 'en-US');
      } catch (e) {
        console.error('Error formatting date:', dateString, e);
        return '-';
      }
    };
    
    const startDate = formatDate(item.start_date);
    const endDate = formatDate(item.end_date);
    const createdDate = formatDate(item.created_at);
    const updatedDate = formatDate(item.updated_at);
    
    // عرض تواريخ الملف ونوع القسم فقط لملفات الأقسام
    let dateRange = '-';
    let departmentDisplay = '-';
    
    if (item.type !== 'committee') {
      // تواريخ الملف - فقط لملفات الأقسام
      if (item.start_date && item.end_date && item.start_date !== item.end_date) {
        dateRange = `${startDate} - ${endDate}`;
      } else if (item.start_date) {
        dateRange = `${getTranslation('from')}: ${startDate}`;
      } else if (item.end_date) {
        dateRange = `${getTranslation('to')}: ${endDate}`;
      } else if (item.created_at) {
        // إذا لم تكن هناك تواريخ محددة، استخدم تاريخ الإنشاء
        dateRange = `${getTranslation('created')}: ${createdDate}`;
      }
      
      // تنسيق اسم القسم مع نوعه - فقط لملفات الأقسام
      if (item.source_name) {
        const departmentType = item.department_type || 'department';
        const departmentTypeTranslation = getTranslation(`department-type-${departmentType}`) || departmentType;
        departmentDisplay = `${departmentTypeTranslation}: ${getLocalizedName(item.source_name)}`;
      }
    } else {
      // لملفات اللجان - عرض اسم القسم بدون نوع
      departmentDisplay = item.source_name ? getLocalizedName(item.source_name) : '-';
    }
    
    // Debug: طباعة النتيجة النهائية
    console.log('Final dateRange:', dateRange);
    console.log('Final departmentDisplay:', departmentDisplay);

    tr.innerHTML = `
      <td class="col-id">${item.id}</td>
      <td>
        ${getLocalizedName(item.title)}
        <div class="content-meta">(${contentType} - ${getLocalizedName(item.folder_name || item.folderName || '')})</div>
      </td>
      <td>${departmentDisplay}</td>
      <td class="col-dates">${dateRange}</td>
      <td class="col-response">${statusLabel(item.approval_status)}</td>
      <td class="col-actions">${actions}</td>
    `;
    tbody.appendChild(tr);

    if (!canDel) tr.querySelector('.btn-delegate')?.remove();
    if (!canSign) tr.querySelector('.btn-qr')?.remove();
  });

  // 4) حدّث الباجينج
  renderPagination(totalItems);

  // 5) حدّث نص العدّادة
  updateRecordsInfo(totalItems, startIdx, endIdx);

  // 6) أربط الأزرار
  initActions();
}

function updateApprovalStatusInUI(id, newStatus) {
  const item = allItems.find(i => i.id == id);
  if (!item) return;
  item.approval_status = newStatus;
  applyFilters();
}

function renderPagination(totalItems) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  document.getElementById("prevPage").disabled = currentPage === 1;
  document.getElementById("nextPage").disabled = currentPage === totalPages;

  const container = document.getElementById("pageNumbers");
  container.innerHTML = "";
  for (let i = 1; i <= totalPages; i++) {
    const span = document.createElement("span");
    span.textContent = i;
    span.className   = "page-number" + (i === currentPage ? " active" : "");
    span.addEventListener("click", () => {
      currentPage = i;
      renderApprovals(filteredItems);
    });
    container.appendChild(span);
  }
}

function statusLabel(status) {
  switch (status) {
    case 'approved':  return getTranslation('approved');
    case 'rejected':  return getTranslation('rejected');
    default:          return getTranslation('pending');
  }
}

// (بقية دوال initActions و signature modal و delegate تبقى كما كانت)


function initActions() {
  // استخدام event delegation محسن لتحسين الأداء
  if (!window.globalClickHandler) {
    window.globalClickHandler = (e) => {
      const target = e.target;
      
      // زر التوقيع
      if (target.closest('.btn-sign')) {
        console.log('🔍 Sign button clicked!');
        const id = target.closest('tr').dataset.id;
        console.log('🔍 Opening signature modal for id:', id);
        openSignatureModal(id);
        return;
      }
      
      // زر التفويض
      if (target.closest('.btn-delegate')) {
        console.log('🔍 Delegation button clicked!');
        isBulkDelegation = false;
        selectedContentId = target.closest('tr').dataset.id;
        console.log('🔍 selectedContentId set to:', selectedContentId);
        openModal('delegateModal');
        loadDepartments();
        document.getElementById('delegateNotes').placeholder = getTranslation('notes') || 'ملاحظات (اختياري)';
        
        // إعداد event listener للتفويض بعد فتح المودال
        setTimeout(() => {
          setupDelegationEventListener();
        }, 100);
        
        return;
      }
      
      // زر التوقيع الإلكتروني
      if (target.closest('.btn-qr')) {
        selectedContentId = target.closest('tr').dataset.id;
        openModal('qrModal');
        return;
      }
      
      // زر الرفض
      if (target.closest('.btn-reject')) {
        selectedContentId = target.closest('tr').dataset.id;
        openModal('rejectModal');
        return;
      }
      
      // زر المعاينة
      if (target.closest('.btn-preview')) {
        handlePreviewClick(target);
        return;
      }
      
      // زر تتبع الطلب
      if (target.closest('.btn-track')) {
        const btn = target.closest('.btn-track');
        const id = btn.dataset.id;
        const type = btn.dataset.type;
        window.location.href = `/frontend/html/track-request.html?id=${id}&type=${type}`;
        return;
      }
    };
    
    document.addEventListener('click', window.globalClickHandler, { passive: true });
  }
}

// دالة منفصلة لمعالجة النقر على زر المعاينة
async function handlePreviewClick(target) {
  const tr = target.closest('tr');
  const itemId = tr.dataset.id;
  const item = allItems.find(i => i.id == itemId);

  if (!item || !item.file_path) {
    showToast(getTranslation('no-content'), 'error');
    return;
  }

  // تسجيل عرض المحتوى
  try {
    let numericItemId = itemId;
    if (typeof itemId === 'string') {
      if (itemId.includes('-')) {
        const match = itemId.match(/\d+$/);
        numericItemId = match ? match[0] : itemId;
      } else {
        numericItemId = parseInt(itemId) || itemId;
      }
    } else {
      numericItemId = parseInt(itemId) || itemId;
    }
    if (!numericItemId || numericItemId <= 0) {
      console.warn('Invalid content ID:', itemId);
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

  const baseApiUrl = apiBase.replace('/api', '');

  let filePath = item.file_path;
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
}

// 1. دالة لجلب سجل الاعتمادات للملف
async function fetchApprovalLog(contentId, type) {
  // إزالة البادئة إن وجدت
  let cleanId = contentId;
  if (typeof cleanId === 'string' && (cleanId.startsWith('dept-') || cleanId.startsWith('comm-'))) {
    cleanId = cleanId.split('-')[1];
  }
  if (type === 'committee') {
    // لجلب سجل اعتماد اللجنة
    const res = await fetch(`${apiBase}/committee-approvals/${cleanId}/approvals`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return null;
    return await res.json();
  } else {
    // لجلب تفاصيل القسم من /api/contents/:id واستخراج approvals_log
    const res = await fetch(`${apiBase}/contents/${cleanId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return null;
    const json = await res.json();
    // approvals_log غالبًا يكون JSON string
    let log = [];
    try {
      log = JSON.parse(json.data?.approvals_log || json.approvals_log || '[]');
    } catch { log = []; }
    return log;
  }
}

// 2. تعديل زر التوقيع الإلكتروني
const btnElectronicApprove = document.getElementById('btnElectronicApprove');
if (btnElectronicApprove) {
  btnElectronicApprove.addEventListener('click', async () => {
    if (!selectedContentId) return showToast(getTranslation('please-select-user'), 'warning');
    const contentType = document.querySelector(`tr[data-id="${selectedContentId}"]`).dataset.type;
    const endpoint = contentType === 'committee' ? 'committee-approvals' : 'approvals';
    let approvalLog = await fetchApprovalLog(selectedContentId, contentType);
    const payload = {
      approved: true,
      signature: null,
      electronic_signature: true,
      notes: ''
    };
    const tokenPayload = JSON.parse(atob(token.split('.')[1] || '{}'));
    const myLog = Array.isArray(approvalLog) ? approvalLog.find(l => l.approver_id == tokenPayload.id) : null;
    console.log('[SIGN] approvalLog:', approvalLog);
    console.log('[SIGN] myLog:', myLog);
    if (myLog && (myLog.signed_as_proxy == 1 || myLog.delegated_by)) {
      payload.on_behalf_of = myLog.delegated_by;
      console.log('[SIGN] Sending on_behalf_of:', myLog.delegated_by);
    }
    console.log('[SIGN] payload being sent:', payload);
    try {
      const response = await fetchJSON(`${apiBase}/${endpoint}/${selectedContentId}/approve`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      console.log('[SIGN] response:', response);
      showToast(getTranslation('success-approved'), 'success');
      closeModal('qrModal');
      updateApprovalStatusInUI(selectedContentId, 'approved');
      disableActionsFor(selectedContentId);
    } catch (err) {
      console.error('Failed to electronically approve:', err);
      showToast(getTranslation('error-sending'), 'error');
    }
  });
}

// 3. تعديل زر التوقيع اليدوي (التوقيع بالرسم)
function setupSignatureModal() {
  canvas = document.getElementById('signatureCanvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  let drawing = false;
  
  window.addEventListener('resize', resizeCanvas);
  
  // إعداد التبويبات
  setupSignatureTabs();
  
  // إعداد رفع الصور
  setupImageUpload();
  
  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }
  
  canvas.addEventListener('mousedown', e => {
    drawing = true;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  });
  canvas.addEventListener('mousemove', e => {
    if (!drawing) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  });
  canvas.addEventListener('mouseup', () => {
    drawing = false;
    // تحديث التوقيع الحالي عند الانتهاء من الرسم
    currentSignature = canvas.toDataURL('image/png');
  });
  canvas.addEventListener('mouseleave', () => drawing = false);
  canvas.addEventListener('touchstart', e => {
    drawing = true;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  });
  canvas.addEventListener('touchmove', e => {
    if (!drawing) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  });
  canvas.addEventListener('touchend', () => {
    drawing = false;
    // تحديث التوقيع الحالي عند الانتهاء من الرسم
    currentSignature = canvas.toDataURL('image/png');
  });
  
  document.getElementById('btnClear').addEventListener('click', () => {
    clearCanvas();
    currentSignature = null;
  });
  
  document.getElementById('btnCancelSignature').addEventListener('click', () => {
    closeSignatureModal();
  });
  
  document.getElementById('btnConfirmSignature').addEventListener('click', async () => {
    // التحقق من وجود توقيع
    if (!currentSignature) {
      showToast(getTranslation('no-signature') || 'يرجى إضافة توقيع أولاً', 'error');
      return;
    }
    
    const contentType = document.querySelector(`tr[data-id="${selectedContentId}"]`).dataset.type;
    const endpoint = contentType === 'committee' ? 'committee-approvals' : 'approvals';
    let approvalLog = await fetchApprovalLog(selectedContentId, contentType);
    const payload = {
      approved: true,
      signature: currentSignature,
      notes: ''
    };
    const tokenPayload = JSON.parse(atob(token.split('.')[1] || '{}'));
    const myLog = Array.isArray(approvalLog) ? approvalLog.find(l => l.approver_id == tokenPayload.id) : null;
    console.log('[SIGN] approvalLog:', approvalLog);
    console.log('[SIGN] myLog:', myLog);
    if (myLog && (myLog.signed_as_proxy == 1 || myLog.delegated_by)) {
      payload.on_behalf_of = myLog.delegated_by;
      console.log('[SIGN] Sending on_behalf_of:', myLog.delegated_by);
    }
    console.log('[SIGN] payload being sent:', payload);
    try {
      const response = await fetchJSON(`${apiBase}/${endpoint}/${selectedContentId}/approve`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      console.log('[SIGN] response:', response);
      showToast(getTranslation('success-sent'), 'success');
      closeSignatureModal();
      updateApprovalStatusInUI(selectedContentId, 'approved');
      disableActionsFor(selectedContentId);
    } catch (err) {
      console.error('Failed to send signature:', err);
      showToast(getTranslation('error-sending'), 'error');
    }
  });
}

// إعداد التبويبات
function setupSignatureTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      
      // إزالة الفئة النشطة من جميع التبويبات
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      // إضافة الفئة النشطة للتبويب المحدد
      btn.classList.add('active');
      document.getElementById(`${targetTab}-tab`).classList.add('active');
      
      // إعادة تعيين التوقيع الحالي
      currentSignature = null;
    });
  });
}

// إعداد رفع الصور
function setupImageUpload() {
  const uploadArea = document.getElementById('uploadArea');
  const fileInput = document.getElementById('signatureFile');
  const uploadPreview = document.getElementById('uploadPreview');
  const previewImage = document.getElementById('previewImage');
  const btnRemoveImage = document.getElementById('btnRemoveImage');
  
  // النقر على منطقة الرفع
  uploadArea.addEventListener('click', () => {
    fileInput.click();
  });
  
  // سحب وإفلات الملفات
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });
  
  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
  });
  
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  });
  
  // اختيار الملف من input
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  });
  
  // إزالة الصورة
  btnRemoveImage.addEventListener('click', () => {
    uploadPreview.style.display = 'none';
    uploadArea.style.display = 'block';
    fileInput.value = '';
    currentSignature = null;
  });
  
  function handleFileSelect(file) {
    if (!file.type.startsWith('image/')) {
      showToast(getTranslation('invalid-image') || 'يرجى اختيار ملف صورة صالح', 'error');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // تحويل الصورة إلى base64
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // تحديد أبعاد الصورة
        const maxWidth = 400;
        const maxHeight = 200;
        let { width, height } = img;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // رسم الصورة على الكانفاس
        ctx.drawImage(img, 0, 0, width, height);
        
        // تحويل إلى base64
        currentSignature = canvas.toDataURL('image/png');
        
        // عرض المعاينة
        previewImage.src = currentSignature;
        uploadArea.style.display = 'none';
        uploadPreview.style.display = 'block';
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
}

async function loadDepartments() {
  const deptSelect = document.getElementById('delegateDept');
  if (!deptSelect) return;

  try {
    const res = await fetchJSON(`${apiBase}/departments/all`);
    const departments = Array.isArray(res) ? res : (res.data || []);
    const lang = localStorage.getItem('language') || 'ar';

    deptSelect.innerHTML = `<option value="" disabled selected>${getTranslation('select-department')}</option>`;

    departments.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id;

      let deptName;
      try {
        const parsed = JSON.parse(d.name);
        deptName = parsed[lang] || parsed.ar || d.name;
      } catch {
        deptName = d.name;
      }

      opt.textContent = deptName;
      deptSelect.appendChild(opt);
    });

  } catch (err) {
    console.error('Failed to load departments:', err);
    showToast(getTranslation('error-loading'), 'error');
  }
}


document.getElementById('delegateDept').addEventListener('change', async (e) => {
  const deptId = e.target.value;
  try {
    const res = await fetch(`${apiBase}/users?departmentId=${deptId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const json = await res.json();
    const users = json.data || [];
    const userSelect = document.getElementById('delegateUser');
    userSelect.innerHTML = `<option value="" disabled selected>${getTranslation('select-user')}</option>`;

    users.forEach(user => {
      const opt = document.createElement('option');
      opt.value = user.id;
      opt.textContent = user.name;
      userSelect.appendChild(opt);
    });

  } catch (err) {
    console.error('Failed to load users:', err);
    showToast(getTranslation('error-loading'), 'error');
  }
});

// دالة لإعداد event listener للتفويض
function setupDelegationEventListener() {
  const btnDelegateConfirm = document.getElementById('btnDelegateConfirm');
  console.log('🔍 btnDelegateConfirm element found:', btnDelegateConfirm);
  if (btnDelegateConfirm) {
    console.log('🔍 Adding click event listener to btnDelegateConfirm');
    btnDelegateConfirm.addEventListener('click', async () => {
      console.log('🔍 btnDelegateConfirm clicked!');
      const userId = document.getElementById('delegateUser').value;
      const notes = document.getElementById('delegateNotes').value;
      if (!userId) return showToast(getTranslation('please-select-user'), 'warning');
      
      if (isBulkDelegation) {
        // تفويض جماعي موحد
        try {
          const response = await fetch(`${apiBase}/approvals/delegate-all-unified`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ delegateTo: userId, notes })
          });
          const result = await response.json();
          
          if (result.status === 'success') {
            const stats = result.stats || {};
            const message = `${result.message}\nملفات الأقسام: ${stats.departmentFiles || 0}\nملفات اللجان: ${stats.committeeFiles || 0}`;
            showToast(message, 'success');
          } else {
            showToast(result.message || 'حدث خطأ أثناء التفويض الجماعي', 'error');
          }
          closeModal('delegateModal');
          refreshApprovalsData();
        } catch (err) {
          console.error('Delegation error:', err);
          showToast(getTranslation('error-sending') || 'حدث خطأ أثناء التفويض الجماعي', 'error');
        }
      } else {
        // تفويض فردي - استخدام نظام بوب أب التأكيد الجديد
        console.log('🔍 Starting single delegation process...');
        console.log('🔍 selectedContentId:', selectedContentId);
        console.log('🔍 userId:', userId);
        console.log('🔍 notes:', notes);
        
        const row = document.querySelector(`tr[data-id="${selectedContentId}"]`);
        console.log('🔍 Found row:', row);
        
        if (!row) {
          console.error('🔍 Row not found for selectedContentId:', selectedContentId);
          showToast('خطأ: لم يتم العثور على الملف المحدد', 'error');
          return;
        }
        
        const contentType = row.dataset.type;
        console.log('🔍 contentType from dataset:', contentType);
        
        try {
          // إغلاق مودال التفويض الحالي
          console.log('🔍 Closing delegate modal...');
          closeModal('delegateModal');
          
          // إرسال التفويض مباشرة بدون بوب أب التأكيد
          console.log('🔍 Sending delegation directly. contentType:', contentType);
          
          const delegationData = {
            delegateTo: userId,
            notes: notes,
            contentId: selectedContentId,
            contentType: contentType,
            isCommittee: (contentType === 'committee')
          };
          
          if (contentType === 'committee') {
            // تفويض لجنة فردي
            console.log('🔍 Processing single committee delegation with:', delegationData);
            await processSingleDelegation(delegationData);
          } else {
            // تفويض قسم فردي
            console.log('🔍 Processing single department delegation with:', delegationData);
            await processSingleDelegation(delegationData);
          }
          
          showToast(getTranslation('delegation-sent') || 'تم إرسال التفويض بنجاح', 'success');
          refreshApprovalsData();
        } catch (err) {
          console.error('Failed to send delegation:', err);
          showToast(getTranslation('error-sending') || 'حدث خطأ أثناء إرسال التفويض', 'error');
        }
      }
      isBulkDelegation = false;
    });
  }
}

function disableActionsFor(contentId) {
  const row = document.querySelector(`tr[data-id="${contentId}"]`);
  if (!row) return;
  const actionsCell = row.querySelector('.col-actions');
  if (actionsCell) actionsCell.innerHTML = '';
}

function updateRecordsInfo(totalItems, startIdx, endIdx) {
  document.getElementById('startRecord').textContent = totalItems === 0 ? 0 : startIdx + 1;
  document.getElementById('endRecord').textContent   = endIdx;
  document.getElementById('totalCount').textContent  = totalItems;
}

// Popup تأكيد قبول جميع التفويضات
function showApprovalsProxyPopup() {
  // إذا لديك modal مخصص استخدمه، وإلا استخدم window.confirm
  if (window.showPopup) {
    showPopup(
      getTranslation('accept-all-proxy-confirm') || 'هل توافق على أن تصبح مفوضًا بالنيابة عن جميع الملفات المحولة لك؟',
      async () => {
        try {
          const response = await fetch(`${apiBase}/approvals/proxy/accept-all-unified`, { 
            method: 'POST', 
            headers: { 'Authorization': `Bearer ${token}` } 
          });
          const result = await response.json();
          
          if (result.status === 'success') {
            const stats = result.stats || {};
            const message = `${result.message}\nملفات الأقسام: ${stats.departmentFiles || 0}\nملفات اللجان: ${stats.committeeFiles || 0}`;
            showToast(message, 'success');
          } else {
            showToast(result.message || getTranslation('accept-all-proxy-error') || 'حدث خطأ أثناء قبول جميع التفويضات', 'error');
          }
          refreshApprovalsData();
        } catch (err) {
          console.error('Accept all delegations error:', err);
          showToast(getTranslation('accept-all-proxy-error') || 'حدث خطأ أثناء قبول جميع التفويضات', 'error');
        }
      }
    );
  } else {
    if (window.confirm(getTranslation('accept-all-proxy-confirm') || 'هل توافق على أن تصبح مفوضًا بالنيابة عن جميع الملفات المحولة لك؟')) {
      fetch(`${apiBase}/approvals/proxy/accept-all-unified`, { 
        method: 'POST', 
        headers: { 'Authorization': `Bearer ${token}` } 
      }).then(async (response) => {
        const result = await response.json();
        if (result.status === 'success') {
          const stats = result.stats || {};
          const message = `${result.message}\nملفات الأقسام: ${stats.departmentFiles || 0}\nملفات اللجان: ${stats.committeeFiles || 0}`;
          showToast(message, 'success');
        } else {
          showToast(result.message || getTranslation('accept-all-proxy-error') || 'حدث خطأ أثناء قبول جميع التفويضات', 'error');
        }
        refreshApprovalsData();
      }).catch((err) => {
        console.error('Accept all delegations error:', err);
        showToast(getTranslation('accept-all-proxy-error') || 'حدث خطأ أثناء قبول جميع التفويضات', 'error');
      });
    }
  }
}

// دالة مسح التوقيع
function clearCanvas() {
  if (ctx && canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// دالة تغيير حجم الكانفس
function resizeCanvas() {
  if (!canvas) return;
  const wrapper = canvas.parentElement;
  const rect = wrapper.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#000';
}

// دالة فتح مودال التوقيع
function openSignatureModal(contentId) {
  selectedContentId = contentId;
  const modal = document.getElementById('signatureModal');
  modal.style.display = 'flex';
  
  // إعادة تعيين التوقيع الحالي
  currentSignature = null;
  
  // إعادة تعيين التبويبات
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  tabBtns.forEach(b => b.classList.remove('active'));
  tabContents.forEach(c => c.classList.remove('active'));
  
  // تفعيل تبويب التوقيع المباشر افتراضياً
  document.querySelector('[data-tab="draw"]').classList.add('active');
  document.getElementById('draw-tab').classList.add('active');
  
  // إعادة تعيين منطقة رفع الصور
  const uploadArea = document.getElementById('uploadArea');
  const uploadPreview = document.getElementById('uploadPreview');
  if (uploadArea && uploadPreview) {
    uploadArea.style.display = 'block';
    uploadPreview.style.display = 'none';
  }
  
  setTimeout(() => {
    resizeCanvas();
    clearCanvas();
  }, 50);
}

// دالة إغلاق مودال التوقيع
function closeSignatureModal() {
  const modal = document.getElementById('signatureModal');
  if (modal) {
    // إغلاق فوري بدون تأخير
    modal.style.display = 'none';
    modal.style.opacity = '1';
    modal.style.transition = '';
    clearCanvas();
  }
}

// دالة لتحديث البيانات بدلاً من إعادة تحميل الصفحة
async function refreshApprovalsData() {
  try {
    
    const deptResp = await fetchJSON(`${apiBase}/approvals/assigned-to-me`);
    const commResp = await fetchJSON(`${apiBase}/committee-approvals/assigned-to-me`);
    const combined = [...(deptResp.data||[]), ...(commResp.data||[])];
    const uniqueMap = new Map();
    combined.forEach(item => uniqueMap.set(item.id, item));
    allItems = Array.from(uniqueMap.values());
    filteredItems = allItems;

    await setupFilters(allItems);
    renderApprovals(filteredItems);
    
  } catch (err) {
    console.error("Error refreshing approvals:", err);
    showToast(getTranslation('error-refreshing') || 'حدث خطأ أثناء تحديث البيانات', 'error');
  }
}

// تحسين الأداء باستخدام debounce للبحث
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  }
}

// تحسين دالة البحث
const debouncedApplyFilters = debounce(applyFilters, 300);

// تحديث event listener للبحث
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', debouncedApplyFilters);
  }
  
  // إعداد event listener للتفويض
  setupDelegationEventListener();
});

// تحسين الأداء - تخزين مؤقت للعناصر المستخدمة بكثرة

// دالة محسنة للحصول على العناصر مع التخزين المؤقت
function getCachedElement(id) {
  if (!elementCache.has(id)) {
    elementCache.set(id, document.getElementById(id));
  }
  return elementCache.get(id);
}

// دالة محسنة لإغلاق المودال
function closeModal(modalId) {
  const modal = getCachedElement(modalId);
  if (modal) {
    // إغلاق فوري بدون تأخير
    modal.style.display = 'none';
    modal.style.opacity = '1';
    modal.style.transition = '';
    
    // تنظيف الذاكرة المؤقتة
    modalCache.delete(modalId);
  }
}

// دالة محسنة لفتح المودال
function openModal(modalId) {
  console.log('🔍 openModal called with modalId:', modalId);
  const modal = getCachedElement(modalId);
  console.log('🔍 Modal element found:', modal);
  if (modal) {
    // فتح فوري بدون تأخير
    modal.style.display = 'flex';
    modal.style.opacity = '1';
    modal.style.transition = '';
    
    // تخزين في الذاكرة المؤقتة
    modalCache.set(modalId, modal);
    console.log('🔍 Modal opened successfully');
  } else {
    console.error('🔍 Modal not found:', modalId);
  }
}

// تحسين الأداء - إضافة throttling للعمليات الثقيلة
function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }
}

// تحسين دالة renderApprovals مع throttling
const throttledRenderApprovals = throttle(renderApprovals, 100);

function authHeaders() {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}


// دالة معالجة التفويض الفردي
async function processSingleDelegation(data) {
  try {
    const endpoint = data.isCommittee ? 'http://localhost:3006/api/committee-approvals/committee-delegations/single' : 'http://localhost:3006/api/approvals/delegate-single';
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify({
        delegateTo: data.delegateTo,
        notes: data.notes,
        contentId: data.contentId,
        contentType: data.contentType
      })
    });
    
    const result = await response.json();
    
    if (result.status === 'success') {
      showToast('تم إرسال طلب التفويض بنجاح', 'success');
      // تحديث الصفحة أو إعادة تحميل البيانات
      setTimeout(() => {
        if (typeof refreshApprovalsData === 'function') {
          refreshApprovalsData();
        } else {
          window.location.reload();
        }
      }, 1500);
    } else {
      showToast(result.message || 'فشل إرسال طلب التفويض', 'error');
    }
  } catch (error) {
    console.error('Error processing single delegation:', error);
    showToast('خطأ في إرسال طلب التفويض', 'error');
  }
}

// دالة معالجة التفويض الشامل
async function processBulkDelegation(data) {
  try {
    const endpoint = data.isCommittee ? 'http://localhost:3006/api/committee-approvals/committee-delegations/bulk' : 'http://localhost:3006/api/approvals/delegate-all-unified';
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify({
        delegateTo: data.delegateTo,
        notes: data.notes
      })
    });
    
    const result = await response.json();
    
    if (result.status === 'success') {
      const message = data.isCommittee ? 'تم إرسال طلب التفويض الشامل للجان بنجاح' : 'تم إرسال طلب التفويض الشامل بنجاح';
      showToast(message, 'success');
      // تحديث الصفحة أو إعادة تحميل البيانات
      setTimeout(() => {
        if (typeof refreshApprovalsData === 'function') {
          refreshApprovalsData();
        } else {
          window.location.reload();
        }
      }, 1500);
    } else {
      showToast(result.message || 'فشل إرسال طلب التفويض الشامل', 'error');
    }
  } catch (error) {
    console.error('Error processing bulk delegation:', error);
    showToast('خطأ في إرسال طلب التفويض الشامل', 'error');
  }
}