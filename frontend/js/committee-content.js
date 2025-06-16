// ... سيتم نسخ منطق الأقسام وتعديله ليعمل على اللجان ...
// مثال: fetch(`/api/committees/${committeeId}/folders`) بدلاً من الأقسام
// سيتم تضمين كل الدوال الخاصة بالإضافة والتعديل والحذف للمجلدات والمحتوى مع التعديلات اللازمة 

const apiBase = 'http://localhost:3006';
const permissions = {
  canAddFolder:    false,
  canEditFolder:   false,
  canDeleteFolder: false,
  canAddContent:   false,
  canEditContent:  false,
  canDeleteContent:false
};

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

let folderNameOptions = []; // ← الأسماء الموجودة من السيرفر
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
  folderNamesContainer.innerHTML = '';

  list.forEach(item => {
    const div = document.createElement('div');
    div.className = 'folder-item';
    div.innerHTML = `
      <span class="label">${item.name}</span>
      <div class="actions">
        <button class="btn-edit"   data-id="${item.id}" data-name="${item.name}">✎</button>
        <button class="btn-delete" data-id="${item.id}">🗑</button>
      </div>
    `;

    // عند الضغط على الاسم نفسه → تحديده
    div.querySelector('.label').addEventListener('click', () => {
      selectedFolderName.value = item.name;
      folderNameToggle.innerHTML = `${item.name} <span class="arrow">▾</span>`;
      closeFolderNameDropdown();
    });

    // زر التعديل
    div.querySelector('.btn-edit').addEventListener('click', () => {
      const newName = prompt('📝 أدخل الاسم الجديد:', item.name);
      if (newName && newName.trim()) {
        updateFolderName(item.id, newName.trim());
      }
    });

    // زر الحذف
    div.querySelector('.btn-delete').addEventListener('click', () => {
      if (confirm(`هل أنت متأكد من حذف "${item.name}"؟`)) {
        deleteFolderName(item.id);
      }
    });

    folderNamesContainer.appendChild(div);
  });
}
function closeFolderNameDropdown() {
  const menu = document.getElementById('folderNameMenu');
  if (menu) menu.classList.add('hidden');
}



folderNameToggle.addEventListener('click', e => {
  e.stopPropagation();
  folderNameMenu.classList.toggle('hidden');
  folderNameSearch.classList.toggle('hidden');
  addNewFolderNameLink.classList.toggle('hidden');

  if (!folderNameOptions.length) loadFolderNameOptions();
  renderFolderNameOptions(folderNameOptions);
});

folderNameSearch.addEventListener('input', () => {
  const q = folderNameSearch.value.toLowerCase();
  const filtered = folderNameOptions.filter(item => item.name.toLowerCase().includes(q));
  renderFolderNameOptions(filtered);
});
addNewFolderNameLink.addEventListener('click', async () => {
  const name = prompt('أدخل اسم المجلد الجديد:');
  if (!name) return;

  try {
    const res = await fetch(`${apiBase}/api/committees/folder-names`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const json = await res.json();

    if (res.ok) {
      folderNameOptions.push({ id: json.id, name });
      selectedFolderName.value = name;
      folderNameToggle.innerHTML = `${name} <span class="arrow">▾</span>`;
      closeFolderNameDropdown();
    } else {
      alert('❌ ' + (json.message || 'فشل في الإضافة'));
    }
  } catch (err) {
    console.error('فشل في إضافة الاسم:', err);
  }
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
      showToast('✅ تم التعديل بنجاح');
      await loadFolderNameOptions();
    } else {
      showToast(json.message || '❌ فشل في التعديل', 'error');
    }
  } catch (err) {
    console.error('خطأ أثناء التعديل:', err);
  }
}

