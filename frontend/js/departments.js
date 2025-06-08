// departments.js
// Add JavaScript specific to the departments page here

document.addEventListener('DOMContentLoaded', function() {
    // Get references to elements
    const addDepartmentBtn = document.getElementById('addDepartmentButton');
    const addDepartmentModal = document.getElementById('addDepartmentModal');
    const addModalSaveBtn = document.getElementById('saveAddDepartment');
    const addModalCancelBtn = document.getElementById('cancelAddDepartment');
    const addDepartmentNameInput = document.getElementById('departmentName');
    const addDepartmentImageInput = document.getElementById('departmentImage');
    const cardsGrid = document.querySelector('.cards-grid');

    const editDepartmentModal = document.getElementById('editDepartmentModal');
    const editModalSaveBtn = document.getElementById('saveEditDepartment');
    const editModalCancelBtn = document.getElementById('cancelEditDepartment');
    const editDepartmentIdInput = document.getElementById('editDepartmentId');
    const editDepartmentNameInput = document.getElementById('editDepartmentName');
    const editDepartmentImageInput = document.getElementById('editDepartmentImage');

    const deleteDepartmentModal = document.getElementById('deleteDepartmentModal');
    const deleteModalConfirmBtn = document.getElementById('confirmDeleteDepartment');
    const deleteModalCancelBtn = document.getElementById('cancelDeleteDepartment');

    // دالة لجلب التوكن من localStorage
    function getToken() {
        return localStorage.getItem('token');
    }

    // دالة للتأكد من وجود التوكن وإعادة التوجيه إذا لم يكن موجوداً
    function checkAuth() {
        if (!getToken()) {
            alert('يرجى تسجيل الدخول أولاً.');
            window.location.href = 'login.html';
        }
    }

    checkAuth(); // التحقق من المصادقة عند تحميل الصفحة

    // Functions to open/close modals
    function openModal(modal) {
        modal.style.display = 'flex';
    }

    function closeModal(modal) {
        modal.style.display = 'none';
        // Clear form fields when closing add/edit modals
        if (modal === addDepartmentModal) {
            addDepartmentNameInput.value = '';
            addDepartmentImageInput.value = '';
        } else if (modal === editDepartmentModal) {
            editDepartmentIdInput.value = '';
            editDepartmentNameInput.value = '';
            editDepartmentImageInput.value = '';
        }
    }

    // دالة لجلب الأقسام وعرضها
    async function fetchDepartments() {
        try {
            const response = await fetch('http://localhost:3000/api/departments', {
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                }
            });
            const data = await response.json();

            if (response.ok) {
                cardsGrid.innerHTML = ''; // مسح البطاقات الحالية
                data.data.forEach(department => {
                    const departmentCard = document.createElement('div');
                    departmentCard.className = 'card';
                    departmentCard.dataset.id = department.id; // Store ID on card
                    departmentCard.innerHTML = `
                        <div class="card-icons">
                            <a href="#" class="edit-icon" data-id="${department.id}" data-name="${department.name}" data-image="${department.image}"><img src="../images/edit.svg" alt="تعديل"></a>
                            <a href="#" class="delete-icon" data-id="${department.id}"><img src="../images/delet.svg" alt="حذف"></a>
                        </div>
                        <div class="card-icon bg-blue"><img src="http://localhost:3000/${department.image}" alt="${department.name}"></div>
                        <div class="card-title">${department.name}</div>
                        <div class="card-subtitle"></div>
                    `;
                    cardsGrid.appendChild(departmentCard);

                    // إضافة event listener للنقر على بطاقة القسم
                    departmentCard.addEventListener('click', function() {
                        const departmentId = this.dataset.id;
                        // يمكنك هنا إعادة التوجيه إلى صفحة محتوى القسم مع معرف القسم
                        window.location.href = `department-content.html?departmentId=${departmentId}`;
                    });
                });

                // إضافة event listeners مباشرة للأيقونات
                document.querySelectorAll('.edit-icon').forEach(icon => {
                    icon.addEventListener('click', function(e) {
                        console.log('تم النقر على زر التعديل');
                        e.preventDefault();
                        e.stopPropagation();
                        const id = this.dataset.id;
                        const name = this.dataset.name;
                        const image = this.dataset.image;
                        
                        editDepartmentIdInput.value = id;
                        editDepartmentNameInput.value = name;
                        openModal(editDepartmentModal);
                    });
                });

                document.querySelectorAll('.delete-icon').forEach(icon => {
                    icon.addEventListener('click', function(e) {
                        console.log('تم النقر على زر الحذف');
                        e.preventDefault();
                        e.stopPropagation();
                        const id = this.dataset.id;
                        deleteModalConfirmBtn.dataset.departmentId = id;
                        openModal(deleteDepartmentModal);
                    });
                });

            } else {
                alert(data.message || 'فشل جلب الأقسام.');
            }
        } catch (error) {
            console.error('خطأ في جلب الأقسام:', error);
            alert('حدث خطأ في الاتصال بجلب الأقسام.');
        }
    }

    // Handle Add Department form submission
    addModalSaveBtn.addEventListener('click', async function() {
        const name = addDepartmentNameInput.value;
        const imageFile = addDepartmentImageInput.files[0]; // الحصول على الملف

        if (!name || !imageFile) {
            alert('اسم القسم والصورة مطلوبان.');
            return;
        }

        const formData = new FormData();
        formData.append('name', name);
        formData.append('image', imageFile);

        try {
            const response = await fetch('http://localhost:3000/api/departments', {
                method: 'POST',
                // لا نحتاج لـ 'Content-Type': 'application/json' مع FormData
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                },
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                alert(data.message);
                closeModal(addDepartmentModal);
                fetchDepartments();
            } else {
                alert(data.message || 'حدث خطأ عند إضافة القسم.');
            }
        } catch (error) {
            console.error('خطأ في إضافة القسم:', error);
            alert('حدث خطأ في الاتصال عند إضافة القسم.');
        }
    });

    // Handle Edit Department form submission
    editModalSaveBtn.addEventListener('click', async function() {
        const id = editDepartmentIdInput.value;
        const name = editDepartmentNameInput.value;
        const imageFile = editDepartmentImageInput.files[0]; // الحصول على الملف (إذا تم اختيار واحد)

        if (!id || !name) { // لم نعد نطلب الصورة كشرط أساسي للتعديل
            alert('اسم القسم مطلوب للتعديل.');
            return;
        }

        const formData = new FormData();
        formData.append('name', name);
        if (imageFile) { // إضافة الصورة فقط إذا تم اختيار ملف جديد
            formData.append('image', imageFile);
        }

        try {
            const response = await fetch(`http://localhost:3000/api/departments/${id}`, {
                method: 'PUT',
                // لا نحتاج لـ 'Content-Type': 'application/json' مع FormData
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                },
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                alert(data.message);
                closeModal(editDepartmentModal);
                fetchDepartments();
            } else {
                alert(data.message || 'حدث خطأ عند تعديل القسم.');
            }
        } catch (error) {
            console.error('خطأ في تعديل القسم:', error);
            alert('حدث خطأ في الاتصال عند تعديل القسم.');
        }
    });

    // Handle Delete Department confirmation
    deleteModalConfirmBtn.addEventListener('click', async function() {
        const id = deleteModalConfirmBtn.dataset.departmentId; // Get ID from stored data attribute

        try {
            const response = await fetch(`http://localhost:3000/api/departments/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                alert(data.message);
                closeModal(deleteDepartmentModal);
                fetchDepartments();
            } else {
                alert(data.message || 'فشل حذف القسم.');
            }
        } catch (error) {
            console.error('خطأ في حذف القسم:', error);
            alert('حدث خطأ في الاتصال بحذف القسم.');
        }
    });

    // Event Listeners for opening modals
    if (addDepartmentBtn) {
        addDepartmentBtn.addEventListener('click', () => openModal(addDepartmentModal));
    }

    // Add event listeners for modal close buttons
    if (addModalCancelBtn) {
        addModalCancelBtn.addEventListener('click', () => closeModal(addDepartmentModal));
    }
    if (editModalCancelBtn) {
        editModalCancelBtn.addEventListener('click', () => closeModal(editDepartmentModal));
    }
    if (deleteModalCancelBtn) {
        deleteModalCancelBtn.addEventListener('click', () => closeModal(deleteDepartmentModal));
    }

    // Add event listeners for modal close buttons (×)
    document.querySelectorAll('.modal-overlay .close-button').forEach(button => {
        button.addEventListener('click', function() {
            const modal = this.closest('.modal-overlay');
            closeModal(modal);
        });
    });

    // Add event listeners for clicking outside modal to close
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal(this);
            }
        });
    });

    // Initial fetch of departments when the page loads
    fetchDepartments();

    // Global goBack function (assuming it's defined elsewhere or will be here)
    window.goBack = function() {
        window.history.back();
    };
}); 