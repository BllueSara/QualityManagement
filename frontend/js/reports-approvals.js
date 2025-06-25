// Language labels
const labels = {
  ar: {
    pageTitle: 'تقارير الاعتمادات',
    fileName: 'اسم الملف',
    department: 'القسم',
    startDate: 'تاريخ البداية',
    endDate: 'تاريخ الانتهاء',
    filter: 'بحث',
    download: 'تحميل',
    all: 'الكل',
  },
  en: {
    pageTitle: 'Approvals Reports',
    fileName: 'File Name',
    department: 'Department',
    startDate: 'Start Date',
    endDate: 'End Date',
    filter: 'Search',
    download: 'Download',
    all: 'All',
  }
};

let currentLang = localStorage.getItem('lang') || 'ar';

function setLanguage(lang) {
  currentLang = lang;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.getElementById('page-title').textContent = labels[lang].pageTitle;
  document.getElementById('file-name-th').textContent = labels[lang].fileName;
  document.getElementById('department-th').textContent = labels[lang].department;
  document.getElementById('start-date-th').textContent = labels[lang].startDate;
  document.getElementById('end-date-th').textContent = labels[lang].endDate;
  document.getElementById('filter-btn').textContent = labels[lang].filter;
  document.getElementById('download-btn').textContent = labels[lang].download;
  // Update department select options
  const select = document.getElementById('department-select');
  select.options[0].textContent = labels[lang].all;
}

const mockData = [
  { fileName: 'ملف 1.pdf', department: 'الجودة', startDate: '2024-05-01', endDate: '2024-05-10' },
  { fileName: 'ملف 2.pdf', department: 'التمريض', startDate: '2024-05-03', endDate: '2024-05-12' },
  { fileName: 'ملف 3.pdf', department: 'الموارد البشرية', startDate: '2024-05-05', endDate: '2024-05-15' },
];

async function fetchDepartments() {
  try {
    // Adjust the endpoint if needed to match your backend
    const res = await fetch('/api/departments');
    if (!res.ok) throw new Error('Network response was not ok');
    const data = await res.json();
    // Assume data is an array of { id, name_ar, name_en }
    return data;
  } catch (err) {
    console.error('Failed to fetch departments:', err);
    return [];
  }
}

async function populateDepartments() {
  const select = document.getElementById('department-select');
  // Remove old options except 'all'
  while (select.options.length > 1) select.remove(1);
  const departments = await fetchDepartments();
  departments.forEach(dep => {
    const option = document.createElement('option');
    option.value = currentLang === 'ar' ? dep.name_ar : dep.name_en;
    option.textContent = currentLang === 'ar' ? dep.name_ar : dep.name_en;
    select.appendChild(option);
  });
}

function filterData() {
  const dep = document.getElementById('department-select').value;
  const start = document.getElementById('start-date').value;
  const end = document.getElementById('end-date').value;
  return mockData.filter(row => {
    const matchDep = dep === 'all' || row.department === dep;
    const matchStart = !start || row.startDate >= start;
    const matchEnd = !end || row.endDate <= end;
    return matchDep && matchStart && matchEnd;
  });
}

function populateTable() {
  const tbody = document.querySelector('#approvals-report-table tbody');
  tbody.innerHTML = '';
  const data = filterData();
  data.forEach(row => {
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
  const header = [labels[currentLang].fileName, labels[currentLang].department, labels[currentLang].startDate, labels[currentLang].endDate];
  const rows = data.map(row => [row.fileName, row.department, row.startDate, row.endDate]);
  let csvContent = header.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'approvals_report.csv';
  link.click();
}

document.getElementById('filter-btn').addEventListener('click', populateTable);
document.getElementById('download-btn').addEventListener('click', downloadCSV);

// Language switching (assume a global language switcher sets localStorage 'lang' and reloads page)
window.addEventListener('DOMContentLoaded', () => {
  setLanguage(currentLang);
  populateDepartments();
  populateTable();
}); 