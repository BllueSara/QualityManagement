// --- المتغيرات العامة ---
const apiBase = 'http://localhost:3006';
let currentCommitteeId = null;
let currentCommitteeName = null;
let currentFolderId = null;
let currentFolderName = null;
let allFolders = [];
let allContents = [];
let folderNameOptions = [];
let selectedFolderNameId = null;
let isForceApproved = false; // متغير عام

// دالة لتنسيق التاريخ
function formatDate(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    // تنسيق عربي: يوم/شهر/سنة
    return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
}
// دالة لتسجيل عرض المحتوى في اللوقز
async function logContentView(contentId, contentTitle, folderName, committeeName) {
    try {
        const response = await fetch(`${apiBase}/api/logs/content-view`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contentId: contentId,
                contentTitle: contentTitle,
                folderName: folderName,
                committeeName: committeeName
            })
        });

        if (!response.ok) {
            console.error('Failed to log content view:', response.status);
        }
    } catch (error) {
        console.error('Error logging content view:', error);
    }
}
const permissions = {
  canAddFolder:    false,
  canAddFolderName: false,
  canEditFolder:   false,
  canEditFolderName: false,
  canDeleteFolder: false,
  canDeleteFolderName: false,
  canAddContent:   false,
  canEditContent:  false,
  canDeleteContent:false,
  canAddApprovedContent: false // جديد
};

// --- عناصر DOM ---
const folderNameToggle = document.getElementById('folderNameToggle');
const folderNameMenu = document.getElementById('folderNameMenu');
const folderNameSearch = document.getElementById('folderNameSearch');
const folderNamesContainer = document.getElementById('folderNamesContainer');
const addNewFolderNameLink = document.getElementById('addNewFolderNameLink');
const selectedFolderName = document.getElementById('selectedFolderName');
const foldersSection = document.querySelector('.folders-section');
const folderContentsSection = document.querySelector('.folder-contents-section');
const folderContentTitle = document.querySelector('.folder-content-title');
const addFolderBtn = document.getElementById('addFolderBtn');
const addFolderModal = document.getElementById('addFolderModal');
const addFolderCloseBtn = addFolderModal ? addFolderModal.querySelector('.close-button') : null;
const cancelFolderBtn = addFolderModal ? addFolderModal.querySelector('#cancelFolderBtn') : null;
const createFolderBtn = addFolderModal ? addFolderModal.querySelector('#createFolderBtn') : null;
const addContentBtn = document.getElementById('addContentBtn');
let addApprovedContentBtn = null; // عرّف المتغير هنا فقط
const addContentModal = document.getElementById('addContentModal');
const addContentCloseBtn = addContentModal ? addContentModal.querySelector('.close-button') : null;
const cancelContentBtn = addContentModal ? addContentModal.querySelector('#cancelContentBtn') : null;
const createContentBtn = addContentModal ? addContentModal.querySelector('#createContentBtn') : null;
const addContentForm = addContentModal ? addContentModal.querySelector('#addContentFormElement') : null;
const editFolderModal = document.getElementById('editFolderModal');
const editFolderCloseBtn = editFolderModal ? editFolderModal.querySelector('.close-button') : null;
const cancelEditFolderBtn = editFolderModal ? editFolderModal.querySelector('#cancelEditFolderBtn') : null;
const updateFolderBtn = editFolderModal ? editFolderModal.querySelector('#updateFolderBtn') : null;
const editFolderIdInput = document.getElementById('editFolderId');
const editFolderNameInput = document.getElementById('editFolderName');
const editContentModal = document.getElementById('editContentModal');
const editContentCloseBtn = editContentModal ? editContentModal.querySelector('.close-button') : null;
const cancelEditContentBtn = editContentModal ? editContentModal.querySelector('#cancelEditContentBtn') : null;
const updateContentBtn = editContentModal ? editContentModal.querySelector('#updateContentBtn') : null;
const editContentIdInput = document.getElementById('editContentId');
const editContentTitleInput = document.getElementById('editContentTitle');
const editContentFileInput = document.getElementById('editContentFile');
const editContentNotesInput = document.getElementById('editContentNotes');
const deleteContentModal = document.getElementById('deleteContentModal');
const confirmDeleteContentBtn = deleteContentModal ? deleteContentModal.querySelector('#confirmDeleteContentBtn') : null;
const cancelDeleteContentBtn = deleteContentModal ? deleteContentModal.querySelector('#cancelDeleteContentBtn') : null;
const deleteContentCloseBtn = deleteContentModal ? deleteContentModal.querySelector('.close-button') : null;
const deleteContentIdInput = document.getElementById('deleteContentId');
const backToFilesBtn = document.getElementById('backToFilesBtn');
const backToFilesContainer = document.getElementById('backToFilesContainer');
const mainBackBtn = document.getElementById('mainBackBtn');
const contentFileInput = document.getElementById('contentFile');

// --- عناصر DOM لإدارة أسماء المجلدات ---
const addFolderNameModal = document.getElementById('addFolderNameModal');
const saveAddFolderNameBtn = document.getElementById('saveAddFolderName');
const cancelAddFolderNameBtn = document.getElementById('cancelAddFolderName');
const editFolderNameModal = document.getElementById('editFolderNameModal');
const saveEditFolderNameBtn = document.getElementById('saveEditFolderName');
const cancelEditFolderNameBtn = document.getElementById('cancelEditFolderName');
const deleteFolderNameModal = document.getElementById('deleteFolderNameModal');
const confirmDeleteFolderNameBtn = document.getElementById('confirmDeleteFolderNameBtn');
const cancelDeleteFolderNameBtn = document.getElementById('cancelDeleteFolderNameBtn');

// --- دوال مساعدة ---
function getToken() {
  const token = localStorage.getItem('token');
  return token || null;
}
function getTranslation(key) {
  const lang = localStorage.getItem('language') || 'ar';
  if (window.translations && window.translations[lang] && window.translations[lang][key]) {
    return window.translations[lang][key];
  }
  return key;
}
function getLocalizedName(name) {
  const lang = localStorage.getItem('language') || 'ar';
  try {
    const parsed = JSON.parse(name);
    return parsed[lang] || parsed.ar || parsed.en || name;
  } catch (e) {
    return name;
  }
}
function showToast(message, type = 'info', duration = 3006) {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) return;
  const translated = getTranslation(message);
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = translated !== message ? translated : message;
  toastContainer.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, duration);
}

