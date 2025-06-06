// approvals.js

document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("searchInput");
    const filterStatus = document.getElementById("filterStatus");
    const filterDept = document.getElementById("filterDept");
    const btnFilter = document.getElementById("btnFilter");
    const approvalsBody = document.getElementById("approvalsBody");
    const rows = Array.from(approvalsBody.querySelectorAll("tr"));
  
    const totalRequestsSpan = document.getElementById("totalRequests");
    const startRecordSpan = document.getElementById("startRecord");
    const endRecordSpan = document.getElementById("endRecord");
    const totalCountSpan = document.getElementById("totalCount");
  
    const prevPageBtn = document.getElementById("prevPage");
    const nextPageBtn = document.getElementById("nextPage");
    const pageNumbers = Array.from(document.querySelectorAll(".page-number"));
  
    let currentPage = 1;
    const rowsPerPage = 5;
  
    // تحديث العدّ الإجمالي
    function updateTotalCount(count) {
      totalRequestsSpan.textContent = count;
      totalCountSpan.textContent = count;
    }
  
    // تحديث نص معلومات السجلات
    function updateRecordInfo(start, end, total) {
      startRecordSpan.textContent = start;
      endRecordSpan.textContent = end;
      totalCountSpan.textContent = total;
    }
  
    // دالة لترشيح الصفوف (حسب البحث والحالة والقسم)
    function applyFilters() {
      const searchQuery = searchInput.value.trim().toLowerCase();
      const selectedStatus = filterStatus.value; // "all", "pending", "approved", "rejected"
      const selectedDept = filterDept.value; // "all", "hr", "finance", "services", "training"
  
      // أولاً، إخفاء جميع الصفوف
      rows.forEach((row) => {
        row.style.display = "none";
      });
  
      // ثم إظهار الصفوف التي تطابق الشروط
      const filteredRows = rows.filter((row) => {
        // الحالة
        const rowStatus = row.getAttribute("data-status"); // قيمة مثل "pending"
        // القسم
        const rowDept = row.getAttribute("data-dept"); // قيمة مثل "hr"
        // البحث: نبحث في اسم الملف، القسم، الملاحظات
        const fileName = row.querySelector(".col-file").textContent.trim().toLowerCase();
        const deptName = row.querySelector(".col-dept").textContent.trim().toLowerCase();
        const notes = row.querySelector(".col-notes").textContent.trim().toLowerCase();
  
        const matchesSearch =
          fileName.includes(searchQuery) ||
          deptName.includes(searchQuery) ||
          notes.includes(searchQuery);
  
        const matchesStatus = selectedStatus === "all" || rowStatus === selectedStatus;
        const matchesDept = selectedDept === "all" || rowDept === selectedDept;
  
        return matchesSearch && matchesStatus && matchesDept;
      });
  
      // عرض النتائج المصفّى
      filteredRows.forEach((row) => {
        row.style.display = "";
      });
  
      // تحديث العدد الإجمالي للصفوف المرئية
      updateTotalCount(filteredRows.length);
  
      // تعطيل Pagination أثناء التصفية (عرض جميع النتائج دفعة واحدة)
      prevPageBtn.disabled = true;
      nextPageBtn.disabled = true;
      pageNumbers.forEach((btn) => (btn.disabled = true));
  
      // تحديث نص معلومات السجلات
      updateRecordInfo(1, filteredRows.length, filteredRows.length);
    }
  
    // دالة لعرض صفحة معيّنة (لـ Pagination)
    function showPage(page) {
      const startIdx = (page - 1) * rowsPerPage;
      const endIdx = startIdx + rowsPerPage;
  
      // إخفاء جميع الصفوف أولاً
      rows.forEach((row) => (row.style.display = "none"));
  
      // إظهار الصفوف من startIdx إلى endIdx-1
      rows.slice(startIdx, endIdx).forEach((row) => {
        row.style.display = "";
      });
  
      // تحديث أزرار الصفحة
      pageNumbers.forEach((btn) => {
        btn.classList.toggle("active", Number(btn.dataset.page) === page);
        btn.disabled = false;
      });
  
      prevPageBtn.disabled = page === 1;
      nextPageBtn.disabled = page === pageNumbers.length;
  
      currentPage = page;
  
      // تحديث نص معلومات السجلات
      const total = rows.length;
      const firstRec = startIdx + 1;
      const lastRec = Math.min(endIdx, total);
      updateRecordInfo(firstRec, lastRec, total);
      updateTotalCount(total);
    }
  
    // عند التحميل، عرض الصفحة الأولى
    showPage(1);
  
    // الاستماع لأزرار أرقام الصفحات
    pageNumbers.forEach((btn) => {
      btn.addEventListener("click", () => {
        const page = Number(btn.dataset.page);
        if (page !== currentPage) {
          showPage(page);
        }
      });
    });
  
    // أزرار السابق والتالي
    prevPageBtn.addEventListener("click", () => {
      if (currentPage > 1) {
        showPage(currentPage - 1);
      }
    });
    nextPageBtn.addEventListener("click", () => {
      if (currentPage < pageNumbers.length) {
        showPage(currentPage + 1);
      }
    });
  
    // الاستماع لزر تصفية النتائج
    btnFilter.addEventListener("click", () => {
      applyFilters();
    });
  
    // البحث الحيّ: إذا حُذِف النص في الصندوق، نعود لعرض الصفحة الأولى
    searchInput.addEventListener("input", () => {
      const query = searchInput.value.trim();
      if (query === "") {
        // إذا الصندوق فارغ، نعيد تفعيل الـ Pagination
        pageNumbers.forEach((btn) => (btn.disabled = false));
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === pageNumbers.length;
        showPage(1);
      }
    });
  });