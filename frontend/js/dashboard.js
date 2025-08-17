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

// دالة جلب إحصائيات الأقسام
async function fetchDepartmentStats() {
  const token = localStorage.getItem('token');
  const res = await fetch('http://localhost:3006/api/dashboard/department-stats', {
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

// دالة جلب إحصائيات اللجان
async function fetchCommitteeStats() {
  const token = localStorage.getItem('token');
  const res = await fetch('http://localhost:3006/api/dashboard/committee-stats', {
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

// دالة جلب الأداء الشهري
async function fetchMonthlyPerformance() {
  const token = localStorage.getItem('token');
  const res = await fetch('http://localhost:3006/api/dashboard/monthly-performance', {
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

// دالة جلب إحصائيات المحاضر
async function fetchProtocolStats() {
  const token = localStorage.getItem('token');
  const res = await fetch('http://localhost:3006/api/dashboard/protocol-stats', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (res.status === 401) {
    alert(getTranslation('please-login'));
    return { monthlyData: [], totalStats: {} };
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

// دالة معالجة اسم القسم حسب اللغة
function getDepartmentNameByLanguage(departmentNameData, userLanguage = 'ar') {
  try {
    // إذا كان الاسم JSON يحتوي على اللغتين
    if (typeof departmentNameData === 'string' && departmentNameData.startsWith('{')) {
      const parsed = JSON.parse(departmentNameData);
      return parsed[userLanguage] || parsed['ar'] || departmentNameData;
    }
    // إذا كان نص عادي
    return departmentNameData || 'غير معروف';
  } catch (error) {
    // في حالة فشل التحليل، إرجاع النص كما هو
    return departmentNameData || 'غير معروف';
  }
}

// دالة معالجة اسم اللجنة حسب اللغة
function getCommitteeNameByLanguage(committeeNameData, userLanguage = 'ar') {
  try {
    // إذا كان الاسم JSON يحتوي على اللغتين
    if (typeof committeeNameData === 'string' && committeeNameData.startsWith('{')) {
      const parsed = JSON.parse(committeeNameData);
      return parsed[userLanguage] || parsed['ar'] || committeeNameData;
    }
    // إذا كان نص عادي
    return committeeNameData || 'غير معروف';
  } catch (error) {
    // في حالة فشل التحليل، إرجاع النص كما هو
    return committeeNameData || 'غير معروف';
  }
}

// دالة تحديث عناوين الرسوم البيانية
function updateChartTitles() {
  const lang = localStorage.getItem('language') || document.documentElement.lang || 'ar';
  const titles = document.querySelectorAll('[data-translate]');
  titles.forEach(element => {
    const key = element.getAttribute('data-translate');
    const translation = getTranslation(key);
    if (translation && translation !== key) {
      element.textContent = translation;
    }
  });
}

// دالة لتنظيف الرسوم البيانية الموجودة
function destroyExistingCharts() {
  const chartIds = ['ticketsChart', 'departmentChart', 'departmentPerformanceChart', 'committeeChart', 'committeePerformanceChart', 'monthlyTrendsChart', 'protocolChart'];
  chartIds.forEach(chartId => {
    const canvas = document.getElementById(chartId);
    if (canvas) {
      const existingChart = Chart.getChart(canvas);
      if (existingChart) {
        existingChart.destroy();
      }
    }
  });
}

// دالة للتحقق من وجود العناصر قبل الرسم
function ensureCanvasExists(chartId) {
  const canvas = document.getElementById(chartId);
  if (!canvas) {
    console.error(`Canvas element with id '${chartId}' not found`);
    return null;
  }
  return canvas;
}

// دالة لمعالجة أحداث النقر على الرسوم البيانية
function handleChartClick(event, chart) {
  try {
    const points = chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, true);
    if (points.length) {
      const firstPoint = points[0];
      const label = chart.data.labels[firstPoint.index];
      const value = chart.data.datasets[firstPoint.datasetIndex].data[firstPoint.index];
      
      // يمكن إضافة منطق إضافي هنا للتفاعل مع النقر
      console.log(`Clicked on: ${label} with value: ${value}`);
    }
  } catch (error) {
    console.error('Error handling chart click:', error);
  }
}

// دالة لتعطيل النقر على الرسوم البيانية إذا لزم الأمر
function disableChartClicks() {
  const canvases = document.querySelectorAll('.chart-container canvas');
  canvases.forEach(canvas => {
    canvas.style.pointerEvents = 'none';
  });
}

// دالة لتمكين النقر على الرسوم البيانية
function enableChartClicks() {
  // تمكين التفاعل مع الرسوم البيانية
  const charts = Chart.getChart ? Object.values(Chart.instances) : [];
  charts.forEach(chart => {
    if (chart && chart.canvas) {
      chart.canvas.style.pointerEvents = 'auto';
      chart.canvas.style.cursor = 'default';
    }
  });
}

// دالة التأكد من عمل التلميحات
function ensureTooltipsWork() {
  // التأكد من أن Chart.js متاح
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js not loaded');
    return;
  }

  // إضافة معالج أخطاء للتلميحات
  const originalTooltip = Chart.defaults.plugins.tooltip;
  if (originalTooltip) {
    originalTooltip.enabled = true;
    originalTooltip.mode = 'nearest';
    originalTooltip.intersect = false;
  }

  // إضافة معالج للتأكد من عمل التلميحات
  document.addEventListener('mouseover', function(e) {
    if (e.target.tagName === 'CANVAS') {
      const chart = Chart.getChart(e.target);
      if (chart) {
        // التأكد من أن التلميحات مفعلة
        if (chart.options.plugins && chart.options.plugins.tooltip) {
          chart.options.plugins.tooltip.enabled = true;
        }
      }
    }
  });
}

// دالة تشخيص مشاكل التلميحات
function debugTooltips() {
  console.log('=== Tooltip Debug Information ===');
  
  // التحقق من وجود Chart.js
  if (typeof Chart === 'undefined') {
    console.error('Chart.js is not loaded!');
    return;
  }
  console.log('✓ Chart.js is loaded');
  
  // التحقق من الرسوم البيانية الموجودة
  const charts = Chart.getChart ? Object.values(Chart.instances) : [];
  console.log(`Found ${charts.length} charts:`, charts.map(chart => chart.id || 'unnamed'));
  
  // فحص إعدادات التلميحات لكل رسم بياني
  charts.forEach((chart, index) => {
    console.log(`Chart ${index + 1} (${chart.id || 'unnamed'}):`);
    console.log('  - Canvas element:', chart.canvas);
    console.log('  - Tooltip enabled:', chart.options.plugins?.tooltip?.enabled);
    console.log('  - Tooltip mode:', chart.options.plugins?.tooltip?.mode);
    console.log('  - Tooltip intersect:', chart.options.plugins?.tooltip?.intersect);
    console.log('  - Canvas pointer-events:', chart.canvas?.style.pointerEvents);
    console.log('  - Canvas cursor:', chart.canvas?.style.cursor);
  });
  
  // التحقق من عناصر Canvas في DOM
  const canvases = document.querySelectorAll('.chart-container canvas');
  console.log(`Found ${canvases.length} canvas elements in DOM:`, canvases);
  
  canvases.forEach((canvas, index) => {
    console.log(`Canvas ${index + 1}:`);
    console.log('  - Element:', canvas);
    console.log('  - Parent container:', canvas.parentElement);
    console.log('  - CSS pointer-events:', getComputedStyle(canvas).pointerEvents);
    console.log('  - CSS cursor:', getComputedStyle(canvas).cursor);
    console.log('  - CSS z-index:', getComputedStyle(canvas).zIndex);
  });
  
  console.log('=== End Tooltip Debug ===');
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
  
  // إضافة إحصائيات المحاضر
  const totalProtocolsElement = document.getElementById('total-protocols');
  const pendingProtocolsElement = document.getElementById('pending-protocols');
  const approvedProtocolsElement = document.getElementById('approved-protocols');
  const rejectedProtocolsElement = document.getElementById('rejected-protocols');
  
  if (totalProtocolsElement) totalProtocolsElement.textContent = data.total_protocols || 0;
  if (pendingProtocolsElement) pendingProtocolsElement.textContent = data.pending_protocols || 0;
  if (approvedProtocolsElement) approvedProtocolsElement.textContent = data.approved_protocols || 0;
  if (rejectedProtocolsElement) rejectedProtocolsElement.textContent = data.rejected_protocols || 0;
}

function makeCardsClickable() {
  // إزالة event listeners الموجودة لتجنب التكرار
  const statCards = document.querySelectorAll('.stat-card');
  statCards.forEach(card => {
    const newCard = card.cloneNode(true);
    card.parentNode.replaceChild(newCard, card);
  });

  // جعل بطاقة التذاكر المغلقة قابلة للنقر
  const closedTicketsElement = document.getElementById('closed-tickets');
  if (closedTicketsElement) {
    const closedCard = closedTicketsElement.closest('.stat-card');
    if (closedCard) {
      closedCard.style.cursor = 'pointer';
      closedCard.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
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
      newCard.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
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
      pendingCard.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
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
      approvedCard.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
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
      committeeCard.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
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
      pendingCommitteeCard.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
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
      totalUsersCard.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
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
      adminCountCard.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.location.href = 'permissions.html';
      });
    }
  }

  // جعل بطاقات المحاضر قابلة للنقر
  const protocolElements = [
    'total-protocols', 
    'pending-protocols', 
    'approved-protocols', 
    'rejected-protocols'
  ];
  
  protocolElements.forEach(elementId => {
    const element = document.getElementById(elementId);
    if (element) {
      const card = element.closest('.stat-card');
      if (card) {
        card.style.cursor = 'pointer';
        card.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          window.location.href = 'protocol-list.html';
        });
      }
    }
  });
}


function renderChart(data) {
  const canvas = ensureCanvasExists('ticketsChart');
  if (!canvas) return;

  const lang = localStorage.getItem('language') || document.documentElement.lang || 'ar';
  const daysAr = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  const daysEn = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const labels = data.map(r => {
    const d = new Date(r.date);
    return lang === 'en' ? daysEn[d.getDay()] : daysAr[d.getDay()];
  });
  const counts = data.map(r => r.closed_count);

  try {
    new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: getTranslation('closed-tickets'),
          data: counts,
          backgroundColor: '#3a7ffb',
          borderColor: '#3a7ffb',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        },
        scales: {
          y: { 
            beginAtZero: true, 
            grid: { color: '#e0e0e0', drawBorder: false },
            ticks: {
              font: {
                size: 13,
                family: "'Tajawal', 'Arial', sans-serif"
              }
            }
          },
          x: { 
            grid: { display: false },
            ticks: {
              font: {
                size: 13,
                family: "'Tajawal', 'Arial', sans-serif"
              }
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: true,
            mode: 'nearest',
            intersect: false,
            callbacks: {
              label: function(context) {
                return getTranslation('closed-tickets') + ': ' + context.parsed.y;
              }
            },
            titleFont: {
              size: 14,
              family: "'Tajawal', 'Arial', sans-serif"
            },
            bodyFont: {
              size: 13,
              family: "'Tajawal', 'Arial', sans-serif"
            }
          }
        }
      }
    });
  } catch (error) {
    console.error('Error rendering tickets chart:', error);
  }
}

// دالة عرض رسم بياني دائري للأقسام
function renderDepartmentChart(data) {
  if (!data || data.length === 0) {
    const canvas = document.getElementById('departmentChart');
    if (canvas) {
      canvas.style.display = 'none';
      canvas.parentElement.innerHTML = '<div class="chart-loading">لا توجد بيانات متاحة</div>';
    }
    return;
  }

  const lang = localStorage.getItem('language') || document.documentElement.lang || 'ar';
  const labels = data.map(d => getDepartmentNameByLanguage(d.department_name, lang));
  const approvedData = data.map(d => d.approved_contents);
  const pendingData = data.map(d => d.pending_contents);

  try {
    new Chart(
      document.getElementById('departmentChart').getContext('2d'),
      {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            label: getTranslation('approved-contents'),
            data: approvedData,
            backgroundColor: [
              '#28a745', '#20c997', '#17a2b8', '#007bff', '#6f42c1',
              '#e83e8c', '#fd7e14', '#ffc107', '#28a745', '#6c757d'
            ],
            borderWidth: 2,
            borderColor: '#ffffff'
          }, {
            label: getTranslation('pending-contents'),
            data: pendingData,
            backgroundColor: [
              '#dc3545', '#fd7e14', '#ffc107', '#17a2b8', '#6f42c1',
              '#e83e8c', '#28a745', '#20c997', '#007bff', '#6c757d'
            ],
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'nearest',
            intersect: false
          },
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                padding: 20,
                usePointStyle: true,
                font: { 
                  size: 13,
                  family: "'Tajawal', 'Arial', sans-serif"
                }
              }
            },
            tooltip: {
              enabled: true,
              mode: 'nearest',
              intersect: false,
              callbacks: {
                label: function(context) {
                  const label = context.label || '';
                  const value = context.parsed;
                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                  const percentage = ((value / total) * 100).toFixed(1);
                  return `${label}: ${value} (${percentage}%)`;
                }
              },
              titleFont: {
                size: 14,
                family: "'Tajawal', 'Arial', sans-serif"
              },
              bodyFont: {
                size: 13,
                family: "'Tajawal', 'Arial', sans-serif"
              }
            }
          }
        }
      }
    );
  } catch (error) {
    console.error('Error rendering department chart:', error);
  }
}

