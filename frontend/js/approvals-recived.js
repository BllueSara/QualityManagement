const apiBase = 'http://localhost:3006/api';
const token = localStorage.getItem('token');
let permissionsKeys = [];
let selectedContentId = null;
let canvas, ctx;

// جلب صلاحيات المستخدم
async function fetchPermissions() {
  if (!token) return;
  const payload = JSON.parse(atob(token.split('.')[1] || '{}'));
  const userId = payload.id;
  const role = payload.role;

  if (role === 'admin') {
    permissionsKeys = ['*'];
    return;
  }

  try {
    const res = await fetch(`${apiBase}/users/${userId}/permissions`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return;
    const { data: perms } = await res.json();
    permissionsKeys = perms.map(p => typeof p === 'string' ? p : (p.permission || p.permission_key));
  } catch (e) {
    console.error('Failed to fetch permissions', e);
  }
}

async function fetchJSON(url, opts = {}) {
  opts.headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', async () => {
  if (!token) return alert("غير مصرح: الرجاء تسجيل الدخول.");

  await fetchPermissions();

  try {
    const { data: items } = await fetchJSON(`${apiBase}/approvals/assigned-to-me`);
    allItems = items; // 🔄 حفظ كل العناصر
    await setupFilters(allItems); // ✅ تجهيز الفلاتر قبل العرض
    renderApprovals(allItems); // عرض بناءً على كل البيانات
  } catch (err) {
    console.error("خطأ في جلب الاعتمادات:", err);
    alert("حدث خطأ أثناء تحميل البيانات");
  }

  setupSignatureModal();
  setupCloseButtons();

  const btnSendReason = document.getElementById('btnSendReason');
  if (btnSendReason) {
    btnSendReason.addEventListener('click', async () => {
      const reason = document.getElementById('rejectReason').value.trim();
      if (!reason) return alert('⚠️ يرجى كتابة سبب الرفض');

      try {
        await fetchJSON(`${apiBase}/approvals/${selectedContentId}/approve`, {
          method: 'POST',
          body: JSON.stringify({
            approved: false,
            signature: null,
            notes: reason
          })
        });

        alert('❌ تم رفض الاعتماد');
        closeModal('rejectModal');

        updateApprovalStatusInUI(selectedContentId, 'rejected');
      } catch (err) {
        console.error('فشل إرسال الرفض:', err);
        alert('❌ حدث خطأ أثناء إرسال سبب الرفض');
      }
    });
  }
});



async function setupFilters(items) {
  const deptSet = new Set(items.map(i => i.department_name).filter(Boolean));
  const deptFilter = document.getElementById('deptFilter');
  deptSet.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    deptFilter.appendChild(opt);
  });

  ['all', 'pending', 'rejected', 'approved'].forEach(status => {
    // الافتراضي معد مسبقاً في HTML
  });

  deptFilter.addEventListener('change', applyFilters);
  document.getElementById('statusFilter').addEventListener('change', applyFilters);
  document.getElementById('searchInput').addEventListener('input', applyFilters);

}

let allItems = [];

function applyFilters() {
  const dept = document.getElementById('deptFilter').value;
  const status = document.getElementById('statusFilter').value;
  const searchText = document.getElementById('searchInput').value.trim().toLowerCase();

  const filtered = allItems.filter(i => {
    const matchesDept = dept === 'all' || i.department_name === dept;
    const matchesStatus = status === 'all' || i.approval_status === status;
    const matchesSearch = i.title.toLowerCase().includes(searchText);
    return matchesDept && matchesStatus && matchesSearch;
  });

  renderApprovals(filtered);
}


// فتح مودال عام
function openModal(modalId) {
  document.getElementById(modalId).style.display = 'flex';
}

// إغلاق مودال عام
function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}

// ربط أزرار الإغلاق بالمودالات
function setupCloseButtons() {
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', e => {
      const modalId = btn.dataset.modal || btn.closest('.modal-overlay').id;
      closeModal(modalId);
    });
  });
}

