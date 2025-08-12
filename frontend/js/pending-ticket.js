// استيراد الترجمة
const apiBase = 'http://10.99.28.23:3006/api';

// دالة إظهار التوست - خارج DOMContentLoaded لتكون متاحة في كل مكان
function showToast(message, type = 'info', duration = 3000) {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    // Force reflow to ensure animation plays from start
    toast.offsetWidth; 

    // تفعيل التوست
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Set a timeout to remove the toast
    setTimeout(() => {
        toast.classList.remove('show');
        // Remove element after animation completes
        setTimeout(() => {
            toast.remove();
        }, 500); // Should match CSS animation duration
    }, duration);
}

if (typeof getTranslation !== 'function') {
  function getTranslation(key) {
    const lang = localStorage.getItem('language') || 'ar';
    if (window.translations && window.translations[lang] && window.translations[lang][key]) {
      return window.translations[lang][key];
    }
    return key;
  }
}
function getLocalizedName(name) {
  const lang = localStorage.getItem('language') || 'ar';
  
  if (!name) return 'غير محدد';
  
  try {
    // إذا كان الاسم كائن JSON
    if (typeof name === 'string' && name.trim().startsWith('{')) {
      const parsed = JSON.parse(name);
      return parsed[lang] || parsed['ar'] || parsed['en'] || name;
    }
    // إذا كان الاسم كائن مباشرة
    if (typeof name === 'object' && name !== null) {
      return name[lang] || name['ar'] || name['en'] || JSON.stringify(name);
    }
    // إذا كان نص عادي
    return typeof name === 'string' ? name : 'غير محدد';
  } catch (error) {
    console.warn('⚠️ خطأ في معالجة اسم القسم:', name, error);
    return typeof name === 'string' ? name : 'غير محدد';
  }
}