// دالة عرض رسم بياني شريطي لأداء الأقسام
function renderDepartmentPerformanceChart(data) {
  if (!data || data.length === 0) {
    const canvas = document.getElementById('departmentPerformanceChart');
    if (canvas) {
      canvas.style.display = 'none';
      canvas.parentElement.innerHTML = '<div class="chart-loading">لا توجد بيانات متاحة</div>';
    }
    return;
  }

  const lang = localStorage.getItem('language') || document.documentElement.lang || 'ar';
  const labels = data.map(d => getDepartmentNameByLanguage(d.department_name, lang));
  const approvalRates = data.map(d => parseFloat(d.approval_rate));

  try {
    new Chart(
      document.getElementById('departmentPerformanceChart').getContext('2d'),
      {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: getTranslation('approval-rate') + ' (%)',
            data: approvalRates,
            backgroundColor: approvalRates.map(rate => 
              rate >= 80 ? '#28a745' : 
              rate >= 60 ? '#ffc107' : 
              rate >= 40 ? '#fd7e14' : '#dc3545'
            ),
            borderColor: approvalRates.map(rate => 
              rate >= 80 ? '#1e7e34' : 
              rate >= 60 ? '#e0a800' : 
              rate >= 40 ? '#e55a00' : '#c82333'
            ),
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false
          },
          scales: {
            y: { 
              beginAtZero: true, 
              max: 100,
              grid: { color: '#e0e0e0', drawBorder: false },
              ticks: {
                callback: function(value) {
                  return value + '%';
                },
                font: {
                  size: 13,
                  family: "'Tajawal', 'Arial', sans-serif"
                }
              }
            },
            x: { 
              grid: { display: false },
              ticks: {
                maxRotation: 0,
                minRotation: 0,
                autoSkip: true,
                maxTicksLimit: 8,
                font: {
                  size: 13,
                  family: "'Tajawal', 'Arial', sans-serif"
                }
              }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              enabled: true,
              mode: 'nearest',
              intersect: false,
              callbacks: {
                label: function(context) {
                  return getTranslation('approval-rate') + ': ' + context.parsed.y + '%';
                }
              },
              titleFont: {
                size: 14,
                family: "'Tajawal', 'Arial', sans-serif"
              },
              bodyFont: {
                size: 13,
                family: "'Tajawal', 'Arial', sans-serif"
              }
            }
          }
        }
      }
    );
  } catch (error) {
    console.error('Error rendering department performance chart:', error);
  }
}