// --- دالة جلب الصلاحيات ---
async function fetchPermissions() {
  console.log('--- Permissions Check START ---');
  const token = getToken();
  if (!token) {
    console.error('No token found. Permissions will be default (false).');
    return;
  }
  
  try {
    const userId = JSON.parse(atob(token.split('.')[1])).id;
    const headers = { 'Authorization': `Bearer ${token}` };
    
    const userRes = await fetch(`${apiBase}/api/users/${userId}`, { headers });

    if (!userRes.ok) {
      const errorText = await userRes.text();
      console.error('Failed to fetch user data. Server responded with:', errorText);
      return;
    }

    const { data: user } = await userRes.json();

    if (user && user.role === 'admin') {
      Object.keys(permissions).forEach(k => permissions[k] = true);
    } else {
      console.log("User is NOT admin or role is missing. Fetching specific permissions.");
      const permsRes = await fetch(`${apiBase}/api/users/${userId}/permissions`, { headers });
      console.log(`Permissions API Response Status: ${permsRes.status}`);

      if (!permsRes.ok) {
          const errorText = await permsRes.text();
          console.error('Failed to fetch specific permissions. Server responded with:', errorText);
          return;
      }
      const { data: perms } = await permsRes.json();
      const keys = perms ? perms.map(p => (typeof p === 'string' ? p : p.permission)) : [];
      console.log('Permission keys received from API:', keys);
      
      permissions.canAddFolder = keys.includes('add_folder_committee');
      permissions.canEditFolder = keys.includes('edit_folder_committee');
      permissions.canDeleteFolder = keys.includes('delete_folder_committee');
      permissions.canAddFolderName = keys.includes('add_folder_committee_name');
      permissions.canEditFolderName = keys.includes('edit_folder_committee_name');
      permissions.canDeleteFolderName = keys.includes('delete_folder_committee_name');
      permissions.canAddContent = keys.includes('add_content_committee');
      permissions.canEditContent = keys.includes('edit_content_committee');
      permissions.canDeleteContent = keys.includes('delete_content_committee');
      permissions.canAddApprovedContent = keys.includes('add_approved_content_committee');
    }

  } catch(e) {
    console.error("An error occurred inside fetchPermissions:", e);
  }
  
  console.log('Final permissions object:', JSON.parse(JSON.stringify(permissions)));
  console.log('--- Permissions Check END ---');
}

