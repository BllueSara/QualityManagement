// home.js
const apiBase = 'http://localhost:3006/api';

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
  document.querySelectorAll('[data-permission], [data-role]').forEach(el => {
    const permReq = el.dataset.permission;
    const roleReq = el.dataset.role;

    const hasPerm = permReq && (permissionsKeys.includes('*') || permissionsKeys.includes(permReq));
    const hasRole = roleReq === 'admin' && isAdmin;

    el.style.display = (hasPerm || hasRole) ? '' : 'none';
  });

  // 3) ربط البطاقات
  document.querySelectorAll('.cards-grid .card').forEach(card => {
    card.addEventListener('click', () => {
      const url = card.getAttribute('data-url');
      if (url) window.location.href = url;
    });
  });

  // Fetch unread notifications count
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