// دالة عرض رسم بياني للجان
function renderCommitteeChart(data) {
  if (!data || data.length === 0) {
    const canvas = document.getElementById('committeeChart');
    if (canvas) {
      canvas.style.display = 'none';
      canvas.parentElement.innerHTML = '<div class="chart-loading">لا توجد بيانات متاحة</div>';
    }
    return;
  }

  const lang = localStorage.getItem('language') || document.documentElement.lang || 'ar';
  const labels = data.map(c => getCommitteeNameByLanguage(c.committee_name, lang));
  const approvedData = data.map(c => c.approved_contents);
  const pendingData = data.map(c => c.pending_contents);
  const rejectedData = data.map(c => c.rejected_contents);

  try {
    new Chart(
      document.getElementById('committeeChart').getContext('2d'),
      {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: getTranslation('approved-contents'),
            data: approvedData,
            backgroundColor: '#28a745',
            borderColor: '#1e7e34',
            borderWidth: 1
          }, {
            label: getTranslation('pending-contents'),
            data: pendingData,
            backgroundColor: '#ffc107',
            borderColor: '#e0a800',
            borderWidth: 1
          }, {
            label: getTranslation('rejected-contents'),
            data: rejectedData,
            backgroundColor: '#dc3545',
            borderColor: '#c82333',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false
          },
          scales: {
            y: { 
              beginAtZero: true, 
              grid: { color: '#e0e0e0', drawBorder: false },
              ticks: {
                font: {
                  size: 13,
                  family: "'Tajawal', 'Arial', sans-serif"
                }
              }
            },
            x: { 
              grid: { display: false },
              ticks: {
                maxRotation: 0,
                minRotation: 0,
                autoSkip: true,
                maxTicksLimit: 8,
                font: {
                  size: 13,
                  family: "'Tajawal', 'Arial', sans-serif"
                }
              }
            }
          },
          plugins: {
            legend: {
              position: 'top',
              labels: {
                padding: 20,
                usePointStyle: true,
                font: {
                  size: 13,
                  family: "'Tajawal', 'Arial', sans-serif"
                }
              }
            },
            tooltip: {
              enabled: true,
              mode: 'nearest',
              intersect: false,
              callbacks: {
                label: function(context) {
                  return context.dataset.label + ': ' + context.parsed.y;
                }
              },
              titleFont: {
                size: 14,
                family: "'Tajawal', 'Arial', sans-serif"
              },
              bodyFont: {
                size: 13,
                family: "'Tajawal', 'Arial', sans-serif"
              }
            }
          }
        }
      }
    );
  } catch (error) {
    console.error('Error rendering committee chart:', error);
  }
}

