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
  const mainContent = document.querySelector('.cards-container');
  if (mainContent) {
    mainContent.dir = lang === 'ar' ? 'rtl' : 'ltr';
    mainContent.style.textAlign = lang === 'ar' ? 'right' : 'left';
  }

  // Update cards direction
  document.querySelectorAll('.approval-card').forEach(card => {
    card.dir = lang === 'ar' ? 'rtl' : 'ltr';
  });

  // Update approval items direction
  document.querySelectorAll('.approval-item').forEach(item => {
    item.dir = lang === 'ar' ? 'rtl' : 'ltr';
  });

  // Update dropdowns direction
  document.querySelectorAll('.dropdown-custom').forEach(dropdown => {
    dropdown.dir = lang === 'ar' ? 'rtl' : 'ltr';
  });

  // Update search inputs direction
  document.querySelectorAll('.dropdown-search').forEach(input => {
    input.dir = lang === 'ar' ? 'rtl' : 'ltr';
  });

  // Update buttons direction
  document.querySelectorAll('.btn-send, .btn-view, .btn-deadline').forEach(btn => {
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

  // تجهيز البيانات لكل نوع
  const departments = (departmentApprovals || []).map(item => ({ ...item, type: 'department' }));
  const committees = (committeeApprovals || []).map(item => ({ ...item, type: 'committee' }));
  const protocols = (protocolApprovals || []).map(item => {
    let approversReq = item.approvers_required;
    try {
      if (typeof approversReq === 'string') {
        approversReq = JSON.parse(approversReq || '[]');
      }
    } catch { approversReq = []; }
    return { ...item, type: 'protocol', approvers_required: approversReq };
  });

  // تحديث العدادات
  document.getElementById('departmentCount').textContent = departments.length;
  document.getElementById('committeeCount').textContent = committees.length;
  document.getElementById('protocolCount').textContent = protocols.length;

  // تحديد المستخدم الحالي
  const token = localStorage.getItem('token');
  const decodedToken = token ? await safeGetUserInfo(token) : null;
  const currentUserId = decodedToken ? decodedToken.id : null;

  // تحميل البيانات في كل بطاقة
  loadCardItems('departmentItems', departments, currentUserId);
  loadCardItems('committeeItems', committees, currentUserId);
  loadCardItems('protocolItems', protocols, currentUserId);
}

function loadCardItems(containerId, items, currentUserId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';

  if (items.length === 0) {
    container.innerHTML = `
      <div class="no-items-message">
        <i class="fas fa-inbox"></i>
        <p>${getTranslation('no-pending-approvals') || 'لا توجد ملفات بانتظار الاعتماد'}</p>
      </div>
    `;
    return;
  }

  // ترتيب العناصر حسب المستخدم المسئول
  const sortedItems = items.sort((a, b) => {
    const aApprovers = Array.isArray(a.approvers_required) 
      ? a.approvers_required 
      : (a.approvers_required ? JSON.parse(a.approvers_required) : []);
    const bApprovers = Array.isArray(b.approvers_required) 
      ? b.approvers_required 
      : (b.approvers_required ? JSON.parse(b.approvers_required) : []);

    const aIsAssigned = currentUserId && aApprovers.includes(currentUserId);
    const bIsAssigned = currentUserId && bApprovers.includes(currentUserId);

    if (aIsAssigned && !bIsAssigned) return -1;
    if (!aIsAssigned && bIsAssigned) return 1;

    return new Date(b.created_at) - new Date(a.created_at);
  });

  sortedItems.forEach(item => {
    const approvalItem = createApprovalItem(item);
    container.appendChild(approvalItem);
  });
}

function createApprovalItem(item) {
  // إعداد الأسماء المعينة
    const assignedNamesRaw = item.assigned_approvers || item.assignedApprovers || '';
    const assignedApproverNames = assignedNamesRaw
      ? assignedNamesRaw.split(',').map(a => a.trim()).filter(Boolean)
      : [];
    const hasApprovers = assignedApproverNames.length > 0;

  // إعداد المعتمدين المطلوبين
  const assignedApproverIds = Array.isArray(item.approvers_required)
    ? item.approvers_required
    : JSON.parse(item.approvers_required || '[]');

  // إعداد badges المعتمدين
    const approverBadges = assignedApproverNames
      .map((name, index) => {
      const sequenceNumber = index + 1;
        const isFirst = sequenceNumber === 1;
        const badgeColor = isFirst ? '#28a745' : '#6c757d';
        
        // إضافة الأرقام للأقسام فقط، بدون أرقام للجان والمحاضر
        const displayText = item.type === 'department' 
          ? `${sequenceNumber}. ${name}` 
          : name;
        
      return `<span class="badge removable-badge" style="background-color: ${badgeColor}; color: white;" data-sequence="${sequenceNumber}" data-approver-name="${name}">
        ${displayText}
        <button class="remove-approver-btn" data-approver-name="${name}" title="${getTranslation('remove-approver') || 'حذف المعتمد'}">
          <i class="fas fa-times"></i>
        </button>
      </span>`;
      })
      .join('');

  // تحديد نوع المحتوى
    const contentType = item.type === 'committee'
      ? getTranslation('committee-file')
      : item.type === 'protocol'
      ? getTranslation('protocol-file') || 'محضر'
      : getTranslation('department-report');

  // إنشاء العنصر
  const approvalItem = document.createElement('div');
  approvalItem.className = 'approval-item';
  approvalItem.dataset.id = item.id;
  approvalItem.dataset.type = item.type;
  approvalItem.dataset.assignedNames = JSON.stringify(assignedApproverNames);
  approvalItem.dataset.assignedIds = JSON.stringify(assignedApproverIds);

  approvalItem.innerHTML = `
    <div class="item-header">
      <div class="item-title">
        <h3>${parseLocalizedName(item.title)}</h3>
        <div class="item-meta">${contentType} - ${parseLocalizedName(item.source_name)}</div>
      </div>
      <div class="item-status">
        <span class="status-badge ${hasApprovers ? 'badge-sent' : 'badge-pending'}">
          ${hasApprovers ? getTranslation('sent') : getTranslation('waiting-send')}
        </span>
      </div>
    </div>
    
    <div class="item-content">
      ${hasApprovers ? `
        <div class="selected-approvers" style="margin-bottom: 12px;">
          ${approverBadges}
        </div>
      ` : ''}
      
      ${item.type === 'department' ? `
        <div class="department-transfer-note" style="margin-bottom: 8px;">
          <span style="font-size: 11px; color: #6c757d; background: #f8f9fa; padding: 4px 8px; border-radius: 4px; border: 1px solid #e9ecef; display: inline-block;">
            💡 ${getTranslation('internal-first-external-second') || 'داخلي أولاً، ثم خارجي'}
          </span>
        </div>
      ` : ''}
      
      <div class="approval-controls" style="display: flex; gap: 12px; flex-wrap: wrap;">
        <div class="dropdown-group" style="flex: 1; min-width: 180px;">
          <label class="dropdown-label" style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151; font-size: 0.9rem;">
            📋 ${getTranslation('select-department') || 'اختر القسم'}
          </label>
          <div class="dropdown-custom" data-type="dept">
            <button class="dropdown-btn">${getTranslation('select-department')}</button>
            <div class="dropdown-content">
              <input type="text" class="dropdown-search" placeholder="${getTranslation('search-department')}">
            </div>
          </div>
        </div>
        <div class="dropdown-group" style="flex: 1; min-width: 180px;">
          <label class="dropdown-label" style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151; font-size: 0.9rem;">
            👥 ${getTranslation('select-people') || 'اختر الأشخاص'}
          </label>
          <div class="dropdown-custom" data-type="users">
            <button class="dropdown-btn" disabled>${getTranslation('select-department-first')}</button>
            <div class="dropdown-content">
              <input class="dropdown-search" placeholder="${getTranslation('search-person')}">
            </div>
          </div>
        </div>
      </div>
      
      ${!hasApprovers ? `
        <div class="selected-approvers">
          ${approverBadges}
        </div>
      ` : ''}
    </div>
    
    <div class="item-actions" style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 12px;">
      <button class="btn-send" style="flex: 1; min-width: 120px;">
          <i class="bi ${hasApprovers ? 'bi-plus-circle' : 'bi-send'}"></i>
          ${hasApprovers ? getTranslation('add-more') : getTranslation('send')}
        ${item.type === 'department' ? `<br><small style="font-size: 9px; opacity: 0.7;">(${getTranslation('sequential')})</small>` : ''}
        </button>
        <button class="btn-deadline" data-content-id="${item.id}" data-content-type="${item.type}" data-content-title="${item.title}" data-source-name="${item.source_name || ''}" title="${getTranslation('set-deadline')}" style="flex: 0 0 auto;">
           <i class="bi bi-clock"></i>
         </button>
        ${item.file_path
        ? `<button class="btn-view" data-file-path="${item.file_path}" style="flex: 0 0 auto;">
               <i class="bi bi-eye"></i>
             </button>`
          : ''}
    </div>
  `;

  // إضافة event listeners للأزرار
  addItemEventListeners(approvalItem, item);

  return approvalItem;
}

function addItemEventListeners(approvalItem, item) {
  // زر العرض
  const viewButton = approvalItem.querySelector('.btn-view');
    if (viewButton) {
      viewButton.addEventListener('click', async e => {
        e.stopPropagation();
      await handleViewFile(item);
    });
  }

  // زر تحديد الموعد النهائي
  const deadlineButton = approvalItem.querySelector('.btn-deadline');
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

  // أزرار حذف المعتمدين
  const removeButtons = approvalItem.querySelectorAll('.remove-approver-btn');
  removeButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      
      const approverName = btn.dataset.approverName;
      const contentId = approvalItem.dataset.id;
      const contentType = approvalItem.dataset.type;
      
      // التحقق من حالة الإرسال
      const statusBadge = approvalItem.querySelector('.status-badge');
      const isSent = statusBadge && statusBadge.classList.contains('badge-sent');
      
      if (isSent) {
        // إذا تم الإرسال: طلب تأكيد
        const confirmMessage = getTranslation('confirm-remove-approver') || 
          `هل أنت متأكد من حذف "${approverName}" من قائمة المعتمدين؟`;
        
        if (!confirm(confirmMessage)) {
          return; // إلغاء العملية
        }
      }
      
      // تنفيذ الحذف (مع أو بدون تأكيد حسب الحالة)
      await handleRemoveApprover(approvalItem, approverName, contentId, contentType, isSent);
    });
  });

  // زر الإرسال - سيتم إعداده في initDropdowns
}

