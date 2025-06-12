// home.js
// Add JavaScript specific to the home page here

document.addEventListener('DOMContentLoaded', function() {
      const token = localStorage.getItem('token');
      console.log( token ? JSON.parse(atob(token.split('.')[1])) : 'no token' );

  if (!token) return;

  const { role } = JSON.parse(atob(token.split('.')[1]));
  const isAdmin = role === 'admin';

  // أخفِ كل العناصر المعلّمة بـ data-role="admin" إن لم يكن المستخدم Admin
  document.querySelectorAll('[data-role="admin"]').forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
  });
    // Get all clickable cards on the home page
    const cards = document.querySelectorAll('.cards-grid .card');

    // Add click event listener to each card
    cards.forEach(card => {
        card.addEventListener('click', function() {
            // Get the URL from the data-url attribute
            const url = this.getAttribute('data-url');

            // If a URL exists, navigate to it
            if (url) {
                window.location.href = url;
            }
        });
    });
});


