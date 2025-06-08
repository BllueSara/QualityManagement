document.addEventListener('DOMContentLoaded', function() {
    const usernameSpan = document.getElementById('profile-username');
    const emailSpan = document.getElementById('profile-email');
    const logoutButton = document.getElementById('logout-button');

    // دالة لفك تشفير JWT والحصول على معلومات المستخدم
    function parseJwt(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (e) {
            console.error('Error parsing JWT:', e);
            return null;
        }
    }

    // جلب التوكن من localStorage
    const token = localStorage.getItem('token');

    if (token) {
        const user = parseJwt(token);
        if (user) {
            // عرض معلومات المستخدم (اسم المستخدم أو البريد الإلكتروني)
            // سنفترض أن التوكن يحتوي على 'email'، ويمكن إضافة 'username' إذا كان متاحاً في التوكن
            emailSpan.textContent = user.email || 'غير متاح';
            // إذا كان التوكن يحتوي على اسم المستخدم، يمكن عرضه هنا
            // usernameSpan.textContent = user.username || 'غير متاح';
            // بما أن الفورم لا يرسل username، سنعرض الإيميل كاسم مستخدم مؤقتاً أو نتركه فارغاً إذا لم يكن مطلوباً
            usernameSpan.textContent = user.email.split('@')[0] || 'غير متاح'; // عرض الجزء الأول من الإيميل كاسم مستخدم

        } else {
            // إذا كان التوكن غير صالح، توجيه المستخدم لصفحة تسجيل الدخول
            alert('جلسة غير صالحة. يرجى تسجيل الدخول مرة أخرى.');
            window.location.href = 'login.html';
        }
    } else {
        // إذا لم يكن هناك توكن، توجيه المستخدم لصفحة تسجيل الدخول
        alert('يرجى تسجيل الدخول أولاً.');
        window.location.href = 'login.html';
    }

    // التعامل مع زر تسجيل الخروج
    logoutButton.addEventListener('click', function() {
        localStorage.removeItem('token'); // حذف التوكن
        alert('تم تسجيل الخروج بنجاح.');
        window.location.href = 'login.html'; // التوجيه لصفحة تسجيل الدخول
    });
}); 