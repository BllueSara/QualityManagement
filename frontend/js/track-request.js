document.addEventListener("DOMContentLoaded", async () => {
  const params     = new URLSearchParams(window.location.search);
  const rawId      = params.get("id") || "";
  const contentType= params.get("type") || "department";
  const currentLang= localStorage.getItem('language') || 'ar';

  // 1) اقتطاع البادئة dept- أو comm- لو موجودة
  const contentId = rawId.replace(/^(dept|comm|prot)-/, "");
  if (!contentId) {
    alert(getTranslation('request-id-missing'));
    return;
  }

  try {
    // 2) بناء مسار الـAPI حسب النوع
    let endpoint;
    if (contentType === 'committee') {
      endpoint = 'committees/contents/track';
    } else if (contentType === 'protocol') {
      endpoint = 'protocols/track';
    } else {
      endpoint = 'contents/track';
    }
    const url = `http://10.99.28.23:3006/api/${endpoint}/${contentId}`;

    // 3) أرسل هيدر التفويض
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

    const data = await res.json();
    const status = data.status;
    // unified shape for display
    const content = data.content || data.protocol || {};
    const timeline = data.timeline || [];
    const pending = data.pending || [];
    if (status !== 'success') {
      alert(getTranslation('failed-to-load-request'));
      return;
    }

    // ——— هنا يبدأ كود العرض نفسه ———
    // القسم التالي …
    const nextDeptElem = document.querySelector('.next-dept .dept-name');
    if (!timeline.length && !pending.length) {
      nextDeptElem.textContent = getTranslation('no-department-assigned');
    } else if (!timeline.length && pending.length) {
      nextDeptElem.textContent = getTranslation('waiting-first-department');
    } else if (pending.length) {
      const next = pending[0];
      const name = parseLocalizedName(next.department);
      nextDeptElem.textContent = `${name} - ${next.approver}`;
    } else {
      nextDeptElem.textContent = getTranslation('all-departments-signed');
    }

    // آخر تحديث
    const lastUpdateElem = document.querySelector('.last-update');
    const latestDate = timeline.at(-1)?.created_at || content.created_at;
    lastUpdateElem.textContent = 
      `${getTranslation('last-update')}: ${new Date(latestDate)
        .toLocaleDateString(currentLang === 'ar' ? 'ar-EG' : 'en-US')}`;

    // الحالة الرئيسية
    const statusTitle = document.querySelector('.track-status-title');
    let statusText = getTranslation('under-review');
    if (!timeline.length && !pending.length) {
      statusText = getTranslation('not-approved-yet');
    } else if (timeline.some(log => log.status === 'rejected')) {
      statusText = getTranslation('rejected');
    } else if (content.approval_status === 'approved') {
      statusText = getTranslation('approved');
    }
    statusTitle.textContent = `${getTranslation('status')}: ${statusText}`;

    // نسبة التقدم
    const stepsCompleted = timeline.filter(log => log.status === 'approved').length;
    const stepsTotal     = stepsCompleted + pending.length;
    const percent        = stepsTotal 
                            ? Math.round((stepsCompleted / stepsTotal) * 100) 
                            : 0;

    document.querySelector('.progress-steps').textContent = 
      `${stepsCompleted} ${getTranslation('of')} ${stepsTotal} ${getTranslation('steps-completed')}`;
    document.querySelector('.percentage-text').textContent = `${percent}%`;
    document.querySelector('.circle')
            .setAttribute('stroke-dasharray', `${percent},100`);

    // بناء التايملاين
    const timelineContainer = document.querySelector('.timeline');
    timelineContainer.innerHTML = '';
    timeline.forEach(log => {
      const deptName = parseLocalizedName(log.department);
      const isApproved = log.status === 'approved';
      const isRejected = log.status === 'rejected';

      const statusClass = isApproved
        ? 'completed'
        : isRejected 
          ? 'rejected'
          : 'waiting';
      const badgeClass  = isApproved
        ? 'approved-badge'
        : isRejected 
          ? 'rejected-badge'
          : 'waiting-badge';
      const iconClass   = isApproved
        ? 'fa-check'
        : isRejected 
          ? 'fa-times'
          : 'fa-clock';

      const formattedDate = log.created_at
        ? new Date(log.created_at)
            .toLocaleDateString(currentLang==='ar'?'ar-EG':'en-US')
        : getTranslation('waiting');

      const item = document.createElement('div');
      item.classList.add('timeline-item', statusClass);
      item.innerHTML = `
        <div class="icon-wrapper">
          <div class="icon-bg ${statusClass}-bg">
            <i class="fas ${iconClass}"></i>
          </div>
        </div>
        <div class="timeline-content">
          <h3 class="timeline-dept">${deptName} - ${log.approver}</h3>
          <div class="timeline-details">
            <span class="timeline-date">${formattedDate}</span>
            <span class="status-badge ${badgeClass}">
              ${isApproved
                ? getTranslation('approved')
                : isRejected
                  ? getTranslation('rejected')
                  : getTranslation('waiting')}
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

function parseLocalizedName(value) {
  const lang = localStorage.getItem('language') || 'ar';
  try {
    if (typeof value === 'string' && value.trim().startsWith('{')) {
      const parsed = JSON.parse(value);
      return parsed[lang] || parsed.ar || parsed.en || '';
    }
    if (typeof value === 'object') {
      return value[lang] || value.ar || value.en || '';
    }
    return value || '';
  } catch {
    return '';
  }
}
