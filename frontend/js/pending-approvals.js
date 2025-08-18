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
    
    // عرض البطاقات الرئيسية أولاً
    showMainCards();
    
    await initDropdowns();
  } catch (err) {
    console.error('Error initializing page:', err);
  }
});

// Add function to update page direction
function updatePageDirection(lang) {
  // تطبيق الاتجاه على body
  document.body.setAttribute('data-lang', lang);
  document.body.dir = lang === 'ar' ? 'rtl' : 'ltr';
  
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

  // تطبيق الاتجاه على الأزرار في الكارد
  document.querySelectorAll('.item-actions').forEach(actions => {
    if (lang === 'ar') {
      actions.style.flexDirection = 'row-reverse';
    } else {
      actions.style.flexDirection = 'row';
    }
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
      <button class="collapse-btn" title="${getTranslation('collapse-card') || 'تصغير الكارد'}">
        <i class="fas fa-chevron-up"></i>
      </button>
    </div>
    
    <!-- عرض الأشخاص المرسل لهم في الكارد المصغر -->
    ${hasApprovers ? `
      <div class="sent-approvers-mini">
        <span class="mini-label">${getTranslation('sent-to') || 'مرسل إلى'}:</span>
        <div class="mini-approvers">
          ${assignedApproverNames.map((name, index) => `
            <span class="mini-approver" title="${name}">
              ${index === 0 ? '1.' : ''} ${name}
            </span>
          `).join('')}
        </div>
      </div>
    ` : ''}
    
    <div class="item-content">
      ${hasApprovers ? `
        <div class="selected-approvers" style="margin-bottom: 12px;">
          ${approverBadges}
        </div>
      ` : ''}
      
             ${item.type === 'department' ? `
         <div class="department-transfer-note" style="margin-bottom: 8px;">
           <span style="font-size: 11px; color: #6c757d; background: #f8f9fa; padding: 4px 8px; border-radius: 4px; border: 1px solid #e9ecef; display: inline-block;">
             ${getTranslation('internal-first-external-second') || 'داخلي أولاً، ثم خارجي'}
           </span>
         </div>
       ` : ''}
       
       <div class="approval-controls" style="display: flex; flex-direction: column; gap: 20px;">
         <!-- قسم التحويل الداخلي -->
         <div class="transfer-section internal-transfer">
           <div class="section-header" style="background: #e8f5e8; color: #155724; padding: 8px 12px; border-radius: 6px; margin-bottom: 12px; font-weight: 600; font-size: 0.9rem; text-align: center;">
             ${item.type === 'department' ? (getTranslation('internal-transfer') || 'التحويل الداخلي') : (getTranslation('select-department') || 'اختر القسم')}
           </div>
           <div class="section-content" style="display: flex; gap: 12px; flex-wrap: wrap;">
             <div class="dropdown-group" style="flex: 1; min-width: 180px;">
               <label class="dropdown-label" style="display: block; margin-bottom: 8px; font-weight: 600; color: #155724; font-size: 0.9rem; text-align: center;">
                 ${item.type === 'department' ? (getTranslation('select-internal-department') || 'اختر القسم الداخلي') : (getTranslation('select-department') || 'اختر القسم')}
               </label>
               <div class="dropdown-custom" data-type="internal-dept">
                 <button class="dropdown-btn">${getTranslation('select-department')}</button>
                 <div class="dropdown-content">
                   <input type="text" class="dropdown-search" placeholder="${getTranslation('search-department')}">
                 </div>
               </div>
             </div>
             <div class="dropdown-group" style="flex: 1; min-width: 180px;">
               <label class="dropdown-label" style="display: block; margin-bottom: 8px; font-weight: 600; color: #155724; font-size: 0.9rem; text-align: center;">
                 ${item.type === 'department' ? (getTranslation('select-internal-people') || 'اختر الأشخاص الداخليين') : (getTranslation('select-people') || 'اختر الأشخاص')}
               </label>
               <div class="dropdown-custom" data-type="internal-users">
                 <button class="dropdown-btn" disabled>${getTranslation('select-department-first')}</button>
                 <div class="dropdown-content">
                   <input class="dropdown-search" placeholder="${getTranslation('search-person')}">
                 </div>
               </div>
             </div>
             ${item.type !== 'protocol' ? `
               <div class="dropdown-group" style="flex: 1; min-width: 180px;">
                 <label class="dropdown-label" style="display: block; margin-bottom: 8px; font-weight: 600; color: #155724; font-size: 0.9rem; text-align: center;">
                   ${getTranslation('role-info') || 'سيتم تحديد الدور لكل شخص'}
                 </label>
                 <div class="role-info-text" style="font-size: 11px; color: #6c757d; text-align: center;">
                   ${getTranslation('role-per-person') || 'يمكنك تحديد دور مختلف لكل معتمد'}
                 </div>
               </div>
             ` : ''}
           </div>
         </div>

         <!-- قسم التحويل الخارجي (للأقسام فقط) -->
         ${item.type === 'department' ? `
         <div class="transfer-section external-transfer">
           <div class="section-header" style="background: #fff3cd; color: #856404; padding: 8px 12px; border-radius: 6px; margin-bottom: 12px; font-weight: 600; font-size: 0.9rem; text-align: center;">
             ${getTranslation('external-transfer') || 'التحويل الخارجي'}
           </div>
           <div class="section-content" style="display: flex; gap: 12px; flex-wrap: wrap;">
             <div class="dropdown-group" style="flex: 1; min-width: 180px;">
               <label class="dropdown-label" style="display: block; margin-bottom: 8px; font-weight: 600; color: #856404; font-size: 0.9rem; text-align: center;">
                 ${getTranslation('select-external-department') || 'اختر القسم الخارجي'}
               </label>
               <div class="dropdown-custom" data-type="external-dept">
                 <button class="dropdown-btn">${getTranslation('select-department')}</button>
                 <div class="dropdown-content">
                   <input type="text" class="dropdown-search" placeholder="${getTranslation('search-department')}">
                 </div>
               </div>
             </div>
             <div class="dropdown-group" style="flex: 1; min-width: 180px;">
               <label class="dropdown-label" style="display: block; margin-bottom: 8px; font-weight: 600; color: #856404; font-size: 0.9rem; text-align: center;">
                 ${getTranslation('select-external-people') || 'اختر الأشخاص الخارجيين'}
               </label>
               <div class="dropdown-custom" data-type="external-users">
                 <button class="dropdown-btn" disabled>${getTranslation('select-department-first')}</button>
                 <div class="dropdown-content">
                   <input class="dropdown-search" placeholder="${getTranslation('search-person')}">
                 </div>
               </div>
             </div>
             ${item.type !== 'protocol' ? `
               <div class="dropdown-group" style="flex: 1; min-width: 180px;">
                 <label class="dropdown-label" style="display: block; margin-bottom: 8px; font-weight: 600; color: #856404; font-size: 0.9rem; text-align: center;">
                   ${getTranslation('role-info') || 'سيتم تحديد الدور لكل شخص'}
                 </label>
                 <div class="role-info-text" style="font-size: 11px; color: #6c757d; text-align: center;">
                   ${getTranslation('role-per-person') || 'يمكنك تحديد دور مختلف لكل معتمد'}
                 </div>
               </div>
             ` : ''}
           </div>
         </div>
         ` : ''}
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
  // زر التصغير
  const collapseButton = approvalItem.querySelector('.collapse-btn');
  if (collapseButton) {
    collapseButton.addEventListener('click', (e) => {
      e.preventDefault();
      const itemContent = approvalItem.querySelector('.item-content');
      const itemActions = approvalItem.querySelector('.item-actions');
      const icon = collapseButton.querySelector('i');
      
      if (approvalItem.classList.contains('collapsed')) {
        // إظهار المحتوى
        approvalItem.classList.remove('collapsed');
        itemContent.style.display = 'block';
        itemActions.style.display = 'flex';
        icon.className = 'fas fa-chevron-up';
        collapseButton.title = getTranslation('collapse-card') || 'تصغير الكارد';
        
        // إعادة تعيين الارتفاع
        approvalItem.style.maxHeight = 'none';
        approvalItem.style.overflow = 'visible';
      } else {
        // إخفاء المحتوى
        approvalItem.classList.add('collapsed');
        itemContent.style.display = 'none';
        itemActions.style.display = 'none';
        icon.className = 'fas fa-chevron-down';
        collapseButton.title = getTranslation('expand-card') || 'تكبير الكارد';
        
        // تصغير إضافي
        approvalItem.style.maxHeight = '40px';
        approvalItem.style.overflow = 'hidden';
      }
    });
  }

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
  
  // إعادة بناء جدول المعتمدين
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
    // إعادة بناء الجدول
    const contentType = approvalItem.dataset.type;
    const isDepartment = contentType === 'department';
    
    const approversTable = document.createElement('div');
    approversTable.className = 'approvers-table';
    approversTable.dataset.type = contentType;
    
    // إنشاء رأس الجدول - يختلف حسب نوع المحتوى
    const tableHeader = document.createElement('div');
    tableHeader.className = 'table-header';
    
    if (isDepartment) {
      // للأقسام: عرض التسلسل ونوع التحويل
      tableHeader.innerHTML = `
        <div class="header-cell sequence">${getTranslation('sequence') || 'التسلسل'}</div>
        <div class="header-cell name">${getTranslation('name') || 'الاسم'}</div>
        <div class="header-cell department">${getTranslation('department') || 'القسم'}</div>
        <div class="header-cell type">${getTranslation('transfer-type') || 'نوع التحويل'}</div>
        <div class="header-cell role">${getTranslation('role') || 'الدور'}</div>
        <div class="header-cell actions">${getTranslation('actions') || 'الإجراءات'}</div>
      `;
    } else {
      // للجان والمحاضر: بدون تسلسل وبدون نوع تحويل
      tableHeader.innerHTML = `
        <div class="header-cell name">${getTranslation('name') || 'الاسم'}</div>
        <div class="header-cell department">${getTranslation('department') || 'القسم'}</div>
        ${contentType !== 'protocol' ? `<div class="header-cell role">${getTranslation('role') || 'الدور'}</div>` : ''}
        <div class="header-cell actions">${getTranslation('actions') || 'الإجراءات'}</div>
      `;
    }
    approversTable.appendChild(tableHeader);
    
    // إنشاء صفوف المعتمدين
    updatedNames.forEach((name, index) => {
      const tableRow = document.createElement('div');
      tableRow.className = 'table-row';
      tableRow.dataset.userName = name;
      
      if (isDepartment) {
        // للأقسام: عرض التسلسل ونوع التحويل
        
        // خلية التسلسل
        const sequenceCell = document.createElement('div');
        sequenceCell.className = 'table-cell sequence';
        sequenceCell.innerHTML = `
          <div class="sequence-number ${index === 0 ? 'first' : ''}">
            ${index + 1}
          </div>
        `;
        tableRow.appendChild(sequenceCell);
        
        // خلية الاسم
        const nameCell = document.createElement('div');
        nameCell.className = 'table-cell name';
        nameCell.textContent = name;
        tableRow.appendChild(nameCell);
        
        // خلية القسم
        const deptCell = document.createElement('div');
        deptCell.className = 'table-cell department';
        deptCell.textContent = '-';
        tableRow.appendChild(deptCell);
        
        // خلية نوع التحويل
        const typeCell = document.createElement('div');
        typeCell.className = 'table-cell type';
        typeCell.innerHTML = `
          <span class="transfer-type internal">
            ${getTranslation('internal') || 'داخلي'}
          </span>
        `;
        tableRow.appendChild(typeCell);
        
        // خلية الدور
        const roleCell = document.createElement('div');
        roleCell.className = 'table-cell role';
        roleCell.innerHTML = `
          <div class="role-selector">
            <select class="role-dropdown" data-user-name="${name}">
              <option value="prepared">${getTranslation('prepared') || 'Prepared'}</option>
              <option value="updated">${getTranslation('updated') || 'Updated'}</option>
              <option value="reviewed">${getTranslation('reviewed') || 'Reviewed'}</option>
              <option value="approved" selected>${getTranslation('approved') || 'Approved'}</option>
            </select>
          </div>
        `;
        tableRow.appendChild(roleCell);
        
      } else {
        // للجان والمحاضر: بدون تسلسل وبدون نوع تحويل
        
        // خلية الاسم
        const nameCell = document.createElement('div');
        nameCell.className = 'table-cell name';
        nameCell.textContent = name;
        tableRow.appendChild(nameCell);
        
        // خلية القسم
        const deptCell = document.createElement('div');
        deptCell.className = 'table-cell department';
        deptCell.textContent = '-';
        tableRow.appendChild(deptCell);
        
        // خلية الدور (فقط للجان، وليس للمحاضر)
        if (contentType !== 'protocol') {
          const roleCell = document.createElement('div');
          roleCell.className = 'table-cell role';
          roleCell.innerHTML = `
            <div class="role-selector">
              <select class="role-dropdown" data-user-name="${name}">
                <option value="prepared">${getTranslation('prepared') || 'Prepared'}</option>
                <option value="updated">${getTranslation('updated') || 'Updated'}</option>
                <option value="reviewed">${getTranslation('reviewed') || 'Reviewed'}</option>
                <option value="approved" selected>${getTranslation('approved') || 'Approved'}</option>
              </select>
            </div>
          `;
          tableRow.appendChild(roleCell);
        }
      }
      
      // خلية الإجراءات (مشتركة لجميع الأنواع)
      const actionsCell = document.createElement('div');
      actionsCell.className = 'table-cell actions';
      actionsCell.innerHTML = `
        <button class="remove-approver-btn" data-approver-name="${name}" title="${getTranslation('remove-approver') || 'حذف المعتمد'}">
          <i class="fas fa-times"></i>
        </button>
      `;
      tableRow.appendChild(actionsCell);
      
      // إضافة event listener لزر الحذف
      const removeBtn = actionsCell.querySelector('.remove-approver-btn');
      removeBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      
        const approverName = name;
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
      
      approversTable.appendChild(tableRow);
    });
    
    selectedApproversDiv.appendChild(approversTable);
    
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
 }

async function initDropdowns() {
  const departments = await fetchJSON(`${apiBase}/departments/all`);
  document.querySelectorAll('.approval-item').forEach(approvalItem => {
    const internalDeptDrop = approvalItem.querySelector('[data-type=internal-dept]');
    const internalUserDrop = approvalItem.querySelector('[data-type=internal-users]');
    const externalDeptDrop = approvalItem.querySelector('[data-type=external-dept]');
    const externalUserDrop = approvalItem.querySelector('[data-type=external-users]');
    const sendBtn  = approvalItem.querySelector('.btn-send');
    const contentType = approvalItem.dataset.type; // نقل إلى الأعلى

    if (!sendBtn) return;
    
    // التحقق من وجود العناصر المطلوبة قبل المتابعة
    if (!internalDeptDrop || !internalUserDrop) {
      console.warn('Missing required dropdown elements for approval item:', approvalItem.dataset.id);
      return;
    }
    
    // إضافة console.log للتشخيص
    console.log('Approval item type:', contentType);
    console.log('External dept drop found:', !!externalDeptDrop);
    console.log('External user drop found:', !!externalUserDrop);
    
    let selectedInternalDepts = [];
    let selectedExternalDepts = [];
    let selectedInternalUsers = [];
    let selectedExternalUsers = [];
    let selectionCounter = 0; // عداد لترتيب الاختيار

    // إعداد القسم الداخلي
    const internalDeptBtn = internalDeptDrop.querySelector('.dropdown-btn');
    const internalDeptList = internalDeptDrop.querySelector('.dropdown-content');
    if (internalDeptBtn && internalDeptList) {
      internalDeptList.innerHTML = `<input type="text" class="dropdown-search" placeholder="${getTranslation('search-department')}">`;
    }

    // إعداد القسم الخارجي (إذا كان موجوداً)
    let externalDeptBtn, externalDeptList;
    if (externalDeptDrop) {
      externalDeptBtn = externalDeptDrop.querySelector('.dropdown-btn');
      externalDeptList = externalDeptDrop.querySelector('.dropdown-content');
      if (externalDeptBtn && externalDeptList) {
        externalDeptList.innerHTML = `<input type="text" class="dropdown-search" placeholder="${getTranslation('search-department')}">`;
      }
    }

    // تم إزالة dropdowns الأدوار العامة - الآن كل شخص يحدد دوره على حدة
    
         // للأقسام: ترتيب الأقسام بحسب نوع التحويل
     if (contentType === 'department') {
       // الحصول على القسم الحالي للملف
       const currentDepartmentName = approvalItem.querySelector('.item-meta')?.textContent?.split(' - ')[1] || '';
       
       // تقسيم الأقسام: نفس القسم + الأقسام التابعة له (داخلي)، والباقي (خارجي)
       const currentDepartment = departments.find(d => {
         const lang = localStorage.getItem('language') || 'ar';
         try {
           const parsed = typeof d.name === 'string' ? JSON.parse(d.name) : d.name;
           const name = parsed[lang] || parsed.ar || parsed.en || '';
           return name === currentDepartmentName;
         } catch {
           return d.name === currentDepartmentName;
         }
       });
       
               // الأقسام الداخلية: نفس القسم + الأقسام التابعة له فقط
        const internalDepartments = departments.filter(d => {
          if (!currentDepartment) return false;
          
          // 1. نفس القسم الحالي
          if (d.id === currentDepartment.id) return true;
          
          // 2. الأقسام التابعة (parent_id = currentDepartment.id)
          if (d.parent_id === currentDepartment.id) {
            return true;
          }
          
          return false;
        });
       
       // الأقسام الخارجية: باقي الأقسام
       const externalDepartments = departments.filter(d => !internalDepartments.includes(d));
       
       // إعداد القسم الداخلي
       if (internalDepartments.length > 0 && internalDeptList) {
         internalDepartments.forEach(d => {
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
           internalDeptList.appendChild(itm);
         });
       }
       
       // إعداد القسم الخارجي
       if (externalDepartments.length > 0 && externalDeptList) {
         externalDepartments.forEach(d => {
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
           externalDeptList.appendChild(itm);
         });
       }
           } else {
        // للجان والمحاضر: جميع الأقسام في قسم واحد (داخلي)
        if (internalDeptList) {
          departments.forEach(d => {
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
            internalDeptList.appendChild(itm);
          });
        }
        
        // إخفاء قسم التحويل الخارجي للجان والمحاضر
        const externalTransferSection = approvalItem.querySelector('.external-transfer');
        if (externalTransferSection) {
          externalTransferSection.style.display = 'none';
        }
      }

    // إعداد القسم الداخلي
    (function setupInternalDeptDropdown() {
      if (!internalDeptList || !internalDeptBtn) return;
      
      const search = internalDeptList.querySelector('.dropdown-search');
      if (!search) return;
      
      internalDeptBtn.addEventListener('click', e => {
        e.stopPropagation();
        internalDeptList.classList.toggle('active');
      });
      document.addEventListener('click', () => internalDeptList.classList.remove('active'));
      internalDeptList.addEventListener('click', e => e.stopPropagation());
      search.addEventListener('input', () => {
        const v = search.value.trim();
        internalDeptList.querySelectorAll('.dropdown-item').forEach(i => {
          i.style.display = i.textContent.includes(v) ? 'block' : 'none';
        });
      });
      internalDeptList.addEventListener('click', async e => {
        if (!e.target.classList.contains('dropdown-item')) return;
        const item = e.target;
        item.classList.toggle('selected');
        selectedInternalDepts = Array.from(internalDeptList.querySelectorAll('.dropdown-item.selected'))
                              .map(i => ({ 
                                id: i.dataset.value, 
                                name: i.textContent.trim(),
                                transferType: 'internal'
                              }));
        if (selectedInternalDepts.length === 0) {
          internalDeptBtn.textContent = getTranslation('select-department');
        } else if (selectedInternalDepts.length === 1) {
          internalDeptBtn.textContent = selectedInternalDepts[0].name;
        } else {
          internalDeptBtn.textContent = `${selectedInternalDepts.length} ${getTranslation('departments-count')}`;
        }
        await rebuildInternalUsersList();
      });
    })();

    // إعداد القسم الخارجي (فقط إذا كان موجوداً)
    if (externalDeptDrop && externalDeptList && externalDeptBtn) {
      (function setupExternalDeptDropdown() {
        const search = externalDeptList.querySelector('.dropdown-search');
        if (!search) return;
        
        externalDeptBtn.addEventListener('click', e => {
          e.stopPropagation();
          externalDeptList.classList.toggle('active');
        });
        document.addEventListener('click', () => externalDeptList.classList.remove('active'));
        externalDeptList.addEventListener('click', e => e.stopPropagation());
        search.addEventListener('input', () => {
          const v = search.value.trim();
          externalDeptList.querySelectorAll('.dropdown-item').forEach(i => {
            i.style.display = i.textContent.includes(v) ? 'block' : 'none';
          });
        });
        externalDeptList.addEventListener('click', async e => {
          if (!e.target.classList.contains('dropdown-item')) return;
          const item = e.target;
          item.classList.toggle('selected');
          selectedExternalDepts = Array.from(externalDeptList.querySelectorAll('.dropdown-item.selected'))
                                .map(i => ({ 
                                  id: i.dataset.value, 
                                  name: i.textContent.trim(),
                                  transferType: 'external'
                                }));
          if (selectedExternalDepts.length === 0) {
            externalDeptBtn.textContent = getTranslation('select-department');
          } else if (selectedExternalDepts.length === 1) {
            externalDeptBtn.textContent = selectedExternalDepts[0].name;
          } else {
            externalDeptBtn.textContent = `${selectedExternalDepts.length} ${getTranslation('departments-count')}`;
          }
          await rebuildExternalUsersList();
        });
      })();
    }

    async function rebuildInternalUsersList() {
      // تغذية المستخدمين للقسم الداخلي
      const uBtn = internalUserDrop.querySelector('.dropdown-btn');
      const uList = internalUserDrop.querySelector('.dropdown-content');
      uList.innerHTML = `<input type="text" class="dropdown-search" placeholder="${getTranslation('search-person')}">`;
      const existingAssignedNames = JSON.parse(approvalItem.dataset.assignedNames || '[]');

      if (!selectedInternalDepts.length) {
        uBtn.disabled = true;
        uBtn.textContent = getTranslation('select-department-first');
        return;
      }

      uBtn.disabled = false;
      uBtn.textContent = selectedInternalUsers.length ? `${selectedInternalUsers.length} ${getTranslation('selected-count')}` : getTranslation('select-people');
      
      // إعادة بناء القائمة المعروضة للمعتمدين المختارين
      const selCell = approvalItem.querySelector('.selected-approvers');
      if (selCell && selectedInternalUsers.length > 0) {
        selCell.innerHTML = '';
        
        const contentType = approvalItem.dataset.type;
        const isDepartment = contentType === 'department';
        
        // إنشاء جدول منظم للمعتمدين
        const approversTable = document.createElement('div');
        approversTable.className = 'approvers-table';
        approversTable.dataset.type = contentType;
        
        // إنشاء رأس الجدول - يختلف حسب نوع المحتوى
        const tableHeader = document.createElement('div');
        tableHeader.className = 'table-header';
        
        if (isDepartment) {
          // للأقسام: عرض التسلسل ونوع التحويل
          tableHeader.innerHTML = `
            <div class="header-cell sequence">${getTranslation('sequence') || 'التسلسل'}</div>
            <div class="header-cell name">${getTranslation('name') || 'الاسم'}</div>
            <div class="header-cell department">${getTranslation('department') || 'القسم'}</div>
            <div class="header-cell type">${getTranslation('transfer-type') || 'نوع التحويل'}</div>
            <div class="header-cell role">${getTranslation('role') || 'الدور'}</div>
            <div class="header-cell actions">${getTranslation('actions') || 'الإجراءات'}</div>
          `;
        } else {
          // للجان والمحاضر: بدون تسلسل وبدون نوع تحويل
          tableHeader.innerHTML = `
            <div class="header-cell name">${getTranslation('name') || 'الاسم'}</div>
            <div class="header-cell department">${getTranslation('department') || 'القسم'}</div>
            ${contentType !== 'protocol' ? `<div class="header-cell role">${getTranslation('role') || 'الدور'}</div>` : ''}
            <div class="header-cell actions">${getTranslation('actions') || 'الإجراءات'}</div>
          `;
        }
        approversTable.appendChild(tableHeader);
        
        // ترتيب المعتمدين حسب وقت الاختيار
        const sortedUsers = selectedInternalUsers.sort((a, b) => a.selectedAt - b.selectedAt);
        
        // إعادة تعيين العداد ليكون أكبر من أكبر قيمة موجودة
        const maxSelectedAt = Math.max(...selectedInternalUsers.map(u => u.selectedAt || 0));
        selectionCounter = maxSelectedAt;
        
        sortedUsers.forEach((u, index) => {
          const tableRow = document.createElement('div');
          tableRow.className = 'table-row';
          tableRow.dataset.userId = u.id;
          tableRow.dataset.userName = u.name;
          
          const lang = localStorage.getItem('language') || 'ar';
          const dept = selectedInternalDepts.find(d => d.id === u.deptId);
          let deptName = dept?.name || '';

          try {
            const parsed = typeof deptName === 'string' ? JSON.parse(deptName) : deptName;
            deptName = parsed?.[lang] || parsed?.ar || parsed?.en || '';
          } catch {}

          if (isDepartment) {
            // للأقسام: عرض التسلسل ونوع التحويل
            
            // خلية التسلسل
            const sequenceCell = document.createElement('div');
            sequenceCell.className = 'table-cell sequence';
            sequenceCell.innerHTML = `
              <div class="sequence-number ${index === 0 ? 'first' : ''}">
                ${index + 1}
              </div>
            `;
            tableRow.appendChild(sequenceCell);
            
            // خلية الاسم
            const nameCell = document.createElement('div');
            nameCell.className = 'table-cell name';
            nameCell.textContent = u.name;
            tableRow.appendChild(nameCell);
            
            // خلية القسم
            const deptCell = document.createElement('div');
            deptCell.className = 'table-cell department';
            deptCell.textContent = deptName;
            tableRow.appendChild(deptCell);
            
            // خلية نوع التحويل
            const typeCell = document.createElement('div');
            typeCell.className = 'table-cell type';
            typeCell.innerHTML = `
              <span class="transfer-type internal">
                ${getTranslation('internal') || 'داخلي'}
              </span>
            `;
            tableRow.appendChild(typeCell);
            
            // خلية الدور
            const roleCell = document.createElement('div');
            roleCell.className = 'table-cell role';
            roleCell.innerHTML = `
              <div class="role-selector">
                <select class="role-dropdown" data-user-name="${u.name}" data-user-id="${u.id}">
                  <option value="prepared" ${u.role === 'prepared' ? 'selected' : ''}>📝 ${getTranslation('prepared') || 'Prepared'}</option>
                  <option value="updated" ${u.role === 'updated' ? 'selected' : ''}>✏️ ${getTranslation('updated') || 'Updated'}</option>
                  <option value="reviewed" ${u.role === 'reviewed' ? 'selected' : ''}>🔍 ${getTranslation('reviewed') || 'Reviewed'}</option>
                  <option value="approved" ${u.role === 'approved' ? 'selected' : ''}>✅ ${getTranslation('approved') || 'Approved'}</option>
                </select>
              </div>
            `;
            
            // إضافة event listener لتغيير الدور
            const roleDropdown = roleCell.querySelector('.role-dropdown');
            roleDropdown.addEventListener('change', (e) => {
              const newRole = e.target.value;
              const userName = e.target.dataset.userName;
              
              // تحديث الدور في البيانات المحلية
              const approvers = JSON.parse(approvalItem.dataset.assignedNames || '[]');
              const approver = approvers.find(a => a.name === userName);
              if (approver) {
                approver.role = newRole;
                approvalItem.dataset.assignedNames = JSON.stringify(approvers);
              }
            });
            tableRow.appendChild(roleCell);
            
          } else {
            // للجان والمحاضر: بدون تسلسل وبدون نوع تحويل
            
            // خلية الاسم
            const nameCell = document.createElement('div');
            nameCell.className = 'table-cell name';
            nameCell.textContent = u.name;
            tableRow.appendChild(nameCell);
            
            // خلية القسم
            const deptCell = document.createElement('div');
            deptCell.className = 'table-cell department';
            deptCell.textContent = deptName;
            tableRow.appendChild(deptCell);
            
            // خلية الدور (فقط للجان، وليس للمحاضر)
            if (contentType !== 'protocol') {
              const roleCell = document.createElement('div');
              roleCell.className = 'table-cell role';
              roleCell.innerHTML = `
                <div class="role-selector">
                  <select class="role-dropdown" data-user-name="${u.name}" data-user-id="${u.id}">
                    <option value="prepared" ${u.role === 'prepared' ? 'selected' : ''}> ${getTranslation('prepared') || 'Prepared'}</option>
                    <option value="updated" ${u.role === 'updated' ? 'selected' : ''}> ${getTranslation('updated') || 'Updated'}</option>
                    <option value="reviewed" ${u.role === 'reviewed' ? 'selected' : ''}> ${getTranslation('reviewed') || 'Reviewed'}</option>
                    <option value="approved" ${u.role === 'approved' ? 'selected' : ''}>${getTranslation('approved') || 'Approved'}</option>
                  </select>
                </div>
              `;
              
              // إضافة event listener لتغيير الدور
              const roleDropdown = roleCell.querySelector('.role-dropdown');
              roleDropdown.addEventListener('change', (e) => {
                const newRole = e.target.value;
                const userName = e.target.dataset.userName;
                
                // تحديث الدور في البيانات المحلية
                const approvers = JSON.parse(approvalItem.dataset.assignedNames || '[]');
                const approver = approvers.find(a => a.name === userName);
                if (approver) {
                  approver.role = newRole;
                  approvalItem.dataset.assignedNames = JSON.stringify(approvers);
                }
              });
              tableRow.appendChild(roleCell);
            }
          }
          
          // خلية الإجراءات (مشتركة لجميع الأنواع)
          const actionsCell = document.createElement('div');
          actionsCell.className = 'table-cell actions';
          actionsCell.innerHTML = `
            <button class="remove-approver-btn" data-approver-name="${u.name}" title="${getTranslation('remove-approver') || 'حذف المعتمد'}">
              <i class="fas fa-times"></i>
            </button>
          `;
          tableRow.appendChild(actionsCell);
          
          // إضافة event listener لزر الحذف
          const removeBtn = actionsCell.querySelector('.remove-approver-btn');
          removeBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            const approverName = u.name;
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
          
          approversTable.appendChild(tableRow);
        });
        
        selCell.appendChild(approversTable);
      }

      for (const dept of selectedInternalDepts) {
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
          item.dataset.transferType = 'internal';
          const existingUser = selectedInternalUsers.find(x => x.id === u.id);
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

    async function rebuildExternalUsersList() {
      // تغذية المستخدمين للقسم الخارجي (فقط إذا كان موجوداً)
      console.log('rebuildExternalUsersList called');
      console.log('externalUserDrop exists:', !!externalUserDrop);
      
      if (!externalUserDrop) {
        console.warn('externalUserDrop not found');
        return;
      }
      
      const uBtn = externalUserDrop.querySelector('.dropdown-btn');
      const uList = externalUserDrop.querySelector('.dropdown-content');
      console.log('uBtn found:', !!uBtn);
      console.log('uList found:', !!uList);
      
      if (!uBtn || !uList) {
        console.warn('uBtn or uList not found');
        return;
      }
      
      uList.innerHTML = `<input type="text" class="dropdown-search" placeholder="${getTranslation('search-person')}">`;
      const existingAssignedNames = JSON.parse(approvalItem.dataset.assignedNames || '[]');

      if (!selectedExternalDepts.length) {
        uBtn.disabled = true;
        uBtn.textContent = getTranslation('select-department-first');
        return;
      }

      uBtn.disabled = false;
      uBtn.textContent = selectedExternalUsers.length ? `${selectedExternalUsers.length} ${getTranslation('selected-count')}` : getTranslation('select-people');
      
      // إعادة بناء القائمة المعروضة للمعتمدين المختارين
      const selCell = approvalItem.querySelector('.selected-approvers');
      if (selCell && selectedExternalUsers.length > 0) {
        selCell.innerHTML = '';
        
        const contentType = approvalItem.dataset.type;
        const isDepartment = contentType === 'department';
        
        // إنشاء جدول منظم للمعتمدين
        const approversTable = document.createElement('div');
        approversTable.className = 'approvers-table';
        approversTable.dataset.type = contentType;
        
        // إنشاء رأس الجدول - يختلف حسب نوع المحتوى
        const tableHeader = document.createElement('div');
        tableHeader.className = 'table-header';
        
        if (isDepartment) {
          // للأقسام: عرض التسلسل ونوع التحويل
          tableHeader.innerHTML = `
            <div class="header-cell sequence">${getTranslation('sequence') || 'التسلسل'}</div>
            <div class="header-cell name">${getTranslation('name') || 'الاسم'}</div>
            <div class="header-cell department">${getTranslation('department') || 'القسم'}</div>
            <div class="header-cell type">${getTranslation('transfer-type') || 'نوع التحويل'}</div>
            <div class="header-cell role">${getTranslation('role') || 'الدور'}</div>
            <div class="header-cell actions">${getTranslation('actions') || 'الإجراءات'}</div>
          `;
        } else {
          // للجان والمحاضر: بدون تسلسل وبدون نوع تحويل
          tableHeader.innerHTML = `
            <div class="header-cell name">${getTranslation('name') || 'الاسم'}</div>
            <div class="header-cell department">${getTranslation('department') || 'القسم'}</div>
            ${contentType !== 'protocol' ? `<div class="header-cell role">${getTranslation('role') || 'الدور'}</div>` : ''}
            <div class="header-cell actions">${getTranslation('actions') || 'الإجراءات'}</div>
          `;
        }
        approversTable.appendChild(tableHeader);
        
        // ترتيب المعتمدين حسب وقت الاختيار
        const sortedUsers = selectedExternalUsers.sort((a, b) => a.selectedAt - b.selectedAt);
        
        // إعادة تعيين العداد ليكون أكبر من أكبر قيمة موجودة
        const maxSelectedAt = Math.max(...selectedExternalUsers.map(u => u.selectedAt || 0));
        selectionCounter = maxSelectedAt;
        
        sortedUsers.forEach((u, index) => {
          const tableRow = document.createElement('div');
          tableRow.className = 'table-row';
          tableRow.dataset.userId = u.id;
          tableRow.dataset.userName = u.name;
          
          const lang = localStorage.getItem('language') || 'ar';
          const dept = selectedExternalDepts.find(d => d.id === u.deptId);
          let deptName = dept?.name || '';

          try {
            const parsed = typeof deptName === 'string' ? JSON.parse(deptName) : deptName;
            deptName = parsed?.[lang] || parsed?.ar || parsed?.en || '';
          } catch {}

          if (isDepartment) {
            // للأقسام: عرض التسلسل ونوع التحويل
            
            // خلية التسلسل
            const sequenceCell = document.createElement('div');
            sequenceCell.className = 'table-cell sequence';
            sequenceCell.innerHTML = `
              <div class="sequence-number ${index === 0 ? 'first' : ''}">
                ${index + 1}
              </div>
            `;
            tableRow.appendChild(sequenceCell);
            
            // خلية الاسم
            const nameCell = document.createElement('div');
            nameCell.className = 'table-cell name';
            nameCell.textContent = u.name;
            tableRow.appendChild(nameCell);
            
            // خلية القسم
            const deptCell = document.createElement('div');
            deptCell.className = 'table-cell department';
            deptCell.textContent = deptName;
            tableRow.appendChild(deptCell);
            
            // خلية نوع التحويل
            const typeCell = document.createElement('div');
            typeCell.className = 'table-cell type';
            typeCell.innerHTML = `
              <span class="transfer-type external">
                 ${getTranslation('external') || 'خارجي'}
              </span>
            `;
            tableRow.appendChild(typeCell);
            
            // خلية الدور
            const roleCell = document.createElement('div');
            roleCell.className = 'table-cell role';
            roleCell.innerHTML = `
              <div class="role-selector">
                <select class="role-dropdown" data-user-name="${u.name}" data-user-id="${u.id}">
                  <option value="prepared" ${u.role === 'prepared' ? 'selected' : ''}>📝 ${getTranslation('prepared') || 'Prepared'}</option>
                  <option value="updated" ${u.role === 'updated' ? 'selected' : ''}>✏️ ${getTranslation('updated') || 'Updated'}</option>
                  <option value="reviewed" ${u.role === 'reviewed' ? 'selected' : ''}>🔍 ${getTranslation('reviewed') || 'Reviewed'}</option>
                  <option value="approved" ${u.role === 'approved' ? 'selected' : ''}>✅ ${getTranslation('approved') || 'Approved'}</option>
                </select>
              </div>
            `;
            
            // إضافة event listener لتغيير الدور
            const roleDropdown = roleCell.querySelector('.role-dropdown');
            roleDropdown.addEventListener('change', (e) => {
              const newRole = e.target.value;
              const userName = e.target.dataset.userName;
              
              // تحديث الدور في البيانات المحلية
              const approvers = JSON.parse(approvalItem.dataset.assignedNames || '[]');
              const approver = approvers.find(a => a.name === userName);
              if (approver) {
                approver.role = newRole;
                approvalItem.dataset.assignedNames = JSON.stringify(approvers);
              }
            });
            tableRow.appendChild(roleCell);
            
          } else {
            // للجان والمحاضر: بدون تسلسل وبدون نوع تحويل
            
            // خلية الاسم
            const nameCell = document.createElement('div');
            nameCell.className = 'table-cell name';
            nameCell.textContent = u.name;
            tableRow.appendChild(nameCell);
            
            // خلية القسم
            const deptCell = document.createElement('div');
            deptCell.className = 'table-cell department';
            deptCell.textContent = deptName;
            tableRow.appendChild(deptCell);
            
            // خلية الدور (فقط للجان، وليس للمحاضر)
            if (contentType !== 'protocol') {
              const roleCell = document.createElement('div');
              roleCell.className = 'table-cell role';
              roleCell.innerHTML = `
                <div class="role-selector">
                  <select class="role-dropdown" data-user-name="${u.name}" data-user-id="${u.id}">
                    <option value="prepared" ${u.role === 'prepared' ? 'selected' : ''}>📝 ${getTranslation('prepared') || 'Prepared'}</option>
                    <option value="updated" ${u.role === 'updated' ? 'selected' : ''}>✏️ ${getTranslation('updated') || 'Updated'}</option>
                    <option value="reviewed" ${u.role === 'reviewed' ? 'selected' : ''}>🔍 ${getTranslation('reviewed') || 'Reviewed'}</option>
                    <option value="approved" ${u.role === 'approved' ? 'selected' : ''}>✅ ${getTranslation('approved') || 'Approved'}</option>
                  </select>
                </div>
              `;
              
              // إضافة event listener لتغيير الدور
              const roleDropdown = roleCell.querySelector('.role-dropdown');
              roleDropdown.addEventListener('change', (e) => {
                const newRole = e.target.value;
                const userName = e.target.dataset.userName;
                
                // تحديث الدور في البيانات المحلية
                const approvers = JSON.parse(approvalItem.dataset.assignedNames || '[]');
                const approver = approvers.find(a => a.name === userName);
                if (approver) {
                  approver.role = newRole;
                  approvalItem.dataset.assignedNames = JSON.stringify(approvers);
                }
              });
              tableRow.appendChild(roleCell);
            }
          }
          
          // خلية الإجراءات (مشتركة لجميع الأنواع)
          const actionsCell = document.createElement('div');
          actionsCell.className = 'table-cell actions';
          actionsCell.innerHTML = `
            <button class="remove-approver-btn" data-approver-name="${u.name}" title="${getTranslation('remove-approver') || 'حذف المعتمد'}">
              <i class="fas fa-times"></i>
            </button>
          `;
          tableRow.appendChild(actionsCell);
          
          // إضافة event listener لزر الحذف
          const removeBtn = actionsCell.querySelector('.remove-approver-btn');
          removeBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            const approverName = u.name;
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
          
          approversTable.appendChild(tableRow);
        });
        
        selCell.appendChild(approversTable);
      }

      for (const dept of selectedExternalDepts) {
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
          item.dataset.transferType = 'external';
          const existingUser = selectedExternalUsers.find(x => x.id === u.id);
          if (existingUser) {
            item.classList.add('selected');
          }
          uList.appendChild(item);
        });
      }

      const search = uList.querySelector('.dropdown-search');
      if (search) {
        search.addEventListener('input', () => {
          const v = search.value.trim();
          uList.querySelectorAll('.dropdown-item').forEach(i => {
            i.style.display = i.textContent.includes(v) ? 'block' : 'none';
          });
        });
      }
    }

    // إعداد القسم الداخلي للمستخدمين
    (function setupInternalUsersDropdown() {
      const btn = internalUserDrop.querySelector('.dropdown-btn');
      const list = internalUserDrop.querySelector('.dropdown-content');
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
          // إضافة المعتمد مع حفظ ترتيب الاختيار ونوع التحويل والدور
          selectionCounter++;
          selectedInternalUsers.push({ 
            id: userId, 
            name, 
            deptId, 
            selectedAt: selectionCounter,
            transferType: 'internal',
            role: 'approved' // الدور الافتراضي - سيتم تحديثه لاحقاً
          });
        } else {
          // إزالة المعتمد
          selectedInternalUsers = selectedInternalUsers.filter(x => x.id !== userId);
        }

        btn.textContent = selectedInternalUsers.length ? `${selectedInternalUsers.length} ${getTranslation('selected-count')}` : getTranslation('select-people');
        updateSelectedApproversDisplay();
      });
    })();

    // إعداد القسم الخارجي للمستخدمين (فقط إذا كان موجوداً)
    console.log('Setting up external users dropdown');
    console.log('externalUserDrop exists:', !!externalUserDrop);
    
    if (externalUserDrop) {
      (function setupExternalUsersDropdown() {
        const btn = externalUserDrop.querySelector('.dropdown-btn');
        const list = externalUserDrop.querySelector('.dropdown-content');
        console.log('btn found:', !!btn);
        console.log('list found:', !!list);
        
        if (!btn || !list) {
          console.warn('btn or list not found in external users dropdown');
          return;
        }
        
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
            // إضافة المعتمد مع حفظ ترتيب الاختيار ونوع التحويل والدور
            selectionCounter++;
            selectedExternalUsers.push({ 
              id: userId, 
              name, 
              deptId, 
              selectedAt: selectionCounter,
              transferType: 'external',
              role: 'approved' // الدور الافتراضي - سيتم تحديثه لاحقاً
            });
          } else {
            // إزالة المعتمد
            selectedExternalUsers = selectedExternalUsers.filter(x => x.id !== userId);
          }

          btn.textContent = selectedExternalUsers.length ? `${selectedExternalUsers.length} ${getTranslation('selected-count')}` : getTranslation('select-people');
          updateSelectedApproversDisplay();
        });
      })();
    }

    // دالة لتحديث عرض المعتمدين المختارين
    function updateSelectedApproversDisplay() {
      const selCell = approvalItem.querySelector('.selected-approvers');
      if (!selCell) return;
      
      selCell.innerHTML = '';
      
      // دمج المعتمدين الداخليين والخارجيين مع الحفاظ على الترتيب
      const allUsers = [...selectedInternalUsers];
      if (selectedExternalUsers) {
        allUsers.push(...selectedExternalUsers);
      }
      const sortedUsers = allUsers.sort((a, b) => a.selectedAt - b.selectedAt);
      
      if (sortedUsers.length === 0) return;
      
      const contentType = approvalItem.dataset.type;
      const isDepartment = contentType === 'department';
      
      // إنشاء جدول منظم للمعتمدين
      const approversTable = document.createElement('div');
      approversTable.className = 'approvers-table';
      approversTable.dataset.type = contentType;
      
      // إنشاء رأس الجدول - يختلف حسب نوع المحتوى
      const tableHeader = document.createElement('div');
      tableHeader.className = 'table-header';
      
      if (isDepartment) {
        // للأقسام: عرض التسلسل ونوع التحويل
        tableHeader.innerHTML = `
          <div class="header-cell sequence">${getTranslation('sequence') || 'التسلسل'}</div>
          <div class="header-cell name">${getTranslation('name') || 'الاسم'}</div>
          <div class="header-cell department">${getTranslation('department') || 'القسم'}</div>
          <div class="header-cell type">${getTranslation('transfer-type') || 'نوع التحويل'}</div>
          <div class="header-cell role">${getTranslation('role') || 'الدور'}</div>
          <div class="header-cell actions">${getTranslation('actions') || 'الإجراءات'}</div>
        `;
      } else {
        // للجان والمحاضر: بدون تسلسل وبدون نوع تحويل
        tableHeader.innerHTML = `
          <div class="header-cell name">${getTranslation('name') || 'الاسم'}</div>
          <div class="header-cell department">${getTranslation('department') || 'القسم'}</div>
          ${contentType !== 'protocol' ? `<div class="header-cell role">${getTranslation('role') || 'الدور'}</div>` : ''}
          <div class="header-cell actions">${getTranslation('actions') || 'الإجراءات'}</div>
        `;
      }
      approversTable.appendChild(tableHeader);
      
      // إنشاء صفوف المعتمدين
      sortedUsers.forEach((u, index) => {
        const tableRow = document.createElement('div');
        tableRow.className = 'table-row';
        tableRow.dataset.userId = u.id;
        tableRow.dataset.userName = u.name;
        
        const lang = localStorage.getItem('language') || 'ar';
        let dept = null;
        if (u.transferType === 'internal') {
          dept = selectedInternalDepts.find(d => d.id === u.deptId);
        } else if (u.transferType === 'external' && selectedExternalDepts) {
          dept = selectedExternalDepts.find(d => d.id === u.deptId);
        }
        let deptName = dept?.name || '';

        try {
          const parsed = typeof deptName === 'string' ? JSON.parse(deptName) : deptName;
          deptName = parsed?.[lang] || parsed?.ar || parsed?.en || '';
        } catch {}

        const sequenceNumber = index + 1;
        const icon = u.transferType === 'internal' ? '' : '';
        const transferTypeText = u.transferType === 'internal' 
          ? (getTranslation('internal') || 'داخلي') 
          : (getTranslation('external') || 'خارجي');
        
        // إنشاء خلايا الجدول - يختلف حسب نوع المحتوى
        if (isDepartment) {
          // للأقسام: عرض التسلسل ونوع التحويل
          
          // خلية التسلسل
          const sequenceCell = document.createElement('div');
          sequenceCell.className = 'table-cell sequence';
          sequenceCell.innerHTML = `
            <div class="sequence-number ${sequenceNumber === 1 ? 'first' : ''}">
              ${sequenceNumber}
            </div>
          `;
          tableRow.appendChild(sequenceCell);
          
          // خلية الاسم
          const nameCell = document.createElement('div');
          nameCell.className = 'table-cell name';
          nameCell.textContent = u.name;
          tableRow.appendChild(nameCell);
          
          // خلية القسم
          const deptCell = document.createElement('div');
          deptCell.className = 'table-cell department';
          deptCell.textContent = deptName;
          tableRow.appendChild(deptCell);
          
          // خلية نوع التحويل
          const typeCell = document.createElement('div');
          typeCell.className = 'table-cell type';
          typeCell.innerHTML = `
            <span class="transfer-type ${u.transferType}">
              ${icon} ${transferTypeText}
            </span>
          `;
          tableRow.appendChild(typeCell);
          
          // خلية الدور
          const roleCell = document.createElement('div');
          roleCell.className = 'table-cell role';
          roleCell.innerHTML = `
            <div class="role-selector">
              <select class="role-dropdown" data-user-name="${u.name}" data-user-id="${u.id}">
                <option value="prepared" ${u.role === 'prepared' ? 'selected' : ''}>
                   ${getTranslation('prepared') || 'Prepared'}
                </option>
                <option value="updated" ${u.role === 'updated' ? 'selected' : ''}>
                   ${getTranslation('updated') || 'Updated'}
                </option>
                <option value="reviewed" ${u.role === 'reviewed' ? 'selected' : ''}>
                   ${getTranslation('reviewed') || 'Reviewed'}
                </option>
                <option value="approved" ${u.role === 'approved' ? 'selected' : ''}>
                  ${getTranslation('approved') || 'Approved'}
                </option>
              </select>
            </div>
          `;
          
          // إضافة event listener لتغيير الدور
          const roleDropdown = roleCell.querySelector('.role-dropdown');
          roleDropdown.addEventListener('change', (e) => {
            const newRole = e.target.value;
            const userName = e.target.dataset.userName;
            
            // تحديث الدور في البيانات المحلية
            const approvers = JSON.parse(approvalItem.dataset.assignedNames || '[]');
            const approver = approvers.find(a => a.name === userName);
            if (approver) {
              approver.role = newRole;
              approvalItem.dataset.assignedNames = JSON.stringify(approvers);
            }
          });
          tableRow.appendChild(roleCell);
          
        } else {
          // للجان والمحاضر: بدون تسلسل وبدون نوع تحويل
          
          // خلية الاسم
          const nameCell = document.createElement('div');
          nameCell.className = 'table-cell name';
          nameCell.textContent = u.name;
          tableRow.appendChild(nameCell);
          
          // خلية القسم
          const deptCell = document.createElement('div');
          deptCell.className = 'table-cell department';
          deptCell.textContent = deptName;
          tableRow.appendChild(deptCell);
          
          // خلية الدور (فقط للجان، وليس للمحاضر)
        if (contentType !== 'protocol') {
            const roleCell = document.createElement('div');
            roleCell.className = 'table-cell role';
            roleCell.innerHTML = `
              <div class="role-selector">
                <select class="role-dropdown" data-user-name="${u.name}" data-user-id="${u.id}">
                  <option value="prepared" ${u.role === 'prepared' ? 'selected' : ''}>
                     ${getTranslation('prepared') || 'Prepared'}
                  </option>
                  <option value="updated" ${u.role === 'updated' ? 'selected' : ''}>
                     ${getTranslation('updated') || 'Updated'}
                  </option>
                  <option value="reviewed" ${u.role === 'reviewed' ? 'selected' : ''}>
                     ${getTranslation('reviewed') || 'Reviewed'}
                  </option>
                  <option value="approved" ${u.role === 'approved' ? 'selected' : ''}>
                     ${getTranslation('approved') || 'Approved'}
                  </option>
                </select>
              </div>
            `;
            
            // إضافة event listener لتغيير الدور
            const roleDropdown = roleCell.querySelector('.role-dropdown');
          roleDropdown.addEventListener('change', (e) => {
            const newRole = e.target.value;
            const userName = e.target.dataset.userName;
            
            // تحديث الدور في البيانات المحلية
            const approvers = JSON.parse(approvalItem.dataset.assignedNames || '[]');
            const approver = approvers.find(a => a.name === userName);
            if (approver) {
              approver.role = newRole;
              approvalItem.dataset.assignedNames = JSON.stringify(approvers);
            }
          });
            tableRow.appendChild(roleCell);
          }
        }
        
        // خلية الإجراءات (مشتركة لجميع الأنواع)
        const actionsCell = document.createElement('div');
        actionsCell.className = 'table-cell actions';
        actionsCell.innerHTML = `
          <button class="remove-approver-btn" data-approver-name="${u.name}" title="${getTranslation('remove-approver') || 'حذف المعتمد'}">
            <i class="fas fa-times"></i>
          </button>
        `;
        tableRow.appendChild(actionsCell);
        
        // إضافة event listener لزر الحذف
        const removeBtn = actionsCell.querySelector('.remove-approver-btn');
        removeBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          e.preventDefault();
          
          const approverName = u.name;
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
        
        approversTable.appendChild(tableRow);
      });
      
      selCell.appendChild(approversTable);
    }

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
       const internalUserItems = approvalItem.querySelectorAll('[data-type="internal-users"] .dropdown-item.selected');
       let externalUserItems = [];
       if (externalUserDrop) {
         externalUserItems = approvalItem.querySelectorAll('[data-type="external-users"] .dropdown-item.selected');
       }
       
       const internalUsers = Array.from(internalUserItems)
         .map(el => ({ 
           id: +el.dataset.userId, 
           name: el.textContent.trim(), 
           transferType: 'internal',
           role: 'approved' // الدور الافتراضي - سيتم تحديثه من الواجهة
         }))
         .filter(u => !existingAssignedNames.includes(u.name));
         
       const externalUsers = Array.from(externalUserItems)
         .map(el => ({ 
           id: +el.dataset.userId, 
           name: el.textContent.trim(), 
           transferType: 'external',
           role: 'approved' // الدور الافتراضي - سيتم تحديثه من الواجهة
         }))
         .filter(u => !existingAssignedNames.includes(u.name));
         
       const newUsers = [...internalUsers, ...externalUsers];

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
             // أولوية للتحويل الداخلي
             if (a.transferType === 'internal' && b.transferType === 'external') return -1;
             if (a.transferType === 'external' && b.transferType === 'internal') return 1;
             
             // إذا كان نفس النوع، ترتيب بحسب وقت الاختيار
             const allSelectedUsers = [...selectedInternalUsers];
             if (selectedExternalUsers) {
               allSelectedUsers.push(...selectedExternalUsers);
             }
             const aSelected = allSelectedUsers.find(u => u.id === a.id);
             const bSelected = allSelectedUsers.find(u => u.id === b.id);
             return (aSelected?.selectedAt || 0) - (bSelected?.selectedAt || 0);
           });
         } else {
           // للجان والمحاضر: ترتيب عادي بحسب وقت الاختيار
           sortedNewUsers = newUsers.sort((a, b) => {
             const allSelectedUsers = [...selectedInternalUsers];
             if (selectedExternalUsers) {
               allSelectedUsers.push(...selectedExternalUsers);
             }
             const aSelected = allSelectedUsers.find(u => u.id === a.id);
             const bSelected = allSelectedUsers.find(u => u.id === b.id);
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
          // إرسال المعتمدين مع أدوارهم (فقط للجان والأقسام)
          if (contentType === 'protocol') {
            // للمحاضر: إرسال بدون أدوار
            resp = await fetchJSON(`${apiBase}/${endpoint}`, {
              method: 'POST',
              body: JSON.stringify({ 
                contentId, 
                approvers: allIds
              })
            });
          } else {
            // للجان والأقسام: إرسال مع الأدوار
            const approversWithRoles = sortedNewUsers.map(user => {
              // البحث عن الدور المحدد لهذا المستخدم في الواجهة
              const roleDropdown = approvalItem.querySelector(`.role-dropdown[data-user-name="${user.name}"]`);
              const selectedRole = roleDropdown ? roleDropdown.value : 'approved';
              
              return {
                userId: user.id,
                role: selectedRole
              };
            });
            
            resp = await fetchJSON(`${apiBase}/${endpoint}`, {
              method: 'POST',
              body: JSON.stringify({ 
                contentId, 
                approvers: allIds,
                approversWithRoles: approversWithRoles
              })
            });
          }
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

// إضافة دالة لعرض البطاقات الرئيسية
function showMainCards() {
  const cardsContainer = document.querySelector('.cards-container');
  if (!cardsContainer) return;

  cardsContainer.innerHTML = `
    <div class="main-cards-container">
      <div class="main-card" data-type="department">
        <div class="main-card-header">
          <div class="main-card-icon">
            <i class="fas fa-building"></i>
          </div>
          <div class="main-card-title">${getTranslation('departments') || 'الأقسام'}</div>
        </div>
        <div class="main-card-content">
          <div class="main-card-count" id="departmentCount">0</div>
          <div class="main-card-subtitle">${getTranslation('pending-approvals') || 'في انتظار الاعتماد'}</div>
        </div>
        <div class="main-card-footer">
          <button class="main-card-btn">${getTranslation('view-details') || 'عرض التفاصيل'}</button>
        </div>
      </div>

      <div class="main-card" data-type="committee">
        <div class="main-card-header">
          <div class="main-card-icon">
            <i class="fas fa-users"></i>
          </div>
          <div class="main-card-title">${getTranslation('committees') || 'اللجان'}</div>
        </div>
        <div class="main-card-content">
          <div class="main-card-count" id="committeeCount">0</div>
          <div class="main-card-subtitle">${getTranslation('pending-approvals') || 'في انتظار الاعتماد'}</div>
        </div>
        <div class="main-card-footer">
          <button class="main-card-btn">${getTranslation('view-details') || 'عرض التفاصيل'}</button>
        </div>
      </div>

      <div class="main-card" data-type="protocol">
        <div class="main-card-header">
          <div class="main-card-icon">
            <i class="fas fa-file-alt"></i>
          </div>
          <div class="main-card-title">${getTranslation('protocols') || 'المحاضر'}</div>
        </div>
        <div class="main-card-content">
          <div class="main-card-count" id="protocolCount">0</div>
          <div class="main-card-subtitle">${getTranslation('pending-approvals') || 'في انتظار الاعتماد'}</div>
        </div>
        <div class="main-card-footer">
          <button class="main-card-btn">${getTranslation('view-details') || 'عرض التفاصيل'}</button>
        </div>
      </div>
    </div>

    <div class="detailed-view" style="display: none;">
      <div class="detailed-header">
        <div class="header-left">
          <button class="back-btn-simple" onclick="showMainCards()">
            <i class="fas fa-arrow-left"></i>
            <span>${getTranslation('back-to-main') || 'العودة للرئيسية'}</span>
          </button>
          <h2 id="detailedTitle"></h2>
        </div>
        <div class="detailed-count" id="detailedCount"></div>
      </div>
      <div class="detailed-content" id="detailedContent"></div>
    </div>
  `;

  // إضافة event listeners للبطاقات الرئيسية
  const mainCards = document.querySelectorAll('.main-card');
  mainCards.forEach(card => {
    const viewBtn = card.querySelector('.main-card-btn');
    viewBtn.addEventListener('click', () => {
      const cardType = card.dataset.type;
      showDetailedView(cardType);
    });
  });

  // تم إزالة زر العودة للرئيسية

  // تحميل البيانات وتحديث العدادات
  loadMainCardsData();
}

// دالة لتحميل بيانات البطاقات الرئيسية
async function loadMainCardsData() {
  try {
    const [departmentApprovals, committeeApprovals, protocolApprovals] = await Promise.all([
      fetchJSON(`${apiBase}/pending-approvals`),
      fetchJSON(`${apiBase}/pending-committee-approvals`),
      fetchJSON(`${apiBase}/protocols/pending/approvals`)
    ]);

    // تحديث العدادات
    document.getElementById('departmentCount').textContent = (departmentApprovals || []).length;
    document.getElementById('committeeCount').textContent = (committeeApprovals || []).length;
    document.getElementById('protocolCount').textContent = (protocolApprovals || []).length;
  } catch (err) {
    console.error('Error loading main cards data:', err);
  }
}

// دالة لعرض التفاصيل لنوع محدد
async function showDetailedView(contentType) {
  try {
    // إخفاء البطاقات الرئيسية
    document.querySelector('.main-cards-container').style.display = 'none';
    
    // إظهار التفاصيل فقط
    document.querySelector('.detailed-view').style.display = 'block';

    // تحديث العنوان
    const detailedTitle = document.getElementById('detailedTitle');
    const detailedCount = document.getElementById('detailedCount');
    
    let title, count;
    switch (contentType) {
      case 'department':
        title = getTranslation('departments') || 'الأقسام';
        break;
      case 'committee':
        title = getTranslation('committees') || 'اللجان';
        break;
      case 'protocol':
        title = getTranslation('protocols') || 'المحاضر';
        break;
    }
    
    detailedTitle.textContent = title;

    // تحميل البيانات المحددة
    await loadSpecificContent(contentType);
    
  } catch (err) {
    console.error('Error showing detailed view:', err);
  }
}

// دالة لتحميل محتوى محدد
async function loadSpecificContent(contentType) {
  try {
    let data;
    let endpoint;
    
    switch (contentType) {
      case 'department':
        endpoint = `${apiBase}/pending-approvals`;
        break;
      case 'committee':
        endpoint = `${apiBase}/pending-committee-approvals`;
        break;
      case 'protocol':
        endpoint = `${apiBase}/protocols/pending/approvals`;
        break;
    }
    
    data = await fetchJSON(endpoint);
    
    // تجهيز البيانات
    const items = (data || []).map(item => ({ ...item, type: contentType }));
    
    if (contentType === 'protocol') {
      items.forEach(item => {
        let approversReq = item.approvers_required;
        try {
          if (typeof approversReq === 'string') {
            approversReq = JSON.parse(approversReq || '[]');
          }
        } catch { approversReq = []; }
        item.approvers_required = approversReq;
      });
    }

    // تحديث العداد
    document.getElementById('detailedCount').textContent = `${items.length} ${getTranslation('item') || 'عنصر'}`;

    // تحديد المستخدم الحالي
    const token = localStorage.getItem('token');
    const decodedToken = token ? await safeGetUserInfo(token) : null;
    const currentUserId = decodedToken ? decodedToken.id : null;

    // عرض البيانات
    displaySpecificContent(items, currentUserId, contentType);
    
  } catch (err) {
    console.error('Error loading specific content:', err);
  }
}

// دالة لعرض المحتوى المحدد
function displaySpecificContent(items, currentUserId, contentType) {
  const detailedContent = document.getElementById('detailedContent');
  
  if (items.length === 0) {
    detailedContent.innerHTML = `
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

  // إنشاء العناصر
  detailedContent.innerHTML = '';
  sortedItems.forEach(item => {
    const approvalItem = createApprovalItem(item);
    detailedContent.appendChild(approvalItem);
  });

  // إعادة تهيئة الـ dropdowns
  initDropdowns();
}

// دالة آمنة لجلب معلومات المستخدم
async function safeGetUserInfo(token) {
  try {
    const response = await fetch(`${apiBase}/auth/verify-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.user || data;
    }
    return null;
  } catch (error) {
    console.error('Error getting user info:', error);
    return null;
  }
}

// دالة للحصول على الترجمة
function getTranslation(key) {
  const translations = {
    'ar': {
      'departments': 'الأقسام',
      'committees': 'اللجان',
      'protocols': 'المحاضر',
      'pending-approvals': 'في انتظار الاعتماد',
      'view-details': 'عرض التفاصيل',
      'back-to-main': 'العودة للرئيسية',
      'no-pending-approvals': 'لا توجد ملفات بانتظار الاعتماد',
      'item': 'عنصر',
      'approver': 'معتمد',
      'days': 'أيام',
      'hours': 'ساعات',
      'minutes': 'دقائق',
      'title': 'العنوان',
      'type': 'النوع',
      'committee-file': 'ملف لجنة',
      'protocol-file': 'محضر',
      'department-report': 'تقرير قسم',
      'sent': 'تم الإرسال',
      'waiting-send': 'بانتظار الإرسال',
      'select-department': 'اختر القسم',
      'search-department': 'البحث في الأقسام',
      'select-people': 'اختر الأشخاص',
      'select-department-first': 'اختر القسم أولاً',
      'search-person': 'البحث في الأشخاص',
      'add-more': 'إضافة المزيد',
      'send': 'إرسال',
      'sequential': 'تسلسلي',
      'set-deadline': 'تحديد موعد نهائي',
      'remove-approver': 'حذف المعتمد',
      'confirm-remove-approver': 'هل أنت متأكد من حذف المعتمد؟',
      'approver-removed-success': 'تم حذف المعتمد بنجاح',
      'remove-approver-failed': 'فشل في حذف المعتمد',
      'no-new-approvers': 'لم يتم اختيار معتمدين جدد',
      'add-more-success': 'تم إضافة المعتمدين بنجاح',
      'send-failed': 'فشل في الإرسال',
      'internal-first-external-second': 'داخلي أولاً، ثم خارجي',
             'internal-transfer': 'التحويل الداخلي',
       'external-transfer': 'التحويل الخارجي',
       'select-internal-department': 'اختر القسم الداخلي',
       'select-external-department': 'اختر القسم الخارجي',
       'select-internal-people': 'اختر الأشخاص الداخليين',
       'select-external-people': 'اختر الأشخاص الخارجيين',
      'departments-count': 'أقسام',
      'selected-count': 'مختار',
      'file-link-unavailable': 'رابط الملف غير متوفر',
      'select-role': 'اختر الدور',
      'prepared': 'Prepared',
      'updated': 'Updated',
      'reviewed': 'Reviewed',
      'approved': 'Approved',
      'role-info': 'سيتم تحديد الدور لكل شخص',
      'role-per-person': 'يمكنك تحديد دور مختلف لكل معتمد',
      'sequence': 'التسلسل',
      'name': 'الاسم',
      'department': 'القسم',
      'transfer-type': 'نوع التحويل',
      'role': 'الدور',
      'actions': 'الإجراءات',
      'internal': 'داخلي',
      'external': 'خارجي',
      'collapse-card': 'تصغير الكارد',
      'expand-card': 'تكبير الكارد',
      'sent-to': 'مرسل إلى'
    },
    'en': {
      'departments': 'Departments',
      'committees': 'Committees',
      'protocols': 'Protocols',
      'pending-approvals': 'Pending Approvals',
      'view-details': 'View Details',
      'back-to-main': 'Back to Main',
      'no-pending-approvals': 'No pending approvals',
      'item': 'item',
      'approver': 'Approver',
      'days': 'Days',
      'hours': 'Hours',
      'minutes': 'Minutes',
      'title': 'Title',
      'type': 'Type',
      'committee-file': 'Committee File',
      'protocol-file': 'Protocol',
      'department-report': 'Department Report',
      'sent': 'Sent',
      'waiting-send': 'Waiting to Send',
      'select-department': 'Select Department',
      'search-department': 'Search Departments',
      'select-people': 'Select People',
      'select-department-first': 'Select Department First',
      'search-person': 'Search People',
      'add-more': 'Add More',
      'send': 'Send',
      'sequential': 'Sequential',
      'set-deadline': 'Set Deadline',
      'remove-approver': 'Remove Approver',
      'confirm-remove-approver': 'Are you sure you want to remove the approver?',
      'approver-removed-success': 'Approver removed successfully',
      'remove-approver-failed': 'Failed to remove approver',
      'no-new-approvers': 'No new approvers selected',
      'add-more-success': 'Approvers added successfully',
      'send-failed': 'Send failed',
      'internal-first-external-second': 'Internal first, then external',
             'internal-transfer': 'Internal Transfer',
       'external-transfer': 'External Transfer',
       'select-internal-department': 'Select Internal Department',
       'select-external-department': 'Select External Department',
       'select-internal-people': 'Select Internal People',
       'select-external-people': 'Select External People',
      'departments-count': 'departments',
      'selected-count': 'selected',
      'file-link-unavailable': 'File link unavailable',
      'select-role': 'Select Role',
      'prepared': 'Prepared',
      'updated': 'Updated',
      'reviewed': 'Reviewed',
      'approved': 'Approved',
      'role-info': 'Role will be set for each person',
      'role-per-person': 'You can set different role for each approver',
      'sequence': 'Sequence',
      'name': 'Name',
      'department': 'Department',
      'transfer-type': 'Transfer Type',
      'role': 'Role',
      'actions': 'Actions',
      'internal': 'Internal',
      'external': 'External',
      'collapse-card': 'Collapse Card',
      'expand-card': 'Expand Card',
      'sent-to': 'Sent to'
    }
  };

  const currentLang = localStorage.getItem('language') || 'ar';
  return translations[currentLang]?.[key] || key;
}