async function deleteFolderName(id) {
  try {
    const res = await fetch(`${apiBase}/api/committees/folder-names/${id}`, {
      method: 'DELETE'
    });
    const json = await res.json();
    if (res.ok) {
      showToast('🗑️ تم الحذف');
      await loadFolderNameOptions();
    } else {
      showToast(json.message || '❌ فشل في الحذف', 'error');
    }
  } catch (err) {
    console.error('خطأ أثناء الحذف:', err);
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

function renderEditFolderNameOptions(list) {
  const container = document.getElementById('editFolderNamesContainer');
  const hiddenInput = document.getElementById('editSelectedFolderName');
  const toggle = document.getElementById('editFolderNameToggle');
  container.innerHTML = '';

  list.forEach(item => {
    const div = document.createElement('div');
    div.className = 'folder-item';
    div.innerHTML = `
      <span class="label folder-label">${item.name}</span>
      <span class="actions">
        <button class="btn-edit" data-id="${item.id}" data-name="${item.name}">✎</button>
        <button class="btn-delete" data-id="${item.id}">🗑</button>
      </span>
    `;

    div.querySelector('.folder-label').addEventListener('click', () => {
      hiddenInput.value = item.name;
      toggle.innerHTML = `${item.name} <span class="arrow">▾</span>`;
      closeEditFolderNameDropdown();
    });

    div.querySelector('.btn-edit').addEventListener('click', async (e) => {
      e.stopPropagation();
      const currentName = e.currentTarget.dataset.name;
      const newName = prompt('أدخل الاسم الجديد:', currentName);
      if (newName && newName.trim() !== '') {
        await updateFolderName(item.id, newName);
        await loadEditFolderNameOptions();
        showToast('✅ تم تعديل الاسم بنجاح');
      }
    });

    div.querySelector('.btn-delete').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(`هل أنت متأكد أنك تريد حذف "${item.name}"؟`)) {
        await deleteFolderName(item.id);
        await loadEditFolderNameOptions();
        showToast('🗑️ تم حذف الاسم');
      }
    });

    container.appendChild(div);
  });

  // إضافة اسم جديد
  const addNewBtn = document.getElementById('editAddNewFolderNameLink');
  addNewBtn.onclick = async () => {
    const name = prompt('أدخل اسم المجلد الجديد:');
    if (name && name.trim() !== '') {
      await createFolderName(name);
      await loadEditFolderNameOptions();
      showToast('✅ تم إضافة الاسم بنجاح');
    }
  };
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
    showToast('❌ فشل في إضافة اسم جديد', 'error');
  }
}



function closeEditFolderNameDropdown() {
  document.getElementById('editFolderNameMenu').classList.add('hidden');
}
document.getElementById('editFolderNameToggle').addEventListener('click', () => {
  const menu = document.getElementById('editFolderNameMenu');
  menu.classList.toggle('hidden');
});

let contentTitleOptions = [];

async function loadContentTitleOptions() {
  try {
    const res = await fetch(`${apiBase}/api/committees/content-titles`);
    const json = await res.json();
    contentTitleOptions = json.data || []; // ← هنا التحديث المهم
    renderContentTitleOptions(contentTitleOptions);
  } catch (err) {
    console.error('❌ فشل تحميل عناوين المحتوى:', err);
  }
}



