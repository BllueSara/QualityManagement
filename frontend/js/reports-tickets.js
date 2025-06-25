// تقارير التذاكر
// التصنيفات الثابتة مع الترجمة
const categories = [
  { ar: 'النظافة', en: 'Cleaning' },
  { ar: 'تكامل الجلد', en: 'Skin Integrity' },
  { ar: 'السقوط', en: 'Fall' },
  { ar: 'مشكلات سلسلة الإمداد', en: 'Supply Chain Issues' },
  { ar: 'قضايا أمنية', en: 'Security Issues' },
  { ar: 'الصحة المهنية', en: 'Occupational Health' },
  { ar: 'قضايا الموظفين', en: 'Staff Issues' },
  { ar: 'قضايا مكافحة العدوى', en: 'Infection Control' },
  { ar: 'صيانة المنشأة', en: 'Facility Maintenance' },
  { ar: 'خدمات الطعام', en: 'Food Services' },
  { ar: 'الإسكان', en: 'Housing' },
  { ar: 'الأجهزة الطبية', en: 'Medical Equipment' },
  { ar: 'إدارة رعاية المرضى', en: 'Patient Care Management' },
  { ar: 'فرط الضغط', en: 'Pressure Ulcer' },
  { ar: 'مشاكل التواصل', en: 'Communication Issues' },
  { ar: 'قضايا الولادة', en: 'Maternal Issues' },
  { ar: 'أحداث جسيمة', en: 'Serious Incidents' },
  { ar: 'الهوية / المستندات / الموافقات', en: 'Identity/Documents/Consents' },
  { ar: 'خدمات المختبر', en: 'Lab Services' },
  { ar: 'التصوير الطبي', en: 'Medical Imaging' },
  { ar: 'البيئة / السلامة', en: 'Environment/Safety' },
  { ar: 'إجراءات طبية', en: 'Medical Procedures' },
  { ar: 'الحقن الوريدي', en: 'IV Injection' },
  { ar: 'الدواء', en: 'Medication' },
  { ar: 'العلاج الإشعاعي', en: 'Radiation Therapy' },
  { ar: 'التغذية السريرية', en: 'Clinical Nutrition' },
  { ar: 'قضايا تقنية المعلومات', en: 'IT Issues' }
];
const months = [
  { ar: 'يناير', en: 'January' },
  { ar: 'فبراير', en: 'February' },
  { ar: 'مارس', en: 'March' },
  { ar: 'ابريل', en: 'April' },
  { ar: 'مايو', en: 'May' },
  { ar: 'يونيو', en: 'June' },
  { ar: 'يوليو', en: 'July' },
  { ar: 'اغسطس', en: 'August' },
  { ar: 'سبتمبر', en: 'September' },
  { ar: 'اكتوبر', en: 'October' },
  { ar: 'نوفمبر', en: 'November' },
  { ar: 'ديسمبر', en: 'December' }
];

const translations = {
  ar: {
    title: 'تقرير التذاكر حسب التصنيف والشهر',
    from: 'من:',
    to: 'إلى:',
    allCategories: 'كل التصنيفات',
    filter: 'عرض',
    showAll: 'عرض الكل',
    download: 'تحميل',
    category: 'التصنيف',
  },
  en: {
    title: 'Tickets Report by Category and Month',
    from: 'From:',
    to: 'To:',
    allCategories: 'All Categories',
    filter: 'Filter',
    showAll: 'Show All',
    download: 'Download',
    category: 'Category',
  }
};

const apiBase = 'http://localhost:3006/api';

function getCurrentLang() {
  return localStorage.getItem('language') === 'en' ? 'en' : 'ar';
}

document.addEventListener('DOMContentLoaded', function() {
  renderFiltersAndTitle();
  document.getElementById('filterBtn').onclick = loadTicketsReport;
  document.getElementById('showAllBtn').onclick = function() {
    document.getElementById('fromDate').value = '';
    document.getElementById('toDate').value = '';
    document.getElementById('categoryFilter').value = '';
    loadTicketsReport();
  };
  document.getElementById('downloadBtn').onclick = downloadTableAsCSV;
  loadTicketsReport();
  window.addEventListener('languageChanged', () => {
    renderFiltersAndTitle();
    loadTicketsReport();
  });
});

function renderFiltersAndTitle() {
  const lang = getCurrentLang();
  // العنوان
  document.querySelector('.reports-title').textContent = translations[lang].title;
  // الفلاتر والأزرار
  const actionsBar = document.querySelector('.actions-bar');
  actionsBar.innerHTML = `
    <label>${translations[lang].from} <input type="date" id="fromDate"></label>
    <label>${translations[lang].to} <input type="date" id="toDate"></label>
    <select id="categoryFilter" class="category-filter">
      <option value="">${translations[lang].allCategories}</option>
    </select>
    <button id="filterBtn" class="btn"><i class="fas fa-filter"></i> ${translations[lang].filter}</button>
    <button id="showAllBtn" class="btn btn-secondary"><i class="fas fa-list"></i> ${translations[lang].showAll}</button>
    <button id="downloadBtn" class="btn"><i class="fas fa-download"></i> ${translations[lang].download}</button>
  `;
  // Populate category filter
  const catSelect = document.getElementById('categoryFilter');
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat[lang];
    opt.textContent = cat[lang];
    catSelect.appendChild(opt);
  });
}