// دالة عرض رسم بياني لأداء اللجان (معدل الاعتماد)
function renderCommitteePerformanceChart(data) {
  if (!data || data.length === 0) {
    const canvas = document.getElementById('committeePerformanceChart');
    if (canvas) {
      canvas.style.display = 'none';
      canvas.parentElement.innerHTML = '<div class="chart-loading">لا توجد بيانات متاحة</div>';
    }
    return;
  }

  const lang = localStorage.getItem('language') || document.documentElement.lang || 'ar';
  const labels = data.map(c => getCommitteeNameByLanguage(c.committee_name, lang));
  const approvalRates = data.map(c => parseFloat(c.approval_rate) || 0);

  try {
    new Chart(
      document.getElementById('committeePerformanceChart').getContext('2d'),
      {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data: approvalRates,
            backgroundColor: [
              '#28a745', '#20c997', '#17a2b8', '#6f42c1', '#fd7e14',
              '#e83e8c', '#6c757d', '#343a40', '#007bff', '#6610f2'
            ],
            borderWidth: 2,
            borderColor: '#fff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'nearest',
            intersect: false
          },
          plugins: {
            legend: {
              position: 'right',
              labels: {
                padding: 15,
                usePointStyle: true,
                font: {
                  size: 13,
                  family: "'Tajawal', 'Arial', sans-serif"
                }
              }
            },
            tooltip: {
              enabled: true,
              mode: 'nearest',
              intersect: false,
              callbacks: {
                label: function(context) {
                  return context.label + ': ' + context.parsed + '%';
                }
              },
              titleFont: {
                size: 14,
                family: "'Tajawal', 'Arial', sans-serif"
              },
              bodyFont: {
                size: 13,
                family: "'Tajawal', 'Arial', sans-serif"
              }
            }
          }
        }
      }
    );
  } catch (error) {
    console.error('Error rendering committee performance chart:', error);
  }
}

