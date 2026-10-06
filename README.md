# 🎓 Campus Expense Tracker

A modern, responsive web application designed for college students to track daily spending, monitor monthly budgets, view category analytics, and export financial reports.

![Campus Expense Tracker Banner](https://img.shields.io/badge/Status-Complete-success?style=for-the-badge) ![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white) ![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white) ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

---

## ✨ Features Overview

1. **Simulated Authentication (`index.html`)**:
   - Clean login portal storing session state in Local Storage.
   - Preserves user identity across sessions.

2. **Student Dashboard (`dashboard.html`)**:
   - Key metric cards: Total Income, Total Expenses, Remaining Balance, Monthly Budget.
   - Interactive Monthly Budget Progress Bar with 0-60% (Green), 60-90% (Yellow), and 90%+ (Red) status colors.
   - Budget Exceeded alert warning banner.
   - Recent 5 transactions list widget.
   - Editable monthly budget modal.

3. **Income & Expense Tracker (`transactions.html`)**:
   - Dedicated tabbed forms for Add Income & Add Expense.
   - Validates amounts, dates, required categories (Hostel, Mess/Food, Cafeteria, Books, Mobile Recharge, etc.) and payment modes (UPI, Cash, Debit Card, Net Banking).
   - Real-time search by transaction name, category, or income source.
   - Multi-criteria filter toolbar: Time range (Today, Week, Month, All), Type (Income/Expense), Category, Payment Mode.
   - Transaction History Data Table with pagination (10 entries/page) and confirmation before deletion.

4. **Analytics & PDF/CSV Reports (`reports.html`)**:
   - Key metrics: Most expensive category, total food expenses (Mess/Food + Cafeteria), current month spending, daily average spending, and income-to-expense ratio.
   - Interactive Chart.js category breakdown doughnut chart with hover labels and percentages.
   - PDF export via `jsPDF` library with formatted tables and student summary headers.
   - CSV spreadsheet download capabilities.

5. **Profile & Settings (`profile.html`)**:
   - Editable student details (Full name, email, phone, college name, year of study).
   - Currency symbol picker (`₹`, `$`, `€`, `£`).
   - Base64 avatar picture uploader with real-time preview.
   - Full data JSON backup download and complete account reset options.

6. **Dark / Light Mode & Responsive Design**:
   - Universal dark mode toggle with persistent state.
   - Glassmorphism UI styling with HSL color system and smooth micro-animations.
   - Responsive breakpoints for mobile (<480px), tablet (481-768px), and desktop (>768px).

---

## 📁 Project Structure

```
CampusExpenseTracker/
│
├── index.html                 # Login page
├── dashboard.html             # Main dashboard
├── transactions.html          # Add transaction & transaction history table
├── reports.html               # Analytics & PDF/CSV reports
├── profile.html               # User profile & account settings
│
├── css/
│   ├── style.css              # Global design system & theme variables
│   ├── dashboard.css          # Metric cards, progress bars & components
│   └── responsive.css         # Mobile/tablet/desktop breakpoints
│
├── js/
│   ├── app.js                 # Shared runtime, auth, forms, filters, PDF/CSV export
│   ├── budget.js              # Calculation engine & analytics algorithms
│   ├── chart.js               # Chart.js category doughnut chart module
│   └── storage.js             # Local Storage CRUD manager & initial demo dataset
│
└── README.md                  # Documentation
```

---

## 🚀 How to Run Locally

1. Clone or download this project folder.
2. Open `index.html` in any modern browser (Chrome, Firefox, Edge, Safari).
3. Log in with any student username (default demo user: `alex_student`).
4. Enjoy tracking your campus expenses!

---

## 🛠️ Tech Stack & CDN Dependencies

- **HTML5 & CSS3**: Vanilla CSS with custom properties (CSS variables) and Glassmorphism design tokens.
- **JavaScript (ES6+)**: Modular vanilla JavaScript with LocalStorage API.
- **FontAwesome 6.4.0**: Icons.
- **Chart.js**: Category pie/doughnut visualization.
- **jsPDF**: PDF report generation.