// --- دوال إدارة أسماء المجلدات ---
function openAddFolderNameModal() {
  const folderNameAr = document.getElementById('folderNameAr');
  const folderNameEn = document.getElementById('folderNameEn');
  if (folderNameAr) folderNameAr.value = '';
  if (folderNameEn) folderNameEn.value = '';
  if (addFolderNameModal) addFolderNameModal.style.display = 'flex';
}
function closeAddFolderNameModal() {
  if (addFolderNameModal) addFolderNameModal.style.display = 'none';
}
function openEditFolderNameModal(id, name) {
  const editFolderNameId = document.getElementById('editFolderNameId');
  const editFolderNameAr = document.getElementById('editFolderNameAr');
  const editFolderNameEn = document.getElementById('editFolderNameEn');
  
  if (editFolderNameId) editFolderNameId.value = id;
  try {
    const parsed = JSON.parse(name);
    if (editFolderNameAr) editFolderNameAr.value = parsed.ar || '';
    if (editFolderNameEn) editFolderNameEn.value = parsed.en || '';
  } catch {
    if (editFolderNameAr) editFolderNameAr.value = name;
    if (editFolderNameEn) editFolderNameEn.value = '';
  }
  if (editFolderNameModal) editFolderNameModal.style.display = 'flex';
}
function closeEditFolderNameModal() {
  if (editFolderNameModal) editFolderNameModal.style.display = 'none';
}
function openDeleteFolderNameModal(id) {
  const deleteFolderNameId = document.getElementById('deleteFolderNameId');
  if (deleteFolderNameId) deleteFolderNameId.value = id;
  if (deleteFolderNameModal) deleteFolderNameModal.style.display = 'flex';
}
function closeDeleteFolderNameModal() {
  if (deleteFolderNameModal) deleteFolderNameModal.style.display = 'none';
}
async function handleCreateFolderName() {
  const nameArInput = document.getElementById('folderNameAr');
  const nameEnInput = document.getElementById('folderNameEn');
  if (!nameArInput || !nameEnInput) return;
  const nameAr = nameArInput.value.trim();
  const nameEn = nameEnInput.value.trim();
  if (!nameAr || !nameEn) return showToast(getTranslation('all-fields-required'), 'error');
  
  const name = JSON.stringify({ ar: nameAr, en: nameEn });
  try {
    const response = await fetch(`${apiBase}/api/committees/folder-names`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ name })
    });
    const data = await response.json();
    if (response.ok) {
      showToast('تمت إضافة اسم المجلد بنجاح', 'success');
      closeAddFolderNameModal();
      await loadFolderNameOptions();
    } else {
      showToast(data.message || 'فشل إضافة اسم المجلد.', 'error');
    }
  } catch (error) {
    showToast('حدث خطأ في الاتصال.', 'error');
  }
}
async function handleUpdateFolderName() {
  const idInput = document.getElementById('editFolderNameId');
  const nameArInput = document.getElementById('editFolderNameAr');
  const nameEnInput = document.getElementById('editFolderNameEn');
  if (!idInput || !nameArInput || !nameEnInput) return;
  
  const id = idInput.value;
  const nameAr = nameArInput.value.trim();
  const nameEn = nameEnInput.value.trim();
  if (!nameAr || !nameEn) return showToast(getTranslation('all-fields-required'), 'error');
  
  const name = JSON.stringify({ ar: nameAr, en: nameEn });
  try {
    const response = await fetch(`${apiBase}/api/committees/folder-names/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ name })
    });
    const data = await response.json();
    if (response.ok) {
      showToast('تم تحديث اسم المجلد بنجاح', 'success');
      closeEditFolderNameModal();
      await loadFolderNameOptions();
    } else {
      showToast(data.message || 'فشل تحديث اسم المجلد.', 'error');
    }
  } catch (error) {
    showToast('حدث خطأ في الاتصال.', 'error');
  }
}
async function handleDeleteFolderName() {
  const idInput = document.getElementById('deleteFolderNameId');
  if (!idInput) return;
  const id = idInput.value;
  try {
    const response = await fetch(`${apiBase}/api/committees/folder-names/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const data = await response.json();
    if (response.ok) {
      showToast('تم حذف اسم المجلد بنجاح', 'success');
      closeDeleteFolderNameModal();
      await loadFolderNameOptions();
    } else {
      showToast(data.message || 'فشل حذف اسم المجلد.', 'error');
    }
  } catch (error) {
    showToast('حدث خطأ في الاتصال.', 'error');
  }
}

// --- دوال المجلدات ---
function openAddFolderModal() {
  if (addFolderModal) addFolderModal.style.display = 'flex';
}
function closeAddFolderModal() {
  if (addFolderModal) addFolderModal.style.display = 'none';
  if (selectedFolderName) selectedFolderName.value = '';
  if (folderNameToggle) folderNameToggle.innerHTML = `${getTranslation('choose-folder-name')} <span class="arrow">▾</span>`;
}
function openEditFolderModal(folderId, folderName) {
  if (!editFolderModal) return;
  editFolderModal.style.display = 'flex';
  if (editFolderIdInput) editFolderIdInput.value = folderId;
  if (editFolderNameInput) editFolderNameInput.value = folderName;
}
function closeEditFolderModal() {
  if (editFolderModal) editFolderModal.style.display = 'none';
}
function openDeleteFolderModal(folderId) {
  if (confirm(getTranslation('delete-folder-confirm'))) deleteFolder(folderId);
}
async function handleCreateFolder() {
  if (!selectedFolderName) return;
  const folderName = selectedFolderName.value;
  if (!folderName) return showToast(getTranslation('folder-name-required'), 'error');
  try {
    const response = await fetch(`${apiBase}/api/committees/${currentCommitteeId}/folders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ name: folderName })
    });
    const data = await response.json();
    if (response.ok) {
      showToast(getTranslation('folder-added-success'), 'success');
      closeAddFolderModal();
      fetchFolders(currentCommitteeId);
    } else {
      showToast(data.message || getTranslation('error-occurred'), 'error');
    }
  } catch (err) {
    showToast(getTranslation('error-occurred'), 'error');
  }
}
async function handleUpdateFolder() {
  if (!editFolderIdInput || !editFolderNameInput) return;
  const folderId = editFolderIdInput.value;
  const newName = editFolderNameInput.value;
  if (!newName) return showToast(getTranslation('choose-folder-name'), 'error');
  try {
    const response = await fetch(`${apiBase}/api/committees/folders/${folderId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ name: newName })
    });
    if (response.ok) {
      showToast(getTranslation('folder-updated-success'), 'success');
      closeEditFolderModal();
      fetchFolders(currentCommitteeId);
    } else {
      const data = await response.json();
      showToast(`فشل تحديث المجلد: ${data.message || 'خطأ'}`, 'error');
    }
  } catch (err) {
    showToast('حدث خطأ في الاتصال بالخادم أثناء التحديث.', 'error');
  }
}
async function deleteFolder(folderId) {
  try {
    const response = await fetch(`${apiBase}/api/committees/folders/${folderId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    if (response.ok) {
      showToast(getTranslation('folder-deleted-success'), 'success');
      fetchFolders(currentCommitteeId);
    } else {
      const data = await response.json();
      showToast(`فشل حذف المجلد: ${data.message || 'خطأ'}`, 'error');
    }
  } catch (err) {
    showToast('حدث خطأ في الاتصال بالخادم أثناء الحذف.', 'error');
  }
}

// --- دوال إدارة محتوى الملفات (content) ---
function openAddContentModal() {
  if (!addContentModal) return;
  if (!currentFolderId) {
    showToast(getTranslation('select-folder'), 'error');
    return;
  }
  addContentModal.style.display = 'flex';
  const folderIdInput = document.getElementById('addContentFolderId');
  if (folderIdInput) folderIdInput.value = currentFolderId;
  // إعادة تعيين الحقول
  const contentTitleInput = document.getElementById('contentTitle');
  if (contentTitleInput) contentTitleInput.value = '';
  if (contentFileInput) contentFileInput.value = '';
  if (addContentModal) {
    const fileDropArea = addContentModal.querySelector('.file-drop-area');
    if (fileDropArea) {
      const fileUploadText = fileDropArea.querySelector('.file-upload-text');
      if (fileUploadText) fileUploadText.innerHTML = `<span class="supported-files">${getTranslation('pdf-only')}</span>`;
      fileDropArea.classList.remove('has-file');
    }
  }
}
function closeAddContentModal() {
  if (!addContentModal) return;
  addContentModal.style.display = 'none';
  const contentTitleInput = document.getElementById('contentTitle');
  if (contentTitleInput) contentTitleInput.value = '';
  if (contentFileInput) contentFileInput.value = '';
  if (addContentModal) {
    const fileDropArea = addContentModal.querySelector('.file-drop-area');
    if (fileDropArea) {
      const fileUploadText = fileDropArea.querySelector('.file-upload-text');
      if (fileUploadText) fileUploadText.innerHTML = `<span class="supported-files">${getTranslation('pdf-only')}</span>`;
      fileDropArea.classList.remove('has-file');
    }
  }
}
function openEditContentModal(id) {
  if (!editContentIdInput) return;
  editContentIdInput.value = id;
  fetch(`${apiBase}/api/committees/contents/${id}`, {
    headers: { 'Authorization': `Bearer ${getToken()}` }
  })
    .then(res => res.json())
    .then(content => {
      if (editContentTitleInput) editContentTitleInput.value = getLocalizedName(content.title);
      if (editContentNotesInput) editContentNotesInput.value = content.notes || '';
      if (editContentModal) editContentModal.style.display = 'flex';
    })
    .catch(err => {
      showToast(getTranslation('error-occurred'), 'error');
    });
}
function closeEditContentModal() {
  if (!editContentModal) return;
  editContentModal.style.display = 'none';
  if (editContentIdInput) editContentIdInput.value = '';
  if (editContentTitleInput) editContentTitleInput.value = '';
  if (editContentNotesInput) editContentNotesInput.value = '';
  if (editContentFileInput) {
    editContentFileInput.value = '';
    const fileDropArea = editContentFileInput.closest('.file-drop-area');
    if (fileDropArea) {
      const fileUploadText = fileDropArea.querySelector('.file-upload-text');
      if (fileUploadText) fileUploadText.innerHTML = `<span class="supported-files">${getTranslation('pdf-only')}</span>`;
      fileDropArea.classList.remove('has-file');
    }
  }
}
function openDeleteContentModal(contentId) {
  if (!deleteContentModal || !deleteContentIdInput) return;
  deleteContentIdInput.value = contentId;
  deleteContentModal.style.display = 'flex';
}
function closeDeleteContentModal() {
  if (!deleteContentModal) return;
  deleteContentModal.style.display = 'none';
  if (deleteContentIdInput) deleteContentIdInput.value = '';
}
async function handleCreateContent() {
  const folderIdToUpload = document.getElementById('addContentFolderId')?.value;
  const contentFileInput = document.getElementById('contentFile');
  const contentFile = contentFileInput?.files[0];
  const contentNotes = document.getElementById('contentNotes')?.value || '';
  let contentTitle = document.getElementById('contentTitle')?.value;

  // ضمان أن العنوان مأخوذ من اسم الملف إذا كان فارغًا
  if (!contentTitle && contentFile) {
    contentTitle = contentFile.name.replace(/\.[^/.]+$/, '');
  }

  // تحقق برمجي
  console.log('handleCreateContent: contentTitle =', contentTitle, '| contentFile =', contentFile);
  if (!folderIdToUpload || !contentTitle || !contentFile) {
    showToast(`يرجى اختيار ملف (title: ${contentTitle}, file: ${!!contentFile})`, 'error');
    return;
  }
  const formData = new FormData();
  formData.append('title', contentTitle);
  formData.append('file', contentFile);
  formData.append('notes', contentNotes);
  formData.append('approvers_required', '[]');
  if (isForceApproved) {
    formData.append('force_approved', 'true');
  }
  // تحقق من محتوى formData
  for (let pair of formData.entries()) {
    console.log('FormData:', pair[0], pair[1]);
  }
  try {
    const response = await fetch(`${apiBase}/api/committees/folders/${folderIdToUpload}/contents`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` },
      body: formData
    });
    if (response.ok) {
      closeAddContentModal();
      fetchFolderContents(currentFolderId);
      showToast(getTranslation('content-added-success'), 'success');
    } else {
      const data = await response.json();
      showToast(`${getTranslation('error-occurred')}: ${data.message || getTranslation('please-try-again')}`, 'error');
    }
  } catch (err) {
    showToast(getTranslation('error-occurred'), 'error');
  }
}
async function handleUpdateContent() {
  if (!editContentIdInput) return; // تم حذف الشرط الإضافي

  const contentId = editContentIdInput.value;
  const notes = editContentNotesInput ? editContentNotesInput.value : '';
  const file = editContentFileInput ? editContentFileInput.files[0] : null;

  // لا يمكن التحديث بدون رفع ملف جديد، لأن العنوان مفقود
  if (!file) {
    showToast(getTranslation('new-file-required'), 'error');
    return;
  }
  
  const title = file.name.replace(/\.[^/.]+$/, '');

  const formData = new FormData();
  formData.append('title', title);
  formData.append('notes', notes);
  if (file) formData.append('file', file);
  formData.append('approvers_required', '[]');
  try {
    const response = await fetch(`${apiBase}/api/committees/contents/${contentId}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${getToken()}` },
      body: formData
    });
    const result = await response.json();
    if (response.ok) {
      showToast(result.message || getTranslation('content-update-success'), 'success');
      closeEditContentModal();
      await fetchFolderContents(currentFolderId);
    } else {
      showToast(result.message || getTranslation('error-occurred'), 'error');
    }
  } catch (err) {
    showToast(getTranslation('error-occurred'), 'error');
  }
}
async function handleDeleteContent() {
  if (!deleteContentIdInput) return;
  const contentId = deleteContentIdInput.value;
  if (!contentId) return;
  try {
    const response = await fetch(`${apiBase}/api/committees/contents/${contentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const result = await response.json();
    if (response.ok) {
      showToast(result.message || getTranslation('content-deleted-success'), 'success');
      closeDeleteContentModal();
      await fetchFolderContents(currentFolderId);
    } else {
      showToast(result.message || getTranslation('error-occurred'), 'error');
    }
  } catch (err) {
    showToast(getTranslation('error-occurred'), 'error');
  }
}

// --- دوال عرض المجلدات ---
async function fetchFolders(committeeId) {
  if (currentFolderId !== null) return;
  currentCommitteeId = committeeId;
  if (foldersSection) foldersSection.style.display = 'block';
  if (folderContentsSection) folderContentsSection.style.display = 'none';
  if (backToFilesContainer) backToFilesContainer.style.display = 'none';
  if (folderContentTitle) folderContentTitle.textContent = 'مجلدات اللجنة';
  try {
    const response = await fetch(`${apiBase}/api/committees/${committeeId}/folders`);
    const data = await response.json();
    if (data.committeeName) currentCommitteeName = data.committeeName;
    const folders = data.data || data;
    allFolders = folders;
    renderFolders(folders);
  } catch (err) {
    showToast(getTranslation('error-occurred'), 'error');
  }
}
function renderFolders(folders) {
  const foldersList = document.querySelector('.folders-list');
  if (!foldersList) return;
  foldersList.innerHTML = '';
  if (folders.length) {
    folders.forEach(folder => {
      const card = document.createElement('div');
      card.className = 'folder-card';
      card.dataset.id = folder.id;
      const localizedName = getLocalizedName(folder.name);
      let icons = '<div class="item-icons">';
      if (permissions.canEditFolder)
        icons += `<a href="#" class="edit-icon"><img src="../images/edit.svg" alt="تعديل"></a>`;
      if (permissions.canDeleteFolder)
        icons += `<a href="#" class="delete-icon"><img src="../images/delet.svg" alt="حذف"></a>`;
      icons += '</div>';
      card.innerHTML = icons +
        `<img src="../images/folders.svg">
         <div class="folder-info">
           <div class="folder-name">${localizedName}</div>
         </div>`;
      foldersList.appendChild(card);
      card.addEventListener('click', e => {
        if (!e.target.closest('.edit-icon') && !e.target.closest('.delete-icon')) {
          fetchFolderContents(folder.id, localizedName);
        }
      });
      const editIcon = card.querySelector('.edit-icon');
      if (editIcon) {
        editIcon.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          openEditFolderModal(folder.id, localizedName);
        });
      }
      const deleteIcon = card.querySelector('.delete-icon');
      if (deleteIcon) {
        deleteIcon.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          openDeleteFolderModal(folder.id);
        });
      }
    });
  } else {
    foldersList.innerHTML = `<div class="no-content" data-translate="no-folders">${getTranslation('no-folders')}</div>`;
  }
}

// --- دوال عرض محتوى المجلدات (الملفات) ---
async function fetchFolderContents(folderId, folderName) {
  currentFolderId = folderId;
  let displayFolderName = folderName;
  try {
    const parsedFolderName = JSON.parse(folderName);
    const lang = localStorage.getItem('language') || 'ar';
    displayFolderName = parsedFolderName[lang] || parsedFolderName.ar || folderName;
  } catch (e) {
    displayFolderName = folderName;
  }
  currentFolderName = displayFolderName;
  if (foldersSection) foldersSection.style.display = 'none';
  if (folderContentsSection) folderContentsSection.style.display = 'block';
  if (backToFilesContainer) backToFilesContainer.style.display = 'block';
  if (folderContentTitle) folderContentTitle.textContent = displayFolderName || getTranslation('folder-content-title');
  try {
    const token = getToken();
    const response = await fetch(`${apiBase}/api/committees/folders/${folderId}/contents`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const responseJson = await response.json();
    const contents = Array.isArray(responseJson.data)
      ? responseJson.data
      : (Array.isArray(responseJson) ? responseJson : []);
    const decodedToken = JSON.parse(atob(token.split('.')[1]));
    const isAdmin = decodedToken.role === 'admin';
    const filteredContents = isAdmin ? contents : contents.filter(content => content.approval_status === 'approved');
    allContents = filteredContents;
    window._lastCommitteeFilesData = {
      contents: filteredContents,
      folderName: displayFolderName
    };
    
    // جلب المحاضر المرتبطة بالمجلد
    let protocols = [];
    try {
      const protocolsResponse = await fetch(`${apiBase}/api/protocols/folder/${folderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (protocolsResponse.ok) {
        const protocolsData = await protocolsResponse.json();
        protocols = protocolsData.success ? protocolsData.data : [];
      } else {
        console.log('لا توجد محاضر مرتبطة بهذا المجلد أو خطأ في جلب المحاضر');
      }
    } catch (error) {
      console.log('خطأ في جلب المحاضر:', error);
      protocols = [];
    }
    
    renderContents(filteredContents, protocols);
  } catch (err) {
    showToast(getTranslation('error-occurred'), 'error');
  }
}
function renderContents(contents, protocols = []) {
  const filesList = document.querySelector('.files-list');
  if (!filesList) return;
  filesList.innerHTML = '';
  
  // عرض المحتويات العادية
  if (contents.length > 0) {
    contents.forEach(content => {
      let icons = '<div class="item-icons">';
      if (permissions.canEditContent)
        icons += `<a href="#" class="edit-icon" data-content-id="${content.id}"><img src="../images/edit.svg" alt="تعديل"></a>`;
      if (permissions.canDeleteContent)
        icons += `<a href="#" class="delete-icon" data-content-id="${content.id}"><img src="../images/delet.svg" alt="حذف"></a>`;
      icons += '</div>';
      const fileItem = document.createElement('div');
      fileItem.className = 'file-item';
      fileItem.dataset.contentId = content.id;
      const approvalStatusText = (content.approval_status === 'approved') ? getTranslation('status-approved') : getTranslation('status-awaiting');
      const approvalClass = (content.approval_status === 'approved') ? 'approved' : 'pending';
      fileItem.innerHTML = `
        ${icons}
        <img src="../images/pdf.svg" alt="ملف PDF">
        <div class="file-info">
          <div class="file-name">${getLocalizedName(content.title)}</div>
          <div class="approval-status ${approvalClass}">${approvalStatusText}</div>
        </div>
      `;
      filesList.appendChild(fileItem);
      fileItem.addEventListener('click', async function(e) {
        if (!e.target.closest('.edit-icon') && !e.target.closest('.delete-icon')) {
          if (content.file_path) {
            const contentTitle = getLocalizedName(content.title);
            const folderName = currentFolderName || window._lastCommitteeFilesData?.folderName || '';
            logContentView(content.id, contentTitle, folderName, currentCommitteeName);
            const baseUrl = apiBase.replace('/api', '');
let filePath = content.file_path.startsWith('backend/') ? content.file_path.replace(/^backend\//, '') : content.file_path;
window.open(`${baseUrl}/${filePath}`, '_blank');
          } else {
            showToast(getTranslation('file-link-unavailable'), 'error');
          }
        }
      });
      const editIcon = fileItem.querySelector('.edit-icon');
      const deleteIcon = fileItem.querySelector('.delete-icon');
      if (editIcon) {
        editIcon.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          openEditContentModal(content.id);
        });
      }
      if (deleteIcon) {
        deleteIcon.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          openDeleteContentModal(content.id);
        });
      }
    });
  }
  
  // عرض المحاضر المرتبطة بالمجلد
  if (protocols && protocols.length > 0) {
    // إضافة عنوان قسم المحاضر
    const protocolsHeader = document.createElement('div');
    protocolsHeader.className = 'protocols-header';
    protocolsHeader.innerHTML = `
        <h3 style="margin: 20px 0 10px 0; color: #1e40af; border-bottom: 2px solid #3b82f6; padding-bottom: 5px;">
            <i class="fas fa-file-alt"></i>
            المحاضر المرتبطة بهذا المجلد
        </h3>
    `;
    filesList.appendChild(protocolsHeader);
    
    protocols.forEach(protocol => {
      const protocolItem = document.createElement('div');
      protocolItem.className = 'file-item protocol-item';
      
      // تنسيق التاريخ
      const formattedDate = formatDate(protocol.protocol_date);
      
      const approvalClass = protocol.is_approved ? 'approved' : 'pending';
      const approvalStatus = protocol.is_approved ? 'معتمد' : 'في انتظار الاعتماد';
      
      protocolItem.innerHTML = `
          <div class="item-icons">
              <a href="#" class="view-protocol-icon" data-id="${protocol.id}">
                  <i class="fas fa-eye" style="color: #3b82f6;"></i>
              </a>
          </div>
          <img src="../images/pdf.svg" alt="محضر PDF">
          <div class="file-info">
              <div class="file-name">${protocol.title}</div>
              <div class="approval-status ${approvalClass}">${approvalStatus}</div>
              <div class="file-date">${formattedDate}</div>
              <div class="file-date">عدد المواضيع: ${protocol.topics_count}</div>
          </div>
      `;
      
      filesList.appendChild(protocolItem);
      
      // إضافة مستمع النقر لعرض المحضر
      const viewBtn = protocolItem.querySelector('.view-protocol-icon');
      viewBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        window.open(`/frontend/html/protocol-list.html?view=${protocol.id}`, '_blank');
      });
      
      // إضافة مستمع النقر على المحضر نفسه لفتح PDF
      protocolItem.addEventListener('click', function(e) {
        if (!e.target.closest('.view-protocol-icon')) {
          if (protocol.file_path) {
            window.open(`http://localhost:3006/uploads/${protocol.file_path}`, '_blank');
          } else {
            showToast('ملف PDF غير متوفر', 'error');
          }
        }
      });
    });
  }
  
  // إذا لم تكن هناك محتويات ولا محاضر
  if (contents.length === 0 && (!protocols || protocols.length === 0)) {
    filesList.innerHTML = `<div class="no-content" data-translate="no-contents">${getTranslation('no-contents')}</div>`;
  }
}

