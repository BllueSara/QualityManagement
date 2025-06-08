// Data for the chart
const chartData = {
    labels: ['الأحد', 'السبت', 'الجمعة', 'الخميس', 'الأربعاء', 'الثلاثاء', 'الاثنين'],
    datasets: [{
        label: 'التذاكر المغلقة',
        backgroundColor: '#3a7ffb',
        borderColor: '#3a7ffb',
        borderWidth: 1,
        data: [55, 35, 80, 50, 70, 45, 65],
    }]
};

// Chart options
const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
        y: {
            beginAtZero: true,
            ticks: {
                callback: function(value) {
                    return value; // Display the raw value for Y-axis
                }
            },
            grid: {
                color: '#e0e0e0', // Light grey grid lines
                drawBorder: false,
            }
        },
        x: {
            grid: {
                display: false // No vertical grid lines
            }
        }
    },
    plugins: {
        legend: {
            display: false // Hide the legend for simplicity
        },
        tooltip: {
            rtl: true, // Enable RTL for tooltips
            callbacks: {
                title: function(context) {
                    return context[0].label;
                },
                label: function(context) {
                    return 'التذاكر المغلقة: ' + context.parsed.y;
                }
            }
        }
    }
};

// Get the context of the canvas element we want to draw into.
const ctx = document.getElementById('ticketsChart').getContext('2d');

// Create the chart
const ticketsChart = new Chart(ctx, {
    type: 'bar',
    data: chartData,
    options: chartOptions,
}); 