// عرض الاعتمادات
function renderApprovals(items) {
  const tbody = document.getElementById("approvalsBody");
  tbody.innerHTML = "";

  const canSign = permissionsKeys.includes('*') || permissionsKeys.includes('sign');
  const canDelegate = permissionsKeys.includes('*') || permissionsKeys.includes('sign_on_behalf');

  // ترتيب: pending → rejected → approved
  items.sort((a, b) => {
    const order = { pending: 0, rejected: 1, approved: 2 };
    return order[a.approval_status] - order[b.approval_status];
  });

  items.forEach(item => {
    const tr = document.createElement("tr");
    tr.dataset.id = item.id;
    tr.dataset.status = item.approval_status;
    tr.dataset.dept = item.department_name;

    let actionsHTML = '';
    if (item.approval_status === 'pending') {
      if (canSign) actionsHTML += `<button class="btn-sign"><i class="fas fa-user-check"></i> توقيع</button>`;
      if (canDelegate) actionsHTML += `<button class="btn-delegate"><i class="fas fa-user-friends"></i> توقيع بالنيابة</button>`;
      actionsHTML += `<button class="btn-qr"><i class="fas fa-qrcode"></i> اعتماد إلكتروني</button>`;

      actionsHTML += `<button class="btn-reject"><i class="fas fa-times"></i> رفض</button>`;
    }

    tr.innerHTML = `
      <td>${item.title}</td>
      <td>${item.department_name || '-'}</td>
      <td class="col-response">${statusLabel(item.approval_status)}</td>
      <td class="col-actions">${actionsHTML}</td>
    `;
    tbody.appendChild(tr);
  });

  initActions();
}

function updateApprovalStatusInUI(id, newStatus) {
  const item = allItems.find(i => i.id == id);
  if (!item) return;
  item.approval_status = newStatus;

  // إعادة تصفية العناصر حسب الفلاتر الحالية وإعادة العرض والفرز
  applyFilters();
}




// تصنيف الحالة
function statusLabel(status) {
  switch (status) {
    case 'approved': return ' معتمد';
    case 'rejected': return ' مرفوض';
    default:         return ' قيد الانتظار';
  }
}

// ربط الأزرار بالمودالات
function initActions() {
  document.querySelectorAll('.btn-sign').forEach(btn => {
    btn.addEventListener('click', e => {
      const id = e.target.closest('tr').dataset.id;
      openSignatureModal(id);
    });
  });

  document.querySelectorAll('.btn-delegate').forEach(btn => {
    btn.addEventListener('click', (e) => {
      selectedContentId = e.target.closest('tr').dataset.id;
      openModal('delegateModal');
      loadDepartments();
    });
  });
  

document.querySelectorAll('.btn-qr').forEach(btn => {
  btn.addEventListener('click', e => {
    selectedContentId = e.target.closest('tr').dataset.id;
    openModal('qrModal');
  });
});


document.querySelectorAll('.btn-reject').forEach(btn => {
  btn.addEventListener('click', e => {
    selectedContentId = e.target.closest('tr').dataset.id;
    openModal('rejectModal');
  });
});

}




document.getElementById('btnElectronicApprove')?.addEventListener('click', async () => {
  if (!selectedContentId) return alert('⚠️ لا يوجد عنصر محدد لاعتماده.');

  try {
    await fetchJSON(`${apiBase}/approvals/${selectedContentId}/approve`, {
      method: 'POST',
      body: JSON.stringify({
        approved: true,
        signature: null,
        electronic_signature: true,
        notes: ''
      })
    });
    alert('✅ تم الاعتماد الإلكتروني بنجاح');
    closeModal('qrModal');

    // ✅ تحديث واجهة المستخدم بدلاً من إعادة تحميل
    updateApprovalStatusInUI(selectedContentId, 'approved');
    disableActionsFor(selectedContentId);
  } catch (err) {
    console.error('فشل الاعتماد الإلكتروني:', err);
    alert('حدث خطأ أثناء الاعتماد الإلكتروني');
  }
});


// =====================
// التوقيع
// =====================
function openSignatureModal(contentId) {
  selectedContentId = contentId;
  const modal = document.getElementById('signatureModal');
  modal.style.display = 'flex';

  setTimeout(() => {
    resizeCanvas();
    clearCanvas();
  }, 50);
}

function closeSignatureModal() {
  document.getElementById('signatureModal').style.display = 'none';
  clearCanvas();
}