// دالة عرض رسم بياني خطي للأداء الشهري
function renderMonthlyTrendsChart(data) {
  if (!data || data.length === 0) {
    const canvas = document.getElementById('monthlyTrendsChart');
    if (canvas) {
      canvas.style.display = 'none';
      canvas.parentElement.innerHTML = '<div class="chart-loading">لا توجد بيانات متاحة</div>';
    }
    return;
  }

  const lang = localStorage.getItem('language') || document.documentElement.lang || 'ar';
  const labels = data.map(m => {
    const [year, month] = m.month.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString(lang === 'en' ? 'en-US' : 'ar-SA', { 
      year: 'numeric', 
      month: 'short' 
    });
  });
  const totalData = data.map(m => m.total_contents);
  const approvedData = data.map(m => m.approved_contents);
  const pendingData = data.map(m => m.pending_contents);

  try {
    new Chart(
      document.getElementById('monthlyTrendsChart').getContext('2d'),
      {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: getTranslation('total-contents'),
            data: totalData,
            borderColor: '#007bff',
            backgroundColor: 'rgba(0, 123, 255, 0.1)',
            borderWidth: 3,
            fill: false,
            tension: 0.4
          }, {
            label: getTranslation('approved-contents'),
            data: approvedData,
            borderColor: '#28a745',
            backgroundColor: 'rgba(40, 167, 69, 0.1)',
            borderWidth: 3,
            fill: false,
            tension: 0.4
          }, {
            label: getTranslation('pending-contents'),
            data: pendingData,
            borderColor: '#ffc107',
            backgroundColor: 'rgba(255, 193, 7, 0.1)',
            borderWidth: 3,
            fill: false,
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false
          },
          scales: {
            y: { 
              beginAtZero: true, 
              grid: { color: '#e0e0e0', drawBorder: false },
              ticks: {
                font: {
                  size: 13,
                  family: "'Tajawal', 'Arial', sans-serif"
                }
              }
            },
            x: { 
              grid: { color: '#e0e0e0', drawBorder: false },
              ticks: {
                font: {
                  size: 13,
                  family: "'Tajawal', 'Arial', sans-serif"
                }
              }
            }
          },
          plugins: {
            legend: {
              position: 'top',
              labels: {
                padding: 20,
                usePointStyle: true,
                font: {
                  size: 13,
                  family: "'Tajawal', 'Arial', sans-serif"
                }
              }
            },
            tooltip: {
              enabled: true,
              mode: 'index',
              intersect: false,
              callbacks: {
                label: function(context) {
                  return context.dataset.label + ': ' + context.parsed.y;
                }
              },
              titleFont: {
                size: 14,
                family: "'Tajawal', 'Arial', sans-serif"
              },
              bodyFont: {
                size: 13,
                family: "'Tajawal', 'Arial', sans-serif"
              }
            }
          }
        }
      }
    );
  } catch (error) {
    console.error('Error rendering monthly trends chart:', error);
  }
}

