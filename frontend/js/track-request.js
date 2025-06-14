document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const contentId = params.get("id");

  if (!contentId) return alert("معرف الطلب غير موجود!");

  try {
    const res = await fetch(`http://localhost:3006/api/contents/track/${contentId}`);
    const data = await res.json();

    if (!data || data.status !== 'success') {
      return alert("فشل تحميل معلومات الطلب");
    }

    const { content, timeline, pending } = data;

    // القسم التالي
    const nextDeptElem = document.querySelector('.next-dept .dept-name');
    if (timeline.length === 0 && pending.length === 0) {
      nextDeptElem.textContent = 'لم يتم تعيين أي جهة لاعتماد الطلب بعد';
    } else if (timeline.length === 0 && pending.length > 0) {
      nextDeptElem.textContent = 'في انتظار التوقيع من القسم الأول';
    } else if (pending.length > 0) {
      const next = pending.find(p => p.status === 'pending');
      nextDeptElem.textContent = next 
        ? `${next.department} - ${next.approver}` 
        : '---';
    } else {
      nextDeptElem.textContent = 'تم التوقيع من الجميع ';
    }

    // آخر تحديث
    const lastUpdateElem = document.querySelector('.last-update');
    const latestDate = timeline.at(-1)?.created_at || content.created_at;
    lastUpdateElem.textContent = `آخر تحديث: ${new Date(latestDate).toLocaleDateString('ar-EG')}`;

    // الحالة الرئيسية
    const statusTitle = document.querySelector('.track-status-title');
    let statusText = 'قيد المراجعة';

    if (timeline.length === 0 && pending.length === 0) {
      statusText = 'لم يتم الاعتماد بعد';
    } else if (timeline.some(log => log.status === 'rejected')) {
      statusText = 'مرفوض';
    } else if (content.approval_status === 'approved') {
      statusText = 'معتمد';
    }

    statusTitle.textContent = `الحالة: ${statusText}`;

    // نسبة التقدم
    const stepsCompleted = timeline.filter(log => log.status === 'approved').length;
    const stepsTotal = stepsCompleted + pending.length;
    const percent = stepsTotal > 0 ? Math.round((stepsCompleted / stepsTotal) * 100) : 0;

    document.querySelector('.progress-steps').textContent = `${stepsCompleted} من ${stepsTotal} خطوات مكتملة`;
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

      item.innerHTML = `
        <div class="icon-wrapper">
          <div class="icon-bg ${statusClass}-bg">
            <i class="fas ${iconClass}"></i>
          </div>
        </div>
        <div class="timeline-content">
          <h3 class="timeline-dept">${log.department} - ${log.approver}</h3>
          <div class="timeline-details">
            <span class="timeline-date">
              ${log.created_at ? new Date(log.created_at).toLocaleDateString('ar-EG') : 'في الانتظار'}
            </span>
            <span class="status-badge ${badgeClass}">
              ${
                log.status === 'approved'
                  ? 'معتمد'
                  : log.status === 'rejected'
                  ? 'مرفوض'
                  : 'قيد الانتظار'
              }
            </span>
          </div>
          <p class="timeline-note">${log.comments || 'بدون ملاحظات'}</p>
        </div>
      `;
      timelineContainer.appendChild(item);
    });

  } catch (err) {
    console.error('Error:', err);
    alert("حدث خطأ أثناء تحميل البيانات.");
  }
});
