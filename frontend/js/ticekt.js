// scripts.js

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('ticketForm');
    const btnCancel = document.getElementById('btnCancel');
    const reportingDeptSelect = document.getElementById('reportingDept');
    const respondingDeptSelect = document.getElementById('respondingDept');
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


    // أضف كل قسم للقائمتين
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
});


    // تحديث الترجمات بعد إضافة الخيارات
    updateModalTexts(localStorage.getItem('language') || 'ar');

  } catch (error) {
    console.error('Error loading departments:', error);
    alert('حدث خطأ أثناء تحميل الأقسام: ' + (error.message || error));
  }
}



    // Load departments when the page loads
    loadDepartments();

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
            alert('يرجى اختيار تاريخ الحدث.');
            return;
        }

        // التحقق من اختيار القسم
        const reportingDept = document.getElementById('reportingDept').value;
        const respondingDept = document.getElementById('respondingDept').value;
        if (!reportingDept || !respondingDept) {
            alert('يرجى اختيار القسم المبلغ والقسم المستجيب.');
            return;
        }

        // التحقق من اختيار نوع البلاغ
        const reportType = form.querySelector('input[name="reportType"]:checked');
        if (!reportType) {
            alert('يرجى اختيار نوع البلاغ.');
            return;
        }

        const checkboxes = form.querySelectorAll('input[type="checkbox"][name="classification"]');
        const anyChecked = Array.from(checkboxes).some(cb => cb.checked);
        if (!anyChecked) {
          alert('يرجى اختيار خيار واحد على الأقل');
          return;
        }

        // بعد: const formData = new FormData(form);

        // جمع بيانات النموذج
        const formData = new FormData(form);

        // الحقول المطلوبة
        formData.set('event_date', formData.get('eventDate'));
        formData.set('event_time', formData.get('eventTime'));
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
        formData.set('report_date', formData.get('reportDate'));
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
        formData.set('classification', JSON.stringify(classificationValues));
        formData.set('language', localStorage.getItem('language') || 'ar');

        try {
const response = await fetch(`${apiBase}/tickets`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                alert('تم إنشاء الحدث العارض بنجاح');
                  window.location.reload();

            } else {
                alert(result.error || 'حدث خطأ أثناء إنشاء الحدث العارض');
            }
        } catch (error) {
            console.error('Error submitting OVR:', error);
            alert('حدث خطأ أثناء إرسال الحدث العارض');
        }
    });
});