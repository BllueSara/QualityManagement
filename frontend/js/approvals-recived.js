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
  const ctx = canvas.getContext('2d');
  let drawing = false;

  // ضبط أبعاد الكانفاس حسب الدقة
  function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    if (ctx.resetTransform) ctx.resetTransform();
    else ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(devicePixelRatio, devicePixelRatio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  }

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  function getPos(e) {
    const r = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
    return { x, y };
  }

  canvas.addEventListener("mousedown", e => {
    drawing = true;
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  });
  canvas.addEventListener("mousemove", e => {
    if (!drawing) return;
    const p = getPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  });
  canvas.addEventListener("mouseup", () => drawing = false);
  canvas.addEventListener("mouseleave", () => drawing = false);
  canvas.addEventListener("touchstart", e => {
    drawing = true;
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  });
  canvas.addEventListener("touchmove", e => {
    if (!drawing) return;
    const p = getPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  });
  canvas.addEventListener("touchend", () => drawing = false);

  document.getElementById('clearSignature').addEventListener('click', clearCanvas);

  document.getElementById('submitSignature').addEventListener('click', async () => {
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

      alert('✅ تم إرسال التوقيع بنجاح');
      closeSignatureModal();
      location.reload();
    } catch (err) {
      console.error('فشل التوقيع:', err);
      alert('حدث خطأ أثناء إرسال التوقيع');
    }
  });

  document.querySelector('.modal-close').addEventListener('click', closeSignatureModal);
}
