document.addEventListener('DOMContentLoaded', () => {
  // Apply language settings
  const currentLang = localStorage.getItem('language') || 'ar';
  if (typeof setLanguage === 'function') {
    setLanguage(currentLang);
  }

  const params = new URLSearchParams(window.location.search);
  const ticketId = params.get('id');
  if (!ticketId) {
    alert(getTranslation('ticket-not-found'));
    return;
  }

  const token = localStorage.getItem('token');

  // 🟡 الدالة التي تجلب وتعرض الردود
  async function reloadReplies() {
    try {
      const res = await fetch(`http://localhost:3006/api/tickets/${ticketId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const ticket = await res.json();

      const timeline = document.querySelector('.timeline-content');
      timeline.innerHTML = '';
      ticket.replies.forEach(reply => {
        const item = document.createElement('div');
        item.className = 'timeline-item';
        
        // Format date based on current language
        const dateOptions = {
          day: 'numeric', 
          month: 'long', 
          year: 'numeric', 
          hour: 'numeric', 
          minute: 'numeric'
        };
        
        const formattedDate = new Date(reply.created_at).toLocaleString(
          currentLang === 'ar' ? 'ar-EG' : 'en-US', 
          dateOptions
        );
        
        item.innerHTML = `
          <div class="timeline-dot"></div>
          <div class="timeline-body">
            <div class="timeline-date">${formattedDate}</div>
            <div class="timeline-text">${reply.text}</div>
            <div class="timeline-author">${reply.author || getTranslation('user')}</div>
          </div>
        `;
        timeline.appendChild(item);
      });
    } catch (err) {
      alert(getTranslation('error-loading-replies'));
    }
  }

  // جلب بيانات التذكرة
  fetch(`http://localhost:3006/api/tickets/${ticketId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
    .then(response => {
      if (!response.ok) throw new Error(`خطأ في الشبكة: ${response.status}`);
      return response.json();
    })
    .then(ticket => {
      const formatDate = iso => new Date(iso).toLocaleDateString(
        currentLang === 'ar' ? 'ar-EG' : 'en-US', 
        {
          year: 'numeric', 
          month: 'long', 
          day: 'numeric'
        }
      );

      document.querySelector('[data-field="event-date"]').textContent = formatDate(ticket.event_date);
      document.querySelector('[data-field="event-time"]').textContent = getTranslation(normalizeValue(ticket.event_time));
      document.querySelector('[data-field="event-location"]').textContent = ticket.event_location;
const lang = currentLang || 'ar';

function parseDeptName(name) {
  try {
    const parsed = JSON.parse(name);
    return parsed[lang] || parsed['ar'] || parsed['en'] || name;
  } catch {
    return name; // في حال الاسم مو بصيغة JSON
  }
}

document.querySelector('[data-field="reporting-dept"]').textContent = parseDeptName(ticket.reporting_dept_name);
document.querySelector('[data-field="responding-dept"]').textContent = parseDeptName(ticket.responding_dept_name);

      document.querySelector('[data-field="patient-name"]').textContent = ticket.patient_name || '-';
      document.querySelector('[data-field="medical-record-no"]').textContent = ticket.medical_record_no || '-';
      document.querySelector('[data-field="gender"]').textContent = getTranslation(normalizeValue(ticket.gender));
      document.querySelector('[data-field="report-type"]').textContent = getTranslation(normalizeValue(ticket.report_type));
      document.querySelector('[data-field="event-description"]').textContent = ticket.event_description;

      const attachmentsEl = document.querySelector('.attachments');
      if (ticket.attachments && ticket.attachments.length) {
        const currentLang = localStorage.getItem('language') || 'ar';
        const attachmentText = currentLang === 'ar' 
          ? `${ticket.attachments.length} مرفقات`
          : `${ticket.attachments.length} attachments`;
        attachmentsEl.innerHTML = `<i class="fas fa-paperclip"></i> ${attachmentText}`;
      } else {
        attachmentsEl.style.display = 'none';
      }

      document.querySelector('[data-field="reporter-name"]').textContent = ticket.reporter_name;
      document.querySelector('[data-field="reporter-phone"]').textContent = ticket.reporter_phone;
      document.querySelector('[data-field="reporter-position"]').textContent = ticket.reporter_position;
      document.querySelector('[data-field="reporter-email"]').textContent = ticket.reporter_email;
      document.querySelector('[data-field="actions-taken"]').textContent = ticket.actions_taken;

      const tagsContainer = document.querySelector('.tags-container');
      tagsContainer.innerHTML = '';
      ticket.classifications.forEach(cls => {
        const key = normalizeValue(cls);
        const translated = getTranslation(key);
        // If translation is missing, show the original value
        const display = translated !== key ? translated : cls;
        const span = document.createElement('span');
        span.className = 'tag';
        span.textContent = display;
        tagsContainer.appendChild(span);
      });

      document.querySelector('[data-field="had-injury"]').textContent = getTranslation(normalizeValue(ticket.had_injury));
      if (normalizeValue(ticket.had_injury) === 'yes') {
        document.querySelector('[data-field="injury-type"]').textContent = getTranslation(normalizeValue(ticket.injury_type));
      } else {
        document.querySelector('[data-field="injury-type"]').closest('.field-value').style.display = 'none';
      }

      // 🟢 هنا نستدعي الردود من نفس الدالة
      reloadReplies();
    })
    .catch(error => {
      alert(getTranslation('error-loading-ticket'));
    });

  const replyTextarea = document.getElementById('replyTextarea');
  const submitReply = document.getElementById('submitReply');

  submitReply.addEventListener('click', async () => {
    const text = replyTextarea.value.trim();
    if (!text) {
      alert(getTranslation('write-reply-first'));
      return;
    }

    submitReply.disabled = true;
    submitReply.textContent = getTranslation('sending');

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

      // ✅ بعد الإرسال، نعيد تحميل الردود
      await reloadReplies();

      replyTextarea.value = '';
    } catch (err) {
      alert(getTranslation('error-sending-reply') + err.message);
    } finally {
      submitReply.disabled = false;
      submitReply.textContent = getTranslation('send-reply');
    }
  });

  // Language switcher functionality
  const languageBtn = document.querySelector('.language-btn');
  const languageDropdown = document.querySelector('.language-switcher .dropdown');
  
  if (languageBtn && languageDropdown) {
    languageBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      languageDropdown.classList.toggle('show');
    });

    // Handle language selection
    document.querySelectorAll('.language-switcher .dropdown a').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const lang = e.target.getAttribute('data-lang');
        if (lang && typeof setLanguage === 'function') {
          setLanguage(lang);
        }
        languageDropdown.classList.remove('show');
      });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.language-switcher')) {
        languageDropdown.classList.remove('show');
      }
    });
  }
});

