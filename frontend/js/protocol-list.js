// قائمة المحاضر - JavaScript
let currentPage = 1;
let totalPages = 1;
let protocols = [];
let filteredProtocols = [];
const itemsPerPage = 10;

document.addEventListener('DOMContentLoaded', function() {
    // إظهار المحتوى بعد تحميل اللغة
    const hiddenElements = document.querySelectorAll('.content-hidden');
    hiddenElements.forEach(element => {
        element.classList.remove('content-hidden');
        element.classList.add('content-visible');
    });

    // تحميل البيانات
    loadProtocols();
    
    // إضافة مستمعي الأحداث
    addEventListeners();
});

// إضافة مستمعي الأحداث
function addEventListeners() {
    // البحث المباشر
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
    }

    // تطبيق الفلاتر
    const departmentFilter = document.getElementById('departmentFilter');
    const statusFilter = document.getElementById('statusFilter');
    const dateFilter = document.getElementById('dateFilter');

    if (departmentFilter) {
        departmentFilter.addEventListener('change', applyFilters);
    }
    if (statusFilter) {
        statusFilter.addEventListener('change', applyFilters);
    }
    if (dateFilter) {
        dateFilter.addEventListener('change', applyFilters);
    }
}

// تحميل المحاضر
async function loadProtocols() {
    try {
        showLoading(true);
        
        const token = getAuthToken();
        if (!token) {
            throw new Error('غير مصرح لك، يرجى تسجيل الدخول مرة أخرى');
        }

        const response = await fetch('http://localhost:3006/api/protocols', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'فشل في تحميل المحاضر');
        }

        const data = await response.json();
        protocols = data.data || [];
        filteredProtocols = [...protocols];
        
        currentPage = 1;
        updatePagination();
        renderProtocols();
        
    } catch (error) {
        console.error('خطأ في تحميل المحاضر:', error);
        showToast(error.message || 'حدث خطأ في تحميل المحاضر', 'error');
        showNoDataMessage();
    } finally {
        showLoading(false);
    }
}

// عرض المحاضر
function renderProtocols() {
    const tableBody = document.getElementById('protocolTableBody');
    if (!tableBody) return;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageProtocols = filteredProtocols.slice(startIndex, endIndex);

    if (pageProtocols.length === 0) {
        showNoDataMessage();
        return;
    }

    tableBody.innerHTML = '';

    pageProtocols.forEach(protocol => {
        const row = createProtocolRow(protocol);
        tableBody.appendChild(row);
    });

    hideNoDataMessage();
}

// تحديث دالة إنشاء صف المحضر
function createProtocolRow(protocol) {
    const row = document.createElement('tr');
    row.className = 'protocol-row';
    row.setAttribute('data-id', protocol.id);

    const topicsCount = protocol.topicsCount || 0;
    const latestEndDate = protocol.latestEndDate ? formatDate(protocol.latestEndDate) : '-';

    // تحديد حالة المحضر مع الترجمة
    let statusText, statusClass;
    const lang = localStorage.getItem('language') || 'ar';
    
    if (protocol.isApproved) {
        statusText = lang === 'ar' ? 'معتمد' : 'Approved';
        statusClass = 'status-approved';
    } else if (protocol.approvalStatus === 'rejected') {
        statusText = lang === 'ar' ? 'مرفوض' : 'Rejected';
        statusClass = 'status-rejected';
    } else {
        statusText = lang === 'ar' ? 'في انتظار الاعتماد' : 'Pending Approval';
        statusClass = 'status-pending';
    }

    const allowEdit = (!protocol.isApproved) && (protocol.approvalStatus === 'pending' || protocol.approvalStatus === 'rejected');

    // النصوص المترجمة للأزرار
    const viewTitle = lang === 'ar' ? 'عرض PDF' : 'View PDF';
    const editTitle = lang === 'ar' ? 'تعديل' : 'Edit';
    const downloadTitle = lang === 'ar' ? 'تحميل PDF' : 'Download PDF';
    const deleteTitle = lang === 'ar' ? 'حذف' : 'Delete';
    const noTitle = lang === 'ar' ? 'بدون عنوان' : 'No Title';
    const topicsText = lang === 'ar' ? 'موضوع/مواضيع' : 'topic(s)';

    row.innerHTML = `
        <td style="text-align: center;">${protocol.title || noTitle}</td>
        <td style="text-align: center;">${topicsCount} ${topicsText}</td>
        <td style="text-align: center;">${formatDate(protocol.protocolDate)}</td>
        <td style="text-align: center;">${latestEndDate}</td>
        <td style="text-align: center;">
            <span class="status-badge ${statusClass}">
                <i class="fas ${getStatusIcon(protocol.approvalStatus, protocol.isApproved)}"></i>
                ${statusText}
            </span>
        </td>
        <td class="actions-cell" style="text-align: center;">
            <button class="action-btn btn-view" onclick="viewProtocol('${protocol.id}')" title="${viewTitle}">
                <i class="fas fa-file-pdf"></i>
            </button>
            ${allowEdit ? `
            <button class="action-btn btn-edit" onclick="editProtocol('${protocol.id}')" title="${editTitle}">
                <i class="fas fa-edit"></i>
            </button>
            ` : ''}
            ${protocol.isApproved ? `
                <button class="action-btn btn-download" onclick="downloadPDF('${protocol.id}')" title="${downloadTitle}">
                    <i class="fas fa-download"></i>
                </button>
            ` : ''}
            <button class="action-btn btn-delete" onclick="deleteProtocol('${protocol.id}')" title="${deleteTitle}">
                <i class="fas fa-trash"></i>
            </button>
        </td>
    `;

    return row;
}

