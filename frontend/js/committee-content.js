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
    function getToken() {
        const token = localStorage.getItem('token');
        console.log('Token retrieved in getToken():', token ? 'Exists' : 'Not Found');
        return token;
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

  // إذا لم توجد مجلدات، اعرض رسالة
  if (!list.length) {
    folderNamesContainer.innerHTML = `<div class="no-content" data-translate="no-folders">${getTranslation('no-folders')}</div>`;
    return;
  }

  list.forEach(item => {
    const div = document.createElement('div');
    div.className = 'folder-item';

    // الاسم نفسه
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = item.name;
    label.addEventListener('click', () => {
      selectedFolderName.value = item.name;
      folderNameToggle.innerHTML = `${item.name} <span class="arrow">▾</span>`;
      closeFolderNameDropdown();
    });
    div.appendChild(label);

    // الحاوية للأزرار
    const actions = document.createElement('div');
    actions.className = 'actions';

    // زر التعديل (فقط لو عنده صلاحية)
    if (permissions.canEditFolderName) {
      const btnEdit = document.createElement('button');
      btnEdit.className = 'btn-edit';
      btnEdit.dataset.id = item.id;
      btnEdit.dataset.name = item.name;
      btnEdit.textContent = '✎';
      btnEdit.addEventListener('click', e => {
        e.stopPropagation();
        const newName = prompt(getTranslation('edit-folder-prompt'), item.name);
        if (newName && newName.trim()) {
          updateFolderName(item.id, newName.trim());
        }
      });
      actions.appendChild(btnEdit);
    }

    // زر الحذف (فقط لو عنده صلاحية)
    if (permissions.canDeleteFolderName) {
      const btnDelete = document.createElement('button');
      btnDelete.className = 'btn-delete';
      btnDelete.dataset.id = item.id;
      btnDelete.textContent = '🗑';
      btnDelete.addEventListener('click', e => {
        e.stopPropagation();
        if (confirm(getTranslation('delete-folder-confirm'))) {
          deleteFolderName(item.id);
        }
      });
      actions.appendChild(btnDelete);
    }

    div.appendChild(actions);
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
  const filtered = folderNameOptions.filter(item => item.name.toLowerCase().includes(q));
  renderFolderNameOptions(filtered);
});
addNewFolderNameLink.addEventListener('click', async () => {
  const name = prompt(getTranslation('add-folder-prompt'));
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
      showToast(getTranslation('folder-added-success'), 'success');
    } else {
      showToast(json.message || getTranslation('error-occurred'), 'error');
    }
  } catch (err) {
    console.error('فشل في إضافة الاسم:', err);
    showToast(getTranslation('error-occurred'), 'error');
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

function renderEditFolderNameOptions(list) {
  const container   = document.getElementById('editFolderNamesContainer');
  const hiddenInput = document.getElementById('editSelectedFolderName');
  const toggle      = document.getElementById('editFolderNameToggle');
  container.innerHTML = '';

  list.forEach(item => {
    const div = document.createElement('div');
    div.className = 'folder-item';

    // الاسم نفسه
    const label = document.createElement('span');
    label.className = 'label folder-label';
    label.textContent = item.name;
    label.addEventListener('click', () => {
      hiddenInput.value = item.name;
      toggle.innerHTML = `${item.name} <span class="arrow">▾</span>`;
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
      btnEdit.dataset.name = item.name;
      btnEdit.textContent  = '✎';
      btnEdit.addEventListener('click', async e => {
        e.stopPropagation();
        const newName = prompt(getTranslation('edit-folder-prompt'), item.name);
        if (newName && newName.trim() !== '') {
          await updateFolderName(item.id, newName.trim());
          await loadEditFolderNameOptions();
          showToast(getTranslation('folder-updated-success'), 'success');
        }
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
    addNewBtn.classList.remove('hidden');
    addNewBtn.onclick = async () => {
      const name = prompt(getTranslation('add-folder-prompt'));
      if (name && name.trim() !== '') {
        await createFolderName(name.trim());
        await loadEditFolderNameOptions();
        showToast(getTranslation('folder-added-success'), 'success');
      }
    };
  } else {
    addNewBtn.classList.add('hidden');
    addNewBtn.onclick = null;
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
  const container    = document.getElementById('contentTitleOptionsContainer');
  const searchInput  = document.getElementById('contentTitleSearch');
  container.innerHTML = '';

  // إذا لم توجد عناوين، اعرض رسالة
  if (!list.length) {
    container.innerHTML = `<div class="no-content" data-translate="no-contents">${getTranslation('no-contents')}</div>`;
    return;
  }

  list.forEach(item => {
    const div = document.createElement('div');
    div.className = 'folder-item';

    // اسم العنصر
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = item.name;
    label.addEventListener('click', () => {
      document.getElementById('selectedContentTitle').value = item.name;
      document.getElementById('contentTitleToggle').innerHTML = `${item.name} <span class="arrow">▾</span>`;
      closeContentTitleDropdown();
    });
    div.appendChild(label);

    // زرّ التعديل (فقط لو مسموح)
    if (permissions.canEditContentName) {
      const btnEdit = document.createElement('button');
      btnEdit.className = 'btn-edit';
      btnEdit.dataset.id   = item.id;
      btnEdit.dataset.name = item.name;
      btnEdit.textContent  = '✎';
      btnEdit.addEventListener('click', async e => {
        e.stopPropagation();
        const newName = prompt(getTranslation('edit-content-prompt'), item.name);
        if (newName && newName.trim()) {
          await updateContentTitle(item.id, newName.trim());
          await loadContentTitleOptions();
          showToast(getTranslation('content-updated-success'), 'success');
        }
      });
      div.appendChild(btnEdit);
    }

    // زرّ الحذف (فقط لو مسموح)
    if (permissions.canDeleteContentName) {
      const btnDelete = document.createElement('button');
      btnDelete.className = 'btn-delete';
      btnDelete.dataset.id = item.id;
      btnDelete.textContent = '🗑';
      btnDelete.addEventListener('click', async e => {
        e.stopPropagation();
        if (confirm(getTranslation('delete-content-confirm'))) {
          await deleteContentTitle(item.id);
          await loadContentTitleOptions();
          showToast(getTranslation('content-deleted-success'), 'success');
        }
      });
      div.appendChild(btnDelete);
    }

    container.appendChild(div);
  });
}
function setupAddNewContentTitleLink() {
  const link = document.getElementById('addNewContentTitleLink');
  if (!link) return;

  // أظهر الزر أو أخفه عند كل مرة بناءً على الصلاحية
  if (permissions.canAddContentName) {
    link.classList.remove('hidden');
  } else {
    link.classList.add('hidden');
  }

  // اربط الحدث مرّة وحدة
  link.onclick = async () => {
    if (!permissions.canAddContentName) return;

    const newTitle = prompt(getTranslation('add-content-prompt'));
    if (!newTitle || !newTitle.trim()) return;

    try {
      const res = await fetch(`${apiBase}/api/committees/content-titles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ name: newTitle.trim() })
      });

      const json = await res.json();
      if (res.ok) {
        await loadContentTitleOptions();
        document.getElementById('selectedContentTitle').value = newTitle.trim();
        document.getElementById('contentTitleToggle').innerHTML = `${newTitle.trim()} <span class="arrow">▾</span>`;
        showToast(getTranslation('content-added-success'), 'success');
      } else {
        showToast(json.message || getTranslation('error-occurred'), 'error');
      }
    } catch (err) {
      console.error('❌ خطأ في إضافة عنوان المحتوى:', err);
      showToast(getTranslation('error-occurred'), 'error');
    }
  };
}


document.addEventListener('DOMContentLoaded', () => {
  // تحميل العناوين
  
  loadContentTitleOptions();
  setupAddNewContentTitleLink();



  const container = document.getElementById('contentTitleOptionsContainer');
  if (container) {
    container.addEventListener('click', async e => {
      const id = e.target.dataset.id;
      const name = e.target.dataset.name;

      if (e.target.classList.contains('btn-edit')) {
        const updated = prompt(getTranslation('edit-content-prompt'), name);
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
          showToast(getTranslation('content-updated-success'), 'success');
        } else {
          showToast(json.message || getTranslation('error-occurred'), 'error');
        }
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



function closeContentTitleDropdown() {
  const menu = document.getElementById('contentTitleMenu');
  if (menu) menu.classList.add('hidden');
}


document.getElementById('contentTitleToggle').addEventListener('click', () => {
  const menu = document.getElementById('contentTitleMenu');
  menu.classList.toggle('hidden');
    setupAddNewContentTitleLink(); // 🔁 تأكد أنه يتحدث كل مرة

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
  const container   = document.getElementById('editContentTitlesContainer');
  const searchInput = document.getElementById('editContentTitleSearch');
  container.innerHTML = '';

  // إذا لم توجد عناوين، اعرض رسالة
  if (!list.length) {
    container.innerHTML = `<div class="no-content" data-translate="no-contents">${getTranslation('no-contents')}</div>`;
    return;
  }

  list.forEach(item => {
    const div = document.createElement('div');
    div.className = 'folder-item';

    // اسم العنصر
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = item.name;
    label.addEventListener('click', () => {
      document.getElementById('editSelectedContentTitle').value = item.name;
      document.getElementById('editContentTitleToggle').innerHTML = 
        `${item.name} <span class="arrow">▾</span>`;
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
        const newName = prompt(getTranslation('edit-content-prompt'), item.name);
        if (newName && newName.trim()) {
          await updateContentTitle(item.id, newName.trim());
          await loadEditContentTitleOptions();
          showToast(getTranslation('content-updated-success'), 'success');
        }
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
  searchInput.oninput = () => {
    const search   = searchInput.value.toLowerCase();
    const filtered = editContentTitleOptions.filter(c =>
      c.name.toLowerCase().includes(search)
    );
    renderEditContentTitleOptions(filtered);
  };

  // رابط "+ إضافة عنوان جديد"
  const addNewBtn = document.getElementById('editAddNewContentTitleLink');
  if (permissions.canAddContentName) {
    addNewBtn.classList.remove('hidden');
    addNewBtn.onclick = async () => {
      const newTitle = prompt(getTranslation('add-content-prompt'));
      if (!newTitle || !newTitle.trim()) return;
      try {
        const res  = await fetch(`${apiBase}/api/committees/content-titles`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`
          },
          body: JSON.stringify({ name: newTitle.trim() })
        });
        const json = await res.json();
        if (res.ok) {
          await loadEditContentTitleOptions();
          document.getElementById('editSelectedContentTitle').value = newTitle.trim();
          document.getElementById('editContentTitleToggle').innerHTML =
            `${newTitle.trim()} <span class="arrow">▾</span>`;
          showToast(getTranslation('content-added-success'), 'success');
        } else {
          showToast(json.message || getTranslation('error-occurred'), 'error');
        }
      } catch (err) {
        console.error('❌ خطأ في إضافة عنوان المحتوى:', err);
        showToast(getTranslation('error-occurred'), 'error');
      }
    };
  } else {
    addNewBtn.classList.add('hidden');
    addNewBtn.onclick = null;
  }
}

document.getElementById('editContentTitlesContainer').addEventListener('click', async e => {
  const id = e.target.dataset.id;
  const name = e.target.dataset.name;

  if (e.target.classList.contains('btn-edit')) {
    const updated = prompt(getTranslation('edit-content-prompt'), name);
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
      showToast(getTranslation('content-updated-success'), 'success');
    } else {
      showToast(json.message || getTranslation('error-occurred'), 'error');
    }
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
                        if (permissions.canEditFolder)

            icons += `<a href="#" class="edit-icon"><img src="../images/edit.svg" alt="تعديل"></a>`;
                        if (permissions.canDeleteFolder)

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
          foldersList.innerHTML = `<div class="no-content" data-translate="no-folders">${getTranslation('no-folders')}</div>`;
        }
      } catch (err) {
        showToast(getTranslation('error-occurred'), 'error');
      }
    }

async function fetchFolderContents(folderId, folderName) {
  currentFolderId = folderId;
  foldersSection.style.display = 'none';
  folderContentsSection.style.display = 'block';
  backToFilesContainer.style.display = 'block';
  folderContentTitle.textContent = folderName || getTranslation('folder-content-title');

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
            <div class="file-name">${content.title}</div>
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
        modal.style.display = 'flex';
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
        if (confirm(getTranslation('delete-folder-confirm'))) {
            deleteFolder(folderId);
        }
    }

    async function handleCreateFolder() {
        const folderName = document.getElementById('selectedFolderName').value;
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
history.back();        }
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
    document.getElementById('selectedContentTitle').value = '';
    document.getElementById('contentTitleToggle').innerHTML = `${getTranslation('choose-content-name')} <span class="arrow">▾</span>`;
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
            fileUploadText.innerHTML = `<span class="supported-files">${getTranslation('pdf-only')}</span>`;
            fileDropArea.classList.remove('has-file');
            // إعادة تعيين الدروبداون
            document.getElementById('selectedContentTitle').value = '';
            document.getElementById('contentTitleToggle').innerHTML = `${getTranslation('choose-content-name')} <span class="arrow">▾</span>`;
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
  editContentTitleMenu.classList.add('hidden');
}

function openEditContentModal(id) {
  editContentIdInput.value = id;

  loadEditContentTitleOptions()
    .then(() => {
      return fetch(`${apiBase}/api/committees/contents/${id}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      })
      .then(res => res.json());
    })
.then(content => {
  editSelectedContentTitle.value   = content.title;
  editContentTitleToggle.innerHTML = `${content.title} <span class="arrow">▾</span>`;
  editContentNotesInput.value      = content.notes || '';
  editContentModal.style.display   = 'flex';
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
  editContentIdInput.value = '';

  // مسح الـ dropdown
  editSelectedContentTitle.value = '';
  editContentTitleToggle.innerHTML = `${getTranslation('choose-content-name')} <span class="arrow">▾</span>`;
  editContentTitleMenu.classList.add('hidden');

  // مسح الملاحظات (لو ضفت textarea)
  if (editContentNotesInput) {
    editContentNotesInput.value = '';
  }

  // مسح رفع الملف وإعادة واجهة الـ drop-area
  if (editContentFileInput) {
    editContentFileInput.value = '';
    const fileDropArea = editContentFileInput.closest('.file-drop-area');
    const fileUploadText = fileDropArea.querySelector('.file-upload-text');
    fileUploadText.innerHTML = `<span class="supported-files">${getTranslation('pdf-only')}</span>`;
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
  const title     = editSelectedContentTitle.value;
  const notes     = editContentNotesInput.value;
  const file      = editContentFileInput.files[0];

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
        const fileUploadText = fileDropArea.querySelector('.file-upload-text');
        
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
        toast.remove();
    }, duration);
} 