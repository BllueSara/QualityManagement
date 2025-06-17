const apiBase      = 'http://localhost:3006/api';
let currentDepartmentId = null;
let currentFolderId     = null;

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
// 1) مصفوفة الأسماء والاختيار
let folderNames = [];
let selectedFolderId = null;

// 1) جلب الأسماء
async function loadFolderNames() {
  if (!currentDepartmentId) return;
  try {
    const res = await fetch(
      `${apiBase}/departments/${currentDepartmentId}/folders/folder-names`,
      { headers: { 'Authorization': `Bearer ${getToken()}` } }
    );
    const json = await res.json();
    folderNames = json.data || [];             // ← خزنهم هنا
    renderFolderNames(folderNames);
    // ظهر البحث والإضافة
    document.getElementById('folderNameSearch').classList.remove('hidden');
  if (permissions.canAddFolderName) {
    document.getElementById('addNewFolderNameLink').classList.remove('hidden');
  }  } catch (err) {
    console.error('Error loading folder names:', err);
  }
}
function toggleDropdown() {
  document.getElementById('folderNameMenu'      ).classList.toggle('hidden');
  document.getElementById('folderNameSearch'    ).classList.toggle('hidden');
if (permissions.canAddFolderName) {
    document.getElementById('addNewFolderNameLink').classList.toggle('hidden');
  }}
function closeDropdown() {
  document.getElementById('folderNameMenu'      ).classList.add('hidden');
  document.getElementById('folderNameSearch'    ).classList.add('hidden');
  document.getElementById('addNewFolderNameLink').classList.add('hidden');
}