function renderContentTitleOptions(list) {
  const container = document.getElementById('contentTitleOptionsContainer');
  const searchInput = document.getElementById('contentTitleSearch');
  container.innerHTML = '';

  list.forEach(item => {
    const div = document.createElement('div');
    div.className = 'folder-item';
    div.innerHTML = `
      <span class="label">${item.name}</span>
      <button class="btn-edit" data-id="${item.id}" data-name="${item.name}">✎</button>
      <button class="btn-delete" data-id="${item.id}">🗑</button>
    `;
    div.querySelector('.label').addEventListener('click', () => {
      document.getElementById('selectedContentTitle').value = item.name;
      document.getElementById('contentTitleToggle').innerHTML = `${item.name} <span class="arrow">▾</span>`;
      closeContentTitleDropdown();
    });
    container.appendChild(div);
  });

  searchInput.oninput = () => {
    const search = searchInput.value.toLowerCase();
    const filtered = contentTitleOptions.filter(c => c.name.toLowerCase().includes(search));
    renderContentTitleOptions(filtered);
  };
}
document.getElementById('addNewContentTitleLink').onclick = async () => {
  const newTitle = prompt('أدخل عنوان المحتوى الجديد:');
  if (!newTitle) return;

  try {
    const res = await fetch(`${apiBase}/api/committees/content-titles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ name: newTitle })
    });

    const json = await res.json();
    if (res.ok) {
      await loadContentTitleOptions();
      document.getElementById('selectedContentTitle').value = newTitle;
      document.getElementById('contentTitleToggle').innerHTML = `${newTitle} <span class="arrow">▾</span>`;
    } else {
      showToast(json.message || 'فشل في الإضافة', 'error');
    }
  } catch (err) {
    console.error('❌ خطأ في إضافة عنوان المحتوى:', err);
    showToast('فشل في الاتصال بالخادم', 'error');
  }
};
document.addEventListener('DOMContentLoaded', () => {
  // تحميل العناوين
  loadContentTitleOptions();

  // تحقق من وجود العنصر قبل إضافة الأحداث
  const addLink = document.getElementById('addNewContentTitleLink');
  if (addLink) {
    addLink.onclick = async () => {
      const newTitle = prompt('أدخل عنوان المحتوى الجديد:');
      if (!newTitle) return;

      try {
        const res = await fetch(`${apiBase}/api/committees/content-titles`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`
          },
          body: JSON.stringify({ name: newTitle })
        });

        const json = await res.json();
        if (res.ok) {
          await loadContentTitleOptions();
          document.getElementById('selectedContentTitle').value = newTitle;
          document.getElementById('contentTitleToggle').innerHTML = `${newTitle} <span class="arrow">▾</span>`;
        } else {
          showToast(json.message || 'فشل في الإضافة', 'error');
        }
      } catch (err) {
        console.error('❌ خطأ في إضافة عنوان المحتوى:', err);
        showToast('فشل في الاتصال بالخادم', 'error');
      }
    };
  }

  const container = document.getElementById('contentTitleOptionsContainer');
  if (container) {
    container.addEventListener('click', async e => {
      const id = e.target.dataset.id;
      const name = e.target.dataset.name;

      if (e.target.classList.contains('btn-edit')) {
        const updated = prompt('تعديل العنوان:', name);
        if (!updated || updated === name) return;

        const res = await fetch(`${apiBase}/api/committees/content-titles/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`
          },
          body: JSON.stringify({ name: updated })
        });

        const json = await res.json();
        if (res.ok) {
          await loadContentTitleOptions();
          showToast('تم التحديث بنجاح', 'success');
        } else {
          showToast(json.message || 'فشل في التحديث', 'error');
        }
      }

      if (e.target.classList.contains('btn-delete')) {
        if (!confirm('هل أنت متأكد من حذف العنوان؟')) return;

        const res = await fetch(`${apiBase}/api/committees/content-titles/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${getToken()}`
          }
        });

        const json = await res.json();
        if (res.ok) {
          await loadContentTitleOptions();
          showToast('تم الحذف بنجاح', 'success');
        } else {
          showToast(json.message || 'فشل في الحذف', 'error');
        }
      }
    });
  } else {
    console.warn('📛 contentTitleOptionsContainer غير موجود في الصفحة!');
  }
});



function closeContentTitleDropdown() {
  const menu = document.getElementById('contentTitleMenu');
  if (menu) menu.classList.add('hidden');
}


