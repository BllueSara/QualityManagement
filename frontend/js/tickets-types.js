const apiBase = 'http://localhost:3006/api';

document.addEventListener('DOMContentLoaded', async () => {
  // دوال مساعدة
  const getToken = () => localStorage.getItem('token');
  const parsePayload = () => {
    try {
      return JSON.parse(atob(getToken().split('.')[1]));
    } catch {
      return {};
    }
  };
  const payload  = parsePayload();
  const userRole = payload.role;

  // 1) جلب مفاتيح الصلاحيات
  let permissionsKeys = [];
  if (['admin', 'manager_ovr'].includes(userRole)) {
    // الإدمن يرى كل البطاقات
    permissionsKeys = ['*'];
  } else {
    const userId = payload.id;
    const res = await fetch(`${apiBase}/users/${userId}/permissions`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    if (res.ok) {
      const { data: perms } = await res.json();
      // هنا ندعم إما مصفوفة من سلاسل أو من كائنات
      permissionsKeys = perms.map(p =>
        typeof p === 'string' 
          ? p 
          : (p.permission || p.permission_key || '')
      );
    }
  }

  console.log('userRole:', userRole);
  console.log('permissionsKeys:', permissionsKeys);

  // 2) أخف البطاقات غير المصرّح بها
  document.querySelectorAll('.ticket-card[data-permission]').forEach(card => {
    const perm  = card.dataset.permission;   // المفتاح من HTML
    const allow = permissionsKeys.includes('*')
                || permissionsKeys.includes(perm);

    if (!allow) card.style.display = 'none';
  });
});
