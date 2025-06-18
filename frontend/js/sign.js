document.addEventListener('DOMContentLoaded', loadDelegations);

const apiBaseDept = 'http://localhost:3006/api/approvals/proxy';
const apiBaseComm = 'http://localhost:3006/api/committee-approvals/proxy';
const token = localStorage.getItem('token');

let selectedContentId = null;
let selectedContentType = null;

async function loadDelegations() {
  const tbody = document.querySelector('.proxy-table tbody');
  tbody.innerHTML = '';

  try {
    const [deptRes, commRes] = await Promise.all([
      fetch(apiBaseDept, { headers: authHeaders() }),
      fetch(apiBaseComm, { headers: authHeaders() })
    ]);
    const deptJson = await deptRes.json();
    const commJson = await commRes.json();

    if (deptJson.status !== 'success' || commJson.status !== 'success') {
      throw new Error(getTranslation('error-loading'));
    }

    const deptData = deptJson.data.map(d => ({ ...d, type: 'dept' }));
    const commData = commJson.data.map(d => ({ ...d, type: 'committee' }));
    const allData = [...deptData, ...commData];

    if (allData.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:20px;">${getTranslation('no-documents')}</td></tr>`;
      return;
    }

    allData.forEach(d => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(d.title)}</td>
        <td class="col-signer">
          ${escapeHtml(d.delegated_by_name || d.delegated_by || '—')}
        </td>
        <td class="col-action">
          <button class="btn-accept" data-id="${d.id}" data-type="${d.type}">${getTranslation('accept')}</button>
          <button class="btn-reject" data-id="${d.id}" data-type="${d.type}">${getTranslation('reject')}</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // زر القبول
    document.querySelectorAll('.btn-accept').forEach(btn => {
      btn.addEventListener('click', () => {
        const contentId = btn.dataset.id;
        const type = btn.dataset.type;
        const page = type === 'dept'
          ? 'approvals-recived.html'
          : 'committee-approvals-recived.html';

        showPopup(getTranslation('accept-message'), () => {
          window.location.href = `/frontend/html/${page}?id=${contentId}`;
        });
      });
    });

    // زر الرفض
    document.querySelectorAll('.btn-reject').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedContentId = btn.dataset.id;
        selectedContentType = btn.dataset.type;

        showPopup(
          getTranslation('reject-message'),
          submitReject,
          true
        );
      });
    });

  } catch (err) {
    console.error(err);
    alert(getTranslation('error-loading'));
  }
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

function closeRejectModal() {
  const overlay = document.getElementById('popupOverlay');
  if (overlay) overlay.style.display = 'none';
}

async function submitReject() {
  const reason = document.getElementById('rejectReason').value.trim();
  if (!reason) return alert(getTranslation('reason-required'));

  const endpointRoot = (selectedContentType === 'dept')
    ? 'approvals'
    : 'committee-approvals';

  try {
    const res = await fetch(`http://localhost:3006/api/${endpointRoot}/${selectedContentId}/approve`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        approved: false,
        signature: null,
        electronic_signature: false,
        notes: reason
      })
    });
    const json = await res.json();
    if (json.status === 'success') {
      alert(getTranslation('reject-success'));
      loadDelegations();
    } else {
      throw new Error(json.message);
    }
  } catch (err) {
    console.error(err);
    alert(getTranslation('error-rejecting'));
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showPopup(message, onConfirm, showReason = false) {
  const overlay = document.getElementById('popupOverlay');
  const msgEl = document.getElementById('popupMessage');
  const reasonEl = document.getElementById('rejectReason');
  const btnConfirm = document.getElementById('popupConfirm');
  const btnCancel = document.getElementById('popupCancel');

  msgEl.textContent = message;
  reasonEl.style.display = showReason ? 'block' : 'none';

  btnConfirm.replaceWith(btnConfirm.cloneNode(true));
  btnCancel.replaceWith(btnCancel.cloneNode(true));

  document.getElementById('popupConfirm').addEventListener('click', () => {
    overlay.style.display = 'none';
    onConfirm();
  });
  document.getElementById('popupCancel').addEventListener('click', () => {
    overlay.style.display = 'none';
  });

  overlay.style.display = 'flex';
}

function setupSignatureCanvas() {
  canvas = document.getElementById('signatureCanvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');

  document.getElementById('btnClear').addEventListener('click', () => {
    clearCanvas();
  });

  document.getElementById('btnConfirm').addEventListener('click', async () => {
    try {
      const signatureDataUrl = canvas.toDataURL('image/png');
      // ... existing code ...
    } catch (err) {
      // console.error(err);
      alert('خطأ أثناء إرسال التوقيع.');
    }
  });
}

async function fetchContentAndApprovals(contentId) {
  try {
    // ... existing code ...
  } catch (err) {
    // console.error(err);
    alert('خطأ في جلب بيانات المحتوى والاعتمادات.');
  }
}

async function sendApproval(contentId, approvalData) {
  try {
    // ... existing code ...
  } catch (err) {
    // console.error(err);
    alert('خطأ أثناء إرسال الاعتماد.');
  }
}

