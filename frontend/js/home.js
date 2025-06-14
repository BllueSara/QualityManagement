// home.js
const apiBase = 'http://localhost:3006/api';

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  if (!token) return;

  // 1) فك التوكن
  const payload = JSON.parse(atob(token.split('.')[1] || '{}'));
  const userId  = payload.id;
  const role    = payload.role;
  const isAdmin = role === 'admin';

  // 2) جلب صلاحيات المستخدم
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
      console.error('Failed to fetch permissions:', err);
    }
  }

  // 3) أخفِ/أظهر العناصر حسب data-permission و data-role
  document.querySelectorAll('[data-permission], [data-role]').forEach(el => {
    const permReq = el.dataset.permission;  // مثال: 'view_logs'
    const roleReq = el.dataset.role;        // مثال: 'admin'

    const hasPerm = permReq && (permissionsKeys.includes('*') || permissionsKeys.includes(permReq));
    const hasRole = roleReq === 'admin' && isAdmin;

    el.style.display = (hasPerm || hasRole) ? '' : 'none';
  });

  // 4) ربط النقر على البطاقات
  const cards = document.querySelectorAll('.cards-grid .card');
  cards.forEach(card => {
    card.addEventListener('click', () => {
      const url = card.getAttribute('data-url');
      if (url) window.location.href = url;
    });
  });
});