// دالة تطبيع القيم الشائعة للترجمة
function normalizeValue(val) {
  if (!val) return val;
  // injury/had_injury
  if (val === 'نعم' || val.toLowerCase() === 'yes') return 'yes';
  if (val === 'لا' || val.toLowerCase() === 'no') return 'no';
  // injury_type
  if (val === 'جسدية' || val.toLowerCase() === 'physical') return 'physical';
  if (val === 'نفسية' || val.toLowerCase() === 'psychic' || val.toLowerCase() === 'psychological') return 'psychic';
  // gender
  if (val === 'ذكر' || val.toLowerCase() === 'male') return 'male';
  if (val === 'أنثى' || val.toLowerCase() === 'female') return 'female';
  // report_type
  if (val === 'حادث' || val.toLowerCase() === 'accident') return 'accident';
  if (val === 'حدث قابل للتبليغ' || val.toLowerCase().includes('near')) return 'near-miss';
  if (val === 'حدث جسيم' || val.toLowerCase().includes('serious')) return 'serious';
  if (val === 'تنبيه خطأ' || val.toLowerCase().includes('error')) return 'error';
  if (val === 'وضع غير آمن' || val.toLowerCase().includes('unsafe')) return 'unsafe';
  // event time
  if (val === 'صباحاً' || val === 'صباحا' || val.toLowerCase().includes('morning')) return 'morning';
  if (val === 'مساءً' || val === 'مساءا' || val.toLowerCase().includes('evening')) return 'evening';
  // التصنيفات (تصنيف الحدث)
  if (val === 'الأجهزة الطبية' || val.toLowerCase().includes('medical equipment')) return 'medical-equipment';
  if (val === 'البنية' || val.toLowerCase().includes('infrastructure')) return 'infrastructure';
  if (val === 'قضايا أمنية' || val.toLowerCase().includes('security')) return 'security-issues';
  if (val === 'النظافة' || val.toLowerCase().includes('cleaning')) return 'cleaning';
  if (val === 'السقوط' || val.toLowerCase().includes('fall')) return 'fall';
  if (val === 'مشكلات سلسلة الإمداد' || val.toLowerCase().includes('supply chain')) return 'supply-chain';
  if (val === 'إدارة رعاية المرضى' || val.toLowerCase().includes('patient care')) return 'patient-care';
  if (val === 'خدمات الطعام' || val.toLowerCase().includes('food services')) return 'food-services';
  if (val === 'الصحة المهنية' || val.toLowerCase().includes('occupational health')) return 'occupational-health';
  if (val === 'تكامل الجلد' || val.toLowerCase().includes('skin integrity')) return 'skin-integrity';
  if (val === 'مشاكل التواصل' || val.toLowerCase().includes('communication')) return 'communication';
  if (val === 'قضايا الولادة' || val.toLowerCase().includes('maternal')) return 'maternal';
  if (val === 'أحداث جسيمة' || val.toLowerCase().includes('serious incidents')) return 'serious-incidents';
  if (val === 'قضايا الموظفين' || val.toLowerCase().includes('staff issues')) return 'staff-issues';
  if (val === 'إجراءات طبية' || val.toLowerCase().includes('medical procedures')) return 'medical-procedures';
  if (val === 'البيئة / السلامة' || val.toLowerCase().includes('environment') || val.toLowerCase().includes('safety')) return 'environment-safety';
  if (val === 'التصوير الطبي' || val.toLowerCase().includes('medical imaging')) return 'medical-imaging';
  if (val === 'الهوية / المستندات / الموافقات' || val.toLowerCase().includes('identity') || val.toLowerCase().includes('documents') || val.toLowerCase().includes('consents')) return 'identity-docs';
  if (val === 'قضايا مكافحة العدوى' || val.toLowerCase().includes('infection control')) return 'infection-control';
  if (val === 'الحقن الوريدي' || val.toLowerCase().includes('iv injection')) return 'iv-injection';
  if (val === 'الدواء' || val.toLowerCase().includes('medication')) return 'medication';
  if (val === 'العلاج الإشعاعي' || val.toLowerCase().includes('radiation therapy')) return 'radiation-therapy';
  if (val === 'صيانة المنشأة' || val.toLowerCase().includes('facility maintenance')) return 'facility-maintenance';
  if (val === 'قضايا تقنية المعلومات' || val.toLowerCase().includes('it issues')) return 'it-issues';
  if (val === 'التغذية السريرية' || val.toLowerCase().includes('clinical nutrition')) return 'clinical-nutrition';
  return val;
}