// دالة تحديث أيقونة الحالة
function getStatusIcon(approvalStatus, isApproved) {
    if (isApproved) {
        return 'fa-check-circle';
    } else if (approvalStatus === 'rejected') {
        return 'fa-times-circle';
    } else {
        return 'fa-clock';
    }
}

// دالة تحميل PDF
async function downloadPDF(protocolId) {
    try {
        const token = getAuthToken();
        if (!token) {
            throw new Error('غير مصرح لك، يرجى تسجيل الدخول مرة أخرى');
        }

        // إنشاء رابط تحميل
        const downloadUrl = `http://localhost:3006/api/protocols/${protocolId}/pdf`;
        
        // إنشاء عنصر a مؤقت للتحميل
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `protocol_${protocolId}.pdf`;
        
        // إضافة header للمصادقة
        const response = await fetch(downloadUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'فشل في تحميل ملف PDF');
        }

        // تحويل الاستجابة إلى blob
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        // تحديث الرابط والتحميل
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // تنظيف الذاكرة
        window.URL.revokeObjectURL(url);
        
        showToast('تم تحميل ملف PDF بنجاح', 'success');
    } catch (error) {
        console.error('Error downloading PDF:', error);
        showToast(error.message || 'حدث خطأ أثناء تحميل ملف PDF', 'error');
    }
}

// الحصول على فئة الحالة
function getStatusClass(status) {
    const statusClasses = {
        'active': 'status-active',
        'completed': 'status-completed',
        'overdue': 'status-overdue'
    };
    
    return statusClasses[status] || 'status-active';
}

// الحصول على نص الحالة
function getStatusText(status) {
    const statusTexts = {
        'active': 'نشط',
        'completed': 'مكتمل',
        'overdue': 'متأخر'
    };
    
    return statusTexts[status] || 'نشط';
}

// الحصول على أيقونة الحالة
function getStatusIcon(status) {
    const statusIcons = {
        'active': 'fa-clock',
        'completed': 'fa-check-circle',
        'overdue': 'fa-exclamation-triangle'
    };
    
    return statusIcons[status] || 'fa-clock';
}

// تنسيق التاريخ
function formatDate(dateString) {
    if (!dateString) return '-';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-SA');
}

// البحث
function handleSearch() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
        filteredProtocols = protocols.filter(protocol =>
        (protocol.protocolTitle && protocol.protocolTitle.toLowerCase().includes(searchTerm)) ||
        (protocol.topics && protocol.topics.some(topic => 
            topic.subject && topic.subject.toLowerCase().includes(searchTerm) ||
            topic.discussion && topic.discussion.toLowerCase().includes(searchTerm)
        ))
    );
    
    currentPage = 1;
    updatePagination();
    renderProtocols();
}

// تطبيق الفلاتر
function applyFilters() {
    const statusFilter = document.getElementById('statusFilter').value;
    const dateFilter = document.getElementById('dateFilter').value;
    
    filteredProtocols = protocols.filter(protocol => {
        let matches = true;
        
        // فلتر الحالة
        if (statusFilter) {
            let protocolStatus;
            if (protocol.isApproved) {
                protocolStatus = 'approved';
            } else if (protocol.approvalStatus === 'rejected') {
                protocolStatus = 'rejected';
            } else {
                protocolStatus = 'pending';
            }
            
            if (protocolStatus !== statusFilter) {
                matches = false;
            }
        }
        
        // فلتر التاريخ
        if (dateFilter) {
            const protocolDate = new Date(protocol.protocolDate);
            const filterDate = new Date(dateFilter);
            if (protocolDate.toDateString() !== filterDate.toDateString()) {
                matches = false;
            }
        }
        
        return matches;
    });
    
    currentPage = 1;
    updatePagination();
    renderProtocols();
}

// مسح الفلاتر
function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('statusFilter').value = '';
    document.getElementById('dateFilter').value = '';
    
    filteredProtocols = [...protocols];
    currentPage = 1;
    updatePagination();
    renderProtocols();
    
    showToast('تم مسح الفلاتر', 'info');
}