// --- دوال زر الرجوع ---
function handleBackButton() {
  if (currentFolderId !== null) {
    currentFolderId = null;
    fetchFolders(currentCommitteeId);
  } else if (currentCommitteeId !== null) {
    history.back();
  }
}

// --- دوال دروب داون أسماء المجلدات ---
function closeFolderNameDropdown() {
  if (folderNameMenu) folderNameMenu.classList.add('hidden');
  if (folderNameSearch) folderNameSearch.classList.add('hidden');
  if (addNewFolderNameLink) addNewFolderNameLink.classList.add('hidden');
}

function renderFolderNameOptions(list) {
  if (!folderNamesContainer) return;
  folderNamesContainer.innerHTML = '';
  if (!list.length) {
    folderNamesContainer.innerHTML = `<div class="no-content">${getTranslation('no-folders')}</div>`;
    return;
  }
  const lang = localStorage.getItem('language') || 'ar';
  list.forEach(item => {
    const div = document.createElement('div');
    div.className = 'folder-item';
    let folderDisplayName;
    try {
      const parsed = JSON.parse(item.name);
      folderDisplayName = parsed[lang] || parsed.ar;
    } catch (e) {
      folderDisplayName = item.name;
    }
    div.innerHTML = `
      <span class="label">${folderDisplayName}</span>
      <span class="actions">
        ${permissions.canEditFolderName   ? `<button class="edit-name"   data-id="${item.id}" data-name='${item.name}'>✎</button>` : ''}
        ${permissions.canDeleteFolderName ? `<button class="delete-name" data-id="${item.id}">🗑</button>` : ''}
      </span>
    `;
    const label = div.querySelector('.label');
    if(label) {
      label.addEventListener('click', e => {
        selectedFolderNameId = item.id;
        if (selectedFolderName) selectedFolderName.value = item.name;
        if (folderNameToggle) folderNameToggle.innerHTML = `${folderDisplayName} <span class="arrow">▾</span>`;
        closeFolderNameDropdown();
      });
    }

    const editBtn = div.querySelector('.edit-name');
    if(editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditFolderNameModal(item.id, item.name);
      });
    }

    const deleteBtn = div.querySelector('.delete-name');
    if(deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openDeleteFolderNameModal(item.id);
      });
    }
    
    folderNamesContainer.appendChild(div);
  });
}

