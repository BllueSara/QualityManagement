document.addEventListener('DOMContentLoaded', function() {
    const registerForm = document.getElementById('registerForm');

    registerForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Here you would typically handle the registration logic
        // For now, we'll just redirect to home page
        window.location.href = 'index.html';
    });
}); 