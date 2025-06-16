// ... سيتم نسخ منطق الأقسام وتعديله ليعمل على اللجان ...
// مثال: fetch(`/api/committees/${committeeId}/folders`) بدلاً من الأقسام
// سيتم تضمين كل الدوال الخاصة بالإضافة والتعديل والحذف للمجلدات والمحتوى مع التعديلات اللازمة 

const apiBase = 'http://localhost:3006/api';
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
        const response = await fetch(`/api/committees/${committeeId}/folders`);
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
        const response = await fetch(`${apiBase}/committees/folders/${folderId}/contents`, {
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
        modal.style.display = 'none';
        document.getElementById('folderName').value = '';
    }

    function openEditFolderModal(folderId, folderName) {
        const modal = document.getElementById('editFolderModal');
        document.getElementById('editFolderId').value = folderId;
        document.getElementById('editFolderName').value = folderName;
        modal.style.display = 'flex';
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
        const name = document.getElementById('folderName').value;
        if (!name) {
            showToast('الرجاء إدخال اسم المجلد', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/committees/${currentCommitteeId}/folders`, {
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
        const folderId = document.getElementById('editFolderId').value;
        const newName = document.getElementById('editFolderName').value;
        if (!newName) {
            showToast('الرجاء إدخال اسم المجلد', 'error');
            return;
        }
        try {
            const response = await fetch(`/api/committees/folders/${folderId}`, {
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
            const response = await fetch(`/api/committees/folders/${folderId}`, {
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
        const contentTitle = document.getElementById('contentTitle').value;
        const contentFile = document.getElementById('contentFile').files[0];
        const contentNotes = document.getElementById('contentNotes') ? document.getElementById('contentNotes').value : '';
        // إذا عندك اختيار معتمدين
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
            const response = await fetch(`/api/committees/folders/${folderIdToUpload}/contents`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${getToken()}` }, // No Content-Type needed for FormData
                body: formData
            });

            if (response.ok) {
                closeAddContentModal();
                fetchFolderContents(currentFolderId);
                showToast('تم إضافة المحتوى بنجاح', 'success');
            } else {
                const data = await response.json();
                showToast(`فشل إضافة المحتوى: ${data.message||'خطأ'}`, 'error');
            }
        } catch (err) {
            console.error('Error creating content:', err);
            showToast('خطأ في الاتصال بالخادم أثناء الإضافة.', 'error');
        }
    }

    function openEditContentModal(contentId) {
        if (editContentModal) {
            try {
                fetch(`/api/committees/contents/${contentId}`, {
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
            const response = await fetch(`/api/committees/contents/${contentId}`, {
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
            const response = await fetch(`/api/committees/contents/${contentId}`, {
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