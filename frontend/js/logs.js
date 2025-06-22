document.addEventListener('DOMContentLoaded', () => {
  const fromDateInput    = document.getElementById('from-date');
  const toDateInput      = document.getElementById('to-date');
  const actionTypeSelect = document.getElementById('action-type');
  const userNameSelect   = document.getElementById('user-name');
  const searchInput      = document.getElementById('search-input');
  const logsBody         = document.getElementById('logs-body');

  function authHeader() {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  // دالة للحصول على الترجمة
  function getTranslation(key) {
    const lang = localStorage.getItem('language') || 'ar';
    const translations = window.translations || {};
    return translations[lang]?.[key] || key;
  }

  // دالة لمعالجة البيانات واستخراج النص الصحيح
  function extractTextFromData(data) {
    if (typeof data === 'string') {
      // محاولة تحليل JSON إذا كان النص يبدو كـ JSON
      if (data.startsWith('{') && data.endsWith('}')) {
        try {
          const parsed = JSON.parse(data);
          const lang = localStorage.getItem('language') || 'ar';
          return parsed[lang] || parsed['ar'] || data;
        } catch (e) {
          return data;
        }
      }
      return data;
    } else if (typeof data === 'object' && data !== null) {
      // إذا كان object، محاولة استخراج النص باللغة المناسبة
      const lang = localStorage.getItem('language') || 'ar';
      return data[lang] || data['ar'] || JSON.stringify(data);
    }
    return data || '';
  }

  // دالة لتحديث النصوص بناءً على اللغة
  function updatePageTexts() {
    const lang = localStorage.getItem('language') || 'ar';
    
    // تحديث عناصر HTML
    document.querySelectorAll('[data-translate]').forEach(element => {
      const key = element.getAttribute('data-translate');
      const translation = getTranslation(key);
      if (translation && translation !== key) {
        element.textContent = translation;
      }
    });

    // تحديث placeholders
    document.querySelectorAll('[data-translate-placeholder]').forEach(element => {
      const key = element.getAttribute('data-translate-placeholder');
      const translation = getTranslation(key);
      if (translation && translation !== key) {
        element.placeholder = translation;
      }
    });

    // تحديث اتجاه النص للعناصر
    document.querySelectorAll('input, select, textarea').forEach(element => {
      if (lang === 'ar') {
        element.style.direction = 'rtl';
        element.style.textAlign = 'right';
      } else {
        element.style.direction = 'ltr';
        element.style.textAlign = 'left';
      }
    });
  }

  async function loadLogs() {
    const params = new URLSearchParams();
    if (fromDateInput.value)    params.append('from', fromDateInput.value);
    if (toDateInput.value)      params.append('to', toDateInput.value);
    if (actionTypeSelect.value) params.append('action', actionTypeSelect.value);
    if (userNameSelect.value)   params.append('user', userNameSelect.value);
    if (searchInput.value)      params.append('search', searchInput.value);

    try {
      const res = await fetch('http://localhost:3006/api/users/logs?' + params.toString(), {
        headers: authHeader()
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const json = await res.json();

      logsBody.innerHTML = '';

      if (json.data && Array.isArray(json.data)) {
        json.data.forEach(log => {
          const tr = document.createElement('tr');
          tr.dataset.date   = log.created_at;
          tr.dataset.user   = log.user;
          tr.dataset.action = log.action;

          // تحديد اللغة الحالية
          const lang = localStorage.getItem('language') || document.documentElement.lang || 'ar';
          const locale = lang === 'en' ? 'en-US' : 'ar-SA';

          // معالجة البيانات باستخدام الدالة الجديدة
          const user = extractTextFromData(log.user) || '-';
          const description = extractTextFromData(log.description) || '';
          const action = extractTextFromData(log.action) || '';

          // Debug logging
          if (description.includes('[object Object]')) {
            console.log('DEBUG: Original description:', log.description);
            console.log('DEBUG: Extracted description:', description);
          }

          tr.innerHTML = `
            <td>${user}</td>
            <td>${description}</td>
            <td>${new Date(log.created_at).toLocaleString(locale)}</td>
            <td><span class="action-text">${action}</span></td>
          `;
          logsBody.appendChild(tr);
        });
      } else {
        // عرض رسالة إذا لم تكن هناك بيانات
        logsBody.innerHTML = `
          <tr>
            <td colspan="4" style="text-align: center; padding: 20px;">
              ${getTranslation('no-logs-found') || 'لا توجد سجلات'}
            </td>
          </tr>
        `;
      }
    } catch (error) {
      console.error('Error loading logs:', error);
      logsBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; padding: 20px; color: red;">
            ${getTranslation('error-loading-logs') || 'خطأ في تحميل السجلات'}
          </td>
        </tr>
      `;
    }
  }

  async function fetchUsers() {
    try {
      const res = await fetch('http://localhost:3006/api/users?roles', { headers: authHeader() });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const json = await res.json();
      
      if (json.data && Array.isArray(json.data)) {
        json.data.forEach(u => {
          const opt = document.createElement('option');
          opt.value = u.name;
          opt.textContent = u.name;
          userNameSelect.appendChild(opt);
        });
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }

  // ✅ فلترة مباشرة عند التغيير
  [fromDateInput, toDateInput, actionTypeSelect, userNameSelect].forEach(el => {
    el.addEventListener('change', loadLogs);
  });

  searchInput.addEventListener('input', () => {
    setTimeout(loadLogs, 300); // قليل من التأخير لتحسين التجربة
  });

  // مراقبة تغيير اللغة
  window.addEventListener('languageChanged', () => {
    updatePageTexts();
    loadLogs(); // إعادة تحميل السجلات لتحديث التواريخ
  });

  // أول تحميل
  updatePageTexts();
  fetchUsers();
  loadLogs();
});
