/**
 * Chart Visualization Module - Campus Expense Tracker
 * Renders Doughnut (Category) and Bar (Monthly Trend) charts using Chart.js
 */

const ChartManager = {
  chartInstance: null,
  trendChartInstance: null,

  // Color Palette mapping for expense categories
  categoryColors: {
    "Hostel": "#6366f1",
    "Mess/Food": "#ef4444",
    "Cafeteria": "#f97316",
    "Stationery": "#eab308",
    "Books": "#10b981",
    "Transportation": "#06b6d4",
    "Mobile Recharge": "#3b82f6",
    "Internet": "#8b5cf6",
    "Shopping": "#ec4899",
    "Entertainment": "#f43f5e",
    "Medical": "#14b8a6",
    "College Fees": "#64748b",
    "Miscellaneous": "#94a3b8"
  },

  renderExpenseChart(canvasId, categoryBreakdown, isDarkMode = false) {
    const canvasElement = document.getElementById(canvasId);
    if (!canvasElement) return;

    if (typeof Chart === 'undefined') {
      console.warn("Chart.js library is not loaded.");
      return;
    }

    // Destroy existing instance before re-rendering
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    if (!categoryBreakdown || categoryBreakdown.length === 0) {
      const ctx = canvasElement.getContext('2d');
      ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      canvasElement.parentElement.innerHTML = `
        <div class="empty-state-chart">
          <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" width="80" height="80">
            <circle cx="60" cy="60" r="55" stroke="currentColor" stroke-width="4" stroke-dasharray="12 6" opacity="0.2"/>
            <circle cx="60" cy="60" r="35" stroke="currentColor" stroke-width="4" opacity="0.15"/>
            <path d="M45 60 Q60 40 75 60 Q60 80 45 60Z" fill="currentColor" opacity="0.1"/>
            <text x="60" y="105" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.4">No data yet</text>
          </svg>
          <p>Add some expenses to see the chart</p>
        </div>
      `;
      return;
    }

    const labels = categoryBreakdown.map(item => item.name);
    const dataValues = categoryBreakdown.map(item => item.amount);
    const bgColors = categoryBreakdown.map(item => this.categoryColors[item.name] || "#94a3b8");

    const textColor = isDarkMode ? '#f1f5f9' : '#0f172a';
    const borderColor = isDarkMode ? '#1e293b' : '#ffffff';

    const ctx = canvasElement.getContext('2d');
    this.chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: dataValues,
          backgroundColor: bgColors,
          borderColor: borderColor,
          borderWidth: 2,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: textColor,
              font: { family: 'Inter', size: 12, weight: '500' },
              padding: 16,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
            titleColor: isDarkMode ? '#ffffff' : '#0f172a',
            bodyColor: isDarkMode ? '#cbd5e1' : '#475569',
            borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            borderWidth: 1,
            padding: 12,
            displayColors: true,
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.parsed || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = Math.round((value / total) * 100);
                return `${label}: ₹${value.toLocaleString()} (${percentage}%)`;
              }
            }
          }
        },
        cutout: '65%',
        animation: { animateScale: true, animateRotate: true, duration: 800 }
      }
    });
  },

  // Renders a 6-month income vs expense bar chart
  renderTrendChart(canvasId, trendData, isDarkMode = false) {
    const canvasElement = document.getElementById(canvasId);
    if (!canvasElement || typeof Chart === 'undefined') return;

    if (this.trendChartInstance) {
      this.trendChartInstance.destroy();
    }

    const textColor = isDarkMode ? '#94a3b8' : '#64748b';
    const gridColor = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

    const ctx = canvasElement.getContext('2d');
    this.trendChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: trendData.map(d => d.label),
        datasets: [
          {
            label: 'Expenses',
            data: trendData.map(d => d.spent),
            backgroundColor: 'rgba(239,68,68,0.75)',
            borderRadius: 6,
            borderSkipped: false,
            barPercentage: 0.55
          },
          {
            label: 'Income',
            data: trendData.map(d => d.income),
            backgroundColor: 'rgba(16,185,129,0.75)',
            borderRadius: 6,
            borderSkipped: false,
            barPercentage: 0.55
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: textColor,
              font: { family: 'Inter', size: 12, weight: '500' },
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 16
            }
          },
          tooltip: {
            backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
            titleColor: isDarkMode ? '#ffffff' : '#0f172a',
            bodyColor: isDarkMode ? '#cbd5e1' : '#475569',
            borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: ctx => ` ₹${ctx.parsed.y.toLocaleString('en-IN')}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: textColor, font: { size: 11 } }
          },
          y: {
            beginAtZero: true,
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              font: { size: 11 },
              callback: val => `₹${val.toLocaleString('en-IN')}`
            }
          }
        },
        animation: { duration: 700 }
      }
    });
  }
};