function updateTableUI() {
  const lang = localStorage.getItem('language') || 'ar';
  // تحديث رؤوس الجدول
  document.querySelectorAll('th[data-translate]').forEach(th => {
    const key = th.getAttribute('data-translate');
    th.textContent = getTranslation(key);
  });
  // تحديث عنوان الصفحة
  const title = document.querySelector('h2[data-translate]');
  if (title) title.textContent = getTranslation(title.getAttribute('data-translate'));
  // تحديث أزرار الهيدر
  const backBtnText = document.getElementById('mainBackBtnText');
  if (backBtnText) backBtnText.textContent = getTranslation('back');
  const homeBtn = document.querySelector('.home-btn span');
  if (homeBtn) homeBtn.textContent = getTranslation('home');
  // تحديث اتجاه الصفحة
  const main = document.querySelector('main.content-wrapper');
  if (main) {
    main.dir = lang === 'ar' ? 'rtl' : 'ltr';
    main.style.textAlign = lang === 'ar' ? 'right' : 'left';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  const tbody = document.querySelector('tbody');
      // console.log( token ? JSON.parse(atob(token.split('.')[1])) : 'no token' );

  if (!token) return;

  const { role } = JSON.parse(atob(token.split('.')[1]));
  const isAdmin = role === 'admin' || role === 'manager_ovr';

  // أخفِ كل العناصر المعلّمة بـ data-role="admin" إن لم يكن المستخدم Admin
  document.querySelectorAll('[data-role="admin"]').forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
  });
  // 1) جلب كل التذاكر
  const ticketsRes = await fetch('http://10.99.28.23:3006/api/tickets', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { data: tickets } = await ticketsRes.json();
  console.log('tickets:', tickets);


const deptsRes = await fetch('http://10.99.28.23:3006/api/departments/all', {
  headers: { 'Authorization': `Bearer ${token}` }
});

if (!deptsRes.ok) {
  console.error('❌ خطأ في جلب الأقسام:', deptsRes.status, deptsRes.statusText);
  throw new Error(`فشل في جلب الأقسام: ${deptsRes.status}`);
}

const resJson = await deptsRes.json(); // فقط هنا
console.log('📦 استجابة الأقسام:', resJson);

// معالجة الاستجابة - قد تكون مصفوفة مباشرة أو كائن مع data
const depts = Array.isArray(resJson) ? resJson : (resJson.data || []);

if (!depts.length) {
  console.warn('⚠️ لا توجد أقسام متاحة');
}


  // 3) بناء صف لكل تذكرة
  tickets.forEach(ticket => {
    const row = document.createElement('tr');
    row.dataset.id = ticket.id;
  row.dataset.assignedNames = JSON.stringify(ticket.assignedNames || []);

    // خلية رقم التذكرة
    const tdId = document.createElement('td');
    tdId.textContent = `#${ticket.id}`;
    row.append(tdId);

    // خلية القسم (dropdown)
    const tdDept = document.createElement('td');
    tdDept.innerHTML = `
      <div class="dropdown-custom" data-type="dept">
        <button class="dropdown-btn">${getTranslation('select-department')}</button>
        <div class="dropdown-content">
          <input type="text" class="dropdown-search" placeholder="${getTranslation('search-department')}">
${depts.map(d => {
  const name = getLocalizedName(d.name);
  return `<div class="dropdown-item" data-value="${d.id}">${name}</div>`;
}).join('')}

        </div>
      </div>`;
    row.append(tdDept);

    // خلية المستخدمين (dropdown فارغ)
    const tdUsers = document.createElement('td');
    tdUsers.innerHTML = `
      <div class="dropdown-custom" data-type="users">
        <button class="dropdown-btn" disabled>${getTranslation('select-department-first')}</button>
        <div class="dropdown-content">
          <input type="text" class="dropdown-search" placeholder="${getTranslation('search-person')}">
        </div>
      </div>`;
    row.append(tdUsers);

    // خلية المختارون
    const tdSel = document.createElement('td');
    tdSel.className = 'selected-cell';
    row.append(tdSel);

    // خلية الحالة
const tdStatus = document.createElement('td');
const statusKey = (ticket.status || '').toLowerCase();

let translatedStatus = '';
let badgeClass = 'badge-default';

switch (statusKey) {
  case 'new':
  case 'جديد':
    translatedStatus = getTranslation('new');
    badgeClass = 'badge-new';
    break;

  case 'sent':
  case 'تم الإرسال':
    translatedStatus = getTranslation('sent');
    badgeClass = 'badge-sent';
    break;

  case 'closed':
  case 'مغلق':
    translatedStatus = getTranslation('closed');
    badgeClass = 'badge-closed';
    break;

  default:
    translatedStatus = ticket.status;
    badgeClass = 'badge-default';
    break;
}

tdStatus.innerHTML = `<span class="${badgeClass}">${translatedStatus}</span>`;
row.append(tdStatus);

    // زر التحويل - تعطيله للتذاكر المغلقة
    const tdAct = document.createElement('td');
    const isClosed = statusKey === 'closed' || statusKey === 'مغلق';
    const sendBtn = document.createElement('button');
    sendBtn.className = 'btn-send';
    sendBtn.innerHTML = `<i class="bi bi-send"></i> ${getTranslation('send')}`;
    
    if (isClosed) {
      sendBtn.disabled = true;
      sendBtn.title = getTranslation('ticket-closed-error') || 'لا يمكن تحويل الحدث العارض لأنه مغلق';
      sendBtn.style.opacity = '0.5';
      sendBtn.style.cursor = 'not-allowed';
    }
    
    // زر عرض التفاصيل
    const detailsBtn = document.createElement('button');
    detailsBtn.className = 'btn-details';
    detailsBtn.innerHTML = `<i class="bi bi-eye"></i> ${getTranslation('view-details')}`;
    detailsBtn.style.marginRight = '8px';
    detailsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const ticketId = row.dataset.id;
      window.location.href = `ticket-details.html?id=${ticketId}`;
    });
    
    tdAct.appendChild(detailsBtn);
    tdAct.appendChild(sendBtn);
    row.append(tdAct);

    tbody.append(row);
  });

  // بعد بناء الجدول
  updateTableUI();
  if (typeof applyLanguageUI === 'function') {
    const lang = localStorage.getItem('language') || 'ar';
    applyLanguageUI(lang);
  }

  // 4) ضبط جميع الصفوف
  document.querySelectorAll('tbody tr').forEach(initRow);

  function initRow(row) {
    const deptDrop = row.querySelector('[data-type=dept]');
    const userDrop = row.querySelector('[data-type=users]');
    let selectedDepts = [];
    let selectedUsers = [];

    // إعادة بناء قائمة المستخدمين
async function rebuildUsersList() {
  const uBtn = userDrop.querySelector('.dropdown-btn');
  const uList = userDrop.querySelector('.dropdown-content');
  uList.innerHTML = `<input type="text" class="dropdown-search" placeholder="${getTranslation('search-person')}">`;

  // اقرأ الأسماء اللي أرسلت لهم قبل
  const existingNames = JSON.parse(row.dataset.assignedNames || '[]');

  if (!selectedDepts.length) {
    uBtn.disabled = true;
    uBtn.textContent = getTranslation('select-department-first');
    return;
  }
  uBtn.disabled = false;
  uBtn.textContent = selectedUsers.length
    ? `${selectedUsers.length} ${getTranslation('selected')}`
    : getTranslation('select-people');

  // جلب المستخدمين المكلفين مسبقاً لهذه التذكرة
  const ticketId = row.dataset.id;
  let existingAssigneeIds = [];
  try {
    const assignRes = await fetch(`${apiBase}/tickets/${ticketId}/assign`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (assignRes.ok) {
      const assignData = await assignRes.json();
      existingAssigneeIds = assignData.assignees ? assignData.assignees.map(a => a.id) : [];
    }
  } catch (err) {
    console.error('Error fetching existing assignees:', err);
  }

  for (const deptVal of selectedDepts) {
    // فاصل باسم القسم
    const divider = document.createElement('div');
    divider.className = 'dropdown-divider';
    divider.textContent = getLocalizedName(
      depts.find(d => d.id == deptVal).name
    );
    uList.append(divider);

    // جلب مستخدمي القسم
    const res = await fetch(`${apiBase}/users?departmentId=${deptVal}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) continue;
    const { data: users } = await res.json();

    users.forEach(u => {
      // استثنِ الأسماء اللي أرسلت لهم مسبقاً
      if (existingNames.includes(u.name)) return;
      
      // استثنِ المستخدمين المكلفين مسبقاً
      if (existingAssigneeIds.includes(u.id)) return;

      const div = document.createElement('div');
      div.className = 'dropdown-item';
      div.textContent = u.name;
      div.dataset.userid = u.id;
      div.dataset.dept   = deptVal;
      uList.append(div);
    });
  }

  // فلترة البحث
  const search = uList.querySelector('.dropdown-search');
  search.addEventListener('input', () => {
    const v = search.value.trim();
    uList.querySelectorAll('.dropdown-item').forEach(i => {
      i.style.display = i.textContent.includes(v) ? 'block' : 'none';
    });
  });
}


    // ضبط dropdown الأقسام
    ;(() => {
      const btn    = deptDrop.querySelector('.dropdown-btn');
      const list   = deptDrop.querySelector('.dropdown-content');
      const search = list.querySelector('.dropdown-search');
      search.addEventListener('click', e => e.stopPropagation());
      btn.addEventListener('click', e => {
        e.stopPropagation();
        list.classList.toggle('active');
      });
      document.addEventListener('click', () => list.classList.remove('active'));
      search.addEventListener('input', () => {
        const v = search.value.trim();
        list.querySelectorAll('.dropdown-item').forEach(i => {
          i.style.display = i.textContent.includes(v) ? 'block' : 'none';
        });
      });
      list.addEventListener('click', async e => {
        if (!e.target.classList.contains('dropdown-item')) return;
        e.stopPropagation();
        const item = e.target;
        item.classList.toggle('selected');
        selectedDepts = Array.from(
          list.querySelectorAll('.dropdown-item.selected')
        ).map(i => i.dataset.value);

        // تحديث نص الزر
        if (!selectedDepts.length) {
          btn.textContent = getTranslation('select-department');
          selectedUsers = [];
        } else if (selectedDepts.length === 1) {
          btn.textContent = list.querySelector('.dropdown-item.selected').textContent;
        } else {
          btn.textContent = `${selectedDepts.length} ${getTranslation('departments-count')}`;
        }

        await rebuildUsersList();
        row.querySelector('.selected-cell').innerHTML = '';
      });
    })();

    // ضبط dropdown المستخدمين
    ;(() => {
      const btn    = userDrop.querySelector('.dropdown-btn');
      const list   = userDrop.querySelector('.dropdown-content');
      const search = list.querySelector('.dropdown-search');
      search.addEventListener('click', e => e.stopPropagation());
      btn.addEventListener('click', e => {
        e.stopPropagation();
        list.classList.toggle('active');
      });
      document.addEventListener('click', () => list.classList.remove('active'));
      search.addEventListener('input', () => {
        const v = search.value.trim();
        list.querySelectorAll('.dropdown-item').forEach(i => {
          i.style.display = i.textContent.includes(v) ? 'block' : 'none';
        });
      });
      list.addEventListener('click', e => {
        if (!e.target.classList.contains('dropdown-item')) return;
        e.stopPropagation();
        const item   = e.target;
        const userId = item.dataset.userid;
        const name   = item.textContent;
        const dept   = item.dataset.dept;

        if (item.classList.toggle('selected')) {
          selectedUsers.push({ id: userId, name, dept });
        } else {
          selectedUsers = selectedUsers.filter(u => u.id !== userId);
        }

        // حدّث نص الزر
        btn.textContent = selectedUsers.length
          ? `${selectedUsers.length} ${getTranslation('selected')}`
          : getTranslation('select-people');

        // حدّث خلية المختارون
        const selCell = row.querySelector('.selected-cell');
        selCell.innerHTML = '';
        selectedUsers.forEach(u => {
          const b = document.createElement('span');
          b.className = 'badge';
          const lbl = deptDrop.querySelector(`.dropdown-item[data-value="${u.dept}"]`).textContent;
          b.textContent = `${u.name} (${lbl})`;
          selCell.append(b);
        });
      });
    })();
      const sendBtn = row.querySelector('.btn-send');

  sendBtn.addEventListener('click', async () => {
    // التحقق من أن الزر غير معطل
    if (sendBtn.disabled) {
      showToast(sendBtn.title || getTranslation('ticket-closed-error') || 'لا يمكن تحويل الحدث العارض لأنه مغلق', 'error');
      return;
    }

    if (!selectedUsers.length) {
      showToast(getTranslation('please-select-users'), 'error');
      return;
    }

    const ticketId  = row.dataset.id;
    const assignees = selectedUsers.map(u => u.id);

    try {
      // 1) حدّث الحالة إلى "تم الإرسال"
      const statusRes = await fetch(`http://10.99.28.23:3006/api/tickets/${ticketId}`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type' : 'application/json'
  },
  body: JSON.stringify({ status: 'تم الإرسال' })
});

if (!statusRes.ok) throw new Error('Failed to update status');

const assignRes = await fetch(`http://10.99.28.23:3006/api/tickets/${ticketId}/assign`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type' : 'application/json'
  },
  body: JSON.stringify({ assignees })
});

