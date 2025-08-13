document.addEventListener('DOMContentLoaded', async () => {
  // Apply language settings
  const currentLang = localStorage.getItem('language') || 'ar';
  if (typeof setLanguage === 'function') {
    setLanguage(currentLang);
  }

  let allDepartments = [];

  async function fetchAllDepartments() {
    const token = localStorage.getItem('token');
    const res = await fetch('http://localhost:3006/api/departments/all', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    allDepartments = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
  }

  await fetchAllDepartments();

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
      console.log('✅ [tickets-details] تم استلام بيانات التذكرة:', ticket);
      console.log('🔍 [tickets-details] بيانات مستوى الضرر في التذكرة:', {
        harm_level: ticket.harm_level,
        harm_level_id: ticket.harm_level_id,
        level_of_harm: ticket.level_of_harm
      });
      
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

      // عرض اسم القسم الآخر المعني
      if (ticket.other_depts) {
        const dept = allDepartments.find(d => String(d.id) === String(ticket.other_depts));
        let deptName = '';
        if (dept) {
          try {
            const lang = localStorage.getItem('language') || 'ar';
            const nameObj = typeof dept.name === 'string' ? JSON.parse(dept.name) : dept.name;
            deptName = nameObj?.[lang] || nameObj?.ar || nameObj?.en || '';
          } catch {
            deptName = dept.name || '';
          }
        }
        document.getElementById('otherDeptView').textContent = deptName || ticket.other_depts;
      }

      document.querySelector('[data-field="patient-name"]').textContent = ticket.patient_name || '-';
      document.querySelector('[data-field="medical-record-no"]').textContent = ticket.medical_record_no || '-';
      document.querySelector('[data-field="report-type"]').textContent = getTranslation(normalizeValue(ticket.report_type));
      document.querySelector('[data-field="event-description"]').textContent = ticket.event_description;

      const attachmentsEl = document.getElementById('attachmentsView');
      if (ticket.attachments && ticket.attachments.length) {
        attachmentsEl.innerHTML = '';
        ticket.attachments.forEach(att => {
          const filename = att.filename; // استخراج اسم الملف من الكائن
          const url = `http://localhost:3006/uploads/tickets/${filename}`;
          const link = document.createElement('a');
          link.href = url;
          link.target = '_blank';
          link.textContent = filename;
          link.style.display = 'block';
          link.style.marginBottom = '5px';
          attachmentsEl.appendChild(link);
        });
      } else {
        attachmentsEl.style.display = 'none';
      }

      document.querySelector('[data-field="reporter-name"]').textContent = ticket.reporter_name;
      document.querySelector('[data-field="reporter-phone"]').textContent = ticket.reporter_phone;
      document.querySelector('[data-field="reporter-position"]').textContent = ticket.reporter_position;
      document.querySelector('[data-field="reporter-email"]').textContent = ticket.reporter_email;
      document.querySelector('[data-field="actions-taken"]').textContent = ticket.actions_taken;

      // أضف سطر الطباعة هنا
      console.log('Ticket object:', ticket);

      const tagsContainer = document.querySelector('.tags-container');
      tagsContainer.innerHTML = '';
      
      // استخدام classification_details إذا كانت متوفرة، وإلا استخدم classifications
      const classificationsToShow = ticket.classification_details || ticket.classifications || [];
      
      classificationsToShow.forEach(cls => {
        let displayText = '';
        
        if (typeof cls === 'object' && cls.name_ar) {
          // إذا كان cls كائن يحتوي على name_ar و name_en
          const lang = localStorage.getItem('language') || 'ar';
          displayText = lang === 'en' ? cls.name_en : cls.name_ar;
        } else if (typeof cls === 'string') {
          // إذا كان cls نص
          const key = normalizeValue(cls);
          const translated = getTranslation(key);
          displayText = translated !== key ? translated : cls;
        } else if (typeof cls === 'number') {
          // إذا كان cls رقم (ID)
          displayText = `تصنيف ${cls}`;
        }
        
        const span = document.createElement('span');
        span.className = 'tag';
        span.textContent = displayText;
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

      // 🟢 عرض تصنيف مستوى الضرر
      console.log('🔍 [tickets-details] بيانات مستوى الضرر:', ticket.harm_level);
      
      if (ticket.harm_level && ticket.harm_level.name_ar) {
        const lang = currentLang || 'ar';
        const harmLevelName = lang === 'en' ? ticket.harm_level.name_en : ticket.harm_level.name_ar;
        const harmLevelDesc = lang === 'en' ? ticket.harm_level.desc_en : ticket.harm_level.desc_ar;
        
        const el = document.getElementById('levelHarmView');
        if (el) {
          el.textContent = `${harmLevelName} - ${harmLevelDesc}`;
        }
        
        console.log('✅ [tickets-details] تم عرض مستوى الضرر:', harmLevelName);
      } else {
        console.log('⚠️ [tickets-details] لا توجد بيانات مستوى الضرر');
      }
    })
    .catch(error => {
      console.error('❌ [tickets-details] خطأ في جلب بيانات التذكرة:', error);
      alert('حدث خطأ أثناء جلب بيانات الحدث العارض: ' + error.message);
    });

  // بعد جلب بيانات التذكرة
  const tokenPayload = token ? await safeGetUserInfo(token) : {};
  const userRole = tokenPayload.role;

  // إخفاء المرفقات وبيانات المبلغ لغير admin وmanager_ovr
  if (userRole !== 'admin' && userRole !== 'manager_ovr') {
    const attachmentsSection = document.getElementById('attachmentsView')?.closest('.card-section');
    if (attachmentsSection) attachmentsSection.style.display = 'none';
    const reporterSection = document.querySelector('.card-section .section-title[data-translate="reporter-info"]')?.closest('.card-section');
    if (reporterSection) reporterSection.style.display = 'none';
  }

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
  if (val==='فرط الضغط' || val.toLowerCase().includes('pressure fracture')) return 'pressure fracture';
  return val;
}
