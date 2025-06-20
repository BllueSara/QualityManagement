document.addEventListener('DOMContentLoaded', function() {
    console.log('register.js script loaded and DOMContentLoaded event fired.');
    const registerForm = document.getElementById('registerForm');
    const departmentSelect = document.getElementById('reg-department');
    const usernameInput = document.getElementById('reg-username');
    const departmentGroup = departmentSelect.closest('.form-group');
    console.log('departmentSelect element:', departmentSelect);
    console.log('usernameInput element:', usernameInput);
    console.log('departmentGroup element:', departmentGroup);

    // عناصر النموذج المنبثق لإضافة قسم
    const addDepartmentModal = document.getElementById('addDepartmentModal');
    const saveAddDepartmentBtn = document.getElementById('saveAddDepartment');
    const cancelAddDepartmentBtn = document.getElementById('cancelAddDepartment');
    const departmentNameInput = document.getElementById('departmentName');
    const departmentImageInput = document.getElementById('departmentImage');
    const departmentNameArInput = document.getElementById('departmentNameAr');
const departmentNameEnInput = document.getElementById('departmentNameEn');


    // دالة لفتح المودال
    function openModal(modal) {
        modal.style.display = 'flex';
    }

    // دالة لإغلاق المودال
function closeModal(modal) {
    modal.style.display = 'none';
    departmentNameArInput.value = '';
    departmentNameEnInput.value = '';
    departmentImageInput.value = '';
}


    // إضافة مستمع حدث لحقل اسم المستخدم
    usernameInput.addEventListener('input', function() {
        const username = this.value.toLowerCase();
        if (username === 'admin') {
            departmentGroup.style.display = 'none'; // إخفاء مجموعة القسم
            departmentSelect.removeAttribute('required'); // إزالة السمة المطلوبة
            departmentSelect.value = ''; // مسح القيمة لضمان عدم إرسال department_id
        } else {
            departmentGroup.style.display = 'block'; // إظهار مجموعة القسم
            departmentSelect.setAttribute('required', 'required'); // إعادة السمة المطلوبة
        }
    });

    // دالة لجلب الأقسام من الباك اند وتعبئة قائمة الاختيار
async function fetchDepartments() {
  try {
    console.log('Attempting to fetch departments...');
    const token = localStorage.getItem('token');
    const response = await fetch('http://localhost:3006/api/departments', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();

    console.log('Departments API response:', data);

    if (response.ok) {
      const lang = localStorage.getItem('language') || 'ar';
      const selectDepartmentText = lang === 'ar' ? 'اختر القسم' : 'Select Department';

      departmentSelect.innerHTML = `<option value="">${selectDepartmentText}</option>`;

data.forEach(department => {
  const option = document.createElement('option');
  option.value = department.id;

  const lang = localStorage.getItem('language') || 'ar';
  let label = '';

  try {
    // جرّب تفكيك JSON إذا كان الاسم string
    const parsedName = typeof department.name === 'string'
      ? JSON.parse(department.name)
      : department.name;

    // إذا نجح التفكيك وطلع كائن، خذ الاسم حسب اللغة
    if (parsedName && typeof parsedName === 'object') {
      label = parsedName[lang] || parsedName.ar || parsedName.en || '';
    } else {
      // إذا مو كائن، خذه كما هو
      label = department.name;
    }
  } catch (e) {
    // إذا فشل JSON.parse، خذه كاسم عادي
    label = department.name;
  }

  option.textContent = label;
  departmentSelect.appendChild(option);
});




      const addNewOption = document.createElement('option');
      addNewOption.value = '__ADD_NEW_DEPARTMENT__';
      addNewOption.textContent = lang === 'ar' ? 'إضافة قسم جديد' : 'Add New Department';
      departmentSelect.appendChild(addNewOption);

      console.log('Departments dropdown populated successfully.');
    } else {
      console.error('فشل جلب الأقسام:', data.message);
      alert(data.message || 'حدث خطأ أثناء جلب الأقسام.');
    }
  } catch (error) {
    console.error('خطأ في الاتصال بجلب الأقسام:', error);
    alert('حدث خطأ في الاتصال بجلب الأقسام. يرجى التأكد من تشغيل الخادم.');
  }
}


    // استدعاء الدالة عند تحميل الصفحة
    fetchDepartments();

    // إعادة تعبئة القائمة عند تغيير اللغة
    window.addEventListener('storage', function(e) {
        if (e.key === 'language') {
            fetchDepartments();
        }
    });

    // معالجة حدث التغيير على القائمة المنسدلة للقسم
    departmentSelect.addEventListener('change', function() {
        console.log('Department select changed. New value:', this.value);
        if (this.value === '__ADD_NEW_DEPARTMENT__') {
            console.log('__ADD_NEW_DEPARTMENT__ selected. Attempting to open modal...');
            openModal(addDepartmentModal);
            // إعادة ضبط القائمة المنسدلة إلى "اختر القسم" بعد فتح المودال
            this.value = '';
            console.log('Modal should be open and dropdown reset.');
        }
    });

    // معالجة حفظ القسم الجديد من المودال
saveAddDepartmentBtn.addEventListener('click', async function () {
  const nameAr = departmentNameArInput.value.trim();
  const nameEn = departmentNameEnInput.value.trim();
  const imageFile = departmentImageInput.files[0];
  const token = localStorage.getItem('token');

  if (!nameAr || !nameEn || !imageFile) {
    alert('جميع الحقول مطلوبة (الاسمين + الصورة)');
    return;
  }

const formData = new FormData();
formData.append('name', JSON.stringify({ ar: nameAr, en: nameEn }));
formData.append('image', imageFile);


  try {
    const response = await fetch('http://localhost:3006/api/departments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const data = await response.json();

    if (response.ok) {
      alert(data.message);
      closeModal(addDepartmentModal);
      await fetchDepartments();

      const lang = localStorage.getItem('language') || 'ar';
      const options = departmentSelect.options;
      for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        const isMatch = opt.textContent.trim() === (lang === 'ar' ? nameAr : nameEn);
        if (isMatch) {
          departmentSelect.selectedIndex = i;
          break;
        }
      }
    } else {
      alert(data.message || 'حدث خطأ عند إضافة القسم.');
    }
  } catch (error) {
    console.error('خطأ في إضافة القسم:', error);
    alert('حدث خطأ في الاتصال.');
  }
});


    // معالجة إلغاء إضافة قسم من المودال
    cancelAddDepartmentBtn.addEventListener('click', () => {
        closeModal(addDepartmentModal);
        departmentSelect.value = ''; // إعادة ضبط القائمة المنسدلة
    });

    // إغلاق المودال عند النقر خارج المحتوى
    addDepartmentModal.addEventListener('click', function(event) {
        if (event.target === this) {
            closeModal(addDepartmentModal);
            departmentSelect.value = ''; // إعادة ضبط القائمة المنسدلة
        }
    });

    // تأكد من أن أيقونة السهم الأصلية (إن وجدت) مرئية ولا تتعارض مع الأنماط
    // هذه الأيقونة أزيلت من `input-icon-wrapper` في HTML، لذا هذا السطر قد لا يكون ضرورياً
    const selectArrowIcon = document.querySelector('.input-icon-wrapper .select-arrow-icon');
    if (selectArrowIcon) {
        selectArrowIcon.style.display = 'block'; // أو أي نمط مناسب لجعله مرئياً
    }

registerForm.addEventListener('submit', async function(e) {
  e.preventDefault();
  
  // جمع البيانات من النموذج
  const formData = {
    username: document.getElementById('reg-username').value.trim(),
    email:    document.getElementById('reg-email').value.trim(),
    password: document.getElementById('reg-password').value,
    department_id: departmentSelect.value,
    employee_number: document.getElementById('reg-employee').value.trim()  // ← هنا
  };

  // تحقق من القسم (مال admins)
  const username = formData.username.toLowerCase();
  if (username !== 'admin') {
    if (!formData.department_id || formData.department_id === '__ADD_NEW_DEPARTMENT__') {
      alert('الرجاء اختيار قسم أو إضافة قسم جديد.');
      return;
    }
  }

  // تحقق من تطابق كلمتي المرور
  const confirmPassword = document.getElementById('reg-confirm-password').value;
  if (formData.password !== confirmPassword) {
    alert('كلمتا المرور غير متطابقتين');
    return;
  }

  // **تحقق من وجود الرقم الوظيفي**
  if (!formData.employee_number) {
    alert('الرجاء إدخال الرقم الوظيفي.');
    return;
  }

  try {
    const response = await fetch('http://localhost:3006/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    const data = await response.json();

    if (response.ok) {
      alert(data.message);
      localStorage.setItem('token', data.token);
      window.location.href = 'index.html';
    } else {
      alert(data.message);
    }
  } catch (error) {
    console.error('خطأ في التسجيل:', error);
    alert('حدث خطأ أثناء التسجيل. يرجى المحاولة مرة أخرى.');
  }
});

});  