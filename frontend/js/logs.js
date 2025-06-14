// js/logs.js
// منطق جلب السجلات من الباك-أند ثم تطبيق الفلترة والبحث
console.log(document.getElementById('apply-filter'));  // يجب ألا يكون null

document.addEventListener('DOMContentLoaded', () => {
  const applyFilterBtn   = document.getElementById('apply-filter');
  const resetFilterBtn   = document.getElementById('reset-filter');
  const fromDateInput    = document.getElementById('from-date');
  const toDateInput      = document.getElementById('to-date');
  const actionTypeSelect = document.getElementById('action-type');
  const userNameSelect   = document.getElementById('user-name');
  const searchInput      = document.getElementById('search-input');
  const logsBody         = document.getElementById('logs-body');

  // بناء auth header
  function authHeader() {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  // جلب وعرض السجلات
  async function loadLogs() {
    const params = new URLSearchParams();
    if (fromDateInput.value)    params.append('from', fromDateInput.value);
    if (toDateInput.value)      params.append('to', toDateInput.value);
    if (actionTypeSelect.value) params.append('action', actionTypeSelect.value);
    if (userNameSelect.value)   params.append('user', userNameSelect.value);
    if (searchInput.value)      params.append('search', searchInput.value);

const res = await fetch('http://localhost:3006/api/users/logs?' + params.toString(), {
      headers: authHeader()
    });
    const json = await res.json();

    // تفريغ الجدول
    logsBody.innerHTML = '';

    // بناء الصفوف
    json.data.forEach(log => {
      const tr = document.createElement('tr');
      tr.dataset.date   = log.created_at;
      tr.dataset.user   = log.user;
      tr.dataset.action = log.action;

      tr.innerHTML = `
        <td>${log.user || '-'}</td>
        <td>${log.description || ''}</td>
        <td>${new Date(log.created_at).toLocaleString('ar-SA')}</td>
        <td><span class="action-text">${log.action}</span></td>
      `;
      logsBody.appendChild(tr);
    });
  }

  // جلب قائمة المستخدمين لفلتر الاسم
  async function fetchUsers() {
    const res = await fetch('http://localhost:3006/api/users?roles', { headers: authHeader() });
    const json = await res.json();
    json.data.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.name;
      opt.textContent = u.name;
      userNameSelect.appendChild(opt);
    });
  }

  // دالة للحصول على userId من التوكن
  function getUserId() {
    const token = localStorage.getItem('token');
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.id;
  }

  // تطبيق الفلترة يُعيد تحميل السجلات من السيرفر
  applyFilterBtn.addEventListener('click', loadLogs);
  resetFilterBtn.addEventListener('click', () => {
    fromDateInput.value = '';
    toDateInput.value   = '';
    actionTypeSelect.value = '';
    userNameSelect.value   = '';
    searchInput.value      = '';
    loadLogs();
  });

  // التحميل الأولي
  fetchUsers();
  loadLogs();
});
