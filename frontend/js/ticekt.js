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

    // اطبع حالة الاستجابة
    console.log('Departments HTTP status:', response.status);

    // اقرأ JSON كامل
    const body = await response.json();
    console.log('Departments response body:', body);

    // تحقق من نجاح النداء
    if (!response.ok || body.status !== 'success') {
      throw new Error(body.message || `Response not OK (${response.status})`);
    }

    // استخرج المصفوفة من الحقل data
    const departments = body.data;

    // فرّغ الخيارات القديمة
    reportingDeptSelect.innerHTML = '<option value="" disabled selected>اختر القسم</option>';
    respondingDeptSelect.innerHTML = '<option value="" disabled selected>اختر القسم</option>';

    // أضف الأقسام الجديدة
    departments.forEach(dept => {
      const opt1 = document.createElement('option');
      opt1.value = dept.id;
      opt1.textContent = dept.name;
      reportingDeptSelect.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = dept.id;
      opt2.textContent = dept.name;
      respondingDeptSelect.appendChild(opt2);
    });

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
  const checkboxes = form.querySelectorAll('input[type="checkbox"][name="classification"]');
    const anyChecked = Array.from(checkboxes).some(cb => cb.checked);
    if (!anyChecked) {
      alert('يرجى اختيار خيار واحد على الأقل');
      return;
    }
// بعد: const formData = new FormData(form);

// Map fields one by one:

// جمع بيانات النموذج
const formData = new FormData(form);
formData.set('event_date', formData.get('eventDate'));
formData.set('event_time', formData.get('eventTime'));
formData.set('event_location', formData.get('eventLocation'));
formData.set('reporting_dept_id', formData.get('reportingDept'));
formData.set('responding_dept_id', formData.get('respondingDept'));
formData.set('other_depts', formData.get('otherDepts'));
formData.set('patient_name', formData.get('patientName'));
formData.set('medical_record_no', formData.get('medicalRecordNo'));
// … بعد formData.set('medical_record_no', …)


// جمع patient types
const patientTypeValues = Array.from(
  form.querySelectorAll('input[name="patientType"]:checked')
).map(cb => cb.value);
formData.set('patient_types', JSON.stringify(patientTypeValues));

formData.set('dob', formData.get('dob'));
formData.set('gender', formData.get('gender'));
formData.set('report_type', formData.get('reportType'));
formData.set('report_short_desc', formData.get('reportShortDesc'));
formData.set('event_description', formData.get('eventDescription'));
formData.set('reporter_name', formData.get('reporterName'));
formData.set('report_date', formData.get('reportDate'));
formData.set('reporter_position', formData.get('reporterPosition'));
formData.set('reporter_phone', formData.get('reporterPhone'));
formData.set('reporter_email', formData.get('reporterEmail'));
formData.set('actions_taken', formData.get('actionsTaken'));
formData.set('had_injury', formData.get('hadInjury'));
formData.set('injury_type', formData.get('injuryType'));
const classificationValues = Array.from(checkboxes)
  .filter(cb => cb.checked)
  .map(cb => cb.value);

// 2. خزنهم في FormData كسلسلة JSON
formData.set('classification', JSON.stringify(classificationValues));
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
                alert('تم إنشاء التذكرة بنجاح');
                  window.location.reload();

            } else {
                alert(result.error || 'حدث خطأ أثناء إنشاء التذكرة');
            }
        } catch (error) {
            console.error('Error submitting ticket:', error);
            alert('حدث خطأ أثناء إرسال التذكرة');
        }
    });
});