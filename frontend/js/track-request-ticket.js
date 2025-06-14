// track-request-ticket.js

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const ticketId = params.get('id');
  if (!ticketId) return console.error('Missing ticket id');

  try {
    const res = await fetch(`http://localhost:3006/api/tickets/${ticketId}/track`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (!res.ok) throw new Error('Failed to fetch track data');
    const { content, timeline, pending } = await res.json();

    // 1) هل التذكرة مغلقة؟
    const statusLower = (content.current_status || '').toLowerCase();
    const isClosed = ['مغلق', 'closed'].includes(statusLower);

    // 2) نص “القسم التالي”
    document.querySelector('.next-dept .dept-name').textContent =
      isClosed ? '—' : (pending.length ? pending[0].department : '—');

    // 3) عنوان الحالة
    document.querySelector('.track-status-title').textContent =
      isClosed ? 'مغلقة' : `قيد ${content.current_status} في ${content.responding_dept_name}`;

    // 4) آخر تحديث
    const updatedAt = new Date(content.created_at);
    document.querySelector('.last-update').textContent =
      `آخر تحديث: ${updatedAt.toLocaleDateString('ar-SA', {
        year:'numeric', month:'long', day:'numeric'
      })}`;

    // 5) حساب التقدم
    const completedCount = timeline.filter(item =>
      ['معتمد', 'مغلق', 'closed'].includes(item.status)
    ).length;

    const expectedCount = isClosed ? 0 : Math.max(0, pending.length - 1);

    const totalSteps = timeline.length + expectedCount;
    const progressPercent = isClosed
      ? 100
      : (totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0);

    // 6) تحديث الدائرة
    const circle = document.querySelector('.circle');
    circle.setAttribute('stroke-dasharray', `${progressPercent},100`);
    document.querySelector('.percentage-text').textContent = `${progressPercent}%`;

    // 7) تحديث نص الخطوات
    document.querySelector('.progress-steps').textContent =
      isClosed
        ? `${totalSteps} من ${totalSteps} خطوات مكتملة`
        : `${completedCount} من ${totalSteps} خطوات مكتملة`;

    // 8) بناء الـ timeline
    const container = document.querySelector('.timeline');
    container.innerHTML = '';

    timeline.forEach(item => {
      let stateClass;
      if (['معتمد', 'مغلق', 'closed'].includes(item.status)) stateClass = 'completed';
      else if (item.status === 'قيد المراجعة') stateClass = 'pending';
      else stateClass = 'waiting';

      const date = new Date(item.created_at)
        .toLocaleDateString('ar-SA', { year:'numeric', month:'long', day:'numeric' });

      const badgeClass = stateClass === 'completed'
        ? 'approved-badge'
        : (stateClass==='pending' ? 'pending-badge' : 'waiting-badge');

      container.insertAdjacentHTML('beforeend', `
        <div class="timeline-item ${stateClass}">
          <div class="icon-wrapper">
            <div class="icon-bg ${stateClass}-bg">
              <i class="fas ${
                stateClass==='completed' ? 'fa-check' :
                stateClass==='pending'   ? 'fa-clock' : 'fa-circle'
              }"></i>
            </div>
          </div>
          <div class="timeline-content">
            <h3 class="timeline-dept">${item.changed_by || '—'}</h3>
            <div class="timeline-details">
              <span class="timeline-date">${date}</span>
              <span class="status-badge ${badgeClass}">${item.status}</span>
            </div>
            ${item.comments ? `<p class="timeline-note">${item.comments}</p>` : ''}
          </div>
        </div>
      `);
    });

    // 9) عرض الأقسام المتوقعة بعد أول pending
    if (!isClosed && pending.length > 1) {
      pending.slice(1).forEach(dept => {
        container.insertAdjacentHTML('beforeend', `
          <div class="timeline-item waiting">
            <div class="icon-wrapper">
              <div class="icon-bg waiting-bg"><i class="fas fa-circle"></i></div>
            </div>
            <div class="timeline-content">
              <h3 class="timeline-dept">${dept.department}</h3>
              <div class="timeline-details">
                <span class="timeline-date">متوقع: —</span>
                <span class="status-badge waiting-badge">في الانتظار</span>
              </div>
            </div>
          </div>
        `);
      });
    }

  } catch (err) {
    console.error(err);
    alert('فشل جلب بيانات التتبع');
  }
});
