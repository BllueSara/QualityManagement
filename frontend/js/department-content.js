const apiBase      = 'http://localhost:3006/api';
let currentDepartmentId = null;
let currentFolderId     = null;
let currentFolderName   = null;
let currentDepartmentName = null;
let isOldContentMode = false;

// دالة لتسجيل عرض المحتوى في اللوقز
async function logContentView(contentId, contentTitle, folderName, departmentName) {
    try {
        const response = await fetch(`${apiBase}/logs/content-view`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contentId: contentId,
                contentTitle: contentTitle,
                folderName: folderName,
                departmentName: departmentName
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
  canAddContentName: false,
  canEditContent:  false,
  canEditContentName: false,
  canDeleteContent:false,
  canDeleteContentName:false,
  canAddOldContent: false
};
    function getToken() {
        const token = localStorage.getItem('token');
        return token;
    }
// 1) مصفوفة الأسماء والاختيار
let folderNames = [];
let selectedFolderId = null;
function getUserRoleFromToken() {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload).role; // يفترض أن الدور موجود في الحمولة كـ 'role'
  } catch (e) {
      console.error('Error decoding token:', e);
      return null;
  }
}
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
  // في عرض المجلدات (عند عدم وجود مجلدات)
  if (!list.length) {
    container.innerHTML = `<div class="no-content" data-translate="no-folders">${getTranslation('no-folders')}</div>`;
    return;
  }
  list.forEach(item => {
    const div = document.createElement('div');
    div.className = 'folder-item';

    const lang = localStorage.getItem('language') || 'ar';
    let folderDisplayName;
    try {
        const parsedName = JSON.parse(item.name);
        folderDisplayName = parsedName[lang] || parsedName.ar;
    } catch (e) {
        folderDisplayName = item.name; // Fallback for old data
    }

    div.innerHTML = `
      <span class="label">${folderDisplayName}</span>
      <span class="actions">
        ${permissions.canEditFolderName   ? `<button class="edit-name"   data-id="${item.id}" data-name='${item.name}'>✎</button>` : ''}
        ${permissions.canDeleteFolderName ? `<button class="delete-name" data-id="${item.id}">🗑</button>` : ''}
      </span>
    `;

    // 1) بدل ما نخلي الاختيار بس على الـ .label، نخلي السطر كله
    div.addEventListener('click', e => {
      // إذا ضغطت على زر تعديل أو حذف، نوقف هنا
      if (e.target.closest('.actions')) return;
      selectedFolderId = item.id;
      // نحدث نص الزر ونحافظ على السهم
      document.getElementById('folderNameToggle').innerHTML = `${folderDisplayName} <span class="arrow">▾</span>`;
      closeDropdown();
    });

    // 2) تعديل الاسم
    if (permissions.canEditFolderName) {
      div.querySelector('.edit-name').onclick = e => {
        e.stopPropagation();
        const folderNameId = item.id;
        const folderNameData = e.currentTarget.dataset.name;
        
        const editFolderNameModal = document.getElementById('editFolderNameModal');
        document.getElementById('editFolderNameId').value = folderNameId;

        try {
            const parsed = JSON.parse(folderNameData);
            document.getElementById('editFolderNameAr').value = parsed.ar || '';
            document.getElementById('editFolderNameEn').value = parsed.en || '';
        } catch (ex) {
            document.getElementById('editFolderNameAr').value = folderNameData;
            document.getElementById('editFolderNameEn').value = '';
        }

        editFolderNameModal.style.display = 'flex';
        closeDropdown(); // Close the dropdown list
      };
    }

    // 3) حذف الاسم
    if (permissions.canDeleteFolderName) {
      div.querySelector('.delete-name').onclick = e => {
        e.stopPropagation();
        const folderNameId = item.id;
        const deleteFolderNameModal = document.getElementById('deleteFolderNameModal');
        document.getElementById('deleteFolderNameId').value = folderNameId;
        deleteFolderNameModal.style.display = 'flex';
        closeDropdown();
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
    
    const lang = localStorage.getItem('language') || 'ar';
    let folderDisplayName;
    try {
        const parsedName = JSON.parse(item.name);
        folderDisplayName = parsedName[lang] || parsedName.ar;
    } catch (e) {
        folderDisplayName = item.name; // Fallback
    }

    div.innerHTML = `
      <span class="label">${folderDisplayName}</span>
      <span class="actions">
        ${permissions.canEditFolderName   ? `<button class="edit-name"   data-id="${item.id}" data-name='${item.name}'>✎</button>` : ''}
        ${permissions.canDeleteFolderName ? `<button class="delete-name" data-id="${item.id}">🗑</button>` : ''}
      </span>
    `;
    // اختيار السطر كلّه
    div.addEventListener('click', e => {
      if (e.target.closest('.actions')) return;
      selectedFolderId = item.id;
      document.getElementById('editFolderToggle').innerHTML =
        `${folderDisplayName} <span class="arrow">▾</span>`;
      // تخزين القيمة المختارة في الحقل المخفي
      document.getElementById('editSelectedFolderNameId').value = folderDisplayName;
      closeEditDropdown();
    });
    // تعديل اسم
    if (permissions.canEditFolderName) {
      div.querySelector('.edit-name').onclick = e => {
        e.stopPropagation();
        const folderNameId = item.id;
        const folderNameData = e.currentTarget.dataset.name;
        
        const editFolderNameModal = document.getElementById('editFolderNameModal');
        document.getElementById('editFolderNameId').value = folderNameId;

        try {
            const parsed = JSON.parse(folderNameData);
            document.getElementById('editFolderNameAr').value = parsed.ar || '';
            document.getElementById('editFolderNameEn').value = parsed.en || '';
        } catch (ex) {
            document.getElementById('editFolderNameAr').value = folderNameData;
            document.getElementById('editFolderNameEn').value = '';
        }

        editFolderNameModal.style.display = 'flex';
        closeEditDropdown();
      };
    }
    // حذف اسم
    if (permissions.canDeleteFolderName) {
      div.querySelector('.delete-name').onclick = e => {
        e.stopPropagation();
        const folderNameId = item.id;
        const deleteFolderNameModal = document.getElementById('deleteFolderNameModal');
        document.getElementById('deleteFolderNameId').value = folderNameId;
        deleteFolderNameModal.style.display = 'flex';
        closeEditDropdown();
      };
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
    const lang = localStorage.getItem('language') || 'ar';
    renderFolderNames(
      folderNames.filter(f => {
        try {
          const parsed = JSON.parse(f.name);
          return (parsed.ar && parsed.ar.toLowerCase().includes(q)) || (parsed.en && parsed.en.toLowerCase().includes(q));
        } catch (e) {
          return f.name.toLowerCase().includes(q);
        }
      })
    );
  });
  
if (permissions.canAddFolderName) {
  addLink.classList.remove('hidden');
  addLink.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('addFolderNameModal').style.display = 'flex';
    closeDropdown();
  });
}
 else {
    addLink.classList.add('hidden');
  }

menu.addEventListener('click', async e => {
  if (!e.target.closest('#addNewFolderNameLink')) return;

  e.stopPropagation();
  e.preventDefault();

  document.getElementById('addFolderNameModal').style.display = 'flex';
  closeDropdown();
});


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
      folderNames.filter(f => {
        try {
          const parsed = JSON.parse(f.name);
          return (parsed.ar && parsed.ar.toLowerCase().includes(q)) || (parsed.en && parsed.en.toLowerCase().includes(q));
        } catch (e) {
          return f.name.toLowerCase().includes(q);
        }
      })
    );
});
edtAddLink.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('addFolderNameModal').style.display = 'flex';
    closeEditDropdown();
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

  if (keys.includes('add_old_content'))    permissions.canAddOldContent    = true;
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
      `${apiBase}/departments/${departmentId}/folders`,
      { headers: { 'Authorization': `Bearer ${getToken()}` } }
    );
    const data = await response.json();
    window._lastFoldersData = data.data;

    if (!response.ok) {
      showToast(data.message || 'فشل جلب مجلدات القسم.', 'error');
      console.error('Failed to fetch folders:', data);
      return;
    }

    const foldersList = document.querySelector('.folders-list');
    foldersList.innerHTML = '';
    folderContentTitle.textContent = data.departmentName || 'مجلدات القسم';
    currentDepartmentName = data.departmentName || 'قسم';

    if (data.data.length) {
      const lang = localStorage.getItem('language') || 'ar';

      data.data.forEach(folder => {
        // فكّ الـ JSON واختيار الاسم حسب اللغة
        let displayName = folder.name;
        try {
          const parsed = JSON.parse(folder.name);
          displayName = parsed[lang] || parsed.ar;
        } catch (e) {
          // لو الاسم نص عادي اتركه كما هو
        }

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
             <div class="folder-name">${displayName}</div>
           </div>`;

        foldersList.appendChild(card);

        // فتح المحتويات
        card.addEventListener('click', e => {
          if (!e.target.closest('.edit-icon') && !e.target.closest('.delete-icon')) {
            fetchFolderContents(folder.id);
          }
        });

        // ربط أيقونات التعديل والحذف كما كان
        if (permissions.canEditFolder) {
          const editIcon = card.querySelector('.edit-icon');
          editIcon?.addEventListener('click', e => {
            e.preventDefault(); e.stopPropagation();
            openEditFolderModal(folder.id);
          });
        }
        if (permissions.canDeleteFolder) {
          const deleteIcon = card.querySelector('.delete-icon');
          deleteIcon?.addEventListener('click', e => {
            e.preventDefault(); e.stopPropagation();
            openDeleteFolderModal(folder.id);
          });
        }
      });
    } else {
      foldersList.innerHTML =
        `<div class="no-content" data-translate="no-folders">${getTranslation('no-folders')}</div>`;
    }
  } catch (err) {
    console.error('Error fetching folders:', err);
    showToast('حدث خطأ في الاتصال بجلب مجلدات القسم.', 'error');
  }
  // بعد جلب البيانات:
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
            window._lastFilesData = data.data;
            if (response.ok) {
                const filesList = document.querySelector('.files-list');
                filesList.innerHTML = '';
                
                // استخراج اسم المجلد حسب اللغة
                let displayFolderName = data.folderName;
                try {
                    const parsedFolderName = JSON.parse(data.folderName);
                    const lang = localStorage.getItem('language') || 'ar';
                    displayFolderName = parsedFolderName[lang] || parsedFolderName.ar || data.folderName;
                } catch (e) {
                    displayFolderName = data.folderName;
                }
                
                folderContentTitle.textContent = displayFolderName;
                currentFolderName = displayFolderName; // حفظ اسم المجلد الحالي

                if (data.data && data.data.length > 0) {
                    data.data.forEach(content => {
const key = content.is_approved
  ? 'status-approved'
  : 'status-awaiting';
const approvalStatus = getTranslation(key);
                        const approvalClass = content.is_approved ? 'approved' : 'pending';
                        
                        // عرض العنوان حسب اللغة المختارة
                        let displayTitle;
                        try {
                          const parsedTitle = JSON.parse(content.title);
                          const lang = localStorage.getItem('language') || 'ar';
                          displayTitle = parsedTitle[lang] || parsedTitle.ar || content.title;
                        } catch (e) {
                          displayTitle = content.title; // Fallback for old data
                        }
                        
                        // 1) بنية الأيقونات حسب الصلاحيات
                                let expiredBadge = '';
        // --- بادج برتقالي إذا باقي شهر أو أقل ---
        let soonExpireBadge = '';
if (content.end_date) {
  const now = new Date();
  const endDate = new Date(content.end_date);
  const diffMs = endDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  console.log(`🎯 ${content.title} → diffDays=${diffDays} expired=${content.extra?.expired}`);

  // 🔥 برتقالي يظهر دائمًا إذا باقي 0-30
  if (diffDays <= 30 && diffDays >= 0) {
    soonExpireBadge = `<span class="soon-expire-badge" style="color: #fff; background: orange; border-radius: 4px; padding: 2px 8px; margin-right: 8px; font-size: 12px;">${getTranslation('soon-expire') || 'اقترب انتهاء الصلاحية'}</span>`;
      console.log("🟠 showing soonExpireBadge for:", displayTitle);

  }

  // 🔥 أحمر يظهر فقط لو extra.expired = true (يرجعه السيرفر للأدمن فقط)
  if (content.extra && content.extra.expired) {
    expiredBadge = `<span class="expired-badge" style="color: #fff; background: #d9534f; border-radius: 4px; padding: 2px 8px; margin-right: 8px; font-size: 12px;">${getTranslation('expired-content') || 'منتهي الصلاحية'}</span>`;
  }
}

let icons = '<div class="item-icons">';
icons += expiredBadge + soonExpireBadge;

if (permissions.canEditContent) {
  icons += `<a href="#" class="edit-icon" data-id="${content.id}">
              <img src="../images/edit.svg" alt="تعديل">
            </a>`;
}
if (permissions.canDeleteContent) {
  icons += `<a href="#" class="delete-icon" data-id="${content.id}">
              <img src="../images/delet.svg" alt="حذف">
            </a>`;
}
icons += '</div>';
        

        // 2) أنشئ العنصر
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';

          const rawDate = content.end_date;              // "2025-06-30T21:00:00.000Z"
  const displayDate = rawDate.split('T')[0];     // "2025-06-30"
        fileItem.innerHTML = `
          ${icons}
          <img src="../images/pdf.svg" alt="ملف PDF">
          <div class="file-info">
            <div class="file-name">${displayTitle}</div>
            <div class="approval-status ${approvalClass}">${approvalStatus}</div>
            <div class="file-date">${displayDate}</div>
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
                                    // تسجيل عرض المحتوى في اللوقز
                                    logContentView(content.id, displayTitle, currentFolderName, currentDepartmentName);
                                    
                                    const fullFileUrl = `http://localhost:3006/uploads/${content.fileUrl}`;
                                    window.open(fullFileUrl, '_blank');
                                } else {
                                    showToast(getTranslation('pdf-only'), 'error'); 
                                }
                            }
                        });
                    });
                } else {
                    filesList.innerHTML = `<div class="no-content" data-translate="no-contents">${getTranslation('no-contents')}</div>`;
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
  // مسح القيمة المختارة من الدروبداون
  selectedFolderId = null;
  // إعادة زر الدروبداون لوضعه الافتراضي
  document.getElementById('folderNameToggle').innerHTML = `${getTranslation('choose-from-list')} <span class="arrow">▾</span>`;
  // مسح البحث
  document.getElementById('folderNameSearch').value = '';
  // إغلاق الدروبداون
  closeDropdown();
}
    // Function to handle Create Folder
    async function handleCreateFolder() {
        const folderName = document.getElementById('folderName').value;
        console.log('Attempting to create folder with name:', folderName, 'for departmentId:', currentDepartmentId);

        if (!currentDepartmentId || !folderName) {
            showToast(getTranslation('folder-name-required'), 'error');
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
                showToast(getTranslation('folder-added-success'), 'success');
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

    // Function to handle file selection and display file name
    function handleFileSelection(inputElement) {
        const fileDropArea = inputElement.closest('.file-drop-area');
        const fileUploadText = fileDropArea.querySelector('.file-upload-text');
        
        if (inputElement.files.length > 0) {
            const file = inputElement.files[0];
            
            // التحقق من نوع الملف
            if (file.type !== 'application/pdf') {
                showToast(getTranslation('pdf-only'), 'error');
                inputElement.value = ''; // مسح الملف المختار
                fileUploadText.innerHTML = '<span class="supported-files">ملفات PDF فقط</span>';
                fileDropArea.classList.remove('has-file');
                return;
            }

            const fileName = file.name;
fileUploadText.innerHTML = `
  <span 
    class="selected-file" 
    data-translate="selected-file"
  >
    ${getTranslation('selected-file')}: ${fileName}
  </span>
`;
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
        
        // مسح الحقول
        const folderIdInput = document.getElementById('addContentFolderId');
        if (folderIdInput) folderIdInput.value = '';
        
        document.getElementById('contentFile').value = '';
        
        const startDateInput = document.getElementById('contentStartDate');
        if (startDateInput) startDateInput.value = '';
        
        const endDateInput = document.getElementById('contentEndDate');
        if (endDateInput) endDateInput.value = '';

        // إعادة منطقة رفع الملفات
        const fileDropArea = document.querySelector('#addContentModal .file-drop-area');
        if (fileDropArea) {
            const fileUploadText = fileDropArea.querySelector('.file-upload-text');
            if (fileUploadText) {
                fileUploadText.innerHTML = `
                  <span 
                    class="supported-files" 
                    data-translate="supported-files"
                  >
                    ${getTranslation('supported-files')}
                  </span>
                `;
            }
            fileDropArea.classList.remove('has-file');
        }
    }
}


    // --- Edit/Delete Modal Functions ---

async function openEditFolderModal(folderId) {
  selectedFolderId = null; // علشان تبدأ نظيف

  // 1) جلب بيانات المجلد
  const res = await fetch(`${apiBase}/folders/${folderId}`, {
    headers: { 'Authorization': `Bearer ${getToken()}` }
  });
  const { data: folderData } = await res.json();
  if (!res.ok) {
    return showToast(getTranslation('folder-fetch-error'), 'error');
  }

  // 2) حدّد القسم الحالي
  currentDepartmentId = folderData.department_id;

  // 3) خذ الاسم
  const rawName = folderData.title;
  if (typeof rawName !== 'string') {
    console.error('rawName غير نصّي:', rawName);
    return showToast('خطأ داخلي: لا يمكن عرض الاسم', 'error');
  }

  // 4) فك JSON
  let displayName, targetObj;
  try {
    targetObj = JSON.parse(rawName);
    const lang = localStorage.getItem('language') || 'ar';
    displayName = targetObj[lang] || targetObj.ar || rawName;
  } catch {
    displayName = rawName;
  }

  // 5) تأكد من تحميل القوالب
  if (!folderNames.length) {
    await loadFolderNames();
  }

  // 6) ابحث عن القالب
  let matchedTemplate = null;
  if (targetObj) {
    matchedTemplate = folderNames.find(t => {
      try {
        const obj = JSON.parse(t.name);
        return obj.ar === targetObj.ar && obj.en === targetObj.en;
      } catch {
        return false;
      }
    });
  }

  // 7) حدد selectedFolderId
  selectedFolderId = matchedTemplate ? matchedTemplate.id : folderData.id;
  if (!matchedTemplate) {
    console.warn('لم أجد قالب يطابق الاسم؛ ستستخدم نصّاً حُرّاً');
  }

  // ✅ الآن نرسم القوائم (بدون ما نلمس الزر داخلها)
  renderEditFolderNames(folderNames);

  // 8) أظهر المودال
  if (editFolderModal) {
    editFolderModal.style.display = 'flex';
    // حفظ الـ ID في الحقل المخفي
    document.getElementById('editFolderId').value = folderId;
  }

  // ✅ وأخيراً، الآن فقط عيّن الاسم على الزر
  const toggle = document.getElementById('editFolderToggle');
  if (toggle) {
    toggle.innerHTML = `${displayName} <span class="arrow">▾</span>`;
  }
  
  // تخزين القيمة المختارة في الحقل المخفي
  document.getElementById('editSelectedFolderNameId').value = displayName;
}




function closeEditFolderModal() {
  if (editFolderModal) {
    // إخفاء المودال
    editFolderModal.style.display = 'none';
    // مسح الـ ID المخفي
    document.getElementById('editFolderId').value = '';
    // مسح الاسم المختار المخفي
    document.getElementById('editSelectedFolderNameId').value = '';
    // إعادة زرّ الدروبداون لوضعه الافتراضي
    document.getElementById('editFolderToggle').innerHTML =
      'اختر من القائمة... <span class="arrow">▾</span>';
    // تأكد إن قائمة الاختيار مقفولة
    closeEditDropdown();
  }
}


async function handleUpdateFolder() {
  const folderId = document.getElementById('editFolderId').value;
  const selectedFolderNameId = document.getElementById('editSelectedFolderNameId').value;
  
  // استخدم القيمة المختارة من الدروبداون بدلاً من نص الزر
  const folderName = selectedFolderNameId;

  // لو المستخدم ما اختار اسم، أو تركها "اختر من القائمة"
  if (
    !folderId ||
    !folderName ||
    folderName.includes('اختر') || 
    folderName.includes('Choose') ||
    folderName === ''
  ) {
    showToast(getTranslation('select-folder'), 'error');
    return;
  }

  // ابحث عن القالب الأصلي الذي يحتوي على الاسم باللغتين
  let namePayload;
  const selectedTemplate = folderNames.find(template => {
    try {
      const parsed = JSON.parse(template.name);
      const lang = localStorage.getItem('language') || 'ar';
      const displayName = parsed[lang] || parsed.ar;
      return displayName === folderName;
    } catch (e) {
      return template.name === folderName;
    }
  });

  if (selectedTemplate) {
    // استخدم البيانات الأصلية من القالب
    try {
      namePayload = JSON.parse(selectedTemplate.name);
    } catch (e) {
      // لو فشل في فك JSON، استخدم الاسم كما هو
      namePayload = { ar: folderName, en: folderName };
    }
  } else {
    // لو لم نجد قالب، استخدم الاسم المختار في اللغتين
    namePayload = { ar: folderName, en: folderName };
  }

  try {
    const res = await fetch(`${apiBase}/folders/${folderId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: namePayload })
    });

    const data = await res.json();

    if (res.ok) {
      showToast(getTranslation('folder-updated-success'), 'success');
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

    // --- Folder Name Modals ---
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
                showToast(getTranslation('all-fields-required'), 'error');
                return;
            }
    
            const name = JSON.stringify({ ar: nameAr, en: nameEn });
    
            try {
                const response = await fetch(`${apiBase}/departments/${currentDepartmentId}/folders/folder-names`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${getToken()}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ name })
                });
                const data = await response.json();
                if (response.ok) {
                    showToast(getTranslation('folder-added-success'), 'success');
                    closeAddFolderNameModal();
                    await loadFolderNames();
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
                showToast(getTranslation('all-fields-required'), 'error');
                return;
            }
    
            const name = JSON.stringify({ ar: nameAr, en: nameEn });
    
            try {
                const response = await fetch(`${apiBase}/departments/${currentDepartmentId}/folders/folder-names/${id}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${getToken()}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ name })
                });
                const data = await response.json();
                if (response.ok) {
                    showToast(getTranslation('folder-updated-success'), 'success');
                    closeEditFolderNameModal();
                    await loadFolderNames();
                    renderEditFolderNames(folderNames); // Re-render the list in the edit modal if it's open
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
                const response = await fetch(`${apiBase}/departments/${currentDepartmentId}/folders/folder-names/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${getToken()}` }
                });
                const data = await response.json();
                if (response.ok) {
                    showToast(getTranslation('folder-deleted-success'), 'success');
                    closeDeleteFolderNameModal();
                    const fId = folderNames.find(f => f.id === parseInt(id));
                    if (fId && selectedFolderId === fId.id) {
                        selectedFolderId = null;
                        const toggle = document.getElementById('folderNameToggle');
                        toggle.innerHTML = `${getTranslation('choose-from-list')} <span class="arrow">▾</span>`;
                    }
                    await loadFolderNames();
                    renderEditFolderNames(folderNames);
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


    async function handleDeleteFolder() {
        const folderId = deleteFolderIdInput.value;
        console.log('Deleting folder with ID:', folderId);

        if (!folderId) {
            showToast(getTranslation('missing-folder-id'), 'error');
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
  if (editContentModal) {
    try {
      const response = await fetch(`http://localhost:3006/api/contents/${contentId}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const data = await response.json();

      if (response.ok && data.data) {
        editContentIdInput.value = contentId;
        // فقط عيّن التواريخ إذا وجدت
        document.getElementById('editContentStartDate').value = data.data.start_date ? data.data.start_date.split('T')[0] : '';
        document.getElementById('editContentEndDate').value   = data.data.end_date   ? data.data.end_date.split('T')[0]   : '';
        // إعادة تعيين حقل الملف
        if (editContentFileInput) editContentFileInput.value = '';
        // إعادة منطقة رفع الملفات
        const fileDropArea = document.querySelector('#editContentModal .file-drop-area');
        if (fileDropArea) {
          const fileUploadText = fileDropArea.querySelector('.file-upload-text');
          if (fileUploadText) {
            fileUploadText.innerHTML = '<span class="supported-files">ملفات PDF فقط</span>';
          }
          fileDropArea.classList.remove('has-file');
        }
        // أظهر المودال
        editContentModal.style.display = 'flex';
      } else {
        showToast(data.message || 'فشل جلب بيانات المحتوى.', 'error');
      }
    } catch (error) {
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
        const contentFile = document.getElementById('editContentFile').files[0];
        // 🟢 حقول التواريخ
        const startDate = document.getElementById('editContentStartDate')?.value;
        const endDate   = document.getElementById('editContentEndDate')?.value;
        contentId = contentId.replace(/[^\d]/g, '');
        if (!contentId) {
          showToast(getTranslation('content-title-required'), 'error');
          return;
        }
        let fileName = '';
        if (contentFile) {
          fileName = contentFile.name;
          const dotIdx = fileName.lastIndexOf('.');
          if (dotIdx > 0) fileName = fileName.substring(0, dotIdx);
        }
        const formData = new FormData();
        if (fileName) formData.append('title', fileName);
        if (contentFile) formData.append('file', contentFile);
        if (startDate) formData.append('start_date', startDate);
        if (endDate)   formData.append('end_date', endDate);
        try {
          const response = await fetch(`http://localhost:3006/api/contents/${contentId}`, {
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
const toggle = document.getElementById('folderNameToggle');
toggle.innerHTML = `${getTranslation('choose-from-list')} <span class="arrow">▾</span>`;
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
    showToast(getTranslation('select-folder'), 'error');
    return;
  }

  // استخرج من array عنصر الاسم
  const chosen = folderNames.find(f => f.id === selectedFolderId);
  if (!chosen) return;

  // حول النص المخزّن (string) إلى كائن {ar, en}
  let namePayload;
  try {
    namePayload = JSON.parse(chosen.name);
  } catch (e) {
    // لو الاسم قديم (string عادي) حوّله لكائن بلغة عربية فقط
    namePayload = { ar: chosen.name, en: chosen.name };
  }

  try {
    const res = await fetch(
      `${apiBase}/departments/${currentDepartmentId}/folders`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type':  'application/json'
        },
        // ابعث الكائن مباشرة
        body: JSON.stringify({ name: namePayload })
      }
    );
    const data = await res.json();

    if (res.ok) {
      showToast(getTranslation('folder-added-success'), 'success');
      closeAddFolderModal();
      fetchFolders(currentDepartmentId);
    } else {
      showToast(data.message || 'فشل إضافة المجلد.', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('حدث خطأ في الاتصال.', 'error');
  }
};

  }

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
            showToast(getTranslation('missing-content-id'), 'error');
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
    
     // --- Folder Name Modals ---

    // 2) إضافة زر "إضافة محتوى قديم" بجانب زر إضافة محتوى عادي
    const addOldContentBtn = document.createElement('button');
    addOldContentBtn.className = 'btn-primary';
    addOldContentBtn.id = 'addOldContentBtn';
    addOldContentBtn.type = 'button';
addOldContentBtn.innerHTML =
  `<span data-translate="add-old-content">${getTranslation('add-old-content')}</span>`;
      addOldContentBtn.style.marginRight = '8px';
    
    // أضف الزر بجانب زر إضافة محتوى إذا كان للمستخدم الصلاحية
    const fileControlsBar = document.querySelector('.file-controls-bar');
    if (fileControlsBar) {
      // دالة جلب صلاحيات المستخدم
      function userCanAddOldContent() {
        const role = getUserRoleFromToken();
        if (role === 'admin') return true;
        // تحقق من الصلاحيات الإضافية
if (fileControlsBar && (getUserRoleFromToken() === 'admin' || permissions.canAddOldContent)) {
  fileControlsBar.insertBefore(addOldContentBtn, document.getElementById('addContentBtn'));
}

        return false;
      }
      if (userCanAddOldContent()) {
        fileControlsBar.insertBefore(addOldContentBtn, document.getElementById('addContentBtn'));
      }
    }
    
    // 3) عند الضغط على زر إضافة محتوى قديم
    addOldContentBtn.addEventListener('click', function() {
      isOldContentMode = true;
      openAddContentModal();
    });
    
    // 4) عند الضغط على زر إضافة محتوى عادي
    if (addContentBtn) {
      addContentBtn.addEventListener('click', function() {
        isOldContentMode = false;
        openAddContentModal();
      });
    }


}); // End of DOMContentLoaded 

// --- UI logic for alignment and dynamic elements (not translation) ---
// If you need to call applyLanguageUI(lang) from language.js, do so here if needed after dynamic content is rendered. 

// تحديث نص الزر الافتراضي
const folderNameToggleEl = document.getElementById('folderNameToggle');
if (folderNameToggleEl) folderNameToggleEl.innerHTML = `<span data-translate="choose-from-list">${getTranslation('choose-from-list')}</span> <span class="arrow">▾</span>`;
const editFolderToggleEl = document.getElementById('editFolderToggle');
if (editFolderToggleEl) editFolderToggleEl.innerHTML = `<span data-translate="choose-from-list">${getTranslation('choose-from-list')}</span> <span class="arrow">▾</span>`;


const backToFilesBtnEl = document.getElementById('backToFilesBtn');
if (backToFilesBtnEl) backToFilesBtnEl.innerHTML = `
  <img src="../images/Back.png" alt="رجوع" class="back-arrow-icon">
  <span data-translate="back-to-files">العودة للملفات</span>
`;

const addNewContentNameLinkEl = document.getElementById('addNewContentNameLink');
if (addNewContentNameLinkEl) addNewContentNameLinkEl.innerHTML = `<span data-translate="add-content-name">+ إضافة اسم جديد</span>`;
const editAddNewLinkEl = document.getElementById('editAddNewLink');
if (editAddNewLinkEl) editAddNewLinkEl.innerHTML = `<span data-translate="add-folder">إضافة مجلد+</span>`;
const editAddNewContentNameLinkEl = document.getElementById('editAddNewContentNameLink');
if (editAddNewContentNameLinkEl) editAddNewContentNameLinkEl.innerHTML = `<span data-translate="add-content-name">+ إضافة اسم جديد</span>`;

const addFolderModalHeader = document.querySelector('#addFolderModal .modal-header h3');
if (addFolderModalHeader) addFolderModalHeader.innerHTML = `<span data-translate="add-folder">إضافة مجلد</span>`;
const addContentModalHeader = document.querySelector('#addContentModal .modal-header h3');
if (addContentModalHeader) addContentModalHeader.innerHTML = `<span data-translate="add-content">إضافة محتوى للمجلد</span>`;
const editFolderModalHeader = document.querySelector('#editFolderModal .modal-header h3');
if (editFolderModalHeader) editFolderModalHeader.innerHTML = `<span data-translate="edit-folder">تعديل مجلد</span>`;
const editContentModalHeader = document.querySelector('#editContentModal .modal-header h3');
if (editContentModalHeader) editContentModalHeader.innerHTML = `<span data-translate="edit-content">تعديل محتوى للمجلد</span>`;
const deleteFolderModalHeader = document.querySelector('#deleteFolderModal .modal-header h3');
if (deleteFolderModalHeader) deleteFolderModalHeader.innerHTML = `<span data-translate="delete-folder-title">تأكيد حذف المجلد</span>`;
const deleteContentModalHeader = document.querySelector('#deleteContentModal .modal-header h3');
if (deleteContentModalHeader) deleteContentModalHeader.innerHTML = `<span data-translate="delete-content-title">تأكيد حذف المحتوى</span>`;

const createFolderBtnEl = document.getElementById('createFolderBtn');
if (createFolderBtnEl) createFolderBtnEl.innerHTML = `<span data-translate="create">إنشاء</span>`;
const cancelFolderBtnEl = document.getElementById('cancelFolderBtn');
if (cancelFolderBtnEl) cancelFolderBtnEl.innerHTML = `<span data-translate="cancel">إلغاء</span>`;
const createContentBtnEl = document.getElementById('createContentBtn');
if (createContentBtnEl) createContentBtnEl.innerHTML = `<span data-translate="add">إضافة</span>`;
const cancelContentBtnEl = document.getElementById('cancelContentBtn');
if (cancelContentBtnEl) cancelContentBtnEl.innerHTML = `<span data-translate="cancel">إلغاء</span>`;
const updateFolderBtnEl = document.getElementById('updateFolderBtn');
if (updateFolderBtnEl) updateFolderBtnEl.innerHTML = `<span data-translate="update">تحديث</span>`;
const cancelEditFolderBtnEl = document.getElementById('cancelEditFolderBtn');
if (cancelEditFolderBtnEl) cancelEditFolderBtnEl.innerHTML = `<span data-translate="cancel">إلغاء</span>`;
const updateContentBtnEl = document.getElementById('updateContentBtn');
if (updateContentBtnEl) updateContentBtnEl.innerHTML = `<span data-translate="update">تحديث</span>`;
const cancelEditContentBtnEl = document.getElementById('cancelEditContentBtn');
if (cancelEditContentBtnEl) cancelEditContentBtnEl.innerHTML = `<span data-translate="cancel">إلغاء</span>`;
const confirmDeleteFolderBtnEl = document.getElementById('confirmDeleteFolderBtn');
if (confirmDeleteFolderBtnEl) confirmDeleteFolderBtnEl.innerHTML = `<span data-translate="delete">حذف</span>`;
const cancelDeleteFolderBtnEl = document.getElementById('cancelDeleteFolderBtn');
if (cancelDeleteFolderBtnEl) cancelDeleteFolderBtnEl.innerHTML = `<span data-translate="cancel">إلغاء</span>`;
const confirmDeleteContentBtnEl = document.getElementById('confirmDeleteContentBtn');
if (confirmDeleteContentBtnEl) confirmDeleteContentBtnEl.innerHTML = `<span data-translate="delete">حذف</span>`;
const cancelDeleteContentBtnEl = document.getElementById('cancelDeleteContentBtn');
if (cancelDeleteContentBtnEl) cancelDeleteContentBtnEl.innerHTML = `<span data-translate="cancel">إلغاء</span>`;

const deleteFolderModalBodyP = document.querySelector('#deleteFolderModal .modal-body p');
if (deleteFolderModalBodyP) deleteFolderModalBodyP.innerHTML = `<span data-translate="delete-folder-confirm">${getTranslation('delete-folder-confirm')}</span>`;
const deleteContentModalBodyP = document.querySelector('#deleteContentModal .modal-body p');
if (deleteContentModalBodyP) deleteContentModalBodyP.innerHTML = `<span data-translate="delete-content-confirm">${getTranslation('delete-content-confirm')}</span>`;

// تحديث النصوص في رسائل النجاح والخطأ
const successMessages = {
  'folder-create': 'folder-create-success',
  'folder-update': 'folder-update-success',
  'folder-delete': 'folder-delete-success',
  'content-create': 'content-create-success',
  'content-update': 'content-update-success',
  'content-delete': 'content-delete-success',
  'content-approve': 'content-approve-success',
  'file-upload': 'file-upload-success'
};

const errorMessages = {
  'file-upload': 'file-upload-error',
  'general': 'error-occurred'
};

// تحديث دالة showToast لتستخدم الترجمات
window.showToast = function(message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  // استخدام الترجمة إذا كانت الرسالة موجودة في قائمة الترجمات
  const translationKey = type === 'success' ? successMessages[message] : 
                       type === 'error' ? errorMessages[message] : null;
  
  if (translationKey) {
    const lang = localStorage.getItem('language') || 'ar';
    const translatedMessage = translations[lang][translationKey];
    toast.textContent = translatedMessage || message;
  } else {
    toast.textContent = message;
  }

  document.getElementById('toast-container').appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, duration);
}; 
function showToast(message, type = 'info', duration = 3000) {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // تحديث نص الرسالة بناءً على الترجمة
    const translatedMessage = translations[localStorage.getItem('language') || 'ar'][message] || message;
    toast.textContent = translatedMessage;

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

window.translations = translations;

// 1) إضافة متغير وضع "محتوى قديم"


// 5) عند إرسال النموذج، أضف is_old_content إذا كان الوضع قديم
async function handleCreateContent() {
  const folderIdToUpload = document.getElementById('addContentFolderId')?.value;
  const contentFile      = document.getElementById('contentFile')?.files[0];
  // 🟢 حقول التواريخ
  const startDate = document.getElementById('contentStartDate')?.value;
  const endDate   = document.getElementById('contentEndDate')?.value;

  if (!folderIdToUpload || !contentFile) {
    showToast(getTranslation('select-content'), 'error');
    console.log('رفع محتوى:', {folderIdToUpload, contentFile});

    return;
  }

  // Extract file name without extension
  let fileName = contentFile.name;
  const dotIdx = fileName.lastIndexOf('.');
  if (dotIdx > 0) fileName = fileName.substring(0, dotIdx);

  const formData = new FormData();
  formData.append('title', fileName);
  formData.append('file', contentFile);
  if (isOldContentMode) formData.append('is_old_content', 'true');
  if (startDate) formData.append('start_date', startDate);
  if (endDate)   formData.append('end_date', endDate);

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

// --- ربط بحث الفولدرات والمحتوى (بحث مباشر على الكروت) ---

document.addEventListener('DOMContentLoaded', function() {
  // ... existing code ...

  // ربط بحث الفولدرات
  const folderSearchInput = document.querySelector('.folder-controls-bar .search-bar input');
  if (folderSearchInput) {
    folderSearchInput.addEventListener('input', function(e) {
      const q = e.target.value.trim().toLowerCase();
      // فلترة الفولدرات حسب الاسم (عربي أو إنجليزي)
      const lang = localStorage.getItem('language') || 'ar';
      // جلب كل عناصر الفولدرات من آخر تحميل
      const foldersList = document.querySelector('.folders-list');
      if (!foldersList) return;
      // احصل على البيانات الأصلية (من آخر fetch)
      if (typeof window._lastFoldersData === 'undefined') return;
      const filtered = window._lastFoldersData.filter(folder => {
        let displayName = folder.name;
        try {
          const parsed = JSON.parse(folder.name);
          displayName = parsed[lang] || parsed.ar || parsed.en || folder.name;
        } catch {}
        return displayName.toLowerCase().includes(q);
      });
      // إعادة رسم الفولدرات
      foldersList.innerHTML = '';
      if (filtered.length) {
        filtered.forEach(folder => {
          let displayName = folder.name;
          try {
            const parsed = JSON.parse(folder.name);
            displayName = parsed[lang] || parsed.ar || parsed.en || folder.name;
          } catch {}
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
               <div class="folder-name">${displayName}</div>
             </div>`;
          foldersList.appendChild(card);
          card.addEventListener('click', e => {
            if (!e.target.closest('.edit-icon') && !e.target.closest('.delete-icon')) {
              fetchFolderContents(folder.id);
            }
          });
          if (permissions.canEditFolder) {
            const editIcon = card.querySelector('.edit-icon');
            editIcon?.addEventListener('click', e => {
              e.preventDefault(); e.stopPropagation();
              openEditFolderModal(folder.id);
            });
          }
          if (permissions.canDeleteFolder) {
            const deleteIcon = card.querySelector('.delete-icon');
            deleteIcon?.addEventListener('click', e => {
              e.preventDefault(); e.stopPropagation();
              openDeleteFolderModal(folder.id);
            });
          }
        });
      } else {
        foldersList.innerHTML = `<div class="no-content" data-translate="no-folders">${getTranslation('no-folders')}</div>`;
      }
    });
  }

  // ربط بحث الملفات (المحتوى)
  const contentSearchInput = document.querySelector('.file-controls-bar .search-bar input');
  if (contentSearchInput) {
    contentSearchInput.addEventListener('input', function(e) {
      const q = e.target.value.trim().toLowerCase();
      const lang = localStorage.getItem('language') || 'ar';
      const filesList = document.querySelector('.files-list');
      if (!filesList) return;
      if (typeof window._lastFilesData === 'undefined') return;
      const filtered = window._lastFilesData.filter(content => {
        let displayTitle = content.title;
        try {
          const parsed = JSON.parse(content.title);
          displayTitle = parsed[lang] || parsed.ar || parsed.en || content.title;
        } catch {}
        return displayTitle.toLowerCase().includes(q);
      });
      filesList.innerHTML = '';
      if (filtered.length) {
        filtered.forEach(content => {
          const key = content.is_approved ? 'status-approved' : 'status-awaiting';
          const approvalStatus = getTranslation(key);
          const approvalClass = content.is_approved ? 'approved' : 'pending';
          let displayTitle = content.title;
          try {
            const parsedTitle = JSON.parse(content.title);
            displayTitle = parsedTitle[lang] || parsedTitle.ar || parsedTitle.en || content.title;
          } catch {}
          let icons = '';
          if (permissions.canEditContent || permissions.canDeleteContent) {
            icons = '<div class="item-icons">';
            if (permissions.canEditContent) {
              icons += `<a href="#" class="edit-icon" data-id="${content.id}"><img src="../images/edit.svg" alt="تعديل"></a>`;
            }
            if (permissions.canDeleteContent) {
              icons += `<a href="#" class="delete-icon" data-id="${content.id}"><img src="../images/delet.svg" alt="حذف"></a>`;
            }
            icons += '</div>';
          }
          const fileItem = document.createElement('div');
          fileItem.className = 'file-item';
          const rawDate = content.end_date;
          const displayDate = rawDate ? rawDate.split('T')[0] : '';
          fileItem.innerHTML = `
            ${icons}
            <img src="../images/pdf.svg" alt="ملف PDF">
            <div class="file-info">
              <div class="file-name">${displayTitle}</div>
              <div class="approval-status ${approvalClass}">${approvalStatus}</div>
              <div class="file-date">${displayDate}</div>
            </div>
          `;
          filesList.appendChild(fileItem);
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
          fileItem.addEventListener('click', function(e) {
            if (!e.target.closest('.edit-icon') && !e.target.closest('.delete-icon')) {
              if (content.fileUrl) {
                const fullFileUrl = `http://localhost:3006/uploads/${content.fileUrl}`;
                window.open(fullFileUrl, '_blank');
              } else {
                showToast(getTranslation('pdf-only'), 'error');
              }
            }
          });
        });
      } else {
        filesList.innerHTML = `<div class="no-content" data-translate="no-contents">${getTranslation('no-contents')}</div>`;
      }
    });
  }

});

