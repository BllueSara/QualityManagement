const apiBase = 'http://localhost:3006/api';

let allNotifications = [];
let token, userId, isAdmin, payload;

document.addEventListener('DOMContentLoaded', async () => {
  token = localStorage.getItem('token');
  if (!token) return alert('المستخدم غير مسجل دخول.');

  try {
    payload = JSON.parse(atob(token.split('.')[1]));
  } catch {
    return alert('توكن غير صالح.');
  }

  userId = payload.id;
  isAdmin = payload.role === 'admin';

  // ✅ علّم كل الإشعارات كمقروءة
  await fetch(`${apiBase}/users/${userId}/notifications/mark-read`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  // ✅ حذف شارة الإشعارات
  const badge = document.querySelector('.notif-badge');
  if (badge) badge.remove();

  // ✅ جلب الإشعارات
  const res = await fetch(`${apiBase}/users/${userId}/notifications`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const result = await res.json();
  if (result.status !== 'success') return alert('فشل تحميل الإشعارات');

  allNotifications = result.data || [];

  renderNotifications(allNotifications);
});

// ✅ الفلترة حسب النوع والبحث
document.getElementById('notification-type').addEventListener('change', filterNotifications);
document.getElementById('search-input').addEventListener('input', filterNotifications);

function filterNotifications() {
  const type = document.getElementById('notification-type').value;
  const search = document.getElementById('search-input').value.toLowerCase();

  const filtered = allNotifications.filter(n => {
    const matchesType = !type || n.type === type;
    const matchesSearch =
      n.title.toLowerCase().includes(search) ||
      n.message.toLowerCase().includes(search);
    return matchesType && matchesSearch;
  });

  renderNotifications(filtered);
}

// ✅ عرض الإشعارات ديناميكياً
function renderNotifications(notifications) {
  const listContainer = document.querySelector('.notifications-list');
  listContainer.innerHTML = '';

  if (notifications.length === 0) {
    listContainer.innerHTML = `<p style="text-align:center">لا توجد إشعارات مطابقة.</p>`;
    return;
  }

  notifications.forEach(n => {
    const { iconClass, bg } = getIconAndColor(n.type);

    const card = document.createElement('div');
    card.className = 'notification-card';
    card.innerHTML = `
      <div class="notification-icon ${bg}">
        <i class="${iconClass}"></i>
      </div>
      <div class="notification-content">
        <div class="notification-user">${getUserLabel(n.user_id, isAdmin, payload)}</div>
        <div class="notification-title">${n.title}</div>
        <div class="notification-description">${n.message}</div>
      </div>
      <div class="notification-meta">
        <div class="notification-time">${timeAgo(n.created_at)}</div>
        <div class="read-indicator read"></div>
        <button class="delete-btn" data-id="${n.id}" title="حذف"><i class="fas fa-trash"></i></button>
      </div>
    `;

    listContainer.appendChild(card);
  });

  // ✅ الحذف اليدوي بزر
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      try {
await fetch(`${apiBase}/users/${userId}/notifications/${id}`, {
  method: 'DELETE',
  headers: { 'Authorization': `Bearer ${token}` }
});


        allNotifications = allNotifications.filter(n => n.id != id);
        filterNotifications(); // نعيد التصفية حسب النوع/البحث

      } catch {
        alert('فشل حذف الإشعار');
      }
    });
  });
}

// ✅ أيقونات وألوان حسب النوع
function getIconAndColor(type) {
  switch (type) {
    case 'ticket': return { iconClass: 'fas fa-ticket-alt', bg: 'bg-blue' };
    case 'approval': return { iconClass: 'fas fa-check-circle', bg: 'bg-green' };
    case 'signature': return { iconClass: 'fas fa-pen-nib', bg: 'bg-purple' };
    case 'proxy': return { iconClass: 'fas fa-user-friends', bg: 'bg-orange' };
    case 'add': return { iconClass: 'fas fa-plus-circle', bg: 'bg-teal' };
    case 'update': return { iconClass: 'fas fa-edit', bg: 'bg-yellow' };
    case 'delete': return { iconClass: 'fas fa-trash-alt', bg: 'bg-red' };
    default: return { iconClass: 'fas fa-bell', bg: 'bg-gray' };
  }
}

// ✅ توقيت نسبي
function timeAgo(dateString) {
  const now = new Date();
  const then = new Date(dateString);
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'الآن';
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
  return then.toLocaleDateString('ar-SA');
}

// ✅ عرض اسم المستخدم أو رقم المعرف حسب الدور
function getUserLabel(notificationUserId, isAdmin, currentUser) {
  return isAdmin && notificationUserId !== currentUser.id
    ? `#${notificationUserId}`
    : currentUser.name || '—';
}
