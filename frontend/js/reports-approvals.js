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
  const res = await fetch(`${apiBase}/api/users/${userId}/permissions`, { headers });
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

// بيانات التقارير الحقيقية
let approvalsData = [];

// جلب بيانات تقارير الاعتمادات من الباك اند
async function fetchApprovalsReports() {
  try {
    const res = await fetch(`${apiBase}/api/reports/approvals`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    if (!res.ok) throw new Error('Network response was not ok');
    const { data } = await res.json();
    approvalsData = data || [];
  } catch (err) {
    console.error('Failed to fetch approvals reports:', err);
    approvalsData = [];
  }
}

async function fetchDepartments() {
  try {
    const res = await fetch(`${apiBase}/api/departments`);
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

function getDepartmentName(dep) {
  if (!dep) return '';
  if (typeof dep === 'string') {
    try {
      const obj = JSON.parse(dep);
      if (typeof obj === 'object' && obj.ar && obj.en) {
        return obj[getCurrentLang()] || obj.ar;
      }
      return dep;
    } catch {
      return dep;
    }
  }
  if (typeof dep === 'object' && (dep.ar || dep.en)) {
    return dep[getCurrentLang()] || dep.ar || dep.en;
  }
  return String(dep);
}

function getFileName(name) {
  if (!name) return '';
  if (typeof name === 'string') {
    try {
      const obj = JSON.parse(name);
      if (typeof obj === 'object' && obj.ar && obj.en) {
        return obj[getCurrentLang()] || obj.ar;
      }
      return name;
    } catch {
      return name;
    }
  }
  if (typeof name === 'object' && (name.ar || name.en)) {
    return name[getCurrentLang()] || name.ar || name.en;
  }
  return String(name);
}

function filterData() {
  const dep = document.getElementById('department-select').value;
  const start = document.getElementById('start-date').value;
  const end   = document.getElementById('end-date').value;
  const fileNameInput = document.getElementById('file-name-input');
  const fileNameFilter = fileNameInput ? fileNameInput.value.trim() : '';
  return approvalsData.filter(row => {
    const rowDepName = getDepartmentName(row.department);
    const rowFileName = getFileName(row.fileName);
    const matchDep   = dep === 'all' || rowDepName === dep;
    const matchStart = !start || row.startDate >= start;
    const matchEnd   = !end   || row.endDate <= end;
    const matchFile  = !fileNameFilter || rowFileName.includes(fileNameFilter);
    return matchDep && matchStart && matchEnd && matchFile;
  });
}

function populateTable() {
  const tbody = document.querySelector('#approvals-report-table tbody');
  tbody.innerHTML = '';
  filterData().forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${getFileName(row.fileName)}</td>
      <td>${getDepartmentName(row.department)}</td>
      <td>${row.startDate ? row.startDate.split('T')[0] : ''}</td>
      <td>${row.endDate ? row.endDate.split('T')[0] : ''}</td>
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
  const rows = data.map(r => [
    getFileName(r.fileName),
    getDepartmentName(r.department),
    r.startDate,
    r.endDate
  ]);
  const csv = '\uFEFF' + [header.join(','), ...rows.map(r => r.join(','))].join('\n');
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
  await fetchApprovalsReports(); // جلب بيانات التقارير
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
