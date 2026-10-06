/**
 * Budget & Analytics Calculation Engine - Campus Expense Tracker
 */

const BudgetEngine = {
  // Format monetary values with configured currency symbol
  formatCurrency(amount, symbol = "₹") {
    const val = parseFloat(amount) || 0;
    return `${symbol}${val.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  },

  // Calculate Income, Expense, Net, UPI/Digital, and Cash Balance totals
  calculateSummary(transactions = []) {
    let totalIncome = 0;
    let totalExpense = 0;
    let upiIncome = 0;
    let upiExpense = 0;
    let cashIncome = 0;
    let cashExpense = 0;

    transactions.forEach(t => {
      const amt = parseFloat(t.amount) || 0;
      const mode = (t.paymentMode || 'UPI').trim();

      if (t.type === 'income') {
        totalIncome += amt;
        if (mode === 'Cash') {
          cashIncome += amt;
        } else {
          upiIncome += amt;
        }
      } else if (t.type === 'expense') {
        totalExpense += amt;
        if (mode === 'Cash') {
          cashExpense += amt;
        } else {
          upiExpense += amt;
        }
      }
    });

    const upiBalance = upiIncome - upiExpense;
    const cashBalance = cashIncome - cashExpense;

    return {
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense,
      upiIncome,
      upiExpense,
      upiBalance,
      cashIncome,
      cashExpense,
      cashBalance
    };
  },

  // Calculate summary filtered to a specific month/year
  calculateSummaryForMonth(transactions = [], year, month) {
    const filtered = transactions.filter(t => {
      const d = new Date(t.date || t.timestamp);
      return d.getFullYear() === year && d.getMonth() === month;
    });
    return this.calculateSummary(filtered);
  },

  // Calculate Budget Progress & Alert State
  calculateBudgetStatus(monthlyBudget, totalExpense) {
    const budget = parseFloat(monthlyBudget) || 0;
    const spent = parseFloat(totalExpense) || 0;
    const remaining = budget - spent;
    const percent = budget > 0 ? Math.min(Math.round((spent / budget) * 100), 999) : 0;

    let status = 'healthy'; // 0 - 60%
    if (percent > 90) {
      status = 'danger'; // 90%+
    } else if (percent > 60) {
      status = 'warning'; // 60-90%
    }

    return {
      budget,
      spent,
      remaining,
      percent,
      status,
      isExceeded: spent > budget
    };
  },

  // Spending Forecast: project end-of-month spend based on daily average
  calculateForecast(transactions = [], year, month) {
    const now = new Date();
    const isCurrentMonth = (year === now.getFullYear() && month === now.getMonth());
    const today = now.getDate();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const monthTxs = transactions.filter(t => {
      const d = new Date(t.date || t.timestamp);
      return t.type === 'expense' && d.getFullYear() === year && d.getMonth() === month;
    });
    const totalSpent = monthTxs.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    const elapsedDays = isCurrentMonth ? Math.max(today, 1) : daysInMonth;
    const dailyAvg = totalSpent / elapsedDays;
    const projectedTotal = isCurrentMonth ? dailyAvg * daysInMonth : totalSpent;
    const daysLeft = isCurrentMonth ? daysInMonth - today : 0;

    return {
      totalSpent,
      dailyAvg,
      projectedTotal,
      daysLeft,
      daysInMonth,
      elapsedDays
    };
  },

  // Daily budget limit: monthlyBudget / days in month
  calculateDailyLimit(monthlyBudget, year, month) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return (parseFloat(monthlyBudget) || 0) / daysInMonth;
  },

  // Last 6 months spending totals for trend chart
  getMonthlyTrend(transactions = [], numMonths = 6) {
    const now = new Date();
    const result = [];

    for (let i = numMonths - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yr = d.getFullYear();
      const mo = d.getMonth();
      const monthName = d.toLocaleString('default', { month: 'short', year: '2-digit' });

      const spent = transactions
        .filter(t => {
          const td = new Date(t.date || t.timestamp);
          return t.type === 'expense' && td.getFullYear() === yr && td.getMonth() === mo;
        })
        .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

      const income = transactions
        .filter(t => {
          const td = new Date(t.date || t.timestamp);
          return t.type === 'income' && td.getFullYear() === yr && td.getMonth() === mo;
        })
        .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

      result.push({ label: monthName, spent, income, year: yr, month: mo });
    }
    return result;
  },

  // Comprehensive Analytics Calculations
  calculateAnalytics(transactions = [], monthlyBudget = 0, filterYear = null, filterMonth = null) {
    const now = new Date();
    const targetYear = filterYear !== null ? filterYear : now.getFullYear();
    const targetMonth = filterMonth !== null ? filterMonth : now.getMonth();
    const currentDay = now.getDate() || 1;

    const categoryTotals = {};
    let totalExpense = 0;
    let totalIncome = 0;
    let foodExpense = 0;
    let currentMonthExpense = 0;

    transactions.forEach(t => {
      const amt = parseFloat(t.amount) || 0;
      const tDate = new Date(t.date || t.timestamp);

      if (t.type === 'income') {
        totalIncome += amt;
      } else if (t.type === 'expense') {
        totalExpense += amt;

        // Category aggregator
        const cat = t.category || 'Miscellaneous';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;

        // Specific Food aggregator (Mess/Food + Cafeteria)
        if (cat === 'Mess/Food' || cat === 'Cafeteria') {
          foodExpense += amt;
        }

        // Selected Month total
        if (tDate.getMonth() === targetMonth && tDate.getFullYear() === targetYear) {
          currentMonthExpense += amt;
        }
      }
    });

    // Determine Most Expensive Category
    let mostExpensiveCat = { name: "N/A", amount: 0 };
    Object.keys(categoryTotals).forEach(cat => {
      if (categoryTotals[cat] > mostExpensiveCat.amount) {
        mostExpensiveCat = { name: cat, amount: categoryTotals[cat] };
      }
    });

    // Daily Average Spending
    const isCurrentMonth = (targetYear === now.getFullYear() && targetMonth === now.getMonth());
    const elapsed = isCurrentMonth ? currentDay : new Date(targetYear, targetMonth + 1, 0).getDate();
    const dailyAverage = currentMonthExpense > 0 ? (currentMonthExpense / elapsed) : 0;

    // Income vs Expense ratio
    const ratio = totalExpense > 0 ? (totalIncome / totalExpense).toFixed(2) : (totalIncome > 0 ? "Infinite" : "1.0");

    // Top categories array
    const sortedCategories = Object.keys(categoryTotals)
      .map(cat => ({
        name: cat,
        amount: categoryTotals[cat],
        percentage: totalExpense > 0 ? Math.round((categoryTotals[cat] / totalExpense) * 100) : 0
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      mostExpensiveCategory: mostExpensiveCat,
      totalFoodExpenses: foodExpense,
      monthlySpending: currentMonthExpense,
      dailyAverageSpending: dailyAverage,
      incomeVsExpenseRatio: ratio,
      categoryBreakdown: sortedCategories,
      totalExpense
    };
  }
};
