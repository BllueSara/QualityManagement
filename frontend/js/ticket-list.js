// scripts.js
apiBase = 'http://localhost:3006/api';
let permissionsKeys = [];

async function fetchPermissions() {
  const token = localStorage.getItem('token');
  if (!token) return;
  const payload = JSON.parse(atob(token.split('.')[1] || '{}'));
  const userRole = payload.role;

  // الإدمن دائماً يرى كل شيء
  if (['admin','sub-admin'].includes(userRole)) {
    permissionsKeys = ['*'];
    return;
  }

  // خلاف ذلك جلب الصلاحيات من API
  const userId = payload.id;
  const res = await fetch(`${apiBase}/users/${userId}/permissions`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) return;
  const { data: perms } = await res.json();
  permissionsKeys = perms.map(p =>
    typeof p === 'string' ? p : (p.permission || p.permission_key)
  );
}

document.addEventListener('DOMContentLoaded', async () => {
    const searchInput = document.getElementById('searchInput');
    const ticketsBody = document.getElementById('ticketsBody');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const pageNumbers = Array.from(document.querySelectorAll('.page-number'));
  
    let currentPage = 1;
    const rowsPerPage = 5;
    let tickets = [];
    let filteredTickets = [];

    // Fetch tickets from the backend
    async function fetchTickets() {
        try {
            const response = await fetch('http://localhost:3006/api/tickets/assigned', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            if (!response.ok) throw new Error('Failed to fetch tickets');
const body = await response.json();
if (body.status !== 'success') throw new Error(body.message);
tickets = body.data;
            filteredTickets = [...tickets];
            renderTickets();
            showPage(1);
        } catch (error) {
            console.error('Error fetching tickets:', error);
            alert('حدث خطأ أثناء جلب التذاكر');
        }
    }

    // Render tickets in the table
function renderTickets() {
  ticketsBody.innerHTML = '';
  filteredTickets.forEach(ticket => {
    const canEdit   = permissionsKeys.includes('*') || permissionsKeys.includes('edit_ticket');
    const canDelete = permissionsKeys.includes('*') || permissionsKeys.includes('delete_ticket');

    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="col-ticket">#${ticket.id}</td>
      <td class="col-status">
        <span class="status-badge status-${getStatusClass(ticket.current_status)}">
          ${getStatusText(ticket.current_status)}
        </span>
      </td>
      <td class="col-location">${ticket.event_location || '—'}</td>
      <td class="col-date">${formatDate(ticket.created_at)}</td>
      <td class="col-actions">
        <i class="fas fa-eye action-icon view-icon"
           title="عرض"
           style="cursor: pointer;"
           data-ticket-id="${ticket.id}"></i>
        ${canEdit   ? `<i class="fas fa-pencil-alt action-icon edit-icon"   title="تعديل"   data-ticket-id="${ticket.id}"></i>` : ''}
        ${canDelete ? `<i class="fas fa-trash-alt action-icon delete-icon"  title="حذف"     data-ticket-id="${ticket.id}"></i>` : ''}
      </td>
    `;
    ticketsBody.appendChild(row);
  });

  // ربط الأحداث بعد الإنشاء:
  document.querySelectorAll('.view-icon').forEach(icon => {
    icon.addEventListener('click', e =>
      window.location.href = `ticket-details.html?id=${e.target.dataset.ticketId}`
    );
  });
  document.querySelectorAll('.edit-icon').forEach(icon => {
    icon.addEventListener('click', e =>
      window.location.href = `ticket-edit.html?id=${e.target.dataset.ticketId}`
    );
  });
  document.querySelectorAll('.delete-icon').forEach(icon => {
    icon.addEventListener('click', async e => {
      const id = e.target.dataset.ticketId;
      if (!confirm('هل أنت متأكد من حذف هذه التذكرة؟')) return;
      const res = await fetch(`${apiBase}/tickets/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) await fetchTickets();
      else alert('فشل حذف التذكرة');
    });
  });

    }

    // Helper function to get status class
    function getStatusClass(status) {
        const statusMap = {
            'pending': 'yellow',
            'in_progress': 'yellow',
            'completed': 'green',
            'closed': 'gray'
        };
        return statusMap[status] || 'gray';
    }

    // Helper function to get status text
    function getStatusText(status) {
        const statusMap = {
            'pending': 'قيد الانتظار',
            'in_progress': 'قيد المعالجة',
            'completed': 'تم الرد',
            'closed': 'مغلقة'
        };
        return statusMap[status] || status;
    }

    // Helper function to format date
    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ar-SA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
  
    // Show page function
    function showPage(page) {
        const startIdx = (page - 1) * rowsPerPage;
        const endIdx = startIdx + rowsPerPage;
        const rows = Array.from(ticketsBody.querySelectorAll('tr'));
  
        rows.forEach((row, idx) => {
            row.style.display = idx >= startIdx && idx < endIdx ? '' : 'none';
        });
  
        pageNumbers.forEach((btn) => {
            btn.classList.toggle('active', Number(btn.dataset.page) === page);
        });
  
        prevPageBtn.disabled = page === 1;
        nextPageBtn.disabled = page === Math.ceil(filteredTickets.length / rowsPerPage);
  
        currentPage = page;
  
        const totalRows = filteredTickets.length;
        const firstRec = startIdx + 1;
        const lastRec = Math.min(endIdx, totalRows);
        const recordsInfo = document.querySelector('.records-info');
        recordsInfo.textContent = `عرض ${firstRec}-${lastRec} من ${totalRows} تذكرة`;
    }
  
    // Search functionality
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim().toLowerCase();
  
        if (query === '') {
            filteredTickets = [...tickets];
        } else {
            filteredTickets = tickets.filter(ticket => 
                ticket.id.toString().includes(query) ||
                ticket.type.toLowerCase().includes(query) ||
                ticket.location.toLowerCase().includes(query)
            );
        }
  
        renderTickets();
        showPage(1);
    });
  
    // Pagination event listeners
    pageNumbers.forEach((btn) => {
        btn.addEventListener('click', () => {
            const page = Number(btn.dataset.page);
            if (page !== currentPage) {
                showPage(page);
            }
        });
    });
  
    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            showPage(currentPage - 1);
        }
    });
  
    nextPageBtn.addEventListener('click', () => {
        if (currentPage < Math.ceil(filteredTickets.length / rowsPerPage)) {
            showPage(currentPage + 1);
        }
    });

    // Initial fetch of tickets
      await fetchPermissions();

    await fetchTickets();
});