// تحديث ترقيم الصفحات
function updatePagination() {
    totalPages = Math.ceil(filteredProtocols.length / itemsPerPage);
    
    document.getElementById('currentPage').textContent = currentPage;
    document.getElementById('totalPages').textContent = totalPages;
    
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
}

// الصفحة السابقة
function previousPage() {
    if (currentPage > 1) {
        currentPage--;
        renderProtocols();
        updatePagination();
    }
}

// الصفحة التالية
function nextPage() {
    if (currentPage < totalPages) {
        currentPage++;
        renderProtocols();
        updatePagination();
    }
}

// عرض المحضر
async function viewProtocol(protocolId) {
    try {
        const token = getAuthToken();
        if (!token) {
            throw new Error('غير مصرح لك، يرجى تسجيل الدخول مرة أخرى');
        }

        // إنشاء رابط تحميل PDF
        const downloadUrl = `http://localhost:3006/api/protocols/${protocolId}/pdf`;
        
        // فتح PDF في نافذة جديدة
        const response = await fetch(downloadUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'فشل في تحميل ملف PDF');
        }

        // تحويل الاستجابة إلى blob
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        // فتح PDF في نافذة جديدة
        const newWindow = window.open(url, '_blank');
        
        // تنظيف الذاكرة بعد فتح النافذة
        setTimeout(() => {
            window.URL.revokeObjectURL(url);
        }, 1000);
        
        showToast('تم فتح ملف PDF بنجاح', 'success');
    } catch (error) {
        console.error('Error viewing PDF:', error);
        showToast(error.message || 'حدث خطأ أثناء عرض ملف PDF', 'error');
    }
}

// تعديل المحضر
function editProtocol(protocolId) {
    // فتح صفحة النموذج بوضع التعديل وتمرير معرف المحضر عبر الاستعلام
    window.location.href = `/frontend/html/protocol-form.html?id=${encodeURIComponent(protocolId)}&mode=edit`;
}

// حذف المحضر
async function deleteProtocol(protocolId) {
    if (!confirm('هل أنت متأكد من حذف هذا المحضر؟')) {
        return;
    }

    try {
        const token = getAuthToken();
        if (!token) {
            throw new Error('غير مصرح لك، يرجى تسجيل الدخول مرة أخرى');
        }

        const response = await fetch(`http://localhost:3006/api/protocols/${protocolId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'فشل في حذف المحضر');
        }

        const result = await response.json();
        showToast(result.message || 'تم حذف المحضر بنجاح', 'success');
        loadProtocols(); // إعادة تحميل البيانات
        
    } catch (error) {
        console.error('خطأ في حذف المحضر:', error);
        showToast(error.message || 'حدث خطأ في حذف المحضر', 'error');
    }
}

// إظهار رسالة التحميل
function showLoading(show) {
    const loadingMessage = document.getElementById('loadingMessage');
    const tableBody = document.getElementById('protocolTableBody');
    
    if (loadingMessage) {
        loadingMessage.style.display = show ? 'flex' : 'none';
    }
    
    if (tableBody) {
        tableBody.style.display = show ? 'none' : 'table-row-group';
    }
}

// إظهار رسالة عدم وجود بيانات
function showNoDataMessage() {
    const noDataMessage = document.getElementById('noDataMessage');
    const tableBody = document.getElementById('protocolTableBody');
    
    if (noDataMessage) {
        noDataMessage.style.display = 'flex';
    }
    
    if (tableBody) {
        tableBody.style.display = 'none';
    }
}

// إخفاء رسالة عدم وجود بيانات
function hideNoDataMessage() {
    const noDataMessage = document.getElementById('noDataMessage');
    const tableBody = document.getElementById('protocolTableBody');
    
    if (noDataMessage) {
        noDataMessage.style.display = 'none';
    }
    
    if (tableBody) {
        tableBody.style.display = 'table-row-group';
    }
}

// إظهار رسالة Toast
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // إضافة أيقونة حسب نوع الرسالة
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    
    toast.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;

    toastContainer.appendChild(toast);

    // إزالة الرسالة بعد 5 ثوان
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease-in forwards';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 5000);
}

// الحصول على رمز المصادقة
function getAuthToken() {
    return localStorage.getItem('token');
}


// دالة debounce للبحث
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// إعادة تحديث الجدول عند تغيير اللغة
function refreshProtocolsDisplay() {
    renderProtocols();
}

// تصدير الدوال للاستخدام العام
window.clearFilters = clearFilters;
window.applyFilters = applyFilters;
window.previousPage = previousPage;
window.nextPage = nextPage;
window.viewProtocol = viewProtocol;
window.editProtocol = editProtocol;
window.deleteProtocol = deleteProtocol;
window.refreshProtocolsDisplay = refreshProtocolsDisplay;

// إعادة تحديث عند تغيير اللغة
window.addEventListener('storage', function(e) {
    if (e.key === 'language') {
        refreshProtocolsDisplay();
    }
});