// 2) عرض الأسماء
function renderFolderNames(list) {
  const container = document.getElementById('folderNamesContainer');
  container.innerHTML = '';
  list.forEach(item => {
    const div = document.createElement('div');
    div.className = 'folder-item';
    div.innerHTML = `
      <span class="label">${item.name}</span>
      <span class="actions">
        ${permissions.canEditFolderName   ? `<button class="edit-name"   data-id="${item.id}">✎</button>` : ''}
        ${permissions.canDeleteFolderName ? `<button class="delete-name" data-id="${item.id}">🗑</button>` : ''}
      </span>
    `;

    // 1) بدل ما نخلي الاختيار بس على الـ .label، نخلي السطر كله
    div.addEventListener('click', e => {
      // إذا ضغطت على زر تعديل أو حذف، نوقف هنا
      if (e.target.closest('.actions')) return;
      selectedFolderId = item.id;
      // نحدث نص الزر ونحافظ على السهم
      document.getElementById('folderNameToggle').innerHTML =
        `${item.name} <span class="arrow">▾</span>`;
      closeDropdown();
    });

    // 2) تعديل الاسم
    if (permissions.canEditFolderName) {
      div.querySelector('.edit-name').onclick = async e => {
        e.stopPropagation();
        const newName = prompt('ادخل الاسم الجديد:', item.name);
        if (!newName) return;
        await fetch(`${apiBase}/departments/${currentDepartmentId}/folders/folder-names/${item.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${getToken()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name: newName })
        });
        await loadFolderNames();
      };
    }

    // 3) حذف الاسم
    if (permissions.canDeleteFolderName) {
      div.querySelector('.delete-name').onclick = async e => {
        e.stopPropagation();
        if (!confirm('هل تريد حذف هذا الاسم؟')) return;
        await fetch(`${apiBase}/departments/${currentDepartmentId}/folders/folder-names/${item.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (selectedFolderId === item.id) {
          selectedFolderId = null;
          document.getElementById('folderNameToggle').textContent = 'اختر من القائمة...';
        }
        await loadFolderNames();
      };
    }

    container.appendChild(div);
  });
}

// --- dropdown للتعديل ---
function toggleEditDropdown() {
  document.getElementById('editFolderMenu')   .classList.toggle('hidden');
  document.getElementById('editFolderSearch') .classList.toggle('hidden');
  if (permissions.canAddFolderName)
  document.getElementById('editAddNewLink')   .classList.toggle('hidden');
}
function closeEditDropdown() {
  document.getElementById('editFolderMenu')   .classList.add('hidden');
  document.getElementById('editFolderSearch') .classList.add('hidden');
  document.getElementById('editAddNewLink')   .classList.add('hidden');
}
/** يعرض قائمة الأسماء في المودال التعديل */
function renderEditFolderNames(list) {
  const container = document.getElementById('editFolderNamesContainer');
  container.innerHTML = '';
  list.forEach(item => {
    const div = document.createElement('div');
    div.className = 'folder-item';
    div.innerHTML = `
      <span class="label">${item.name}</span>
      <span class="actions">
        ${permissions.canEditFolderName   ? `<button class="edit-name"   data-id="${item.id}">✎</button>` : ''}
        ${permissions.canDeleteFolderName ? `<button class="delete-name" data-id="${item.id}">🗑</button>` : ''}
      </span>
    `;
    // اختيار السطر كلّه
    div.addEventListener('click', e => {
      if (e.target.closest('.actions')) return;
      selectedFolderId = item.id;
      document.getElementById('editFolderToggle').innerHTML =
        `${item.name} <span class="arrow">▾</span>`;
      closeEditDropdown();
    });
    // تعديل اسم
    if (permissions.canEditFolderName) {
      div.querySelector('.edit-name').onclick = async e => {
        e.stopPropagation();
        const newName = prompt('ادخل الاسم الجديد:', item.name);
        if (!newName) return;
        await fetch(`${apiBase}/departments/${currentDepartmentId}/folders/folder-names/${item.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${getToken()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name: newName })
        });
        await loadFolderNames();
        renderEditFolderNames(folderNames);
      };
    }
    // حذف اسم
    if (permissions.canDeleteFolderName) {
      div.querySelector('.delete-name').onclick = async e => {
        e.stopPropagation();
        if (!confirm('هل تريد حذف هذا الاسم؟')) return;
        await fetch(`${apiBase}/departments/${currentDepartmentId}/folders/folder-names/${item.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        await loadFolderNames();
        renderEditFolderNames(folderNames);
      };
    }
    container.appendChild(div);
  });
}

// 3) فتح/غلق الدروبدَاون
// حالة الأسماء والاختيار
let contentNames = [];
let selectedContentNameId = null;

// 1) جلب أسماء المحتوى
async function loadContentNames() {
  try {
    const res = await fetch(
      `${apiBase}/content-names`, // ✅ التعديل هنا
      {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      }
    );
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const { data } = await res.json();
    contentNames = data || [];
    renderContentNames(contentNames);
    document.getElementById('contentNameSearch').classList.remove('hidden');
 if (permissions.canAddContentName) {
      document.getElementById('addNewContentNameLink').classList.remove('hidden');
    }  } catch (err) {
    console.error('Error loading content names:', err);
  }
}



// 2) عرض القائمة
function renderContentNames(list) {
  const container = document.getElementById('contentNamesContainer');
  container.innerHTML = '';

  list.forEach(item => {
    const div = document.createElement('div');
    div.className = 'folder-item';

    div.innerHTML = `
      <span class="label">${item.name}</span>
      <span class="actions">
        ${permissions.canEditContentName ? `<button class="edit-name"   data-id="${item.id}">✎</button>` : ''}
        ${permissions.canDeleteContentName ? `<button class="delete-name" data-id="${item.id}">🗑️</button>` : ''}
      </span>
    `;

    // ✅ اختيار الاسم عند الضغط
    div.addEventListener('click', e => {
      if (e.target.closest('.actions')) return; // تجاهل الضغط على أزرار التعديل/الحذف
      document.getElementById('contentNameToggle').innerHTML =
        `${item.name} <span class="arrow">▾</span>`;

      const hiddenInput = document.getElementById('selectedContentNameId');
      if (hiddenInput) {
        hiddenInput.value = item.name; // ← نرسل الاسم مو الـ ID حسب رغبتك
        console.log('✅ تم اختيار اسم محتوى:', item.name);
      }

      closeContentDropdown();
    });

    // ✏️ زر التعديل
    if (permissions.canEditContentName) {
      div.querySelector('.edit-name')?.addEventListener('click', async e => {
        e.stopPropagation();
        const newName = prompt('ادخل الاسم الجديد:', item.name);
        if (!newName) return;

        await fetch(`${apiBase}/content-names/${item.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${getToken()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name: newName })
        });
        await loadContentNames();
      });
    }

    // 🗑️ زر الحذف
    if (permissions.canDeleteContentName) {
      div.querySelector('.delete-name')?.addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm('هل تريد حذف هذا الاسم؟')) return;

        await fetch(`${apiBase}/content-names/${item.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${getToken()}`
          }
        });

        await loadContentNames();
      });
    }

    container.appendChild(div);
  });
}



// 3) فتح/غلق الدروبدَاون
function toggleContentDropdown() {
  document.getElementById('contentNameMenu').classList.toggle('hidden');
  document.getElementById('contentNameSearch').classList.toggle('hidden');
  if (permissions.canAddContentName)
  document.getElementById('addNewContentNameLink').classList.toggle('hidden');
}
function closeContentDropdown() {
  document.getElementById('contentNameMenu').classList.add('hidden');
  document.getElementById('contentNameSearch').classList.add('hidden');
  document.getElementById('addNewContentNameLink').classList.add('hidden');
}

function renderEditContentNames(list) {
  const container = document.getElementById('editContentNamesContainer');
  container.innerHTML = '';

  list.forEach(item => {
    const div = document.createElement('div');
    div.className = 'folder-item';

    // 1) بناء المحتوى: الاسم + مساحة للأزرار
    div.innerHTML = `
      <span class="label">${item.name}</span>
      <span class="actions">
        ${permissions.canEditContentName   ? `<button class="edit-name"   data-id="${item.id}">✎</button>` : ''}
        ${permissions.canDeleteContentName ? `<button class="delete-name" data-id="${item.id}">🗑️</button>` : ''}
      </span>
    `;

    // 2) اختيار الاسم عند الضغط على السطر (ما عدا الأزرار)
    div.addEventListener('click', e => {
      if (e.target.closest('.actions')) return; // تجاهل الضغط على الأزرار
      document.getElementById('editContentNameToggle').innerHTML =
        `${item.name} <span class="arrow">▾</span>`;
      document.getElementById('editSelectedContentNameId').value = item.name;
      // إخفاء القائمة
      document.getElementById('editContentNameMenu').classList.add('hidden');
      document.getElementById('editContentNameSearch').classList.add('hidden');
      if (permissions.canAddContentName){
        document.getElementById('editAddNewContentNameLink').classList.remove('hidden');
      }
    });

    // 3) زر تعديل الاسم
    if (permissions.canEditContentName) {
      div.querySelector('.edit-name').addEventListener('click', async e => {
        e.stopPropagation();
        const newName = prompt('ادخل الاسم الجديد:', item.name);
        if (!newName) return;
        await fetch(`${apiBase}/content-names/${item.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${getToken()}`,
            'Content-Type':  'application/json'
          },
          body: JSON.stringify({ name: newName })
        });
        // بعد التعديل، أعِد جلب وطباعة القائمة
        await loadContentNames();
        renderEditContentNames(contentNames);
      });
    }

    // 4) زر حذف الاسم
    if (permissions.canDeleteContentName) {
      div.querySelector('.delete-name').addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm('هل تريد حذف هذا الاسم؟')) return;
        await fetch(`${apiBase}/content-names/${item.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${getToken()}`
          }
        });
        // بعد الحذف، أعِد جلب وطباعة القائمة
        await loadContentNames();
        renderEditContentNames(contentNames);
      });
    }

    container.appendChild(div);
  });
}


document.addEventListener('DOMContentLoaded',async function() {
    // console.log('DOMContentLoaded event fired in department-content.js');
   const toggleBtn   = document.getElementById('folderNameToggle');
  const menu        = document.getElementById('folderNameMenu');
  const searchInput = document.getElementById('folderNameSearch');
  const addLink     = document.getElementById('addNewFolderNameLink');


  // wire the opener
  toggleBtn.addEventListener('click', e => {
    e.stopPropagation();
    toggleDropdown();             // ← use the function, not manual toggles
    if (!folderNames.length) loadFolderNames();
  });

  // click‐out closes
  document.addEventListener('click', e => {
    if (!e.target.closest('#folderNameDropdown')) {
      closeDropdown();
    }
  });

  // searching
  searchInput.addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    renderFolderNames(
      folderNames.filter(f => f.name.toLowerCase().includes(q))
    );
  });
  if (permissions.canAddFolderName) {
    addLink.classList.remove('hidden');  // إبقاء الرابط مرئيًا
    addLink.addEventListener('click', async () => {
      const name = prompt('أدخل اسم المجلد الجديد:');
      if (!name) return;
      await fetch(
        `${apiBase}/departments/${currentDepartmentId}/folders/folder-names`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${getToken()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name })
        }
      );
      await loadFolderNames();
    });
  } else {
    addLink.classList.add('hidden');  // أخفِ الرابط لو ما عنده صلاحية
  }
  // --- ربط dropdown التعديل ---
const edtToggle   = document.getElementById('editFolderToggle');
const edtMenu     = document.getElementById('editFolderMenu');
const edtSearch   = document.getElementById('editFolderSearch');
const edtAddLink  = document.getElementById('editAddNewLink');

edtToggle.addEventListener('click', e => {
  e.stopPropagation();
  toggleEditDropdown();
  if (!folderNames.length) loadFolderNames();
  renderEditFolderNames(folderNames);
});
document.addEventListener('click', e => {
  if (!e.target.closest('#editFolderDropdown')) {
    closeEditDropdown();
  }
});
edtSearch.addEventListener('input', e => {
  const q = e.target.value.trim().toLowerCase();
  renderEditFolderNames(
    folderNames.filter(f => f.name.toLowerCase().includes(q))
  );
});
edtAddLink.addEventListener('click', async () => {
  const name = prompt('أدخل اسم المجلد الجديد:');
  if (!name) return;
  await fetch(`${apiBase}/departments/${currentDepartmentId}/folders/folder-names`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name })
  });
  await loadFolderNames();
  renderEditFolderNames(folderNames);
});
// ——— Content-name dropdown setup ———
  const contentToggleBtn    = document.getElementById('contentNameToggle');
  const contentMenu         = document.getElementById('contentNameMenu');
  const contentSearchInput  = document.getElementById('contentNameSearch');
  const contentAddLink      = document.getElementById('addNewContentNameLink');

  contentToggleBtn.addEventListener('click', e => {
    e.stopPropagation();
    toggleContentDropdown();
    if (!contentNames.length) loadContentNames();
  });

  contentSearchInput.addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    renderContentNames(
      contentNames.filter(f => f.name.toLowerCase().includes(q))
    );
  });

  contentAddLink.addEventListener('click', async () => {
    const name = prompt('أدخل اسم المحتوى الجديد:');
    if (!name) return;
    await fetch(
      `${apiBase}/content-names`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name })
      }
    );
    await loadContentNames();
  });

  // Close on outside click
  document.addEventListener('click', e => {
    if (!e.target.closest('#contentNameDropdown')) {
      closeContentDropdown();
    }
  });
// عناصر دروبداون تعديل المحتوى
const editContentNameToggleBtn   = document.getElementById('editContentNameToggle');
const editContentNameMenu        = document.getElementById('editContentNameMenu');
const editContentNameSearchInput = document.getElementById('editContentNameSearch');
const editAddNewContentNameLink  = document.getElementById('editAddNewContentNameLink');

// فتح/إغلاق القائمة وعرض الأسماء
editContentNameToggleBtn.addEventListener('click', async e => {
  e.stopPropagation();
  editContentNameMenu.classList.toggle('hidden');
  editContentNameSearchInput.classList.toggle('hidden');

  // بدلًا من التبديل الدائم، فقط إذا كان مسموحًا:
  if (permissions.canAddContentName) {
    editAddNewContentNameLink.classList.toggle('hidden');
  }

  if (!contentNames.length) {
    await loadContentNames();
  }
  renderEditContentNames(contentNames);
});


// إغلاق الدروبدَاون عند الضغط خارج
document.addEventListener('click', e => {
  if (!e.target.closest('#editContentNameDropdown')) {
    editContentNameMenu.classList.add('hidden');
    editContentNameSearchInput.classList.add('hidden');
    editAddNewContentNameLink.classList.add('hidden');
  }
});

// فلترة البحث
editContentNameSearchInput.addEventListener('input', e => {
  const q = e.target.value.trim().toLowerCase();
  renderEditContentNames(
    contentNames.filter(c => c.name.toLowerCase().includes(q))
  );
});

// إضافة اسم جديد
editAddNewContentNameLink.addEventListener('click', async () => {
  const name = prompt('أدخل اسم المحتوى الجديد:');
  if (!name) return;
  await fetch(`${apiBase}/content-names`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type':  'application/json'
    },
    body: JSON.stringify({ name })
  });
  await loadContentNames();
  renderEditContentNames(contentNames);
});

      let isInitialFetch = true;  // ← الفلاج

    const foldersSection = document.querySelector('.folders-section');
    const folderContentsSection = document.querySelector('.folder-contents-section');
    const folderCards = document.querySelectorAll('.folder-card');
    const backButton = document.querySelector('.folder-contents-section .back-button'); // Corrected selector
    const folderContentTitle = document.querySelector('.folder-content-title');

    // Get references for Add Folder Modal
    const addFolderBtn = document.getElementById('addFolderBtn');
    const addFolderModal = document.getElementById('addFolderModal');
    const addFolderCloseBtn = addFolderModal ? addFolderModal.querySelector('.close-button') : null;
    const cancelFolderBtn = addFolderModal ? addFolderModal.querySelector('#cancelFolderBtn') : null;
    const createFolderBtn = addFolderModal ? addFolderModal.querySelector('#createFolderBtn') : null;

    // Get references for Add Content Modal
    const addContentBtn = document.getElementById('addContentBtn');
    const addContentModal = document.getElementById('addContentModal');
// امنع أي نقرة داخل المودال من الارتداد للعناصر أدناه
if (addContentModal) {
  addContentModal.addEventListener('click', function(e) {
    e.stopPropagation();
  });
}

    const addContentCloseBtn = addContentModal ? addContentModal.querySelector('.close-button') : null;
    const cancelContentBtn = addContentModal ? addContentModal.querySelector('#cancelContentBtn') : null;
    const createContentBtn = addContentModal ? addContentModal.querySelector('#createContentBtn') : null;
// ربط زر 'إنشاء المحتوى' بدالة handleCreateContent
if (createContentBtn) {
  createContentBtn.type = 'button';           // تأكد أنّه type="button"
if (createContentBtn) {
  createContentBtn.type = 'button';
  createContentBtn.addEventListener('click', function(event) {
    // هنا نمنع صعود الحدث للعناصر الأب (كالـ folder-card)
    event.stopPropagation();
    // بعدها نستدعي رفع المحتوى
    handleCreateContent();
  });
}}



    // Get references for Add Content Modal Form
    const addContentForm = addContentModal ? addContentModal.querySelector('#addContentFormElement') : null;
if (addContentForm) {
  addContentForm.addEventListener('submit', e => e.preventDefault());
}
if (cancelContentBtn) {
  cancelContentBtn.type = 'button';
  cancelContentBtn.addEventListener('click', closeAddContentModal);
}


    // Get references for Edit Folder Modal
    const editFolderModal = document.getElementById('editFolderModal');
    const editFolderCloseBtn = editFolderModal ? editFolderModal.querySelector('.close-button') : null;
    const cancelEditFolderBtn = editFolderModal ? editFolderModal.querySelector('#cancelEditFolderBtn') : null;
    const updateFolderBtn = editFolderModal ? editFolderModal.querySelector('#updateFolderBtn') : null;
    const editFolderIdInput = document.getElementById('editFolderId');
    const editFolderNameInput = document.getElementById('editFolderName');
    const editFolderFileInput = document.getElementById('editFolderFile');

    // Get references for Edit Content Modal
    const editContentModal = document.getElementById('editContentModal');
    const editContentCloseBtn = editContentModal ? editContentModal.querySelector('.close-button') : null;
    if (editContentCloseBtn) {
  editContentCloseBtn.addEventListener('click', closeEditContentModal);
}
    const cancelEditContentBtn = editContentModal ? editContentModal.querySelector('#cancelEditContentBtn') : null;
    const updateContentBtn = editContentModal ? editContentModal.querySelector('#updateContentBtn') : null;
    const editContentIdInput = document.getElementById('editContentId');
    const editContentTitleInput = document.getElementById('editContentTitle');
    const editContentFileInput = document.getElementById('editContentFile');

    // Get all edit and delete icons for folders
    const folderEditIcons = document.querySelectorAll('.folder-card .edit-icon');
    const folderDeleteIcons = document.querySelectorAll('.folder-card .delete-icon');

    // Get all edit and delete icons for files
    const fileEditIcons = document.querySelectorAll('.file-item .edit-icon');
    const fileDeleteIcons = document.querySelectorAll('.file-item .delete-icon');

    // أزرار الرجوع
    const backToFilesBtn = document.getElementById('backToFilesBtn');
    const backToFilesContainer = document.getElementById('backToFilesContainer');

    const mainBackBtn = document.getElementById('mainBackBtn');



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
  const userRes = await fetch(`${apiBase}/users/${userId}`, { headers });
  const { data: user } = await userRes.json();
  if (['admin'].includes(user.role)) {
    // للمسؤولين: صلاحيات كاملة
    Object.keys(permissions).forEach(k => permissions[k]=true);
    return;
  }
  // ثم جلب قائمة المفاتيح
  const permsRes = await fetch(`${apiBase}/users/${userId}/permissions`, { headers });
  const { data: perms } = await permsRes.json();
 const keys = perms.map(p => 
    (typeof p === 'string' ? p : p.permission)
  );  // منها `add_section` و `edit_section` و `delete_section`
  if (keys.includes('add_folder'))    permissions.canAddFolder    = true;
  if (keys.includes('edit_folder'))   permissions.canEditFolder   = true;
  if (keys.includes('delete_folder')) permissions.canDeleteFolder = true;
  if (keys.includes('add_folder_name'))    permissions.canAddFolderName    = true;
  if (keys.includes('edit_folder_name'))   permissions.canEditFolderName   = true;
  if (keys.includes('delete_folder_name')) permissions.canDeleteFolderName = true;
  // وبالمثل لمحتوى الملفات:
  if (keys.includes('add_content'))    permissions.canAddContent    = true;
  if (keys.includes('edit_content'))   permissions.canEditContent   = true;
  if (keys.includes('delete_content')) permissions.canDeleteContent = true;
  if (keys.includes('add_content_name'))    permissions.canAddContentName    = true;
  if (keys.includes('edit_content_name'))   permissions.canEditContentName   = true;
  if (keys.includes('delete_content_name')) permissions.canDeleteContentName = true;
}

    // دالة لجلب مجلدات القسم بناءً على departmentId
 // دالة لجلب مجلدات القسم بناءً على departmentId
async function fetchFolders(departmentId) {
    if (currentFolderId !== null) {
      console.log('⛔️ Skipping fetchFolders because currentFolderId =', currentFolderId);
      return;
    }

    console.log('🔥 fetchFolders() fired for departmentId:', departmentId);
    currentDepartmentId = departmentId;
    foldersSection.style.display = 'block';
    folderContentsSection.style.display = 'none';
    backToFilesContainer.style.display = 'none';

    try {
      const response = await fetch(
        `http://localhost:3006/api/departments/${departmentId}/folders`, {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        }
      );
      const data = await response.json();

      if (!response.ok) {
        showToast(data.message || 'فشل جلب مجلدات القسم.', 'error');
        console.error('Failed to fetch folders:', data);
        return;
      }

      const foldersList = document.querySelector('.folders-list');
      foldersList.innerHTML = '';
      folderContentTitle.textContent = data.departmentName || 'مجلدات القسم';

      if (data.data.length) {
        data.data.forEach(folder => {
          const card = document.createElement('div');
          card.className = 'folder-card';
          card.dataset.id = folder.id;

          let icons = '';
          if (permissions.canEditFolder || permissions.canDeleteFolder) {
            icons = '<div class="item-icons">';
            if (permissions.canEditFolder)
              icons += `<a href="#" class="edit-icon"><img src="../images/edit.svg" alt="تعديل"></a>`;
            if (permissions.canDeleteFolder)
              icons += `<a href="#" class="delete-icon"><img src="../images/delet.svg" alt="حذف"></a>`;
            icons += '</div>';
          }

          card.innerHTML = icons +
            `<img src="../images/folders.svg">
             <div class="folder-info">
               <div class="folder-name">${folder.name}</div>
             </div>`;

          foldersList.appendChild(card);

          // فتح محتويات المجلد عند الضغط على البطاقة
          card.addEventListener('click', e => {
            if (!e.target.closest('.edit-icon') && !e.target.closest('.delete-icon')) {
              fetchFolderContents(folder.id);
            }
          });

          // ربط أيقونة التعديل
          if (permissions.canEditFolder) {
            const editIcon = card.querySelector('.edit-icon');
            if (editIcon) {
              editIcon.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                openEditFolderModal(folder.id); // ✅ استخدم معرف المجلد مباشرة
              });
            }
          }

          // ربط أيقونة الحذف
          if (permissions.canDeleteFolder) {
            const deleteIcon = card.querySelector('.delete-icon');
            if (deleteIcon) {
              deleteIcon.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                openDeleteFolderModal(folder.id); // ✅ استخدم معرف المجلد مباشرة
              });
            }
          }
        });
      } else {
        foldersList.innerHTML = '<div class="no-content">لا يوجد مجلدات في هذا القسم.</div>';
      }
    } catch (err) {
      console.error('Error fetching folders:', err);
      showToast('حدث خطأ في الاتصال بجلب مجلدات القسم.', 'error');
    }
}

      


    // دالة لجلب محتويات المجلد بناءً على folderId
    async function fetchFolderContents(folderId) {
        currentFolderId = folderId; // حفظ معرف المجلد الحالي
        const addContentBtn = document.getElementById('addContentBtn');
        if (addContentBtn) {
            addContentBtn.dataset.folderId = folderId;
        }
        
        // تحديث حالة العرض فقط إذا لم نكن في حالة عرض المحتويات
        if (folderContentsSection.style.display === 'none') {
            foldersSection.style.display = 'none';
            folderContentsSection.style.display = 'block';
            backToFilesContainer.style.display = 'none';
        }
        
        const userRole = getUserRoleFromToken();

        try {
            const response = await fetch(`http://localhost:3006/api/folders/${folderId}/contents`, {
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                }
            });
            const data = await response.json();

            if (response.ok) {
                const filesList = document.querySelector('.files-list');
                filesList.innerHTML = '';
                
                folderContentTitle.textContent = data.folderName || 'محتويات المجلد';

                if (data.data && data.data.length > 0) {
                    data.data.forEach(content => {
                        const approvalStatus = content.is_approved ? 'معتمد' : 'في انتظار الاعتماد';
                        const approvalClass = content.is_approved ? 'approved' : 'pending';
                        
                        // 1) بنية الأيقونات حسب الصلاحيات
        let icons = '';
        if (permissions.canEditContent || permissions.canDeleteContent) {
          icons = '<div class="item-icons">';
          if (permissions.canEditContent) {
            icons += `<a href="#" class="edit-icon"   data-id="${content.id}"><img src="../images/edit.svg" alt="تعديل"></a>`;
          }
          if (permissions.canDeleteContent) {
            icons += `<a href="#" class="delete-icon" data-id="${content.id}"><img src="../images/delet.svg" alt="حذف"></a>`;
          }
          icons += '</div>';
        }

        // 2) أنشئ العنصر
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
          ${icons}
          <img src="../images/pdf.svg" alt="ملف PDF">
          <div class="file-info">
            <div class="file-name">${content.title}</div>
            <div class="approval-status ${approvalClass}">${approvalStatus}</div>
          </div>
        `;
        filesList.appendChild(fileItem);

        // 3) اربط الـ listeners فقط إذا الأيقونات موجودة
        if (permissions.canEditContent) {
          const btn = fileItem.querySelector('.edit-icon');
          btn && btn.addEventListener('click', e => {
            e.preventDefault(); e.stopPropagation();
            openEditContentModal(content.id);
          });
        }
        if (permissions.canDeleteContent) {
          const btn = fileItem.querySelector('.delete-icon');
          btn && btn.addEventListener('click', e => {
            e.preventDefault(); e.stopPropagation();
            openDeleteContentModal(content.id);
          });
        }

                        // عند النقر على الملف، افتح المحتوى مباشرة
                        fileItem.addEventListener('click', function(e) {
                            if (!e.target.closest('.edit-icon') && !e.target.closest('.delete-icon')) {
                                if (content.fileUrl) {
                                    const fullFileUrl = `http://localhost:3006/uploads/${content.fileUrl}`;
                                    window.open(fullFileUrl, '_blank');
                                } else {
                                    showToast('رابط الملف غير متوفر.', 'error'); 
                                }
                            }
                        });
                    });
                } else {
                    filesList.innerHTML = '<div class="no-content">لا يوجد محتوى في هذا المجلد</div>';
                }
            } else {
                showToast(data.message || 'فشل جلب محتويات المجلد.', 'error');
            }
        } catch (error) {
            console.error('خطأ في جلب محتويات المجلد:', error);
            showToast('حدث خطأ في الاتصال بجلب محتويات المجلد.', 'error');
        }
    }

    // دالة للتعامل مع الموافقة على المحتوى
    async function handleApproveContent(contentId) {
        console.log('Attempting to approve content with ID:', contentId);
        try {
            const response = await fetch(`http://localhost:3006/api/contents/${contentId}/approve`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (response.ok) {
                showToast(data.message || 'تمت الموافقة على المحتوى بنجاح!', 'success');
                // تحديث قائمة المحتويات بعد الموافقة
                await fetchFolderContents(currentFolderId);
            } else {
                showToast(data.message || 'فشل الموافقة على المحتوى.', 'error');
                console.error('Failed to approve content:', data.message);
            }
        } catch (error) {
            console.error('خطأ في الموافقة على المحتوى:', error);
            showToast('حدث خطأ في الاتصال بالموافقة على المحتوى.', 'error');
        }
    }

    // Function to open the Add Folder modal

    // Function to close the Add Folder modal
function closeAddFolderModal() {
  addFolderModal.style.display = 'none';
  // ما في حاجة لمسح input غير موجود
}
    // Function to handle Create Folder
    async function handleCreateFolder() {
        const folderName = document.getElementById('folderName').value;
        console.log('Attempting to create folder with name:', folderName, 'for departmentId:', currentDepartmentId);

        if (!currentDepartmentId || !folderName) {
            showToast('اسم المجلد مطلوب.', 'error');
            console.warn('Folder name or department ID is missing.');
            return;
        }

        try {
            const response = await fetch(`http://localhost:3006/api/departments/${currentDepartmentId}/folders`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: folderName })
            });

            const data = await response.json();
            console.log('Create folder response status:', response.status);
            console.log('Create folder response data:', data);

            if (response.ok) {
                showToast('تم إضافة المجلد بنجاح!', 'success');
                closeAddFolderModal();
                fetchFolders(currentDepartmentId); // Refresh the folder list
            } else {
                showToast(data.message || 'فشل إضافة المجلد.', 'error');
                console.error('Failed to create folder:', data.message);
            }
        } catch (error) {
            console.error('Error creating folder:', error);
            showToast('حدث خطأ في الاتصال بإضافة المجلد.', 'error');
        }
    }

    // Function to open the Add Content modal
    function openAddContentModal() {
        if (addContentModal) {
            const folderIdToOpenModalWith = document.getElementById('addContentBtn').dataset.folderId;
            if (!folderIdToOpenModalWith) {
                showToast('لم يتم تحديد مجلد لرفع المحتوى إليه. الرجاء اختيار مجلد أولاً.', 'error');
                console.error('openAddContentModal: No folderId found on addContentBtn.');
                return; // Prevent modal from opening if no folderId is set
            }
            addContentModal.style.display = 'flex';
            document.getElementById('addContentFolderId').value = folderIdToOpenModalWith; // Set the hidden input value
            console.log('openAddContentModal: Setting addContentFolderId to:', folderIdToOpenModalWith);
        }
    }

    // Function to handle file selection and display file name
    function handleFileSelection(inputElement) {
        const fileDropArea = inputElement.closest('.file-drop-area');
        const fileUploadText = fileDropArea.querySelector('.file-upload-text');
        
        if (inputElement.files.length > 0) {
            const file = inputElement.files[0];
            
            // التحقق من نوع الملف
            if (file.type !== 'application/pdf') {
                showToast('يرجى اختيار ملف PDF فقط', 'error');
                inputElement.value = ''; // مسح الملف المختار
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

    // Add event listeners for file inputs
    document.getElementById('contentFile').addEventListener('change', function() {
        handleFileSelection(this);
    });

    document.getElementById('editContentFile').addEventListener('change', function() {
        handleFileSelection(this);
    });

    // Function to close the Add Content modal
function closeAddContentModal() {
    if (addContentModal) {
        addContentModal.style.display = 'none';
        // إعادة دروبداون الاسم لوضعيته الافتراضية
        document.getElementById('contentNameToggle').innerHTML = 'اختر اسماً… <span class="arrow">▾</span>';
        // مسح قيمة الـ hidden input
        document.getElementById('selectedContentNameId').value = '';
        // مسح الملف
        document.getElementById('contentFile').value = '';
        const fileDropArea = document.querySelector('#addContentModal .file-drop-area');
        const fileUploadText = fileDropArea.querySelector('.file-upload-text');
        fileUploadText.innerHTML = '<span class="supported-files">ملفات PDF فقط</span>';
        fileDropArea.classList.remove('has-file');
    }
}


    // Function to handle Create Content
async function handleCreateContent() {
  const folderIdToUpload = document.getElementById('addContentFolderId')?.value;
  const contentFile      = document.getElementById('contentFile')?.files[0];

  // 🟢 نجيب الاسم المختار من الزر
  const selectedContentName = document.getElementById('contentNameToggle')?.textContent?.replace('▾', '').trim();

  if (!folderIdToUpload || !selectedContentName || !contentFile || selectedContentName === 'اختر اسماً…') {
    showToast('يرجى اختيار اسم المحتوى ورفع ملف PDF.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('title', selectedContentName);
  formData.append('file', contentFile);

  try {
    const response = await fetch(
      `http://localhost:3006/api/folders/${folderIdToUpload}/contents`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}` },
        body: formData
      }
    );

    const result = await response.json();

    if (response.ok) {
      showToast(result.message || '✅ تم رفع المحتوى بنجاح!', 'success');
      closeAddContentModal();
      await fetchFolderContents(folderIdToUpload);
    } else {
      showToast(`❌ فشل إضافة المحتوى: ${result.message || 'خطأ'}`, 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('❌ خطأ في الاتصال بالخادم.', 'error');
  }
}



    // --- Edit/Delete Modal Functions ---

async function openEditFolderModal(folderId) {
  // جلب بيانات المجلد الحالي
  const res = await fetch(`${apiBase}/folders/${folderId}`, {
    headers: { 'Authorization': `Bearer ${getToken()}` }
  });
  const { data } = await res.json();

  if (!res.ok) {
    showToast('فشل جلب بيانات المجلد.', 'error');
    return;
  }

  editFolderIdInput.value = folderId;    // نحفظ ID
  // نحمل كل الأسماء أولاً (لو ما محمّلّهم)
  if (!folderNames.length) await loadFolderNames();
  // nرسم القائمة
  renderEditFolderNames(folderNames);

  // نحدد القيمة الحالية في الزر
  const current = folderNames.find(f => f.id === folderId);
  if (current) {
    selectedFolderId = folderId;
    document.getElementById('editFolderToggle').innerHTML =
      `${current.name} <span class="arrow">▾</span>`;
  }

  editFolderModal.style.display = 'flex';
}

    

function closeEditFolderModal() {
  if (editFolderModal) {
    // إخفاء المودال
    editFolderModal.style.display = 'none';
    // مسح الـ ID المخفي
    document.getElementById('editFolderId').value = '';
    // إعادة زرّ الدروبداون لوضعه الافتراضي
    document.getElementById('editFolderToggle').innerHTML =
      'اختر من القائمة... <span class="arrow">▾</span>';
    // تأكد إن قائمة الاختيار مقفولة
    closeEditDropdown();
  }
}


async function handleUpdateFolder() {
  const folderId   = document.getElementById('editFolderId').value;
  // اقرأ الاسم من الزرّ
  const rawText    = document.getElementById('editFolderToggle').textContent;
  const folderName = rawText.replace('▾', '').trim();

  if (!folderId || !folderName) {
    showToast('اختر اسم المجلد أولاً.', 'error');
    return;
  }

  try {
    const res = await fetch(`${apiBase}/folders/${folderId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({ name: folderName })
    });
    const data = await res.json();

    if (res.ok) {
      showToast('تم تحديث المجلد بنجاح!', 'success');
      closeEditFolderModal();
      currentFolderId = null;
      fetchFolders(currentDepartmentId);
    } else {
      showToast(data.message || 'فشل التحديث.', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('خطأ في الاتصال.', 'error');
  }
}
document.getElementById('updateFolderBtn')
  .addEventListener('click', handleUpdateFolder);


    // Get references for Delete Folder Modal
    const deleteFolderModal = document.getElementById('deleteFolderModal');
    const deleteFolderCloseBtn = deleteFolderModal ? deleteFolderModal.querySelector('.close-button') : null;
    const cancelDeleteFolderBtn = document.getElementById('cancelDeleteFolderBtn');
    const confirmDeleteFolderBtn = document.getElementById('confirmDeleteFolderBtn');
    const deleteFolderIdInput = document.getElementById('deleteFolderId');


    function openDeleteFolderModal(folderId) {
         console.log('Opening delete modal for folder:', folderId);
         if (deleteFolderModal) {
             deleteFolderIdInput.value = folderId; // Store folder ID
             deleteFolderModal.style.display = 'flex';
         }
    }

    function closeDeleteFolderModal() {
        if (deleteFolderModal) {
            deleteFolderModal.style.display = 'none';
            deleteFolderIdInput.value = ''; // Clear ID
        }
    }

    async function handleDeleteFolder() {
        const folderId = deleteFolderIdInput.value;
        console.log('Deleting folder with ID:', folderId);

        if (!folderId) {
            showToast('معرف المجلد مفقود للحذف.', 'error');
            return;
        }

        try {
            const response = await fetch(`http://localhost:3006/api/folders/${folderId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                showToast(data.message || 'تم حذف المجلد بنجاح!', 'success');
                closeDeleteFolderModal();
                currentFolderId = null; // ⬅️ أضف هذا
                fetchFolders(currentDepartmentId);
                        
              
            } else {
                showToast(data.message || 'فشل حذف المجلد.', 'error');
                console.error('Failed to delete folder:', data.message);
            }
        } catch (error) {
            console.error('Error deleting folder:', error);
            showToast('حدث خطأ في الاتصال بحذف المجلد.', 'error');
        }
    }

     async function openEditContentModal(contentId) {
         console.log('Opening edit modal for content:', contentId);
         if (editContentModal) {
             try {
                 const response = await fetch(`http://localhost:3006/api/contents/${contentId}`, {
                     headers: {
                         'Authorization': `Bearer ${getToken()}`
                     }
                 });
                 const data = await response.json();

                 if (response.ok && data.data) {
editContentIdInput.value = contentId;    // نحفظ الـ ID
// نعبّي دروبداون الاسم:
const title = data.data.title;
document.getElementById('editContentNameToggle').innerHTML =
  `${title} <span class="arrow">▾</span>`;
// نعبّي الـ hidden input
document.getElementById('editSelectedContentNameId').value = title;
// عرض المودال
editContentModal.style.display = 'flex';

                 } else {
                     showToast(data.message || 'فشل جلب بيانات المحتوى.', 'error');
                     console.error('Failed to fetch content data. Status:', response.status, 'Message:', data.message);
                 }
             } catch (error) {
                 console.error('Error fetching content data:', error);
                 showToast('حدث خطأ في الاتصال بجلب بيانات المحتوى.', 'error');
             }
         }
    }

function closeEditContentModal() {
  if (editContentModal) {
    // أخف المودال
    editContentModal.style.display = 'none';

    // مسح الـ ID
    editContentIdInput.value = '';

    // إعادة زر الدروبداون إلى النص الافتراضي
    document.getElementById('editContentNameToggle').innerHTML =
      'اختر اسماً… <span class="arrow">▾</span>';

    // مسح قيمة الـ hidden input
    document.getElementById('editSelectedContentNameId').value = '';

    // مسح اختيار الملف
    editContentFileInput.value = '';

    // إعادة نص منطقة الرفع
    const fileDropArea = document.querySelector('#editContentModal .file-drop-area');
    const fileUploadText = fileDropArea.querySelector('.file-upload-text');
    fileUploadText.innerHTML = '<span class="supported-files">ملفات PDF فقط</span>';
    fileDropArea.classList.remove('has-file');
  }
}


    async function handleUpdateContent() {
        let contentId = editContentIdInput.value.trim();
const contentTitle = document.getElementById('editSelectedContentNameId').value.trim();
        const contentFile = document.getElementById('editContentFile').files[0];
      
        // تنظيف معرف المحتوى (إزالة رموز غير رقمية مثل ⁃)
        contentId = contentId.replace(/[^\d]/g, '');
      
        console.log('🔄 handleUpdateContent: contentId =', contentId);
        console.log('📄 New Title =', contentTitle);
        console.log('📎 New File =', contentFile ? contentFile.name : 'No file selected');
      
        if (!contentId || !contentTitle) {
          showToast('يجب إدخال عنوان المحتوى.', 'error');
          return;
        }
      
        const formData = new FormData();
        formData.append('title', contentTitle);
        if (contentFile) formData.append('file', contentFile);
      
        try {
          const response = await fetch(`${apiBase}/contents/${contentId}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${getToken()}`
            },
            body: formData
          });
      
          const data = await response.json();
      
          if (response.ok) {
            showToast(data.message || '✅ تم التحديث بنجاح', 'success');
            closeEditContentModal();
            await fetchFolderContents(currentFolderId);
          } else {
            showToast(data.message || 'فشل التحديث.', 'error');
            console.error('❌ Failed to update content:', data.message);
          }
        } catch (error) {
          console.error('❌ Error in handleUpdateContent:', error);
          showToast('حدث خطأ أثناء الاتصال بالخادم.', 'error');
        }
      }
      

    // Function to open the delete content modal
    function openDeleteContentModal(contentId) {
        console.log('openDeleteContentModal: Opening delete modal for content ID:', contentId);
        document.getElementById('deleteContentId').value = contentId;
        document.getElementById('deleteContentModal').style.display = 'flex';
    }

    // Function to close the delete content modal
    function closeDeleteContentModal() {
        document.getElementById('deleteContentModal').style.display = 'none';
    }

    // عند الضغط على بطاقة مجلد
    if (foldersSection) {
        foldersSection.querySelectorAll('.folder-card').forEach(card => {
            card.addEventListener('click', function(event) {
                // تجاهل الضغط على أيقونات التعديل/الحذف
                if (event.target.closest('.edit-icon') || event.target.closest('.delete-icon')) return;
                event.preventDefault();
                foldersSection.style.display = 'none';
                folderContentsSection.style.display = 'block';
                backToFilesContainer.style.display = 'none';
            });
        });
    }

    // عند الضغط على زر الرجوع من تفاصيل الملف إلى قائمة الملفات
    if (backToFilesBtn) {
        backToFilesBtn.addEventListener('click', function() {
            folderContentsSection.style.display = 'block';
            foldersSection.style.display = 'none';
            backToFilesContainer.style.display = 'none';
        });
    }

    // Event listener to open the Add Folder modal
    if (addFolderBtn) {
addFolderBtn.onclick = () => {
  selectedFolderId = null;
  document.getElementById('folderNameToggle').textContent = 'اختر من القائمة...';
  document.getElementById('folderNameSearch').value = '';
  closeDropdown();
  addFolderModal.style.display = 'flex';
};
    }

    // Event listeners to close the Add Folder modal
    if (addFolderCloseBtn) {
        addFolderCloseBtn.addEventListener('click', closeAddFolderModal);
    }

    if (cancelFolderBtn) {
        cancelFolderBtn.addEventListener('click', closeAddFolderModal);
    }

    // Event listener to close the modal when clicking outside
    if (addFolderModal) {
        addFolderModal.addEventListener('click', function(event) {
            if (event.target === addFolderModal) {
                closeAddFolderModal();
            }
        });
    }

    // Event listener for the Create Folder button
    if (createFolderBtn) {
createFolderBtn.onclick = async () => {
  if (!currentDepartmentId || !selectedFolderId) {
    showToast('اختر اسم المجلد من القائمة أولاً.', 'error');
    return;
  }
  const chosen = folderNames.find(f => f.id === selectedFolderId);
  try {
    const res = await fetch(
      `${apiBase}/departments/${currentDepartmentId}/folders`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: chosen.name })
      }
    );
    const data = await res.json();
    if (res.ok) {
      showToast('تم إضافة المجلد بنجاح!', 'success');
      closeAddFolderModal();
      fetchFolders(currentDepartmentId);
    } else {
      showToast(data.message || 'فشل إضافة المجلد.', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('حدث خطأ في الاتصال.', 'error');
  }
};   }

    // Event listener to open the Add Content modal
    if (addContentBtn) {
        addContentBtn.addEventListener('click', openAddContentModal);
    }

    // Event listeners to close the Add Content modal
    if (addContentCloseBtn) {
        addContentCloseBtn.addEventListener('click', closeAddContentModal);
    }

    if (cancelContentBtn) {
        cancelContentBtn.addEventListener('click', closeAddContentModal);
    }

    // Event listener to close the modal when clicking outside
    if (addContentModal) {
        addContentModal.addEventListener('click', function(event) {
            if (event.target === addContentModal) {
                closeAddContentModal();
            }
        });
    }

    // Event listener for the Create Content Form Submission
   

    // --- Event Listeners for Edit/Delete Icons --- (Assuming icons are added in HTML)


     // Event listeners for file edit icons (يجب أن يتم إعادة إضافة هذه بعد جلب المحتويات)
    document.querySelectorAll('.file-item .edit-icon').forEach(icon => {
        icon.addEventListener('click', function(event) {
             event.preventDefault(); // Prevent default link behavior
             event.stopPropagation(); // Prevent click from bubbling to file item
            const contentId = this.getAttribute('data-id');
            if (contentId) {
                openEditContentModal(contentId);
            }
        });
    });

     // Event listeners for file delete icons (يجب أن يتم إعادة إضافة هذه بعد جلب المحتويات)
    document.querySelectorAll('.file-item .delete-icon').forEach(icon => {
        icon.addEventListener('click', function(event) {
             event.preventDefault(); // Prevent default link behavior
             event.stopPropagation(); // Prevent click from bubbling to file item
            const contentId = this.getAttribute('data-id');
            if (contentId) {
                openDeleteContentModal(contentId);
            }
        });
    });

    // Event listeners for buttons inside edit modals
    if (cancelEditFolderBtn) {
        cancelEditFolderBtn.addEventListener('click', closeEditFolderModal);
    }

    if (updateFolderBtn) {
        updateFolderBtn.addEventListener('click', handleUpdateFolder);
    }

    if (cancelEditContentBtn) {
        cancelEditContentBtn.addEventListener('click', closeEditContentModal);
    }

    if (updateContentBtn) {
        updateContentBtn.addEventListener('click', handleUpdateContent);
    }

    // Event listeners to close edit modals when clicking outside
    if (editFolderModal) {
         editFolderModal.addEventListener('click', function(event) {
             if (event.target === editFolderModal) {
                 closeEditFolderModal();
             }
         });
     }

     if (editContentModal) {
         editContentModal.addEventListener('click', function(event) {
             if (event.target === editContentModal) {
                 closeEditContentModal();
             }
         });
     }

    // Event listener for close button in delete modal
    document.querySelector('#deleteContentModal .close-button').addEventListener('click', closeDeleteContentModal);

    // Event listener for cancel button in delete modal
    document.getElementById('cancelDeleteContentBtn').addEventListener('click', closeDeleteContentModal);

    // Event listener for confirm delete button in delete modal
    document.getElementById('confirmDeleteContentBtn').addEventListener('click', handleDeleteContent);


    // Event listeners for Delete Folder Modal buttons
    if (deleteFolderCloseBtn) {
        deleteFolderCloseBtn.addEventListener('click', closeDeleteFolderModal);
    }

    if (cancelDeleteFolderBtn) {
        cancelDeleteFolderBtn.addEventListener('click', closeDeleteFolderModal);
    }

    if (confirmDeleteFolderBtn) {
        confirmDeleteFolderBtn.addEventListener('click', handleDeleteFolder);
    }

    // Event listener to close delete folder modal when clicking outside
    if (deleteFolderModal) {
        deleteFolderModal.addEventListener('click', function(event) {
            if (event.target === deleteFolderModal) {
                closeDeleteFolderModal();
            }
        });
    }

    function getCurrentSection() {
        if (folderContentsSection.style.display !== 'none') return 'folder';
        return 'folders';
    }

    if (mainBackBtn) {
        mainBackBtn.addEventListener('click', function() {
            const section = getCurrentSection();
            if (section === 'folder') {
                // من قائمة الملفات إلى قائمة المجلدات
                folderContentsSection.style.display = 'none';
                foldersSection.style.display = 'block';
                backToFilesContainer.style.display = 'none'; // Hide the back to files button
            } else {
                // من قائمة المجلدات إلى الأقسام (departmens.html)
                window.location.href = 'departments.html';
            }
        });
    }

    // معالجة معرف القسم من الـ URL عند تحميل الصفحة
    const urlParams = new URLSearchParams(window.location.search);
    const departmentIdFromUrl = urlParams.get('departmentId');
    console.log('departmentIdFromUrl from URL params:', departmentIdFromUrl);

if (departmentIdFromUrl && isInitialFetch) {
  fetchFolders(departmentIdFromUrl);
  isInitialFetch = false;
}
 else {
        console.warn('departmentId not found in URL. Cannot fetch folders.');
    }

    // Function to go back to the previous page
    function goBack() {
        window.history.back();
    }

    // Function to handle content deletion
    async function handleDeleteContent() {
        let contentId = document.getElementById('deleteContentId').value.trim();
        contentId = contentId.replace(/[^\d]/g, ''); // 🔥 إزالة الرموز غير الرقمية
    
        console.log('handleDeleteContent: Deleting content with ID:', contentId);
    
        if (!contentId) {
            showToast('معرف المحتوى مفقود للحذف.', 'error');
            console.warn('handleDeleteContent: Missing content ID for deletion.');
            return;
        }
    
        try {
            const response = await fetch(`http://localhost:3006/api/contents/${contentId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                }
            });
    
            const data = await response.json();
    
            if (response.ok) {
                showToast(data.message || 'تم حذف المحتوى بنجاح!', 'success');
                closeDeleteContentModal();
                await fetchFolderContents(currentFolderId);
            } else {
                showToast(data.message || 'فشل حذف المحتوى.', 'error');
                console.error('Failed to delete content. Status:', response.status, 'Message:', data.message);
            }
        } catch (error) {
            console.error('Error deleting content:', error);
            showToast('حدث خطأ في الاتصال بحذف المحتوى.', 'error');
        }
    }
    



}); // End of DOMContentLoaded 


function showToast(message, type = 'info', duration = 3006) {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.classList.add('toast');
    if (type) {
        toast.classList.add(type);
    }
    toast.textContent = message;

    toastContainer.appendChild(toast);

    // Force reflow to ensure animation plays from start
    toast.offsetWidth; 

    // Set a timeout to remove the toast
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        // Remove element after animation completes
        setTimeout(() => {
            toast.remove();
        }, 500); // Should match CSS animation duration
    }, duration);
} 