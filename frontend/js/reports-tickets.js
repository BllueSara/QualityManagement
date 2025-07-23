// التصنيفات الديناميكية - سيتم تحميلها من قاعدة البيانات
let categories = [];

// أسماء الشهور
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

const apiBase = 'http://localhost:3006/api';

// صلاحيات المستخدم
const permissions = {
  canDownloadReport: false
};

// جلب التوكن من localStorage
function getToken() {
  return localStorage.getItem('token');
}

// فكّ التوكن لاستخراج دور المستخدم
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

// جلب التصنيفات من قاعدة البيانات
async function fetchClassifications() {
  try {
    const token = getToken();
    if (!token) return;
    
    const lang = getCurrentLang();
    const response = await fetch(`${apiBase}/tickets/classifications?lang=${lang}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      console.error('❌ [reports-tickets] خطأ في جلب التصنيفات:', response.status);
      return;
    }
    
    const result = await response.json();
    if (result.data) {
      categories = result.data.map(item => ({
        ar: item.name,
        en: item.name,
        id: item.id
      }));
      console.log('✅ [reports-tickets] تم تحميل التصنيفات:', categories);
    }
  } catch (error) {
    console.error('❌ [reports-tickets] خطأ في جلب التصنيفات:', error);
  }
}

// جلب صلاحيات المستخدم من الـ API
async function fetchPermissions() {
  const token = getToken();
  if (!token) return;
  const userId = JSON.parse(atob(token.split('.')[1])).id;
  const res = await fetch(`${apiBase}/users/${userId}/permissions`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) return;
  const { data: perms } = await res.json();
  const keys = perms.map(p => typeof p === 'string' ? p : p.permission);
  if (keys.includes('download_reports_tickets')) {
    permissions.canDownloadReport = true;
  }
}

// اللغة الحالية وترجمة المفاتيح
function getCurrentLang() {
  return localStorage.getItem('language') === 'en' ? 'en' : 'ar';
}
function getTranslation(key) {
  const lang = getCurrentLang();
  return window.translations?.[lang]?.[key] || key;
}

// إعادة رسم الفلاتر والعناوين
function renderFiltersAndTitle() {
  const lang = getCurrentLang();
  document.querySelector('.reports-title').textContent = getTranslation('tickets-reports-title');
  // إضافة فلاتر الشهر والسنة
  const currentYear = new Date().getFullYear();
  let yearsOptions = '';
  for (let y = currentYear; y >= currentYear - 10; y--) {
    yearsOptions += `<option value="${y}">${y}</option>`;
  }
  let monthsOptions = `<option value="">${getTranslation('all-months') || 'كل الشهور'}</option>`;
  months.forEach((m, idx) => {
    monthsOptions += `<option value="${idx+1}">${m[lang]}</option>`;
  });
  document.querySelector('.actions-bar').innerHTML = `
    <select id="categoryFilter" class="category-filter">
      <option value="">${getTranslation('all-categories')}</option>
    </select>
    <select id="monthFilter">${monthsOptions}</select>
    <select id="yearFilter">${yearsOptions}</select>
    <button id="filterBtn" class="btn">
      <i class="fas fa-filter"></i> ${getTranslation('filter')}
    </button>
    <button id="showAllBtn" class="btn btn-secondary">
      <i class="fas fa-list"></i> ${getTranslation('show-all')}
    </button>
    <button id="downloadBtn" class="btn">
      <i class="fas fa-download"></i> ${getTranslation('download')}
    </button>
  `;
  const catSelect = document.getElementById('categoryFilter');
  // تأكد من أن التصنيفات تم تحميلها
  if (categories && categories.length > 0) {
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat[lang];
      opt.textContent = cat[lang];
      catSelect.appendChild(opt);
    });
  } else {
    console.log('⚠️ [reports-tickets] التصنيفات لم يتم تحميلها بعد');
  }
}

// تحميل التقرير وبناء الجدول
async function loadTicketsReport() {
  const lang = getCurrentLang();
  const selCat = document.getElementById('categoryFilter').value;
  const selMonth = document.getElementById('monthFilter')?.value;
  const selYear = document.getElementById('yearFilter')?.value;
  const params = new URLSearchParams();
  params.append('lang', lang);
  if (selCat) params.append('category', selCat);
  if (selMonth) params.append('month', selMonth);
  if (selYear) params.append('year', selYear);

  const wrap = document.getElementById('tickets-report-table-wrapper');
  wrap.innerHTML = `<div class="loading">${getTranslation('loading')}</div>`;

  try {
    const token = getToken();
    const res = await fetch(`${apiBase}/tickets/report/closed-tickets?${params}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error();
    const { data: rows } = await res.json();

    // بناء مصفوفة النتائج حسب التصنيفات الديناميكية
    if (!categories || categories.length === 0) {
      console.log('⚠️ [reports-tickets] التصنيفات غير متوفرة، إعادة تحميل...');
      await fetchClassifications();
    }
    
    const langCats = categories.map(c => c[lang]);
    const dataMap = {};
    langCats.forEach(c => dataMap[c] = Array(12).fill(0));
    
    rows.forEach(r => {
      const mIdx = (r.month || 1) - 1;
      // التصنيف من البيانات قد يكون نص عربي أو إنجليزي أو كود، نطابقه مع الديناميكي
      const catIdx = langCats.findIndex(c => c === r.classification);
      if (catIdx !== -1 && mIdx >= 0 && mIdx < 12) {
        dataMap[langCats[catIdx]][mIdx] = r.closed_count;
      }
    });

    const selCats = selCat ? langCats.filter(c => c === selCat) : langCats;

    // بناء الجدول
    let html = '<table><thead><tr>';
    html += `<th>${getTranslation('category')}</th>`;
    if (selMonth) {
      // إذا تم اختيار شهر، اعرض عمود واحد فقط
      const monthIdx = Number(selMonth) - 1;
      html += `<th>${months[monthIdx][lang]}</th>`;
    } else {
      months.forEach(m => { html += `<th>${m[lang]}</th>`; });
    }
    html += '</tr></thead><tbody>';
    selCats.forEach(cat => {
      html += `<tr><td>${cat}</td>`;
      if (selMonth) {
        const monthIdx = Number(selMonth) - 1;
        html += `<td>${dataMap[cat][monthIdx]}</td>`;
      } else {
        dataMap[cat].forEach(val => { html += `<td>${val}</td>`; });
      }
      html += '</tr>';
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;

  } catch {
    wrap.innerHTML = `<div class="error">${getTranslation('error-loading-data')}</div>`;
  }
}

// تنزيل الجدول كـ CSV
async function downloadTableAsCSV() {
  const lang = getCurrentLang();
  const selCat = document.getElementById('categoryFilter').value;
  const selMonth = document.getElementById('monthFilter')?.value;
  const selYear = document.getElementById('yearFilter')?.value;
  const params = new URLSearchParams();
  params.append('lang', lang);
  if (selCat) params.append('category', selCat);
  if (selMonth) params.append('month', selMonth);
  if (selYear) params.append('year', selYear);

  try {
    const token = getToken();
    const res = await fetch(`${apiBase}/tickets/report/closed-tickets?${params}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error();
    const { data: rows } = await res.json();

    // تأكد من وجود التصنيفات
    if (!categories || categories.length === 0) {
      console.log('⚠️ [reports-tickets] التصنيفات غير متوفرة، إعادة تحميل...');
      await fetchClassifications();
    }
    
    const langCats = categories.map(c => c[lang]);
    const dataMap = {};
    langCats.forEach(c => dataMap[c] = Array(12).fill(0));
    rows.forEach(r => {
      const mIdx = (r.month || 1) - 1;
      const catIdx = langCats.findIndex(c => c === r.classification);
      if (catIdx !== -1 && mIdx >= 0 && mIdx < 12) {
        dataMap[langCats[catIdx]][mIdx] = r.closed_count;
      }
    });
    const selCats = selCat ? langCats.filter(c => c === selCat) : langCats;

    // توليد CSV
    let csv = '';
    if (selMonth) {
      const monthIdx = Number(selMonth) - 1;
      csv += [getTranslation('category'), months[monthIdx][lang]].join(',') + '\n';
    } else {
      csv += [getTranslation('category'), ...months.map(m => m[lang])].join(',') + '\n';
    }
    selCats.forEach(cat => {
      let row;
      if (selMonth) {
        const monthIdx = Number(selMonth) - 1;
        row = [cat, dataMap[cat][monthIdx]];
      } else {
        row = [cat, ...dataMap[cat]];
      }
      csv += row.join(',') + '\n';
    });

    // إضافة BOM في بداية الملف لحل مشكلة الترميز مع العربية
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'OVR-Report.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

  } catch {
    alert(getTranslation('error-downloading'));
  }
}

// الإعداد عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', async () => {
  await fetchPermissions();      // جلب الصلاحيات أولاً
  await fetchClassifications();  // جلب التصنيفات أولاً
  renderFiltersAndTitle();       // رسم الفلاتر والعناوين
  loadTicketsReport();           // تحميل البيانات

  document.getElementById('filterBtn').onclick = loadTicketsReport;
  document.getElementById('showAllBtn').onclick = () => {
    document.getElementById('categoryFilter').value = '';
    document.getElementById('monthFilter').value = '';
    document.getElementById('yearFilter').value = '';
    loadTicketsReport();
  };

  const downloadBtn = document.getElementById('downloadBtn');
  // إظهار أو إخفاء زر التنزيل حسب الدور أو الصلاحية
  if (
    getUserRoleFromToken() === 'admin' ||
    getUserRoleFromToken() === 'manager_ovr' ||
    permissions.canDownloadReport
  ) {
    downloadBtn.style.display = 'inline-block';
    downloadBtn.onclick = downloadTableAsCSV;
  } else {
    downloadBtn.style.display = 'none';
  }

  window.addEventListener('languageChanged', async () => {
    await fetchClassifications();  // إعادة تحميل التصنيفات باللغة الجديدة
    renderFiltersAndTitle();
    loadTicketsReport();
    // إعادة فحص الصلاحية بعد تغيير اللغة
    const dl = document.getElementById('downloadBtn');
    if (
      getUserRoleFromToken() === 'admin' ||
      getUserRoleFromToken() === 'manager_ovr' ||
      permissions.canDownloadReport
    ) {
      dl.style.display = 'inline-block';
      dl.onclick = downloadTableAsCSV;
    } else {
      dl.style.display = 'none';
    }
  });
});