document.getElementById('contentTitleToggle').addEventListener('click', () => {
  const menu = document.getElementById('contentTitleMenu');
  menu.classList.toggle('hidden');
});
document.addEventListener('click', function (e) {
  const dropdown = document.getElementById('contentTitleDropdown');
  const menu = document.getElementById('contentTitleMenu');
  if (!dropdown.contains(e.target)) {
    menu.classList.add('hidden');
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
function renderEditContentTitleOptions(list) {
  const container = document.getElementById('editContentTitlesContainer');
  const searchInput = document.getElementById('editContentTitleSearch');
  container.innerHTML = '';

  list.forEach(item => {
    const div = document.createElement('div');
    div.className = 'folder-item';
    div.innerHTML = `
      <span class="label">${item.name}</span>
      <button class="btn-edit" data-id="${item.id}" data-name="${item.name}">✎</button>
      <button class="btn-delete" data-id="${item.id}">🗑</button>
    `;
    div.querySelector('.label').onclick = () => {
      document.getElementById('editSelectedContentTitle').value = item.name;
      document.getElementById('editContentTitleToggle').innerHTML = `${item.name} <span class="arrow">▾</span>`;
      closeEditContentTitleDropdown();
    };
    container.appendChild(div);
  });

  searchInput.oninput = () => {
    const search = searchInput.value.toLowerCase();
    const filtered = editContentTitleOptions.filter(c => c.name.toLowerCase().includes(search));
    renderEditContentTitleOptions(filtered);
  };
}
document.getElementById('editAddNewContentTitleLink').onclick = async () => {
  const newTitle = prompt('أدخل عنوان المحتوى الجديد:');
  if (!newTitle) return;

  try {
    const res = await fetch(`${apiBase}/api/committees/content-titles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ name: newTitle })
    });

    const json = await res.json();
    if (res.ok) {
      await loadEditContentTitleOptions();
      document.getElementById('editSelectedContentTitle').value = newTitle;
      document.getElementById('editContentTitleToggle').innerHTML = `${newTitle} <span class="arrow">▾</span>`;
    } else {
      showToast(json.message || 'فشل في الإضافة', 'error');
    }
  } catch (err) {
    console.error('❌ خطأ في إضافة عنوان المحتوى:', err);
  }
};
document.getElementById('editContentTitlesContainer').addEventListener('click', async e => {
  const id = e.target.dataset.id;
  const name = e.target.dataset.name;

  if (e.target.classList.contains('btn-edit')) {
    const updated = prompt('تعديل العنوان:', name);
    if (!updated || updated === name) return;

    const res = await fetch(`${apiBase}/api/committees/content-titles/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ name: updated })
    });

    const json = await res.json();
    if (res.ok) {
      await loadEditContentTitleOptions();
      showToast('تم التحديث بنجاح', 'success');
    } else {
      showToast(json.message || 'فشل في التحديث', 'error');
    }
  }

  if (e.target.classList.contains('btn-delete')) {
    if (!confirm('هل أنت متأكد من حذف العنوان؟')) return;

    const res = await fetch(`${apiBase}/api/committees/content-titles/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });

    const json = await res.json();
    if (res.ok) {
      await loadEditContentTitleOptions();
      showToast('تم الحذف بنجاح', 'success');
    } else {
      showToast(json.message || 'فشل في الحذف', 'error');
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

    if (!permissions.canAddFolder)  addFolderBtn   .style.display = 'none';
    if (!permissions.canAddContent) addContentBtn .style.display = 'none';

    function getToken() {
        const token = localStorage.getItem('token');
        return token;
    }

    async function fetchPermissions() {
      // إذا عندك نظام صلاحيات للجان عدله هنا
      Object.keys(permissions).forEach(k => permissions[k]=true);
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
      foldersSection.style.display = 'block';
      folderContentsSection.style.display = 'none';
      backToFilesContainer.style.display = 'none';
      folderContentTitle.textContent = 'مجلدات اللجنة';
      try {
        const response = await fetch(`${apiBase}/api/committees/${committeeId}/folders`);
        const folders = await response.json();
        const foldersList = document.querySelector('.folders-list');
        foldersList.innerHTML = '';
        
        if (folders.length) {
          folders.forEach(folder => {
            const card = document.createElement('div');
            card.className = 'folder-card';
            card.dataset.id = folder.id;
            let icons = '<div class="item-icons">';
            icons += `<a href="#" class="edit-icon"><img src="../images/edit.svg" alt="تعديل"></a>`;
            icons += `<a href="#" class="delete-icon"><img src="../images/delet.svg" alt="حذف"></a>`;
            icons += '</div>';
            card.innerHTML = icons +
              `<img src="../images/folders.svg">
               <div class="folder-info">
                 <div class="folder-name">${folder.name}</div>
               </div>`;
            foldersList.appendChild(card);

            card.addEventListener('click', e => {
              if (!e.target.closest('.edit-icon') && !e.target.closest('.delete-icon')) {
                fetchFolderContents(folder.id, folder.name);
              }
            });
            // ربط أيقونة التعديل
            const editIcon = card.querySelector('.edit-icon');
            if (editIcon) {
              editIcon.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                openEditFolderModal(folder.id, folder.name);
              });
            }
            // ربط أيقونة الحذف
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
          foldersList.innerHTML = '<div class="no-content">لا يوجد مجلدات في هذه اللجنة.</div>';
        }
      } catch (err) {
        showToast('حدث خطأ في الاتصال بجلب مجلدات اللجنة.', 'error');
      }
    }

    async function fetchFolderContents(folderId, folderName) {
      currentFolderId = folderId;
      foldersSection.style.display = 'none';
      folderContentsSection.style.display = 'block';
      backToFilesContainer.style.display = 'block';
      folderContentTitle.textContent = folderName || 'محتوى المجلد';
      try {
        const token = getToken();
        const response = await fetch(`${apiBase}/api/committees/folders/${folderId}/contents`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const contents = await response.json();
        const filesList = document.querySelector('.files-list');
        filesList.innerHTML = '';

        // Get user role from token
        const decodedToken = JSON.parse(atob(token.split('.')[1]));
        const isAdmin = decodedToken.role === 'admin';

        // Filter contents based on user role
        const filteredContents = isAdmin ? contents : contents.filter(content => content.approval_status === 'approved');

        if (filteredContents.length) {
          filteredContents.forEach(content => {
            let icons = '<div class="item-icons">';
            // Only show edit/delete icons for admins
            if (isAdmin) {
              icons += `<a href="#" class="edit-icon" data-content-id="${content.id}"><img src="../images/edit.svg" alt="تعديل"></a>`;
              icons += `<a href="#" class="delete-icon" data-content-id="${content.id}"><img src="../images/delet.svg" alt="حذف"></a>`;
            }
            icons += '</div>';
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.dataset.contentId = content.id;

            // Determine approval status and class
            const approvalStatusText = (content.approval_status === 'approved') ? 'معتمد' : 'قيد الانتظار';
            const approvalClass = (content.approval_status === 'approved') ? 'approved' : 'pending';

            fileItem.innerHTML = `
              ${icons}
              <img src="../images/pdf.svg" alt="ملف PDF">
              <div class="file-info">
                <div class="file-name">${content.title}</div>
                <div class="approval-status ${approvalClass}">${approvalStatusText}</div>
              </div>
            `;
            filesList.appendChild(fileItem);

            // Add click handler for file opening
            fileItem.addEventListener('click', function(e) {
              if (!e.target.closest('.edit-icon') && !e.target.closest('.delete-icon')) {
                if (content.file_path) {
                  const baseUrl = apiBase.replace('/api', '');
                  window.open(`${baseUrl}/${content.file_path}`, '_blank');
                } else {
                  showToast('رابط الملف غير متوفر.', 'error');
                }
              }
            });

            // Add click handlers for edit/delete icons if admin
            if (isAdmin) {
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
            }
          });
        } else {
          filesList.innerHTML = '<div class="no-content">لا يوجد محتوى في هذا المجلد.</div>';
        }
      } catch (err) {
        showToast('حدث خطأ في الاتصال بجلب محتوى المجلد.', 'error');
      }
    }

    // باقي الدوال: إضافة/تعديل/حذف مجلد ومحتوى، modals، إلخ (مطابقة للأقسام مع تغيير المسميات)

    // دوال إدارة المجلدات
    function openAddFolderModal() {
        const modal = document.getElementById('addFolderModal');
        modal.style.display = 'flex';
    }

function closeAddFolderModal() {
  const modal = document.getElementById('addFolderModal');
  if (modal) modal.style.display = 'none'; // ← هذا هو المطلوب

  const selectedInput = document.getElementById('selectedFolderName');
  if (selectedInput) selectedInput.value = '';

  const toggleBtn = document.getElementById('folderNameToggle');
  if (toggleBtn) toggleBtn.innerHTML = 'اختر اسم المجلد <span class="arrow">▾</span>';
}



function openEditFolderModal(folderId, folderName) {
  const modal = document.getElementById('editFolderModal');
  modal.style.display = 'flex';

  document.getElementById('editFolderId').value = folderId;
  document.getElementById('editSelectedFolderName').value = folderName;
  document.getElementById('editFolderNameToggle').innerHTML = `${folderName} <span class="arrow">▾</span>`;

  loadEditFolderNameOptions(); // جلب أسماء المجلدات لعرضها
}



    function closeEditFolderModal() {
        const modal = document.getElementById('editFolderModal');
        modal.style.display = 'none';
    }

    function openDeleteFolderModal(folderId) {
        if (confirm('هل أنت متأكد من حذف هذا المجلد؟')) {
            deleteFolder(folderId);
        }
    }

    async function handleCreateFolder() {
const name = document.getElementById('selectedFolderName').value;
        if (!name) {
            showToast('الرجاء إدخال اسم المجلد', 'error');
            return;
        }

        try {
            const response = await fetch(`${apiBase}/api/committees/${currentCommitteeId}/folders`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name })
            });

            if (response.ok) {
                closeAddFolderModal();
                fetchFolders(currentCommitteeId);
                showToast('تم إضافة المجلد بنجاح', 'success');
            } else {
                const data = await response.json();
                showToast(`فشل إضافة المجلد: ${data.message||'خطأ'}`, 'error');
            }
        } catch (err) {
            console.error('Error creating folder:', err);
            showToast('خطأ في الاتصال بالخادم أثناء الإضافة.', 'error');
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
    showToast('الرجاء اختيار اسم المجلد', 'error');
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
      showToast('تم تحديث اسم المجلد بنجاح', 'success');
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
                showToast('تم حذف المجلد بنجاح', 'success');
                fetchFolders(currentCommitteeId);
            } else {
                const data = await response.json();
                showToast(`فشل حذف المجلد: ${data.message || 'خطأ'}`, 'error');
            }
        } catch (err) {
            showToast('حدث خطأ في الاتصال بالخادم أثناء الحذف.', 'error');
        }
    }

    function handleBackButton() {
        if (currentFolderId !== null) {
            // If currently in a folder, go back to folders list
            currentFolderId = null;
            fetchFolders(currentCommitteeId);
        } else if (currentCommitteeId !== null) {
            // If currently in committees page, go back to main page
            window.location.href = '/'; // Or wherever your main committees list page is
        }
    }

function openAddContentModal() {
  if (addContentModal) {
    if (!currentFolderId) {
      showToast('يرجى اختيار مجلد أولاً لإضافة محتوى.', 'error');
      return;
    }

    addContentModal.style.display = 'flex';
    document.getElementById('addContentFolderId').value = currentFolderId;

    // 👇 تحميل عناوين المحتوى
    loadContentTitleOptions();

    // 👇 إعادة تعيين الدروب داون (اختياري)
    document.getElementById('selectedContentTitle').value = '';
    document.getElementById('contentTitleToggle').innerHTML = 'اختر عنوان المحتوى <span class="arrow">▾</span>';
  }
}


    function closeAddContentModal() {
        if (addContentModal) {
            addContentModal.style.display = 'none';
            const titleInput = addContentModal.querySelector('#contentTitle');
            const fileInput = addContentModal.querySelector('#contentFile');
            const notesInput = addContentModal.querySelector('#contentNotes');
            if (titleInput) titleInput.value = '';
            if (fileInput) fileInput.value = '';
            if (notesInput) notesInput.value = '';
            // Reset file drop area display
            const fileDropArea = fileInput.closest('.file-drop-area');
            const fileUploadText = fileDropArea.querySelector('.file-upload-text');
            fileUploadText.innerHTML = '<span class="supported-files">ملفات PDF فقط</span>';
            fileDropArea.classList.remove('has-file');
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
        showToast('الرجاء إدخال العنوان والملف والمجلد', 'error');
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
            showToast('تم إضافة المحتوى بنجاح', 'success');
        } else {
            const data = await response.json();
            showToast(`فشل إضافة المحتوى: ${data.message || 'خطأ'}`, 'error');
        }
    } catch (err) {
        console.error('Error creating content:', err);
        showToast('خطأ في الاتصال بالخادم أثناء الإضافة.', 'error');
    }
}


    function openEditContentModal(contentId) {
        if (editContentModal) {
            try {
                fetch(`${apiBase}/api/committees/contents/${contentId}`, {
                    headers: { 'Authorization': `Bearer ${getToken()}` }
                }).then(response => response.json())
                .then(data => {
                    if (data && data.content) { // Changed 'response.ok && data' to 'data && data.content'
                        editContentIdInput.value = contentId;
                        editContentTitleInput.value = data.content.title;
                        editContentNotesInput.value = data.content.notes || '';
                        // Clear file input for edit, user will re-select if needed
                        editContentFileInput.value = '';
                        const fileDropArea = editContentFileInput.closest('.file-drop-area');
                        const fileUploadText = fileDropArea.querySelector('.file-upload-text');
                        fileUploadText.innerHTML = '<span class="supported-files">ملفات PDF فقط</span>';
                        fileDropArea.classList.remove('has-file');

                        editContentModal.style.display = 'flex';
                    } else {
                        showToast(data.message || 'فشل جلب بيانات المحتوى.', 'error');
                    }
                });
            } catch (error) {
                console.error('Error fetching content data:', error);
                showToast('حدث خطأ في الاتصال بجلب بيانات المحتوى.', 'error');
            }
        }
    }






    function closeEditContentModal() {
        if (editContentModal) {
            editContentModal.style.display = 'none';
            editContentIdInput.value = '';
            editContentTitleInput.value = '';
            editContentNotesInput.value = '';
            editContentFileInput.value = '';
            // Reset file drop area display
            const fileDropArea = editContentFileInput.closest('.file-drop-area');
            const fileUploadText = fileDropArea.querySelector('.file-upload-text');
            fileUploadText.innerHTML = '<span class="supported-files">ملفات PDF فقط</span>';
            fileDropArea.classList.remove('has-file');
        }
    }

    // New functions for delete content modal
    function openDeleteContentModal(contentId) {
        if (deleteContentModal) {
            deleteContentIdInput.value = contentId;
            deleteContentModal.style.display = 'flex';
        }
    }

    function closeDeleteContentModal() {
        if (deleteContentModal) {
            deleteContentModal.style.display = 'none';
            deleteContentIdInput.value = '';
        }
    }

    async function handleUpdateContent() {
        const contentId = editContentIdInput.value;
        const title = editContentTitleInput.value;
        const notes = editContentNotesInput.value;
        const file = editContentFileInput.files[0];

        if (!title) {
            showToast('الرجاء إدخال عنوان المحتوى', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('notes', notes);
        if (file) {
            formData.append('file', file);
        }

        try {
            const response = await fetch(`${apiBase}/api/committees/contents/${contentId}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${getToken()}` },
                body: formData
            });

            const result = await response.json();
            if (response.ok) {
                showToast(result.message || 'تم تحديث المحتوى بنجاح!', 'success');
                closeEditContentModal();
                await fetchFolderContents(currentFolderId); // تحديث قائمة المحتويات
            } else {
                showToast(`فشل تحديث المحتوى: ${result.message||'خطأ'}`, 'error');
            }
        } catch (err) {
            console.error('Error updating content:', err);
            showToast('خطأ في الاتصال بالخادم أثناء التحديث.', 'error');
        }
    }

    async function handleDeleteContent() {
        const contentId = deleteContentIdInput.value;
        if (!contentId) return;

        try {
            const response = await fetch(`${apiBase}/api/committees/contents/${contentId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });

            const result = await response.json();
            if (response.ok) {
                showToast(result.message || 'تم حذف المحتوى بنجاح!', 'success');
                closeDeleteContentModal(); // Use the dedicated close function
                await fetchFolderContents(currentFolderId); // تحديث قائمة المحتويات
            } else {
                showToast(`فشل حذف المحتوى: ${result.message||'خطأ'}`, 'error');
            }
        } catch (err) {
            console.error('Error deleting content:', err);
            showToast('خطأ في الاتصال بالخادم أثناء الحذف.', 'error');
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
        const fileUploadText = fileDropArea.querySelector('.file-upload-text');

        if (inputElement.files.length > 0) {
            const file = inputElement.files[0];
            if (file.type !== 'application/pdf') {
                showToast('يرجى اختيار ملف PDF فقط', 'error');
                inputElement.value = '';
                fileUploadText.innerHTML = '<span class="supported-files">ملفات PDF فقط</span>';
                fileDropArea.classList.remove('has-file');
                return;
            }
            const fileName = file.name;
            fileUploadText.innerHTML = `<span class="selected-file">تم اختيار: ${fileName}</span>`;
            fileDropArea.classList.add('has-file');
        } else {
            fileUploadText.innerHTML = '<span class="supported-files">ملفات PDF فقط</span>';
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

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, duration);
} 