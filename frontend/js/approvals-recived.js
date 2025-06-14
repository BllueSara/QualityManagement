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
document.addEventListener("DOMContentLoaded", async () => {
  if (!token) return alert("غير مصرح: الرجاء تسجيل الدخول.");

  await fetchPermissions();

  try {
    const { data: items } = await fetchJSON(`${apiBase}/approvals/assigned-to-me`);
    renderApprovals(items);
  } catch (err) {
    console.error("خطأ في جلب الاعتمادات:", err);
    alert("حدث خطأ أثناء تحميل البيانات");
  }

  setupSignatureModal();
  setupCloseButtons(); // زر الإغلاق العام لكل مودال
});

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

  items.forEach(item => {
    const tr = document.createElement("tr");
    tr.dataset.id = item.id;
    tr.dataset.status = item.approval_status;
    tr.dataset.dept = item.department_name;

    tr.innerHTML = `
      <td>${item.title}</td>
      <td>${item.department_name || '-'}</td>
      <td class="col-response">${statusLabel(item.approval_status)}</td>
      <td class="col-actions">
        ${canSign     ? `<button class="btn-sign"><i class="fas fa-user-check"></i> توقيع</button>` : ''}
        ${canDelegate ? `<button class="btn-delegate"><i class="fas fa-user-friends"></i> توقيع بالنيابة</button>` : ''}
        <button class="btn-qr"><i class="fas fa-qrcode"></i> QR Code</button>
        <button class="btn-reject"><i class="fas fa-times"></i> رفض</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  initActions();
}

// تصنيف الحالة
function statusLabel(status) {
  switch (status) {
    case 'approved': return '✅ معتمد';
    case 'rejected': return '❌ مرفوض';
    default:         return '🕓 قيد الانتظار';
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
    btn.addEventListener('click', () => openModal('delegateModal'));
  });

document.querySelectorAll('.btn-qr').forEach(btn => {
  btn.addEventListener('click', e => {
    selectedContentId = e.target.closest('tr').dataset.id;
    openModal('qrModal');
  });
});


  document.querySelectorAll('.btn-reject').forEach(btn => {
    btn.addEventListener('click', () => openModal('rejectModal'));
  });
}
document.getElementById('btnElectronicApprove')?.addEventListener('click', async () => {
  if (!selectedContentId) return alert('⚠️ لا يوجد عنصر محدد لاعتماده.');

  try {
    await fetchJSON(`${apiBase}/approvals/${selectedContentId}/approve`, {
      method: 'POST',
      body: JSON.stringify({
        approved: true,
        signature: null, // لأنه اعتماد إلكتروني بدون توقيع
            electronic_signature: true,  // ← هذا الإضافة المهمة

        notes: ''
      })
    });
    alert('✅ تم الاعتماد الإلكتروني بنجاح');
    closeModal('qrModal');
    location.reload();
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
      location.reload();
    } catch (err) {
      console.error('فشل الإرسال:', err);
      alert('خطأ أثناء إرسال التوقيع');
    }
  });
}
