// departments.js
// Add JavaScript specific to the departments page here

document.addEventListener('DOMContentLoaded', function() {
    // Get references to the add modal and buttons
    const addDepartmentBtn = document.querySelector('.controls-bar .btn-primary');
    const addDepartmentModal = document.getElementById('addDepartmentModal');
    const addModalCloseBtn = addDepartmentModal.querySelector('.modal-buttons .btn-secondary');
    const addModalSaveBtn = addDepartmentModal.querySelector('.modal-buttons .btn-primary');

    // Get references to the edit modal and buttons
    const editDepartmentModal = document.getElementById('editDepartmentModal');
    const editModalCloseBtn = editDepartmentModal.querySelector('.modal-buttons .btn-secondary');
    const editModalUpdateBtn = editDepartmentModal.querySelector('.modal-buttons .btn-primary');
    const editDepartmentNameInput = document.getElementById('editDepartmentName');
    const editDepartmentImageInput = document.getElementById('editDepartmentImage');

    // Get references to the delete modal and buttons
    const deleteDepartmentModal = document.getElementById('deleteDepartmentModal');
    const deleteModalCloseBtn = deleteDepartmentModal.querySelector('.modal-buttons .btn-secondary');
    const deleteModalConfirmBtn = deleteDepartmentModal.querySelector('.modal-buttons .btn-danger');

    // Get all department cards
    const departmentCards = document.querySelectorAll('.cards-grid .card');

    // Get all edit and delete icon links
    const editIcons = document.querySelectorAll('.card-icons .edit-icon');
    const deleteIcons = document.querySelectorAll('.card-icons .delete-icon');

    // Function to open the add modal
    function openAddModal() {
        addDepartmentModal.style.display = 'flex';
    }

    // Function to close the add modal
    function closeAddModal() {
        addDepartmentModal.style.display = 'none';
        // Optional: Clear form fields
        document.getElementById('departmentName').value = '';
        document.getElementById('departmentImage').value = '';
    }

    // Function to open the edit modal and populate data (placeholder)
    function openEditModal(departmentId) {
        editDepartmentModal.style.display = 'flex';
        // *** In a real application, fetch department data using departmentId and populate the form ***
        console.log('Editing department with ID:', departmentId);
        // Example of populating (replace with actual data fetching):
        // editDepartmentNameInput.value = 'Current Department Name';
        // Clear file input for security reasons (cannot set value of file input)
        // editDepartmentImageInput.value = '';
    }

    // Function to close the edit modal
    function closeEditModal() {
        editDepartmentModal.style.display = 'none';
        // Optional: Clear form fields
        editDepartmentNameInput.value = '';
        editDepartmentImageInput.value = '';
    }

     // Function to open the delete modal (placeholder)
    function openDeleteModal(departmentId) {
        deleteDepartmentModal.style.display = 'flex';
        // Optional: Store department ID to be deleted for confirmation
        deleteModalConfirmBtn.dataset.departmentId = departmentId; // Store ID on confirm button
         console.log('Opening delete modal for ID:', departmentId); // Placeholder
    }

    // Function to close the delete modal
    function closeDeleteModal() {
        deleteDepartmentModal.style.display = 'none';
        deleteModalConfirmBtn.dataset.departmentId = ''; // Clear stored ID
         console.log('Closing delete modal'); // Placeholder
    }

    // Event listener to open the add modal
    if (addDepartmentBtn) {
        addDepartmentBtn.addEventListener('click', openAddModal);
    }

    // Event listener to close the add modal (Cancel button)
    if (addModalCloseBtn) {
        addModalCloseBtn.addEventListener('click', closeAddModal);
    }

     // Event listener to close the add modal when clicking outside
    if (addDepartmentModal) {
        addDepartmentModal.addEventListener('click', function(event) {
            if (event.target === addDepartmentModal) {
                closeAddModal();
            }
        });
    }

    // Event listener for the 'حفظ' button in the add modal (placeholder)
    if (addModalSaveBtn) {
        addModalSaveBtn.addEventListener('click', function() {
            const departmentName = document.getElementById('departmentName').value;
            const departmentImage = document.getElementById('departmentImage').files[0];

            console.log('Add - Department Name:', departmentName);
            console.log('Add - Department Image:', departmentImage);

            // *** Add actual save logic here ***

            closeAddModal();
        });
    }

    // Event listeners to navigate to department content page when a department card is clicked
    departmentCards.forEach(card => {
        card.addEventListener('click', function() {
            const departmentId = this.getAttribute('data-id');
            // Navigate to the department content page, passing the department ID as a query parameter
            window.location.href = `department-content.html?id=${departmentId}`;
        });
    });

    // --- Edit Modal Event Listeners --- 

    // Event listeners to open the edit modal when an edit icon is clicked
    editIcons.forEach(icon => {
        icon.addEventListener('click', function(event) {
            event.preventDefault(); // Prevent default link behavior
            event.stopPropagation(); // Prevent click from bubbling to card
            const departmentId = this.getAttribute('data-id');
            if (departmentId) {
                openEditModal(departmentId);
            }
        });
    });

    // Event listener to close the edit modal (Cancel button)
    if (editModalCloseBtn) {
        editModalCloseBtn.addEventListener('click', closeEditModal);
    }

     // Event listener to close the edit modal when clicking outside
    if (editDepartmentModal) {
        editDepartmentModal.addEventListener('click', function(event) {
            if (event.target === editDepartmentModal) {
                closeEditModal();
            }
        });
    }

    // Event listener for the 'تحديث' button in the edit modal (placeholder)
    if (editModalUpdateBtn) {
        editModalUpdateBtn.addEventListener('click', function() {
            const departmentName = editDepartmentNameInput.value;
            const departmentImage = editDepartmentImageInput.files[0];

            console.log('Edit - Department Name:', departmentName);
            console.log('Edit - Department Image:', departmentImage);

            // *** Add actual update logic here ***
            // You'll need the departmentId here as well

            closeEditModal();
        });
    }

    // --- Delete Modal Event Listeners --- 

    // Event listeners to open the delete modal when a delete icon is clicked
    deleteIcons.forEach(icon => {
        icon.addEventListener('click', function(event) {
             event.preventDefault(); // Prevent default link behavior
             event.stopPropagation(); // Prevent click from bubbling to card
            const departmentId = this.getAttribute('data-id');
            if (departmentId) {
                openDeleteModal(departmentId);
            }
        });
    });

    // Event listener to close the delete modal (Cancel button)
    if (deleteModalCloseBtn) {
        deleteModalCloseBtn.addEventListener('click', closeDeleteModal);
    }

     // Event listener to close the delete modal when clicking outside
    if (deleteDepartmentModal) {
        deleteDepartmentModal.addEventListener('click', function(event) {
            if (event.target === deleteDepartmentModal) {
                closeDeleteModal();
            }
        });
    }

    // Event listener for the 'حذف نهائي' button in the delete modal (placeholder)
    if (deleteModalConfirmBtn) {
        deleteModalConfirmBtn.addEventListener('click', function() {
            const departmentId = this.dataset.departmentId; // Get stored ID
            console.log('Delete - Confirm delete action for ID:', departmentId);

            // *** Add actual delete logic here using departmentId ***

            closeDeleteModal();
        });
    }

});

// Function to go back to the previous page
function goBack() {
    window.history.back();
} 