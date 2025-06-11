const apiBase = 'http://localhost:3006/api';
const token = localStorage.getItem('token');

async function fetchJSON(url, opts = {}) {
  opts.headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!token) return alert("لا يوجد توكن. الرجاء تسجيل الدخول.");

  try {
    const res = await fetchJSON(`${apiBase}/approvals/assigned-to-me`);
    renderApprovals(res.data);
  } catch (err) {
    console.error("خطأ في جلب الاعتمادات:", err);
    alert("حدث خطأ أثناء تحميل البيانات");
  }

  setupSignatureModal();
});

function renderApprovals(items) {
  const tbody = document.getElementById("approvalsBody");
  tbody.innerHTML = "";

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
        <button class="btn-sign"><i class="fas fa-user-check"></i> توقيع</button>
        <button class="btn-delegate"><i class="fas fa-user-friends"></i> توقيع بالنيابة</button>
        <button class="btn-qr"><i class="fas fa-qrcode"></i> QR Code</button>
        <button class="btn-reject"><i class="fas fa-times"></i> رفض</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  initActions();
}

function statusLabel(status) {
  switch (status) {
    case 'approved': return '✅ معتمد';
    case 'rejected': return '❌ مرفوض';
    default: return '🕓 قيد الانتظار';
  }
}

// ------------------------------
// الأحداث الأساسية
// ------------------------------

function initActions() {
  document.querySelectorAll('.btn-sign').forEach(btn => {
    btn.addEventListener('click', e => {
      const tr = e.target.closest('tr');
      const contentId = tr.dataset.id;
      openSignatureModal(contentId);
    });
  });

  document.querySelectorAll('.btn-reject').forEach(btn => {
    btn.addEventListener('click', () => alert('فتح نافذة الرفض هنا'));
  });

  document.querySelectorAll('.btn-delegate').forEach(btn => {
    btn.addEventListener('click', () => alert('فتح نافذة التوقيع بالنيابة'));
  });

  document.querySelectorAll('.btn-qr').forEach(btn => {
    btn.addEventListener('click', () => alert('فتح QR Code'));
  });
}

// ------------------------------
// التوقيع
// ------------------------------

let selectedContentId = null;

function openSignatureModal(contentId) {
  selectedContentId = contentId;
  document.getElementById('signatureModal').style.display = 'flex';
 
  clearCanvas();
}

function closeSignatureModal() {
  document.getElementById('signatureModal').style.display = 'none';
  clearCanvas();
}

function clearCanvas() {
  const canvas = document.getElementById('signatureCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function setupSignatureModal() {
  const canvas = document.getElementById('signatureCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let drawing = false;

  function resizeCanvas() {
    const wrapper = canvas.parentElement;
    const rect = wrapper.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
  }

  // إعادة تحجيم عند الفتح
  resizeCanvas();
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

  document.getElementById('btnClear').addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

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

  document.querySelector('#signatureModal .modal-close').addEventListener('click', closeSignatureModal);
}