async function loadTicketsReport() {
  const lang = getCurrentLang();
  const selectedCat = document.getElementById('categoryFilter').value;
  const fromDate = document.getElementById('fromDate').value;
  const toDate = document.getElementById('toDate').value;
  const token = localStorage.getItem('token');
  const tableWrapper = document.getElementById('tickets-report-table-wrapper');
  tableWrapper.innerHTML = '<div class="loading">جاري التحميل...</div>';
  try {
    const params = new URLSearchParams();
    if (fromDate) params.append('startDate', fromDate);
    if (toDate) params.append('endDate', toDate);
    if (selectedCat) params.append('category', selectedCat);
    // إذا لم يحدد المستخدم تاريخ، استخدم سنة كاملة افتراضية
    if (!fromDate || !toDate) {
      const year = new Date().getFullYear();
      params.set('startDate', `${year}-01-01`);
      params.set('endDate', `${year}-12-31`);
    }
    const res = await fetch(`${apiBase}/tickets/report/closed-tickets?${params.toString()}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('فشل جلب البيانات');
    const body = await res.json();
    const reportData = body.data || [];
    // بناء مصفوفة: { [category]: [12 شهر] }
    const cats = categories.map(c => c[lang]);
    const monthsArr = Array(12).fill(0).map((_, i) => i + 1);
    const data = {};
    cats.forEach(cat => { data[cat] = Array(12).fill(0); });
    reportData.forEach(row => {
      const cat = row.category;
      const monthIdx = (row.month || 1) - 1;
      if (data[cat] && monthIdx >= 0 && monthIdx < 12) {
        data[cat][monthIdx] = row.count;
      }
    });
    let catsToShow = selectedCat ? categories.filter(c => c[lang] === selectedCat) : categories;
    // بناء الجدول
    let html = `<table><thead><tr><th style="direction:rtl;">${translations[lang].category}</th>`;
    months.forEach(m=> html += `<th style="direction:rtl;">${m[lang]}</th>`);
    html += '</tr></thead><tbody>';
    catsToShow.forEach(cat => {
      html += `<tr><td>${cat[lang]}</td>`;
      data[cat[lang]].forEach(num => html += `<td>${num}</td>`);
      html += '</tr>';
    });
    html += '</tbody></table>';
    tableWrapper.innerHTML = html;
  } catch (err) {
    tableWrapper.innerHTML = `<div class="error">${lang === 'ar' ? 'حدث خطأ أثناء جلب البيانات' : 'Error loading data'}</div>`;
  }
}

async function downloadTableAsCSV() {
  const lang = getCurrentLang();
  const selectedCat = document.getElementById('categoryFilter').value;
  const fromDate = document.getElementById('fromDate').value;
  const toDate = document.getElementById('toDate').value;
  const token = localStorage.getItem('token');
  const params = new URLSearchParams();
  if (fromDate) params.append('startDate', fromDate);
  if (toDate) params.append('endDate', toDate);
  if (selectedCat) params.append('category', selectedCat);
  if (!fromDate || !toDate) {
    const year = new Date().getFullYear();
    params.set('startDate', `${year}-01-01`);
    params.set('endDate', `${year}-12-31`);
  }
  try {
    const res = await fetch(`${apiBase}/tickets/report/closed-tickets?${params.toString()}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('فشل جلب البيانات');
    const body = await res.json();
    const reportData = body.data || [];
    const cats = categories.map(c => c[lang]);
    const data = {};
    cats.forEach(cat => { data[cat] = Array(12).fill(0); });
    reportData.forEach(row => {
      const cat = row.category;
      const monthIdx = (row.month || 1) - 1;
      if (data[cat] && monthIdx >= 0 && monthIdx < 12) {
        data[cat][monthIdx] = row.count;
      }
    });
    let catsToShow = selectedCat ? categories.filter(c => c[lang] === selectedCat) : categories;
    let csv = '';
    let rtlRow = [translations[lang].category];
    months.forEach(m => rtlRow.push(m[lang]));
    csv += rtlRow.map(t => '"' + '\u200F' + t + '"').join(',') + '\n';
    catsToShow.forEach(cat => {
      let row = [cat[lang]];
      data[cat[lang]].forEach(num => row.push(num));
      csv += row.map(t => '"' + t + '"').join(',') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tickets-report.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    alert(lang === 'ar' ? 'حدث خطأ أثناء التحميل' : 'Error downloading CSV');
  }
} 