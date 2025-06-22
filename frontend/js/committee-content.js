// ... سيتم نسخ منطق الأقسام وتعديله ليعمل على اللجان ...
// مثال: fetch(`/api/committees/${committeeId}/folders`) بدلاً من الأقسام
// سيتم تضمين كل الدوال الخاصة بالإضافة والتعديل والحذف للمجلدات والمحتوى مع التعديلات اللازمة 

const apiBase = 'http://localhost:3006';
const permissions = {
  canAddFolder:    false,
  canAddFolderName: false,
  canEditFolder:   false,
  canEditFolderName: false,
  canDeleteFolder: false,
  canDeleteFolderName: false,

  canAddContent:   false,
  canAddContentName: false,
  canEditContent:  false,
  canEditContentName: false,
  canDeleteContent:false,
  canDeleteContentName:false
};

// دالة الترجمة
function getTranslation(key) {
  const lang = localStorage.getItem('language') || 'ar';
  const translations = {
    ar: {
      'select-content': 'يرجى اختيار اسم المحتوى وملف',
      'content-added-success': 'تم إضافة المحتوى بنجاح',
      'content-update-success': 'تم تحديث المحتوى بنجاح',
      'content-deleted-success': 'تم حذف المحتوى بنجاح',
      'content-title-required': 'عنوان المحتوى مطلوب',
      'folder-added-success': 'تم إضافة المجلد بنجاح',
      'folder-updated-success': 'تم تحديث المجلد بنجاح',
      'folder-deleted-success': 'تم حذف المجلد بنجاح',
      'folder-name-required': 'اسم المجلد مطلوب',
      'choose-folder-name': 'اختر اسم المجلد',
      'choose-content-name': 'اختر عنوان المحتوى',
      'select-folder': 'يرجى اختيار مجلد أولاً',
      'pdf-only': 'ملفات PDF فقط',
      'selected-file': 'الملف المحدد: ',
      'file-link-unavailable': 'رابط الملف غير متاح',
      'status-approved': 'معتمد',
      'status-awaiting': 'في انتظار الاعتماد',
      'no-folders': 'لا توجد مجلدات',
      'no-contents': 'لا يوجد محتوى',
      'delete-folder-confirm': 'هل أنت متأكد من حذف هذا المجلد؟',
      'delete-content-confirm': 'هل أنت متأكد من حذف هذا المحتوى؟',
      'error-occurred': 'حدث خطأ'
    },
    en: {
      'select-content': 'Please select content title and file',
      'content-added-success': 'Content added successfully',
      'content-update-success': 'Content updated successfully',
      'content-deleted-success': 'Content deleted successfully',
      'content-title-required': 'Content title is required',
      'folder-added-success': 'Folder added successfully',
      'folder-updated-success': 'Folder updated successfully',
      'folder-deleted-success': 'Folder deleted successfully',
      'folder-name-required': 'Folder name is required',
      'choose-folder-name': 'Choose folder name',
      'choose-content-name': 'Choose content title',
      'select-folder': 'Please select a folder first',
      'pdf-only': 'PDF files only',
      'selected-file': 'Selected file: ',
      'file-link-unavailable': 'File link unavailable',
      'status-approved': 'Approved',
      'status-awaiting': 'Awaiting approval',
      'no-folders': 'No folders',
      'no-contents': 'No contents',
      'delete-folder-confirm': 'Are you sure you want to delete this folder?',
      'delete-content-confirm': 'Are you sure you want to delete this content?',
      'error-occurred': 'An error occurred'
    }
  };
  
  return translations[lang]?.[key] || key;
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

    function getToken() {
        const token = localStorage.getItem('token');
        if (!token) {
            console.log('Token not found in localStorage');
            return null;
        }
        console.log('Token retrieved in getToken():', token ? 'Exists' : 'Not Found');
        return token;
    }
    async function loadFolderNameOptions() {
  try {
    const res = await fetch(`${apiBase}/api/committees/folder-names`);
    const json = await res.json();
    folderNameOptions = json.data || [];
    renderFolderNameOptions(folderNameOptions);
  } catch (err) {
    console.error('خطأ في جلب أسماء المجلدات:', err);
  }
}
function renderFolderNameOptions(list) {
  if (!folderNamesContainer) return;
  
  folderNamesContainer.innerHTML = '';
  if (!list.length) {
    folderNamesContainer.innerHTML = `<div class="no-content" data-translate="no-folders">${getTranslation('no-folders')}</div>`;
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
  div.addEventListener('click', e => {
  if (e.target.closest('.actions')) return;
  selectedFolderNameId = item.id;
  document.getElementById('selectedFolderName').value = item.name; // <== هذا السطر مهم
  folderNameToggle.innerHTML = `${folderDisplayName} <span class="arrow">▾</span>`;
  closeFolderNameDropdown();
});

    if (permissions.canEditFolderName) {
      div.querySelector('.edit-name')?.addEventListener('click', e => {
        e.stopPropagation();
        openEditFolderNameModal(item.id, item.name);
      });
    }
    if (permissions.canDeleteFolderName) {
      div.querySelector('.delete-name')?.addEventListener('click', e => {
        e.stopPropagation();
        openDeleteFolderNameModal(item.id);
      });
    }
    folderNamesContainer.appendChild(div);
  });
}
function closeFolderNameDropdown() {
  if (folderNameMenu) folderNameMenu.classList.add('hidden');
  if (folderNameSearch) folderNameSearch.classList.add('hidden');
  if (addNewFolderNameLink) addNewFolderNameLink.classList.add('hidden');
}
let contentTitleOptions = [];
let selectedContentTitleId = null;

async function loadContentTitleOptions() {
  try {
    const res = await fetch(`${apiBase}/api/committees/content-titles`);
    const json = await res.json();
    contentTitleOptions = json.data || [];
    renderContentTitleOptions(contentTitleOptions);
  } catch (err) {
    console.error('❌ فشل تحميل عناوين المحتوى:', err);
  }
}
function renderContentTitleOptions(list) {
  const container = document.getElementById('contentTitleOptionsContainer');
  if (!container) return;
  
  container.innerHTML = '';
  if (!list.length) {
    container.innerHTML = `<div class="no-content" data-translate="no-contents">${getTranslation('no-contents')}</div>`;
    return;
  }
  const lang = localStorage.getItem('language') || 'ar';
  list.forEach(item => {
    const div = document.createElement('div');
    div.className = 'folder-item';
    let contentDisplayName;
    try {
      const parsed = JSON.parse(item.name);
      contentDisplayName = parsed[lang] || parsed.ar;
    } catch (e) {
      contentDisplayName = item.name;
    }
    div.innerHTML = `
      <span class="label">${contentDisplayName}</span>
      <span class="actions">
        ${permissions.canEditContentName   ? `<button class="edit-name"   data-id="${item.id}" data-name='${item.name}'>✎</button>` : ''}
        ${permissions.canDeleteContentName ? `<button class="delete-name" data-id="${item.id}">🗑</button>` : ''}
      </span>
    `;
div.addEventListener('click', e => {
  if (e.target.closest('.actions')) return;

  // خزن الـ JSON الأصلي في الحقل المخفي
  const hiddenInput = document.getElementById('selectedContentTitle');
  if (hiddenInput) hiddenInput.value = item.name;  // ← JSON string

  // اعرض النص المترجم على الزر
  document.getElementById('contentTitleToggle').innerHTML =
    `${contentDisplayName} <span class="arrow">▾</span>`;

  closeContentTitleDropdown();
});

    if (permissions.canEditContentName) {
      div.querySelector('.edit-name')?.addEventListener('click', e => {
        e.stopPropagation();
        openEditContentTitleModal(item.id, item.name);
      });
    }
    if (permissions.canDeleteContentName) {
      div.querySelector('.delete-name')?.addEventListener('click', e => {
        e.stopPropagation();
        openDeleteContentTitleModal(item.id);
      });
    }
    container.appendChild(div);
  });
}
function closeContentTitleDropdown() {
  const menu = document.getElementById('contentTitleMenu');
  if (menu) menu.classList.add('hidden');
  const addLink = document.getElementById('addNewContentTitleLink');
  if (addLink) addLink.classList.add('hidden');
}
// --- دعم أسماء المحتوى متعدد اللغات ---

