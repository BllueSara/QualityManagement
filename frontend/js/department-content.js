document.addEventListener('DOMContentLoaded', function() {
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

    // Function to open the Add Folder modal
    function openAddFolderModal() {
        if (addFolderModal) {
            addFolderModal.style.display = 'flex';
        }
    }

    // Function to close the Add Folder modal
    function closeAddFolderModal() {
        if (addFolderModal) {
            addFolderModal.style.display = 'none';
            // Optional: Clear form fields here
            // document.getElementById('folderName').value = '';
            // document.getElementById('folderFile').value = '';
        }
    }

    // Function to handle Create Folder (placeholder)
    function handleCreateFolder() {
        const folderName = document.getElementById('folderName').value;
        const folderFile = document.getElementById('folderFile').files[0];

        console.log('Creating Folder:');
        console.log('Name:', folderName);
        console.log('File:', folderFile);

        // *** Add actual folder creation logic here (e.g., send data to backend) ***

        // Close the modal after attempting to create
        closeAddFolderModal();
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

    // Function to handle Create Content (placeholder)
    function handleCreateContent() {
        const contentTitle = document.getElementById('contentTitle').value;
        const contentFile = document.getElementById('contentFile').files[0];
        const contentNotes = document.getElementById('contentNotes').value;

        console.log('Creating Content:');
        console.log('Title:', contentTitle);
        console.log('File:', contentFile);
        console.log('Notes:', contentNotes);

        // *** Add actual content creation logic here (e.g., send data to backend, include folder ID) ***

        // Close the modal after attempting to create
        closeAddContentModal();
    }

    // --- Edit/Delete Modal Functions --- 

    function openEditFolderModal(folderId) {
        console.log('Opening edit modal for folder:', folderId);
         if (editFolderModal) {
             // *** In a real application, fetch folder data using folderId and populate the form ***
             editFolderIdInput.value = folderId; // Store ID
             // editFolderNameInput.value = 'Current Folder Name';
             // editFolderFileInput.value = ''; // Clear file input
             editFolderModal.style.display = 'flex';
         }
    }

    function closeEditFolderModal() {
         if (editFolderModal) {
             editFolderModal.style.display = 'none';
             // Optional: Clear form fields
             editFolderIdInput.value = '';
             editFolderNameInput.value = '';
             editFolderFileInput.value = '';
         }
    }

     function handleUpdateFolder() {
         const folderId = editFolderIdInput.value; // Get stored ID
         const folderName = editFolderNameInput.value;
         const folderFile = editFolderFileInput.files[0];

         console.log('Updating Folder:', folderId);
         console.log('New Name:', folderName);
         console.log('New File:', folderFile);

         // *** Add actual update logic here ***

         closeEditFolderModal();
     }

    function openDeleteFolderModal(folderId) {
         console.log('Opening delete modal for folder:', folderId);
         // *** Add logic to show delete confirmation modal for folder ***
         // You will need a delete folder modal HTML structure similar to the delete department modal.
         // Store folderId in the delete confirmation modal's confirm button data attribute.
         // Open the delete confirmation modal.
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
         const contentFile = editContentFileInput.files[0];
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

    // عند تحميل الصفحة: تحقق إذا كان هناك مجلد محفوظ في localStorage
    const lastOpenedFolder = localStorage.getItem('lastOpenedFolder');
    if (lastOpenedFolder) {
        // ابحث عن بطاقة المجلد المطابقة وافتحها تلقائيًا
        const card = document.querySelector(`.folder-card[data-folder-id="${lastOpenedFolder}"]`);
        if (card) {
            const folderName = card.getAttribute('data-folder-name');
            folderContentTitle.textContent = `محتويات ${folderName}`;
            foldersSection.style.display = 'none';
            folderContentsSection.style.display = 'block';
        } else {
            // إذا لم يوجد المجلد لأي سبب، امسح القيمة
            localStorage.removeItem('lastOpenedFolder');
        }
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

    // عند الضغط على زر الرجوع من الملفات إلى المجلدات
    if (backToFoldersBtn) {
        backToFoldersBtn.addEventListener('click', function() {
            foldersSection.style.display = 'block';
            folderContentsSection.style.display = 'none';
            fileDetailsSection.style.display = 'none';
            backToFoldersContainer.style.display = 'none';
            backToFilesContainer.style.display = 'none';
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

    // Event listeners for folder edit icons
    folderEditIcons.forEach(icon => {
        icon.addEventListener('click', function(event) {
            event.preventDefault(); // Prevent default link behavior
            event.stopPropagation(); // Prevent click from bubbling to folder card
            const folderId = this.getAttribute('data-id');
            if (folderId) {
                openEditFolderModal(folderId); // Call placeholder function
            }
        });
    });

    // Event listeners for folder delete icons
    folderDeleteIcons.forEach(icon => {
        icon.addEventListener('click', function(event) {
             event.preventDefault(); // Prevent default link behavior
             event.stopPropagation(); // Prevent click from bubbling to folder card
            const folderId = this.getAttribute('data-id');
            if (folderId) {
                openDeleteFolderModal(folderId); // Call placeholder function
            }
        });
    });

     // Event listeners for file edit icons
    fileEditIcons.forEach(icon => {
        icon.addEventListener('click', function(event) {
             event.preventDefault(); // Prevent default link behavior
             event.stopPropagation(); // Prevent click from bubbling to file item
            const contentId = this.getAttribute('data-id');
            if (contentId) {
                openEditContentModal(contentId); // Call placeholder function
            }
        });
    });

     // Event listeners for file delete icons
    fileDeleteIcons.forEach(icon => {
        icon.addEventListener('click', function(event) {
             event.preventDefault(); // Prevent default link behavior
             event.stopPropagation(); // Prevent click from bubbling to file item
            const contentId = this.getAttribute('data-id');
            if (contentId) {
                openDeleteContentModal(contentId); // Call placeholder function
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

    // Event listener for delete icons
    document.querySelectorAll('.delete-icon').forEach(icon => {
        icon.addEventListener('click', function(event) {
            event.preventDefault();
            const contentId = this.getAttribute('data-id');
            openDeleteContentModal(contentId);
        });
    });

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

    function getCurrentSection() {
        if (fileDetailsSection && fileDetailsSection.style.display !== 'none') return 'file';
        if (folderContentsSection && folderContentsSection.style.display !== 'none') return 'folder';
        return 'folders';
    }

    if (mainBackBtn) {
        mainBackBtn.addEventListener('click', function() {
            const section = getCurrentSection();
            if (section === 'file') {
                // من تفاصيل الملف إلى قائمة الملفات
                fileDetailsSection.style.display = 'none';
                folderContentsSection.style.display = 'block';
            } else if (section === 'folder') {
                // من قائمة الملفات إلى قائمة المجلدات
                folderContentsSection.style.display = 'none';
                foldersSection.style.display = 'block';
            } else {
                // من قائمة المجلدات إلى الأقسام
                window.location.href = 'departments.html';
            }
        });
    }

});

// Function to go back to the previous page
function goBack() {
    window.history.back();
} 