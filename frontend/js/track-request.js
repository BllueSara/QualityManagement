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
  
      // تعبئة القسم التالي
      const nextDeptElem = document.querySelector('.next-dept .dept-name');
      if (pending.length > 0) {
        nextDeptElem.textContent = pending[0] || '---';
      } else {
        nextDeptElem.textContent = 'تم التوقيع من الجميع ✅';
      }
  
      // تعبئة آخر تحديث
      const lastUpdateElem = document.querySelector('.last-update');
      const latestDate = timeline.at(-1)?.created_at || content.created_at;
      lastUpdateElem.textContent = `آخر تحديث: ${new Date(latestDate).toLocaleDateString('ar-EG')}`;
  
      // تعبئة الحالة الرئيسية
      const statusTitle = document.querySelector('.track-status-title');
      statusTitle.textContent = `الحالة: ${content.approval_status === 'approved' ? 'معتمد' : 'قيد المراجعة'}`;
  
      // تعبئة خطوات التقدم
      const stepsCompleted = timeline.length;
      const stepsTotal = stepsCompleted + pending.length;
      const percent = Math.round((stepsCompleted / stepsTotal) * 100);
      document.querySelector('.progress-steps').textContent = `${stepsCompleted} من ${stepsTotal} خطوات مكتملة`;
      document.querySelector('.percentage-text').textContent = `${percent}%`;
      document.querySelector('.circle').setAttribute('stroke-dasharray', `${percent},100`);
  
      // بناء التايملاين
      const timelineContainer = document.querySelector('.timeline');
      timelineContainer.innerHTML = '';
  
      timeline.forEach(log => {
        const item = document.createElement('div');
        item.classList.add('timeline-item', log.status === 'approved' ? 'completed' : 'rejected');
  
        item.innerHTML = `
          <div class="icon-wrapper">
            <div class="icon-bg ${log.status === 'approved' ? 'completed-bg' : 'rejected-bg'}">
              <i class="fas ${log.status === 'approved' ? 'fa-check' : 'fa-times'}"></i>
            </div>
          </div>
          <div class="timeline-content">
            <h3 class="timeline-dept">${log.department}</h3>
            <div class="timeline-details">
              <span class="timeline-date">${new Date(log.created_at).toLocaleDateString('ar-EG')}</span>
              <span class="status-badge ${log.status === 'approved' ? 'approved-badge' : 'rejected-badge'}">
                ${log.status === 'approved' ? 'معتمد' : 'مرفوض'}
              </span>
            </div>
            <p class="timeline-note">${log.comments || 'بدون ملاحظات'}</p>
          </div>
        `;
  
        timelineContainer.appendChild(item);
      });
  
      // مراحل لم تتم بعد (pending)
      pending.forEach(departmentName => {
        const item = document.createElement('div');
        item.classList.add('timeline-item', 'waiting');
        item.innerHTML = `
          <div class="icon-wrapper">
            <div class="icon-bg waiting-bg">
              <i class="fas fa-circle"></i>
            </div>
          </div>
          <div class="timeline-content">
            <h3 class="timeline-dept">${departmentName}</h3>
            <div class="timeline-details">
              <span class="timeline-date">في الانتظار</span>
              <span class="status-badge waiting-badge">قيد الانتظار</span>
            </div>
          </div>
        `;
        timelineContainer.appendChild(item);
      });
  
    } catch (err) {
      console.error('Error:', err);
      alert("حدث خطأ أثناء تحميل البيانات.");
    }
  });
  