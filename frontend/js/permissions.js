// This file will contain JavaScript for the user permissions page. 

document.addEventListener('DOMContentLoaded', function() {
    const addUserBtn = document.querySelector('.add-user-btn');
    const addUserModal = document.getElementById('addUserModal');
    const cancelAddUserBtn = document.getElementById('cancelAddUser');

    if (addUserBtn && addUserModal && cancelAddUserBtn) {
        addUserBtn.addEventListener('click', () => {
            addUserModal.style.display = 'flex';
        });

        cancelAddUserBtn.addEventListener('click', () => {
            addUserModal.style.display = 'none';
        });

        // Close the modal if user clicks outside of it
        window.addEventListener('click', (event) => {
            if (event.target === addUserModal) {
                addUserModal.style.display = 'none';
            }
        });
    }
}); 