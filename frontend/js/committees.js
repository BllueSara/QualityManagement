apiBase = 'http://localhost:3006';
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const addCommitteeButton = document.getElementById('addCommitteeButton');
    const addCommitteeModal = document.getElementById('addCommitteeModal');
    const editCommitteeModal = document.getElementById('editCommitteeModal');
    const deleteCommitteeModal = document.getElementById('deleteCommitteeModal');
    const committeesGrid = document.getElementById('committeesGrid');
    const searchInput = document.querySelector('.search-bar input');

    // Event Listeners
    addCommitteeButton.addEventListener('click', () => showModal(addCommitteeModal));
    document.getElementById('cancelAddCommittee').addEventListener('click', () => hideModal(addCommitteeModal));
    document.getElementById('cancelEditCommittee').addEventListener('click', () => hideModal(editCommitteeModal));
    document.getElementById('cancelDeleteCommittee').addEventListener('click', () => hideModal(deleteCommitteeModal));

    // تحميل اللجان عند تحميل الصفحة
    loadCommittees();

    // بحث
    searchInput.addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase();
        const cards = document.querySelectorAll('.card');
        cards.forEach(card => {
            const title = card.querySelector('.card-title').textContent.toLowerCase();
            if (title.includes(searchTerm)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    });

    // إضافة لجنة
    document.getElementById('saveAddCommittee').addEventListener('click', async function() {
        const name = document.getElementById('committeeName').value;
        const imageFile = document.getElementById('committeeImage').files[0];
        if (!name) {
            alert('الرجاء إدخال اسم اللجنة');
            return;
        }
        try {
            const formData = new FormData();
            formData.append('name', name);
            if (imageFile) {
                formData.append('image', imageFile);
            }
            const response = await fetch('/api/committees', {
                method: 'POST',
                body: formData
            });
            if (response.ok) {
                hideModal(addCommitteeModal);
                document.getElementById('committeeName').value = '';
                document.getElementById('committeeImage').value = '';
                loadCommittees();
            } else {
                throw new Error('Failed to add committee');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('حدث خطأ أثناء إضافة اللجنة');
        }
    });

    // تعديل لجنة
    document.getElementById('saveEditCommittee').addEventListener('click', async function() {
        const id = document.getElementById('editCommitteeId').value;
        const name = document.getElementById('editCommitteeName').value;
        const imageFile = document.getElementById('editCommitteeImage').files[0];
        if (!name) {
            alert('الرجاء إدخال اسم اللجنة');
            return;
        }
        try {
            const formData = new FormData();
            formData.append('name', name);
            if (imageFile) {
                formData.append('image', imageFile);
            }
            const response = await fetch(`/api/committees/${id}`, {
                method: 'PUT',
                body: formData
            });
            if (response.ok) {
                hideModal(editCommitteeModal);
                loadCommittees();
            } else {
                throw new Error('Failed to update committee');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('حدث خطأ أثناء تحديث اللجنة');
        }
    });

    // حذف لجنة
    document.getElementById('confirmDeleteCommittee').addEventListener('click', async function() {
        const id = document.getElementById('editCommitteeId').value;
        try {
            const response = await fetch(`${apiBase}/api/committees/${id}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                hideModal(deleteCommitteeModal);
                loadCommittees();
            } else {
                throw new Error('Failed to delete committee');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('حدث خطأ أثناء حذف اللجنة');
        }
    });
});

// Helper Functions
function showModal(modal) {
    modal.style.display = 'flex';
}
function hideModal(modal) {
    modal.style.display = 'none';
}
async function loadCommittees() {
    try {
        const response = await fetch('http://localhost:3006/api/committees');
        const committees = await response.json();
        const committeesGrid = document.getElementById('committeesGrid');
        committeesGrid.innerHTML = '';
        committees.forEach(committee => {
            const card = createCommitteeCard(committee);
            committeesGrid.appendChild(card);
        });
    } catch (error) {
        console.error('Error:', error);
        alert('حدث خطأ أثناء تحميل اللجان');
    }
}
function createCommitteeCard(committee) {
  const card = document.createElement('div');
  card.className = 'card';

  // Compute image source with absolute base URL
  const imgPath = committee.image
    ? (committee.image.startsWith('/uploads/')
        ? committee.image
        : `/${committee.image.replace(/^\/+/, '')}`)
    : '/images/committee.svg';
  const imageSrc = `${apiBase}${imgPath}`;

  // Build inner HTML structure without inline handlers
  card.innerHTML = `
    <div class="card-icons">
      <button type="button" class="edit-icon" data-id="${committee.id}" aria-label="تعديل لجنة">
        <img src="../images/edit.svg" alt="تعديل">
      </button>
      <button type="button" class="delete-icon" data-id="${committee.id}" aria-label="حذف لجنة">
        <img src="../images/delet.svg" alt="حذف">
      </button>
    </div>
    <div class="card-icon bg-orange">
      <img src="${imageSrc}" alt="${committee.name}">
    </div>
    <div class="card-title">${committee.name}</div>
  `;

  // Delegate click on edit/delete buttons
  const editBtn = card.querySelector('.edit-icon');
  const deleteBtn = card.querySelector('.delete-icon');

  editBtn.addEventListener('click', e => {
    e.stopPropagation();
    editCommittee(committee.id);
  });

  deleteBtn.addEventListener('click', e => {
    e.stopPropagation();
    deleteCommittee(committee.id);
  });

  // Navigate to committee content on card click
  card.addEventListener('click', () => {
    window.location.href = `committee-content.html?committeeId=${committee.id}`;
  });

  return card;
}

// دوال التعديل والحذف
window.editCommittee = function(id) {
    fetch(`${apiBase}/api/committees/${id}`)
        .then(response => response.json())
        .then(committee => {
            document.getElementById('editCommitteeId').value = committee.id;
            document.getElementById('editCommitteeName').value = committee.name;
            showModal(document.getElementById('editCommitteeModal'));
        })
        .catch(error => {
            console.error('Error:', error);
            alert('حدث خطأ أثناء تحميل بيانات اللجنة');
        });
};
window.deleteCommittee = function(id) {
    document.getElementById('editCommitteeId').value = id;
    showModal(document.getElementById('deleteCommitteeModal'));
}; 