document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');

    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Here you would typically handle the login logic
        // For now, we'll just redirect to home page
        window.location.href = 'index.html';
    });
}); 