/**
 * script.js
 * ------------- 
 * منطق الفلترة والبحث في صفحة "سجلات النظام".
 * نفترض أن جدول السجلات محمّل مسبقًا في الذاكرة (DOM).
 */

document.addEventListener('DOMContentLoaded', () => {
    const applyFilterBtn = document.getElementById('apply-filter');
    const resetFilterBtn = document.getElementById('reset-filter');
    const fromDateInput = document.getElementById('from-date');
    const toDateInput = document.getElementById('to-date');
    const actionTypeSelect = document.getElementById('action-type');
    const userNameSelect = document.getElementById('user-name');
    const searchInput = document.getElementById('search-input');
    const logsBody = document.getElementById('logs-body');

    // Function to apply filters (placeholder for now)
    const applyFilters = () => {
        const fromDate = fromDateInput.value;
        const toDate = toDateInput.value;
        const actionType = actionTypeSelect.value;
        const userName = userNameSelect.value;
        const searchTerm = searchInput.value.toLowerCase();

        console.log('Applying Filters:');
        console.log('From Date:', fromDate);
        console.log('To Date:', toDate);
        console.log('Action Type:', actionType);
        console.log('User Name:', userName);
        console.log('Search Term:', searchTerm);

        // In a real application, you would filter the table rows here
        // For now, we just log the filter values.

        // Example: Filtering rows (simplified)
        const rows = logsBody.querySelectorAll('tr');
        rows.forEach(row => {
            const rowDate = row.dataset.date ? new Date(row.dataset.date) : null;
            const rowUser = row.dataset.user ? row.dataset.user.toLowerCase() : '';
            const rowAction = row.dataset.action ? row.dataset.action.toLowerCase() : '';
            const rowText = row.textContent.toLowerCase();

            let isVisible = true;

            // Date filter
            if (fromDate && rowDate && rowDate < new Date(fromDate)) {
                isVisible = false;
            }
            if (toDate && rowDate && rowDate > new Date(toDate)) {
                isVisible = false;
            }

            // Action Type filter
            if (actionType && rowAction !== actionType.toLowerCase()) {
                isVisible = false;
            }

            // User Name filter
            if (userName && rowUser !== userName.toLowerCase()) {
                isVisible = false;
            }

            // Search filter
            if (searchTerm && !rowText.includes(searchTerm)) {
                isVisible = false;
            }

            row.style.display = isVisible ? 'table-row' : 'none';
        });
    };

    // Function to reset filters
    const resetFilters = () => {
        fromDateInput.value = '';
        toDateInput.value = '';
        actionTypeSelect.value = '';
        userNameSelect.value = '';
        searchInput.value = '';
        applyFilters(); // Apply filters after resetting to show all rows
    };

    // Event Listeners
    applyFilterBtn.addEventListener('click', applyFilters);
    resetFilterBtn.addEventListener('click', resetFilters);

    // Initial filter application (to show all rows on page load)
    applyFilters();
});
