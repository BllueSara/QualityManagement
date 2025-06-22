// home.js
const apiBase = 'http://localhost:3006/api';
// في أعلى home.js
document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  if (!token) return;

  const payload = JSON.parse(atob(token.split('.')[1] || '{}'));
  const userId  = payload.id;
  const role    = payload.role;
  const isAdmin = role === 'admin';

  // 1) جلب الصلاحيات
  let permissionsKeys = [];
  if (isAdmin) {
    permissionsKeys = ['*'];
  } else {
    try {
      const res = await fetch(`${apiBase}/users/${userId}/permissions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const body = await res.json();
      if (res.ok && Array.isArray(body.data)) {
        permissionsKeys = body.data.map(p =>
          typeof p === 'string' ? p : (p.permission || p.permission_key)
        );
      }
    } catch (err) {
      // console.error('Failed to fetch permissions:', err);
    }
  }

  // 2) إظهار أو إخفاء حسب الصلاحيات
// 1) عناصر الـ nav menu تخضع للصلاحيات التقليدية
document.querySelectorAll('nav [data-permission], nav [data-role]').forEach(el => {
  const permReq = el.dataset.permission;
  const roleReq = el.dataset.role;
  const hasPerm = permReq && (permissionsKeys.includes('*') || permissionsKeys.includes(permReq));
  const hasRole = roleReq === 'admin' && isAdmin;
  el.style.display = (hasPerm || hasRole) ? '' : 'none';
});

const toggleable = ['tickets','departments','approvals','committees'];

document.querySelectorAll('.cards-grid .card').forEach(card => {
  const titleEl = card.querySelector('[data-translate]');
  const key     = titleEl ? titleEl.dataset.translate : null;

  if (key && toggleable.includes(key)) {
    // تعطيل البطاقة لو عنده disable_<key>
    card.style.display = permissionsKeys.includes(`disable_${key}`) ? 'none' : '';
    return;
  }

  // البطاقات الأخرى: منطق view_* أو admin
  const permReq = card.dataset.permission;
  const roleReq = card.dataset.role;
  const hasPerm = permReq && (
    permissionsKeys.includes('*') ||
    permissionsKeys.includes(permReq)
  );
  const hasRole = roleReq === 'admin' && isAdmin;
  card.style.display = (hasPerm || hasRole) ? '' : 'none';
});


  // 2.1) بعد إظهار/إخفاء: تمركز البطاقة الأخيرة إن كان عددها فردياً
  function centerLastVisibleCard() {
    const grid = document.querySelector('.cards-grid');
    if (!grid) return;

    // نزيل الكلاس من أي بطاقة مسبقاً
    grid.querySelectorAll('.center-card').forEach(el => el.classList.remove('center-card'));

    // نجمع البطاقات الظاهرة فقط
    const visible = Array.from(grid.querySelectorAll('.card'))
      .filter(el => window.getComputedStyle(el).display !== 'none');

    // إذا عددها فردي: نعلّم الأخيرة
    if (visible.length % 2 === 1) {
      visible[visible.length - 1].classList.add('center-card');
    }
  }
  centerLastVisibleCard();


  // 3) ربط البطاقات
  document.querySelectorAll('.cards-grid .card').forEach(card => {
    card.addEventListener('click', () => {
      const url = card.getAttribute('data-url');
      if (url) window.location.href = url;
    });
  });

  // 4) جلب عدد الإشعارات غير المقروءة
  try {
    const notifRes = await fetch(`${apiBase}/users/${userId}/notifications/unread-count`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const { count } = await notifRes.json();
    const notifBadge = document.getElementById('notificationCount');
    if (notifBadge) {
      notifBadge.textContent = count;
      notifBadge.style.display = count > 0 ? 'block' : 'none';
    }
  } catch (err) {
    // console.warn('فشل جلب عدد الإشعارات:', err);
  }
});
