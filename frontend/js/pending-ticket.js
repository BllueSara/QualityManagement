// استيراد الترجمة
if (typeof getTranslation !== 'function') {
  function getTranslation(key) {
    const lang = localStorage.getItem('language') || 'ar';
    if (window.translations && window.translations[lang] && window.translations[lang][key]) {
      return window.translations[lang][key];
    }
    return key;
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
  const isAdmin = role === 'admin';

  // أخفِ كل العناصر المعلّمة بـ data-role="admin" إن لم يكن المستخدم Admin
  document.querySelectorAll('[data-role="admin"]').forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
  });
  // 1) جلب كل التذاكر
  const ticketsRes = await fetch('http://localhost:3006/api/tickets', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { data: tickets } = await ticketsRes.json();


const deptsRes = await fetch('http://localhost:3006/api/departments', {
  headers: { 'Authorization': `Bearer ${token}` }
});

const resJson = await deptsRes.json(); // فقط هنا
console.log('📦 استجابة الأقسام:', resJson);

const depts = Array.isArray(resJson) ? resJson : [];


  // 3) بناء صف لكل تذكرة
  tickets.forEach(ticket => {
    const row = document.createElement('tr');
    row.dataset.id = ticket.id;

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
          ${depts.map(d => `<div class="dropdown-item" data-value="${d.id}">${d.name}</div>`).join('')}
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
    tdStatus.innerHTML = `<span class="badge-pending">${getTranslation(ticket.status === 'تم الإرسال' || ticket.status === 'Sent' ? 'sent' : ticket.status === 'قيد الانتظار' || ticket.status === 'Pending' ? 'pending' : ticket.status)}</span>`;
    row.append(tdStatus);

    // زر التحويل
    const tdAct = document.createElement('td');
    tdAct.innerHTML = `<button class="btn-send"><i class="bi bi-send"></i> ${getTranslation('send')}</button>`;
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

      if (!selectedDepts.length) {
        uBtn.disabled = true;
        uBtn.textContent = getTranslation('select-department-first');
        return;
      }
      uBtn.disabled = false;
      uBtn.textContent = selectedUsers.length
        ? `${selectedUsers.length} ${getTranslation('selected')}`
        : getTranslation('select-people');

      // لكل قسم، اجلب المستخدمين
      for (const deptVal of selectedDepts) {
        const res = await fetch(
          `http://localhost:3006/api/users?departmentId=${deptVal}`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        if (!res.ok) continue;
        const { data: users } = await res.json();

        // فاصل بعنوان القسم
        const divider = document.createElement('div');
        divider.className = 'dropdown-divider';
        const deptLabel = deptDrop.querySelector(`.dropdown-item[data-value="${deptVal}"]`).textContent;
        divider.textContent = deptLabel;
        uList.append(divider);

        // بناء عناصر المستخدمين
        users.forEach(u => {
          const d = document.createElement('div');
          d.className = 'dropdown-item';
          d.textContent = u.name;
          d.dataset.userid = u.id;
          d.dataset.dept   = deptVal;
          if (selectedUsers.some(sel => sel.id === u.id)) {
            d.classList.add('selected');
          }
          uList.append(d);
        });
      }

      // فلترة البحث
      const search = uList.querySelector('.dropdown-search');
      search.addEventListener('input', () => {
        const val = search.value.trim();
        uList.querySelectorAll('.dropdown-item').forEach(i => {
          i.style.display = i.textContent.includes(val) ? 'block' : 'none';
        });
      });
    }

    // ضبط dropdown الأقسام
    ;(() => {
      const btn    = deptDrop.querySelector('.dropdown-btn');
      const list   = deptDrop.querySelector('.dropdown-content');
      const search = list.querySelector('.dropdown-search');

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

        list.classList.remove('active');
        await rebuildUsersList();
        row.querySelector('.selected-cell').innerHTML = '';
      });
    })();

    // ضبط dropdown المستخدمين
    ;(() => {
      const btn    = userDrop.querySelector('.dropdown-btn');
      const list   = userDrop.querySelector('.dropdown-content');
      const search = list.querySelector('.dropdown-search');

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
    if (!selectedUsers.length) {
      alert(getTranslation('please-select-users'));
      return;
    }

    const ticketId  = row.dataset.id;
    const assignees = selectedUsers.map(u => u.id);

    try {
      // 1) حدّث الحالة إلى "تم الإرسال"
      await fetch(`http://localhost:3006/api/tickets/${ticketId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type' : 'application/json'
        },
        body: JSON.stringify({ status: 'تم الإرسال' })
      });

      // 2) سجّل التحويل
      await fetch(`http://localhost:3006/api/tickets/${ticketId}/assign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type' : 'application/json'
        },
        body: JSON.stringify({ assignees })
      });

      alert(getTranslation('success-sent'));
      row.querySelector('.badge-pending').textContent = getTranslation('sent');
    } catch (err) {
      // console.error(err);
      alert(getTranslation('error-sending'));
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
