// committee.js
const apiBase = 'http://localhost:3006/api';

// متغيرات الصفحات
let allCommittees = [];
let filteredCommittees = [];
let currentPage = 1;
const committeesPerPage = 20;

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

// دالة الحصول على اللجان للصفحة الحالية
function getPaginatedCommittees() {
    const startIndex = (currentPage - 1) * committeesPerPage;
    const endIndex = startIndex + committeesPerPage;
    return filteredCommittees.slice(startIndex, endIndex);
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded in committees.js');
    
    // Initialize deleted items modal
    let deletedItemsModal;
    if (typeof DeletedItemsModal !== 'undefined') {
        deletedItemsModal = new DeletedItemsModal();
    }
    
    // Add deleted items button
    const pageHeader = document.querySelector('.page-header');
    console.log('Page header found:', pageHeader);
    
    if (pageHeader) {
        const deletedItemsBtn = document.createElement('button');
        deletedItemsBtn.className = 'btn-primary deleted-items-btn';
        deletedItemsBtn.innerHTML = `
            <i class="fas fa-trash-restore"></i>
            <span data-translate="deleted-items">ما تم حذفه</span>
        `;
        
        const title = pageHeader.querySelector('h1');
        console.log('Title element found:', title);
        
        if (title) {
            title.parentNode.insertBefore(deletedItemsBtn, title.nextSibling);
            console.log('Deleted items button inserted successfully');
        } else {
            console.log('Title element not found, inserting at end of page-header');
            pageHeader.appendChild(deletedItemsBtn);
        }
        
        // Add click event to open modal
        deletedItemsBtn.addEventListener('click', () => {
            if (deletedItemsModal) {
                deletedItemsModal.show('committees');
            } else {
                console.error('DeletedItemsModal not initialized');
            }
        });
    } else {
        console.log('Page header not found');
    }

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

  // Utility to clean image path
  function cleanImagePath(imagePath) {
    if (!imagePath) return '';
    
    // إزالة http://localhost:3006/ من بداية المسار إذا كان موجوداً
    if (imagePath.startsWith('http://localhost:3006/')) {
      return imagePath.replace('http://localhost:3006/', '');
    }
    
    // إزالة / من بداية المسار إذا كان موجوداً
    if (imagePath.startsWith('/')) {
      return imagePath.substring(1);
    }
    
    return imagePath;
  }

  // قائمة الصور المتاحة من مجلد frontend/images
  const availableImagesList = [
    'health information.png',
    'wheat allergy centre.png',
    'blood bank.png',
    'patient experience.png',
    'family management.png',
    'admissions management and access support.png',
    'oral and maxillofacial surgery.png',
    'ophthalmology unit.png',
    'vascular surgery.png',
    'internal medicine rheumatology.png',
    'internal medicine endocrinology.png',
    'internal medicine palliative care.png',
    'internal medicine neurology.png',
    'internal medicine nephrology.png',
    'internal medicine infectious diseases.png',
    'internal medicine pulmonary.png',
    'internal medicine cardiology.png',
    'internal medicine hematology.png',
    'digital health.png',
    'cybersecurity.png',
    'admissions office.png',
    'patient affairs.png',
    'medical services office.png',
    'surgery.png',
    'Virtual Clinics.png',
    'Strategic and Transformation Management.png',
    'Social Care Services.png',
    'Self Resources.png',
    'Respiratory Care Services.png',
    'research and innovation.png',
    'Rehabilitation.png',
    'Radiology.png',
    'quality and patient safety.png',
    'QPS KPIs.png',
    'Public Health.png',
    'Provision of Care.png',
    'Procurement.png',
    'privileges and competencies.png',
    'Pharmacy.png',
    'Patient and Family Rights.png',
    'Outpatient.png',
    'Occupational Health.png',
    'Nursing.png',
    'Neurosurgery.png',
    'Medical Statistics.png',
    'Manual.png',
    'Management of Information.png',
    'Legal Affairs.png',
    'Laboratory.png',
    'internal control and audit.png',
    'intensive care unit.png',
    'Improvement Projects.png',
    'Human Resources.png',
    'Home Care Services.png',
    'Hemodialysis.png',
    'health informatics.png',
    'Guest Services.png',
    'Geriatric Medicine.png',
    'financial management.png',
    'finance.png',
    'ent.png',
    'Endoscopy.png',
    'Emergency.png',
    'Emergency Medicine.png',
    'Dermatology.png',
    'Dental Services.png',
    'Day Procedure Unit.png',
    'CSSD.png',
    'Communications.png',
    'Commitment.png',
    'Clinics.png',
    'Clinical Audit.png',
    'CEO Office.png',
    'Capacity Management.png',
    'Anesthesia Care.png',
    'ADAA KPIs.png',
    'Urology.png',
    'Supply Chain.png',
    'Supervisor of Managers on Duty.png',
    'Religious Awareness.png',
    'Psychiatric Medical Care.png',
    'Patient Safety KPIs.png',
    'Orthopedic.png',
    'Optometry Clinic.png',
    'Operation Room.png',
    'Mortuary.png',
    'Medical Staff.png',
    'Medical Coordinator.png',
    'Leadership.png',
    'Investment.png',
    'Inventory Control.png',
    'Internal Medicine.png',
    'Infection Prevention andControl.png',
    'Infection Prevention and Control.png',
    'Health Education.png',
    'General Services.png',
    'Facilities Management and Safety.png',
    'esr.png',
    'Emergency Planning and Preparedness.png',
    'Education and Academic Affairs.png'
  ];

  // دالة جلب الصور المتاحة
  async function fetchAvailableImages() {
    try {
      const images = availableImagesList.map(imageName => ({
        name: imageName,
        path: `frontend/images/${imageName}`
      }));
      return images;
    } catch (err) {
      console.error('Error fetching available images:', err);
      return [];
    }
  }

  // دالة فتح نافذة اختيار الصور
  function openImageSelector(currentImage = '', onImageSelect) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 10000;';
    
    modal.innerHTML = `
      <div class="modal-content" style="background: white; padding: 20px; border-radius: 8px; max-width: 800px; max-height: 80vh; overflow-y: auto; position: relative;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="margin: 0;">${getTranslation('select-image') || 'اختر صورة'}</h3>
          <button class="close-btn" style="background: none; border: none; font-size: 24px; cursor: pointer;">&times;</button>
        </div>
        
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 10px; font-weight: bold;">
            ${getTranslation('upload-new-image') || 'رفع صورة جديدة:'}
          </label>
          <input type="file" id="newImageInput" accept="image/*" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        </div>
        
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 10px; font-weight: bold;">
            ${getTranslation('select-existing-image') || 'أو اختر من الصور الموجودة:'}
          </label>
          <div id="imagesGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; max-height: 400px; overflow-y: auto;">
            <div style="text-align: center; padding: 20px; color: #666;">
              ${getTranslation('loading-images') || 'جاري تحميل الصور...'}
            </div>
          </div>
        </div>
        
        <div style="display: flex; justify-content: flex-end; gap: 10px;">
          <button id="cancelImageSelect" style="padding: 8px 16px; border: 1px solid #ddd; background: #f8f9fa; border-radius: 4px; cursor: pointer;">
            ${getTranslation('cancel') || 'إلغاء'}
          </button>
          <button id="confirmImageSelect" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; display: none;">
            ${getTranslation('confirm') || 'تأكيد'}
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // إغلاق النافذة
    const closeModal = () => {
      modal.remove();
    };
    
    modal.querySelector('.close-btn').addEventListener('click', closeModal);
    modal.querySelector('#cancelImageSelect').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    
    // تحميل الصور المتاحة
    let availableImages = [];
    let selectedImage = null;
    
    fetchAvailableImages().then(images => {
      availableImages = images;
      const imagesGrid = modal.querySelector('#imagesGrid');
      
      if (images.length === 0) {
        imagesGrid.innerHTML = `
          <div style="text-align: center; padding: 20px; color: #666; grid-column: 1 / -1;">
            ${getTranslation('no-images-available') || 'لا توجد صور متاحة'}
          </div>
        `;
        return;
      }
      
      imagesGrid.innerHTML = '';
      images.forEach(image => {
        const imageCard = document.createElement('div');
        imageCard.className = 'image-card';
        imageCard.style.cssText = 'border: 2px solid #ddd; border-radius: 8px; padding: 10px; cursor: pointer; text-align: center; transition: all 0.3s;';
        imageCard.dataset.imagePath = image.path;
        imageCard.dataset.imageName = image.name;
        
        // التحقق من استخدام الصورة
        const isUsed = allCommittees.some(committee => committee.image === image.path);
        if (isUsed) {
          imageCard.style.opacity = '0.5';
          imageCard.style.cursor = 'not-allowed';
          imageCard.title = getTranslation('image-already-used') || 'هذه الصورة مستخدمة بالفعل';
        }
        
        imageCard.innerHTML = `
          <img src="../images/${image.name}" alt="${image.name}" 
               style="width: 100%; height: 80px; object-fit: cover; border-radius: 4px; margin-bottom: 8px;">
          <div style="font-size: 12px; color: #666; word-break: break-word;">${image.name}</div>
          ${isUsed ? '<div style="font-size: 10px; color: #ff6b6b; margin-top: 4px;">مستخدمة</div>' : ''}
        `;
        
        if (!isUsed) {
          imageCard.addEventListener('click', () => {
            // إزالة التحديد من جميع الصور
            modal.querySelectorAll('.image-card').forEach(card => {
              card.style.borderColor = '#ddd';
              card.style.backgroundColor = 'transparent';
            });
            
            // تحديد الصورة المختارة
            imageCard.style.borderColor = '#007bff';
            imageCard.style.backgroundColor = '#e3f2fd';
            selectedImage = `frontend/images/${image.name}`;
            
            // إظهار زر التأكيد
            modal.querySelector('#confirmImageSelect').style.display = 'inline-block';
          });
        }
        
        imagesGrid.appendChild(imageCard);
      });
    });
    
    // معالجة اختيار صورة جديدة
    const newImageInput = modal.querySelector('#newImageInput');
    newImageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        // إزالة التحديد من الصور الموجودة
        modal.querySelectorAll('.image-card').forEach(card => {
          card.style.borderColor = '#ddd';
          card.style.backgroundColor = 'transparent';
        });
        
        selectedImage = { file: file, isNew: true };
        modal.querySelector('#confirmImageSelect').style.display = 'inline-block';
      }
    });
    
    // تأكيد الاختيار
    modal.querySelector('#confirmImageSelect').addEventListener('click', () => {
      if (selectedImage) {
        onImageSelect(selectedImage);
        closeModal();
      }
    });
  }
  async function getUserId() {
    const token = getToken();
    if (!token) return null;
    try {
      const payload = await safeGetUserInfo(token);
      return payload ? (payload.id || payload.userId || payload.sub || null) : null;
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
    const userId = await getUserId();
    if (!userId) return;

    try {
      // 1) get user to check role
      const { data: user } = await apiCall(`${apiBase}/users/${userId}`);
      if (user.role === 'admin' || user.role === 'super_admin') {
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
      
      // مسح معاينة الصورة
      const previewDiv = document.getElementById('committeeImagePreview');
      if (previewDiv) previewDiv.innerHTML = '';
      
      // مسح الصورة المختارة
      delete addModal.dataset.selectedExistingImage;
    }
    if (m === editModal) {
      // إعادة تعيين حقول التعديل
      if (editIdInput) editIdInput.value = '';
      if (editCommitteeNameArInput) editCommitteeNameArInput.value = '';
      if (editCommitteeNameEnInput) editCommitteeNameEnInput.value = '';
      if (editImage) editImage.value = '';
      
      // مسح معاينة الصورة
      const previewDiv = document.getElementById('editCommitteeImagePreview');
      if (previewDiv) previewDiv.innerHTML = '';
      
      // مسح الصورة المختارة
      delete editModal.dataset.selectedExistingImage;
    }
  }

  // دالة عرض الصفحات
  function renderPagination() {
    // إزالة الصفحات الموجودة مسبقاً
    const existingPagination = document.querySelector('.pagination');
    if (existingPagination) {
      existingPagination.remove();
    }

    const totalPages = Math.ceil(filteredCommittees.length / committeesPerPage);
    if (totalPages <= 1) return;

    const paginationContainer = document.createElement('div');
    paginationContainer.className = 'pagination';

    // معلومات الصفحة
    const pageInfo = document.createElement('div');
    pageInfo.className = 'page-info';
    pageInfo.textContent = `${getTranslation('page')} ${currentPage} ${getTranslation('of')} ${totalPages}`;

    // معلومات العدد الإجمالي
    const totalInfo = document.createElement('div');
    totalInfo.className = 'total-info';
    totalInfo.textContent = `${getTranslation('total-committees')}: ${filteredCommittees.length}`;

    // أزرار التنقل
    const prevBtn = document.createElement('button');
    prevBtn.className = 'pagination-btn';
    prevBtn.disabled = currentPage === 1;
    prevBtn.innerHTML = `<i class="fas fa-chevron-left"></i>`;
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderCommittees();
        renderPagination();
      }
    });

    const nextBtn = document.createElement('button');
    nextBtn.className = 'pagination-btn';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.innerHTML = `<i class="fas fa-chevron-right"></i>`;
    nextBtn.addEventListener('click', () => {
      if (currentPage < totalPages) {
        currentPage++;
        renderCommittees();
        renderPagination();
      }
    });

    paginationContainer.appendChild(pageInfo);
    paginationContainer.appendChild(totalInfo);
    paginationContainer.appendChild(prevBtn);
    paginationContainer.appendChild(nextBtn);

    // إضافة الصفحات بعد الشبكة
    grid.parentNode.insertBefore(paginationContainer, grid.nextSibling);
  }

  // دالة عرض اللجان
  function renderCommittees() {
    const committeesToRender = getPaginatedCommittees();
    
    grid.innerHTML = '';
    committeesToRender.forEach(item => {
      const card = createCard(item);
      grid.appendChild(card);
    });

    // إضافة event listeners للكروت
    if (permissions.canEdit) {
      grid.querySelectorAll('.edit-icon')
        .forEach(btn => btn.addEventListener('click', onEditClick));
    }
    if (permissions.canDelete) {
      grid.querySelectorAll('.delete-icon')
        .forEach(btn => btn.addEventListener('click', onDeleteClick));
    }
  }

  // load & render
  async function loadCommittees() {
    try {
      const list = await apiCall(`${apiBase}/committees`);
      
      allCommittees = list; // Store all fetched committees
      filteredCommittees = list; // Initialize filtered committees with all fetched ones
      renderCommittees(); // Render all fetched committees initially
      renderPagination(); // Render pagination for all fetched committees
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
      // تنظيف مسار الصورة وإضافة localhost إذا لم يكن موجوداً
      const cleanPath = cleanImagePath(committee.image);
      imgSrc = cleanPath.startsWith('http') ? cleanPath : `http://localhost:3006/${cleanPath}`;
    } else {
      // لا توجد صورة
      hasImage = false;
      imgSrc = '../images/committee.svg';
    }

    // إنشاء عنصر الصورة مع التعامل مع الحالات التي لا توجد فيها صورة
    let imageElement;
    if (hasImage) {
        imageElement = `<img src="${imgSrc}" alt="${committeeName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" onload="this.nextElementSibling.style.display='none';">`;
    } else {
        imageElement = `<div style="font-size: 24px; color: #fff; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">${committeeName.charAt(0).toUpperCase()}</div>`;
    }
    
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

    // إضافة معالج الأحداث للصورة
    const imgElement = card.querySelector('img');
    if (imgElement) {
        imgElement.addEventListener('error', function() {
            console.warn('فشل تحميل صورة اللجنة:', this.src);
            this.style.display = 'none';
            const fallback = this.nextElementSibling;
            if (fallback) fallback.style.display = 'flex';
        });
        
        imgElement.addEventListener('load', function() {
            console.log('تم تحميل صورة اللجنة بنجاح:', this.src);
            const fallback = this.nextElementSibling;
            if (fallback) fallback.style.display = 'none';
        });
    }

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

    // حفظ الصورة الحالية في dataset
    const cardIcon = el.closest('.card').querySelector('.card-icon');
    let currentImage = '';
    
    // البحث عن الصورة في card-icon
    const imgElement = cardIcon.querySelector('img');
    if (imgElement && imgElement.src) {
      currentImage = imgElement.src;
    } else {
      // إذا لم توجد صورة، استخدم الصورة من البيانات الأصلية
      const card = el.closest('.card');
      const committeeId = card.dataset.id;
      const originalCommittee = allCommittees.find(c => c.id == committeeId);
      if (originalCommittee && originalCommittee.image) {
        currentImage = `http://localhost:3006/${originalCommittee.image}`;
      }
    }
    
    // تنظيف مسار الصورة وحفظه
    editModal.dataset.currentImage = cleanImagePath(currentImage);

    // عرض معاينة الصورة الحالية
    const previewDiv = document.getElementById('editCommitteeImagePreview') || createPreviewDiv('editCommitteeImagePreview', editModal);
    if (previewDiv && currentImage) {
      const imageName = currentImage.replace('frontend/images/', '').replace('http://localhost:3006/', '');
      previewDiv.innerHTML = `
        <div style="margin-top: 10px; text-align: center;">
          <img src="${currentImage.startsWith('http') ? currentImage : '../images/' + imageName}" alt="الصورة الحالية" style="max-width: 150px; max-height: 150px; border-radius: 8px; border: 2px solid #6c757d;">
          <div style="margin-top: 5px; font-size: 12px; color: #6c757d;">الصورة الحالية</div>
        </div>
      `;
    }

    showModal(editModal);
  }

  function onDeleteClick(e) {
    e.stopPropagation();
    const id = e.currentTarget.dataset.id;
    deleteModal.dataset.committeeId = id;
    showModal(deleteModal);
  }

  // دالة معالجة اختيار الصور
  function handleImageSelection(selectedImage, imageInput, imagePreview, isEdit = false) {
    if (selectedImage.isNew) {
      // صورة جديدة
      const file = selectedImage.file;
      imageInput.files = new DataTransfer().files; // مسح الملفات السابقة
      const dt = new DataTransfer();
      dt.items.add(file);
      imageInput.files = dt.files;
      
      // عرض معاينة الصورة
      const reader = new FileReader();
      reader.onload = function(e) {
        imagePreview.innerHTML = `
          <div style="margin-top: 10px; text-align: center;">
            <img src="${e.target.result}" alt="معاينة" style="max-width: 150px; max-height: 150px; border-radius: 8px; border: 2px solid #007bff;">
            <div style="margin-top: 5px; font-size: 12px; color: #007bff;">صورة جديدة: ${file.name}</div>
          </div>
        `;
      };
      reader.readAsDataURL(file);
    } else {
      // صورة موجودة
      imageInput.value = ''; // مسح input الملف
      
             // عرض معاينة الصورة
       const imageName = selectedImage.replace('frontend/images/', '');
       imagePreview.innerHTML = `
         <div style="margin-top: 10px; text-align: center;">
           <img src="../images/${imageName}" alt="معاينة" style="max-width: 150px; max-height: 150px; border-radius: 8px; border: 2px solid #28a745;">
           <div style="margin-top: 10px; font-size: 12px; color: #28a745;">صورة موجودة: ${imageName}</div>
         </div>
       `;
      
      // حفظ مسار الصورة في dataset
      if (isEdit) {
        editModal.dataset.selectedExistingImage = selectedImage;
      } else {
        addModal.dataset.selectedExistingImage = selectedImage;
      }
    }
  }

  // Helper function for form data creation
  function createCommitteeFormData(nameAr, nameEn, file, currentImage = null, selectedExistingImage = null) {
    const name = JSON.stringify({ ar: nameAr, en: nameEn });
    const fd = new FormData();
    fd.append('name', name);
    
    if (file) {
      fd.append('image', file);
      console.log('تم رفع صورة جديدة:', file.name);
    } else if (selectedExistingImage) {
      // إذا تم اختيار صورة موجودة
      fd.append('existingImage', selectedExistingImage);
      console.log('تم اختيار صورة موجودة:', selectedExistingImage);
    } else if (currentImage && currentImage.trim() !== '') {
      // إذا لم يتم رفع صورة جديدة، أرسل الصورة الحالية كمسار نصي
      fd.append('currentImage', currentImage);
      console.log('تم حفظ الصورة الحالية:', currentImage);
    }
    
    // للتأكد من أن FormData تم إنشاؤه بشكل صحيح
    console.log('FormData created:', {
      name: name,
      hasFile: !!file,
      fileName: file ? file.name : 'no file',
      selectedExistingImage: selectedExistingImage || 'no selected existing image',
      currentImage: currentImage || 'no current image'
    });
    
    return fd;
  }

  // إضافة أزرار اختيار الصور
  function addImageSelectionButtons() {
    // إضافة زر اختيار الصور في نموذج الإضافة
    const addImageInput = document.getElementById('committeeImage');
    const addImageContainer = addImageInput ? addImageInput.parentElement : null;
    if (addImageContainer && !addImageContainer.querySelector('.image-selector-btn')) {
      const imageSelectorBtn = document.createElement('button');
      imageSelectorBtn.type = 'button';
      imageSelectorBtn.className = 'image-selector-btn';
      imageSelectorBtn.innerHTML = `
        <i class="fas fa-images"></i>
        ${getTranslation('choose-image') || 'اختر صورة'}
      `;
      imageSelectorBtn.style.cssText = 'margin-left: 10px; padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;';
      
      imageSelectorBtn.addEventListener('click', () => {
        openImageSelector('', (selectedImage) => {
          const previewDiv = document.getElementById('committeeImagePreview') || createPreviewDiv('committeeImagePreview', addImageContainer);
          handleImageSelection(selectedImage, addImageInput, previewDiv, false);
        });
      });
      
      addImageContainer.appendChild(imageSelectorBtn);
    }

    // إضافة زر اختيار الصور في نموذج التعديل
    const editImageInput = editImage;
    const editImageContainer = editImageInput ? editImageInput.parentElement : null;
    if (editImageContainer && !editImageContainer.querySelector('.image-selector-btn')) {
      const imageSelectorBtn = document.createElement('button');
      imageSelectorBtn.type = 'button';
      imageSelectorBtn.className = 'image-selector-btn';
      imageSelectorBtn.innerHTML = `
        <i class="fas fa-images"></i>
        ${getTranslation('choose-image') || 'اختر صورة'}
      `;
      imageSelectorBtn.style.cssText = 'margin-left: 10px; padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;';
      
      imageSelectorBtn.addEventListener('click', () => {
        const currentImage = editModal.dataset.currentImage || '';
        const previewDiv = document.getElementById('editCommitteeImagePreview') || createPreviewDiv('editCommitteeImagePreview', editImageContainer);
        openImageSelector(currentImage, (selectedImage) => {
          handleImageSelection(selectedImage, editImageInput, previewDiv, true);
        });
      });
      
      editImageContainer.appendChild(imageSelectorBtn);
    }
  }

  // دالة إنشاء div للمعاينة
  function createPreviewDiv(id, container) {
    const previewDiv = document.createElement('div');
    previewDiv.id = id;
    previewDiv.className = 'image-preview';
    container.appendChild(previewDiv);
    return previewDiv;
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
      const selectedExistingImage = addModal.dataset.selectedExistingImage;
      const formData = createCommitteeFormData(nameAr, nameEn, file, null, selectedExistingImage);
      console.log('Sending formData:', formData);
      
      const result = await apiCall(`${apiBase}/committees`, {
        method: 'POST',
        body: formData
      });
      
      console.log('API Response:', result);
      
      showToast(getTranslation('committee-added-success'), 'success');
      hideModal(addModal);
      
      // إضافة اللجنة الجديدة للبيانات المحلية
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
      
      // إضافة اللجنة الجديدة في بداية المصفوفات
      allCommittees.unshift(newCommittee);
      filteredCommittees.unshift(newCommittee);
      
      // إعادة عرض اللجان والصفحات
      currentPage = 1; // العودة للصفحة الأولى
      renderCommittees();
      renderPagination();
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
      const currentImage = editModal.dataset.currentImage;
      const formData = createCommitteeFormData(nameAr, nameEn, file, currentImage);
      console.log('Sending update formData:', formData);
      
      const result = await apiCall(`${apiBase}/committees/${id}`, {
        method: 'PUT',
        body: formData
      });
      
      console.log('Update API Response:', result);
      
      showToast(getTranslation('committee-updated-success'), 'success');
      hideModal(editModal);
      
      // تحديث اللجنة في البيانات المحلية
      let updatedImage = '';
      if (file) {
        // إذا تم رفع صورة جديدة
        updatedImage = `backend/uploads/images/${file.name}`;
      } else {
        // إذا لم يتم رفع صورة جديدة، استخدم الصورة الحالية
        const currentImage = editModal.dataset.currentImage;
        updatedImage = cleanImagePath(currentImage);
      }
      
      // استخدام البيانات من الخادم إذا كانت متوفرة، وإلا استخدم البيانات المحلية
      let updatedCommittee = result.committee || result.data || {
        id: id,
        name: JSON.stringify({ ar: nameAr, en: nameEn }),
        image: updatedImage
      };
      
      // إذا كان الخادم لم يُرجع صورة، استخدم الصورة المحلية
      if (!updatedCommittee.image && updatedImage) {
        updatedCommittee.image = updatedImage;
      }
      
      // تأكد من أن جميع الحقول موجودة
      if (!updatedCommittee.id) updatedCommittee.id = id;
      if (!updatedCommittee.name) updatedCommittee.name = JSON.stringify({ ar: nameAr, en: nameEn });
      
      // تنظيف مسار الصورة
      if (updatedCommittee.image) {
        updatedCommittee.image = cleanImagePath(updatedCommittee.image);
      }
      
      console.log('اللجنة المُحدثة:', updatedCommittee);
      
      // التأكد من أن لدينا بيانات صحيحة
      if (!updatedCommittee.id) {
        console.error('No committee ID in update response');
        showToast('خطأ في استلام بيانات اللجنة المحدثة', 'error');
        return;
      }
      
      console.log('Updated committee object:', updatedCommittee);
      
      // تحديث اللجنة في المصفوفات
      const allIndex = allCommittees.findIndex(c => c.id == id);
      const filteredIndex = filteredCommittees.findIndex(c => c.id == id);
      
      if (allIndex !== -1) {
        allCommittees[allIndex] = updatedCommittee;
      }
      if (filteredIndex !== -1) {
        filteredCommittees[filteredIndex] = updatedCommittee;
      }
      
      // إعادة عرض اللجان والصفحات
      renderCommittees();
      renderPagination();
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
      
      // حذف اللجنة من البيانات المحلية
      allCommittees = allCommittees.filter(c => c.id != id);
      filteredCommittees = filteredCommittees.filter(c => c.id != id);
      
      // التحقق من الصفحة الحالية
      const totalPages = Math.ceil(filteredCommittees.length / committeesPerPage);
      if (currentPage > totalPages && totalPages > 0) {
        currentPage = totalPages;
      }
      
      // إعادة عرض اللجان والصفحات
      renderCommittees();
      renderPagination();
    } catch (err) {
      showToast(getTranslation('error-deleting-committee'), 'error');
    }
  });
  cancelDel.addEventListener('click', () => hideModal(deleteModal));

  // Search filter
  searchInput.addEventListener('input', ({ target }) => {
    const term = target.value.toLowerCase();
    filteredCommittees = allCommittees.filter(committee => {
      const name = JSON.parse(committee.name)[localStorage.getItem('language') || 'ar'] || JSON.parse(committee.name)['ar'] || committee.name;
      return name.toLowerCase().includes(term);
    });
    currentPage = 1; // Reset to first page on search
    renderCommittees();
    renderPagination();
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
  
  // إضافة أزرار اختيار الصور
  addImageSelectionButtons();
});
