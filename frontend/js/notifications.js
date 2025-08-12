const apiBase = 'http://10.99.28.23:3006/api';

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
      // استخدم اللغة الحالية، وإذا لم تكن متوفرة استخدم العربية ثم الإنجليزية
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
  
  if (text==='غدًا تنتهي صلاحية المحتوى') {
    return 'The content has expired tomorrow';
  }
  if (text==='اقترب انتهاء صلاحية المحتوى') {
    return 'The content has expired soon';
  }

  // إشعارات انتهاء مهلة الاعتماد
  if (text === 'انتهت مهلة الاعتماد') {
    return 'Approval deadline has expired';
  }
  
  // ترجمة إشعار انتهاء مهلة الاعتماد للمحتوى من قسم/إدارة
  const approvalDeadlineMatch = text.match(/^انتهت مهلة الاعتماد للمحتوى "(.+)" من (قسم|إدارة|إدارة تنفيذية) "(.+)"(?: - (.+))?\. يرجى مراجعة المحتوى والاعتماد عليه في أقرب وقت ممكن\.?$/);
  if (approvalDeadlineMatch) {
    const [, title, type, deptName, contentType] = approvalDeadlineMatch;
    let typeText;
    switch (type) {
      case 'إدارة':
        typeText = 'administration';
        break;
      case 'إدارة تنفيذية':
        typeText = 'executive administration';
        break;
      default:
        typeText = 'department';
    }
    const contentTypeText = contentType ? ` - ${contentType}` : '';
    return `The approval deadline for content "${title}" from ${typeText} "${deptName}"${contentTypeText} has expired. Please review and approve the content as soon as possible.`;
  }
  
  // ترجمة إشعار انتهاء مهلة الاعتماد للمحتوى من لجنة
  const committeeApprovalDeadlineMatch = text.match(/^انتهت مهلة الاعتماد للمحتوى "(.+)" من "(.+)"\. يرجى مراجعة المحتوى والاعتماد عليه في أقرب وقت ممكن\.?$/);
  if (committeeApprovalDeadlineMatch) {
    const [, title, committeeName] = committeeApprovalDeadlineMatch;
    return `The approval deadline for content "${title}" from "${committeeName}" has expired. Please review and approve the content as soon as possible.`;
  }

  
  // إشعارات OVR
  if (text === 'تم إنشاء تقرير OVR جديد') {
    return 'A new OVR report has been created';
  }
  if (text === 'تم تحديث تقرير OVR') {
    return 'The OVR report has been updated';
  }
  if (text === 'تم إغلاق تقرير OVR') {
    return 'The OVR report has been closed';
  }
  if (text === 'تم تعيين تقرير OVR لك') {
    return 'An OVR report has been assigned to you';
  }
  if (text === 'تم تعيين تقرير OVR') {
    return 'An OVR report has been assigned';
  }
  if (text === 'تم حذف تقرير OVR') {
    return 'The OVR report has been deleted';
  }
  // إشعارات الاعتماد
  if (text === 'طلب اعتماد جديد') {
    return 'A new approval request';
  }
  if (text === 'تم اعتماد المحتوى') {
    return 'The content has been approved';
  }
  if (text === 'تم رفض المحتوى') {
    return 'The content has been rejected';
  }
  if (text === 'تم اعتماد الملف') {
    return 'The file has been approved';
  }
  if (text === 'تم رفض الملف') {
    return 'The file has been rejected';
  }
  if (text === 'اعتماد جزئي لملف') {
    return 'Partial file approval';
  }
  if (text === 'اعتماد جزئي لملف لجنة') {
    return 'Partial committee file approval';
  }
  // ترجمة إشعار اعتماد جزئي لملف
  const partialFileMatch = text.match(/^تم اعتماد الملف "(.+)" جزئياً من قبل (.+)\.$/);
  if (partialFileMatch) {
    return `The file "${partialFileMatch[1]}" was partially approved by ${partialFileMatch[2]}.`;
  }
  // ترجمة إشعار اعتماد جزئي لملف لجنة
  const partialCommitteeMatch = text.match(/^تم اعتماد ملف اللجنة "(.+)" جزئياً من قبل (.+)\.$/);
  if (partialCommitteeMatch) {
    return `The committee file "${partialCommitteeMatch[1]}" was partially approved by ${partialCommitteeMatch[2]}.`;
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
  // ترجمة ديناميكية للجمل التي تحتوي على متغيرات
  // تم تفويضك للتوقيع بالنيابة عن admin على The file رقم 67
  // نمط مرن جدًا لأي نص بعد "على" وقبل "رقم"
  const proxyMatchFlexible = text.match(/^تم تفويضك للتوقيع بالنيابة عن\s+(.+?)\s+على\s+(.+?)\s+رقم\s+(\d+)$/i);
  if (proxyMatchFlexible) {
    let [, user, fileType, fileNum] = proxyMatchFlexible;
    // Special translation for known terms
    if (user === 'مستخدم آخر') user = 'another user';
    if (fileType === 'ملف لجنة') fileType = 'committee file';
    if (fileType === 'The file') fileType = 'file';
    return `You have been delegated to sign on behalf of ${user} on ${fileType} number ${fileNum}`;
  }
  // تم إنشاء تقرير OVR جديد برقم 28
  const createOvrMatch = text.match(/^تم إنشاء تقرير OVR جديد برقم (\d+)$/);
  if (createOvrMatch) {
    return `A new OVR report has been created with number ${createOvrMatch[1]}`;
  }
  // تم حذف تقرير OVR برقم ...
  const deleteOvrMatch = text.match(/^تم حذف تقرير OVR برقم (\d+)$/);
  if (deleteOvrMatch) {
    return `The OVR report with number ${deleteOvrMatch[1]} has been deleted`;
  }
  // تم تحديث تقرير OVR برقم ...
  const updateOvrMatch = text.match(/^تم تحديث تقرير OVR برقم (\d+)$/);
  if (updateOvrMatch) {
    return `The OVR report with number ${updateOvrMatch[1]} has been updated`;
  }
  // تم إغلاق تقرير OVR برقم ...
  const closeOvrMatch = text.match(/^تم إغلاق تقرير OVR برقم (\d+)$/);
  if (closeOvrMatch) {
    return `The OVR report with number ${closeOvrMatch[1]} has been closed`;
  }
  // تم تعيين تقرير OVR برقم ... لك
  const assignOvrMatch = text.match(/^تم تعيين تقرير OVR برقم (\d+) لك$/);
  if (assignOvrMatch) {
    return `The OVR report with number ${assignOvrMatch[1]} has been assigned to you`;
  }
  // تم تعيين تقرير OVR برقم ... إلى: ...
  const assignOvrToMatch = text.match(/^تم تعيين تقرير OVR برقم (\d+) إلى: (.+)$/);
  if (assignOvrToMatch) {
    return `The OVR report with number ${assignOvrToMatch[1]} has been assigned to: ${assignOvrToMatch[2]}`;
  }
  if (text === 'طلب تفويض بالنيابة') {
    return 'Proxy delegation request';
  }
  if (text === 'طلب تفويض بالنيابة للجان') {
    return 'Committee proxy delegation request';
  }
  
  // إشعارات قبول/رفض التفويض الفردي
  if (text === 'رفض تفويض الملف الفردي') {
    return 'Single file delegation rejected';
  }
  if (text === 'قبول تفويض الملف الفردي') {
    return 'Single file delegation accepted';
  }
  if (text === 'single_committee_delegation_accepted') {
    return 'Single committee file delegation accepted';
  }
  
  // إشعارات التفويض الموحد
  if (text === 'proxy_bulk_unified') {
    return 'Unified bulk proxy delegation';
  }
  if (text === 'proxy_bulk_committee') {
    return 'Committee bulk proxy delegation';
  }
  
  // إشعارات الرفض مع سبب
  if (text === 'تم رفض الاعتماد') {
    return 'Approval rejected';
  }
  
  // ترجمة إشعار طلب تفويض بالنيابة لكل الملفات
  const proxyBulkMatch = text.match(/^تم طلب تفويضك للتوقيع بالنيابة عن مستخدم آخر على جميع الملفات \((\d+) ملف\)\.$/);
  if (proxyBulkMatch) {
    return `You have been requested to sign on behalf of another user for all files (${proxyBulkMatch[1]} files).`;
  }
  // ترجمة إشعار طلب تفويض بالنيابة لكل ملفات اللجان
  const proxyBulkCommitteeMatch = text.match(/^تم طلب تفويضك للتوقيع بالنيابة عن مستخدم آخر على جميع ملفات اللجان \((\d+) ملف\)\.$/);
  if (proxyBulkCommitteeMatch) {
    return `You have been requested to sign on behalf of another user for all committee files (${proxyBulkCommitteeMatch[1]} files).`;
  }
  // ترجمة إشعار طلب تفويض بالنيابة مع اسم الشخص (مرن لأي نوع ملفات)
  const proxyBulkNameFlexibleMatch = text.match(/^تم طلب تفويضك للتوقيع بالنيابة عن (.+?) على جميع (.+?)(?:ات|ات\.|\.|)\.?$/);
  if (proxyBulkNameFlexibleMatch) {
    let [, user, fileType] = proxyBulkNameFlexibleMatch;
    // Special translation for known terms
    if (user === 'مستخدم آخر') user = 'another user';
    if (fileType === 'ملفات اللجان') fileType = 'committee files';
    if (fileType === 'The file') fileType = 'files';
    if (fileType === 'الملفات') fileType = 'files';
    return `You have been requested to sign on behalf of ${user} for all ${fileType}.`;
  }
  // ترجمة أي إشعار فيه "تم طلب تفويضك للتوقيع بالنيابة عن" و"على جميع"
  if (/تم طلب تفويضك للتوقيع بالنيابة عن/.test(text) && /على جميع/.test(text)) {
    // استخراج اسم المستخدم
    const userMatch = text.match(/تم طلب تفويضك للتوقيع بالنيابة عن\s+([^\s]+)\s+على جميع/);
    let user = userMatch ? userMatch[1] : 'another user';
    if (user === 'مستخدم آخر') user = 'another user';
    return `You have been requested to sign on behalf of ${user} for all files.`;
  }
  const proxyBulkCommitteeNameMatch = text.match(/^تم طلب تفويضك للتوقيع بالنيابة عن (.+?) على جميع ملفات اللجان \((\d+) ملف\)\.$/);
  if (proxyBulkCommitteeNameMatch) {
    return `You have been requested to sign on behalf of ${proxyBulkCommitteeNameMatch[1]} for all committee files (${proxyBulkCommitteeNameMatch[2]} files).`;
  }
  
  // ترجمة إشعارات التفويض الموحد (أقسام ولجان ومحاضر)
  const unifiedProxyMatch = text.match(/^تم طلب تفويضك للتوقيع بالنيابة عن (.+?) على جميع الملفات \(أقسام ولجان ومحاضر\)\.$/);
  if (unifiedProxyMatch) {
    let [, delegatorName] = unifiedProxyMatch;
    if (delegatorName === 'مستخدم آخر') delegatorName = 'another user';
    return `You have been requested to sign on behalf of ${delegatorName} on all files (departments, committees, and protocols).`;
  }
  
  // ترجمة إشعارات التفويض للجان فقط
  const committeeProxyMatch = text.match(/^تم طلب تفويضك للتوقيع بالنيابة عن (.+?) على جميع ملفات اللجان\.$/);
  if (committeeProxyMatch) {
    let [, delegatorName] = committeeProxyMatch;
    if (delegatorName === 'مستخدم آخر') delegatorName = 'another user';
    return `You have been requested to sign on behalf of ${delegatorName} on all committee files.`;
  }
  
  // ترجمة إشعارات التفويض للملفات العادية
  const filesProxyMatch = text.match(/^تم طلب تفويضك للتوقيع بالنيابة عن (.+?) على جميع الملفات\.$/);
  if (filesProxyMatch) {
    let [, delegatorName] = filesProxyMatch;
    if (delegatorName === 'مستخدم آخر') delegatorName = 'another user';
    return `You have been requested to sign on behalf of ${delegatorName} on all files.`;
  }
  
  // ترجمة إشعارات الرفض مع سبب للملفات
  const rejectionWithReasonMatch = text.match(/^(ملف اللجنة|المحضر|الملف)\s*"(.+?)"\s*تم رفضه من قبل (.+?)(?:، السبب: (.+?))?$/);
  if (rejectionWithReasonMatch) {
    let [, fileType, title, rejectedBy, reason] = rejectionWithReasonMatch;
    let typeText;
    switch (fileType) {
      case 'ملف اللجنة':
        typeText = 'committee file';
        break;
      case 'المحضر':
        typeText = 'protocol';
        break;
      default:
        typeText = 'file';
    }
    const reasonText = reason ? `, reason: ${reason}` : '';
    return `The ${typeText} "${title}" was rejected by ${rejectedBy}${reasonText}`;
  }
  
  // ترجمة إشعارات التفويض الفردي مع اسم المستخدم
  const singleDelegationAcceptedMatch = text.match(/^تم قبول تفويض (الملف|ملف اللجنة) الفردي من قبل (.+?)\.$/);
  if (singleDelegationAcceptedMatch) {
    let [, fileType, acceptedBy] = singleDelegationAcceptedMatch;
    let typeText = fileType === 'ملف اللجنة' ? 'committee file' : 'file';
    return `Single ${typeText} delegation was accepted by ${acceptedBy}`;
  }
  
  const singleDelegationRejectedMatch = text.match(/^تم رفض تفويض (الملف|ملف اللجنة) الفردي من قبل (.+?)\.$/);
  if (singleDelegationRejectedMatch) {
    let [, fileType, rejectedBy] = singleDelegationRejectedMatch;
    let typeText = fileType === 'ملف اللجنة' ? 'committee file' : 'file';
    return `Single ${typeText} delegation was rejected by ${rejectedBy}`;
  }
  
  return text;
}
