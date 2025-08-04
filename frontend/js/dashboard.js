async function fetchStats() {
  const token = localStorage.getItem('token');
  const res = await fetch('http://localhost:3006/api/dashboard/stats', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (res.status === 401) {
    alert(getTranslation('please-login'));
    return {};
  }
  const json = await res.json();
  return json.data;
}

async function fetchClosedWeek() {
  const token = localStorage.getItem('token');
  const res = await fetch('http://localhost:3006/api/dashboard/closed-week', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (res.status === 401) {
    alert(getTranslation('please-login'));
    return [];
  }
  const json = await res.json();
  return json.data;
}

function getTranslation(key) {
  const lang = localStorage.getItem('language') || document.documentElement.lang || 'ar';
  if (window.translations && window.translations[lang] && window.translations[lang][key]) {
    return window.translations[lang][key];
  }
  return key;
}

// وظيفة تصدير الداشبورد إلى Excel
async function exportDashboardToExcel() {
  try {
    // إظهار رسالة تحميل
    showToast(getTranslation('exporting'), 'info');
    
    const token = localStorage.getItem('token');
    const response = await fetch('http://localhost:3006/api/dashboard/export-excel', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 401) {
      showToast(getTranslation('please-login'), 'error');
      return;
    }

    if (!response.ok) {
      throw new Error('فشل في تصدير التقرير');
    }

    // تحميل الملف
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-report-${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    showToast(getTranslation('export-success'), 'success');
  } catch (error) {
    console.error('خطأ في تصدير التقرير:', error);
    showToast(getTranslation('export-error'), 'error');
  }
}

// وظيفة إظهار رسائل Toast
function showToast(message, type = 'info') {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  toastContainer.appendChild(toast);

  // إظهار Toast
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  }, 100);

  // إخفاء Toast بعد 3 ثوان
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-100%)';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 3000);
}

function renderStats(data) {
  document.getElementById('closed-tickets').textContent = data.closed;
  document.getElementById('new-tickets').textContent = data.new_tickets;
  document.getElementById('total-users').textContent = data.total_users;
  document.getElementById('admin-count').textContent = data.admins;
  document.getElementById('pending-contents').textContent = data.pending_contents;
  document.getElementById('approved-contents').textContent = data.approved_contents;
  document.getElementById('committee-count').textContent = data.committees;
  document.getElementById('pending-committee-contents').textContent = data.committee_contents_pending;
}

function makeCardsClickable() {
  // جعل بطاقة التذاكر المغلقة قابلة للنقر
  const closedTicketsElement = document.getElementById('closed-tickets');
  if (closedTicketsElement) {
    const closedCard = closedTicketsElement.closest('.stat-card');
    if (closedCard) {
      closedCard.style.cursor = 'pointer';
      closedCard.addEventListener('click', () => {
        window.location.href = 'ticket-list.html';
      });
    }
  }

  // جعل بطاقة التذاكر الجديدة قابلة للنقر
  const newTicketsElement = document.getElementById('new-tickets');
  if (newTicketsElement) {
    const newCard = newTicketsElement.closest('.stat-card');
    if (newCard) {
      newCard.style.cursor = 'pointer';
      newCard.addEventListener('click', () => {
        window.location.href = 'ticket-list.html';
      });
    }
  }

  // جعل بطاقة محتويات بانتظار الاعتماد قابلة للنقر
  const pendingContentsElement = document.getElementById('pending-contents');
  if (pendingContentsElement) {
    const pendingCard = pendingContentsElement.closest('.stat-card');
    if (pendingCard) {
      pendingCard.style.cursor = 'pointer';
      pendingCard.addEventListener('click', () => {
        window.location.href = 'approvals-recived.html';
      });
    }
  }

  // جعل بطاقة المحتويات المعتمدة قابلة للنقر
  const approvedContentsElement = document.getElementById('approved-contents');
  if (approvedContentsElement) {
    const approvedCard = approvedContentsElement.closest('.stat-card');
    if (approvedCard) {
      approvedCard.style.cursor = 'pointer';
      approvedCard.addEventListener('click', () => {
        window.location.href = 'approvals-recived.html';
      });
    }
  }

  // جعل بطاقة عدد اللجان قابلة للنقر
  const committeeCountElement = document.getElementById('committee-count');
  if (committeeCountElement) {
    const committeeCard = committeeCountElement.closest('.stat-card');
    if (committeeCard) {
      committeeCard.style.cursor = 'pointer';
      committeeCard.addEventListener('click', () => {
        window.location.href = 'committees.html';
      });
    }
  }

  // جعل بطاقة محتويات اللجان بانتظار الاعتماد قابلة للنقر
  const pendingCommitteeContentsElement = document.getElementById('pending-committee-contents');
  if (pendingCommitteeContentsElement) {
    const pendingCommitteeCard = pendingCommitteeContentsElement.closest('.stat-card');
    if (pendingCommitteeCard) {
      pendingCommitteeCard.style.cursor = 'pointer';
      pendingCommitteeCard.addEventListener('click', () => {
        window.location.href = 'approvals-recived.html';
      });
    }
  }

  // جعل بطاقة عدد المستخدمين قابلة للنقر
  const totalUsersElement = document.getElementById('total-users');
  if (totalUsersElement) {
    const totalUsersCard = totalUsersElement.closest('.stat-card');
    if (totalUsersCard) {
      totalUsersCard.style.cursor = 'pointer';
      totalUsersCard.addEventListener('click', () => {
        window.location.href = 'permissions.html';
      });
    }
  }

  // جعل بطاقة عدد المشرفين قابلة للنقر
  const adminCountElement = document.getElementById('admin-count');
  if (adminCountElement) {
    const adminCountCard = adminCountElement.closest('.stat-card');
    if (adminCountCard) {
      adminCountCard.style.cursor = 'pointer';
      adminCountCard.addEventListener('click', () => {
        window.location.href = 'permissions.html';
      });
    }
  }
}


function renderChart(data) {
  const lang = localStorage.getItem('language') || document.documentElement.lang || 'ar';
  const daysAr = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  const daysEn = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const labels = data.map(r => {
    const d = new Date(r.date);
    return lang === 'en' ? daysEn[d.getDay()] : daysAr[d.getDay()];
  });
  const counts = data.map(r => r.closed_count);

  new Chart(
    document.getElementById('ticketsChart').getContext('2d'),
    {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: getTranslation('closed-tickets'),
          data: counts,
          backgroundColor: '#3a7ffb',
          borderColor:   '#3a7ffb',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, grid: { color: '#e0e0e0', drawBorder: false } },
          x: { grid: { display: false } }
        },
        plugins: {
          legend:  { display: false },
          tooltip: {
            rtl: lang !== 'en',
            callbacks: {
              title: ctx => ctx[0].label,
              label: ctx => getTranslation('closed-tickets') + ': ' + ctx.parsed.y
            }
          }
        }
      }
    }
  );
}

(async () => {
  const stats     = await fetchStats();
  const closed7d  = await fetchClosedWeek();
  renderStats(stats);
  renderChart(closed7d);
  makeCardsClickable();
})();
