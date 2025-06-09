// scripts.js

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const ticketsBody = document.getElementById('ticketsBody');
    const rows = Array.from(ticketsBody.querySelectorAll('tr'));
  
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const pageNumbers = Array.from(document.querySelectorAll('.page-number'));
  
    let currentPage = 1;
    const rowsPerPage = 5; // عدد الصفوف لكل صفحة
  
    // === دالة لعرض الصفحة المطلوبة ===
    function showPage(page) {
      const startIdx = (page - 1) * rowsPerPage;
      const endIdx = startIdx + rowsPerPage;
  
      // أولاً، إخفاء جميع الصفوف
      rows.forEach((row, idx) => {
        row.style.display = 'none';
      });
  
      // عرض الصفوف من startIdx إلى endIdx - 1
      rows.slice(startIdx, endIdx).forEach((row) => {
        row.style.display = '';
      });
  
      // تحديث أزرار Pagination
      pageNumbers.forEach((btn) => {
        btn.classList.toggle('active', Number(btn.dataset.page) === page);
      });
  
      prevPageBtn.disabled = page === 1;
      nextPageBtn.disabled = page === pageNumbers.length;
  
      currentPage = page;
  
      // تحديث نص معلومات السجلات (مثال توضيحي)
      const totalRows = rows.length;
      const firstRec = startIdx + 1;
      const lastRec = Math.min(endIdx, totalRows);
      const recordsInfo = document.querySelector('.records-info');
      recordsInfo.textContent = `عرض ${firstRec}-${lastRec} من ${totalRows} تذكرة`;
    }
  
    // عند التحميل، عرض الصفحة الأولى
    showPage(1);
  
    // الاستماع لأزرار أرقام الصفحات
    pageNumbers.forEach((btn) => {
      btn.addEventListener('click', () => {
        const page = Number(btn.dataset.page);
        if (page !== currentPage) {
          showPage(page);
        }
      });
    });
  
    // أزرار السابق والتالي
    prevPageBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        showPage(currentPage - 1);
      }
    });
    nextPageBtn.addEventListener('click', () => {
      if (currentPage < pageNumbers.length) {
        showPage(currentPage + 1);
      }
    });
  
    // === دالة البحث الحي ===
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim().toLowerCase();
  
      // إذا كان مربع البحث فارغ، نعيد عرض الصفحة الحالية
      if (query === '') {
        showPage(1);
        return;
      }
  
      // تصفية الصفوف المحتوية على نص البحث في أي خلية (tr)
      rows.forEach((row) => {
        const cellsText = Array.from(row.querySelectorAll('td'))
          .map((td) => td.textContent.trim().toLowerCase())
          .join(' ');
        if (cellsText.includes(query)) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
  
      // تعطيل أزرار التنقل لأن البحث يعرض النتائج دفعة واحدة
      prevPageBtn.disabled = true;
      nextPageBtn.disabled = true;
      pageNumbers.forEach((btn) => (btn.disabled = true));
  
      // تحديث نص معلومات السجلات وفق عدد النتائج
      const visibleRows = rows.filter((row) => row.style.display === '');
      const recordsInfo = document.querySelector('.records-info');
      recordsInfo.textContent = `عرض ${visibleRows.length} من ${rows.length} تذكرة`;
    });
      document.querySelector('.view-icon')
    .addEventListener('click', () => {
      // هنا الطريق للصفحة الثانية:
      window.location.href = 'ticket-details.html';
    });
  });