if (!assignRes.ok) {
  const errorData = await assignRes.json();
  
  // التعامل مع الأخطاء المختلفة
  if (errorData.status === 'closed') {
    showToast(getTranslation('ticket-closed-error') || 'لا يمكن تحويل الحدث العارض لأنه مغلق', 'error');
    // تعطيل الزر بعد اكتشاف أن التذكرة مغلقة
    sendBtn.disabled = true;
    sendBtn.style.opacity = '0.5';
    sendBtn.style.cursor = 'not-allowed';
    return;
  }
  
  if (errorData.status === 'already_assigned') {
    showToast(getTranslation('already-assigned-error') || 'جميع المستخدمين المحددين مكلفون بالفعل بهذا الحدث العارض', 'error');
    return;
  }
  
  throw new Error(errorData.error || 'Failed to assign ticket');
}

const result = await assignRes.json();

// رسالة نجاح مع تفاصيل
let successMessage = getTranslation('success-sent');
if (result.assignedCount > 0) {
  successMessage += `\nتم تحويل الحدث العارض إلى ${result.assignedCount} مستخدم`;
  if (result.skippedCount > 0) {
    successMessage += `\nتم تخطي ${result.skippedCount} مستخدم (مكلفون مسبقاً)`;
  }
}

showToast(successMessage, 'success');

