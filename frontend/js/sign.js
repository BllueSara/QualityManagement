document.addEventListener('DOMContentLoaded', loadDelegations);

const apiBase = window.location.origin + '/api/approvals/proxy';  // ✔ استخدم endpoint الصحيح
const token   = localStorage.getItem('token');

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

    const { status, data } = await res.json();  // ✔ بيانات تأتي باسم data

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
          <button class="sign-btn" data-id="${d.id}">توقيع</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.sign-btn').forEach(btn => {
      btn.addEventListener('click', () => signDelegation(btn.dataset.id));
    });

  } catch (err) {
    console.error(err);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="3" style="text-align:center; color:red;">حدث خطأ أثناء جلب البيانات</td>`;
    tbody.appendChild(tr);
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