async function handleViewFile(item) {
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
        }

  // عرض الملف
        if (!item || !item.file_path) {
          showToast(getTranslation('file-link-unavailable'), 'error');
          return;
        }
        
        let filePath = item.file_path;
        const baseApiUrl = apiBase.replace('/api', '');
        let fileBaseUrl;

        if (filePath.startsWith('backend/uploads/')) {
          fileBaseUrl = `${baseApiUrl}/backend/uploads`;
          filePath = filePath.replace(/^backend\/uploads\//, '');
  } else if (filePath.startsWith('uploads/')) {
          fileBaseUrl = `${baseApiUrl}/uploads`;
          filePath = filePath.replace(/^uploads\//, '');
  } else {
          fileBaseUrl = `${baseApiUrl}/uploads`;
        }

        const url = `${fileBaseUrl}/${filePath}`;
                 window.open(url, '_blank');
}

async function handleRemoveApprover(approvalItem, approverName, contentId, contentType, isSent = false) {
  try {
    // 1) جلب البيانات الحالية
    const existingAssignedNames = JSON.parse(approvalItem.dataset.assignedNames || '[]');
    const existingIds = JSON.parse(approvalItem.dataset.assignedIds || '[]');
    
    // 2) العثور على فهرس المعتمد المراد حذفه
    const approverIndex = existingAssignedNames.indexOf(approverName);
    if (approverIndex === -1) {
      showToast('المعتمد غير موجود في القائمة', 'error');
      return;
    }
    
    // 3) إزالة المعتمد من القوائم
    const updatedNames = existingAssignedNames.filter((_, index) => index !== approverIndex);
    const updatedIds = existingIds.filter((_, index) => index !== approverIndex);
    const removedUserId = existingIds[approverIndex];
    
    // 4) إذا لم يتم الإرسال بعد، حذف من الواجهة فقط
    if (!isSent) {
      // حذف مباشر من الواجهة بدون استدعاء الخادم
      updateApprovalItemUI(approvalItem, updatedNames, updatedIds);
      approvalItem.dataset.assignedNames = JSON.stringify(updatedNames);
      approvalItem.dataset.assignedIds = JSON.stringify(updatedIds);
      
      showToast('تم حذف المعتمد من القائمة', 'success');
      return; // انتهاء العملية هنا
    }
    
    // 5) إذا تم الإرسال، إرسال طلب الحذف للخادم
    let endpoint;
    let requestBody;
    
    if (contentType === 'protocol') {
      // للمحاضر: حذف المعتمد من الجدول وإعادة ترقيم التسلسل
      endpoint = `${apiBase}/protocols/${contentId}/approvers/${removedUserId}`;
      await fetchJSON(endpoint, { method: 'DELETE' });
      
      // إعادة ترقيم المعتمدين المتبقيين
      if (updatedIds.length > 0) {
        await Promise.all(
          updatedIds.map((userId, index) =>
            fetchJSON(`${apiBase}/protocols/${contentId}/approvers/${userId}/sequence`, {
              method: 'PUT',
              body: JSON.stringify({ sequenceNumber: index + 1 })
            })
          )
        );
      }
    } else {
      // للأقسام واللجان: تحديث قائمة المعتمدين
      endpoint = contentType === 'committee' 
        ? `${apiBase}/pending-committee-approvals/update-approvers`
        : `${apiBase}/pending-approvals/update-approvers`;
      
      requestBody = {
        contentId: contentId,
        approvers: updatedIds
      };
      
      await fetchJSON(endpoint, {
        method: 'PUT',
        body: JSON.stringify(requestBody)
      });
    }
    
    // 6) تحديث الواجهة
    updateApprovalItemUI(approvalItem, updatedNames, updatedIds);
    
    // 7) تحديث البيانات المحفوظة
    approvalItem.dataset.assignedNames = JSON.stringify(updatedNames);
    approvalItem.dataset.assignedIds = JSON.stringify(updatedIds);
    
    showToast(getTranslation('approver-removed-success') || 'تم حذف المعتمد بنجاح', 'success');
    
    // 8) إعادة تحميل البيانات للتأكد من التحديث (فقط للمرسل)
    await loadPendingApprovals();
    await initDropdowns();
    
  } catch (error) {
    console.error('Error removing approver:', error);
    showToast(getTranslation('remove-approver-failed') || 'فشل في حذف المعتمد', 'error');
  }
}

function updateApprovalItemUI(approvalItem, updatedNames, updatedIds) {
  const selectedApproversDiv = approvalItem.querySelector('.selected-approvers');
  if (!selectedApproversDiv) return;
  
  // إعادة بناء badges المعتمدين
  selectedApproversDiv.innerHTML = '';
  
  if (updatedNames.length === 0) {
    // لا يوجد معتمدين
    const statusBadge = approvalItem.querySelector('.status-badge');
    if (statusBadge) {
      statusBadge.textContent = getTranslation('waiting-send') || 'بانتظار الإرسال';
      statusBadge.className = 'status-badge badge-pending';
    }
    
    const sendBtn = approvalItem.querySelector('.btn-send');
    if (sendBtn) {
      const contentType = approvalItem.dataset.type;
      const sequentialText = contentType === 'department' 
        ? `<span style="font-size: 10px; margin-right: 4px; opacity: 0.8;">(${getTranslation('sequential') || 'تسلسلي'})</span>`
        : '';
      
      sendBtn.innerHTML = `
        <i class="bi bi-send"></i>
        ${getTranslation('send') || 'إرسال'}
        ${sequentialText}
      `;
    }
  } else {
    // إعادة بناء badges
    updatedNames.forEach((name, index) => {
      const sequenceNumber = index + 1;
      const isFirst = sequenceNumber === 1;
      const badgeColor = isFirst ? '#28a745' : '#6c757d';
      
      const badge = document.createElement('span');
      badge.className = 'badge removable-badge';
      badge.style.backgroundColor = badgeColor;
      badge.style.color = 'white';
      badge.dataset.sequence = sequenceNumber;
      badge.dataset.approverName = name;
      
      // إضافة الأرقام للأقسام فقط، بدون أرقام للجان والمحاضر
      const contentType = approvalItem.dataset.type;
      const displayText = contentType === 'department' 
        ? `${sequenceNumber}. ${name}` 
        : name;
      
      badge.innerHTML = `
        ${displayText}
        <button class="remove-approver-btn" data-approver-name="${name}" title="${getTranslation('remove-approver') || 'حذف المعتمد'}">
          <i class="fas fa-times"></i>
        </button>
      `;
      
      selectedApproversDiv.appendChild(badge);
    });
    
    // تحديث حالة الإرسال
    const statusBadge = approvalItem.querySelector('.status-badge');
    if (statusBadge) {
      statusBadge.textContent = getTranslation('sent') || 'تم الإرسال';
      statusBadge.className = 'status-badge badge-sent';
    }
    
    const sendBtn = approvalItem.querySelector('.btn-send');
    if (sendBtn) {
      const contentType = approvalItem.dataset.type;
      const sequentialText = contentType === 'department' 
        ? `<span style="font-size: 10px; margin-right: 4px; opacity: 0.8;">(${getTranslation('sequential') || 'تسلسلي'})</span>`
        : '';
        
      sendBtn.innerHTML = `
        <i class="bi bi-plus-circle"></i>
        ${getTranslation('add-more') || 'إضافة المزيد'}
        ${sequentialText}
      `;
    }
  }
  
  // إعادة ربط event listeners لأزرار الحذف الجديدة
  const newRemoveButtons = selectedApproversDiv.querySelectorAll('.remove-approver-btn');
  newRemoveButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      
      const approverName = btn.dataset.approverName;
      const contentId = approvalItem.dataset.id;
      const contentType = approvalItem.dataset.type;
      
      // التحقق من حالة الإرسال
      const statusBadge = approvalItem.querySelector('.status-badge');
      const isSent = statusBadge && statusBadge.classList.contains('badge-sent');
      
      if (isSent) {
        // إذا تم الإرسال: طلب تأكيد
        const confirmMessage = getTranslation('confirm-remove-approver') || 
          `هل أنت متأكد من حذف "${approverName}" من قائمة المعتمدين؟`;
        
        if (!confirm(confirmMessage)) {
          return; // إلغاء العملية
        }
      }
      
      // تنفيذ الحذف (مع أو بدون تأكيد حسب الحالة)
      await handleRemoveApprover(approvalItem, approverName, contentId, contentType, isSent);
    });
   });
 }

