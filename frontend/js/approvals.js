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
            if (!token) return;

            // Fetch departments
            const deptResponse = await fetch('http://localhost:3006/api/departments', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const deptData = await deptResponse.json();

            // Fetch committees
            const committeeResponse = await fetch('http://localhost:3006/api/committees', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const committeeData = await committeeResponse.json();

            // Clear existing options, keep "All"
            filterDept.innerHTML = '<option value="all">جميع الأقسام/اللجان</option>';

            // Add departments
            if (deptData.data) {
                deptData.data.forEach(dept => {
                    const option = document.createElement('option');
                    option.value = dept.name; // Value is just the name
                    option.textContent = `قسم: ${dept.name}`;
                    filterDept.appendChild(option);
                });
            }

            // Add committees
            if (committeeData) {
                const committeesArray = committeeData.data || committeeData;
                committeesArray.forEach(committee => {
                    const option = document.createElement('option');
                    option.value = committee.name; // Value is just the name
                    option.textContent = `لجنة: ${committee.name}`;
                    filterDept.appendChild(option);
                });
            }

        } catch (error) {
            console.error('Error populating filters:', error);
        }
    }

    // Function to fetch content uploaded by the current user
    async function fetchMyUploadedContent() {
        try {
            // جلب محتوى الأقسام
            const deptResponse = await fetchJSON('/api/departments/contents/my-uploads', {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            const deptItems = deptResponse.data || [];

            // جلب محتوى اللجان
            const committeeResponse = await fetchJSON('/api/committees/contents/my-uploads', {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            const committeeItems = (committeeResponse.data || []).map(item => ({ ...item, type: 'committee' }));

            if (deptResponse.success || committeeResponse.success) {
                // دمج المصفوفات مع التأكد من عدم تكرار الملفات
                const uniqueContents = new Map();
                
                // إضافة محتويات الأقسام
                deptItems.forEach(item => {
                    uniqueContents.set(item.id, { ...item, type: 'department' });
                });
                
                // إضافة محتويات اللجان (ستستبدل أي تكرارات)
                committeeItems.forEach(item => {
                    uniqueContents.set(item.id, item);
                });
                
                allContents = Array.from(uniqueContents.values());
                applyFilters();
                populateFolderFilter();
            } else {
                showToast('فشل جلب الملفات المرفوعة.', 'error');
                allContents = [];
                applyFilters();
            }
        } catch (error) {
            showToast('حدث خطأ في الاتصال بجلب الملفات المرفوعة.', 'error');
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
    
        // ✅ ترتيب العناصر: قيد المراجعة أولاً ثم المعتمدة (مع الأخذ في الاعتبار أن is_approved الآن Boolean)
        filteredContents.sort((a, b) => {
            // false (pending) comes before true (approved)
            return (a.is_approved === b.is_approved) ? 
                   (new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt)) : 
                   (a.is_approved ? 1 : -1);
        });
    
        const startIdx = (currentPage - 1) * rowsPerPage;
        const endIdx = startIdx + rowsPerPage;
        const pageData = filteredContents.slice(startIdx, endIdx);
    
        pageData.forEach(content => {
            console.log('Rendering content item (in renderTable - after sort):', content); // DEBUG: Inspect each content item after sort

            const approvalStatusText = content.is_approved ? 'معتمد' : 'قيد المراجعة';
            const approvalStatusClass = content.is_approved ? 'badge-approved' : 'badge-pending';
            const dateText = new Date(content.created_at || content.createdAt)
                .toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
            
            const contentType = (content.type === 'committee' ? 'ملف لجنة' : 'تقرير قسم') || 'غير معروف';
            const displaySourceName = content.source_name || '-';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="col-file">
                    ${content.title}
                    <div class="content-meta">(${contentType} - ${displaySourceName})</div>
                </td>
                <td class="col-folder">${content.folderName || '-'}</td>
                <td class="col-dept">${displaySourceName}</td>
                <td class="col-status"><span class="badge ${approvalStatusClass}">${approvalStatusText}</span></td>
                <td class="col-date">${dateText}</td>
                <td class="col-actions">
                    ${canTrack ? `<button class="btn-track" data-id="${content.id}" data-type="${content.type}">تتبع</button>` : ''}
                </td>
            `;
            approvalsBody.appendChild(row);
        });
    
        // ربط أحداث التتبع إذا كانت الصلاحية موجودة
        if (canTrack) {
            approvalsBody.querySelectorAll('.btn-track').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.dataset.id;
                    const type = btn.dataset.type;
                    window.location.href = `/frontend/html/track-request.html?id=${id}&type=${type}`;
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
        const selectedFolder = filterFolder.value;

        filteredContents = allContents.filter(content => {
            const contentTitle = content.title.toLowerCase();
            const sourceName = (content.source_name || '').toLowerCase(); // Should now be clean name
            const folderName = (content.folderName || '').toLowerCase();
            const isApproved = content.is_approved ? 'approved' : 'pending';

            const matchesSearch =
                contentTitle.includes(searchQuery) ||
                sourceName.includes(searchQuery) ||
                folderName.includes(searchQuery);

            const matchesStatus = selectedStatus === 'all' || isApproved === selectedStatus;
            const matchesDept = selectedDept === 'all' || sourceName === selectedDept.toLowerCase(); // Direct comparison now
            const matchesFolder = selectedFolder === 'all' || folderName === selectedFolder.toLowerCase();

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