// دالة عرض رسم بياني للمحاضر
function renderProtocolChart(protocolData) {
  if (!protocolData || !protocolData.totalStats) {
    const canvas = document.getElementById('protocolChart');
    if (canvas) {
      canvas.style.display = 'none';
      canvas.parentElement.innerHTML = '<div class="chart-loading">لا توجد بيانات متاحة</div>';
    }
    return;
  }

  const canvas = ensureCanvasExists('protocolChart');
  if (!canvas) return;

  const { totalStats } = protocolData;
  const labels = [
    getTranslation('pending-protocols') || 'محاضر بانتظار الاعتماد',
    getTranslation('approved-protocols') || 'المحاضر المعتمدة',
    getTranslation('rejected-protocols') || 'المحاضر المرفوضة'
  ];
  
  const data = [
    totalStats.pending_protocols || 0,
    totalStats.approved_protocols || 0,
    totalStats.rejected_protocols || 0
  ];

  try {
    new Chart(canvas.getContext('2d'), {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: [
            '#ffc107', // أصفر للمحاضر بانتظار الاعتماد
            '#28a745', // أخضر للمحاضر المعتمدة  
            '#dc3545'  // أحمر للمحاضر المرفوضة
          ],
          borderColor: [
            '#e0a800',
            '#1e7e34',
            '#c82333'
          ],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'nearest',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 20,
              usePointStyle: true,
              font: {
                size: 13,
                family: "'Tajawal', 'Arial', sans-serif"
              }
            }
          },
          tooltip: {
            enabled: true,
            mode: 'nearest',
            intersect: false,
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.parsed;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                return `${label}: ${value} (${percentage}%)`;
              }
            },
            titleFont: {
              size: 14,
              family: "'Tajawal', 'Arial', sans-serif"
            },
            bodyFont: {
              size: 13,
              family: "'Tajawal', 'Arial', sans-serif"
            }
          }
        }
      }
    });
  } catch (error) {
    console.error('Error rendering protocol chart:', error);
  }
}

// دالة إضافة أزرار التحميل لكل قسم
function addLoadButtons() {
  // إضافة زر تحميل بيانات التذاكر
  const ticketsSection = document.querySelector('[data-section="tickets"]');
  if (ticketsSection) {
    const loadButton = document.createElement('button');
    loadButton.className = 'load-data-btn';
    loadButton.innerHTML = '<i class="fas fa-download"></i> ' + getTranslation('load-data');
    loadButton.onclick = () => loadTicketsData();
    ticketsSection.appendChild(loadButton);
  }

  // إضافة زر تحميل بيانات الأقسام
  const departmentSection = document.querySelector('[data-section="departments"]');
  if (departmentSection) {
    const loadButton = document.createElement('button');
    loadButton.className = 'load-data-btn';
    loadButton.innerHTML = '<i class="fas fa-download"></i> ' + getTranslation('load-data');
    loadButton.onclick = () => loadDepartmentData();
    departmentSection.appendChild(loadButton);
  }

  // إضافة زر تحميل بيانات اللجان
  const committeeSection = document.querySelector('[data-section="committees"]');
  if (committeeSection) {
    const loadButton = document.createElement('button');
    loadButton.className = 'load-data-btn';
    loadButton.innerHTML = '<i class="fas fa-download"></i> ' + getTranslation('load-data');
    loadButton.onclick = () => loadCommitteeData();
    committeeSection.appendChild(loadButton);
  }

  // إضافة زر تحميل البيانات الشهرية
  const monthlySection = document.querySelector('[data-section="monthly"]');
  if (monthlySection) {
    const loadButton = document.createElement('button');
    loadButton.className = 'load-data-btn';
    loadButton.innerHTML = '<i class="fas fa-download"></i> ' + getTranslation('load-data');
    loadButton.onclick = () => loadMonthlyData();
    monthlySection.appendChild(loadButton);
  }

  // إضافة زر تحميل بيانات المحاضر
  const protocolSection = document.querySelector('[data-section="protocols"]');
  if (protocolSection) {
    const loadButton = document.createElement('button');
    loadButton.className = 'load-data-btn';
    loadButton.innerHTML = '<i class="fas fa-download"></i> ' + getTranslation('load-data');
    loadButton.onclick = () => loadProtocolData();
    protocolSection.appendChild(loadButton);
  }
}