// أضف مفتاح الترجمة للبادج البرتقالي
window.translations = window.translations || {};
['ar', 'en'].forEach(lang => {
  window.translations[lang] = window.translations[lang] || {};
  if (!window.translations[lang]['soon-expire']) {
    window.translations[lang]['soon-expire'] = lang === 'ar' ? 'اقترب انتهاء الصلاحية' : 'Expiring soon';
  }
});

// أضف الدالة بعد closeAddContentModal
function openAddContentModal() {
  if (addContentModal) {
    document.getElementById('addContentFolderId').value = currentFolderId;
    addContentModal.style.display = 'flex';
    // إعادة تعيين الحقول الأساسية
    document.getElementById('contentFile').value = '';
    // مسح التواريخ أيضاً
    const startDateInput = document.getElementById('contentStartDate');
    if (startDateInput) startDateInput.value = '';
    const endDateInput = document.getElementById('contentEndDate');
    if (endDateInput) endDateInput.value = '';

    const fileDropArea = document.querySelector('#addContentModal .file-drop-area');
    if(fileDropArea) {
        const fileUploadText = fileDropArea.querySelector('.file-upload-text');
        if(fileUploadText) {
            fileUploadText.innerHTML = `
              <span 
                class="supported-files" 
                data-translate="supported-files"
              >
                ${getTranslation('supported-files')}
              </span>
            `;
        }
        fileDropArea.classList.remove('has-file');
    }
  }
}
