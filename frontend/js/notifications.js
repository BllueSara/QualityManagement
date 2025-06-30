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
    // البحث في جميع الحقول: اسم المستخدم، العنوان، الرسالة، النوع
    const userName = (n.user_name || '').toLowerCase();
    const title    = (n.title || '').toLowerCase();
    const message  = (n.message || '').toLowerCase();
    const notifType = (n.type || '').toLowerCase();
    const matchesSearch =
      userName.includes(search) ||
      title.includes(search) ||
      message.includes(search) ||
      notifType.includes(search);
    return matchesType && matchesSearch;
  });

  renderNotifications(filtered);
}
const currentLang = localStorage.getItem('language') || 'ar';

// دالة تستبدل أي JSON مضمّن بـالنص المناسب
function extractText(jsonOrString) {
  if (!jsonOrString) return '';

  // استبدال كل كتلة JSON داخل السلسلة
  return jsonOrString.replace(/\{[^}]+\}/g, match => {
    try {
      const obj = JSON.parse(match);
      return obj[currentLang] || obj.ar || obj.en || '';
    } catch {
      return match;
    }
  });
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
    // ① فكّ JSON stringify إن وجد في العنوان والرسالة
    const titleText   = extractText(n.title);
    const messageText = extractText(n.message);

    // ② حدّد الأيقونة واللون بناءً على النوع
    const { iconClass, bg } = getIconAndColor(n.type);

    // ③ ابني الكارد بالـ HTML
    const card = document.createElement('div');
    card.className = 'notification-card';
    card.innerHTML = `
      <div class="notification-icon ${bg}">
        <i class="${iconClass}"></i>
      </div>
      <div class="notification-content">
        <div class="notification-user">${n.user_name || '—'}</div>
        <div class="notification-title">
          ${getNotificationTranslation(titleText)}
        </div>
        <div class="notification-description">
          ${getNotificationTranslation(messageText)}
        </div>
      </div>
      <div class="notification-meta">
        <div class="notification-time">${timeAgo(n.created_at)}</div>
        <div class="read-indicator read"></div>
        <button class="delete-btn" data-id="${n.id}" title="${getTranslation('notification-delete')}">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
    listContainer.appendChild(card);
  });

  // ④ اربط أزرار الحذف كما كان عندك
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      try {
        await fetch(`${apiBase}/users/${userId}/notifications/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        // حدّث القائمة محلياً وأعدّ تصفيتها
        allNotifications = allNotifications.filter(n => n.id != id);
        filterNotifications();
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
  // ترجمة إشعار انتهاء الصلاحية
  const expiredDetails = text.match(
    /^انتهت صلاحية المحتوى\s*["«](.+?)["»]\s*في(?:\s*قسم)?\s*["«](.+?)["»][,،]\s*مجلد\s*["«](.+?)["»]\s*بتاريخ\s*(.+?)\.\s*يرجى تحديثه أو رفع نسخة جديدة\.?$/
  );
  if (expiredDetails) {
    const [, title, dept, folder, date] = expiredDetails;
    return `The content "${title}" in department "${dept}", folder "${folder}" expired on ${date}. Please update or upload a new version.`;
  }
  // ترجمة إشعار اقتراب انتهاء الصلاحية (قبل شهر أو يوم)
  const soonMonthDetails = text.match(/^اقترب انتهاء صلاحية المحتوى\s*["«](.+?)["»]\s*في(?:\s*قسم)?\s*["«](.+?)["»][,،]\s*مجلد\s*["«](.+?)["»]\s*بتاريخ\s*(.+?)\.\s*يرجى تحديثه أو رفع نسخة جديدة\.?$/);
  if (soonMonthDetails) {
    const [, title, dept, folder, date] = soonMonthDetails;
    return `The content "${title}" in department "${dept}", folder "${folder}" is expiring soon (on ${date}). Please update or upload a new version.`;
  }
  const soonDayDetails = text.match(/^غدًا تنتهي صلاحية المحتوى\s*["«](.+?)["»]\s*في(?:\s*قسم)?\s*["«](.+?)["»][,،]\s*مجلد\s*["«](.+?)["»]\s*بتاريخ\s*(.+?)\.\s*يرجى تحديثه أو رفع نسخة جديدة\.?$/);
  if (soonDayDetails) {
    const [, title, dept, folder, date] = soonDayDetails;
    return `The content "${title}" in department "${dept}", folder "${folder}" will expire tomorrow (${date}). Please update or upload a new version.`;
  }
  // ترجمة إشعار انتهاء الصلاحية مع تفاصيل القسم والمجلد
  const expiredContentDetailsMatch = text.match(/^انتهت صلاحية المحتوى "(.+)" في قسم "(.+)", مجلد "(.+)" بتاريخ ([0-9\-]+). يرجى تحديثه أو رفع نسخة جديدة\.?\n?$/);
  if (expiredContentDetailsMatch) {
    return `The content "${expiredContentDetailsMatch[1]}" in department "${expiredContentDetailsMatch[2]}", folder "${expiredContentDetailsMatch[3]}" expired on ${expiredContentDetailsMatch[4]}. Please update or upload a new version.`;
  }
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
  if (text==='انتهت صلاحية المحتوى') {
    return 'The content has expired';
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
   const committeeRejectedMatch = text.match(
    /^ملف اللجنة "(.+)" تم رفضه من قبل الإدارة\.$/
  );
  if (committeeRejectedMatch) {
    return `The committee file "${committeeRejectedMatch[1]}" has been rejected by the administration.`;
  }

  const translations = {
    'تم تفويضك للتوقيع بالنيابة عن مستخدم آخر على الملف رقم': 'You have been delegated to sign on behalf of another user for file number',
    'تم تفويضك للتوقيع على ملف جديد رقم': 'You have been delegated to sign a new file with number',
    'تم تفويضك للتوقيع على ملف لجنة جديد رقم': 'You have been delegated to sign a new committee file with number',
    'تم إغلاق الحدث العارض رقم': 'Your OVO  has been closed number',
    'تم إغلاق الحدث العارض': 'OVR closed',
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
