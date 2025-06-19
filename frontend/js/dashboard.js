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
})();
