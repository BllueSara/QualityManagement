document.addEventListener('DOMContentLoaded', async () => {
  // Apply language settings
  const currentLang = localStorage.getItem('language') || 'ar';
  if (typeof setLanguage === 'function') {
    setLanguage(currentLang);
  }

  const params = new URLSearchParams(window.location.search);
  const ticketId = params.get('id');

  // if (!ticketId) return console.error('Missing ticket id');

  try {
    const res = await fetch(`http://localhost:3006/api/tickets/${ticketId}/track`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (!res.ok) throw new Error('Failed to fetch track data');

    const { content, timeline, pending } = await res.json();

    const isClosed = ['مغلق', 'closed'].includes((content.current_status || '').toLowerCase());

    // القسم التالي
    document.querySelector('.next-dept .dept-name').textContent =
      isClosed ? getTranslation('no-data') : (pending.length ? pending[0].department : getTranslation('no-data'));

    // عنوان الحالة
    const statusText = isClosed ? getTranslation('closed') : `${getTranslation('pending')} في ${content.responding_dept_name}`;
    document.querySelector('.track-status-title').textContent = statusText;

    // آخر تحديث
    const updatedAt = new Date(content.created_at);
    const dateOptions = {
      year: 'numeric', 
      month: 'long', 
      day: 'numeric'
    };
    const formattedDate = updatedAt.toLocaleDateString(
      currentLang === 'ar' ? 'ar-SA' : 'en-US', 
      dateOptions
    );
    document.querySelector('.last-update').textContent = `${getTranslation('last-update')} ${formattedDate}`;

    // التقدم
const completedCount = timeline.length;
let totalSteps = completedCount + (pending?.length || 0);

if (isClosed) {
  // المغلق = كل الخطوات محسوبة
  totalSteps = completedCount;
}

const progressPercent = totalSteps > 0
  ? Math.round((completedCount / totalSteps) * 100)
  : 0;


    // الدائرة
    const circle = document.querySelector('.circle');
    circle.setAttribute('stroke-dasharray', `${progressPercent},100`);
    document.querySelector('.percentage-text').textContent = `${progressPercent}%`;

    // النص
    const progressText = currentLang === 'ar' 
      ? `${completedCount} من ${totalSteps} خطوات مكتملة`
      : `${completedCount} of ${totalSteps} steps completed`;
    document.querySelector('.progress-steps').textContent = progressText;

    // بناء التايملاين
    const container = document.querySelector('.timeline');
    container.innerHTML = '';

    timeline.forEach(item => {
let stateClass;
if (item.status === 'رد') {
  stateClass = 'reply'; // 🟠 هذا لونه خاص
} else if (['معتمد', 'مغلق', 'closed'].includes(item.status)) {
  stateClass = 'completed';
} else if (item.status === 'قيد المراجعة' || item.status === 'تم الإرسال') {
  stateClass = 'pending';
} else {
  stateClass = 'waiting';
}

      const date = new Date(item.created_at)
        .toLocaleDateString(currentLang === 'ar' ? 'ar-SA' : 'en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });

      // Translate status text
      let statusText = item.status;
      if (item.status === 'رد') statusText = getTranslation('reply');
      else if (item.status === 'معتمد') statusText = getTranslation('approved');
      else if (item.status === 'مغلق') statusText = getTranslation('closed');
      else if (item.status === 'قيد المراجعة') statusText = getTranslation('pending');
      else if (item.status === 'تم الإرسال') statusText = getTranslation('sent');

const badgeClass = 
  stateClass === 'completed' ? 'approved-badge' :
  stateClass === 'pending'   ? 'pending-badge' :
  stateClass === 'reply'     ? 'reply-badge'   :
                               'waiting-badge';

      container.insertAdjacentHTML('beforeend', `
        <div class="timeline-item ${stateClass}">
          <div class="icon-wrapper">
            <div class="icon-bg ${stateClass}-bg">
<i class="fas ${
  stateClass === 'completed' ? 'fa-check' :
  stateClass === 'pending'   ? 'fa-clock' :
  stateClass === 'reply'     ? 'fa-comment-dots' : // 🟠 أيقونة مميزة للرد
                               'fa-circle'
}"></i>

            </div>
          </div>
          <div class="timeline-content">
            <div class="timeline-details-row">
              <div class="timeline-author">
                <i class="fas fa-user-circle"></i>
                <span>${item.changed_by || '—'} - ${item.department_name || '—'}</span>
              </div>
              <div class="timeline-details">
                <span class="timeline-date">${date}</span>
                <span class="status-badge ${badgeClass}">${statusText}</span>
              </div>
            </div>
            ${item.comments ? `<p class="timeline-note">${item.comments}</p>` : ''}
          </div>
        </div>
      `);
    });

    // عرض الأقسام المتوقعين
    if (!isClosed && pending.length > 1) {
      pending.slice(1).forEach(dept => {
        container.insertAdjacentHTML('beforeend', `
          <div class="timeline-item waiting">
            <div class="icon-wrapper">
              <div class="icon-bg waiting-bg"><i class="fas fa-circle"></i></div>
            </div>
            <div class="timeline-content">
              <div class="timeline-details-row">
                <div class="timeline-author">
                  <i class="fas fa-user-circle"></i>
                  <span>${dept.department}</span>
                </div>
                <div class="timeline-details">
                  <span class="timeline-date">${getTranslation('expected')} —</span>
                  <span class="status-badge waiting-badge">${getTranslation('waiting')}</span>
                </div>
              </div>
            </div>
          </div>
        `);
      });
    }

  } catch (err) {
    // console.error(err);
    alert(getTranslation('error-loading-data'));
  }
});
