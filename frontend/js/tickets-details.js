document.addEventListener('DOMContentLoaded', () => {
  // احصل على مُعرّف التذكرة من الـ URL
  const params = new URLSearchParams(window.location.search);
  const ticketId = params.get('id');
  if (!ticketId) {
    alert('لم يتم العثور على معرف التذكرة');
    return;
  }
const token = localStorage.getItem('token');
  // اجلب بيانات التذكرة من الخادم
 fetch(`http://localhost:3006/api/tickets/${ticketId}`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
    .then(response => {
      if (!response.ok) throw new Error(`خطأ في الشبكة: ${response.status}`);
      return response.json();
    })
    .then(ticket => {
      // دالة مساعدة لعرض التاريخ بنمط عربي
      const formatDate = iso => new Date(iso).toLocaleDateString('ar-EG', {
        year: 'numeric', month: 'long', day: 'numeric'
      });

      // مثال على كيفية تعبئة الحقول
      document.querySelector('[data-field="event-date"]').textContent = formatDate(ticket.event_date);
document.querySelector('[data-field="event-time"]').textContent =
  ticket.event_time;       document.querySelector('[data-field="event-location"]').textContent = ticket.event_location;
      document.querySelector('[data-field="reporting-dept"]').textContent = ticket.reporting_dept_name;
      document.querySelector('[data-field="responding-dept"]').textContent = ticket.responding_dept_name;

      // بيانات المريض
      document.querySelector('[data-field="patient-name"]').textContent = ticket.patient_name || '-';
      document.querySelector('[data-field="medical-record-no"]').textContent = ticket.medical_record_no || '-';
      document.querySelector('[data-field="gender"]').textContent = ticket.gender;

      // نوع البلاغ
      document.querySelector('[data-field="report-type"]').textContent = ticket.report_type;

      // وصف الحدث والمرفقات
      document.querySelector('[data-field="event-description"]').textContent = ticket.event_description;
      const attachmentsEl = document.querySelector('.attachments');
      if (ticket.attachments && ticket.attachments.length) {
        attachmentsEl.innerHTML = `<i class="fas fa-paperclip"></i> ${ticket.attachments.length} مرفقات`;
      } else {
        attachmentsEl.style.display = 'none';
      }

      // بيانات المبلغ
      document.querySelector('[data-field="reporter-name"]').textContent = ticket.reporter_name;
      document.querySelector('[data-field="reporter-phone"]').textContent = ticket.reporter_phone;
      document.querySelector('[data-field="reporter-position"]').textContent = ticket.reporter_position;
      document.querySelector('[data-field="reporter-email"]').textContent = ticket.reporter_email;

      // الإجراءات المتخذة
      document.querySelector('[data-field="actions-taken"]').textContent = ticket.actions_taken;

      // تصنيف الحدث
      const tagsContainer = document.querySelector('.tags-container');
      tagsContainer.innerHTML = '';
      ticket.classifications.forEach(cls => {
        const span = document.createElement('span');
        span.className = 'tag';
        span.textContent = cls;
        tagsContainer.appendChild(span);
      });

      // تفاصيل الإصابة
      document.querySelector('[data-field="had-injury"]').textContent = ticket.had_injury;
      if (ticket.had_injury === 'نعم') {
        document.querySelector('[data-field="injury-type"]').textContent = ticket.injury_type;
      } else {
        document.querySelector('[data-field="injury-type"]').closest('.field-value').style.display = 'none';
      }

      // الردود السابقة
      const timeline = document.querySelector('.timeline-content');
      timeline.innerHTML = '';
      ticket.replies.forEach(reply => {
        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.innerHTML = `
          <div class="timeline-dot"></div>
          <div class="timeline-body">
            <div class="timeline-date">${new Date(reply.created_at).toLocaleString('ar-EG', {day:'numeric',month:'long',year:'numeric',hour:'numeric',minute:'numeric'})}</div>
            <div class="timeline-text">${reply.text}</div>
            <div class="timeline-author">${reply.author}</div>
          </div>
        `;
        timeline.appendChild(item);
      });
    })
    
    .catch(error => console.error('حدث خطأ أثناء جلب بيانات التذكرة:', error));
// بعد بناء الـ timeline…
const replyTextarea = document.getElementById('replyTextarea');
const submitReply   = document.getElementById('submitReply');

submitReply.addEventListener('click', async () => {
  const text = replyTextarea.value.trim();
  if (!text) {
    alert('اكتب ردّك أولاً');
    return;
  }

  submitReply.disabled = true;
  submitReply.textContent = 'جاري الإرسال…';

  try {
    const res = await fetch(`http://localhost:3006/api/tickets/${ticketId}/replies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ text })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || res.statusText);
    }
    const newReply = await res.json();
    // أضف الرد جديداً في الـ timeline
    const timeline = document.querySelector('.timeline-content');
    const item = document.createElement('div');
    item.className = 'timeline-item';
    item.innerHTML = `
      <div class="timeline-dot"></div>
      <div class="timeline-body">
        <div class="timeline-date">${new Date(newReply.created_at)
          .toLocaleString('ar-EG',{day:'numeric',month:'long',year:'numeric',hour:'numeric',minute:'numeric'})}</div>
        <div class="timeline-text">${newReply.text}</div>
        <div class="timeline-author">${newReply.author}</div>
      </div>
    `;
    timeline.prepend(item);
    replyTextarea.value = '';
  } catch (err) {
    console.error(err);
    alert('خطأ أثناء إرسال الرد: ' + err.message);
  } finally {
    submitReply.disabled = false;
    submitReply.textContent = 'إرسال الرد';
  }
});

});
