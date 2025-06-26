// Language labels
let currentLang = localStorage.getItem('lang') || 'ar';
apiBase = 'http://localhost:3006';
// صلاحيات المستخدم (افتراضيًا كل شيء false)
const permissions = {
  // ... باقي الصلاحيات
  canDownloadReport: false,
};

// دالة لجلب التوكن من localStorage
function getToken() {
  return localStorage.getItem('token');
}

// دالة لفك التوكن واستخراج الدور
function getUserRoleFromToken() {
  const token = getToken();
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c =>
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''));
    return JSON.parse(jsonPayload).role;
  } catch {
    return null;
  }
}

// جلب صلاحيات المستخدم من الـ API
async function fetchPermissions() {
  const userId = JSON.parse(atob(getToken().split('.')[1])).id;
  const headers = { 'Authorization': `Bearer ${getToken()}` };
  const res = await fetch(`${apiBase}/users/${userId}/permissions`, { headers });
  if (!res.ok) return;
  const { data: perms } = await res.json();
  const keys = perms.map(p => typeof p === 'string' ? p : p.permission);

  if (keys.includes('download_reports_approvals')) {
    permissions.canDownloadReport = true;
  }
}

// ——— ترجمة ———
function getCurrentLang() {
  return localStorage.getItem('language') === 'en' ? 'en' : 'ar';
}

function getTranslation(key) {
  const lang = getCurrentLang();
  if (window.translations?.[lang]?.[key]) {
    return window.translations[lang][key];
  }
  return key;
}

function setLanguage(lang) {
  currentLang = lang;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.getElementById('page-title').textContent = getTranslation('approvals-reports-title');
  document.getElementById('file-name-th').textContent = getTranslation('file-name');
  document.getElementById('department-th').textContent = getTranslation('department-name');
  document.getElementById('start-date-th').textContent = getTranslation('start-date-label');
  document.getElementById('end-date-th').textContent = getTranslation('end-date-label');
  document.getElementById('filter-btn').textContent = getTranslation('search');
  document.getElementById('download-btn').textContent = getTranslation('download');
  document.getElementById('department-select').options[0].textContent = getTranslation('all-departments');
}

// بيانات وهمية للتجربة
const mockData = [
  { fileName: 'ملف 1.pdf', department: 'الجودة', startDate: '2024-05-01', endDate: '2024-05-10' },
  { fileName: 'ملف 2.pdf', department: 'التمريض', startDate: '2024-05-03', endDate: '2024-05-12' },
  { fileName: 'ملف 3.pdf', department: 'الموارد البشرية', startDate: '2024-05-05', endDate: '2024-05-15' },
];

async function fetchDepartments() {
  try {
    const res = await fetch('/api/departments');
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch departments:', err);
    return [];
  }
}

async function populateDepartments() {
  const select = document.getElementById('department-select');
  while (select.options.length > 1) select.remove(1);
  const departments = await fetchDepartments();
  const lang = getCurrentLang();

  departments.forEach(dep => {
    let nameObj = dep.name;
    if (typeof nameObj === 'string') {
      try { nameObj = JSON.parse(nameObj); }
      catch { nameObj = { ar: nameObj, en: nameObj }; }
    }
    const option = document.createElement('option');
    option.value = nameObj[lang];
    option.textContent = nameObj[lang];
    select.appendChild(option);
  });
}

function filterData() {
  const dep = document.getElementById('department-select').value;
  const start = document.getElementById('start-date').value;
  const end   = document.getElementById('end-date').value;
  return mockData.filter(row => {
    const matchDep   = dep === 'all' || row.department === dep;
    const matchStart = !start || row.startDate >= start;
    const matchEnd   = !end   || row.endDate <= end;
    return matchDep && matchStart && matchEnd;
  });
}

function populateTable() {
  const tbody = document.querySelector('#approvals-report-table tbody');
  tbody.innerHTML = '';
  filterData().forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.fileName}</td>
      <td>${row.department}</td>
      <td>${row.startDate}</td>
      <td>${row.endDate}</td>
    `;
    tbody.appendChild(tr);
  });
}

function downloadCSV() {
  const data = filterData();
  const header = [
    getTranslation('file-name'),
    getTranslation('department-name'),
    getTranslation('start-date-label'),
    getTranslation('end-date-label')
  ];
  const rows = data.map(r => [r.fileName, r.department, r.startDate, r.endDate]);
  const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'approvals_report.csv';
  link.click();
}

// ——— الإعداد عند التحميل ———
window.addEventListener('DOMContentLoaded', async () => {
  setLanguage(getCurrentLang());
  await fetchPermissions();      // أولًا: جلب صلاحيات المستخدم
  await populateDepartments();
  populateTable();

  document.getElementById('filter-btn')
    .addEventListener('click', populateTable);

  const downloadBtn = document.getElementById('download-btn');

  // إظهار/إخفاء زر التحميل بناءً على الدور أو الصلاحية
  if (getUserRoleFromToken() === 'admin' || permissions.canDownloadReport) {
    downloadBtn.style.display = 'inline-block';
    downloadBtn.addEventListener('click', downloadCSV);
  } else {
    downloadBtn.style.display = 'none';
  }
});

// استماع لتغيير اللغة (إن وجد)
window.addEventListener('languageChanged', () => {
  setLanguage(getCurrentLang());
  populateDepartments();
  populateTable();
});
