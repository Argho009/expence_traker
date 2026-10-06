const fs = require('fs');
const text = fs.readFileSync('Clean/01_Sept_2026_to_30_Sept_2026.csv', 'utf8');
const lines = text.split('\n').filter(l => l.trim());
let headerIdx = 0;
const headers = lines[headerIdx].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
console.log('Headers:', headers);

function _parseCSVLine(line) {
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
}

let imported = 0, skipped = 0;
for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = _parseCSVLine(lines[i]);
    if (cols.length < headers.length - 2) { console.log('Skipping malformed row', i); continue; }
    const row = {};
    headers.forEach((h, idx) => { 
        const cleanH = h.replace(/\s+/g, '');
        row[cleanH] = (cols[idx] || '').replace(/^"|"$/g, '').trim(); 
        row[h] = row[cleanH];
    });
    
    let type = (row['type'] || row['transactiontype'] || '').toLowerCase();
    let amount = 0;
    const crDr = (row['credit/debit'] || row['cr/dr'] || '').toLowerCase();
    if (crDr === 'credit' || crDr === 'cr' || type === 'credit') type = 'income';
    else if (crDr === 'debit' || crDr === 'dr' || type === 'debit') type = 'expense';
    
    if (!amount) {
        amount = parseFloat((row['amount'] || '0').replace(/,/g, ''));
    }
    if (type !== 'income' && type !== 'expense') { console.log('Skipped type', i, 'type:', type, 'crDr:', crDr); skipped++; continue; }
    if (!amount || amount <= 0) { console.log('Skipped amount', i, 'amount:', amount); skipped++; continue; }
    imported++;
}
console.log('Imported:', imported, 'Skipped:', skipped);