// --- مودال إضافة وتعديل اسم المحتوى (دوال فقط، HTML لاحقاً) ---
function openAddContentTitleModal() {
  const modal = document.getElementById('addContentTitleModal');
  if (!modal) return;
  
  modal.style.display = 'flex';
  
  const contentTitleAr = document.getElementById('contentTitleAr');
  const contentTitleEn = document.getElementById('contentTitleEn');
  
  if (contentTitleAr) contentTitleAr.value = '';
  if (contentTitleEn) contentTitleEn.value = '';
}
function openEditContentTitleModal(id, name) {
  const modal = document.getElementById('editContentTitleModal');
  if (!modal) return;
  
  modal.style.display = 'flex';
  
  const editContentTitleId = document.getElementById('editContentTitleId');
  const editContentTitleAr = document.getElementById('editContentTitleAr');
  const editContentTitleEn = document.getElementById('editContentTitleEn');
  
  if (editContentTitleId) editContentTitleId.value = id;
  
  try {
    const parsed = JSON.parse(name);
    if (editContentTitleAr) editContentTitleAr.value = parsed.ar || '';
    if (editContentTitleEn) editContentTitleEn.value = parsed.en || '';
  } catch {
    if (editContentTitleAr) editContentTitleAr.value = name;
    if (editContentTitleEn) editContentTitleEn.value = '';
  }
}
function openDeleteContentTitleModal(id) {
  const modal = document.getElementById('deleteContentTitleModal');
  if (!modal) return;
  
  modal.style.display = 'flex';
  
  const deleteContentTitleId = document.getElementById('deleteContentTitleId');
  if (deleteContentTitleId) deleteContentTitleId.value = id;
}
document.addEventListener('DOMContentLoaded',async function() {
    let isInitialFetch = true;
    let currentCommitteeId = null;
    let currentFolderId = null;
const folderNameToggle     = document.getElementById('folderNameToggle');
const folderNameMenu       = document.getElementById('folderNameMenu');
const folderNameSearch     = document.getElementById('folderNameSearch');
const folderNamesContainer = document.getElementById('folderNamesContainer');
const addNewFolderNameLink = document.getElementById('addNewFolderNameLink');
const selectedFolderName   = document.getElementById('selectedFolderName');

let folderNameOptions = [];
let selectedFolderNameId = null;






folderNameToggle.addEventListener('click', e => {
  e.stopPropagation();
  folderNameMenu.classList.toggle('hidden');
  folderNameSearch.classList.toggle('hidden');

  // بدل إظهار الزرّ دائماً، أظهره فقط لو عنده صلاحية
  if (permissions.canAddFolderName) {
    addNewFolderNameLink.classList.toggle('hidden');
  }

  if (!folderNameOptions.length) {
    loadFolderNameOptions();
  }
  renderFolderNameOptions(folderNameOptions);
});

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

// ربط زر "+ إضافة اسم جديد" بدالة فتح المودال
addNewFolderNameLink.addEventListener('click', async (e) => {
  e.preventDefault();
  e.stopPropagation();
  openAddFolderNameModal();
  closeFolderNameDropdown();
});

document.addEventListener('click', e => {
  if (!e.target.closest('#folderNameDropdown')) {
    folderNameMenu.classList.add('hidden');
    folderNameSearch.classList.add('hidden');
    addNewFolderNameLink.classList.add('hidden');
  }
});
async function updateFolderName(id, newName) {
  try {
    const res = await fetch(`${apiBase}/api/committees/folder-names/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName })
    });
    const json = await res.json();
    if (res.ok) {
      showToast(getTranslation('folder-updated-success'), 'success');
      await loadFolderNameOptions();
    } else {
      showToast(json.message || getTranslation('error-occurred'), 'error');
    }
  } catch (err) {
    console.error('خطأ أثناء التعديل:', err);
    showToast(getTranslation('error-occurred'), 'error');
  }
}

async function deleteFolderName(id) {
  try {
    const res = await fetch(`${apiBase}/api/committees/folder-names/${id}`, {
      method: 'DELETE'
    });
    const json = await res.json();
    if (res.ok) {
      showToast(getTranslation('folder-deleted-success'), 'success');
      await loadFolderNameOptions();
    } else {
      showToast(json.message || getTranslation('error-occurred'), 'error');
    }
  } catch (err) {
    console.error('خطأ أثناء الحذف:', err);
    showToast(getTranslation('error-occurred'), 'error');
  }
}
async function loadEditFolderNameOptions() {
  try {
    const res = await fetch(`${apiBase}/api/committees/folder-names`);
    const json = await res.json();
    renderEditFolderNameOptions(json.data || []);
  } catch (err) {
    console.error('فشل تحميل أسماء المجلدات للتعديل:', err);
  }
}
function getLocalizedName(name) {
  const lang = localStorage.getItem('language') || 'ar';
  try {
    const parsed = JSON.parse(name);
    return parsed[lang] || parsed.ar || parsed.en || name;
  } catch {
    return name;
  }
}

function renderEditFolderNameOptions(list) {
  const container   = document.getElementById('editFolderNamesContainer');
  const hiddenInput = document.getElementById('editSelectedFolderName');
  const toggle      = document.getElementById('editFolderNameToggle');
  
  if (!container) return;
  
  container.innerHTML = '';

  list.forEach(item => {
    const localizedName = getLocalizedName(item.name); // ✅ استخراج الاسم الصحيح

    const div = document.createElement('div');
    div.className = 'folder-item';

    // الاسم نفسه
    const label = document.createElement('span');
    label.className = 'label folder-label';
    label.textContent = localizedName; // ✅ هنا
    label.addEventListener('click', () => {
      if (hiddenInput) hiddenInput.value = item.name; // ❗ احتفظ بالـ JSON الحقيقي هنا
      if (toggle) toggle.innerHTML = `${localizedName} <span class="arrow">▾</span>`; // ✅ مترجم
      closeEditFolderNameDropdown();
    });
    div.appendChild(label);

    // حاوية الأزرار
    const actions = document.createElement('span');
    actions.className = 'actions';

    // زر التعديل
    if (permissions.canEditFolderName) {
      const btnEdit = document.createElement('button');
      btnEdit.className = 'btn-edit';
      btnEdit.dataset.id   = item.id;
      btnEdit.dataset.name = item.name; // ❗ لا تغيّره علشان الدالة الأخرى تحتاجه JSON
      btnEdit.textContent  = '✎';
      btnEdit.addEventListener('click', async e => {
        e.stopPropagation();
        openEditFolderNameModal(item.id, item.name); // ❗ يُستخدم كما هو
      });
      actions.appendChild(btnEdit);
    }

    // زر الحذف
    if (permissions.canDeleteFolderName) {
      const btnDelete = document.createElement('button');
      btnDelete.className = 'btn-delete';
      btnDelete.dataset.id = item.id;
      btnDelete.textContent  = '🗑';
      btnDelete.addEventListener('click', async e => {
        e.stopPropagation();
        if (confirm(getTranslation('delete-folder-confirm'))) {
          await deleteFolderName(item.id);
          await loadEditFolderNameOptions();
          showToast(getTranslation('folder-deleted-success'), 'success');
        }
      });
      actions.appendChild(btnDelete);
    }

    div.appendChild(actions);
    container.appendChild(div);
  });

  // زر "+" أضف جديد
  const addNewBtn = document.getElementById('editAddNewFolderNameLink');
  if (permissions.canAddFolderName) {
    if (addNewBtn) {
      addNewBtn.classList.remove('hidden');
      addNewBtn.onclick = async () => {
        openAddFolderNameModal();
      };
    }
  } else {
    if (addNewBtn) {
      addNewBtn.classList.add('hidden');
      addNewBtn.onclick = null;
    }
  }
}


async function createFolderName(name) {
  try {
    const res = await fetch(`${apiBase}/api/committees/folder-names`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ name })
    });
    if (!res.ok) throw new Error('فشل الإضافة');
    return await res.json();
  } catch (err) {
    console.error('Create Folder Name Error:', err);
    showToast(getTranslation('error-occurred'), 'error');
  }
}

function closeEditFolderNameDropdown() {
  const menu = document.getElementById('editFolderNameMenu');
  if (menu) menu.classList.add('hidden');
}
document.getElementById('editFolderNameToggle').addEventListener('click', () => {
  const menu = document.getElementById('editFolderNameMenu');
  menu.classList.toggle('hidden');
});



document.addEventListener('DOMContentLoaded', () => {
  // تحميل العناوين
  loadContentTitleOptions();
  
  const container = document.getElementById('contentTitleOptionsContainer');
  if (container) {
    container.addEventListener('click', async e => {
      const id = e.target.dataset.id;
      const name = e.target.dataset.name;

      if (e.target.classList.contains('btn-edit')) {
        openEditContentTitleModal(id, name);
      }

      if (e.target.classList.contains('btn-delete')) {
        if (!confirm(getTranslation('delete-content-confirm'))) return;

        const res = await fetch(`${apiBase}/api/committees/content-titles/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${getToken()}`
          }
        });

        const json = await res.json();
        if (res.ok) {
          await loadContentTitleOptions();
          showToast(getTranslation('content-deleted-success'), 'success');
        } else {
          showToast(json.message || getTranslation('error-occurred'), 'error');
        }
      }
    });
  } else {
    console.warn('📛 contentTitleOptionsContainer غير موجود في الصفحة!');
  }
});

document.getElementById('contentTitleToggle').addEventListener('click', () => {
  const menu = document.getElementById('contentTitleMenu');
  menu.classList.toggle('hidden');
  const search = document.getElementById('contentTitleSearch');
  if (search) search.classList.toggle('hidden');
  
  // إظهار/إخفاء زر إضافة جديد حسب الصلاحية
  const addLink = document.getElementById('addNewContentTitleLink');
  if (permissions.canAddContentName) {
    addLink.classList.toggle('hidden');
  }
  
  if (!contentTitleOptions.length) {
    loadContentTitleOptions();
  }
  renderContentTitleOptions(contentTitleOptions);
});

// ربط زر "+ إضافة عنوان جديد" بدالة فتح المودال
document.getElementById('addNewContentTitleLink').addEventListener('click', async (e) => {
  e.preventDefault();
  e.stopPropagation();
  openAddContentTitleModal();
  closeContentTitleDropdown();
});

document.addEventListener('click', function (e) {
  const dropdown = document.getElementById('contentTitleDropdown');
  const menu = document.getElementById('contentTitleMenu');
  if (!dropdown.contains(e.target)) {
    menu.classList.add('hidden');
    const addLink = document.getElementById('addNewContentTitleLink');
    if (addLink) addLink.classList.add('hidden');
    const search = document.getElementById('contentTitleSearch');
    if (search) search.classList.add('hidden');
  }
});
let editContentTitleOptions = [];

async function loadEditContentTitleOptions() {
  try {
    const res = await fetch(`${apiBase}/api/committees/content-titles`);
    const json = await res.json();
    editContentTitleOptions = json.data || [];
    renderEditContentTitleOptions(editContentTitleOptions);
  } catch (err) {
    console.error('❌ فشل تحميل عناوين المحتوى للتعديل:', err);
  }
}

async function deleteContentTitle(id) {
  try {
    const res = await fetch(`${apiBase}/api/committees/content-titles/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const json = await res.json();
    if (res.ok) {
      showToast(getTranslation('content-deleted-success'), 'success');
      await loadContentTitleOptions();
    } else {
      showToast(json.message || getTranslation('error-occurred'), 'error');
    }
  } catch (err) {
    console.error('خطأ أثناء حذف عنوان المحتوى:', err);
    showToast(getTranslation('error-occurred'), 'error');
  }
}

function renderEditContentTitleOptions(list) {
  const container   = document.getElementById('editContentTitlesContainer');
  const searchInput = document.getElementById('editContentTitleSearch');
  if (!container) return;
  container.innerHTML = '';

  if (!list.length) {
    container.innerHTML = `<div class="no-content">${getTranslation('no-contents')}</div>`;
    return;
  }

  list.forEach(item => {
    const div = document.createElement('div');
    div.className = 'folder-item';

    // 1) اعرض الاسم المترجم
    const label = document.createElement('span');
    label.className = 'label';
    const display = getLocalizedName(item.name);
    label.textContent = display;
    label.addEventListener('click', () => {
      // 2) خزّن الجيسون في الحقل المخفي
      const hidden = document.getElementById('editSelectedContentTitle');
      if (hidden) hidden.value = item.name;  

      // 3) اعرض الاسم المترجم على الزر
      const toggle = document.getElementById('editContentTitleToggle');
      if (toggle) toggle.innerHTML = `${display} <span class="arrow">▾</span>`;

      closeEditContentTitleDropdown();
    });
    div.appendChild(label);

    // زرّ التعديل (إذا لديه صلاحية)
    if (permissions.canEditContentName) {
      const btnEdit = document.createElement('button');
      btnEdit.className = 'btn-edit';
      btnEdit.dataset.id   = item.id;
      btnEdit.dataset.name = item.name;
      btnEdit.textContent  = '✎';
      btnEdit.addEventListener('click', async e => {
        e.stopPropagation();
        openEditContentTitleModal(item.id, item.name);
      });
      div.appendChild(btnEdit);
    }

    // زرّ الحذف (إذا لديه صلاحية)
    if (permissions.canDeleteContentName) {
      const btnDelete = document.createElement('button');
      btnDelete.className = 'btn-delete';
      btnDelete.dataset.id = item.id;
      btnDelete.textContent = '🗑';
      btnDelete.addEventListener('click', async e => {
        e.stopPropagation();
        if (confirm(getTranslation('delete-content-confirm'))) {
          await deleteContentTitle(item.id);
          await loadEditContentTitleOptions();
          showToast(getTranslation('content-deleted-success'), 'success');
        }
      });
      div.appendChild(btnDelete);
    }

    container.appendChild(div);
  });

  // فلترة البحث
  if (searchInput) {
    searchInput.oninput = () => {
      const search   = searchInput.value.toLowerCase();
      const filtered = editContentTitleOptions.filter(c =>
        c.name.toLowerCase().includes(search)
      );
      renderEditContentTitleOptions(filtered);
    };
  }

  // رابط "+ إضافة عنوان جديد"
  const addNewBtn = document.getElementById('editAddNewContentTitleLink');
  if (permissions.canAddContentName) {
    if (addNewBtn) {
      addNewBtn.classList.remove('hidden');
      addNewBtn.onclick = async () => {
        openAddContentTitleModal();
      };
    }
  } else {
    if (addNewBtn) {
      addNewBtn.classList.add('hidden');
      addNewBtn.onclick = null;
    }
  }
}

document.getElementById('editContentTitlesContainer').addEventListener('click', async e => {
  const id = e.target.dataset.id;
  const name = e.target.dataset.name;

  if (e.target.classList.contains('btn-edit')) {
    openEditContentTitleModal(id, name);
  }

  if (e.target.classList.contains('btn-delete')) {
    if (!confirm(getTranslation('delete-content-confirm'))) return;

    const res = await fetch(`${apiBase}/api/committees/content-titles/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });

    const json = await res.json();
    if (res.ok) {
      await loadEditContentTitleOptions();
      showToast(getTranslation('content-deleted-success'), 'success');
    } else {
      showToast(json.message || getTranslation('error-occurred'), 'error');
    }
  }
});

    // Get DOM elements once at the start of DOMContentLoaded
    const foldersSection = document.querySelector('.folders-section');
    const folderContentsSection = document.querySelector('.folder-contents-section');
    const folderContentTitle = document.querySelector('.folder-content-title');

    const addFolderBtn = document.getElementById('addFolderBtn');
    const addFolderModal = document.getElementById('addFolderModal');
    const addFolderCloseBtn = addFolderModal ? addFolderModal.querySelector('.close-button') : null;
    const cancelFolderBtn = addFolderModal ? addFolderModal.querySelector('#cancelFolderBtn') : null;
    const createFolderBtn = addFolderModal ? addFolderModal.querySelector('#createFolderBtn') : null;
    
    const addContentBtn = document.getElementById('addContentBtn');
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

    // File input elements
    const contentFileInput = document.getElementById('contentFile');

    await fetchPermissions();
// أخف أو أظهر الأزرار العامّة
  if (!permissions.canAddFolder)  addFolderBtn   .style.display = 'none';
  if (!permissions.canAddContent) addContentBtn .style.display = 'none';

    // دالة لجلب التوكن من localStorage (مكررة، يمكن نقلها إلى shared.js)


    // دالة لفك تشفير التوكن والحصول على دور المستخدم
    function getUserRoleFromToken() {
        const token = getToken();
        if (!token) return null;
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload).role; // افترض أن الدور موجود في الحمولة كـ 'role'
        } catch (e) {
            console.error('Error decoding token:', e);
            return null;
        }
    }
    
async function fetchPermissions() {
  const userId = JSON.parse(atob(getToken().split('.')[1])).id;
  const headers = { 'Authorization': `Bearer ${getToken()}` };
  // كالمعتاد: جلب role
  const userRes = await fetch(`${apiBase}/api/users/${userId}`, { headers });
  const { data: user } = await userRes.json();
  if (['admin'].includes(user.role)) {
    // للمسؤولين: صلاحيات كاملة
    Object.keys(permissions).forEach(k => permissions[k]=true);
    return;
  }
  // ثم جلب قائمة المفاتيح
  const permsRes = await fetch(`${apiBase}/api/users/${userId}/permissions`, { headers });
  const { data: perms } = await permsRes.json();
 const keys = perms.map(p => 
    (typeof p === 'string' ? p : p.permission)
  );  // منها `add_section` و `edit_section` و `delete_section`
  if (keys.includes('add_folder_committee'))    permissions.canAddFolder    = true;
  if (keys.includes('edit_folder_committee'))   permissions.canEditFolder   = true;
  if (keys.includes('delete_folder_committee')) permissions.canDeleteFolder = true;
  if (keys.includes('add_folder_committee_name'))    permissions.canAddFolderName    = true;
  if (keys.includes('edit_folder_committee_name'))   permissions.canEditFolderName   = true;
  if (keys.includes('delete_folder_committee_name')) permissions.canDeleteFolderName = true;
  // وبالمثل لمحتوى الملفات:
  if (keys.includes('add_content_committee'))    permissions.canAddContent    = true;
  if (keys.includes('edit_content_committee'))   permissions.canEditContent   = true;
  if (keys.includes('delete_content_committee')) permissions.canDeleteContent = true;
  if (keys.includes('add_content_committee_name'))    permissions.canAddContentName    = true;
  if (keys.includes('edit_content_committee_name'))   permissions.canEditContentName   = true;
  if (keys.includes('delete_content_committee_name')) permissions.canDeleteContentName = true;
}
    // جلب معرف اللجنة من الرابط
    const urlParams = new URLSearchParams(window.location.search);
    const committeeIdFromUrl = urlParams.get('committeeId');
    if (!committeeIdFromUrl) {
      showToast('لم يتم تحديد اللجنة');
      return;
    }
    currentCommitteeId = committeeIdFromUrl;
    fetchFolders(currentCommitteeId);

    async function fetchFolders(committeeId) {
      if (currentFolderId !== null) return;
      
      if (foldersSection) foldersSection.style.display = 'block';
      if (folderContentsSection) folderContentsSection.style.display = 'none';
      if (backToFilesContainer) backToFilesContainer.style.display = 'none';
      if (folderContentTitle) folderContentTitle.textContent = 'مجلدات اللجنة';
      
      try {
        const response = await fetch(`${apiBase}/api/committees/${committeeId}/folders`);
        const folders = await response.json();
        const foldersList = document.querySelector('.folders-list');
        if (!foldersList) return;
        
        foldersList.innerHTML = '';
        
        if (folders.length) {
folders.forEach(folder => {
  const card = document.createElement('div');
  card.className = 'folder-card';
  card.dataset.id = folder.id;

  const localizedName = getLocalizedName(folder.name); // ✅ هنا

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
      fetchFolderContents(folder.id, localizedName); // ✅ تم التعديل هنا
    }
  });

  const editIcon = card.querySelector('.edit-icon');
  if (editIcon) {
    editIcon.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      openEditFolderModal(folder.id, localizedName); // ✅ تم التعديل هنا
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
      } catch (err) {
        showToast(getTranslation('error-occurred'), 'error');
      }
    }

async function fetchFolderContents(folderId, folderName) {
  currentFolderId = folderId;
  
  if (foldersSection) foldersSection.style.display = 'none';
  if (folderContentsSection) folderContentsSection.style.display = 'block';
  if (backToFilesContainer) backToFilesContainer.style.display = 'block';
  if (folderContentTitle) folderContentTitle.textContent = folderName || getTranslation('folder-content-title');

  try {
    const token = getToken();
    const response = await fetch(`${apiBase}/api/committees/folders/${folderId}/contents`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const responseJson = await response.json();
    const contents = Array.isArray(responseJson.data)
      ? responseJson.data
      : (Array.isArray(responseJson) ? responseJson : []);

    const filesList = document.querySelector('.files-list');
    if (!filesList) return;
    
    filesList.innerHTML = '';

    const decodedToken = JSON.parse(atob(token.split('.')[1]));
    const isAdmin = decodedToken.role === 'admin';

    const filteredContents = isAdmin ? contents : contents.filter(content => content.approval_status === 'approved');

    if (filteredContents.length > 0) {
      filteredContents.forEach(content => {
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

        fileItem.addEventListener('click', function(e) {
          if (!e.target.closest('.edit-icon') && !e.target.closest('.delete-icon')) {
            if (content.file_path) {
              const baseUrl = apiBase.replace('/api', '');
              window.open(`${baseUrl}/${content.file_path}`, '_blank');
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
    } else {
      filesList.innerHTML = `<div class="no-content" data-translate="no-contents">${getTranslation('no-contents')}</div>`;
    }

  } catch (err) {
    console.error('❌ خطأ في fetchFolderContents:', err);
    showToast(getTranslation('error-occurred'), 'error');
  }
}

    // باقي الدوال: إضافة/تعديل/حذف مجلد ومحتوى، modals، إلخ (مطابقة للأقسام مع تغيير المسميات)

    // دوال إدارة المجلدات
    function openAddFolderModal() {
        const modal = document.getElementById('addFolderModal');
        if (modal) modal.style.display = 'flex';
    }

function closeAddFolderModal() {
  const modal = document.getElementById('addFolderModal');
  if (modal) modal.style.display = 'none';

  const selectedInput = document.getElementById('selectedFolderName');
  if (selectedInput) selectedInput.value = '';

  const toggleBtn = document.getElementById('folderNameToggle');
  if (toggleBtn) toggleBtn.innerHTML = `${getTranslation('choose-folder-name')} <span class="arrow">▾</span>`;
}

function openEditFolderModal(folderId, folderName) {
  const modal = document.getElementById('editFolderModal');
  if (!modal) return;
  
  modal.style.display = 'flex';

  const editFolderId = document.getElementById('editFolderId');
  const editSelectedFolderName = document.getElementById('editSelectedFolderName');
  const editFolderNameToggle = document.getElementById('editFolderNameToggle');
  
  if (editFolderId) editFolderId.value = folderId;
  if (editSelectedFolderName) editSelectedFolderName.value = folderName;
  if (editFolderNameToggle) editFolderNameToggle.innerHTML = `${folderName} <span class="arrow">▾</span>`;

  loadEditFolderNameOptions(); // جلب أسماء المجلدات لعرضها
}

    function closeEditFolderModal() {
        const modal = document.getElementById('editFolderModal');
        if (modal) modal.style.display = 'none';
    }

    function openDeleteFolderModal(folderId) {
        if (confirm(getTranslation('delete-folder-confirm'))) {
            deleteFolder(folderId);
        }
    }

    async function handleCreateFolder() {
        const selectedFolderName = document.getElementById('selectedFolderName');
        if (!selectedFolderName) return;
        
        const folderName = selectedFolderName.value;
        if (!folderName) {
            showToast(getTranslation('folder-name-required'), 'error');
            return;
        }
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
  const folderIdInput = document.getElementById('editFolderId');
  const selectedNameInput = document.getElementById('editSelectedFolderName');

  if (!folderIdInput || !selectedNameInput) {
    showToast('تعذر العثور على الحقول المطلوبة.', 'error');
    return;
  }

  const folderId = folderIdInput.value;
  const newName = selectedNameInput.value;

  if (!newName) {
    showToast(getTranslation('choose-folder-name'), 'error');
    return;
  }

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
// بعد تعريف const backToFilesBtn و const mainBackBtn
if (backToFilesBtn) backToFilesBtn.addEventListener('click', handleBackButton);
if (mainBackBtn)  mainBackBtn .addEventListener('click', handleBackButton);

    function handleBackButton() {
        if (currentFolderId !== null) {
            // If currently in a folder, go back to folders list
            currentFolderId = null;
            fetchFolders(currentCommitteeId);
        } else if (currentCommitteeId !== null) {
            // If currently in committees page, go back to main page
            history.back();
        }
    }

function openAddContentModal() {
  if (addContentModal) {
    if (!currentFolderId) {
      showToast(getTranslation('select-folder'), 'error');
      return;
    }
    addContentModal.style.display = 'flex';
    document.getElementById('addContentFolderId').value = currentFolderId;
    // تحميل عناوين المحتوى
    loadContentTitleOptions();
    // إعادة تعيين الدروب داون
    const selectedContentTitle = document.getElementById('selectedContentTitle');
    const contentTitleToggle = document.getElementById('contentTitleToggle');
    if (selectedContentTitle) selectedContentTitle.value = '';
    if (contentTitleToggle) {
      contentTitleToggle.innerHTML = `${getTranslation('choose-content-name')} <span class="arrow">▾</span>`;
    }
    // إعادة تعيين حقل الملف
    const fileInput = document.getElementById('contentFile');
    if (fileInput) {
      fileInput.value = '';
      const fileDropArea = fileInput.closest('.file-drop-area');
      if (fileDropArea) {
        const fileUploadText = fileDropArea.querySelector('.file-upload-text');
        if (fileUploadText) {
          fileUploadText.innerHTML = `<span class="supported-files">${getTranslation('pdf-only')}</span>`;
        }
        fileDropArea.classList.remove('has-file');
      }
    }
  }
}

    function closeAddContentModal() {
        if (addContentModal) {
            addContentModal.style.display = 'none';
            const fileInput = addContentModal.querySelector('#contentFile');
            if (fileInput) {
                fileInput.value = '';
                // Reset file drop area display
                const fileDropArea = fileInput.closest('.file-drop-area');
                if (fileDropArea) {
                    const fileUploadText = fileDropArea.querySelector('.file-upload-text');
                    if (fileUploadText) {
                        fileUploadText.innerHTML = `<span class="supported-files">${getTranslation('pdf-only')}</span>`;
                    }
                    fileDropArea.classList.remove('has-file');
                }
            }
            // إعادة تعيين الدروبداون
            const selectedContentTitle = document.getElementById('selectedContentTitle');
            const contentTitleToggle = document.getElementById('contentTitleToggle');
            if (selectedContentTitle) selectedContentTitle.value = '';
            if (contentTitleToggle) {
                contentTitleToggle.innerHTML = `${getTranslation('choose-content-name')} <span class="arrow">▾</span>`;
            }
        }
    }


async function handleCreateContent() {
    const folderIdToUpload = document.getElementById('addContentFolderId').value;
    const contentTitle = document.getElementById('selectedContentTitle').value;
    const contentFile = document.getElementById('contentFile').files[0];
    const contentNotes = document.getElementById('contentNotes') ? document.getElementById('contentNotes').value : '';

    const approversSelect = document.getElementById('contentApprovers');
    let approvers_required = [];
    if (approversSelect) {
        approvers_required = Array.from(approversSelect.selectedOptions).map(option => option.value);
    }

    if (!folderIdToUpload || !contentTitle || !contentFile) {
        showToast(getTranslation('select-content'), 'error');
        return;
    }

    const formData = new FormData();
    formData.append('title', contentTitle);
    formData.append('notes', contentNotes);
    formData.append('file', contentFile);
    formData.append('approvers_required', JSON.stringify(approvers_required));

    try {
        const response = await fetch(`${apiBase}/api/committees/folders/${folderIdToUpload}/contents`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`
            },
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
        console.error('Error creating content:', err);
        showToast(getTranslation('error-occurred'), 'error');
    }
}

const editContentTitleToggle     = document.getElementById('editContentTitleToggle');
const editContentTitleMenu       = document.getElementById('editContentTitleMenu');
const editSelectedContentTitle   = document.getElementById('editSelectedContentTitle');

// عندما تضغط على الزر
editContentTitleToggle.addEventListener('click', e => {
  e.stopPropagation();                     // حتى لا يُغلق فوراً بالـ document click
  editContentTitleMenu.classList.toggle('hidden');
});

// إذا ضغط المستخدم في أي مكان آخر، نغلق القائمة
document.addEventListener('click', e => {
  if (!e.target.closest('#editContentTitleDropdown')) {
    editContentTitleMenu.classList.add('hidden');
  }
});
function closeEditContentTitleDropdown() {
  const menu = document.getElementById('editContentTitleMenu');
  if (menu) menu.classList.add('hidden');
}

function openEditContentModal(id) {
  if (!editContentIdInput) return;
  editContentIdInput.value = id;

  loadEditContentTitleOptions()
    .then(() => {
      return fetch(`${apiBase}/api/committees/contents/${id}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      })
      .then(res => res.json());
    })
.then(content => {
 const display = getLocalizedName(content.title); 
  editContentTitleToggle.innerHTML = `${display} <span class="arrow">▾</span>`;

  // 3. باقي الحقول
  if (editContentNotesInput)  editContentNotesInput.value = content.notes || '';
  if (editContentModal)       editContentModal.style.display = 'flex';
})

    .catch(err => {
      console.error(err);
      showToast(getTranslation('error-occurred'), 'error');
    });
}





function closeEditContentModal() {
  if (!editContentModal) return;

  // إخفاء المودال
  editContentModal.style.display = 'none';

  // مسح المعرف
  if (editContentIdInput) editContentIdInput.value = '';

  // مسح الـ dropdown
  if (editSelectedContentTitle) editSelectedContentTitle.value = '';
  if (editContentTitleToggle) {
    editContentTitleToggle.innerHTML = `${getTranslation('choose-content-name')} <span class="arrow">▾</span>`;
  }
  if (editContentTitleMenu) editContentTitleMenu.classList.add('hidden');

  // مسح الملاحظات (لو ضفت textarea)
  if (editContentNotesInput) {
    editContentNotesInput.value = '';
  }

  // مسح رفع الملف وإعادة واجهة الـ drop-area
  if (editContentFileInput) {
    editContentFileInput.value = '';
    const fileDropArea = editContentFileInput.closest('.file-drop-area');
    if (fileDropArea) {
      const fileUploadText = fileDropArea.querySelector('.file-upload-text');
      if (fileUploadText) {
        fileUploadText.innerHTML = `<span class="supported-files">${getTranslation('pdf-only')}</span>`;
      }
      fileDropArea.classList.remove('has-file');
    }
  }
}


    // New functions for delete content modal
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

async function handleUpdateContent() {
  if (!editContentIdInput || !editSelectedContentTitle) return;
  
  const contentId = editContentIdInput.value;
  const title     = editSelectedContentTitle.value;
  const notes     = editContentNotesInput ? editContentNotesInput.value : '';
  const file      = editContentFileInput ? editContentFileInput.files[0] : null;

  if (!title) {
    showToast(getTranslation('content-title-required'), 'error');
    return;
  }

  const formData = new FormData();
  formData.append('title', title);
  formData.append('notes', notes);     // ← أضف الملاحظات
  if (file) formData.append('file', file);

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
    console.error('Error updating content:', err);
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
                closeDeleteContentModal(); // Use the dedicated close function
                await fetchFolderContents(currentFolderId); // تحديث قائمة المحتويات
            } else {
                showToast(result.message || getTranslation('error-occurred'), 'error');
            }
        } catch (err) {
            console.error('Error deleting content:', err);
            showToast(getTranslation('error-occurred'), 'error');
        }
    }

    // All event listeners are now added at the end, using the previously declared const variables

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
    if (addContentForm) addContentForm.addEventListener('submit', e => e.preventDefault()); // Prevent default form submission

    if (editContentCloseBtn) editContentCloseBtn.addEventListener('click', closeEditContentModal);
    if (cancelEditContentBtn) cancelEditContentBtn.addEventListener('click', closeEditContentModal);
    if (updateContentBtn) updateContentBtn.addEventListener('click', handleUpdateContent);

    if (confirmDeleteContentBtn) confirmDeleteContentBtn.addEventListener('click', handleDeleteContent);
    if (cancelDeleteContentBtn) cancelDeleteContentBtn.addEventListener('click', closeDeleteContentModal);
    if (deleteContentCloseBtn) deleteContentCloseBtn.addEventListener('click', closeDeleteContentModal);

    // Handle file selection events for content
    if (contentFileInput) contentFileInput.addEventListener('change', function() { handleFileSelection(this); });
    if (editContentFileInput) editContentFileInput.addEventListener('change', function() { handleFileSelection(this); });

    // Event delegation for content edit/delete icons
    const filesList = document.querySelector('.files-list'); // Already defined at the top
    if (filesList) {
        filesList.addEventListener('click', function(event) {
            const editIcon = event.target.closest('.edit-icon');
            const deleteIcon = event.target.closest('.delete-icon');
            const fileItem = event.target.closest('.file-item');

            if (editIcon && fileItem) {
                const contentId = fileItem.dataset.contentId; 
                if (contentId) {
                    openEditContentModal(contentId);
                }
            } else if (deleteIcon && fileItem) {
                const contentId = fileItem.dataset.contentId; 
                if (contentId) {
                    openDeleteContentModal(contentId);
                }
            }
        });
    }

    // Helper function to handle file selection (re-used for add and edit)
    function handleFileSelection(inputElement) {
        const fileDropArea = inputElement.closest('.file-drop-area');
        if (!fileDropArea) return;
        
        const fileUploadText = fileDropArea.querySelector('.file-upload-text');
        if (!fileUploadText) return;
        
        if (inputElement.files.length > 0) {
            const file = inputElement.files[0];
            
            // التحقق من نوع الملف
            if (file.type !== 'application/pdf') {
                showToast(getTranslation('pdf-only'), 'error');
                inputElement.value = ''; // مسح الملف المختار
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

});

function showToast(message, type = 'info', duration = 3006) {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        console.warn('Toast container not found!');
        return;
    }
    // استخدم الترجمة إذا كانت متوفرة
    const translated = getTranslation(message);
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = translated !== message ? translated : message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, duration);
} 

// --- مودال إضافة وتعديل اسم المجلد (دوال فقط، HTML لاحقاً) ---
function openAddFolderNameModal() {
  // إظهار المودال وإفراغ الحقول
  const modal = document.getElementById('addFolderNameModal');
  if (!modal) return;
  
  modal.style.display = 'flex';
  
  const folderNameAr = document.getElementById('folderNameAr');
  const folderNameEn = document.getElementById('folderNameEn');
  
  if (folderNameAr) folderNameAr.value = '';
  if (folderNameEn) folderNameEn.value = '';
}
function openEditFolderNameModal(id, name) {
  const modal = document.getElementById('editFolderNameModal');
  if (!modal) return;
  
  modal.style.display = 'flex';
  
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
}
function openDeleteFolderNameModal(id) {
  const modal = document.getElementById('deleteFolderNameModal');
  if (modal) {
    modal.style.display = 'flex';
    document.getElementById('deleteFolderNameId').value = id;
  }
} 

// --- ربط أزرار مودالات أسماء المجلدات والمحتوى ---
document.addEventListener('DOMContentLoaded', function() {
  // Folder Name Modals
  const addFolderNameModal = document.getElementById('addFolderNameModal');
  const saveAddFolderNameBtn = document.getElementById('saveAddFolderName');
  const cancelAddFolderNameBtn = document.getElementById('cancelAddFolderName');
  const editFolderNameModal = document.getElementById('editFolderNameModal');
  const saveEditFolderNameBtn = document.getElementById('saveEditFolderName');
  const cancelEditFolderNameBtn = document.getElementById('cancelEditFolderName');
  const deleteFolderNameModal = document.getElementById('deleteFolderNameModal');
  const confirmDeleteFolderNameBtn = document.getElementById('confirmDeleteFolderNameBtn');
  const cancelDeleteFolderNameBtn = document.getElementById('cancelDeleteFolderNameBtn');

  function closeAddFolderNameModal() {
    if(addFolderNameModal) addFolderNameModal.style.display = 'none';
    const folderNameAr = document.getElementById('folderNameAr');
    if(folderNameAr) folderNameAr.value = '';
    const folderNameEn = document.getElementById('folderNameEn');
    if(folderNameEn) folderNameEn.value = '';
  }
  function closeEditFolderNameModal() {
    if(editFolderNameModal) editFolderNameModal.style.display = 'none';
    const editFolderNameId = document.getElementById('editFolderNameId');
    if(editFolderNameId) editFolderNameId.value = '';
    const editFolderNameAr = document.getElementById('editFolderNameAr');
    if(editFolderNameAr) editFolderNameAr.value = '';
    const editFolderNameEn = document.getElementById('editFolderNameEn');
    if(editFolderNameEn) editFolderNameEn.value = '';
  }
  function closeDeleteFolderNameModal() {
    if(deleteFolderNameModal) deleteFolderNameModal.style.display = 'none';
    const deleteFolderNameId = document.getElementById('deleteFolderNameId');
    if(deleteFolderNameId) deleteFolderNameId.value = '';
  }
  if (saveAddFolderNameBtn){
    saveAddFolderNameBtn.addEventListener('click', async () => {
      const nameArInput = document.getElementById('folderNameAr');
      const nameEnInput = document.getElementById('folderNameEn');
      if (!nameArInput || !nameEnInput) return;
      const nameAr = nameArInput.value.trim();
      const nameEn = nameEnInput.value.trim();
      if (!nameAr || !nameEn) {
        showToast('الرجاء إدخال كافة الحقول', 'error');
        return;
      }
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
        console.error('Error adding folder name:', error);
        showToast('حدث خطأ في الاتصال.', 'error');
      }
    });
  }
  if(saveEditFolderNameBtn) {
    saveEditFolderNameBtn.addEventListener('click', async () => {
      const idInput = document.getElementById('editFolderNameId');
      const nameArInput = document.getElementById('editFolderNameAr');
      const nameEnInput = document.getElementById('editFolderNameEn');
      if(!idInput || !nameArInput || !nameEnInput) return;
      const id = idInput.value;
      const nameAr = nameArInput.value.trim();
      const nameEn = nameEnInput.value.trim();
      if (!nameAr || !nameEn) {
        showToast('الرجاء إدخال كافة الحقول', 'error');
        return;
      }
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
        console.error('Error updating folder name:', error);
        showToast('حدث خطأ في الاتصال.', 'error');
      }
    });
  }
  if(confirmDeleteFolderNameBtn){
    confirmDeleteFolderNameBtn.addEventListener('click', async () => {
      const idInput = document.getElementById('deleteFolderNameId');
      if(!idInput) return;
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
        console.error('Error deleting folder name:', error);
        showToast('حدث خطأ في الاتصال.', 'error');
      }
    });
  }
  if(cancelAddFolderNameBtn) cancelAddFolderNameBtn.addEventListener('click', closeAddFolderNameModal);
  if(cancelEditFolderNameBtn) cancelEditFolderNameBtn.addEventListener('click', closeEditFolderNameModal);
  if(cancelDeleteFolderNameBtn) cancelDeleteFolderNameBtn.addEventListener('click', closeDeleteFolderNameModal);
  if(addFolderNameModal) addFolderNameModal.addEventListener('click', e => e.target === addFolderNameModal && closeAddFolderNameModal());
  if(editFolderNameModal) editFolderNameModal.addEventListener('click', e => e.target === editFolderNameModal && closeEditFolderNameModal());
  if(deleteFolderNameModal) {
    deleteFolderNameModal.addEventListener('click', e => e.target === deleteFolderNameModal && closeDeleteFolderNameModal());
    const closeBtn = deleteFolderNameModal.querySelector('.close-button');
    if(closeBtn) closeBtn.addEventListener('click', closeDeleteFolderNameModal);
  }

  // Content Title Modals
  const addContentTitleModal = document.getElementById('addContentTitleModal');
  const saveAddContentTitleBtn = document.getElementById('saveAddContentTitle');
  const cancelAddContentTitleBtn = document.getElementById('cancelAddContentTitle');
  const editContentTitleModal = document.getElementById('editContentTitleModal');
  const saveEditContentTitleBtn = document.getElementById('saveEditContentTitle');
  const cancelEditContentTitleBtn = document.getElementById('cancelEditContentTitle');
  const deleteContentTitleModal = document.getElementById('deleteContentTitleModal');
  const confirmDeleteContentTitleBtn = document.getElementById('confirmDeleteContentTitleBtn');
  const cancelDeleteContentTitleBtn = document.getElementById('cancelDeleteContentTitleBtn');

  function closeAddContentTitleModal() {
    if(addContentTitleModal) addContentTitleModal.style.display = 'none';
    const contentTitleAr = document.getElementById('contentTitleAr');
    if(contentTitleAr) contentTitleAr.value = '';
    const contentTitleEn = document.getElementById('contentTitleEn');
    if(contentTitleEn) contentTitleEn.value = '';
  }
  function closeEditContentTitleModal() {
    if(editContentTitleModal) editContentTitleModal.style.display = 'none';
    const editContentTitleId = document.getElementById('editContentTitleId');
    if(editContentTitleId) editContentTitleId.value = '';
    const editContentTitleAr = document.getElementById('editContentTitleAr');
    if(editContentTitleAr) editContentTitleAr.value = '';
    const editContentTitleEn = document.getElementById('editContentTitleEn');
    if(editContentTitleEn) editContentTitleEn.value = '';
  }
  function closeDeleteContentTitleModal() {
    if(deleteContentTitleModal) deleteContentTitleModal.style.display = 'none';
    const deleteContentTitleId = document.getElementById('deleteContentTitleId');
    if(deleteContentTitleId) deleteContentTitleId.value = '';
  }
  if (saveAddContentTitleBtn){
    saveAddContentTitleBtn.addEventListener('click', async () => {
      const nameArInput = document.getElementById('contentTitleAr');
      const nameEnInput = document.getElementById('contentTitleEn');
      if (!nameArInput || !nameEnInput) return;
      const nameAr = nameArInput.value.trim();
      const nameEn = nameEnInput.value.trim();
      if (!nameAr || !nameEn) {
        showToast('الرجاء إدخال كافة الحقول', 'error');
        return;
      }
      const name = JSON.stringify({ ar: nameAr, en: nameEn });
      try {
        const response = await fetch(`${apiBase}/api/committees/content-titles`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`
          },
          body: JSON.stringify({ name })
        });
        const data = await response.json();
        if (response.ok) {
          showToast('تمت إضافة عنوان المحتوى بنجاح', 'success');
          closeAddContentTitleModal();
          await loadContentTitleOptions();
        } else {
          showToast(data.message || 'فشل إضافة عنوان المحتوى.', 'error');
        }
      } catch (error) {
        console.error('Error adding content title:', error);
        showToast('حدث خطأ في الاتصال.', 'error');
      }
    });
  }
  if(saveEditContentTitleBtn) {
    saveEditContentTitleBtn.addEventListener('click', async () => {
      const idInput = document.getElementById('editContentTitleId');
      const nameArInput = document.getElementById('editContentTitleAr');
      const nameEnInput = document.getElementById('editContentTitleEn');
      if(!idInput || !nameArInput || !nameEnInput) return;
      const id = idInput.value;
      const nameAr = nameArInput.value.trim();
      const nameEn = nameEnInput.value.trim();
      if (!nameAr || !nameEn) {
        showToast('الرجاء إدخال كافة الحقول', 'error');
        return;
      }
      const name = JSON.stringify({ ar: nameAr, en: nameEn });
      try {
        const response = await fetch(`${apiBase}/api/committees/content-titles/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`
          },
          body: JSON.stringify({ name })
        });
        const data = await response.json();
        if (response.ok) {
          showToast('تم تحديث عنوان المحتوى بنجاح', 'success');
          closeEditContentTitleModal();
          await loadContentTitleOptions();
        } else {
          showToast(data.message || 'فشل تحديث عنوان المحتوى.', 'error');
        }
      } catch (error) {
        console.error('Error updating content title:', error);
        showToast('حدث خطأ في الاتصال.', 'error');
      }
    });
  }
  if(confirmDeleteContentTitleBtn){
    confirmDeleteContentTitleBtn.addEventListener('click', async () => {
      const idInput = document.getElementById('deleteContentTitleId');
      if(!idInput) return;
      const id = idInput.value;
      try {
        const response = await fetch(`${apiBase}/api/committees/content-titles/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const data = await response.json();
        if (response.ok) {
          showToast('تم حذف عنوان المحتوى بنجاح', 'success');
          closeDeleteContentTitleModal();
          await loadContentTitleOptions();
        } else {
          showToast(data.message || 'فشل حذف عنوان المحتوى.', 'error');
        }
      } catch (error) {
        console.error('Error deleting content title:', error);
        showToast('حدث خطأ في الاتصال.', 'error');
      }
    });
  }
  if(cancelAddContentTitleBtn) cancelAddContentTitleBtn.addEventListener('click', closeAddContentTitleModal);
  if(cancelEditContentTitleBtn) cancelEditContentTitleBtn.addEventListener('click', closeEditContentTitleModal);
  if(cancelDeleteContentTitleBtn) cancelDeleteContentTitleBtn.addEventListener('click', closeDeleteContentTitleModal);
  if(addContentTitleModal) addContentTitleModal.addEventListener('click', e => e.target === addContentTitleModal && closeAddContentTitleModal());
  if(editContentTitleModal) editContentTitleModal.addEventListener('click', e => e.target === editContentTitleModal && closeEditContentTitleModal());
  if(deleteContentTitleModal) {
    deleteContentTitleModal.addEventListener('click', e => e.target === deleteContentTitleModal && closeDeleteContentTitleModal());
    const closeBtn = deleteContentTitleModal.querySelector('.close-button');
    if(closeBtn) closeBtn.addEventListener('click', closeDeleteContentTitleModal);
  }
}); 