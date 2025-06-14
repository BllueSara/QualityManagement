document.addEventListener('DOMContentLoaded', loadDelegations);

const apiBase = window.location.origin + '/api/approvals/proxy';  // ✔ استخدم endpoint الصحيح
const token = localStorage.getItem('token');

let selectedContentId = null;

async function loadDelegations() {
  const tbody = document.querySelector('.proxy-table tbody');
  tbody.innerHTML = '';

  try {
    const res = await fetch(apiBase, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const { status, data } = await res.json();
    if (status !== 'success') throw new Error('Server error');

    if (data.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="3" style="text-align:center; padding:20px;">لا توجد مستندات للتوقيع بالنيابة</td>`;
      tbody.appendChild(tr);
      return;
    }

    data.forEach(d => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="col-file">${escapeHtml(d.title)}</td>
        <td class="col-signer">${escapeHtml(d.delegated_by_name)}</td>
        <td class="col-action">
          <button class="btn-accept" data-id="${d.id}">قبول</button>
          <button class="btn-reject" data-id="${d.id}">رفض</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    document.querySelectorAll('.btn-accept').forEach(btn => {
      btn.addEventListener('click', () => {
        const contentId = btn.dataset.id;
        showPopup(async () => {
          try {
            const res = await fetch(`${window.location.origin}/api/approvals/${contentId}/approve`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                approved: true,
                electronic_signature: true,
                notes: '',
                // on_behalf_of   // حسب حاجتك لو تفويض بالنيابة
              })
            });
        
            const json = await res.json();
            if (json.status === 'success') {
              alert('✅ تم قبول التفويض وسيتم تحويلك إلى الاعتمادات المستلمة');
              window.location.href = `/frontend/html/approvals-recived.html?id=${contentId}`;
            } else {
              throw new Error(json.message);
            }
          } catch (err) {
            console.error('فشل قبول التفويض:', err);
            alert('❌ حدث خطأ أثناء قبول التفويض');
          }
        });
        
      });
      
    });

    document.querySelectorAll('.btn-reject').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedContentId = btn.dataset.id;
        document.getElementById('rejectModal').style.display = 'flex';
        document.getElementById('rejectReason').value = '';
      });
    });

  } catch (err) {
    console.error(err);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="3" style="text-align:center; color:red;">حدث خطأ أثناء جلب البيانات</td>`;
    tbody.appendChild(tr);
  }
}


function closeRejectModal() {
  document.getElementById('rejectModal').style.display = 'none';
}

async function submitReject() {
  const reason = document.getElementById('rejectReason').value.trim();
  if (!reason) return alert('⚠️ يرجى كتابة سبب الرفض');

  try {
    const res = await fetch(`${window.location.origin}/api/approvals/${selectedContentId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        approved: false,
        signature: null,
        electronic_signature: false,
        notes: reason
      })
    });

    const json = await res.json();
    if (json.status === 'success') {
      alert('❌ تم رفض المستند');
      closeRejectModal();
      loadDelegations();
    } else {
      throw new Error(json.message);
    }
  } catch (err) {
    console.error(err);
    alert('حدث خطأ أثناء الرفض');
  }
}


async function signDelegation(contentId) {
  if (!confirm('هل تريد توقيع هذا المستند بالنيابة؟')) return;

  try {
    const res = await fetch(`${window.location.origin}/api/approvals/${contentId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        approved: true,
        electronic_signature: true,
        notes: '',
      })
    });

    const result = await res.json();
    if (result.status === 'success') {
      alert('تم التوقيع بنجاح');
      loadDelegations();
    } else {
      throw new Error(result.message);
    }
  } catch (err) {
    console.error(err);
    alert('فشل في التوقيع، حاول مرة أخرى');
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


function showPopup(onConfirm) {
  const overlay = document.getElementById('popupOverlay');
  overlay.style.display = 'flex';

  document.getElementById('popupConfirm').onclick = () => {
    overlay.style.display = 'none';
    onConfirm();
  };

  document.getElementById('popupCancel').onclick = () => {
    overlay.style.display = 'none';
  };
}
