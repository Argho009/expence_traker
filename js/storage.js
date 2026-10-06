/**
 * LocalStorage Manager - Campus Expense Tracker
 * Multi-user Account Registry with Unique Username Enforcement & Isolated User Datasets.
 */

const STORAGE_KEY = 'campusExpenseTrackerData';

const DEFAULT_INITIAL_DATA = {
  accounts: {},     // Keyed by lowercase username: { username, password, fullName, email, collegeName, yearOfStudy, currency, profilePicture, budget, transactions }
  currentUser: null, // Active logged in username key
  theme: "light"
};

const StorageManager = {
  getData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        this.saveData(DEFAULT_INITIAL_DATA);
        return DEFAULT_INITIAL_DATA;
      }
      const data = JSON.parse(raw);
      if (!data.accounts) data.accounts = {};
      return data;
    } catch (e) {
      console.error("Error reading localStorage:", e);
      return DEFAULT_INITIAL_DATA;
    }
  },

  saveData(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Error writing to localStorage:", e);
    }
  },

  // Check if username already exists
  isUsernameTaken(username) {
    if (!username) return false;
    const data = this.getData();
    const key = username.trim().toLowerCase();
    return !!data.accounts[key];
  },

  // Check if email already exists for another user
  isEmailTaken(email, excludeUsernameKey = null) {
    if (!email) return false;
    const data = this.getData();
    const targetEmail = email.trim().toLowerCase();

    return Object.keys(data.accounts).some(accKey => {
      if (excludeUsernameKey && accKey === excludeUsernameKey) return false;
      const acc = data.accounts[accKey];
      return acc.email && acc.email.trim().toLowerCase() === targetEmail;
    });
  },

  // Auth: Register new user with Cloudflare API
  async registerUser(userData) {
    const data = this.getData();
    const rawUsername = (userData.username || '').trim();
    const rawEmail = (userData.email || '').trim();

    if (!rawUsername) return { success: false, error: "Username is required." };
    if (!rawEmail) return { success: false, error: "Email address is required." };

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'signup', ...userData })
      });
      const result = await response.json();
      
      if (!result.success) return result;

      const dbUser = result.user;
      const key = dbUser.username.toLowerCase();
      
      const newUserAccount = {
        id: dbUser.id,
        username: dbUser.username,
        password: dbUser.password,
        fullName: dbUser.full_name,
        email: dbUser.email,
        collegeName: dbUser.college_name,
        currency: dbUser.currency || '₹',
        budget: {
          monthlyBudget: dbUser.budget,
          currency: dbUser.currency || '₹',
          setDate: Date.now()
        },
        transactions: []
      };

      data.accounts[key] = newUserAccount;
      data.currentUser = key;
      this.saveData(data);
      return { success: true, user: newUserAccount };
    } catch (e) {
      console.error(e);
      return { success: false, error: "Cloudflare API connection failed. Please ensure the backend is running." };
    }
  },

  // Auth: Sign in with Cloudflare API
  async login(username, password) {
    const data = this.getData();
    const rawUsername = (username || '').trim();
    const key = rawUsername.toLowerCase();

    if (!key) return { success: false, error: "Please enter your username." };

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', username, password })
      });
      
      if (!response.ok) {
         const errData = await response.json().catch(()=>({}));
         return { success: false, error: errData.error || "Invalid credentials or API error." };
      }
      
      const result = await response.json();
      if (!result.success) return result;

      const dbUser = result.user;
      const transactions = result.transactions || [];
      
      const account = {
        id: dbUser.id,
        username: dbUser.username,
        password: dbUser.password,
        fullName: dbUser.full_name,
        email: dbUser.email,
        collegeName: dbUser.college_name,
        currency: dbUser.currency || '₹',
        budget: {
          monthlyBudget: dbUser.budget,
          currency: dbUser.currency || '₹',
          setDate: Date.now()
        },
        transactions: transactions.map(t => ({
           id: t.id,
           type: t.type,
           amount: t.amount,
           category: t.category,
           date: t.date,
           time: t.time,
           timestamp: t.timestamp,
           notes: t.notes,
           paymentMode: t.payment_mode
        }))
      };

      data.accounts[key] = account;
      data.currentUser = key;
      this.saveData(data);
      return { success: true, user: account };
    } catch (e) {
      console.error(e);
      // Fallback to local authentication if API fails (Offline mode)
      const account = data.accounts[key];
      if (!account) return { success: false, error: "No account found or API unavailable." };
      if (password && account.password && account.password !== password) {
        return { success: false, error: "Incorrect password." };
      }
      
      data.currentUser = key;
      this.saveData(data);
      return { success: true, user: account };
    }
  },

  isLoggedIn() {
    const data = this.getData();
    return !!(data.currentUser && data.accounts[data.currentUser]);
  },

  logout() {
    const data = this.getData();
    data.currentUser = null;
    this.saveData(data);
  },

  // Active User Profile CRUD
  getUser() {
    const data = this.getData();
    if (data.currentUser && data.accounts[data.currentUser]) {
      return data.accounts[data.currentUser];
    }
    return {
      username: "student",
      fullName: "Student User",
      email: "student@campus.edu",
      currency: "₹"
    };
  },

  updateUser(updatedFields) {
    const data = this.getData();
    if (!data.currentUser || !data.accounts[data.currentUser]) return { success: false, error: "No active session." };

    if (updatedFields.email && this.isEmailTaken(updatedFields.email, data.currentUser)) {
      return { 
        success: false, 
        error: `Email address "${updatedFields.email}" is already registered to another account.` 
      };
    }

    const account = data.accounts[data.currentUser];
    data.accounts[data.currentUser] = { ...account, ...updatedFields };

    if (updatedFields.currency) {
      data.accounts[data.currentUser].budget.currency = updatedFields.currency;
    }

    this.saveData(data);
    return { success: true, user: data.accounts[data.currentUser] };
  },

  changePassword(oldPass, newPass) {
    const data = this.getData();
    if (!data.currentUser || !data.accounts[data.currentUser]) {
      return { success: false, error: "No active session." };
    }

    const account = data.accounts[data.currentUser];
    if (account.password && account.password !== oldPass) {
      return { success: false, error: "Current password is incorrect." };
    }

    if (!newPass || newPass.length < 4) {
      return { success: false, error: "New password must be at least 4 characters long." };
    }

    account.password = newPass; // Preserves any special characters, numbers, and letters
    data.accounts[data.currentUser] = account;
    this.saveData(data);
    return { success: true };
  },

  // Active User Budget CRUD
  getBudget() {
    const user = this.getUser();
    return user.budget || { monthlyBudget: 5000, currency: user.currency || "₹", setDate: Date.now() };
  },

  setBudget(amount) {
    const data = this.getData();
    if (!data.currentUser || !data.accounts[data.currentUser]) return null;

    const budget = data.accounts[data.currentUser].budget || {};
    budget.monthlyBudget = parseFloat(amount) || 0;
    budget.setDate = Date.now();
    data.accounts[data.currentUser].budget = budget;

    this.saveData(data);
    return budget;
  },

  // Active User Transactions CRUD
  getTransactions() {
    const user = this.getUser();
    return user.transactions || [];
  },

  // Background Sync to Cloudflare D1
  syncWithCloud() {
    const user = this.getUser();
    if (!user || !user.id) return;
    
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        userId: user.id, 
        transactions: user.transactions || [] 
      })
    }).catch(console.error);
  },

  addTransaction(item) {
    const data = this.getData();
    if (!data.currentUser || !data.accounts[data.currentUser]) return null;

    const now = new Date();
    const defaultTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const txTime = item.time || defaultTime;
    const txDate = item.date || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    let txTimestamp = item.timestamp;
    if (!txTimestamp) {
      const parsedTs = new Date(`${txDate}T${txTime}:00`).getTime();
      txTimestamp = !isNaN(parsedTs) ? parsedTs : Date.now();
    }

    const newTx = {
      id: "tx_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
      date: txDate,
      time: txTime,
      timestamp: txTimestamp,
      ...item
    };

    if (!data.accounts[data.currentUser].transactions) {
      data.accounts[data.currentUser].transactions = [];
    }

    data.accounts[data.currentUser].transactions.unshift(newTx);
    this.saveData(data);
    this.syncWithCloud();
    return newTx;
  },

  bulkAddTransactions(items) {
    const data = this.getData();
    if (!data.currentUser || !data.accounts[data.currentUser]) return [];

    const now = new Date();
    const defaultTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    const newTxns = items.map((item, index) => {
      const txTime = item.time || defaultTime;
      const txDate = item.date || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      let txTimestamp = item.timestamp;
      if (!txTimestamp) {
        const parsedTs = new Date(`${txDate}T${txTime}:00`).getTime();
        txTimestamp = !isNaN(parsedTs) ? parsedTs : Date.now();
      }
      return {
        id: "tx_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 4) + index,
        date: txDate,
        time: txTime,
        timestamp: txTimestamp,
        ...item
      };
    });

    if (!data.accounts[data.currentUser].transactions) {
      data.accounts[data.currentUser].transactions = [];
    }

    data.accounts[data.currentUser].transactions.unshift(...newTxns);
    this.saveData(data);
    this.syncWithCloud();
    
    return newTxns;
  },

  updateTransaction(id, updatedFields) {
    const data = this.getData();
    if (!data.currentUser || !data.accounts[data.currentUser]) return null;

    const txs = data.accounts[data.currentUser].transactions || [];
    const index = txs.findIndex(t => t.id === id);
    if (index !== -1) {
      const existing = txs[index];
      const finalTime = updatedFields.time || existing.time || "12:00";
      const finalDate = updatedFields.date || existing.date;
      
      let finalTimestamp = updatedFields.timestamp;
      if (!finalTimestamp) {
        if (updatedFields.date && updatedFields.date !== existing.date) {
          const parsed = new Date(`${finalDate}T${finalTime}:00`).getTime();
          finalTimestamp = !isNaN(parsed) ? parsed : existing.timestamp;
        } else {
          finalTimestamp = existing.timestamp || (finalDate ? new Date(`${finalDate}T${finalTime}:00`).getTime() : Date.now());
        }
      }

      txs[index] = { 
        ...existing, 
        ...updatedFields, 
        time: finalTime, 
        date: finalDate, 
        timestamp: finalTimestamp 
      };
      data.accounts[data.currentUser].transactions = txs;
      this.saveData(data);
      this.syncWithCloud();
      return txs[index];
    }
    return null;
  },

  deleteTransaction(id) {
    const data = this.getData();
    if (!data.currentUser || !data.accounts[data.currentUser]) return;

    let txs = data.accounts[data.currentUser].transactions || [];
    data.accounts[data.currentUser].transactions = txs.filter(t => t.id !== id);
    this.saveData(data);
    this.syncWithCloud();
  },

  // Theme Management
  getTheme() {
    return this.getData().theme || 'light';
  },

  setTheme(themeName) {
    const data = this.getData();
    data.theme = themeName;
    this.saveData(data);
  },

  // Reset Account / Master Wiping
  resetAll() {
    this.saveData(DEFAULT_INITIAL_DATA);
    localStorage.removeItem(STORAGE_KEY);
  }
};
