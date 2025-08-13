// approvals.js
let permissionsKeys = [];
apiBase = 'http://localhost:3006/api';
async function fetchPermissions() {
    const token = localStorage.getItem('token');
    if (!token) return;
    const payload = await safeGetUserInfo(token);
    if (!payload) return;
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
    const filterFolder = document.getElementById("filterFolder");
    const btnFilter = document.getElementById("btnFilter");
    const approvalsBody = document.getElementById("approvalsBody");
    const noContentMessage = document.getElementById("noContentMessage");

    const totalRequestsSpan = document.getElementById("totalRequests");
    const startRecordSpan = document.getElementById("startRecord");
    const endRecordSpan = document.getElementById("endRecord");
    const totalCountSpan = document.getElementById("totalCount");

    const prevPageBtn = document.getElementById("prevPage");
    const nextPageBtn = document.getElementById("nextPage");
    const pageNumbersContainer = document.getElementById("pageNumbers");

    let currentPage = 1;
    const rowsPerPage = 5;
    let allContents = [];
    let filteredContents = [];

    // Populate department and folder filters dynamically
async function populateFilters() {
  try {
    const token = getToken();
    if (!token) return;

    const lang = localStorage.getItem('language') || 'ar';

    // — Departments
    const deptRes = await fetch(`${apiBase}/departments/all`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!deptRes.ok) throw new Error(`Departments ${deptRes.status}`);
    const deptJson = await deptRes.json();
    const deptsRaw = Array.isArray(deptJson) ? deptJson : (deptJson.data || []);

    // ✨ فك الاسم حسب اللغة
    const depts = deptsRaw.map(dept => {
      let name;
      try {
        const parsed = JSON.parse(dept.name);
        name = parsed[lang] || parsed.ar || dept.name;
      } catch {
        name = dept.name;
      }
      return { ...dept, localizedName: name };
    });

    // — Committees
const commRes = await fetch(`${apiBase}/committees`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
if (!commRes.ok) throw new Error(`Committees ${commRes.status}`);
const commJson = await commRes.json();
const commsRaw = Array.isArray(commJson)
  ? commJson
  : (commJson.data || []);

// ✨ فك الاسم حسب اللغة لكل لجنة
const comms = commsRaw.map(c => {
  let name;
  try {
    const parsed = JSON.parse(c.name);
    name = parsed[lang] || parsed.ar || c.name;
  } catch {
    name = c.name;
  }
  return { ...c, localizedName: name };
});

    // 🧹 امسح الخيارات القديمة
    filterDept.innerHTML = `<option value="all">${getTranslation('all-departments-committees')}</option>`;

    // ➕ الأقسام
    depts.forEach(dept => {
      const o = document.createElement('option');
      o.value = dept.localizedName;
      o.textContent = `${getTranslation('department')}: ${dept.localizedName}`;
      filterDept.appendChild(o);
    });

    // ➕ اللجان
comms.forEach(c => {
  const o = document.createElement('option');
  o.value = c.localizedName;
  o.textContent = `${getTranslation('committee')}: ${c.localizedName}`;
  filterDept.appendChild(o);
});

  } catch (err) {
    console.error(err);
    showToast(getTranslation('error-fetching-departments'), 'error');
  }
}


    // Function to fetch content uploaded by the current user
async function fetchMyUploadedContent() {
  try {
    const token = getToken();
    if (!token) throw new Error('no token');
    const lang = localStorage.getItem('language') || 'ar';

    // 1) fetch departments
    const deptReq = fetch(`${apiBase}/contents/my-uploads`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    // 2) fetch committees
    const commReq = fetch(`${apiBase}/committees/contents/my-uploads`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const [deptRes, commRes] = await Promise.all([deptReq, commReq]);
    if (!deptRes.ok) throw new Error(`Dept uploads ${deptRes.status}`);
    if (!commRes.ok) throw new Error(`Comm uploads ${commRes.status}`);

    const deptJson = await deptRes.json();
    const commJson = await commRes.json();

    // normalize arrays
    const deptArr = Array.isArray(deptJson.data ? deptJson.data : deptJson)
      ? (deptJson.data || deptJson)
      : [];
    const commArr = Array.isArray(commJson.data ? commJson.data : commJson)
      ? (commJson.data || commJson)
      : [];

    // helper لفك الاسم حسب اللغة
// helper لفك الاسم حسب اللغة و لتوحيد is_approved
const normalize = (item, type) => {
  const lang = localStorage.getItem('language') || 'ar';

  // فك الاسم
  let src = item.source_name;
  try {
    const p = JSON.parse(item.source_name);
    src = p[lang] || p.ar || p.en;
  } catch {}

  // فك عنوان الملف
  let localizedTitle = item.title;
  try {
    const t = JSON.parse(item.title);
    localizedTitle = t[lang] || t.ar || t.en || item.title;
  } catch {}

  // فك اسم الفولدر
  let localizedFolder = item.folderName;
  try {
    const f = JSON.parse(item.folderName);
    localizedFolder = f[lang] || f.ar || f.en || item.folderName;
  } catch {}

  let approved = false;
  if (typeof item.is_approved === 'number') {
    approved = item.is_approved === 1;
  } else if (typeof item.is_approved === 'string') {
    approved = item.is_approved.toLowerCase() === 'approved';
  }

  return {
    ...item,
    is_approved: approved,
    type,
    localizedSourceName: src,
    localizedTitle,
    localizedFolderName: localizedFolder
  };
};



    // دمج المحتويات
    allContents = [
      ...deptArr.map(i => normalize(i, 'department')),
      ...commArr.map(i => normalize(i, 'committee')),
    ];

    applyFilters();
    populateFolderFilter();

  } catch (err) {
    console.error(err);
    showToast(getTranslation('error-connection'), 'error');
    allContents = [];
    applyFilters();
  }
}





    // Populate folder filter based on `allContents`
    function populateFolderFilter() {
        filterFolder.innerHTML = `<option value="all">${getTranslation('all-folders')}</option>`;
        const uniqueFolders = [...new Set(allContents.map(content => content.localizedFolderName))];
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
    
        const canTrack = permissionsKeys.includes('*') || permissionsKeys.includes('track_credits');
    
        if (filteredContents.length === 0) {
            noContentMessage.style.display = 'block';
            updateRecordInfo(0, 0, 0);
            updateTotalCount(0);
            updatePaginationButtons(0);
            return;
        }
        noContentMessage.style.display = 'none';
    
        filteredContents.sort((a, b) => {
            return (a.is_approved === b.is_approved) ? 
                   (new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt)) : 
                   (a.is_approved ? 1 : -1);
        });
    
        const startIdx = (currentPage - 1) * rowsPerPage;
        const endIdx = startIdx + rowsPerPage;
        const pageData = filteredContents.slice(startIdx, endIdx);
    
        pageData.forEach(content => {
            const approvalStatusText = content.is_approved ? getTranslation('status-approved') : getTranslation('status-awaiting');
            const approvalStatusClass = content.is_approved ? 'badge-approved' : 'badge-pending';
            const dateText = new Date(content.created_at || content.createdAt)
                .toLocaleDateString(localStorage.getItem('language') === 'ar' ? 'ar-EG' : 'en-US', 
                    { year: 'numeric', month: 'long', day: 'numeric' });
            
            const contentType = content.type === 'committee' ? getTranslation('committee-file') : getTranslation('department-report');
const displaySourceName = content.localizedSourceName || '-';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="col-file">
                    ${content.localizedTitle}
                    <div class="content-meta">(${contentType} - ${displaySourceName})</div>
                </td>
                <td class="col-folder">${content.localizedFolderName  || '-'}</td>
                <td class="col-dept">${displaySourceName}</td>
                <td class="col-status"><span class="badge ${approvalStatusClass}">${approvalStatusText}</span></td>
                <td class="col-date">${dateText}</td>
                <td class="col-actions">
                    ${canTrack ? `<button class="btn-track" data-id="${content.id}" data-type="${content.type}">${getTranslation('track')}</button>` : ''}
                </td>
            `;
            approvalsBody.appendChild(row);
        });
    
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
        pageNumbersContainer.innerHTML = '';

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
             const contentTitle = (content.localizedTitle || '').toLowerCase();
             const sourceName = (content.localizedSourceName || '').toLowerCase();
            const folderName = (content.localizedFolderName  || '').toLowerCase();
            const isApproved = content.is_approved ? 'approved' : 'pending';

            const matchesSearch =
                contentTitle.includes(searchQuery) ||
                sourceName.includes(searchQuery) ||
                folderName.includes(searchQuery);

            const matchesStatus = selectedStatus === 'all' || isApproved === selectedStatus;
            const matchesDept = selectedDept === 'all' || sourceName === selectedDept.toLowerCase();
            const matchesFolder = selectedFolder === 'all' || folderName === selectedFolder.toLowerCase();

            return matchesSearch && matchesStatus && matchesDept && matchesFolder;
        });

        currentPage = 1;
        renderTable();
    }

    // Event Listeners
    btnFilter.addEventListener('click', applyFilters);
    searchInput.addEventListener('input', applyFilters);
    filterStatus.addEventListener('change', applyFilters);
    filterDept.addEventListener('change', applyFilters);
    filterFolder.addEventListener('change', applyFilters);

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
    populateFilters();
    fetchMyUploadedContent();
}); 