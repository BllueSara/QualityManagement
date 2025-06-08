document.addEventListener('DOMContentLoaded', function() {
    const registerForm = document.getElementById('registerForm');
    const departmentSelect = document.getElementById('reg-department');

    // دالة لجلب الأقسام من الباك اند وتعبئة قائمة الاختيار
    async function fetchDepartments() {
        try {
            const response = await fetch('http://localhost:3000/api/departments');
            const data = await response.json();

            if (response.ok) {
                // مسح الخيارات الحالية باستثناء الخيار الأول (اختر القسم)
                departmentSelect.innerHTML = '<option value="">اختر القسم</option>';
                // تعبئة قائمة الاختيار بالأقسام المسترجعة
                data.data.forEach(department => {
                    const option = document.createElement('option');
                    option.value = department.id; // قيمة الخيار ستكون رقم ID القسم
                    option.textContent = department.name; // النص الظاهر سيكون اسم القسم
                    departmentSelect.appendChild(option);
                });
            } else {
                console.error('فشل جلب الأقسام:', data.message);
                alert('حدث خطأ أثناء جلب الأقسام.');
            }
        } catch (error) {
            console.error('خطأ في الاتصال بجلب الأقسام:', error);
            alert('حدث خطأ في الاتصال بجلب الأقسام. يرجى التأكد من تشغيل الخادم.');
        }
    }

    // استدعاء الدالة عند تحميل الصفحة
    fetchDepartments();

    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // جمع البيانات من النموذج
        const formData = {
            username: document.getElementById('reg-username').value,
            email: document.getElementById('reg-email').value,
            password: document.getElementById('reg-password').value,
            department_id: departmentSelect.value // تم التعديل ليطابق الباك اند
        };

        console.log('بيانات النموذج المرسلة:', formData); // أضفت هذا السطر لتصحيح الأخطاء

        // التحقق من تطابق كلمتي المرور
        const confirmPassword = document.getElementById('reg-confirm-password').value;
        if (formData.password !== confirmPassword) {
            alert('كلمتا المرور غير متطابقتين');
            return;
        }

        try {
            // إرسال طلب التسجيل إلى الباك اند
            const response = await fetch('http://localhost:3000/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                // نجاح التسجيل
                alert(data.message);
                // حفظ التوكن في localStorage
                localStorage.setItem('token', data.token);
                // توجيه المستخدم إلى صفحة index.html
                window.location.href = 'index.html';
            } else {
                // عرض رسالة الخطأ
                alert(data.message);
            }
        } catch (error) {
            console.error('خطأ في التسجيل:', error);
            alert('حدث خطأ أثناء التسجيل. يرجى المحاولة مرة أخرى.');
        }
    });
}); 