async function loadFolderNameOptions() {
  try {
    const res = await fetch(`${apiBase}/api/committees/folder-names`);
    const json = await res.json();
    folderNameOptions = json.data || [];
    renderFolderNameOptions(folderNameOptions);
  } catch (err) {
    showToast('خطأ في جلب أسماء المجلدات', 'error');
  }
}

// --- ربط أحداث الدروب داون ---
if (folderNameToggle) {
  folderNameToggle.addEventListener('click', e => {
    e.stopPropagation();
    if (folderNameMenu) folderNameMenu.classList.toggle('hidden');
    if (folderNameSearch) folderNameSearch.classList.toggle('hidden');
    if (permissions.canAddFolderName && addNewFolderNameLink) {
      addNewFolderNameLink.classList.toggle('hidden');
    }
    if (!folderNameOptions.length) loadFolderNameOptions();
    renderFolderNameOptions(folderNameOptions);
  });
}
if (folderNameSearch) {
  folderNameSearch.addEventListener('input', () => {
    const q = folderNameSearch.value.toLowerCase();
    const lang = localStorage.getItem('language') || 'ar';
    const filtered = folderNameOptions.filter(item => {
      try {
        const parsed = JSON.parse(item.name);
        return (parsed.ar && parsed.ar.toLowerCase().includes(q)) || (parsed.en && parsed.en.toLowerCase().includes(q));
      } catch (e) {
        return item.name.toLowerCase().includes(q);
      }
    });
    renderFolderNameOptions(filtered);
  });
}
document.addEventListener('click', e => {
  if (folderNameMenu && !e.target.closest('#folderNameDropdown')) {
    closeFolderNameDropdown();
  }
});