function clearCanvas() {
  if (ctx && canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function resizeCanvas() {
  const wrapper = canvas.parentElement;
  const rect = wrapper.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;

  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#000';
}

function setupSignatureModal() {
  canvas = document.getElementById('signatureCanvas');
  if (!canvas) return;

  ctx = canvas.getContext('2d');
  let drawing = false;

  window.addEventListener('resize', resizeCanvas);

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  // Mouse events
  canvas.addEventListener('mousedown', e => {
    drawing = true;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  });

  canvas.addEventListener('mousemove', e => {
    if (!drawing) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  });

  canvas.addEventListener('mouseup', () => drawing = false);
  canvas.addEventListener('mouseleave', () => drawing = false);

  // Touch events
  canvas.addEventListener('touchstart', e => {
    drawing = true;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  });

  canvas.addEventListener('touchmove', e => {
    if (!drawing) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  });

  canvas.addEventListener('touchend', () => drawing = false);

  // مسح التوقيع
  document.getElementById('btnClear').addEventListener('click', () => {
    clearCanvas();
  });

  // تأكيد التوقيع
  document.getElementById('btnConfirmSignature').addEventListener('click', async () => {
    const base64Signature = canvas.toDataURL('image/png');
    try {
      await fetchJSON(`${apiBase}/approvals/${selectedContentId}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          approved: true,
          signature: base64Signature,
          notes: ''
        })
      });
      alert('✅ تم إرسال التوقيع');
      closeSignatureModal();
      updateApprovalStatusInUI(selectedContentId, 'approved');
      disableActionsFor(selectedContentId); // ✅ إضافة هنا
    } catch (err) {
      console.error('فشل الإرسال:', err);
      alert('خطأ أثناء إرسال التوقيع');
    }
  });
  
  
}

// فتح مودال التوقيع بالنيابة وتحميل الأقسام


// تحميل الأقسام
async function loadDepartments() {
  console.log("🔄 تحميل الأقسام...");
  const deptSelect = document.getElementById('delegateDept');
  if (!deptSelect) return console.warn('❌ لم يتم العثور على select#delegateDept');

  try {
    const res = await fetch(`${apiBase}/departments`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const { data: departments } = await res.json();
    console.log("✅ الأقسام:", departments);

    deptSelect.innerHTML = `<option value="" disabled selected>اختر القسم</option>`;
    departments.forEach(dept => {
      const opt = document.createElement('option');
      opt.value = dept.id;
      opt.textContent = dept.name;
      deptSelect.appendChild(opt);
    });

  } catch (err) {
    console.error('❌ فشل تحميل الأقسام:', err);
  }
}


// تحميل المستخدمين عند اختيار قسم
document.getElementById('delegateDept').addEventListener('change', async (e) => {
  const deptId = e.target.value;
  console.log("🔄 تحميل المستخدمين للقسم:", deptId);
  try {
    const res = await fetch(`${apiBase}/users?departmentId=${deptId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const json = await res.json();
    console.log("✅ المستخدمين المستلمين:", json);

    const users = json.data || [];
    const userSelect = document.getElementById('delegateUser');
    userSelect.innerHTML = `<option value="" disabled selected>اختر المستخدم</option>`;

    users.forEach(user => {
      const opt = document.createElement('option');
      opt.value = user.id;
      opt.textContent = user.name;
      userSelect.appendChild(opt);
    });

  } catch (err) {
    console.error('❌ فشل تحميل المستخدمين:', err);
  }
});

// تأكيد التوقيع بالنيابة
document.getElementById('btnDelegateConfirm').addEventListener('click', async () => {
  const userId = document.getElementById('delegateUser').value;
  const notes = document.getElementById('delegateNotes').value;

  if (!userId) return alert('⚠️ يرجى اختيار المستخدم.');

  try {
    await fetchJSON(`${apiBase}/approvals/${selectedContentId}/delegate`, {
      method: 'POST',
      body: JSON.stringify({
        delegateTo: userId,
        notes
      })
    });
    alert('✅ تم تفويض المستخدم بنجاح');
    closeModal('delegateModal');
    disableActionsFor(selectedContentId); // ✅ إضافة هنا
  } catch (err) {
    console.error('❌ خطأ أثناء التفويض بالنيابة:', err);
    alert('❌ حدث خطأ أثناء إرسال التفويض');
  }
});



function disableActionsFor(contentId) {
  const row = document.querySelector(`tr[data-id="${contentId}"]`);
  if (!row) return;
  const actionsCell = row.querySelector('.col-actions');
  if (actionsCell) actionsCell.innerHTML = ''; // إخفاء جميع الأزرار
}
