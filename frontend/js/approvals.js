// approvals.js
let permissionsKeys = [];

async function fetchPermissions() {
    const token = localStorage.getItem('token');
    if (!token) return;
    const payload = JSON.parse(atob(token.split('.')[1] || '{}'));
    const role = payload.role;
    if (role === 'admin') {
        permissionsKeys = ['*'];
        return;
    }
    const userId = payload.id;
    const res = await fetch(`http://localhost:3006/api/users/${userId}/permissions`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return;
    const { data: perms } = await res.json();
    permissionsKeys = perms.map(p =>
        typeof p === 'string' ? p : (p.permission || p.permission_key)
    );
}

document.addEventListener("DOMContentLoaded", async () => {
    // Helper function to get the token from localStorage
    await fetchPermissions();

    function getToken() {
        return localStorage.getItem('token');
    }

    // Helper function to show toast messages
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

        toast.offsetWidth;

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-20px)';
            setTimeout(() => {
                toast.remove();
            }, 500);
        }, duration);
    }

    const searchInput = document.getElementById("searchInput");
    const filterStatus = document.getElementById("filterStatus");
    const filterDept = document.getElementById("filterDept");
    const filterFolder = document.getElementById("filterFolder"); // New folder filter
    const btnFilter = document.getElementById("btnFilter");
    const approvalsBody = document.getElementById("approvalsBody");
    const noContentMessage = document.getElementById("noContentMessage");

    const totalRequestsSpan = document.getElementById("totalRequests");
    const startRecordSpan = document.getElementById("startRecord");
    const endRecordSpan = document.getElementById("endRecord");
    const totalCountSpan = document.getElementById("totalCount");

    const prevPageBtn = document.getElementById("prevPage");
    const nextPageBtn = document.getElementById("nextPage");
    const pageNumbersContainer = document.getElementById("pageNumbers"); // Changed to container

    let currentPage = 1;
    const rowsPerPage = 5;
    let allContents = []; // Store all fetched contents
    let filteredContents = []; // Store currently filtered contents

    // Populate department and folder filters dynamically (optional, based on available data)
    async function populateFilters() {
        try {
            const token = getToken();
            if (!token) return; // Cannot populate without token

            // Fetch departments (assuming you have a backend endpoint for this)
            const deptResponse = await fetch('http://localhost:3006/api/departments', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (deptResponse.ok) {
                const deptData = await deptResponse.json();
                if (deptData.data) {
                    deptData.data.forEach(dept => {
                        const option = document.createElement('option');
                        option.value = dept.name; // Use department name for filtering
                        option.textContent = dept.name;
                        filterDept.appendChild(option);
                    });
                }
            }
            // Note: Populating folders dynamically will be more complex as they are nested under departments.
            // For now, we will assume folders are filtered based on the fetched content data.

        } catch (error) {
            console.error('Error populating filters:', error);
        }
    }

    // Function to fetch content uploaded by the current user
    async function fetchMyUploadedContent() {
        try {
            const token = getToken();
            if (!token) {
                showToast('غير مصرح: لا يوجد توكن.', 'error');
                console.error('No token found.');
                approvalsBody.innerHTML = '';
                noContentMessage.style.display = 'block';
                updateRecordInfo(0, 0, 0);
                updatePaginationButtons(0);
                return;
            }

            const response = await fetch('http://localhost:3006/api/contents/my-uploads', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                allContents = data.data || [];
                // فرز بحيث تكون غير المعتمدة أولاً ثم المعتمدة
                allContents.sort((a, b) => {
                    if (a.is_approved === b.is_approved) {
                        return new Date(b.createdAt) - new Date(a.createdAt); // الأحدث أولاً
                    }
                    return a.is_approved - b.is_approved; // غير المعتمدة (false) تطلع فوق
                });

                applyFilters(); // Apply filters and display data
                populateFolderFilter(); // Populate folder filter based on fetched content
            } else {
                showToast(data.message || 'فشل جلب ملفاتك المرفوعة.', 'error');
                console.error('Failed to fetch my uploads:', data.message);
                allContents = [];
                applyFilters();
            }
        } catch (error) {
            console.error('Error fetching my uploads:', error);
            showToast('حدث خطأ في الاتصال بجلب ملفاتك المرفوعة.', 'error');
            allContents = [];
            applyFilters();
        }
    }

    // Populate folder filter based on `allContents`
    function populateFolderFilter() {
        filterFolder.innerHTML = '<option value="all">جميع المجلدات</option>'; // Reset
        const uniqueFolders = [...new Set(allContents.map(content => content.folderName))];
        uniqueFolders.forEach(folderName => {
            const option = document.createElement('option');
            option.value = folderName;
            option.textContent = folderName;
            filterFolder.appendChild(option);
        });
    }

    // Update total count
    function updateTotalCount(count) {
        totalRequestsSpan.textContent = count;
        totalCountSpan.textContent = count;
    }

    // Update record info text
    function updateRecordInfo(start, end, total) {
        startRecordSpan.textContent = start;
        endRecordSpan.textContent = end;
        totalCountSpan.textContent = total;
    }

    // Render table rows based on `filteredContents` for the current page
    function renderTable() {
        approvalsBody.innerHTML = '';
    
        // حدد من يقدر يشوف زر التتبع
        const canTrack = permissionsKeys.includes('*') || permissionsKeys.includes('track_credits');
    
        if (filteredContents.length === 0) {
            noContentMessage.style.display = 'block';
            updateRecordInfo(0, 0, 0);
            updateTotalCount(0);
            updatePaginationButtons(0);
            return;
        }
        noContentMessage.style.display = 'none';
    
        // ✅ ترتيب العناصر: قيد المراجعة أولاً ثم المعتمدة
        filteredContents.sort((a, b) => a.is_approved - b.is_approved);
    
        const startIdx = (currentPage - 1) * rowsPerPage;
        const endIdx = startIdx + rowsPerPage;
        const pageData = filteredContents.slice(startIdx, endIdx);
    
        pageData.forEach(content => {
            const approvalStatusText  = content.is_approved ? 'معتمد' : 'قيد المراجعة';
            const approvalStatusClass = content.is_approved ? 'badge-approved' : 'badge-pending';
            const dateText = new Date(content.createdAt)
                .toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
    
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="col-file">${content.title}</td>
                <td class="col-folder">${content.folderName || '-'}</td>
                <td class="col-dept">${content.departmentName || '-'}</td>
                <td class="col-status"><span class="badge ${approvalStatusClass}">${approvalStatusText}</span></td>
                <td class="col-date">${dateText}</td>
                <td class="col-actions">
                    ${canTrack ? `<button class="btn-track" data-id="${content.id}">تتبع</button>` : ''}
                </td>
            `;
            approvalsBody.appendChild(row);
        });
    
        // ربط أحداث التتبع إذا كانت الصلاحية موجودة
        if (canTrack) {
            approvalsBody.querySelectorAll('.btn-track').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.dataset.id;
                    window.location.href = `/frontend/html/track-request.html?id=${id}`;
                });
            });
        }
    
        updateRecordInfo(startIdx + 1, startIdx + pageData.length, filteredContents.length);
        updateTotalCount(filteredContents.length);
        updatePaginationButtons(filteredContents.length);
    }
    


    // Update pagination buttons
    function updatePaginationButtons(totalFilteredRows) {
        const totalPages = Math.ceil(totalFilteredRows / rowsPerPage);
        pageNumbersContainer.innerHTML = ''; // Clear existing page numbers

        for (let i = 1; i <= totalPages; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.classList.add('page-number');
            if (i === currentPage) {
                pageBtn.classList.add('active');
            }
            pageBtn.dataset.page = i;
            pageBtn.textContent = i;
            pageNumbersContainer.appendChild(pageBtn);

            pageBtn.addEventListener('click', function () {
                const page = Number(this.dataset.page);
                if (page !== currentPage) {
                    currentPage = page;
                    renderTable();
                }
            });
        }

        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
    }

    // Apply filters (search, status, department, folder)
    function applyFilters() {
        const searchQuery = searchInput.value.trim().toLowerCase();
        const selectedStatus = filterStatus.value;
        const selectedDept = filterDept.value;
        const selectedFolder = filterFolder.value; // Get selected folder

        filteredContents = allContents.filter(content => {
            const contentTitle = content.title.toLowerCase();
            const departmentName = (content.departmentName || '').toLowerCase();
            const folderName = (content.folderName || '').toLowerCase();
            const isApproved = content.is_approved ? 'approved' : 'pending';

            const matchesSearch =
                contentTitle.includes(searchQuery) ||
                departmentName.includes(searchQuery) ||
                folderName.includes(searchQuery); // Search in folder name

            const matchesStatus = selectedStatus === 'all' || isApproved === selectedStatus;
            const matchesDept = selectedDept === 'all' || departmentName === selectedDept.toLowerCase();
            const matchesFolder = selectedFolder === 'all' || folderName === selectedFolder.toLowerCase(); // Filter by folder name

            return matchesSearch && matchesStatus && matchesDept && matchesFolder;
        });

        currentPage = 1; // Reset to first page after applying filters
        renderTable();
    }

    // Event Listeners
    btnFilter.addEventListener('click', applyFilters);
    searchInput.addEventListener('input', applyFilters); // Apply filters on input
    filterStatus.addEventListener('change', applyFilters);
    filterDept.addEventListener('change', applyFilters);
    filterFolder.addEventListener('change', applyFilters); // New event listener for folder filter

    prevPageBtn.addEventListener("click", () => {
        if (currentPage > 1) {
            currentPage--;
            renderTable();
        }
    });

    nextPageBtn.addEventListener("click", () => {
        const totalPages = Math.ceil(filteredContents.length / rowsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderTable();
        }
    });

    // Initial fetch and render
    populateFilters(); // Populate department filter first
    fetchMyUploadedContent();
});