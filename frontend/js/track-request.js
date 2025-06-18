document.addEventListener("DOMContentLoaded", async () => {
const params = new URLSearchParams(window.location.search);
const rawId = params.get("id");
const contentId = rawId?.startsWith("dept-") ? rawId.replace("dept-", "") : rawId;
const contentType = params.get("type") || "department";
const currentLang = localStorage.getItem('language') || 'ar';


  if (!contentId) {
    alert(getTranslation('request-id-missing'));
    return;
  }

  try {
    const endpoint = contentType === 'committee' ? 'committees/contents/track' : 'contents/track';
    const res = await fetch(`http://localhost:3006/api/${endpoint}/${contentId}`);

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();

    if (!data || data.status !== 'success') {
      alert(getTranslation('failed-to-load-request'));
      return;
    }

    const { content, timeline, pending } = data;

    // القسم التالي
    const nextDeptElem = document.querySelector('.next-dept .dept-name');
    if (timeline.length === 0 && pending.length === 0) {
      nextDeptElem.textContent = getTranslation('no-department-assigned');
    } else if (timeline.length === 0 && pending.length > 0) {
      nextDeptElem.textContent = getTranslation('waiting-first-department');
    } else if (pending.length > 0) {
      const next = pending[0];
      nextDeptElem.textContent = next 
        ? `${next.department} - ${next.approver}` 
        : '---';
    } else {
      nextDeptElem.textContent = getTranslation('all-departments-signed');
    }

    // آخر تحديث
    const lastUpdateElem = document.querySelector('.last-update');
    const latestDate = timeline.at(-1)?.created_at || content.created_at;
    const formattedDate = new Date(latestDate).toLocaleDateString(currentLang === 'ar' ? 'ar-EG' : 'en-US');
    lastUpdateElem.textContent = `${getTranslation('last-update')}: ${formattedDate}`;

    // الحالة الرئيسية
    const statusTitle = document.querySelector('.track-status-title');
    let statusText = getTranslation('under-review');

    if (timeline.length === 0 && pending.length === 0) {
      statusText = getTranslation('not-approved-yet');
    } else if (timeline.some(log => log.status === 'rejected')) {
      statusText = getTranslation('rejected');
    } else if (content.approval_status === 'approved') {
      statusText = getTranslation('approved');
    }

    statusTitle.textContent = `${getTranslation('status')}: ${statusText}`;

    // نسبة التقدم
    const stepsCompleted = timeline.filter(log => log.status === 'approved').length;
    const stepsTotal = stepsCompleted + pending.length;
    const percent = stepsTotal > 0 ? Math.round((stepsCompleted / stepsTotal) * 100) : 0;

    document.querySelector('.progress-steps').textContent = 
      `${stepsCompleted} ${getTranslation('of')} ${stepsTotal} ${getTranslation('steps-completed')}`;
    document.querySelector('.percentage-text').textContent = `${percent}%`;
    document.querySelector('.circle').setAttribute('stroke-dasharray', `${percent},100`);

    // بناء التايملاين
    const timelineContainer = document.querySelector('.timeline');
    timelineContainer.innerHTML = '';

    // عرض الموافقات الفعلية
    timeline.forEach(log => {
      const item = document.createElement('div');
      const statusClass = log.status === 'approved' 
                          ? 'completed' 
                          : (log.status === 'rejected' ? 'rejected' : 'waiting');

      const badgeClass = log.status === 'approved' 
                          ? 'approved-badge' 
                          : (log.status === 'rejected' ? 'rejected-badge' : 'waiting-badge');

      const iconClass = log.status === 'approved'
                          ? 'fa-check'
                          : (log.status === 'rejected' ? 'fa-times' : 'fa-clock');

      item.classList.add('timeline-item', statusClass);

      const formattedDate = log.created_at 
        ? new Date(log.created_at).toLocaleDateString(currentLang === 'ar' ? 'ar-EG' : 'en-US')
        : getTranslation('waiting');

      item.innerHTML = `
        <div class="icon-wrapper">
          <div class="icon-bg ${statusClass}-bg">
            <i class="fas ${iconClass}"></i>
          </div>
        </div>
        <div class="timeline-content">
          <h3 class="timeline-dept">${log.department} - ${log.approver}</h3>
          <div class="timeline-details">
            <span class="timeline-date">${formattedDate}</span>
            <span class="status-badge ${badgeClass}">
              ${
                log.status === 'approved'
                  ? getTranslation('approved')
                  : log.status === 'rejected'
                  ? getTranslation('rejected')
                  : getTranslation('waiting')
              }
            </span>
          </div>
          <p class="timeline-note">${log.comments || getTranslation('no-notes')}</p>
        </div>
      `;
      timelineContainer.appendChild(item);
    });

  } catch (err) {
    console.error('Error:', err);
    alert(getTranslation('error-loading-data'));
  }
});