// --- دروب داون تعديل اسم المجلد ---
function closeEditFolderNameDropdown() {
  const menu = document.getElementById('editFolderNameMenu');
  if (menu) menu.classList.add('hidden');
  const search = document.getElementById('editFolderNameSearch');
  if (search) search.classList.add('hidden');
}

async function loadEditFolderNameOptions() {
  try {
    const res = await fetch(`${apiBase}/api/committees/folder-names`);
    const json = await res.json();
    renderEditFolderNameOptions(json.data || []);
  } catch (err) {
    showToast('فشل تحميل أسماء المجلدات للتعديل', 'error');
  }
}

function renderEditFolderNameOptions(list) {
  const container = document.getElementById('editFolderNamesContainer');
  const hiddenInput = document.getElementById('editSelectedFolderName');
  const toggle = document.getElementById('editFolderNameToggle');
  if (!container) return;
  container.innerHTML = '';
  const lang = localStorage.getItem('language') || 'ar';
  // لا تضف زر برمجي هنا، اعتمد فقط على الزر القديم في الـ HTML
  list.forEach(item => {
    const div = document.createElement('div');
    div.className = 'folder-item';
    let folderDisplayName;
    try {
      const parsed = JSON.parse(item.name);
      folderDisplayName = parsed[lang] || parsed.ar;
    } catch (e) {
      folderDisplayName = item.name;
    }
    div.innerHTML = `
      <span class="label">${folderDisplayName}</span>
      <span class="actions">
        ${permissions.canEditFolderName   ? `<button class="edit-name"   data-id="${item.id}" data-name='${item.name}'>✎</button>` : ''}
        ${permissions.canDeleteFolderName ? `<button class="delete-name" data-id="${item.id}">🗑</button>` : ''}
      </span>
    `;
    const label = div.querySelector('.label');
    if(label) {
      label.addEventListener('click', () => {
        if (hiddenInput) hiddenInput.value = item.name;
        if (toggle) toggle.innerHTML = `${folderDisplayName} <span class="arrow">▾</span>`;
        closeEditFolderNameDropdown();
      });
    }
    const editBtn = div.querySelector('.edit-name');
    if(editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditFolderNameModal(item.id, item.name);
      });
    }
    const deleteBtn = div.querySelector('.delete-name');
    if(deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openDeleteFolderNameModal(item.id);
      });
    }
    container.appendChild(div);
  });
}

