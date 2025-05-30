// home.js
// Add JavaScript specific to the home page here

document.addEventListener('DOMContentLoaded', function() {
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


