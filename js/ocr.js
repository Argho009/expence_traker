const OCREngine = {
  init() {
    this.uploadInput = document.getElementById('ocr-upload');
    if (!this.uploadInput) return;
    
    this.uploadInput.addEventListener('change', this.handleFileUpload.bind(this));
  },

  async handleFileUpload(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    App.showToast(`Processing ${files.length} document(s)... Please wait.`, "warning");
    
    // Show loading spinner on the button if possible
    const ocrBtn = document.querySelector('button[onclick*="ocr-upload"]');
    let originalHtml = "";
    if (ocrBtn) {
      originalHtml = ocrBtn.innerHTML;
      ocrBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
      ocrBtn.disabled = true;
    }

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        if (file.name.endsWith('.csv') || file.type === 'text/csv' || file.type === 'application/vnd.ms-excel') {
          if (typeof App !== 'undefined' && typeof App.handleCSVUpload === 'function') {
             await new Promise((resolve) => {
                App.handleCSVUpload(file, resolve);
             });
          } else {
             console.error("CSV Upload logic is not available.");
          }
          continue;
        }

        let extractedText = '';
        if (file.type === 'application/pdf') {
          extractedText = await this.extractTextFromPDF(file);
        } else if (file.type.startsWith('image/')) {
          extractedText = await this.extractTextFromImage(file);
        } else {
          App.showToast(`Unsupported file format for ${file.name}.`, "error");
          continue;
        }

        console.log(`Extracted Text from ${file.name}:`, extractedText);
        const parsedData = this.parsePhonePeText(extractedText);
        
        this.populateExpenseForm(parsedData);
        App.showToast(`Data extracted from ${file.name}! Please review and save.`, "success");
      }
    } catch (error) {
      console.error(error);
      App.showToast(error.message || "Failed to process document.", "error");
    } finally {
      if (ocrBtn) {
        ocrBtn.innerHTML = originalHtml;
        ocrBtn.disabled = false;
      }
      this.uploadInput.value = ''; // Reset input
    }
  },

  async extractTextFromImage(file) {
    if (typeof Tesseract === 'undefined') {
      throw new Error("Tesseract.js is not loaded.");
    }
    const worker = await Tesseract.createWorker('eng');
    const { data: { text } } = await worker.recognize(file);
    await worker.terminate();
    return text;
  },

  async extractTextFromPDF(file) {
    if (typeof pdfjsLib === 'undefined') {
      throw new Error("PDF.js is not loaded.");
    }
    
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText;
  },

  parsePhonePeText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const data = {
      name: 'PhonePe Transaction',
      amount: '',
      date: '',
      category: 'Miscellaneous'
    };

    // Date extraction: e.g. 06 Oct 2026, 2026-10-06, 06/10/2026
    const dateMatch = text.match(/(\d{1,2}\s+[a-zA-Z]{3,4}\s+\d{4})/i) || text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
    if (dateMatch) {
      let parsedDate = new Date(dateMatch[0]);
      if (!isNaN(parsedDate.getTime())) {
        data.date = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`;
      }
    }

    // Amount extraction: Look for ₹ or Rs followed by numbers
    const amountMatch = text.match(/(?:₹|Rs\.?)\s*([\d,]+(?:\.\d+)?)/i);
    if (amountMatch) {
      data.amount = amountMatch[1].replace(/,/g, '');
    } else {
      // Fallback: look for exactly numeric values that might be the amount
      const fallbackMatch = text.match(/(\d+\.\d{2})/);
      if (fallbackMatch) data.amount = fallbackMatch[1];
    }

    // Name extraction: heuristic
    // For PhonePe, usually it says "Paid to" followed by the person's/merchant's name
    const textLower = text.toLowerCase();
    const paidToIndex = textLower.indexOf('paid to');
    if (paidToIndex !== -1) {
      // Get the substring after 'paid to'
      const afterPaidTo = text.substring(paidToIndex + 7).trim();
      // Usually the name is the next few words
      const words = afterPaidTo.split(/[\n\r]+|(?<=[a-zA-Z]) (?=[A-Z])/);
      if (words.length > 0 && words[0].trim().length > 0) {
        // Just take the first line or chunk
        let possibleName = words[0].trim().replace(/[^a-zA-Z0-9\s]/g, '');
        if (possibleName) {
            data.name = possibleName;
        }
      }
    } else {
        // Try looking for 'To' in some bank statements
        const linesArr = text.split('\n');
        for (let i = 0; i < linesArr.length; i++) {
            if (linesArr[i].toLowerCase().includes('paid to') && i + 1 < linesArr.length) {
                data.name = linesArr[i + 1].trim();
                break;
            }
        }
    }

    // Category inference based on name or full text
    const contextText = (data.name + ' ' + text).toLowerCase();
    
    if (contextText.includes('zomato') || contextText.includes('swiggy') || contextText.includes('restaurant') || contextText.includes('cafe') || contextText.includes('food')) {
      data.category = 'Mess/Food';
    } else if (contextText.includes('jio') || contextText.includes('airtel') || contextText.includes('recharge') || contextText.includes('vi')) {
      data.category = 'Mobile Recharge';
    } else if (contextText.includes('amazon') || contextText.includes('flipkart') || contextText.includes('myntra') || contextText.includes('mart') || contextText.includes('shop')) {
      data.category = 'Shopping';
    } else if (contextText.includes('uber') || contextText.includes('ola') || contextText.includes('rapido') || contextText.includes('auto') || contextText.includes('travel') || contextText.includes('irctc')) {
      data.category = 'Transportation';
    } else if (contextText.includes('hospital') || contextText.includes('pharmacy') || contextText.includes('medical') || contextText.includes('clinic')) {
      data.category = 'Medical';
    } else if (contextText.includes('book') || contextText.includes('stationery') || contextText.includes('print')) {
      data.category = 'Stationery';
    } else if (contextText.includes('movie') || contextText.includes('cinema') || contextText.includes('netflix') || contextText.includes('prime')) {
      data.category = 'Entertainment';
    } else if (contextText.includes('hostel') || contextText.includes('pg') || contextText.includes('rent')) {
      data.category = 'Hostel';
    }

    return data;
  },

  populateExpenseForm(data) {
    // Switch to expense tab if not active
    const tabExpense = document.getElementById('tab-add-expense');
    if (tabExpense && !tabExpense.classList.contains('active')) {
      tabExpense.click();
    }

    // Populate fields
    if (data.name) {
      document.getElementById('expense-name').value = data.name;
    }
    if (data.amount) {
      document.getElementById('expense-amount').value = data.amount;
    }
    if (data.date) {
      document.getElementById('expense-date').value = data.date;
    }
    if (data.category) {
      const categorySelect = document.getElementById('expense-category');
      // Ensure the category exists in the dropdown
      const exists = Array.from(categorySelect.options).some(opt => opt.value === data.category);
      if (exists) {
        categorySelect.value = data.category;
      }
    }
    
    // Set payment mode to UPI by default as it's from PhonePe
    document.getElementById('expense-payment-mode').value = 'UPI';

    // Set notes
    document.getElementById('expense-notes').value = 'Scanned via PhonePe Document';
    
    // Scroll to form so user can edit
    document.getElementById('form-add-expense').scrollIntoView({ behavior: 'smooth' });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  OCREngine.init();
});