async function initDropdowns() {
  const departments = await fetchJSON(`${apiBase}/departments/all`);
  document.querySelectorAll('.approval-item').forEach(approvalItem => {
    const deptDrop = approvalItem.querySelector('[data-type=dept]');
    const userDrop = approvalItem.querySelector('[data-type=users]');
    const sendBtn  = approvalItem.querySelector('.btn-send');

    if (!sendBtn) return;
    let selectedDepts = [];
    let selectedUsers = [];
    let selectionCounter = 0; // عداد لترتيب الاختيار
    const contentType = approvalItem.dataset.type;

    const deptBtn  = deptDrop.querySelector('.dropdown-btn');
    const deptList = deptDrop.querySelector('.dropdown-content');
    deptList.innerHTML = `<input type="text" class="dropdown-search" placeholder="${getTranslation('search-department')}">`;
    
    // للأقسام: ترتيب الأقسام بحسب نوع التحويل
    if (contentType === 'department') {
      // الحصول على القسم الحالي للملف
      const currentDepartmentName = approvalItem.querySelector('.item-meta')?.textContent?.split(' - ')[1] || '';
      
      // تقسيم الأقسام: نفس القسم أولاً، ثم الباقي
      const sameDepartments = departments.filter(d => {
        const lang = localStorage.getItem('language') || 'ar';
        try {
          const parsed = typeof d.name === 'string' ? JSON.parse(d.name) : d.name;
          const name = parsed[lang] || parsed.ar || parsed.en || '';
          return name === currentDepartmentName;
        } catch {
          return d.name === currentDepartmentName;
        }
      });
      
      const otherDepartments = departments.filter(d => {
        const lang = localStorage.getItem('language') || 'ar';
        try {
          const parsed = typeof d.name === 'string' ? JSON.parse(d.name) : d.name;
          const name = parsed[lang] || parsed.ar || parsed.en || '';
          return name !== currentDepartmentName;
        } catch {
          return d.name !== currentDepartmentName;
        }
      });
      
      // إضافة قسم "التحويل الداخلي" إذا كان هناك نفس القسم
      if (sameDepartments.length > 0) {
        const internalHeader = document.createElement('div');
        internalHeader.className = 'dropdown-header';
        internalHeader.style.cssText = 'padding: 6px 10px; background: #e8f5e8; color: #155724; font-weight: bold; font-size: 10px; text-transform: uppercase;';
        internalHeader.innerHTML = `🏢 ${getTranslation('internal-transfer') || 'داخلي'}`;
        deptList.appendChild(internalHeader);
        
        sameDepartments.forEach(d => {
          const itm = document.createElement('div');
          itm.className = 'dropdown-item internal-dept';
          itm.dataset.value = d.id;
          itm.dataset.transferType = 'internal';
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
      }
      
      // إضافة قسم "التحويل الخارجي"
      if (otherDepartments.length > 0) {
        const externalHeader = document.createElement('div');
        externalHeader.className = 'dropdown-header';
        externalHeader.style.cssText = 'padding: 6px 10px; background: #fff3cd; color: #856404; font-weight: bold; font-size: 10px; text-transform: uppercase; margin-top: 3px;';
        externalHeader.innerHTML = `🔄 ${getTranslation('external-transfer') || 'خارجي'}`;
        deptList.appendChild(externalHeader);
        
        otherDepartments.forEach(d => {
          const itm = document.createElement('div');
          itm.className = 'dropdown-item external-dept';
          itm.dataset.value = d.id;
          itm.dataset.transferType = 'external';
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
      }
    } else {
      // للجان والمحاضر: عرض عادي
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
    }

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
                              .map(i => ({ 
                                id: i.dataset.value, 
                                name: i.textContent.replace(/[🏢🔄]/g, '').trim(), // إزالة الأيقونات
                                transferType: i.dataset.transferType || 'external'
                              }));
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
      const existingAssignedNames = JSON.parse(approvalItem.dataset.assignedNames || '[]');

      if (!selectedDepts.length) {
        uBtn.disabled = true;
        uBtn.textContent = getTranslation('select-department-first');
        return;
      }

      uBtn.disabled = false;
      uBtn.textContent = selectedUsers.length ? `${selectedUsers.length} ${getTranslation('selected-count')}` : getTranslation('select-people');
      
      // إعادة بناء القائمة المعروضة للمعتمدين المختارين
      const selCell = approvalItem.querySelector('.selected-approvers');
      if (selCell && selectedUsers.length > 0) {
        selCell.innerHTML = '';
        
        // ترتيب المعتمدين حسب وقت الاختيار
        const sortedUsers = selectedUsers.sort((a, b) => a.selectedAt - b.selectedAt);
        
        // إعادة تعيين العداد ليكون أكبر من أكبر قيمة موجودة
        const maxSelectedAt = Math.max(...selectedUsers.map(u => u.selectedAt || 0));
        selectionCounter = maxSelectedAt;
        
        sortedUsers.forEach((u, index) => {
          const badge = document.createElement('span');
          badge.className = 'badge removable-badge';
          badge.dataset.sequence = index + 1;
          badge.dataset.approverName = u.name;
          
          const lang = localStorage.getItem('language') || 'ar';
          const dept = selectedDepts.find(d => d.id === u.deptId);
          let deptName = dept?.name || '';

          try {
            const parsed = typeof deptName === 'string' ? JSON.parse(deptName) : deptName;
            deptName = parsed?.[lang] || parsed?.ar || parsed?.en || '';
          } catch {}

          // إضافة الأرقام للأقسام فقط، بدون أرقام للجان والمحاضر
          const contentType = approvalItem.dataset.type;
          const displayText = contentType === 'department' 
            ? `${index + 1}. ${u.name} (${deptName})` 
            : `${u.name} (${deptName})`;

          badge.innerHTML = `
            ${displayText}
            <button class="remove-approver-btn" data-approver-name="${u.name}" title="${getTranslation('remove-approver') || 'حذف المعتمد'}">
              <i class="fas fa-times"></i>
            </button>
          `;
          
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
        
        // إضافة event listeners لأزرار الحذف
        const removeButtons = selCell.querySelectorAll('.remove-approver-btn');
        removeButtons.forEach(btn => {
          btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            const approverName = btn.dataset.approverName;
            const contentId = approvalItem.dataset.id;
            const contentType = approvalItem.dataset.type;
            
            // التحقق من حالة الإرسال
            const statusBadge = approvalItem.querySelector('.status-badge');
            const isSent = statusBadge && statusBadge.classList.contains('badge-sent');
            
            if (isSent) {
              // إذا تم الإرسال: طلب تأكيد
              const confirmMessage = getTranslation('confirm-remove-approver') || 
                `هل أنت متأكد من حذف "${approverName}" من قائمة المعتمدين؟`;
              
              if (!confirm(confirmMessage)) {
                return; // إلغاء العملية
              }
            }
            
            // تنفيذ الحذف (مع أو بدون تأكيد حسب الحالة)
            await handleRemoveApprover(approvalItem, approverName, contentId, contentType, isSent);
          });
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
          
          // للأقسام: إضافة مؤشر مبسط للتحويل الداخلي/الخارجي
          if (contentType === 'department') {
            const transferType = dept.transferType || 'external';
            const icon = transferType === 'internal' ? '🏢' : '🔄';
            item.innerHTML = `${icon} ${u.name}`;
          } else {
            item.textContent = u.name;
          }
          
          item.dataset.deptId = dept.id;
          item.dataset.userId = u.id;
          item.dataset.transferType = dept.transferType || 'external';
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
          // إضافة المعتمد مع حفظ ترتيب الاختيار ونوع التحويل
          selectionCounter++;
          const transferType = item.dataset.transferType || 'external';
          selectedUsers.push({ 
            id: userId, 
            name, 
            deptId, 
            selectedAt: selectionCounter,
            transferType: transferType
          });
        } else {
          // إزالة المعتمد
          selectedUsers = selectedUsers.filter(x => x.id !== userId);
        }

        btn.textContent = selectedUsers.length ? `${selectedUsers.length} ${getTranslation('selected-count')}` : getTranslation('select-people');

        const selCell = approvalItem.querySelector('.selected-approvers');
        selCell.innerHTML = '';
        
        // ترتيب المعتمدين حسب وقت الاختيار
        const sortedUsers = selectedUsers.sort((a, b) => a.selectedAt - b.selectedAt);
        
        sortedUsers.forEach((u, index) => {
          const badge = document.createElement('span');
          badge.className = 'badge removable-badge';
          badge.dataset.sequence = index + 1;
          badge.dataset.approverName = u.name;
          
          const lang = localStorage.getItem('language') || 'ar';
          const dept = selectedDepts.find(d => d.id === u.deptId);
          let deptName = dept?.name || '';

          try {
            const parsed = typeof deptName === 'string' ? JSON.parse(deptName) : deptName;
            deptName = parsed?.[lang] || parsed?.ar || parsed?.en || '';
          } catch {}

          // إضافة الأرقام للأقسام فقط، بدون أرقام للجان والمحاضر
          const contentType = approvalItem.dataset.type;
          const displayText = contentType === 'department' 
            ? `${index + 1}. ${u.name} (${deptName})` 
            : `${u.name} (${deptName})`;

          badge.innerHTML = `
            ${displayText}
            <button class="remove-approver-btn" data-approver-name="${u.name}" title="${getTranslation('remove-approver') || 'حذف المعتمد'}">
              <i class="fas fa-times"></i>
            </button>
          `;
          
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
        
        // إضافة event listeners لأزرار الحذف
        const removeButtons = selCell.querySelectorAll('.remove-approver-btn');
        removeButtons.forEach(btn => {
          btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            const approverName = btn.dataset.approverName;
            const contentId = approvalItem.dataset.id;
            const contentType = approvalItem.dataset.type;
            
            // التحقق من حالة الإرسال
            const statusBadge = approvalItem.querySelector('.status-badge');
            const isSent = statusBadge && statusBadge.classList.contains('badge-sent');
            
            if (isSent) {
              // إذا تم الإرسال: طلب تأكيد
              const confirmMessage = getTranslation('confirm-remove-approver') || 
                `هل أنت متأكد من حذف "${approverName}" من قائمة المعتمدين؟`;
              
              if (!confirm(confirmMessage)) {
                return; // إلغاء العملية
              }
            }
            
            // تنفيذ الحذف (مع أو بدون تأكيد حسب الحالة)
            await handleRemoveApprover(approvalItem, approverName, contentId, contentType, isSent);
          });
        });
      });
    })();

    // داخل initDropdowns، بعد ربط الـ dropdowns وأيقونة Send
    sendBtn.addEventListener('click', async () => {
      // تحقق من وجود approvalItem قبل المتابعة
      if (!approvalItem) {
        showToast('حدث خطأ: لم يتم العثور على العنصر.', 'error');
        return;
      }
      
      // تعطيل الزر فوراً لمنع النقرات المتعددة
      sendBtn.disabled = true;
      
      // 1) أقرأ الأسماء المخزّنة حالياً
      const existingAssignedNames = approvalItem.dataset.assignedNames
        ? JSON.parse(approvalItem.dataset.assignedNames)
        : [];
      const existingIds = approvalItem.dataset.assignedIds
        ? JSON.parse(approvalItem.dataset.assignedIds)
        : [];

      // 2) جلب اللي اختارهم المستخدم
      const userItems = approvalItem.querySelectorAll('[data-type="users"] .dropdown-item.selected');
      const newUsers  = Array.from(userItems)
        .map(el => ({ id: +el.dataset.userId, name: el.textContent.trim() }))
        .filter(u => !existingAssignedNames.includes(u.name));

      if (!newUsers.length) {
        sendBtn.disabled = false;
        return alert(getTranslation('no-new-approvers'));
      }

      // 3) جلب الترتيب من الواجهة المعروضة حالياً
      const selCell = approvalItem.querySelector('.selected-approvers');
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
      
      // ترتيب المعتمدين الجدد
      let sortedNewUsers;
      if (displayedBadges.length === 0) {
        // للأقسام: ترتيب بحسب نوع التحويل أولاً (داخلي ثم خارجي)، ثم بحسب وقت الاختيار
        if (contentType === 'department') {
          sortedNewUsers = newUsers.sort((a, b) => {
            const aSelected = selectedUsers.find(u => u.id === a.id);
            const bSelected = selectedUsers.find(u => u.id === b.id);
            const aTransferType = aSelected?.transferType || 'external';
            const bTransferType = bSelected?.transferType || 'external';
            
            // أولوية للتحويل الداخلي
            if (aTransferType === 'internal' && bTransferType === 'external') return -1;
            if (aTransferType === 'external' && bTransferType === 'internal') return 1;
            
            // إذا كان نفس النوع، ترتيب بحسب وقت الاختيار
            return (aSelected?.selectedAt || 0) - (bSelected?.selectedAt || 0);
          });
        } else {
          // للجان والمحاضر: ترتيب عادي بحسب وقت الاختيار
          sortedNewUsers = newUsers.sort((a, b) => {
            const aSelected = selectedUsers.find(u => u.id === a.id);
            const bSelected = selectedUsers.find(u => u.id === b.id);
            return (aSelected?.selectedAt || 0) - (bSelected?.selectedAt || 0);
          });
        }
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
      const contentId = approvalItem.dataset.id;
      const isProtocol = approvalItem.dataset.type === 'protocol';
      const endpoint  = approvalItem.dataset.type === 'committee'
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
          const selCell = approvalItem.querySelector('.selected-approvers');
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
            
            // إضافة الأرقام للأقسام فقط، بدون أرقام للجان والمحاضر
            const contentType = approvalItem.dataset.type;
            
            // تحقق إذا كان هذا المستخدم مفوض له
            const isNewUser = sortedNewUsers.some(u => u.name === name);
            if (isNewUser) {
              const newUser = sortedNewUsers.find(u => u.name === name);
              try {
                const delegationResponse = await fetchJSON(`${apiBase}/users/${newUser.id}/delegation-status`);
                if (delegationResponse && delegationResponse.delegated_by) {
                  // هذا مفوض له، أضف إشارة
                  const displayText = contentType === 'department' 
                    ? `${sequenceNumber}. ${name} (مفوض له)` 
                    : `${name} (مفوض له)`;
                  badge.textContent = displayText;
                  badge.style.backgroundColor = '#ff6b6b'; // لون مختلف للمفوض له
                } else {
                  const displayText = contentType === 'department' 
                    ? `${sequenceNumber}. ${name}` 
                    : name;
                  badge.textContent = displayText;
                  // لون حسب الترتيب
                  if (sequenceNumber === 1) {
                    badge.style.backgroundColor = '#28a745'; // أخضر للمعتمد الأول
                  } else {
                    badge.style.backgroundColor = '#6c757d'; // رمادي للمعتمدين الآخرين
                  }
                }
              } catch (err) {
                // إذا فشل التحقق، استخدم الاسم العادي
                const displayText = contentType === 'department' 
                  ? `${sequenceNumber}. ${name}` 
                  : name;
                badge.textContent = displayText;
                if (sequenceNumber === 1) {
                  badge.style.backgroundColor = '#28a745';
                } else {
                  badge.style.backgroundColor = '#6c757d';
                }
              }
            } else {
              // معتمد قديم
              const displayText = contentType === 'department' 
                ? `${sequenceNumber}. ${name}` 
                : name;
              badge.textContent = displayText;
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
          approvalItem.dataset.assignedNames = JSON.stringify(allNames);
          approvalItem.dataset.assignedIds   = JSON.stringify(allIds);

          showToast(getTranslation('add-more-success'), 'success');

          // 7) أعد تحميل الـ البيانات
          await loadPendingApprovals();
          await initDropdowns();
        } else {
          showToast(getTranslation('send-failed'), 'error');
          sendBtn.disabled = false;
        }
      } catch (err) {
        console.error('فشل الإرسال:', err);
        showToast(getTranslation('send-failed'), 'error');
        sendBtn.disabled = false;
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
    let approvalItem = document.querySelector(`.approval-item[data-id="${contentId}"]`);
    if (!approvalItem) {
      // إذا لم يتم العثور على العنصر، جرب البحث بالبادئة
      const prefix = contentType === 'department' ? 'dept-' : 'comm-';
      const prefixedId = `${prefix}${contentId}`;
      approvalItem = document.querySelector(`.approval-item[data-id="${prefixedId}"]`);
    }
    if (!approvalItem) {
      showToast('لم يتم العثور على بيانات المحتوى', 'error');
      return;
    }

    const assignedNames = JSON.parse(approvalItem.dataset.assignedNames || '[]');
    const assignedIds = JSON.parse(approvalItem.dataset.assignedIds || '[]');

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
      
      // إضافة الأرقام للأقسام فقط، بدون أرقام للجان والمحاضر
      const displayName = contentType === 'department' 
        ? `${i + 1}. ${name}` 
        : name;
      
      const deadlineItem = document.createElement('div');
      deadlineItem.className = 'deadline-item';
      deadlineItem.innerHTML = `
        <div class="deadline-item-info">
          <div class="deadline-item-name">${displayName}</div>
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
  const saveButton = document.querySelector('.deadline-btn-save');
  const originalText = saveButton.innerHTML;
  
  // تعطيل الزر فوراً
  saveButton.disabled = true;
  saveButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...`;
  
  try {
    const { contentId, contentType } = currentDeadlineData;
    
    if (!contentId || !contentType) {
      showToast('بيانات غير صحيحة', 'error');
      saveButton.disabled = false;
      saveButton.innerHTML = originalText;
      return;
    }

    let approvalItem = document.querySelector(`.approval-item[data-id="${contentId}"]`);
    if (!approvalItem) {
      // إذا لم يتم العثور على العنصر، جرب البحث بالبادئة
      const prefix = contentType === 'department' ? 'dept-' : 'comm-';
      const prefixedId = `${prefix}${contentId}`;
      approvalItem = document.querySelector(`.approval-item[data-id="${prefixedId}"]`);
    }
    if (!approvalItem) {
      showToast('لم يتم العثور على بيانات المحتوى', 'error');
      return;
    }

    const assignedIds = JSON.parse(approvalItem.dataset.assignedIds || '[]');
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
      saveButton.disabled = false;
      saveButton.innerHTML = originalText;
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
