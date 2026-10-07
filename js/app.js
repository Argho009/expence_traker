/**
 * Main Application Logic - Campus Expense Tracker
 * Coordinates Page UI, Navigation, Modals, Forms, Filters, Exports (PDF/CSV) & Notifications
 * Features: Edit Tx, Notes, Date Range Filter, Column Sort, Month Selector, Trend Chart,
 *           Forecast, Daily Budget, CSV Import, JSON Restore, Print CSS, Keyboard Shortcuts,
 *           Debounced Search, Empty State, Undo Delete
 */

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

const App = {
  currentPage: '',
  paginationState: {
    currentPage: 1,
    pageSize: 10,
    filteredTransactions: []
  },
  sortState: { column: 'date', direction: 'asc' },
  // Dashboard month selector state
  selectedYear: new Date().getFullYear(),
  selectedMonth: new Date().getMonth(),
  // Undo delete buffer
  _undoBuffer: null,
  _undoTimer: null,
  // Dirty form tracking
  _formDirty: false,

  init() {
    this.detectPage();
    this.applyTheme();
    this.checkAuth();
    this.setupGlobalEvents();
    this.setupKeyboardShortcuts();
    this.startLiveClock();

    switch (this.currentPage) {
      case 'index':
      case 'login':
        this.initLoginPage();
        break;
      case 'dashboard':
        this.initDashboardPage();
        break;
      case 'transactions':
      case 'past_months':
        this.initTransactionsPage();
        break;
      case 'reports':
        this.initReportsPage();
        break;
      case 'profile':
        this.initProfilePage();
        break;
    }
  },

  detectPage() {
    const path = window.location.pathname;
    const page = path.split('/').pop().replace('.html', '') || 'index';
    this.currentPage = page;
  },

  // Theme Toggle System
  applyTheme() {
    const theme = StorageManager.getTheme();
    if (theme === 'dark') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    this.updateThemeButtonUI(theme);
  },

  toggleTheme() {
    const currentTheme = StorageManager.getTheme();
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    StorageManager.setTheme(newTheme);
    this.applyTheme();
    if (this.currentPage === 'reports') {
      this.initReportsPage();
    }
  },

  updateThemeButtonUI(theme) {
    const btnIcon = document.querySelector('.theme-toggle-btn i');
    const btnText = document.querySelector('.theme-toggle-btn span');
    if (btnIcon && btnText) {
      if (theme === 'dark') {
        btnIcon.className = 'fas fa-sun';
        btnText.textContent = 'Light Mode';
      } else {
        btnIcon.className = 'fas fa-moon';
        btnText.textContent = 'Dark Mode';
      }
    }
  },

  // Auth Protection
  checkAuth() {
    const loggedIn = StorageManager.isLoggedIn();
    const isLoginPage = this.currentPage === 'index' || this.currentPage === 'login';

    if (!loggedIn && !isLoginPage) {
      window.location.href = 'index.html';
    } else if (loggedIn && isLoginPage) {
      window.location.href = 'dashboard.html';
    }

    if (loggedIn) {
      const user = StorageManager.getUser();
      const userNameEl = document.getElementById('header-user-name');
      const avatarEl = document.getElementById('header-user-avatar');
      if (userNameEl) userNameEl.textContent = user.fullName || user.username;
      if (avatarEl) {
        if (user.profilePicture) {
          avatarEl.innerHTML = `<img src="${user.profilePicture}" alt="Avatar">`;
        } else {
          avatarEl.textContent = (user.fullName || user.username).charAt(0).toUpperCase();
        }
      }
    }
  },

  // Toast Banners
  showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let iconClass = 'fa-check-circle';
    if (type === 'error') iconClass = 'fa-exclamation-circle';
    if (type === 'warning') iconClass = 'fa-exclamation-triangle';
    toast.innerHTML = `<i class="fas ${iconClass}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s reverse forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  // Undo Delete Toast
  showUndoToast(message, onUndo) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast warning undo-toast';
    toast.innerHTML = `
      <i class="fas fa-trash-alt"></i>
      <span>${message}</span>
      <button class="undo-btn" onclick="this.closest('.undo-toast')._undoCallback()">Undo</button>
    `;
    toast._undoCallback = () => {
      onUndo();
      clearTimeout(this._undoTimer);
      toast.style.animation = 'slideIn 0.3s reverse forwards';
      setTimeout(() => toast.remove(), 300);
    };
    container.appendChild(toast);

    this._undoTimer = setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s reverse forwards';
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  },

  // Global Events
  setupGlobalEvents() {
    const themeBtns = document.querySelectorAll('.theme-toggle-btn');
    themeBtns.forEach(btn => btn.addEventListener('click', () => this.toggleTheme()));

    const mobileNavToggle = document.querySelector('.mobile-nav-toggle');
    const sidebar = document.querySelector('.sidebar');
    if (mobileNavToggle && sidebar) {
      mobileNavToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
    }

    const logoutBtns = document.querySelectorAll('.logout-btn');
    logoutBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        StorageManager.logout();
        this.showToast("Logged out successfully");
        setTimeout(() => window.location.href = 'index.html', 500);
      });
    });
  },

  // ----------------------------------------------------------------
  // #13 Keyboard Shortcuts
  // ----------------------------------------------------------------
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      const tag = document.activeElement.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (this.currentPage === 'transactions') {
        if (e.key === 'e' || e.key === 'E') {
          document.getElementById('tab-add-expense')?.click();
          document.getElementById('expense-name')?.focus();
        }
        if (e.key === 'i' || e.key === 'I') {
          document.getElementById('tab-add-income')?.click();
          document.getElementById('income-amount')?.focus();
        }
        if (e.key === '/') {
          e.preventDefault();
          document.getElementById('search-query')?.focus();
        }
      }
    });
  },

  // ----------------------------------------------------------------
  // #12 Warn on unsaved form navigation
  // ----------------------------------------------------------------
  markFormDirty() {
    if (!this._formDirty) {
      this._formDirty = true;
      window.addEventListener('beforeunload', this._beforeUnloadHandler);
    }
  },

  clearFormDirty() {
    this._formDirty = false;
    window.removeEventListener('beforeunload', this._beforeUnloadHandler);
  },

  _beforeUnloadHandler(e) {
    e.preventDefault();
    e.returnValue = '';
  },

  // ----------------------------------------------------
  // Page 1: SIGN IN & SIGN UP PAGE LOGIC
  // ----------------------------------------------------
  initLoginPage() {
    const tabSignIn = document.getElementById('tab-signin');
    const tabSignUp = document.getElementById('tab-signup');
    const formSignIn = document.getElementById('signin-form');
    const formSignUp = document.getElementById('signup-form');
    const linkGotoSignUp = document.getElementById('link-goto-signup');
    const linkGotoSignIn = document.getElementById('link-goto-signin');

    const switchToSignIn = () => {
      if (tabSignIn && tabSignUp) {
        tabSignIn.classList.add('active');
        tabSignUp.classList.remove('active');
        if (formSignIn) formSignIn.style.display = 'block';
        if (formSignUp) formSignUp.style.display = 'none';
      }
    };

    const switchToSignUp = () => {
      if (tabSignIn && tabSignUp) {
        tabSignUp.classList.add('active');
        tabSignIn.classList.remove('active');
        if (formSignUp) formSignUp.style.display = 'block';
        if (formSignIn) formSignIn.style.display = 'none';
      }
    };

    if (tabSignIn) tabSignIn.addEventListener('click', switchToSignIn);
    if (tabSignUp) tabSignUp.addEventListener('click', switchToSignUp);
    if (linkGotoSignUp) linkGotoSignUp.addEventListener('click', switchToSignUp);
    if (linkGotoSignIn) linkGotoSignIn.addEventListener('click', switchToSignIn);

    if (formSignIn) {
      formSignIn.addEventListener('submit', async (e) => {
        e.preventDefault();
        const usernameInput = document.getElementById('signin-username');
        const passwordInput = document.getElementById('signin-password');
        const submitBtn = formSignIn.querySelector('button[type="submit"]');
        
        if (!usernameInput.value.trim()) {
          this.showToast("Please enter your username", "error");
          return;
        }

        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
        submitBtn.disabled = true;

        try {
          const res = await StorageManager.login(usernameInput.value.trim(), passwordInput.value);
          if (!res.success) {
            this.showToast(res.error || "Login failed", "error");
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            return;
          }
          this.showToast(`Signed in successfully! Welcome @${res.user.username}`, "success");
          setTimeout(() => { window.location.href = 'dashboard.html'; }, 600);
        } catch(err) {
          this.showToast("Network error. Please try again.", "error");
          submitBtn.innerHTML = originalText;
          submitBtn.disabled = false;
        }
      });
    }

    if (formSignUp) {
      formSignUp.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName = document.getElementById('signup-fullname').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const username = document.getElementById('signup-username').value.trim();
        const college = document.getElementById('signup-college').value.trim();
        const password = document.getElementById('signup-password').value;
        const budget = document.getElementById('signup-budget').value;
        const submitBtn = formSignUp.querySelector('button[type="submit"]');

        if (!fullName || !email || !username || !password) {
          this.showToast("Please fill in all required fields", "error");
          return;
        }

        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
        submitBtn.disabled = true;

        try {
          const res = await StorageManager.registerUser({
            fullName, email, username, password,
            collegeName: college || "Campus University",
            budget: parseFloat(budget) || 5000
          });

          if (!res.success) {
            this.showToast(res.error || "Signup failed", "error");
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            return;
          }

          this.showToast(`Account @${res.user.username} created successfully!`, "success");
          setTimeout(() => { window.location.href = 'dashboard.html'; }, 700);
        } catch(err) {
          this.showToast("Network error. Please try again.", "error");
          submitBtn.innerHTML = originalText;
          submitBtn.disabled = false;
        }
      });
    }
  },

  // ----------------------------------------------------
  // Page 2: DASHBOARD PAGE LOGIC
  // ----------------------------------------------------
  initDashboardPage() {
    // Initialize month to current
    const now = new Date();
    this.selectedYear = now.getFullYear();
    this.selectedMonth = now.getMonth();
    this.setupMonthSelector();
    this.renderDashboardMetrics();
    this.setupBudgetModal();
  },

  // #5 Month Selector
  setupMonthSelector() {
    const prevBtn = document.getElementById('dash-month-prev');
    const nextBtn = document.getElementById('dash-month-next');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (this.selectedMonth === 0) {
          this.selectedMonth = 11;
          this.selectedYear--;
        } else {
          this.selectedMonth--;
        }
        this.renderDashboardMetrics();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const now = new Date();
        if (this.selectedYear === now.getFullYear() && this.selectedMonth === now.getMonth()) return;
        if (this.selectedMonth === 11) {
          this.selectedMonth = 0;
          this.selectedYear++;
        } else {
          this.selectedMonth++;
        }
        this.renderDashboardMetrics();
      });
    }
  },

  renderDashboardMetrics() {
    const user = StorageManager.getUser();
    const budgetObj = StorageManager.getBudget();
    const transactions = StorageManager.getTransactions();
    const currency = user.currency || "₹";
    const yr = this.selectedYear;
    const mo = this.selectedMonth;

    // Update month label
    const monthLabelEl = document.getElementById('dash-month-label');
    if (monthLabelEl) {
      const d = new Date(yr, mo, 1);
      monthLabelEl.textContent = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    }

    // Summary for selected month
    const summary = BudgetEngine.calculateSummaryForMonth(transactions, yr, mo);

    // Update greeting
    const welcomeEl = document.getElementById('dash-welcome-name');
    if (welcomeEl) welcomeEl.textContent = user.fullName || user.username;

    const incomeEl = document.getElementById('total-income');
    const expenseEl = document.getElementById('total-expense');
    const upiEl = document.getElementById('upi-balance');
    const cashEl = document.getElementById('cash-balance');
    const balanceEl = document.getElementById('net-balance');
    const budgetEl = document.getElementById('monthly-budget-display');

    if (incomeEl) incomeEl.textContent = BudgetEngine.formatCurrency(summary.totalIncome, currency);
    if (expenseEl) expenseEl.textContent = BudgetEngine.formatCurrency(summary.totalExpense, currency);
    if (upiEl) upiEl.textContent = BudgetEngine.formatCurrency(summary.upiBalance, currency);
    if (cashEl) cashEl.textContent = BudgetEngine.formatCurrency(summary.cashBalance, currency);
    if (balanceEl) balanceEl.textContent = BudgetEngine.formatCurrency(summary.netBalance, currency);
    if (budgetEl) budgetEl.textContent = BudgetEngine.formatCurrency(budgetObj.monthlyBudget, currency);

    // Budget Progress Bar
    const budgetStatus = BudgetEngine.calculateBudgetStatus(budgetObj.monthlyBudget, summary.totalExpense);
    const progressFill = document.getElementById('budget-progress-fill');
    const progressText = document.getElementById('budget-progress-text');
    const alertBanner = document.getElementById('budget-alert-banner');

    if (progressFill) {
      progressFill.style.width = `${Math.min(budgetStatus.percent, 100)}%`;
      progressFill.className = `budget-bar-fill status-${budgetStatus.status}`;
    }
    if (progressText) {
      progressText.textContent = `${BudgetEngine.formatCurrency(budgetStatus.spent, currency)} / ${BudgetEngine.formatCurrency(budgetStatus.budget, currency)} (${budgetStatus.percent}%)`;
    }
    if (alertBanner) {
      if (budgetStatus.isExceeded) {
        alertBanner.style.display = 'flex';
        alertBanner.innerHTML = `<i class="fas fa-exclamation-triangle"></i> <div><strong>⚠ Budget Exceeded!</strong> You have spent ${BudgetEngine.formatCurrency(budgetStatus.spent, currency)} out of your ${BudgetEngine.formatCurrency(budgetStatus.budget, currency)} budget!</div>`;
      } else {
        alertBanner.style.display = 'none';
      }
    }

    // #7 Spending Forecast
    const forecast = BudgetEngine.calculateForecast(transactions, yr, mo);
    const forecastEl = document.getElementById('dash-forecast-value');
    const forecastSubEl = document.getElementById('dash-forecast-sub');
    if (forecastEl) {
      forecastEl.textContent = BudgetEngine.formatCurrency(forecast.projectedTotal, currency);
    }
    if (forecastSubEl) {
      const now = new Date();
      const isCurrent = yr === now.getFullYear() && mo === now.getMonth();
      forecastSubEl.textContent = isCurrent
        ? `${forecast.daysLeft} days left • ${BudgetEngine.formatCurrency(forecast.dailyAvg, currency)}/day avg`
        : `Actual: ${BudgetEngine.formatCurrency(forecast.totalSpent, currency)}`;
    }

    // #8 Daily Budget Limit
    const dailyLimit = BudgetEngine.calculateDailyLimit(budgetObj.monthlyBudget, yr, mo);
    const dailyLimitEl = document.getElementById('dash-daily-limit');
    if (dailyLimitEl) {
      dailyLimitEl.textContent = BudgetEngine.formatCurrency(dailyLimit, currency) + '/day';
    }

    // Recent 5 Transactions (for selected month)
    const monthTxs = transactions.filter(t => {
      const d = new Date(t.date || t.timestamp);
      return d.getFullYear() === yr && d.getMonth() === mo;
    });
    this.renderRecentTransactionsWidget(monthTxs.slice(0, 5), currency);
  },

  renderRecentTransactionsWidget(recentTxs, currency) {
    const container = document.getElementById('recent-transactions-list');
    if (!container) return;

    if (recentTxs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" width="60" height="60">
            <circle cx="40" cy="40" r="36" stroke="currentColor" stroke-width="3" stroke-dasharray="8 4" opacity="0.2"/>
            <path d="M26 40h28M40 26v28" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity="0.25"/>
          </svg>
          <p>No transactions this month.</p>
          <a href="transactions.html" class="btn btn-primary" style="font-size:0.85rem; padding:0.5rem 1rem; margin-top:0.5rem;">Add Transaction</a>
        </div>`;
      return;
    }

    container.innerHTML = recentTxs.map(t => {
      const isIncome = t.type === 'income';
      const icon = isIncome ? 'fa-arrow-down' : 'fa-shopping-bag';
      const iconClass = isIncome ? 'income' : 'expense';
      const amountPrefix = isIncome ? '+' : '-';
      const dateStr = this.formatDisplayDateTime(t.date, t.time, t.timestamp);

      return `
        <div class="transaction-item">
          <div class="trans-left">
            <div class="trans-icon metric-card ${iconClass}">
              <i class="fas ${icon}"></i>
            </div>
            <div class="trans-info">
              <div class="trans-name">${this._escHtml(t.name || t.source)}</div>
              <div class="trans-meta">
                <span class="badge badge-${iconClass}">${this._escHtml(t.category || t.source || 'General')}</span>
                <span>• ${dateStr}</span>
                ${t.paymentMode ? `<span>• ${this._escHtml(t.paymentMode)}</span>` : ''}
              </div>
              ${t.notes ? `<div class="trans-notes">${this._escHtml(t.notes)}</div>` : ''}
            </div>
          </div>
          <div class="trans-right">
            <div class="trans-amount ${iconClass}">${amountPrefix}${BudgetEngine.formatCurrency(t.amount, currency)}</div>
          </div>
        </div>
      `;
    }).join('');
  },

  setupBudgetModal() {
    const editBtn = document.getElementById('edit-budget-btn');
    const modalBackdrop = document.getElementById('budget-modal');
    const closeBtn = document.getElementById('close-budget-modal');
    const form = document.getElementById('budget-form');
    const input = document.getElementById('budget-amount-input');

    if (editBtn && modalBackdrop) {
      editBtn.addEventListener('click', () => {
        const currentBudget = StorageManager.getBudget().monthlyBudget;
        if (input) input.value = currentBudget;
        modalBackdrop.classList.add('active');
      });
    }
    if (closeBtn && modalBackdrop) {
      closeBtn.addEventListener('click', () => modalBackdrop.classList.remove('active'));
    }
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const val = parseFloat(input.value);
        if (isNaN(val) || val < 100) {
          this.showToast("Please enter a valid monthly budget (Min ₹100)", "error");
          return;
        }
        StorageManager.setBudget(val);
        modalBackdrop.classList.remove('active');
        this.showToast("Monthly budget updated successfully!");
        this.renderDashboardMetrics();
      });
    }
  },

  // ----------------------------------------------------
  // Page 3: TRANSACTIONS & HISTORY PAGE LOGIC
  // ----------------------------------------------------
  getTodayDateValue() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  },

  getCurrentTimeValue() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  },

  formatDisplayDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  },

  formatDisplayDateTime(dateString, timeString, timestamp) {
    let formattedDate = '';
    if (dateString) {
      const parts = dateString.split('-');
      if (parts.length === 3) {
        formattedDate = `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
      } else {
        formattedDate = dateString;
      }
    }

    let formattedTime = '';
    if (timeString) {
      const timeParts = timeString.split(':');
      const h = parseInt(timeParts[0], 10);
      const m = parseInt(timeParts[1] || '0', 10);
      if (!isNaN(h) && !isNaN(m)) {
        const period = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        formattedTime = `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
      }
    }

    if (!formattedTime && timestamp) {
      const d = new Date(timestamp);
      if (!isNaN(d.getTime())) {
        const h = d.getHours();
        const m = d.getMinutes();
        const period = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        formattedTime = `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
        if (!formattedDate) {
          formattedDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        }
      }
    }

    if (formattedDate && formattedTime) return `${formattedDate}, ${formattedTime}`;
    return formattedDate || formattedTime || 'N/A';
  },

  getTxTimestamp(t) {
    if (!t) return 0;
    if (t.date) {
      const timePart = t.time || '12:00';
      const parsed = new Date(`${t.date}T${timePart}:00`).getTime();
      if (!isNaN(parsed)) return parsed;
    }
    if (t.timestamp) {
      const ts = typeof t.timestamp === 'number' ? t.timestamp : new Date(t.timestamp).getTime();
      if (!isNaN(ts)) return ts;
    }
    return 0;
  },

  updateLiveClock() {
    const dateParts = document.querySelectorAll('.live-clock-badge .clock-date-part');
    const timeParts = document.querySelectorAll('.live-clock-badge .clock-time-part');
    if (dateParts.length === 0 && timeParts.length === 0) return;

    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthStr = monthNames[now.getMonth()];
    const year = now.getFullYear();

    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const hoursStr = String(hours).padStart(2, '0');

    const dateText = `${day} ${monthStr} ${year}`;
    const timeText = `${hoursStr}:${minutes} ${period}`;

    dateParts.forEach(el => { el.textContent = dateText; });
    timeParts.forEach(el => { el.textContent = timeText; });
  },

  startLiveClock() {
    this.updateLiveClock();
    if (!this._clockInterval) {
      this._clockInterval = setInterval(() => this.updateLiveClock(), 1000);
    }
  },

  // #14 Debounce helper
  _debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  // XSS escape helper
  _escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  initTransactionsPage() {
    this.setupTransactionForms();
    this.setupFiltersAndSearch();
    this.renderTransactionsTable();
    this.setupEditModal();
  },

  setupTransactionForms() {
    const tabIncome = document.getElementById('tab-add-income');
    const tabExpense = document.getElementById('tab-add-expense');
    const formIncome = document.getElementById('form-add-income');
    const formExpense = document.getElementById('form-add-expense');
    const incomeDate = document.getElementById('income-date');
    const expenseDate = document.getElementById('expense-date');
    const todayStr = this.getTodayDateValue();

    if (tabIncome && tabExpense) {
      tabIncome.addEventListener('click', () => {
        tabIncome.classList.add('active');
        tabExpense.classList.remove('active');
        if (incomeDate) incomeDate.value = this.getTodayDateValue();
        if (formIncome) formIncome.style.display = 'block';
        if (formExpense) formExpense.style.display = 'none';
      });
      tabExpense.addEventListener('click', () => {
        tabExpense.classList.add('active');
        tabIncome.classList.remove('active');
        if (expenseDate) expenseDate.value = this.getTodayDateValue();
        if (formExpense) formExpense.style.display = 'block';
        if (formIncome) formIncome.style.display = 'none';
      });
    }

    if (incomeDate) incomeDate.value = todayStr;
    if (expenseDate) expenseDate.value = todayStr;

    // Mark forms dirty on input (feature #12)
    [formIncome, formExpense].forEach(form => {
      if (form) {
        form.addEventListener('input', () => this.markFormDirty(), { once: true });
      }
    });

    // Income Form Submit
    if (formIncome) {
      formIncome.addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = parseFloat(document.getElementById('income-amount').value);
        const source = document.getElementById('income-source').value;
        const otherSource = document.getElementById('income-other-source')?.value;
        const date = document.getElementById('income-date').value;
        const paymentMode = document.getElementById('income-payment-mode').value;
        const notes = document.getElementById('income-notes')?.value.trim() || '';

        if (isNaN(amount) || amount <= 0) {
          this.showToast("Please enter a valid positive income amount", "error");
          return;
        }

        const finalSource = (source === 'Other' && otherSource) ? otherSource : source;
        const currentTime = this.getCurrentTimeValue();
        const txDate = date || todayStr;
        const fullTimestamp = new Date(`${txDate}T${currentTime}:00`).getTime() || Date.now();

        StorageManager.addTransaction({
          type: 'income', name: finalSource, source: finalSource,
          amount, date: txDate, time: currentTime, timestamp: fullTimestamp,
          category: null, paymentMode, notes
        });

        this.showToast("Income added successfully!");
        this.clearFormDirty();
        formIncome.reset();
        if (incomeDate) incomeDate.value = todayStr;
        this.renderTransactionsTable();
      });
    }

    // Expense Form Submit
    if (formExpense) {
      formExpense.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('expense-name').value.trim();
        const amount = parseFloat(document.getElementById('expense-amount').value);
        const category = document.getElementById('expense-category').value;
        const date = document.getElementById('expense-date').value;
        const paymentMode = document.getElementById('expense-payment-mode').value;
        const notes = document.getElementById('expense-notes')?.value.trim() || '';

        if (!name) { this.showToast("Please enter transaction name", "error"); return; }
        if (isNaN(amount) || amount <= 0) { this.showToast("Please enter a valid positive amount", "error"); return; }
        if (!category) { this.showToast("Please select an expense category", "error"); return; }

        const currentTime = this.getCurrentTimeValue();
        const txDate = date || todayStr;
        const fullTimestamp = new Date(`${txDate}T${currentTime}:00`).getTime() || Date.now();

        StorageManager.addTransaction({
          type: 'expense', name, amount, category,
          date: txDate, time: currentTime, timestamp: fullTimestamp,
          paymentMode, notes
        });

        this.showToast("Expense recorded successfully!");
        this.clearFormDirty();
        formExpense.reset();
        if (expenseDate) expenseDate.value = todayStr;
        this.renderTransactionsTable();

        const budget = StorageManager.getBudget().monthlyBudget;
        const allTxs = StorageManager.getTransactions();
        const now = new Date();
        const monthExpense = allTxs.filter(t => {
          const d = new Date(t.date || t.timestamp);
          return t.type === 'expense' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
        if (monthExpense > budget) {
          this.showToast("⚠ Warning: This month's expenses exceeded your budget!", "warning");
        }
      });
    }
  },

  setupFiltersAndSearch() {
    const searchInput = document.getElementById('search-query');
    const filterTime = document.getElementById('filter-time-range');
    const filterType = document.getElementById('filter-type');
    const filterCategory = document.getElementById('filter-category');
    const filterPayment = document.getElementById('filter-payment');
    const filterDateFrom = document.getElementById('filter-date-from');
    const filterDateTo = document.getElementById('filter-date-to');
    const clearBtn = document.getElementById('clear-filters-btn');

    const updateFilter = () => {
      this.paginationState.currentPage = 1;
      this.renderTransactionsTable();
    };

    // #14 Debounce search
    if (searchInput) searchInput.addEventListener('input', this._debounce(updateFilter, 300));
    if (filterTime) filterTime.addEventListener('change', updateFilter);
    if (filterType) filterType.addEventListener('change', updateFilter);
    if (filterCategory) filterCategory.addEventListener('change', updateFilter);
    if (filterPayment) filterPayment.addEventListener('change', updateFilter);
    if (filterDateFrom) filterDateFrom.addEventListener('change', updateFilter);
    if (filterDateTo) filterDateTo.addEventListener('change', updateFilter);

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        if (filterTime) filterTime.value = 'all';
        if (filterType) filterType.value = 'all';
        if (filterCategory) filterCategory.value = 'all';
        if (filterPayment) filterPayment.value = 'all';
        if (filterDateFrom) filterDateFrom.value = '';
        if (filterDateTo) filterDateTo.value = '';
        const archiveMonth = document.getElementById('filter-archive-month');
        const archiveYear = document.getElementById('filter-archive-year');
        if (archiveMonth) archiveMonth.value = 'all';
        if (archiveYear) archiveYear.value = 'all';
        updateFilter();
      });
    }

    const archiveMonth = document.getElementById('filter-archive-month');
    const archiveYear = document.getElementById('filter-archive-year');
    if (archiveMonth) archiveMonth.addEventListener('change', updateFilter);
    if (archiveYear) archiveYear.addEventListener('change', updateFilter);
  },

  getFilteredTransactions() {
    let list = StorageManager.getTransactions();

    const searchInput = document.getElementById('search-query')?.value.toLowerCase().trim();
    const filterTime = document.getElementById('filter-time-range')?.value;
    const filterType = document.getElementById('filter-type')?.value;
    const filterCategory = document.getElementById('filter-category')?.value;
    const filterPayment = document.getElementById('filter-payment')?.value;
    const filterDateFrom = document.getElementById('filter-date-from')?.value;
    const filterDateTo = document.getElementById('filter-date-to')?.value;

    if (searchInput) {
      list = list.filter(t => {
        const nameMatch = (t.name || '').toLowerCase().includes(searchInput);
        const sourceMatch = (t.source || '').toLowerCase().includes(searchInput);
        const catMatch = (t.category || '').toLowerCase().includes(searchInput);
        const notesMatch = (t.notes || '').toLowerCase().includes(searchInput);
        return nameMatch || sourceMatch || catMatch || notesMatch;
      });
    }

    if (filterType && filterType !== 'all') list = list.filter(t => t.type === filterType);
    if (filterCategory && filterCategory !== 'all') list = list.filter(t => t.category === filterCategory);
    if (filterPayment && filterPayment !== 'all') list = list.filter(t => t.paymentMode === filterPayment);

    // #3 Custom date range filter
    if (filterDateFrom) {
      list = list.filter(t => t.date >= filterDateFrom);
    }
    if (filterDateTo) {
      list = list.filter(t => t.date <= filterDateTo);
    }

    // Preset time range (only if no custom date range set)
    if (filterTime && filterTime !== 'all' && !filterDateFrom && !filterDateTo) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      list = list.filter(t => {
        const tDate = new Date(t.date || t.timestamp).getTime();
        if (filterTime === 'today') return tDate >= today;
        if (filterTime === 'week') return tDate >= today - (7 * 24 * 60 * 60 * 1000);
        if (filterTime === 'month') return tDate >= new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        return true;
      });
    }

    // Archive specific filter for Past Months
    const filterArchiveMonth = document.getElementById('filter-archive-month')?.value;
    const filterArchiveYear = document.getElementById('filter-archive-year')?.value;
    
    if (filterArchiveMonth && filterArchiveMonth !== 'all') {
      list = list.filter(t => t.date && t.date.split('-')[1] === filterArchiveMonth);
    }
    if (filterArchiveYear && filterArchiveYear !== 'all') {
      list = list.filter(t => t.date && t.date.split('-')[0] === filterArchiveYear);
    }

    // #4 Column sort
    const { column, direction } = this.sortState;
    list = [...list].sort((a, b) => {
      let valA, valB;
      if (column === 'amount') {
        valA = parseFloat(a.amount) || 0;
        valB = parseFloat(b.amount) || 0;
      } else if (column === 'date') {
        valA = this.getTxTimestamp(a);
        valB = this.getTxTimestamp(b);
      } else if (column === 'name') {
        valA = (a.name || a.source || '').toLowerCase();
        valB = (b.name || b.source || '').toLowerCase();
      } else {
        valA = (a[column] || '').toLowerCase();
        valB = (b[column] || '').toLowerCase();
      }
      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  },

  // #4 Sort column toggle
  sortBy(column) {
    if (this.sortState.column === column) {
      this.sortState.direction = this.sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortState.column = column;
      this.sortState.direction = 'asc';
    }
    this.renderTransactionsTable();
  },

  renderTransactionsTable() {
    const tableBody = document.getElementById('transactions-table-body');
    if (!tableBody) return;

    const currency = StorageManager.getUser().currency || '₹';
    const filtered = this.getFilteredTransactions();
    this.paginationState.filteredTransactions = filtered;

    const totalItems = filtered.length;
    const pageSize = this.paginationState.pageSize;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;

    if (this.paginationState.currentPage > totalPages) {
      this.paginationState.currentPage = totalPages;
    }

    const startIndex = (this.paginationState.currentPage - 1) * pageSize;
    const paginatedItems = filtered.slice(startIndex, startIndex + pageSize);

    // Update sort indicator icons
    ['name', 'amount', 'date', 'category', 'paymentMode'].forEach(col => {
      const th = document.querySelector(`[data-sort="${col}"]`);
      if (th) {
        const icon = th.querySelector('.sort-icon');
        if (icon) {
          if (this.sortState.column === col) {
            icon.className = `sort-icon fas fa-sort-${this.sortState.direction === 'asc' ? 'up' : 'down'} active`;
          } else {
            icon.className = 'sort-icon fas fa-sort';
          }
        }
      }
    });

    if (paginatedItems.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 3rem; color: var(--text-muted);">
            <div class="empty-state">
              <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" width="60" height="60">
                <rect x="12" y="20" width="56" height="44" rx="6" stroke="currentColor" stroke-width="3" opacity="0.2"/>
                <path d="M12 32h56" stroke="currentColor" stroke-width="3" opacity="0.2"/>
                <path d="M26 50h28M26 42h16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity="0.2"/>
              </svg>
              <p>No transactions match your filters.</p>
            </div>
          </td>
        </tr>`;
    } else {
      tableBody.innerHTML = paginatedItems.map(t => {
        const isIncome = t.type === 'income';
        const badgeClass = isIncome ? 'badge-income' : 'badge-expense';
        const amountClass = isIncome ? 'income' : 'expense';
        const prefix = isIncome ? '+' : '-';

        return `
          <tr>
            <td data-label="Type"><span class="badge ${badgeClass}">${t.type}</span></td>
            <td data-label="Name / Source">
              <strong>${this._escHtml(t.name || t.source)}</strong>
              ${t.notes ? `<div class="trans-notes-cell">${this._escHtml(t.notes)}</div>` : ''}
            </td>
            <td data-label="Amount" class="trans-amount ${amountClass}">${prefix}${BudgetEngine.formatCurrency(t.amount, currency)}</td>
            <td data-label="Category">${this._escHtml(t.category || t.source || 'General')}</td>
            <td data-label="Date &amp; Time">${this.formatDisplayDateTime(t.date, t.time, t.timestamp)}</td>
            <td data-label="Payment Mode">${this._escHtml(t.paymentMode || 'N/A')}</td>
            <td data-label="Notes">${t.notes ? `<span class="notes-pill" title="${this._escHtml(t.notes)}"><i class="fas fa-sticky-note"></i></span>` : ''}</td>
            <td data-label="Actions">
              <div class="table-actions">
                <button class="btn btn-secondary btn-icon" onclick="App.openEditModal('${t.id}')" title="Edit">
                  <i class="fas fa-pencil-alt" style="color:var(--primary-color)"></i>
                </button>
                <button class="btn btn-secondary btn-icon" onclick="App.deleteTransaction('${t.id}')" title="Delete">
                  <i class="fas fa-trash-alt" style="color:var(--danger-color)"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    this.renderPaginationControls(totalPages, totalItems);
  },

  renderPaginationControls(totalPages, totalItems) {
    const wrapper = document.getElementById('pagination-controls');
    if (!wrapper) return;
    wrapper.innerHTML = `
      <div style="font-size:0.875rem; color:var(--text-muted)">
        Showing ${totalItems > 0 ? (this.paginationState.currentPage - 1) * this.paginationState.pageSize + 1 : 0}
        to ${Math.min(this.paginationState.currentPage * this.paginationState.pageSize, totalItems)} of ${totalItems} entries
      </div>
      <div style="display:flex; gap:0.5rem;">
        <button class="btn btn-secondary" ${this.paginationState.currentPage === 1 ? 'disabled' : ''} onclick="App.changePage(-1)">
          Previous
        </button>
        <button class="btn btn-secondary" ${this.paginationState.currentPage === totalPages || totalItems === 0 ? 'disabled' : ''} onclick="App.changePage(1)">
          Next
        </button>
      </div>
    `;
  },

  changePage(direction) {
    this.paginationState.currentPage += direction;
    this.renderTransactionsTable();
  },

  // #16 Undo Delete
  deleteTransaction(id) {
    if (confirm("Are you sure you want to delete this transaction entry?")) {
      const txs = StorageManager.getTransactions();
      const deletedTx = txs.find(t => t.id === id);
      StorageManager.deleteTransaction(id);
      this.renderTransactionsTable();
      if (deletedTx) {
        this.showUndoToast("Transaction deleted", () => {
          StorageManager.addTransaction(deletedTx);
          this.renderTransactionsTable();
          this.showToast("Transaction restored!", "success");
        });
      }
    }
  },

  // ----------------------------------------------------------------
  // #1 Edit Transaction Modal
  // ----------------------------------------------------------------
  setupEditModal() {
    const closeBtn = document.getElementById('close-edit-modal');
    const modal = document.getElementById('edit-tx-modal');
    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => modal.classList.remove('active'));
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
      });
    }

    const form = document.getElementById('edit-tx-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-tx-id').value;
        const type = document.getElementById('edit-tx-type').value;
        const name = document.getElementById('edit-tx-name').value.trim();
        const amount = parseFloat(document.getElementById('edit-tx-amount').value);
        const category = document.getElementById('edit-tx-category').value;
        const date = document.getElementById('edit-tx-date').value;
        const time = document.getElementById('edit-tx-time').value;
        const paymentMode = document.getElementById('edit-tx-payment').value;
        const notes = document.getElementById('edit-tx-notes').value.trim();

        if (!name) { this.showToast("Name is required", "error"); return; }
        if (isNaN(amount) || amount <= 0) { this.showToast("Enter a valid amount", "error"); return; }

        StorageManager.updateTransaction(id, { type, name, amount, category, date, time, paymentMode, notes });
        document.getElementById('edit-tx-modal')?.classList.remove('active');
        this.showToast("Transaction updated successfully!");
        this.renderTransactionsTable();
      });
    }
  },

  openEditModal(id) {
    const txs = StorageManager.getTransactions();
    const t = txs.find(tx => tx.id === id);
    if (!t) return;

    document.getElementById('edit-tx-id').value = t.id;
    document.getElementById('edit-tx-type').value = t.type;
    document.getElementById('edit-tx-name').value = t.name || t.source || '';
    document.getElementById('edit-tx-amount').value = t.amount;
    document.getElementById('edit-tx-category').value = t.category || '';
    document.getElementById('edit-tx-date').value = t.date || '';
    document.getElementById('edit-tx-time').value = t.time || '';
    document.getElementById('edit-tx-payment').value = t.paymentMode || 'UPI';
    document.getElementById('edit-tx-notes').value = t.notes || '';

    const isPastMonths = this.currentPage === 'past_months';
    document.getElementById('edit-tx-type').disabled = isPastMonths;
    document.getElementById('edit-tx-name').disabled = isPastMonths;
    document.getElementById('edit-tx-amount').disabled = isPastMonths;
    document.getElementById('edit-tx-date').disabled = isPastMonths;
    document.getElementById('edit-tx-time').disabled = isPastMonths;
    document.getElementById('edit-tx-payment').disabled = isPastMonths;

    const typeLabel = document.getElementById('edit-tx-type-label');
    if (typeLabel) typeLabel.textContent = t.type === 'income' ? 'Income' : 'Expense';

    const catGroup = document.getElementById('edit-tx-category-group');
    if (catGroup) catGroup.style.display = t.type === 'expense' ? 'block' : 'none';

    document.getElementById('edit-tx-modal')?.classList.add('active');
  },

  // ----------------------------------------------------
  // Page 4: REPORTS & ANALYTICS PAGE LOGIC
  // ----------------------------------------------------
  initReportsPage() {
    const user = StorageManager.getUser();
    const budget = StorageManager.getBudget().monthlyBudget;
    const transactions = StorageManager.getTransactions();
    const currency = user.currency || "₹";
    const isDark = document.body.classList.contains('dark-mode');

    const analytics = BudgetEngine.calculateAnalytics(transactions, budget);

    const mostExpEl = document.getElementById('analytic-most-expensive');
    const foodEl = document.getElementById('analytic-food-total');
    const monthlySpendingEl = document.getElementById('analytic-monthly-spending');
    const dailyAvgEl = document.getElementById('analytic-daily-avg');
    const ratioEl = document.getElementById('analytic-ratio');

    if (mostExpEl) mostExpEl.textContent = `${analytics.mostExpensiveCategory.name} (${BudgetEngine.formatCurrency(analytics.mostExpensiveCategory.amount, currency)})`;
    if (foodEl) foodEl.textContent = BudgetEngine.formatCurrency(analytics.totalFoodExpenses, currency);
    if (monthlySpendingEl) monthlySpendingEl.textContent = BudgetEngine.formatCurrency(analytics.monthlySpending, currency);
    if (dailyAvgEl) dailyAvgEl.textContent = `${BudgetEngine.formatCurrency(analytics.dailyAverageSpending, currency)}/day`;
    if (ratioEl) ratioEl.textContent = `${analytics.incomeVsExpenseRatio}x`;

    // Doughnut chart
    ChartManager.renderExpenseChart('category-chart-canvas', analytics.categoryBreakdown, isDark);

    // #6 Monthly Trend Bar Chart
    const trendData = BudgetEngine.getMonthlyTrend(transactions, 12);
    ChartManager.renderTrendChart('trend-chart-canvas', trendData, isDark);

    // Export buttons
    const exportPdfBtn = document.getElementById('export-pdf-btn');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const printBtn = document.getElementById('print-report-btn');

    if (exportPdfBtn) exportPdfBtn.onclick = () => this.exportToPDF(analytics, transactions, user);
    if (exportCsvBtn) exportCsvBtn.onclick = () => this.exportToCSV(transactions);
    // #11 Print
    if (printBtn) printBtn.onclick = () => window.print();
  },

  exportToPDF(analytics, transactions, user) {
    if (typeof window.jspdf === 'undefined' && typeof window.jsPDF === 'undefined') {
      window.print();
      return;
    }

    const { jsPDF } = window.jspdf || window;
    const doc = new jsPDF();
    const currency = user.currency || "₹";

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("Campus Expense Tracker - Monthly Financial Report", 14, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Student: ${user.fullName || user.username} (${user.collegeName || 'N/A'})`, 14, 28);
    doc.text(`Generated Date: ${this.formatDisplayDate(new Date().toISOString().split('T')[0])}`, 14, 34);

    doc.setLineWidth(0.5);
    doc.line(14, 38, 196, 38);

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Financial Summary", 14, 48);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Monthly Spending: ${BudgetEngine.formatCurrency(analytics.monthlySpending, currency)}`, 14, 56);
    doc.text(`Daily Average Spending: ${BudgetEngine.formatCurrency(analytics.dailyAverageSpending, currency)}`, 14, 62);
    doc.text(`Most Expensive Category: ${analytics.mostExpensiveCategory.name}`, 14, 68);
    doc.text(`Total Food & Cafeteria Expense: ${BudgetEngine.formatCurrency(analytics.totalFoodExpenses, currency)}`, 14, 74);

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Transactions Log", 14, 88);

    let y = 96;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Type", 14, y);
    doc.text("Name", 38, y);
    doc.text("Category", 85, y);
    doc.text("Date & Time", 125, y);
    doc.text("Amount", 175, y);
    doc.line(14, y + 2, 196, y + 2);

    y += 8;
    doc.setFont("helvetica", "normal");
    transactions.slice(0, 20).forEach(t => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(t.type.toUpperCase(), 14, y);
      doc.text((t.name || t.source || '').substring(0, 20), 38, y);
      doc.text((t.category || t.source || 'General').substring(0, 18), 85, y);
      doc.text(this.formatDisplayDateTime(t.date, t.time, t.timestamp) || '', 125, y);
      doc.text(`${BudgetEngine.formatCurrency(t.amount, currency)}`, 175, y);
      y += 6;
    });

    doc.save(`Campus_Expense_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    this.showToast("PDF Report downloaded successfully!");
  },

  exportToCSV(transactions) {
    if (transactions.length === 0) {
      this.showToast("No transaction records available to export", "warning");
      return;
    }

    const headers = ["ID", "Type", "Name/Source", "Amount", "Category", "Date", "Time", "Timestamp", "Payment Mode", "Notes"];
    const rows = transactions.map(t => [
      t.id, t.type,
      `"${t.name || t.source}"`,
      t.amount,
      `"${t.category || t.source || 'General'}"`,
      t.date || '',
      `"${t.time || ''}"`,
      t.timestamp || '',
      `"${t.paymentMode || ''}"`,
      `"${(t.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Campus_Expenses_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showToast("CSV file exported successfully!");
  },

  // ----------------------------------------------------
  // Page 5: PROFILE & SETTINGS PAGE LOGIC
  // ----------------------------------------------------
  initProfilePage() {
    const user = StorageManager.getUser();

    const fullNameInput = document.getElementById('profile-fullname');
    const emailInput = document.getElementById('profile-email');
    const phoneInput = document.getElementById('profile-phone');
    const collegeInput = document.getElementById('profile-college');
    const yearInput = document.getElementById('profile-year');
    const currencySelect = document.getElementById('profile-currency');
    const avatarPreview = document.getElementById('profile-avatar-preview');
    const pictureInput = document.getElementById('profile-picture-file');

    if (fullNameInput) fullNameInput.value = user.fullName || '';
    if (emailInput) emailInput.value = user.email || '';
    if (phoneInput) phoneInput.value = user.phone || '';
    if (collegeInput) collegeInput.value = user.collegeName || '';
    if (yearInput) yearInput.value = user.yearOfStudy || '';
    if (currencySelect) currencySelect.value = user.currency || '₹';
    if (avatarPreview && user.profilePicture) avatarPreview.src = user.profilePicture;

    if (pictureInput) {
      pictureInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            const base64 = evt.target.result;
            if (avatarPreview) avatarPreview.src = base64;
            StorageManager.updateUser({ profilePicture: base64 });
            App.showToast("Profile image updated!");
          };
          reader.readAsDataURL(file);
        }
      });
    }

    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
      profileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const res = StorageManager.updateUser({
          fullName: fullNameInput.value.trim(),
          email: emailInput.value.trim(),
          phone: phoneInput.value.trim(),
          collegeName: collegeInput.value.trim(),
          yearOfStudy: yearInput.value.trim(),
          currency: currencySelect.value
        });
        if (res && res.success === false) { this.showToast(res.error, "error"); return; }
        this.showToast("Profile settings saved successfully!");
      });
    }

    const changePassForm = document.getElementById('change-password-form');
    if (changePassForm) {
      changePassForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const currentPass = document.getElementById('current-password').value;
        const newPass = document.getElementById('new-password').value;
        const confirmPass = document.getElementById('confirm-password').value;
        if (newPass !== confirmPass) { this.showToast("Passwords do not match.", "error"); return; }
        const res = StorageManager.changePassword(currentPass, newPass);
        if (!res.success) { this.showToast(res.error, "error"); return; }
        this.showToast("Password updated successfully!", "success");
        changePassForm.reset();
      });
    }

    // Export JSON
    const exportJsonBtn = document.getElementById('export-json-data-btn');
    if (exportJsonBtn) {
      exportJsonBtn.onclick = () => {
        const data = StorageManager.getData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Campus_Expense_Tracker_Backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        this.showToast("Data backup JSON downloaded!");
      };
    }

    // #10 Import JSON Backup
    const importJsonBtn = document.getElementById('import-json-data-btn');
    const importJsonFile = document.getElementById('import-json-file');
    if (importJsonBtn && importJsonFile) {
      importJsonBtn.onclick = () => importJsonFile.click();
      importJsonFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const data = JSON.parse(evt.target.result);
            if (!data.accounts) throw new Error("Invalid backup file format.");
            if (!confirm("This will replace ALL your current data with the backup. Continue?")) return;
            localStorage.setItem('campusExpenseTrackerData', JSON.stringify(data));
            this.showToast("Data restored from backup!", "success");
            setTimeout(() => window.location.reload(), 800);
          } catch (err) {
            this.showToast("Invalid backup file: " + err.message, "error");
          }
        };
        reader.readAsText(file);
        importJsonFile.value = '';
      });
    }

    // #9 Import CSV
    const importCsvBtn = document.getElementById('import-csv-btn');
    const importCsvFile = document.getElementById('import-csv-file');
    if (importCsvBtn && importCsvFile) {
      importCsvBtn.onclick = () => importCsvFile.click();
      importCsvFile.addEventListener('change', async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          await new Promise((resolve) => {
            this.handleCSVUpload(file, () => {
              resolve();
            });
          });
        }
        importCsvFile.value = '';
      });
    }
  },

  handleCSVUpload(file, callback) {
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) { this.showToast("CSV has no data rows.", "error"); if(callback) callback(); return; }
      
      let headerIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().startsWith('date,') || lines[i].toLowerCase().startsWith('"date"')) {
          headerIdx = i;
          break;
        }
      }
      
      if (headerIdx === -1) {
        // Fallback to first line if "date" not found
        headerIdx = 0;
      }

      const headers = lines[headerIdx].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
      let imported = 0, skipped = 0;
      const today = this.getTodayDateValue();
      const newTransactions = [];

      for (let i = headerIdx + 1; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes('automatically generated statement') || lines[i].toLowerCase().includes('disclaimer')) {
          break; // Stop at footer
        }
        const cols = this._parseCSVLine(lines[i]);
        if (cols.length < headers.length - 2) continue; // Skip malformed rows
        const row = {};
        headers.forEach((h, idx) => { 
          const cleanH = h.replace(/\s+/g, '');
          row[cleanH] = (cols[idx] || '').replace(/^"|"$/g, '').trim(); 
          row[h] = row[cleanH];
        });

        let type = (row['type'] || row['transactiontype'] || '').toLowerCase();
        let amount = 0;

        const crDr = (row['credit/debit'] || row['credit/debate'] || row['cr/dr'] || '').toLowerCase();
        if (crDr === 'credit' || crDr === 'cr' || type === 'credit') type = 'income';
        else if (crDr === 'debit' || crDr === 'dr' || type === 'debit') type = 'expense';

        if (!type) {
          const creditVal = parseFloat(row['credit'] || 0);
          const debitVal = parseFloat(row['debit'] || row['debate'] || 0);
          if (creditVal > 0) { type = 'income'; amount = creditVal; }
          else if (debitVal > 0) { type = 'expense'; amount = debitVal; }
        }

        if (!amount) {
          amount = parseFloat((row['amount'] || row['amount(₹)'] || row['amount(rs)'] || '0').replace(/,/g, ''));
        }
        if (amount < 0 && !type) {
          type = 'expense';
          amount = Math.abs(amount);
        } else if (amount > 0 && !type) {
          type = 'expense';
        }

        if (type !== 'income' && type !== 'expense') { skipped++; continue; }
        if (!amount || amount <= 0) { skipped++; continue; }

        const txDate = row['date'] ? this._parseDateFromCSV(row['date']) : today;
        const rawTime = row['time'] ? row['time'].trim() : this.getCurrentTimeValue();
        // Convert 12h AM/PM format (e.g. "12:37 PM") to 24h "HH:MM" for timestamp
        const txTime = this._parseTimeTo24h(rawTime);
        const txTimestamp = row['timestamp'] ? parseFloat(row['timestamp']) : (new Date(`${txDate}T${txTime}:00`).getTime() || Date.now());


        let rawName = row['name/source'] || row['transactiondetails'] || row['to/from'] || row['name'] || row['source'] || 'Imported Transaction';
        
        // Clean transaction details
        if (rawName.startsWith("Paid to ")) rawName = rawName.replace("Paid to ", "");
        else if (rawName.startsWith("Received from ")) rawName = rawName.replace("Received from ", "");
        else if (rawName.startsWith("Mobile recharged ")) rawName = rawName.replace("Mobile recharged ", "Recharge ");
        
        // Infer category
        let inferredCategory = 'Miscellaneous';
        const nl = rawName.toLowerCase();
        if (['zomato', 'swiggy', 'restaurant', 'cafe', 'food'].some(k => nl.includes(k))) inferredCategory = 'Mess/Food';
        else if (['jio', 'airtel', 'recharge', 'vi', 'mobile'].some(k => nl.includes(k))) inferredCategory = 'Mobile Recharge';
        else if (['amazon', 'flipkart', 'myntra', 'mart', 'shop', 'store', 'kirana'].some(k => nl.includes(k))) inferredCategory = 'Shopping';
        else if (['uber', 'ola', 'rapido', 'auto', 'travel', 'irctc'].some(k => nl.includes(k))) inferredCategory = 'Transportation';
        else if (['hospital', 'pharmacy', 'medical', 'clinic'].some(k => nl.includes(k))) inferredCategory = 'Medical';
        else if (['book', 'stationery', 'print', 'photocopy'].some(k => nl.includes(k))) inferredCategory = 'Stationery';
        else if (['movie', 'cinema', 'netflix', 'prime'].some(k => nl.includes(k))) inferredCategory = 'Entertainment';
        else if (['hostel', 'pg', 'rent'].some(k => nl.includes(k))) inferredCategory = 'Hostel';
        else if (['institute', 'college', 'school', 'fee'].some(k => nl.includes(k))) inferredCategory = 'College Fees';
        
        newTransactions.push({
          type,
          name: rawName,
          source: rawName,
          amount,
          category: row['category'] || inferredCategory,
          date: txDate,
          time: txTime,
          timestamp: txTimestamp,
          paymentMode: row['paymentmode'] || row['payment mode'] || 'Bank Transfer',
          notes: row['notes'] || ''
        });
        imported++;
      }
      
      if (this.currentPage === 'past_months' && newTransactions.length > 0) {
        // Aggregate to one entry per month
        const monthlySummaries = {};
        newTransactions.forEach(t => {
          const m = t.date.substring(0, 7); // e.g. "2026-09"
          if (!monthlySummaries[m]) monthlySummaries[m] = { income: 0, expense: 0, date: t.date };
          if (t.type === 'income') monthlySummaries[m].income += t.amount;
          else monthlySummaries[m].expense += t.amount;
          if (t.date > monthlySummaries[m].date) monthlySummaries[m].date = t.date;
        });

        const summarizedTransactions = [];
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        for (const [monthKey, data] of Object.entries(monthlySummaries)) {
           const [yearStr, monthStr] = monthKey.split('-');
           const monthLabel = monthNames[parseInt(monthStr)-1] + " " + yearStr;
           
           if (data.income > 0) {
             summarizedTransactions.push({
                type: 'income', name: `Archive Income - ${monthLabel}`, source: 'Archive', amount: data.income,
                category: 'Miscellaneous', date: data.date, time: '23:59', timestamp: new Date(`${data.date}T23:59:00`).getTime(),
                paymentMode: 'Bank Transfer', notes: 'Aggregated past statement data'
             });
           }
           if (data.expense > 0) {
             summarizedTransactions.push({
                type: 'expense', name: `Archive Expenses - ${monthLabel}`, source: 'Archive', amount: data.expense,
                category: 'Miscellaneous', date: data.date, time: '23:59', timestamp: new Date(`${data.date}T23:59:00`).getTime(),
                paymentMode: 'Bank Transfer', notes: 'Aggregated past statement data'
             });
           }
        }
        
        StorageManager.bulkAddTransactions(summarizedTransactions);
        imported = summarizedTransactions.length;
      } else if (newTransactions.length > 0) {
        StorageManager.bulkAddTransactions(newTransactions);
      }

      this.showToast(`Imported ${imported} transactions${skipped ? ` (${skipped} skipped)` : ''}.`, 'success');
      if (callback) callback();
      
      // Update UI if we are on a page that shows transactions (like dashboard/transactions)
      if (typeof window.updateUI === 'function') {
        window.updateUI();
      } else if (typeof updateUI === 'function') {
        updateUI();
      } else if (typeof renderTransactionsList === 'function') {
        renderTransactionsList();
        updateBudgetSummary();
      }
    };
    reader.readAsText(file);


    // Reset Account
    const resetDataBtn = document.getElementById('reset-account-data-btn');
    if (resetDataBtn) {
      resetDataBtn.onclick = () => {
        if (confirm("Are you sure you want to reset all transactions and budget settings? This cannot be undone.")) {
          StorageManager.resetAll();
          this.showToast("Account data reset to default demo state.");
          setTimeout(() => window.location.reload(), 600);
        }
      };
    }
  },

  // CSV line parser that handles quoted commas
  _parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
      else { current += ch; }
    }
    result.push(current);
    return result;
  },

  _parseDateFromCSV(str) {
    str = str.replace(/"/g, '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    
    // Handle format "Sept 29, 2026"
    if (str.includes(',')) {
      const parsed = new Date(str.replace('Sept', 'Sep'));
      if (!isNaN(parsed)) {
        return parsed.toISOString().split('T')[0];
      }
    }
    
    const parts = str.split(/[\/\-]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`;
      return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
    }
    return this.getTodayDateValue();
  },

  // Converts "12:37 PM" or "1:05 AM" → "12:37" or "01:05" (24h HH:MM)
  _parseTimeTo24h(str) {
    if (!str) return '00:00';
    str = str.trim();
    if (/^\d{1,2}:\d{2}$/.test(str)) return str.length === 4 ? '0' + str : str;
    const match = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return str.slice(0, 5);
    let h = parseInt(match[1]);
    const m = match[2];
    const suffix = match[3].toUpperCase();
    if (suffix === 'AM' && h === 12) h = 0;
    if (suffix === 'PM' && h !== 12) h += 12;
    return `${String(h).padStart(2, '0')}:${m}`;
  }
};
