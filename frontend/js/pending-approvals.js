// pending-approvals.js

// 1) ضع هنا apiBase و fetchJSON
const apiBase = 'http://localhost:3000/api';
const authToken = localStorage.getItem('token') || null;

async function fetchJSON(url, opts = {}) {
  opts.headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
  };
  const res = await fetch(url, opts);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText}`);
  }
  const contentType = res.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) {
    const json = await res.json();
    return json.data ?? json;
  } else {
    return await res.text();
  }
}

// 2) بعد تحميل الـ DOM نفّذ initDropdowns
document.addEventListener('DOMContentLoaded', () => {
  initDropdowns().catch(err => {
    console.error('Error initializing dropdowns:', err);
  });
});

async function initDropdowns() {
  // جلب الأقسام من الباك
  const departments = await fetchJSON(`${apiBase}/departments`);

  document.querySelectorAll('tbody tr').forEach(row => {
    const deptDrop = row.querySelector('[data-type=dept]');
    const userDrop = row.querySelector('[data-type=users]');
    let selectedDepts = [];
    let selectedUsers = [];

    // بناء قائمة الأقسام
    const deptBtn  = deptDrop.querySelector('.dropdown-btn');
    const deptList = deptDrop.querySelector('.dropdown-content');
    deptList.innerHTML = `<input type="text" class="dropdown-search" placeholder="ابحث القسم...">`;
    departments.forEach(d => {
      const itm = document.createElement('div');
      itm.className     = 'dropdown-item';
      itm.dataset.value = d.id;
      itm.textContent   = d.name;
      deptList.appendChild(itm);
    });

    // ضبط dropdown الأقسام
    (function setupDeptDropdown() {
      const search = deptList.querySelector('.dropdown-search');
      deptBtn.addEventListener('click', e => {
        e.stopPropagation();
        deptList.classList.toggle('active');
      });
      document.addEventListener('click', () => deptList.classList.remove('active'));
      deptList.addEventListener('click', e => e.stopPropagation());
      search.addEventListener('input', () => {
        const v = search.value.trim();
        deptList.querySelectorAll('.dropdown-item').forEach(i => {
          i.style.display = i.textContent.includes(v) ? 'block' : 'none';
        });
      });
      deptList.addEventListener('click', async e => {
        if (!e.target.classList.contains('dropdown-item')) return;
        const item = e.target;
        item.classList.toggle('selected');
        selectedDepts = Array.from(deptList.querySelectorAll('.dropdown-item.selected'))
                            .map(i => ({ id: i.dataset.value, name: i.textContent }));
        if (selectedDepts.length === 0) {
          deptBtn.textContent = 'اختر القسم';
          selectedUsers = [];
        } else if (selectedDepts.length === 1) {
          deptBtn.textContent = selectedDepts[0].name;
        } else {
          deptBtn.textContent = `${selectedDepts.length} أقسام`;
        }
        deptList.classList.remove('active');
        rebuildUsersList();
        row.querySelector('.selected-cell').innerHTML = '';
      });
    })();

    // دالة لإعادة بناء قائمة المستخدمين
    async function rebuildUsersList() {
      const uBtn  = userDrop.querySelector('.dropdown-btn');
      const uList = userDrop.querySelector('.dropdown-content');
      uList.innerHTML = `<input type="text" class="dropdown-search" placeholder="ابحث الشخص...">`;

      if (!selectedDepts.length) {
        uBtn.disabled    = true;
        uBtn.textContent = 'اختر القسم أولاً';
        return;
      }
      uBtn.disabled    = false;
      uBtn.textContent = selectedUsers.length
                          ? `${selectedUsers.length} مختار`
                          : 'اختر الأشخاص';

      for (const dept of selectedDepts) {
        const divider = document.createElement('div');
        divider.className   = 'dropdown-divider';
        divider.textContent = dept.name;
        uList.appendChild(divider);

        // جلب المستخدمين لكل قسم
    // صحّح إلى راوت المستخدمين بالـ query param
   let users = [];
   try {
     users = await fetchJSON(
       `${apiBase}/users?departmentId=${dept.id}`
     );
   } catch (err) {
     console.warn(`لم يتم العثور على مستخدمين للقسم ${dept.id}`, err);
   }
        users.forEach(u => {
          const item = document.createElement('div');
          item.className      = 'dropdown-item';
          item.textContent    = u.name;
          item.dataset.deptId = dept.id;
          if (selectedUsers.some(x => x.name === u.name && x.deptId === dept.id)) {
            item.classList.add('selected');
          }
          uList.appendChild(item);
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

    // ضبط dropdown المستخدمين
    (function setupUsersDropdown() {
      const btn  = userDrop.querySelector('.dropdown-btn');
      const list = userDrop.querySelector('.dropdown-content');
      btn.addEventListener('click', e => {
        e.stopPropagation();
        list.classList.toggle('active');
      });
      document.addEventListener('click', () => list.classList.remove('active'));
      list.addEventListener('click', e => e.stopPropagation());
      list.addEventListener('click', e => {
        if (!e.target.classList.contains('dropdown-item')) return;
        const item   = e.target;
        const name   = item.textContent;
        const deptId = item.dataset.deptId;

        if (item.classList.toggle('selected')) {
          selectedUsers.push({ name, deptId });
        } else {
          selectedUsers = selectedUsers.filter(
            x => !(x.name === name && x.deptId === deptId)
          );
        }

        btn.textContent = selectedUsers.length
                            ? `${selectedUsers.length} مختار`
                            : 'اختر الأشخاص';

        const selCell = row.querySelector('.selected-cell');
        selCell.innerHTML = '';
        selectedUsers.forEach(u => {
          const b = document.createElement('span');
          b.className = 'badge';
          const deptName = selectedDepts.find(d => d.id === u.deptId).name;
          b.textContent = `${u.name} (${deptName})`;
          selCell.appendChild(b);
        });
      });
    })();

  });
}
