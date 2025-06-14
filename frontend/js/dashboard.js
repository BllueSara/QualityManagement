async function fetchStats() {
  const token = localStorage.getItem('token');
  const res = await fetch('http://localhost:3006/api/dashboard/stats', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (res.status === 401) {
    // يمكنك هنا إعادة توجيه المستخدم لتسجيل الدخول أو إظهار رسالة
    alert('يُرجى تسجيل الدخول أولاً');
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
    alert('يُرجى تسجيل الدخول أولاً');
    return [];
  }
  const json = await res.json();
  return json.data;
}




function renderStats({  closed, new_tickets }) {
  document.querySelector('.stat-card:nth-child(2) .stat-value').textContent = closed;
  document.querySelector('.stat-card:nth-child(3) .stat-value').textContent = new_tickets;
}

function renderChart(data) {
  const labels = data.map(r => {
    const d = new Date(r.date);
    // خريطة من اسم اليوم بالإنجليزي للعربي
    const daysAr = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
    return daysAr[d.getDay()];
  });
  const counts = data.map(r => r.closed_count);

  new Chart(
    document.getElementById('ticketsChart').getContext('2d'),
    {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'التذاكر المغلقة',
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
            rtl: true,
            callbacks: {
              title: ctx => ctx[0].label,
              label: ctx => 'التذاكر المغلقة: ' + ctx.parsed.y
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
})();
