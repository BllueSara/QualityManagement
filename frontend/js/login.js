document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');

    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = {
            email: document.getElementById('email').value,
            password: document.getElementById('password').value
        };

        try {
            const response = await fetch('http://localhost:3006/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                alert(data.message);
                localStorage.setItem('token', data.token); // حفظ التوكن
                window.location.href = 'index.html'; // التوجيه إلى الصفحة الرئيسية
            } else {
                alert(data.message);
            }
        } catch (error) {
            console.error('خطأ في تسجيل الدخول:', error);
            alert('حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة مرة أخرى.');
        }
    });
}); 