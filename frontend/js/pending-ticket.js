const usersByDept = {
  sales: ['أحمد الزهراني','سارة التويجري','خالد المطيري'],
  it:    ['محمد العتيبي','فاطمة القحطاني','عبدالله السبيعي'],
  hr:    ['علي العتيبي','ريم خالد','منى الحداد'],
  finance: ['فهد المانع','نورة الشهري'],
  support: ['خالد الغامدي','سعاد الزهراني'],
  admin: ['بدر الععيبي','منى الزهراني']
};

document.querySelectorAll('tbody tr').forEach(row => {
  const deptDrop = row.querySelector('[data-type=dept]');
  const userDrop = row.querySelector('[data-type=users]');
  let selectedDepts = [];
  let selectedUsers = []; // { name, dept }

  function rebuildUsersList() {
    const uBtn = userDrop.querySelector('.dropdown-btn');
    const uList = userDrop.querySelector('.dropdown-content');
    uList.innerHTML = `<input type="text" class="dropdown-search" placeholder="ابحث...">`;

    // إذا ما في أقسام مختارة، خلِّي الزر معطل
    if (!selectedDepts.length) {
      uBtn.disabled = true;
      uBtn.textContent = 'اختر القسم أولاً';
      return;
    }

    uBtn.disabled = false;
    uBtn.textContent = selectedUsers.length
      ? `${selectedUsers.length} مختار`
      : 'اختر الأشخاص';

    // لبناء القائمة: لكل قسم، نضيف فاصل ثم الأسماء
    selectedDepts.forEach(deptVal => {
      // عنوان القسم
      const divider = document.createElement('div');
      divider.className = 'dropdown-divider';
      divider.textContent = deptDrop.querySelector(`.dropdown-item[data-value="${deptVal}"]`).textContent;
      uList.append(divider);

      // أسماء القسم
      usersByDept[deptVal].forEach(name => {
        const d = document.createElement('div');
        d.className = 'dropdown-item';
        d.textContent = name;
        d.dataset.dept = deptVal;
        // إذا كان هذا المستخدم مختار سابقاً
        if (selectedUsers.some(u => u.name === name && u.dept === deptVal)) {
          d.classList.add('selected');
        }
        uList.append(d);
      });
    });

    // فلترة البحث
    const search = uList.querySelector('.dropdown-search');
    search.addEventListener('input', () => {
      const val = search.value.trim();
      uList.querySelectorAll('.dropdown-item').forEach(i => {
        i.style.display = i.textContent.includes(val) ? 'block' : 'none';
      });
    });
  }

  // 1) ضبط dropdown الأقسام
  (() => {
    const btn = deptDrop.querySelector('.dropdown-btn');
    const list = deptDrop.querySelector('.dropdown-content');
    const search = list.querySelector('.dropdown-search');

    btn.addEventListener('click', e => {
      e.stopPropagation();
      list.classList.toggle('active');
    });
    document.addEventListener('click', () => list.classList.remove('active'));
    list.addEventListener('click', e => e.stopPropagation());

    // فلترة البحث في الأقسام
    search.addEventListener('input', () => {
      const val = search.value.trim();
      list.querySelectorAll('.dropdown-item').forEach(i => {
        i.style.display = i.textContent.includes(val) ? 'block' : 'none';
      });
    });

    list.addEventListener('click', e => {
      if (!e.target.classList.contains('dropdown-item')) return;
      const item = e.target;
      const val  = item.dataset.value;

      // toggle اختيار القسم
      item.classList.toggle('selected');
      // حدّث المصفوفة
      selectedDepts = Array.from(
        list.querySelectorAll('.dropdown-item.selected')
      ).map(i => i.dataset.value);

      // حدّث نص الزر
      if (selectedDepts.length === 0) {
        btn.textContent = 'اختر القسم';
        // رجّع users لحالته الابتدائية
        selectedUsers = [];
      } else if (selectedDepts.length === 1) {
        btn.textContent = list.querySelector('.dropdown-item.selected').textContent;
      } else {
        btn.textContent = `${selectedDepts.length} أقسام`;
      }

      list.classList.remove('active');
      // بعد تعديل الأقسام نعيد بناء قائمة المستخدمين
      rebuildUsersList();
      // ونفرغ خلية المختارون
      row.querySelector('.selected-cell').innerHTML = '';
    });
  })();

  // 2) ضبط dropdown المستخدمين (multi-select)
  (() => {
    const btn = userDrop.querySelector('.dropdown-btn');
    const list = userDrop.querySelector('.dropdown-content');

    btn.addEventListener('click', e => {
      e.stopPropagation();
      list.classList.toggle('active');
    });
    document.addEventListener('click', () => list.classList.remove('active'));
    list.addEventListener('click', e => e.stopPropagation());

    list.addEventListener('click', e => {
      if (!e.target.classList.contains('dropdown-item')) return;
      const item = e.target;
      const name = item.textContent;
      const deptVal = item.dataset.dept;

      // toggle اختيار المستخدم
      if (item.classList.toggle('selected')) {
        selectedUsers.push({ name, dept: deptVal });
      } else {
        selectedUsers = selectedUsers.filter(u => !(u.name === name && u.dept === deptVal));
      }

      // حدّث نص الزر
      btn.textContent = selectedUsers.length
        ? `${selectedUsers.length} مختار`
        : 'اختر الأشخاص';

      // حدّث خلية المختارون
      const selCell = row.querySelector('.selected-cell');
      selCell.innerHTML = '';
      selectedUsers.forEach(u => {
        const b = document.createElement('span');
        b.className = 'badge';
        // جلب اسم القسم العربي من العنصر الأصلي
        const lbl = deptDrop.querySelector(`.dropdown-item[data-value="${u.dept}"]`).textContent;
        b.textContent = `${u.name} (${lbl})`;
        selCell.append(b);
      });

      // نحافظ على القائمة مفتوحة حتى ينتهي المستخدم
    });
  })();
});
