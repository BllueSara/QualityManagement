document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded event fired in department-content.js');
    const foldersSection = document.querySelector('.folders-section');
    const folderContentsSection = document.querySelector('.folder-contents-section');
    const fileDetailsSection = document.querySelector('.file-details-section');
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
    const addContentCloseBtn = addContentModal ? addContentModal.querySelector('.close-button') : null;
    const cancelContentBtn = addContentModal ? addContentModal.querySelector('#cancelContentBtn') : null;
    const createContentBtn = addContentModal ? addContentModal.querySelector('#createContentBtn') : null;

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
    const cancelEditContentBtn = editContentModal ? editContentModal.querySelector('#cancelEditContentBtn') : null;
    const updateContentBtn = editContentModal ? editContentModal.querySelector('#updateContentBtn') : null;
    const editContentIdInput = document.getElementById('editContentId');
    const editContentTitleInput = document.getElementById('editContentTitle');
    const editContentFileInput = document.getElementById('editContentFile');
    const editContentNotesInput = document.getElementById('editContentNotes');

    // Get all edit and delete icons for folders
    const folderEditIcons = document.querySelectorAll('.folder-card .edit-icon');
    const folderDeleteIcons = document.querySelectorAll('.folder-card .delete-icon');

    // Get all edit and delete icons for files
    const fileEditIcons = document.querySelectorAll('.file-item .edit-icon');
    const fileDeleteIcons = document.querySelectorAll('.file-item .delete-icon');

    // أزرار الرجوع
    const backToFoldersBtn = document.getElementById('backToFoldersBtn');
    const backToFilesBtn = document.getElementById('backToFilesBtn');
    const backToFoldersContainer = document.getElementById('backToFoldersContainer');
    const backToFilesContainer = document.getElementById('backToFilesContainer');

    const mainBackBtn = document.getElementById('mainBackBtn');

    let currentDepartmentId = null; // متغير لتخزين معرف القسم الحالي
    let currentFolderId = null; // متغير لتخزين معرف المجلد الحالي

    // دالة لجلب التوكن من localStorage (مكررة، يمكن نقلها إلى shared.js)
    function getToken() {
        const token = localStorage.getItem('token');
        console.log('Token retrieved:', token ? 'Exists' : 'Not Found');
        return token;
    }

    // دالة لجلب مجلدات القسم بناءً على departmentId
    async function fetchFolders(departmentId) {
        console.log('Fetching folders for departmentId:', departmentId);
        currentDepartmentId = departmentId; // حفظ معرف القسم الحالي
        foldersSection.style.display = 'block';
        folderContentsSection.style.display = 'none';
        fileDetailsSection.style.display = 'none';
        backToFoldersContainer.style.display = 'none';
        backToFilesContainer.style.display = 'none';

        try {
            const response = await fetch(`http://localhost:3000/api/departments/${departmentId}/folders`, {
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                }
            });
            const data = await response.json();
            console.log('Fetch folders response status:', response.status);
            console.log('Fetch folders response data:', data);

            if (response.ok) {
                const foldersList = document.querySelector('.folders-list');
                foldersList.innerHTML = ''; // مسح المجلدات الحالية
                
                // تحديث عنوان القسم
                folderContentTitle.textContent = data.departmentName || 'مجلدات القسم';

                data.data.forEach(folder => {
                    const folderItem = document.createElement('div');
                    folderItem.className = 'folder-card';
                    folderItem.dataset.id = folder.id;
                    folderItem.innerHTML = `
                        <div class="item-icons">
                            <a href="#" class="edit-icon" data-id="${folder.id}"><img src="../images/edit.svg" alt="تعديل"></a>
                            <a href="#" class="delete-icon" data-id="${folder.id}"><img src="../images/delet.svg" alt="حذف"></a>
                        </div>
                        <img src="../images/folders.svg" alt="مجلد">
                        <div class="folder-info">
                            <div class="folder-name">${folder.name}</div>
                            <div class="folder-date">${new Date(folder.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                        </div>
                    `;
                    foldersList.appendChild(folderItem);

                    // إضافة event listener للنقر على المجلد
                    folderItem.addEventListener('click', function(e) {
                        if (!e.target.closest('.edit-icon') && !e.target.closest('.delete-icon')) {
                            const folderId = this.dataset.id;
                            console.log('Folder clicked, fetching contents for folderId:', folderId);
                            fetchFolderContents(folderId);
                        }
                    });
                });

                // إضافة event listeners لأيقونات التعديل والحذف
                document.querySelectorAll('.folder-card .edit-icon').forEach(icon => {
                    icon.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        const folderId = this.dataset.id;
                        openEditFolderModal(folderId);
                    });
                });

                document.querySelectorAll('.folder-card .delete-icon').forEach(icon => {
                    icon.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        const folderId = this.dataset.id;
                        openDeleteFolderModal(folderId);
                    });
                });
            } else {
                alert(data.message || 'فشل جلب مجلدات القسم.');
                console.error('Failed to fetch folders:', data.message);
            }
        } catch (error) {
            console.error('Error fetching folders:', error);
            alert('حدث خطأ في الاتصال بجلب مجلدات القسم.');
        }
    }

    // دالة لجلب محتويات المجلد بناءً على folderId
    async function fetchFolderContents(folderId) {
        currentFolderId = folderId; // حفظ معرف المجلد الحالي
        foldersSection.style.display = 'none';
        folderContentsSection.style.display = 'block';
        fileDetailsSection.style.display = 'none';
        backToFoldersContainer.style.display = 'block';
        backToFilesContainer.style.display = 'none';

        try {
            const response = await fetch(`http://localhost:3000/api/folders/${folderId}/contents`, {
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                }
            });
            const data = await response.json();

            if (response.ok) {
                const filesList = document.querySelector('.files-list');
                filesList.innerHTML = ''; // مسح المحتويات الحالية
                
                // تحديث عنوان المجلد
                folderContentTitle.textContent = data.folderName || 'محتويات المجلد';

                data.data.forEach(content => {
                    const fileItem = document.createElement('div');
                    fileItem.className = 'file-item';
                    fileItem.innerHTML = `
                        <div class="item-icons">
                            <a href="#" class="edit-icon" data-id="${content.id}"><img src="../images/edit.svg" alt="تعديل"></a>
                            <a href="#" class="delete-icon" data-id="${content.id}"><img src="../images/delet.svg" alt="حذف"></a>
                        </div>
                        <img src="../images/pdf.svg" alt="ملف PDF"> <!-- يجب تغيير الأيقونة بناءً على نوع الملف -->
                        <div class="file-info">
                            <div class="file-name">${content.title}</div>
                            <div class="file-date">${new Date(content.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                        </div>
                    `;
                    filesList.appendChild(fileItem);
                });

                // إعادة إضافة معالجات الأحداث لأيقونات التعديل والحذف بعد تحديث القائمة
                document.querySelectorAll('.file-item .edit-icon').forEach(icon => {
                    icon.addEventListener('click', function(event) {
                        event.preventDefault();
                        event.stopPropagation();
                        const contentId = this.getAttribute('data-id');
                        openEditContentModal(contentId);
                    });
                });

                document.querySelectorAll('.file-item .delete-icon').forEach(icon => {
                    icon.addEventListener('click', function(event) {
                        event.preventDefault();
                        event.stopPropagation();
                        const contentId = this.getAttribute('data-id');
                        openDeleteContentModal(contentId);
                    });
                });

            } else {
                alert(data.message || 'فشل جلب محتويات المجلد.');
            }
        } catch (error) {
            console.error('خطأ في جلب محتويات المجلد:', error);
            alert('حدث خطأ في الاتصال بجلب محتويات المجلد.');
        }
    }

    // Function to open the Add Folder modal
    function openAddFolderModal() {
        console.log('Add Folder button clicked. Opening modal.');
        if (addFolderModal) {
            addFolderModal.style.display = 'flex';
        }
    }

    // Function to close the Add Folder modal
    function closeAddFolderModal() {
        if (addFolderModal) {
            addFolderModal.style.display = 'none';
            document.getElementById('folderName').value = '';
        }
    }

    // Function to handle Create Folder
    async function handleCreateFolder() {
        const folderName = document.getElementById('folderName').value;
        console.log('Attempting to create folder with name:', folderName, 'for departmentId:', currentDepartmentId);

        if (!currentDepartmentId || !folderName) {
            alert('اسم المجلد مطلوب.');
            console.warn('Folder name or department ID is missing.');
            return;
        }

        try {
            const response = await fetch(`http://localhost:3000/api/departments/${currentDepartmentId}/folders`, {
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
                alert('تم إضافة المجلد بنجاح!');
                closeAddFolderModal();
                fetchFolders(currentDepartmentId); // Refresh the folder list
            } else {
                alert(data.message || 'فشل إضافة المجلد.');
                console.error('Failed to create folder:', data.message);
            }
        } catch (error) {
            console.error('Error creating folder:', error);
            alert('حدث خطأ في الاتصال بإضافة المجلد.');
        }
    }

    // Function to open the Add Content modal
    function openAddContentModal() {
        if (addContentModal) {
            addContentModal.style.display = 'flex';
             // Optional: You might want to get the current folder ID here to associate the content with it
             // const currentFolderId = ... ; 
        }
    }

    // Function to close the Add Content modal
    function closeAddContentModal() {
        if (addContentModal) {
            addContentModal.style.display = 'none';
            // Optional: Clear form fields here
            // document.getElementById('contentTitle').value = '';
            // document.getElementById('contentFile').value = '';
            // document.getElementById('contentNotes').value = '';
        }
    }

    // Function to handle Create Content
    async function handleCreateContent() { // جعل الدالة async
        const contentTitle = document.getElementById('contentTitle').value;
        const contentFile = document.getElementById('contentFile').files[0];
        const contentNotes = document.getElementById('contentNotes').value;

        if (!currentFolderId || !contentTitle || !contentFile) { // استخدام currentFolderId
            alert('عنوان المحتوى وملفه مطلوبان.');
            return;
        }

        const formData = new FormData();
        formData.append('title', contentTitle);
        formData.append('file', contentFile);
        formData.append('notes', contentNotes);

        try {
            const response = await fetch(`http://localhost:3000/api/folders/${currentFolderId}/contents`, { // استخدام currentFolderId في المسار
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                },
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                alert(data.message || 'تم إضافة المحتوى بنجاح.');
                closeAddContentModal();
                fetchFolderContents(currentFolderId); // تحديث القائمة بعد الإضافة
            } else {
                alert(data.message || 'حدث خطأ عند إضافة المحتوى.');
            }
        } catch (error) {
            console.error('خطأ في إضافة المحتوى:', error);
            alert('حدث خطأ في الاتصال عند إضافة المحتوى.');
        }
    }

    // --- Edit/Delete Modal Functions ---

    async function openEditFolderModal(folderId) {
        console.log('Opening edit modal for folder:', folderId);
         if (editFolderModal) {
             try {
                 const response = await fetch(`http://localhost:3000/api/folders/${folderId}`, {
                     headers: {
                         'Authorization': `Bearer ${getToken()}`
                     }
                 });
                 const data = await response.json();

                 if (response.ok && data.data) {
                     editFolderIdInput.value = folderId;
                     editFolderNameInput.value = data.data.name; // Fill with current folder name
                     editFolderModal.style.display = 'flex';
                 } else {
                     alert(data.message || 'فشل جلب بيانات المجلد.');
                     console.error('Failed to fetch folder data:', data.message);
                 }
             } catch (error) {
                 console.error('Error fetching folder data:', error);
                 alert('حدث خطأ في الاتصال بجلب بيانات المجلد.');
             }
         }
    }

    function closeEditFolderModal() {
         if (editFolderModal) {
             editFolderModal.style.display = 'none';
             // Optional: Clear form fields
             editFolderIdInput.value = '';
             editFolderNameInput.value = '';
             // editFolderFileInput.value = ''; // No longer relevant as file input was removed
         }
    }

     async function handleUpdateFolder() { // جعل الدالة async
         const folderId = editFolderIdInput.value; // Get stored ID
         const folderName = editFolderNameInput.value;

         console.log('Updating Folder:', folderId);
         console.log('New Name:', folderName);

         if (!folderId || !folderName) {
            alert('اسم المجلد مطلوب.');
            return;
         }

         try {
             const response = await fetch(`http://localhost:3000/api/folders/${folderId}`, {
                 method: 'PUT',
                 headers: {
                     'Authorization': `Bearer ${getToken()}`,
                     'Content-Type': 'application/json'
                 },
                 body: JSON.stringify({ name: folderName })
             });

             const data = await response.json();

             if (response.ok) {
                 alert(data.message || 'تم تحديث المجلد بنجاح!');
                 closeEditFolderModal();
                 fetchFolders(currentDepartmentId); // Refresh the folder list
             } else {
                 alert(data.message || 'فشل تحديث المجلد.');
                 console.error('Failed to update folder:', data.message);
             }
         } catch (error) {
             console.error('Error updating folder:', error);
             alert('حدث خطأ في الاتصال بتحديث المجلد.');
         }
     }

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
            alert('معرف المجلد مفقود للحذف.');
            return;
        }

        try {
            const response = await fetch(`http://localhost:3000/api/folders/${folderId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                alert(data.message || 'تم حذف المجلد بنجاح!');
                closeDeleteFolderModal();
                fetchFolders(currentDepartmentId); // Refresh the folder list
            } else {
                alert(data.message || 'فشل حذف المجلد.');
                console.error('Failed to delete folder:', data.message);
            }
        } catch (error) {
            console.error('Error deleting folder:', error);
            alert('حدث خطأ في الاتصال بحذف المجلد.');
        }
    }

     function openEditContentModal(contentId) {
         console.log('Opening edit modal for content:', contentId);
         if (editContentModal) {
             // *** In a real application, fetch content data using contentId and populate the form ***
             editContentIdInput.value = contentId; // Store ID
             // editContentTitleInput.value = 'Current Content Title';
             // editContentFileInput.value = ''; // Clear file input
             // editContentNotesInput.value = 'Current Notes';
             editContentModal.style.display = 'flex';
         }
    }

     function closeEditContentModal() {
         if (editContentModal) {
             editContentModal.style.display = 'none';
             // Optional: Clear form fields
             editContentIdInput.value = '';
             editContentTitleInput.value = '';
             editContentFileInput.value = '';
             editContentNotesInput.value = '';
         }
    }

     function handleUpdateContent() {
         const contentId = editContentIdInput.value; // Get stored ID
         const contentTitle = editContentTitleInput.value;
         const contentFile = document.getElementById('editContentFile').files[0];
         const contentNotes = editContentNotesInput.value;

         console.log('Updating Content:', contentId);
         console.log('New Title:', contentTitle);
         console.log('New File:', contentFile);
         console.log('New Notes:', contentNotes);

         // *** Add actual update logic here ***

         closeEditContentModal();
     }

    // Function to open the delete content modal
    function openDeleteContentModal(contentId) {
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
                fileDetailsSection.style.display = 'none';
                backToFoldersContainer.style.display = 'block';
                backToFilesContainer.style.display = 'none';
            });
        });
    }

    // عند الضغط على ملف
    if (folderContentsSection) {
        folderContentsSection.querySelectorAll('.file-item').forEach(item => {
            item.addEventListener('click', function(event) {
                // تجاهل الضغط على أيقونات التعديل/الحذف
                if (event.target.closest('.edit-icon') || event.target.closest('.delete-icon')) return;
                event.preventDefault();
                foldersSection.style.display = 'none';
                folderContentsSection.style.display = 'none';
                fileDetailsSection.style.display = 'block';
                backToFoldersContainer.style.display = 'none';
                backToFilesContainer.style.display = 'block';
            });
        });
    }

    // عند الضغط على زر الرجوع من تفاصيل الملف إلى قائمة الملفات
    if (backToFilesBtn) {
        backToFilesBtn.addEventListener('click', function() {
            foldersSection.style.display = 'none';
            folderContentsSection.style.display = 'block';
            fileDetailsSection.style.display = 'none';
            backToFoldersContainer.style.display = 'block';
            backToFilesContainer.style.display = 'none';
        });
    }

    // عند الضغط على زر الرجوع من الملفات إلى المجلدات (تم تعديله)
    if (backToFoldersBtn) {
        backToFoldersBtn.addEventListener('click', function() {
            // العودة إلى قائمة المجلدات للقسم الحالي
            if (currentDepartmentId) {
                fetchFolders(currentDepartmentId); // إعادة جلب المجلدات
            } else {
                // إذا لم يكن هناك departmentId، الرجوع إلى صفحة الأقسام
                window.location.href = 'departments.html';
            }
        });
    }

    // Event listener to open the Add Folder modal
    if (addFolderBtn) {
        addFolderBtn.addEventListener('click', openAddFolderModal);
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
        createFolderBtn.addEventListener('click', handleCreateFolder);
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

    // Event listener for the Create Content button
    if (createContentBtn) {
        createContentBtn.addEventListener('click', handleCreateContent);
    }

    // --- Event Listeners for Edit/Delete Icons --- (Assuming icons are added in HTML)

    // Event listeners for folder edit icons (يجب أن يتم إعادة إضافة هذه بعد جلب المجلدات)
    // folderEditIcons.forEach(icon => {
    //     icon.addEventListener('click', function(event) {
    //         event.preventDefault(); // Prevent default link behavior
    //         event.stopPropagation(); // Prevent click from bubbling to folder card
    //         const folderId = this.getAttribute('data-id');
    //         if (folderId) {
    //             openEditFolderModal(folderId); // Call placeholder function
    //         }
    //     });
    // });

    // Event listeners for folder delete icons (يجب أن يتم إعادة إضافة هذه بعد جلب المجلدات)
    // folderDeleteIcons.forEach(icon => {
    //     icon.addEventListener('click', function(event) {
    //          event.preventDefault(); // Prevent default link behavior
    //          event.stopPropagation(); // Prevent click from bubbling to folder card
    //         const folderId = this.getAttribute('data-id');
    //         if (folderId) {
    //             openDeleteFolderModal(folderId); // Call placeholder function
    //         }
    //     });
    // });

     // Event listeners for file edit icons (يجب أن يتم إعادة إضافة هذه بعد جلب المحتويات)
    // fileEditIcons.forEach(icon => {
    //     icon.addEventListener('click', function(event) {
    //          event.preventDefault(); // Prevent default link behavior
    //          event.stopPropagation(); // Prevent click from bubbling to file item
    //         const contentId = this.getAttribute('data-id');
    //         if (contentId) {
    //             openEditContentModal(contentId); // Call placeholder function
    //         }
    //     });
    // });

     // Event listeners for file delete icons (يجب أن يتم إعادة إضافة هذه بعد جلب المحتويات)
    // fileDeleteIcons.forEach(icon => {
    //     icon.addEventListener('click', function(event) {
    //          event.preventDefault(); // Prevent default link behavior
    //          event.stopPropagation(); // Prevent click from bubbling to file item
    //         const contentId = this.getAttribute('data-id');
    //         if (contentId) {
    //             openDeleteContentModal(contentId); // Call placeholder function
    //         }
    //     });
    // });

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

    // Event listener for delete icons (يجب أن يتم إعادة إضافة هذه بعد جلب المحتويات)
    // document.querySelectorAll('.delete-icon').forEach(icon => {
    //     icon.addEventListener('click', function(event) {
    //         event.preventDefault();
    //         const contentId = this.getAttribute('data-id');
    //         openDeleteContentModal(contentId);
    //     });
    // });

    // Event listener for close button in delete modal
    document.querySelector('#deleteContentModal .close-button').addEventListener('click', closeDeleteContentModal);

    // Event listener for cancel button in delete modal
    document.getElementById('cancelDeleteContentBtn').addEventListener('click', closeDeleteContentModal);

    // Event listener for confirm delete button in delete modal
    document.getElementById('confirmDeleteContentBtn').addEventListener('click', function() {
        const contentId = document.getElementById('deleteContentId').value;
        // Placeholder for delete logic
        console.log('Deleting content with ID:', contentId);
        closeDeleteContentModal();
    });

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
        if (fileDetailsSection && fileDetailsSection.style.display !== 'none') return 'file';
        if (folderContentsSection && folderContentsSection.style.display !== 'none') return 'folder';
        return 'folders'; // تم تعديل الافتراضي ليكون المجلدات
    }

    if (mainBackBtn) {
        mainBackBtn.addEventListener('click', function() {
            const section = getCurrentSection();
            if (section === 'file') {
                // من تفاصيل الملف إلى قائمة الملفات
                fileDetailsSection.style.display = 'none';
                folderContentsSection.style.display = 'block';
                backToFoldersContainer.style.display = 'block'; // اظهار زر الرجوع للمجلدات
                backToFilesContainer.style.display = 'none';
            } else if (section === 'folder') {
                // من قائمة الملفات إلى قائمة المجلدات
                folderContentsSection.style.display = 'none';
                foldersSection.style.display = 'block';
                backToFoldersContainer.style.display = 'none'; // اخفاء زر الرجوع للمجلدات
                backToFilesContainer.style.display = 'none';
            } else {
                // من قائمة المجلدات إلى الأقسام (departmens.html)
                window.location.href = 'departments.html';
            }
        });
    }

    // معالجة معرف القسم من الـ URL عند تحميل الصفحة
    const urlParams = new URLSearchParams(window.location.search);
    const departmentIdFromUrl = urlParams.get('departmentId');

    if (departmentIdFromUrl) {
        // إذا كان هناك معرف قسم في الـ URL، اعرض مجلدات القسم
        fetchFolders(departmentIdFromUrl);
    } else {
        console.warn('departmentId not found in URL. Cannot fetch folders.');
    }

});

// Function to go back to the previous page
function goBack() {
    window.history.back();
} 