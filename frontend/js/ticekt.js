// scripts.js

// دالة إظهار التوست - خارج DOMContentLoaded لتكون متاحة في كل مكان
function showToast(message, type = 'info', duration = 3000) {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    // Force reflow to ensure animation plays from start
    toast.offsetWidth; 

    // تفعيل التوست
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Set a timeout to remove the toast
    setTimeout(() => {
        toast.classList.remove('show');
        // Remove element after animation completes
        setTimeout(() => {
            toast.remove();
        }, 500); // Should match CSS animation duration
    }, duration);
}

document.addEventListener('DOMContentLoaded', () => {

    const form = document.getElementById('ticketForm');
    const btnCancel = document.getElementById('btnCancel');
    const reportingDeptSelect = document.getElementById('reportingDept');
    const respondingDeptSelect = document.getElementById('respondingDept');
    const otherDeptsSelect = document.getElementById('otherDepts');
const apiBase = 'http://localhost:3006/api';

    // Load departments from the database
async function loadDepartments() {
  try {
    const response = await fetch(`${apiBase}/departments`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    console.log('Departments HTTP status:', response.status);
    const body = await response.json();
    console.log('Departments response body:', body);

    // فقط تحقق من response.ok:
    if (!response.ok) {
      throw new Error(body.message || `Response not OK (${response.status})`);
    }

    // إذا كانت البيانات في field.data، استخدمها، وإلا اعتبر body نفسه مصفوفة
    const departments = Array.isArray(body.data) 
      ? body.data 
      : Array.isArray(body) 
        ? body 
        : [];

    // صفِّر الخيارات القديمة
reportingDeptSelect.innerHTML = `
  <option value="" disabled selected data-translate="placeholder-select-dept">
    ${translations[localStorage.getItem('language') || 'ar']["placeholder-select-dept"]}
  </option>
`;

respondingDeptSelect.innerHTML = `
  <option value="" disabled selected data-translate="placeholder-select-dept">
    ${translations[localStorage.getItem('language') || 'ar']["placeholder-select-dept"]}
  </option>
`;

otherDeptsSelect.innerHTML = `
  <option value="" disabled selected data-translate="placeholder-select-dept">
    ${translations[localStorage.getItem('language') || 'ar']["placeholder-select-dept"]}
  </option>
`;


    // أضف كل قسم للقوائم الثلاث
const lang = localStorage.getItem('language') || 'ar';

departments.forEach(dept => {
let deptName = '';
try {
  const nameObj = typeof dept.name === 'string' ? JSON.parse(dept.name) : dept.name;
  deptName = nameObj?.[lang] || nameObj?.ar || nameObj?.en || '';
} catch {
  deptName = dept.name || '';
}

  const opt1 = document.createElement('option');
  opt1.value = dept.id;
  opt1.textContent = deptName;
  reportingDeptSelect.appendChild(opt1);

  const opt2 = document.createElement('option');
  opt2.value = dept.id;
  opt2.textContent = deptName;
  respondingDeptSelect.appendChild(opt2);

  const opt3 = document.createElement('option');
  opt3.value = dept.id;
  opt3.textContent = deptName;
  otherDeptsSelect.appendChild(opt3);
});


    // تحديث الترجمات بعد إضافة الخيارات
    updateModalTexts(localStorage.getItem('language') || 'ar');

  } catch (error) {
    console.error('Error loading departments:', error);
    showToast('حدث خطأ أثناء تحميل الأقسام: ' + (error.message || error), 'error');
  }
}

async function loadClassifications() {
  const lang = localStorage.getItem('language') || 'ar';
  const token = localStorage.getItem('token');
  const response = await fetch(`http://localhost:3006/api/tickets/classifications?lang=${lang}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const result = await response.json();
  console.log('Classifications API result:', result);
  if (!result.data) {
    showToast('لم يتم تحميل التصنيفات من السيرفر', 'error');
    return;
  }
  const container = document.querySelector('.classification-grid');
  container.innerHTML = '';

  result.data.forEach(classif => {
    const id = `cat_${classif.id}`;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = id;
    checkbox.name = 'classification';
    checkbox.value = classif.id;

    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = classif.name;

    const div = document.createElement('div');
    div.className = 'checkbox-item';
    div.appendChild(checkbox);
    div.appendChild(label);

    container.appendChild(div);
  });
}

async function loadHarmLevels() {
  const lang = localStorage.getItem('language') || 'ar';
  const token = localStorage.getItem('token');
  const response = await fetch(`http://localhost:3006/api/tickets/harm-levels?lang=${lang}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const result = await response.json();
  const container = document.getElementById('levelOfHarmOptions');
  container.innerHTML = '';

  if (!result.data) {
    container.innerHTML = '<span style="color:red">لم يتم تحميل مستويات الضرر</span>';
    return;
  }

  result.data.forEach(level => {
    const id = `harm_${level.id}`;
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.id = id;
    radio.name = 'harm_level_id';
    radio.value = level.id;
    radio.required = true;

    const label = document.createElement('label');
    label.htmlFor = id;
    label.innerHTML = `${level.name} <br><small>${level.desc}</small>`;

    const wrapper = document.createElement('div');
    wrapper.className = 'level-harm-option';
    wrapper.appendChild(radio);
    wrapper.appendChild(label);
    container.appendChild(wrapper);
  });
}


    // Load departments when the page loads
    loadDepartments();
    loadClassifications();
    loadHarmLevels();

    // تعبئة التاريخ والوقت تلقائيًا عند تحميل الصفحة
    const eventDateInput = document.getElementById('eventDate');
    const eventTimeInput = document.getElementById('eventTime');
    if (eventDateInput) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      eventDateInput.value = `${yyyy}-${mm}-${dd}`;
    }
    if (eventTimeInput) {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      // const ss = String(now.getSeconds()).padStart(2, '0');
      eventTimeInput.value = `${hh}:${min}`;
    }

    // عند الضغط على زر "إلغاء / عودة"، نعيد المستخدم للصفحة السابقة
    btnCancel.addEventListener('click', () => {
        window.history.back();
    });

    // التحقق من صحة النموذج عند الإرسال
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // التحقق من أن تاريخ الحدث موجود وأقل من تاريخ اليوم
        const eventDate = document.getElementById('eventDate').value;
        if (!eventDate) {
            showToast('يرجى اختيار تاريخ الحدث.', 'error');
            return;
        }

        // التحقق من اختيار القسم
        const reportingDept = document.getElementById('reportingDept').value;
        const respondingDept = document.getElementById('respondingDept').value;
        if (!reportingDept || !respondingDept) {
            showToast('يرجى اختيار القسم المبلغ والقسم المستجيب.', 'error');
            return;
        }

        // التحقق من اختيار نوع البلاغ
        const reportType = form.querySelector('input[name="reportType"]:checked');
        if (!reportType) {
            showToast('يرجى اختيار نوع البلاغ.', 'error');
            return;
        }

        const checkboxes = form.querySelectorAll('input[type="checkbox"][name="classification"]');
        const anyChecked = Array.from(checkboxes).some(cb => cb.checked);
        if (!anyChecked) {
          showToast('يرجى اختيار خيار واحد على الأقل', 'error');
          return;
        }

        // بعد: const formData = new FormData(form);

        // جمع بيانات النموذج
        const formData = new FormData(form);

        // الحقول المطلوبة
        formData.set('event_date', formData.get('eventDate'));
        // اجعل الوقت hh:mm فقط بدون ثواني
        let eventTime = formData.get('eventTime') || '';
        if (eventTime.includes(':')) {
          const parts = eventTime.split(':');
          eventTime = parts[0] + ':' + parts[1];
        }
        formData.set('event_time', eventTime);
        formData.set('event_location', formData.get('eventLocation'));
        formData.set('reporting_dept_id', formData.get('reportingDept'));
        formData.set('responding_dept_id', formData.get('respondingDept'));
        formData.set('other_depts', formData.get('otherDepts') || '');
        formData.set('patient_name', formData.get('patientName') || '');
        formData.set('medical_record_no', formData.get('medicalRecordNo') || '');

        // جمع patient types - إذا لم يتم اختيار أي شيء، أرسل مصفوفة فارغة
        const patientTypeValues = Array.from(
          form.querySelectorAll('input[name="patientType"]:checked')
        ).map(cb => cb.value);
        formData.set('patient_types', JSON.stringify(patientTypeValues));

        // الحقول الاختيارية - تأكد من إرسال قيم فارغة بدلاً من null
        formData.set('dob', formData.get('dob') || '');
        formData.set('gender', formData.get('gender') || '');
        formData.set('report_type', formData.get('reportType'));
        formData.set('report_short_desc', formData.get('reportShortDesc') || '');
        formData.set('event_description', formData.get('eventDescription'));
        formData.set('reporter_name', formData.get('reporterName'));
        formData.set('reporter_position', formData.get('reporterPosition'));
        formData.set('reporter_phone', formData.get('reporterPhone'));
        formData.set('reporter_email', formData.get('reporterEmail'));
        formData.set('actions_taken', formData.get('actionsTaken'));

        // الحقول الاختيارية للإصابة
        formData.set('had_injury', formData.get('hadInjury') || '');
        formData.set('injury_type', formData.get('injuryType') || '');

        // جمع التصنيفات
        const classificationValues = Array.from(checkboxes)
          .filter(cb => cb.checked)
          .map(cb => cb.value);

        // خزنهم في FormData كسلسلة JSON
        formData.set('classifications', JSON.stringify(classificationValues));
        
        // للتأكد من أن التصنيفات تم إرسالها بشكل صحيح
        console.log('Classifications being sent:', classificationValues);
        formData.set('language', localStorage.getItem('language') || 'ar');
        // احذف أي استخدام لـ levelOfHarm.value أو التحقق منه

        // عند إرسال النموذج، اجمع harm_level_id المختار
        const harmLevelRadio = form.querySelector('input[name="harm_level_id"]:checked');
        if (!harmLevelRadio) {
            showToast('يرجى اختيار تصنيف مستوى الضرر.', 'error');
            return;
        }
        formData.set('harm_level_id', harmLevelRadio.value);

        try {
          const response = await fetch(`${apiBase}/tickets`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formData
          });

          let result;
          try {
            const text = await response.text();
            let result;
            try {
              result = JSON.parse(text);
            } catch (e) {
              throw e;
            }
            console.log('Result:', result);
          } catch (e) {
            console.error('JSON parse error:', e);
            showToast('خطأ في قراءة استجابة السيرفر. قد تكون التذكرة أُنشئت بنجاح، يرجى التحقق من قائمة التذاكر.', 'error');
            return;
          }

          if (response.ok) {
            showToast('تم إنشاء الحدث العارض بنجاح', 'success');
            // انتظر قليلاً قبل إعادة التحميل ليرى المستخدم التوست
            setTimeout(() => {
              window.location.reload();
            }, 2000);
          } else {
            showToast(result.error || 'حدث خطأ أثناء إنشاء الحدث العارض', 'error');
          }
        } catch (error) {
          console.error('Error submitting OVR:', error);
            showToast(result.error || 'حدث خطأ أثناء إنشاء الحدث العارض', 'error');

        }
    });
});