const editFolderNameToggle = document.getElementById('editFolderNameToggle');
const editFolderNameMenu = document.getElementById('editFolderNameMenu');
const editFolderNameSearch = document.getElementById('editFolderNameSearch');
const editFolderNamesContainer = document.getElementById('editFolderNamesContainer');

if (editFolderNameToggle) {
  editFolderNameToggle.addEventListener('click', e => {
    e.stopPropagation();
    if (editFolderNameMenu) editFolderNameMenu.classList.toggle('hidden');
    if (editFolderNameSearch) editFolderNameSearch.classList.toggle('hidden');
    loadEditFolderNameOptions();
  });
}
if (editFolderNameSearch) {
  editFolderNameSearch.addEventListener('input', () => {
    const q = editFolderNameSearch.value.toLowerCase();
    fetch(`${apiBase}/api/committees/folder-names`).then(res => res.json()).then(json => {
      const list = json.data || [];
      const lang = localStorage.getItem('language') || 'ar';
      const filtered = list.filter(item => {
        try {
          const parsed = JSON.parse(item.name);
          return (parsed.ar && parsed.ar.toLowerCase().includes(q)) || (parsed.en && parsed.en.toLowerCase().includes(q));
        } catch (e) {
          return item.name.toLowerCase().includes(q);
        }
      });
      renderEditFolderNameOptions(filtered);
    });
  });
}
document.addEventListener('click', e => {
  if (editFolderNameMenu && !e.target.closest('#editFolderNameDropdown')) {
    closeEditFolderNameDropdown();
  }
});

// إعادة تفعيل زر الإضافة القديم
const editAddNewFolderNameLink = document.getElementById('editAddNewFolderNameLink');
if (editAddNewFolderNameLink) {
  editAddNewFolderNameLink.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    openAddFolderNameModal();
    closeEditFolderNameDropdown();
  });
}