// دالة تحميل بيانات التذاكر
async function loadTicketsData() {
  try {
    const button = event.target;
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + getTranslation('loading');
    
    const closed7d = await fetchClosedWeek();
    renderChart(closed7d);
    
    button.innerHTML = '<i class="fas fa-check"></i> ' + getTranslation('data-loaded');
    setTimeout(() => {
      button.innerHTML = '<i class="fas fa-download"></i> ' + getTranslation('load-data');
      button.disabled = false;
    }, 2000);
  } catch (error) {
    console.error('Error loading tickets data:', error);
    const button = event.target;
    button.innerHTML = '<i class="fas fa-exclamation-triangle"></i> ' + getTranslation('error');
    button.disabled = false;
    setTimeout(() => {
      button.innerHTML = '<i class="fas fa-download"></i> ' + getTranslation('load-data');
      button.disabled = false;
    }, 3000);
  }
}

// دالة تحميل بيانات الأقسام
async function loadDepartmentData() {
  try {
    const button = event.target;
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + getTranslation('loading');
    
    const departmentStats = await fetchDepartmentStats();
    renderDepartmentChart(departmentStats);
    renderDepartmentPerformanceChart(departmentStats);
    
    button.innerHTML = '<i class="fas fa-check"></i> ' + getTranslation('data-loaded');
    setTimeout(() => {
      button.innerHTML = '<i class="fas fa-download"></i> ' + getTranslation('load-data');
      button.disabled = false;
    }, 2000);
  } catch (error) {
    console.error('Error loading department data:', error);
    const button = event.target;
    button.innerHTML = '<i class="fas fa-exclamation-triangle"></i> ' + getTranslation('error');
    button.disabled = false;
    setTimeout(() => {
      button.innerHTML = '<i class="fas fa-download"></i> ' + getTranslation('load-data');
      button.disabled = false;
    }, 3000);
  }
}

// دالة تحميل بيانات اللجان
async function loadCommitteeData() {
  try {
    const button = event.target;
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + getTranslation('loading');
    
    const committeeStats = await fetchCommitteeStats();
    renderCommitteeChart(committeeStats);
    renderCommitteePerformanceChart(committeeStats);
    
    button.innerHTML = '<i class="fas fa-check"></i> ' + getTranslation('data-loaded');
    setTimeout(() => {
      button.innerHTML = '<i class="fas fa-download"></i> ' + getTranslation('load-data');
      button.disabled = false;
    }, 2000);
  } catch (error) {
    console.error('Error loading committee data:', error);
    const button = event.target;
    button.innerHTML = '<i class="fas fa-exclamation-triangle"></i> ' + getTranslation('error');
    button.disabled = false;
    setTimeout(() => {
      button.innerHTML = '<i class="fas fa-download"></i> ' + getTranslation('load-data');
      button.disabled = false;
    }, 3000);
  }
}

// دالة تحميل البيانات الشهرية
async function loadMonthlyData() {
  try {
    const button = event.target;
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + getTranslation('loading');
    
    const monthlyPerformance = await fetchMonthlyPerformance();
    renderMonthlyTrendsChart(monthlyPerformance);
    
    button.innerHTML = '<i class="fas fa-check"></i> ' + getTranslation('data-loaded');
    setTimeout(() => {
      button.innerHTML = '<i class="fas fa-download"></i> ' + getTranslation('load-data');
      button.disabled = false;
    }, 2000);
  } catch (error) {
    console.error('Error loading monthly data:', error);
    const button = event.target;
    button.innerHTML = '<i class="fas fa-exclamation-triangle"></i> ' + getTranslation('error');
    button.disabled = false;
    setTimeout(() => {
      button.innerHTML = '<i class="fas fa-download"></i> ' + getTranslation('load-data');
      button.disabled = false;
    }, 3000);
  }
}

