// committee.js
const apiBase = 'http://localhost:3006/api';

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

  const addCommitteeNameArInput = document.getElementById('committeeNameAr');
  const addCommitteeNameEnInput = document.getElementById('committeeNameEn');
  const editCommitteeNameArInput = document.getElementById('editCommitteeNameAr');
  const editCommitteeNameEnInput = document.getElementById('editCommitteeNameEn');

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
      showToast(getTranslation('please-login'), 'warning');
      return window.location.href = 'login.html';
    }
  }

  // Helper function for API calls
  async function apiCall(url, options = {}) {
    const defaultOptions = {
      headers: {
        ...authHeaders(),
        ...options.headers
      }
    };
    
    // إذا كان body من نوع FormData، لا نضيف Content-Type header
    // لأن المتصفح يضيفه تلقائياً مع boundary
    if (options.body instanceof FormData) {
      delete defaultOptions.headers['Content-Type'];
    }
    
    const finalOptions = { ...defaultOptions, ...options };
    
    try {

      
      const res = await fetch(url, finalOptions);
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || 'API Error');
      }
      
      // التأكد من أن الاستجابة تحتوي على البيانات المطلوبة
      if (data && typeof data === 'object') {
        console.log('Valid response received');
        return data;
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('API Error:', err);
      console.error('API Error details:', {
        message: err.message,
        stack: err.stack,
        name: err.name,
        url: url,
        method: finalOptions.method
      });
      throw err;
    }
  }

  // permissions state
  const permissions = { canAdd: false, canEdit: false, canDelete: false };

  // fetch user role & permissions
  async function fetchPermissions() {
    const userId = getUserId();
    if (!userId) return;

    try {
      // 1) get user to check role
      const { data: user } = await apiCall(`${apiBase}/users/${userId}`);
      if (user.role === 'admin') {
        permissions.canAdd = permissions.canEdit = permissions.canDelete = true;
      }

      // 2) get explicit permissions
      const { data: perms } = await apiCall(`${apiBase}/users/${userId}/permissions`);
      const keys = perms.map(p => typeof p === 'string' ? p : p.permission_key || p.permission);

      if (keys.includes('add_committee'))    permissions.canAdd    = true;
      if (keys.includes('edit_committee'))   permissions.canEdit   = true;
      if (keys.includes('delete_committee')) permissions.canDelete = true;
    } catch (err) {
      console.error('Error fetching permissions:', err);
    }
  }

  function updateAddButton() {
    addBtn.style.display = permissions.canAdd ? 'inline-block' : 'none';
  }

  function showModal(m) { m.style.display = 'flex'; }
  function hideModal(m) {
    m.style.display = 'none';
    // reset inputs
    if (m === addModal) {
      // إعادة تعيين حقول الإضافة
      if (addCommitteeNameArInput) addCommitteeNameArInput.value = '';
      if (addCommitteeNameEnInput) addCommitteeNameEnInput.value = '';
      
      const committeeImageInput = document.getElementById('committeeImage');
      if (committeeImageInput) committeeImageInput.value = '';
    }
    if (m === editModal) {
      // إعادة تعيين حقول التعديل
      if (editIdInput) editIdInput.value = '';
      if (editCommitteeNameArInput) editCommitteeNameArInput.value = '';
      if (editCommitteeNameEnInput) editCommitteeNameEnInput.value = '';
      if (editImage) editImage.value = '';
    }
  }

  // load & render
  async function loadCommittees() {
    try {
      const list = await apiCall(`${apiBase}/committees`);
      
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
    } catch (err) {
      showToast(getTranslation('error-fetching-committees'), 'error');
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
        icons += `<button class="edit-icon" data-id="${committee.id}" data-name='${committee.name}' aria-label="${getTranslation('edit')}">
                    <img src="../images/edit.svg" alt="${getTranslation('edit')}">
                  </button>`;
      }
      if (permissions.canDelete) {
        icons += `<button class="delete-icon" data-id="${committee.id}" aria-label="${getTranslation('delete')}">
                    <img src="../images/delet.svg" alt="${getTranslation('delete')}">
                  </button>`;
      }
      icons += `</div>`;
    }

    // استخراج الاسم حسب اللغة
    let committeeName;
    try {
      const parsed = JSON.parse(committee.name);
      const lang = localStorage.getItem('language') || 'ar';
      committeeName = parsed[lang] || parsed['ar'] || committee.name;
    } catch {
      committeeName = committee.name;
    }

    // معالجة مسار الصورة للتوافق مع المسارات القديمة والجديدة
    let imgSrc;
    let hasImage = false;
    
    if (committee.image && committee.image.trim() !== '') {
      hasImage = true;
      if (committee.image.startsWith('backend/uploads/')) {
        // المسار الجديد: backend/uploads/images/filename.jpg
        imgSrc = `http://localhost:3006/${committee.image}`;
      } else if (committee.image.startsWith('uploads/')) {
        // المسار القديم: uploads/images/filename.jpg
        imgSrc = `http://localhost:3006/${committee.image}`;
      } else if (committee.image.startsWith('frontend/images/')) {
        // المسار القديم: frontend/images/filename.jpg
        imgSrc = `http://localhost:3006/${committee.image}`;
      } else if (committee.image.includes('\\') || committee.image.includes('/')) {
        // مسار كامل للنظام، استخرج اسم الملف فقط
        const fileName = committee.image.split(/[\\/]/).pop();
        imgSrc = `http://localhost:3006/backend/uploads/images/${fileName}`;
      } else {
        // اسم ملف فقط
        imgSrc = `http://localhost:3006/backend/uploads/images/${committee.image}`;
      }
    } else {
      // لا توجد صورة
      hasImage = false;
      imgSrc = '../images/committee.svg';
    }

    // إنشاء عنصر الصورة مع التعامل مع الحالات التي لا توجد فيها صورة
    const imageElement = hasImage ? 
        `<img src="${imgSrc}" alt="${committeeName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` :
        `<div style="font-size: 24px; color: #fff; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">${committeeName.charAt(0).toUpperCase()}</div>`;
    
    // إضافة fallback للصور التي تفشل في التحميل
    const fallbackElement = `<div style="font-size: 24px; color: #fff; display: none; align-items: center; justify-content: center; width: 100%; height: 100%;">${committeeName.charAt(0).toUpperCase()}</div>`;

    card.innerHTML = `
      ${icons}
      <div class="card-icon bg-orange">
        ${imageElement}
        ${fallbackElement}
      </div>
      <div class="card-title">${committeeName}</div>
    `;

    card.addEventListener('click', () => {
      window.location.href = `committee-content.html?committeeId=${committee.id}`;
    });

    return card;
  }

  // event handlers
  function onEditClick(e) {
    e.stopPropagation();
    const el = e.currentTarget;
    const id = el.dataset.id;
    const nameData = el.dataset.name;
    editIdInput.value = id;
    try {
      const parsedName = JSON.parse(nameData);
      editCommitteeNameArInput.value = parsedName.ar || '';
      editCommitteeNameEnInput.value = parsedName.en || '';
    } catch {
      editCommitteeNameArInput.value = nameData || '';
      editCommitteeNameEnInput.value = '';
    }
    showModal(editModal);
  }

  function onDeleteClick(e) {
    e.stopPropagation();
    const id = e.currentTarget.dataset.id;
    deleteModal.dataset.committeeId = id;
    showModal(deleteModal);
  }

  // Helper function for form data creation
  function createCommitteeFormData(nameAr, nameEn, file) {
    const name = JSON.stringify({ ar: nameAr, en: nameEn });
    const fd = new FormData();
    fd.append('name', name);
    if (file) {
      fd.append('image', file);
    }
    
    // للتأكد من أن FormData تم إنشاؤه بشكل صحيح
    console.log('FormData created:', {
      name: name,
      hasFile: !!file,
      fileName: file ? file.name : 'no file'
    });
    
    return fd;
  }

  // Add committee
  addBtn.addEventListener('click', () => showModal(addModal));
  saveAddBtn.addEventListener('click', async () => {
    if (!permissions.canAdd) return;
    
    const nameAr = addCommitteeNameArInput.value.trim();
    const nameEn = addCommitteeNameEnInput.value.trim();
    const file = document.getElementById('committeeImage').files[0];
    
    if (!nameAr || !nameEn) {
      showToast('الرجاء إدخال الاسم بالعربية والإنجليزية.', 'warning');
      return;
    }

    try {
      const formData = createCommitteeFormData(nameAr, nameEn, file);
      console.log('Sending formData:', formData);
      
      const result = await apiCall(`${apiBase}/committees`, {
        method: 'POST',
        body: formData
      });
      
      console.log('API Response:', result);
      
      showToast(getTranslation('committee-added-success'), 'success');
      hideModal(addModal);
      
             // إضافة اللجنة الجديدة مباشرة للعرض
       const newCommittee = result.committee || {
         id: result.committeeId || result.id,
         name: JSON.stringify({ ar: nameAr, en: nameEn }),
         image: file ? `backend/uploads/images/${file.name}` : ''
       };
       
       // التأكد من أن لدينا ID صحيح
       if (!newCommittee.id) {
         console.error('No committee ID received from server');
         showToast('خطأ في استلام معرف اللجنة من الخادم', 'error');
         return;
       }
      
      console.log('New committee object:', newCommittee);
      
      // إضافة اللجنة الجديدة في بداية القائمة
      const newCard = createCard(newCommittee);
      grid.insertBefore(newCard, grid.firstChild);
      
      // إضافة event listeners للكارد الجديد
      if (permissions.canEdit) {
        newCard.querySelector('.edit-icon')?.addEventListener('click', onEditClick);
      }
      if (permissions.canDelete) {
        newCard.querySelector('.delete-icon')?.addEventListener('click', onDeleteClick);
      }
      
      // إضافة click event للكارد الجديد
      newCard.addEventListener('click', () => {
        window.location.href = `committee-content.html?committeeId=${newCommittee.id}`;
      });
         } catch (err) {
       console.error('Error adding committee:', err);
       console.error('Error details:', {
         message: err.message,
         stack: err.stack,
         name: err.name
       });
       
       // عرض رسالة خطأ أكثر تفصيلاً
       let errorMessage = getTranslation('error-adding-committee');
       if (err.message.includes('NetworkError') || err.message.includes('fetch')) {
         errorMessage = 'خطأ في الاتصال بالخادم';
       } else if (err.message.includes('Unauthorized')) {
         errorMessage = 'غير مصرح لك بإضافة لجنة';
       }
       
       showToast(errorMessage, 'error');
     }
  });
  cancelAdd.addEventListener('click', () => hideModal(addModal));

  // Edit committee
  saveEditBtn.addEventListener('click', async () => {
    if (!permissions.canEdit) return;
    
    const id = editIdInput.value;
    const nameAr = editCommitteeNameArInput.value.trim();
    const nameEn = editCommitteeNameEnInput.value.trim();
    const file = editImage.files[0];
    
    if (!id || !nameAr || !nameEn) {
      showToast('الرجاء إدخال الاسم بالعربية والإنجليزية.', 'warning');
      return;
    }

    try {
      const formData = createCommitteeFormData(nameAr, nameEn, file);
      console.log('Sending update formData:', formData);
      
      const result = await apiCall(`${apiBase}/committees/${id}`, {
        method: 'PUT',
        body: formData
      });
      
      console.log('Update API Response:', result);
      
      showToast(getTranslation('committee-updated-success'), 'success');
      hideModal(editModal);
      
             // تحديث اللجنة مباشرة في الواجهة بدلاً من إعادة تحميل كل اللجان
       const existingCard = grid.querySelector(`[data-id="${id}"]`);
       if (existingCard) {
         const updatedCommittee = result.committee || {
           id: id,
           name: JSON.stringify({ ar: nameAr, en: nameEn }),
           image: file ? `backend/uploads/images/${file.name}` : existingCard.querySelector('.card-icon img')?.src || ''
         };
         
         // التأكد من أن لدينا بيانات صحيحة
         if (!updatedCommittee.id) {
           console.error('No committee ID in update response');
           showToast('خطأ في استلام بيانات اللجنة المحدثة', 'error');
           return;
         }
        
        console.log('Updated committee object:', updatedCommittee);
        
        const updatedCard = createCard(updatedCommittee);
        existingCard.replaceWith(updatedCard);
        
        // إضافة event listeners للكارد المحدث
        if (permissions.canEdit) {
          updatedCard.querySelector('.edit-icon')?.addEventListener('click', onEditClick);
        }
        if (permissions.canDelete) {
          updatedCard.querySelector('.delete-icon')?.addEventListener('click', onDeleteClick);
        }
        
        // إضافة click event للكارد المحدث
        updatedCard.addEventListener('click', () => {
          window.location.href = `committee-content.html?committeeId=${updatedCommittee.id}`;
        });
      }
         } catch (err) {
       console.error('Error updating committee:', err);
       console.error('Error details:', {
         message: err.message,
         stack: err.stack,
         name: err.name
       });
       
       // عرض رسالة خطأ أكثر تفصيلاً
       let errorMessage = getTranslation('error-updating-committee');
       if (err.message.includes('NetworkError') || err.message.includes('fetch')) {
         errorMessage = 'خطأ في الاتصال بالخادم';
       } else if (err.message.includes('Unauthorized')) {
         errorMessage = 'غير مصرح لك بتعديل اللجنة';
       }
       
       showToast(errorMessage, 'error');
     }
  });
  cancelEdit.addEventListener('click', () => hideModal(editModal));

  // Delete committee
  confirmDel.addEventListener('click', async () => {
    if (!permissions.canDelete) return;
    
    const id = deleteModal.dataset.committeeId;
    
    try {
      await apiCall(`${apiBase}/committees/${id}`, {
        method: 'DELETE'
      });
      
      showToast(getTranslation('committee-deleted-success'), 'success');
      hideModal(deleteModal);
      
      // حذف اللجنة مباشرة من الواجهة بدلاً من إعادة تحميل كل اللجان
      const existingCard = grid.querySelector(`[data-id="${id}"]`);
      if (existingCard) {
        existingCard.remove();
      }
    } catch (err) {
      showToast(getTranslation('error-deleting-committee'), 'error');
    }
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

  // Close modals when clicking overlay
  document.querySelectorAll('.modal-overlay').forEach(m => {
    m.addEventListener('click', e => {
      if (e.target === m) hideModal(m);
    });
  });

  // init sequence
  checkAuth();
  await fetchPermissions();
  updateAddButton();
  loadCommittees();
});
