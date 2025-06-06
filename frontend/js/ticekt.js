// scripts.js

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('ticketForm');
    const btnCancel = document.getElementById('btnCancel');
  
    // عند الضغط على زر "إلغاء / عودة"، نعيد المستخدم للصفحة السابقة
    btnCancel.addEventListener('click', () => {
      window.history.back();
    });
  
    // مثال بسيط على التحقق من صحة النموذج عند الإرسال
    form.addEventListener('submit', (e) => {
      e.preventDefault(); // لمنع الإرسال الفعلي (يمكن حذفه عند الربط بخادم حقيقي)
  
      // مثال: التحقق من أن تاريخ الحدث واضع وأقل من تاريخ اليوم
      const eventDate = document.getElementById('eventDate').value;
      if (!eventDate) {
        alert('يرجى اختيار تاريخ الحدث.');
        return;
      }
  
      // يمكن إضافة المزيد من التحقق هنا...
      // إذا كان كل شيء صحيح، يمكنك إرسال النموذج عبر Ajax أو إعادة التوجيه:
      // form.submit();
  
      alert('تم التحقق من جميع الحقول بنجاح! (هنا يمكنك إرسال البيانات فعليًا)');
    });
  });