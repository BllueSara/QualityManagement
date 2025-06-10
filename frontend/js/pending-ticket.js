    const usersByDept = {
      sales: ['أحمد الزهراني','سارة التويجري','خالد المطيري'],
      it:    ['محمد العتيبي','فاطمة القحطاني','عبدالله السبيعي'],
      hr:    ['علي العتيبي','ريم خالد','منى الحداد'],
      finance: ['فهد المانع','نورة الشهري'],
      support: ['خالد الغامدي','سعاد الزهراني'],
      admin: ['بدر العتيبي','منى الزهراني']
    };

    document.querySelectorAll('.dropdown-custom').forEach(drop => {
      const btn    = drop.querySelector('.dropdown-btn'),
            list   = drop.querySelector('.dropdown-content'),
            search = drop.querySelector('.dropdown-search'),
            type   = drop.dataset.type,
            row    = drop.closest('tr');

      btn.addEventListener('click', e => {
        e.stopPropagation();
        list.classList.toggle('active');
      });

      document.addEventListener('click', () => list.classList.remove('active'));
      list.addEventListener('click', e => e.stopPropagation());

      if (search) {
        search.addEventListener('input', () => {
          const val = search.value.trim();
          list.querySelectorAll('.dropdown-item').forEach(i => {
            i.style.display = i.textContent.includes(val) ? 'block' : 'none';
          });
        });
      }

      list.addEventListener('click', e => {
        if (!e.target.classList.contains('dropdown-item')) return;
        const item = e.target;

        if (type === 'dept') {
          // set department text and close dropdown
          btn.textContent = item.textContent;
          list.classList.remove('active');

          // enable users dropdown
          const uDrop  = row.querySelector('[data-type=users]'),
                uBtn   = uDrop.querySelector('.dropdown-btn'),
                uList  = uDrop.querySelector('.dropdown-content');
          uBtn.disabled = false;
          uBtn.textContent = 'اختر الأشخاص';
          uList.innerHTML = '<input class="dropdown-search" placeholder="ابحث...">';
          usersByDept[item.dataset.value]?.forEach(name => {
            const d = document.createElement('div'); d.className='dropdown-item'; d.textContent=name; uList.append(d);
          });
          row.querySelector('.selected-cell').innerHTML = '';
          return;
        }

        // users multi-select
        item.classList.toggle('selected');
        const selNames = Array.from(
          row.querySelectorAll('[data-type=users] .dropdown-item.selected')
        ).map(i => i.textContent);

        const uBtn = row.querySelector('[data-type=users] .dropdown-btn');
        uBtn.textContent = selNames.length ? `${selNames.length} مختار` : 'اختر الأشخاص';

        const selCell = row.querySelector('.selected-cell');
        selCell.innerHTML = '';
        selNames.forEach(n => {
          const b = document.createElement('span'); b.className='badge'; b.textContent=n; selCell.append(b);
        });
        // keep dropdown open
      });
    });