// دالة تحميل بيانات المحاضر
async function loadProtocolData() {
  try {
    const button = event.target;
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + getTranslation('loading');
    
    const protocolStats = await fetchProtocolStats();
    renderProtocolChart(protocolStats);
    
    button.innerHTML = '<i class="fas fa-check"></i> ' + getTranslation('data-loaded');
    setTimeout(() => {
      button.innerHTML = '<i class="fas fa-download"></i> ' + getTranslation('load-data');
      button.disabled = false;
    }, 2000);
  } catch (error) {
    console.error('Error loading protocol data:', error);
    const button = event.target;
    button.innerHTML = '<i class="fas fa-exclamation-triangle"></i> ' + getTranslation('error');
    button.disabled = false;
    setTimeout(() => {
      button.innerHTML = '<i class="fas fa-download"></i> ' + getTranslation('load-data');
      button.disabled = false;
    }, 3000);
  }
}

(async () => {
  try {
    // إظهار حالة التحميل
    showLoadingState();
    
    // تنظيف الرسوم البيانية الموجودة
    destroyExistingCharts();
    
    // جلب البيانات الأساسية فقط (الإحصائيات العامة)
    const stats = await fetchStats();
    
    // عرض البيانات الأساسية
    renderStats(stats);
    
    // إضافة أزرار التحميل لكل قسم
    addLoadButtons();
    
    // جعل البطاقات قابلة للنقر
    makeCardsClickable();
    
    // تحديث العناوين حسب اللغة
    updateChartTitles();
    
    // انتظار قليل لضمان اكتمال عرض الرسوم البيانية
    setTimeout(() => {
      // تمكين التفاعل مع الرسوم البيانية
      enableChartClicks();
      ensureTooltipsWork(); // تأكد من أن التلميحات تعمل
      
      // تشخيص مشاكل التلميحات (للتطوير فقط)
      debugTooltips();
      
      // إضافة معالج للتأكد من عمل التلميحات
      const canvases = document.querySelectorAll('.chart-container canvas');
      canvases.forEach(canvas => {
        canvas.addEventListener('mouseenter', function() {
          const chart = Chart.getChart(this);
          if (chart && chart.options.plugins && chart.options.plugins.tooltip) {
            chart.options.plugins.tooltip.enabled = true;
            console.log('Tooltip enabled for chart:', chart.id);
          }
        });
      });
    }, 500);
    
    // إخفاء حالة التحميل
    hideLoadingState();
    
  } catch (error) {
    console.error('خطأ في تحميل البيانات:', error);
    showToast(getTranslation('loading-error'), 'error');
    hideLoadingState();
  }
})();

// دالة إظهار حالة التحميل
function showLoadingState() {
  const chartContainers = document.querySelectorAll('.chart-container');
  chartContainers.forEach(container => {
    if (!container.querySelector('canvas')) {
      container.innerHTML = '<div class="chart-loading">جاري التحميل...</div>';
    }
  });
}

// دالة إخفاء حالة التحميل
function hideLoadingState() {
  const loadingElements = document.querySelectorAll('.chart-loading');
  loadingElements.forEach(element => {
    if (element.textContent === 'جاري التحميل...') {
      element.remove();
    }
  });
}

// معالج الأخطاء العام
window.addEventListener('error', function(event) {
  console.error('Global error caught:', event.error);
  showToast('حدث خطأ غير متوقع. يرجى تحديث الصفحة.', 'error');
});

// معالج الأخطاء للوعود المرفوضة
window.addEventListener('unhandledrejection', function(event) {
  console.error('Unhandled promise rejection:', event.reason);
  showToast('حدث خطأ في معالجة البيانات. يرجى المحاولة مرة أخرى.', 'error');
});

// استماع لتغيير اللغة
document.addEventListener('DOMContentLoaded', function() {
  // تحديث العناوين عند تحميل الصفحة
  updateChartTitles();
  
  // استماع لتغيير اللغة
  const languageButtons = document.querySelectorAll('[data-lang]');
  languageButtons.forEach(button => {
    // إزالة event listeners الموجودة
    const newButton = button.cloneNode(true);
    button.parentNode.replaceChild(newButton, button);
    
    newButton.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      setTimeout(() => {
        updateChartTitles();
        // إعادة تحديث الرسوم البيانية إذا لزم الأمر
        const charts = document.querySelectorAll('canvas');
        charts.forEach(canvas => {
          const chart = Chart.getChart(canvas);
          if (chart) {
            chart.update();
          }
        });
      }, 100);
    });
  });
  
  // منع النقر المزدوج على البطاقات
  const statCards = document.querySelectorAll('.stat-card');
  statCards.forEach(card => {
    let isProcessing = false;
    card.addEventListener('click', function(e) {
      if (isProcessing) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      isProcessing = true;
      setTimeout(() => {
        isProcessing = false;
      }, 1000);
    });
  });
});
