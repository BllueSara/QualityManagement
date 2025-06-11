// approvals.js

document.addEventListener("DOMContentLoaded", () => {
    // Helper function to get the token from localStorage
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
        if (filteredContents.length === 0) {
            noContentMessage.style.display = 'block';
            updateRecordInfo(0, 0, 0);
            updateTotalCount(0);
            updatePaginationButtons(0);
            return;
        }

        noContentMessage.style.display = 'none';

        const startIdx = (currentPage - 1) * rowsPerPage;
        const endIdx = startIdx + rowsPerPage;
        const contentsToDisplay = filteredContents.slice(startIdx, endIdx);

        contentsToDisplay.forEach(content => {
            const approvalStatusText = content.is_approved ? 'معتمد' : 'قيد المراجعة';
            const approvalStatusClass = content.is_approved ? 'badge-approved' : 'badge-pending';
            const fileIcon = '<i class="fas fa-file-alt file-icon"></i>';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="col-file">
                    ${fileIcon}
                    ${content.title}
                </td>
                <td class="col-folder">${content.folderName || '-'}</td>
                <td class="col-dept">${content.departmentName || '-'}</td>
                <td class="col-status">
                    <span class="badge ${approvalStatusClass}">${approvalStatusText}</span>
                </td>
                <td class="col-date">${new Date(content.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                <td class="col-actions">
                    <button class="btn-track" data-content-url="http://localhost:3006/uploads/${content.fileUrl}" style="cursor: pointer;">عرض الملف</button>
                </td>
            `;
            approvalsBody.appendChild(row);
        });

        // Attach event listeners for "عرض الملف" buttons
        approvalsBody.querySelectorAll('.btn-track').forEach(button => {
            button.addEventListener('click', function() {
                const contentUrl = this.getAttribute('data-content-url');
                if (contentUrl) {
                    window.open(contentUrl, '_blank');
                } else {
                    showToast('رابط الملف غير متوفر.', 'error');
                }
            });
        });

        updateRecordInfo(startIdx + 1, startIdx + contentsToDisplay.length, filteredContents.length);
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

            pageBtn.addEventListener('click', function() {
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