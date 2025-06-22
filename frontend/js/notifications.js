const apiBase = 'http://localhost:3006/api';

let allNotifications = [];
let token, userId, isAdmin, payload;

document.addEventListener('DOMContentLoaded', async () => {
  token = localStorage.getItem('token');
  if (!token) return alert(getTranslation('notifications-not-logged-in'));

  try {
    payload = JSON.parse(atob(token.split('.')[1]));
  } catch {
    return alert(getTranslation('notifications-invalid-token'));
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
  if (result.status !== 'success') return alert(getTranslation('notifications-load-failed'));

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
    listContainer.innerHTML = `<p style="text-align:center">${getTranslation('notifications-no-match')}</p>`;
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
<div class="notification-user">${n.user_name || '—'}</div>
      <div class="notification-title">${getNotificationTranslation(n.title)}</div>
        <div class="notification-description">${getNotificationTranslation(n.message)}</div>
      </div>
      <div class="notification-meta">
        <div class="notification-time">${timeAgo(n.created_at)}</div>
        <div class="read-indicator read"></div>
        <button class="delete-btn" data-id="${n.id}" title="${getTranslation('notification-delete')}"><i class="fas fa-trash"></i></button>
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
        alert(getTranslation('notifications-delete-failed'));
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
  const lang = localStorage.getItem('language') || document.documentElement.lang || 'ar';
  if (diff < 60)
    return lang === 'en' ? 'now' : 'الآن';
  if (diff < 3600) return lang === 'en'
    ? `${Math.floor(diff / 60)} min ago`
    : `منذ ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return lang === 'en'
    ? `${Math.floor(diff / 3600)} hour${Math.floor(diff / 3600) > 1 ? 's' : ''} ago`
    : `منذ ${Math.floor(diff / 3600)} ساعة`;
  return then.toLocaleDateString(lang === 'en' ? 'en-US' : 'ar-SA');
}

// ✅ عرض اسم المستخدم أو رقم المعرف حسب الدور
function getUserLabel(notificationUserId, isAdmin, currentUser) {
  return isAdmin && notificationUserId !== currentUser.id
    ? `#${notificationUserId}`
    : currentUser.name || '—';
}

function getTranslation(key) {
  const lang = localStorage.getItem('language') || document.documentElement.lang || 'ar';
  if (window.translations && window.translations[lang] && window.translations[lang][key]) {
    return window.translations[lang][key];
  }
  return key;
}

// ✅ ترجمة ذكية للإشعارات العربية للإنجليزية
function getNotificationTranslation(text) {
  const lang = localStorage.getItem('language') || document.documentElement.lang || 'ar';
  if (lang === 'ar') return text;
  // exact-title translations
  if (text === 'تم تفويضك للتوقيع') {
    return 'You have been delegated to sign';
  }
  if (text === 'تم اعتماد ملفك') {
    return 'Your file has been approved';
  }
  if (text === 'تم رفض ملفك') {
    return 'Your file has been rejected';
  }
  // ترجمة الجمل التي تحتوي على اسم ملف بين علامات اقتباس
  const fileApprovedMatch = text.match(/^الملف "(.+)" تم اعتماده من قبل الإدارة\.$/);
  if (fileApprovedMatch) {
    return `The file "${fileApprovedMatch[1]}" has been approved by the administration.`;
  }
  const fileRejectedMatch = text.match(/^الملف "(.+)" تم رفضه من قبل الإدارة\.$/);
  if (fileRejectedMatch) {
    return `The file "${fileRejectedMatch[1]}" has been rejected by the administration.`;
  }
 // committee‐file approved
 const committeeApprovedMatch = text.match(
   /^ملف اللجنة "(.+)" تم اعتماده من قبل الإدارة\.$/
 );
 if (committeeApprovedMatch) {
   return `The committee file "${committeeApprovedMatch[1]}" has been approved by the administration.`;
 }

  const translations = {
    'تم تفويضك للتوقيع بالنيابة عن مستخدم آخر على الملف رقم': 'You have been delegated to sign on behalf of another user for file number',
    'تم تفويضك للتوقيع على ملف جديد رقم': 'You have been delegated to sign a new file with number',
    'تم تفويضك للتوقيع على ملف لجنة جديد رقم': 'You have been delegated to sign a new committee file with number',
    'تم إغلاق تذكرتك رقم': 'Your ticket number',
    'تم إغلاق التذكرة': 'Ticket closed',
    'الملف': 'The file',
    'تم اعتماده من قبل الإدارة.': 'has been approved by the administration.',
    'تم رفضه من قبل الإدارة.': 'has been rejected by the administration.',
    'ملف اللجنة': 'The committee file',
  };

  for (const ar in translations) {
    if (text.startsWith(ar)) {
      return text.replace(ar, translations[ar]);
    }
    if (text.includes(ar)) {
      return text.replace(ar, translations[ar]);
    }
  }
  return text;
}
