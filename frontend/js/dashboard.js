async function fetchStats() {
  const res = await fetch('http://localhost:3006/api/dashboard/stats');
  const json = await res.json();
  return json.data;    // والـ renderStats(stats) ينتظر حقل stats.rejected, الخ…
}


async function fetchClosedWeek() {
  const res = await fetch('http://localhost:3006/api/dashboard/closed-week');
  const json = await res.json();
  return json.data;    // بدل إرجاع الكائن كامل
}

function renderStats({ rejected, closed, current, new_tickets }) {
  document.querySelector('.stat-card:nth-child(1) .stat-value').textContent = rejected;
  document.querySelector('.stat-card:nth-child(2) .stat-value').textContent = closed;
  document.querySelector('.stat-card:nth-child(3) .stat-value').textContent = current;
  document.querySelector('.stat-card:nth-child(4) .stat-value').textContent = new_tickets;
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
