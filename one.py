import csv
import sys
import os
import argparse

# ANSI color codes for pretty CLI output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def infer_category(name):
    name_lower = name.lower()
    if any(k in name_lower for k in ['zomato', 'swiggy', 'restaurant', 'cafe', 'food']):
        return 'Mess/Food'
    if any(k in name_lower for k in ['jio', 'airtel', 'recharge', 'vi', 'mobile']):
        return 'Mobile Recharge'
    if any(k in name_lower for k in ['amazon', 'flipkart', 'myntra', 'mart', 'shop', 'store', 'kirana']):
        return 'Shopping'
    if any(k in name_lower for k in ['uber', 'ola', 'rapido', 'auto', 'travel', 'irctc']):
        return 'Transportation'
    if any(k in name_lower for k in ['hospital', 'pharmacy', 'medical', 'clinic']):
        return 'Medical'
    if any(k in name_lower for k in ['book', 'stationery', 'print', 'photocopy']):
        return 'Stationery'
    if any(k in name_lower for k in ['movie', 'cinema', 'netflix', 'prime']):
        return 'Entertainment'
    if any(k in name_lower for k in ['hostel', 'pg', 'rent']):
        return 'Hostel'
    if any(k in name_lower for k in ['institute', 'college', 'school', 'fee']):
        return 'College Fees'
    return 'Miscellaneous'

def clean_transaction_details(details):
    if details.startswith("Paid to "):
        return details.replace("Paid to ", "", 1)
    elif details.startswith("Received from "):
        return details.replace("Received from ", "", 1)
    elif details.startswith("Mobile recharged "):
        return details.replace("Mobile recharged ", "Recharge ", 1)
    return details

def process_file(file_path, output_dir="Clean", verbose=False):
    file_path = file_path.strip('"\'')
    if not os.path.exists(file_path):
        print(f"{Colors.FAIL}Error: Could not find file at '{file_path}'{Colors.ENDC}")
        sys.exit(1)

    print(f"{Colors.BLUE}Processing: {file_path}{Colors.ENDC}")
    duration_str = "Cleaned_Transactions"
    cleaned_rows = []
    
    total_debit = 0.0
    total_credit = 0.0
    
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        lines = list(reader)

        for row in lines:
            if len(row) > 1 and row[0] == "Duration":
                duration_str = row[1].replace(" - ", "_to_").replace(" ", "_").replace(",", "")
                break
        
        header_idx = 0
        for idx, row in enumerate(lines):
            if len(row) > 0 and row[0] == "Date":
                header_idx = idx
                break
        
        headers = lines[header_idx]
        col_idx = {h: i for i, h in enumerate(headers)}
        
        required_cols = ['Date', 'Time', 'Transaction Details', 'Transaction Type', 'Amount']
        for col in required_cols:
            if col not in col_idx:
                print(f"{Colors.FAIL}Error: Missing required column '{col}' in CSV.{Colors.ENDC}")
                sys.exit(1)

        for row in lines[header_idx + 1:]:
            if len(row) < len(headers) or not row[0]: continue
            
            # Stop processing if we hit the footer disclaimer
            if "automatically generated statement" in row[0] or "Disclaimer" in row[0]:
                break
                
            date = row[col_idx['Date']]
            time = row[col_idx['Time']]
            details = row[col_idx['Transaction Details']]
            txn_type = row[col_idx['Transaction Type']]
            amount_str = row[col_idx['Amount']]
            
            try:
                amount_val = float(amount_str.replace(',', ''))
            except ValueError:
                amount_val = 0.0
                
            if txn_type.upper() == "DEBIT":
                total_debit += amount_val
                credit_debit = "Debit"
            else:
                total_credit += amount_val
                credit_debit = "Credit"
                
            towhome = clean_transaction_details(details)
            category = infer_category(towhome)

            cleaned_rows.append({
                'Date': date, 'Time': time, 'Amount': amount_str,
                'Credit/Debit': credit_debit, 'To/From': towhome, 'Category': category
            })

            if verbose:
                color = Colors.FAIL if credit_debit == "Debit" else Colors.GREEN
                print(f"  {date} | {towhome[:20]:<20} | {category:<15} | {color}{credit_debit} Rs.{amount_str}{Colors.ENDC}")

    os.makedirs(output_dir, exist_ok=True)
    out_filename = f"{duration_str}.csv"
    out_path = os.path.join(output_dir, out_filename)
    out_headers = ['Date', 'Time', 'Amount', 'Credit/Debit', 'To/From', 'Category']

    with open(out_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=out_headers)
        writer.writeheader()
        writer.writerows(cleaned_rows)

    print(f"\n{Colors.BOLD}{Colors.GREEN}[Success] Cleaned file saved to: {out_path}{Colors.ENDC}")
    print(f"{Colors.HEADER}--- SUMMARY ---{Colors.ENDC}")
    print(f"Total Transactions : {Colors.BOLD}{len(cleaned_rows)}{Colors.ENDC}")
    print(f"Total Money Spent  : {Colors.FAIL}Rs.{total_debit:,.2f}{Colors.ENDC}")
    print(f"Total Money Earned : {Colors.GREEN}Rs.{total_credit:,.2f}{Colors.ENDC}")
    print("-" * 15 + "\n")

def main():
    parser = argparse.ArgumentParser(
        description="CLI Tool to parse and clean PhonePe CSV statements for Expense Tracker.",
        epilog="Example: python one.py statement.csv -o ./MyFolder -v"
    )
    
    parser.add_argument("input_file", nargs="?", help="Path to the raw PhonePe CSV file")
    parser.add_argument("-o", "--output", default="Clean", help="Directory to save the cleaned CSV (default: ./Clean/)")
    parser.add_argument("-v", "--verbose", action="store_true", help="Print detailed row-by-row extraction info")
    
    args = parser.parse_args()
    
    if not args.input_file:
        print(f"{Colors.WARNING}No input file provided via arguments.{Colors.ENDC}")
        file_path = input(f"{Colors.BOLD}Please paste the file path to your PhonePe CSV:{Colors.ENDC} ").strip()
        if not file_path:
            print("Operation cancelled.")
            sys.exit(0)
    else:
        file_path = args.input_file

    process_file(file_path, output_dir=args.output, verbose=args.verbose)

if __name__ == "__main__":
    main()