// --- ربط الأحداث ---
if (addFolderBtn) addFolderBtn.addEventListener('click', openAddFolderModal);
if (addFolderCloseBtn) addFolderCloseBtn.addEventListener('click', closeAddFolderModal);
if (cancelFolderBtn) cancelFolderBtn.addEventListener('click', closeAddFolderModal);
if (createFolderBtn) createFolderBtn.addEventListener('click', handleCreateFolder);
if (editFolderCloseBtn) editFolderCloseBtn.addEventListener('click', closeEditFolderModal);
if (cancelEditFolderBtn) cancelEditFolderBtn.addEventListener('click', closeEditFolderModal);
if (updateFolderBtn) updateFolderBtn.addEventListener('click', handleUpdateFolder);
if (addContentBtn) addContentBtn.addEventListener('click', openAddContentModal);
if (addContentCloseBtn) addContentCloseBtn.addEventListener('click', closeAddContentModal);
if (cancelContentBtn) cancelContentBtn.addEventListener('click', closeAddContentModal);
if (createContentBtn) createContentBtn.addEventListener('click', handleCreateContent);
if (addContentForm) addContentForm.addEventListener('submit', e => e.preventDefault());
if (editContentCloseBtn) editContentCloseBtn.addEventListener('click', closeEditContentModal);
if (cancelEditContentBtn) cancelEditContentBtn.addEventListener('click', closeEditContentModal);
if (updateContentBtn) updateContentBtn.addEventListener('click', handleUpdateContent);
if (confirmDeleteContentBtn) confirmDeleteContentBtn.addEventListener('click', handleDeleteContent);
if (cancelDeleteContentBtn) cancelDeleteContentBtn.addEventListener('click', closeDeleteContentModal);
if (deleteContentCloseBtn) deleteContentCloseBtn.addEventListener('click', closeDeleteContentModal);
if (contentFileInput) contentFileInput.addEventListener('change', function() {
  handleFileSelection(this);
  if (this.files.length > 0) {
    const fileName = this.files[0].name.replace(/\.[^/.]+$/, '');
    let contentTitleInput = document.getElementById('contentTitle');
    if (!contentTitleInput) {
      // أنشئ input مخفي إذا لم يكن موجودًا
      contentTitleInput = document.createElement('input');
      contentTitleInput.type = 'hidden';
      contentTitleInput.id = 'contentTitle';
      contentTitleInput.name = 'contentTitle';
      this.form?.appendChild(contentTitleInput);
    }
    contentTitleInput.value = fileName;
  }
});
if (editContentFileInput) editContentFileInput.addEventListener('change', function() {
  handleFileSelection(this);
  if (this.files.length > 0) {
    const fileName = this.files[0].name.replace(/\.[^/.]+$/, '');
    const contentTitleInput = document.getElementById('editContentTitle');
    if (contentTitleInput) {
        contentTitleInput.value = fileName;
    }
  }
});
if (backToFilesBtn) backToFilesBtn.addEventListener('click', handleBackButton);
if (mainBackBtn) mainBackBtn.addEventListener('click', handleBackButton);

// --- ربط أحداث مودالات أسماء المجلدات ---
if(addNewFolderNameLink) addNewFolderNameLink.addEventListener('click', openAddFolderNameModal);
if(saveAddFolderNameBtn) saveAddFolderNameBtn.addEventListener('click', handleCreateFolderName);
if(cancelAddFolderNameBtn) cancelAddFolderNameBtn.addEventListener('click', closeAddFolderNameModal);
if(saveEditFolderNameBtn) saveEditFolderNameBtn.addEventListener('click', handleUpdateFolderName);
if(cancelEditFolderNameBtn) cancelEditFolderNameBtn.addEventListener('click', closeEditFolderNameModal);
if(confirmDeleteFolderNameBtn) confirmDeleteFolderNameBtn.addEventListener('click', handleDeleteFolderName);
if(cancelDeleteFolderNameBtn) cancelDeleteFolderNameBtn.addEventListener('click', closeDeleteFolderNameModal);

// --- دالة التعامل مع اختيار الملف (PDF فقط) ---
function handleFileSelection(inputElement) {
  const fileDropArea = inputElement.closest('.file-drop-area');
  if (!fileDropArea) return;
  const fileUploadText = fileDropArea.querySelector('.file-upload-text');
  if (!fileUploadText) return;
  if (inputElement.files.length > 0) {
    const file = inputElement.files[0];
    if (file.type !== 'application/pdf') {
      showToast(getTranslation('pdf-only'), 'error');
      inputElement.value = '';
      fileUploadText.innerHTML = `<span class="supported-files">${getTranslation('pdf-only')}</span>`;
      fileDropArea.classList.remove('has-file');
      return;
    }
    const fileName = file.name;
    fileUploadText.innerHTML = `<span class="selected-file">${getTranslation('selected-file')}${fileName}</span>`;
    fileDropArea.classList.add('has-file');
  } else {
    fileUploadText.innerHTML = `<span class="supported-files">${getTranslation('pdf-only')}</span>`;
    fileDropArea.classList.remove('has-file');
  }
}



// --- تهيئة الصفحة ---
document.addEventListener('DOMContentLoaded', async function() {
  await fetchPermissions();

  // بعد جلب الصلاحيات، تأكد من تحديث الأزرار الرئيسية
  if (addFolderBtn) addFolderBtn.style.display = permissions.canAddFolder ? 'block' : 'none';
  if (addContentBtn) addContentBtn.style.display = permissions.canAddContent ? 'block' : 'none';

  // أنشئ زر إضافة محتوى معتمد بعد تحميل الصفحة
  addApprovedContentBtn = document.createElement('button');
  addApprovedContentBtn.className = 'btn-primary';
  addApprovedContentBtn.id = 'addApprovedContentBtn';
  addApprovedContentBtn.type = 'button';
  addApprovedContentBtn.textContent = getTranslation('add-approved-content') || 'إضافة محتوى معتمد';
  addApprovedContentBtn.style.marginRight = '10px';
  addApprovedContentBtn.style.display = 'none';
  if (addContentBtn && addContentBtn.parentNode) {
    addContentBtn.parentNode.insertBefore(addApprovedContentBtn, addContentBtn.nextSibling);
  }
  // منطق إظهار الزر حسب الصلاحية
  if (addApprovedContentBtn) {
    if (permissions.canAddApprovedContent || (window.localStorage.getItem('token') && JSON.parse(atob(window.localStorage.getItem('token').split('.')[1])).role === 'admin')) {
      addApprovedContentBtn.style.display = 'inline-block';
    } else {
      addApprovedContentBtn.style.display = 'none';
    }
  }
  // ربط الأحداث للزرين
  if (addContentBtn) addContentBtn.addEventListener('click', function() {
    isForceApproved = false;
    openAddContentModal();
  });
  if (addApprovedContentBtn) addApprovedContentBtn.addEventListener('click', function() {
    isForceApproved = true;
    openAddContentModal();
  });
  // متغير global
  // let isForceApproved = false; // This line is removed as per the edit hint.

  const urlParams = new URLSearchParams(window.location.search);
  currentCommitteeId = urlParams.get('committeeId');
  if (currentCommitteeId) {
      await fetchFolders(currentCommitteeId);
  } else {
    console.warn('committeeId not found in URL. Cannot fetch folders.');
  }
});