// تحديث خانة الحالة بشكل مرن
const tdStatus = row.querySelector('td:nth-child(5)');
if (tdStatus) {
  tdStatus.innerHTML = `<span class="badge-sent">${getTranslation('sent')}</span>`;
}

// تحديث قائمة الأسماء المكلفة
const newNames = selectedUsers.map(u => u.name);
const existingNames = JSON.parse(row.dataset.assignedNames || '[]');
const allNames = existingNames.concat(newNames);
row.dataset.assignedNames = JSON.stringify(allNames);

// إعادة بناء قائمة المستخدمين لإزالة المكلفين الجدد
await rebuildUsersList();

} catch (err) {
  console.error('❌ Error:', err);
  showToast(getTranslation('error-sending') + `\n${err.message || ''}`, 'error');
}
  });
  }
});

function updateDropdownsDirection(lang) {
  // تحديث اتجاه حقول البحث في dropdowns
  document.querySelectorAll('.dropdown-search').forEach(input => {
    if (lang === 'ar') {
      input.style.setProperty('direction', 'rtl', 'important');
      input.style.setProperty('text-align', 'right', 'important');
    } else {
      input.style.setProperty('direction', 'ltr', 'important');
      input.style.setProperty('text-align', 'left', 'important');
    }
  });
  
  // تحديث اتجاه عناصر dropdown
  document.querySelectorAll('.dropdown-item').forEach(item => {
    if (lang === 'ar') {
      item.style.setProperty('direction', 'rtl', 'important');
      item.style.setProperty('text-align', 'right', 'important');
    } else {
      item.style.setProperty('direction', 'ltr', 'important');
      item.style.setProperty('text-align', 'left', 'important');
    }
  });
  
  // تحديث اتجاه أزرار dropdown
  document.querySelectorAll('.dropdown-btn').forEach(btn => {
    if (lang === 'ar') {
      btn.style.setProperty('direction', 'rtl', 'important');
      btn.style.setProperty('text-align', 'right', 'important');
    } else {
      btn.style.setProperty('direction', 'ltr', 'important');
      btn.style.setProperty('text-align', 'left', 'important');
    }
  });
  
  // تحديث اتجاه السهم في أزرار dropdown
  updateDropdownArrows(lang);
}

function updateDropdownArrows(lang) {
  document.querySelectorAll('.dropdown-btn').forEach(btn => {
    // إزالة السهم الحالي إذا وجد
    const existingArrow = btn.querySelector('.dropdown-arrow');
    if (existingArrow) {
      existingArrow.remove();
    }
    
    // إضافة السهم الجديد حسب اللغة
    const arrow = document.createElement('i');
    arrow.className = 'dropdown-arrow';
    
    if (lang === 'ar') {
      arrow.className += ' fas fa-chevron-left';
      arrow.style.marginRight = '8px';
      arrow.style.marginLeft = '0';
    } else {
      arrow.className += ' fas fa-chevron-right';
      arrow.style.marginLeft = '8px';
      arrow.style.marginRight = '0';
    }
    
    // إضافة السهم في بداية النص للعربية وفي النهاية للإنجليزية
    if (lang === 'ar') {
      btn.insertBefore(arrow, btn.firstChild);
    } else {
      btn.appendChild(arrow);
    }
  });
}
