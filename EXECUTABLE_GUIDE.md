# 🚀 Training.gov.au Unit Scraper - Executable Version

## Quick Start (One-Click)

### For Mac/Linux Users

1. Double-click `START.sh`

### For Windows Users

1. Double-click `START.bat`

### What happens on start

- ✅ Finds and reads `Units.xlsx`
- ✅ Extracts unit codes from all sheets
- ✅ Retries failed units (up to 3 times)
- ✅ Skips invalid units (404s)
- ✅ Generates formatted Excel output
- ✅ Saves error log for next run

---

## First-Time Setup

1. Install Node.js (if not already installed)
    - Mac: Download from <https://nodejs.org/>
    - Windows: Download from <https://nodejs.org/>
    - Verify: Open terminal/cmd and run `node --version`

2. Install dependencies (one-time only)

    ```bash
    npm install
    ```

3. Create Units.xlsx

    - Create an Excel file named `Units.xlsx` in the same folder
    - Can have multiple sheets — all will be scanned

---

## Output Files

1. `data/UnitsData.xlsx` — Main output
2. `data/uoc.jsonl` — Raw JSON data (complete structured data)
3. `data/error-log.json` — Errors and retry tracking

---

## How It Works

### Input Format (Units.xlsx)

Can be any Excel file with unit codes in ANY column or sheet, for example:

| Unit Code  | Description        |
|------------|--------------------|
| MARA022    | Manage cargo       |
| HLTAID011  | First aid          |

The program automatically finds and extracts codes like:

- `BSBTWK201`
- `MARA022`
- `HLTAID011`
- Any code matching pattern: 2+ letters + 3+ numbers

After running, you'll get:

1. `data/UnitsData.xlsx` — Main output
    - Color-coded with visual hierarchy
    - Elements and Performance Criteria
    - Knowledge Evidence
    - Performance Evidence

---

## Features

### ✅ Smart Retry Logic

- Invalid units (404): Permanently skipped
- Failed units: Will retry next run
- Attempt count tracked per failed unit

### ✅ Incremental Updates

- Only scrapes NEW units
- Skips units already in output Excel
- Appends to existing data

### ✅ Comprehensive Data

- Elements and Performance Criteria
- Knowledge Evidence (with nested lists)
- Performance Evidence (with nested lists)
- Assessment Conditions
- Foundation Skills
- Unit status, release info, etc.

### ✅ Visual Excel Formatting

- Color-coded sections
- Hierarchical indentation
- Proper borders and styling
- Easy to read and analyze

---

## Usage Examples

### Example 1 — First Run

```bash
./START.sh
```

Output:

```text
✅ Found 50 unit codes
🆕 All 50 units will be scraped
✅ Successfully scraped: 48 units
❌ Invalid: 1 unit (INVALID001 - 404)
⚠️  Failed: 1 unit (TIMEOUT001 - will retry)
```

### Example 2 — Retry Run

```bash
./START.sh
```

Output:

```text
✅ Found 50 unit codes
✓  48 units already exist
⏭️ 1 unit skipped (known invalid)
🔄 1 unit retry attempt 2/3
✅ Successfully scraped: 1 unit
```

### Example 3 — Add New Units

1. Add new codes to `Units.xlsx`
2. Run `./START.sh`
3. Only new units are scraped
4. Data appends to existing Excel

---

## Troubleshooting

### Problem: Units.xlsx not found

Solution: Create `Units.xlsx` in the same folder as `START.sh`/`START.bat`.

### Problem: Command not found: npx

Solution: Install Node.js from <https://nodejs.org/>.

### Problem: Cannot find module

Solution: Run `npm install` in the project folder.

### Problem: Units keep failing with network errors

Solution:

- Check internet connection
- Run again — failed units will retry automatically
- Maximum 3 retry attempts per unit

### Problem: Permission denied on Mac

Solution:

```bash
chmod +x START.sh
./START.sh
```

---

## File Structure

```text
traininggov-scraper/
├── START.sh          # Mac/Linux startup script
├── START.bat         # Windows startup script
├── Units.xlsx        # INPUT: Your unit codes (CREATE THIS)
├── data/
│   ├── UnitsData.xlsx      # OUTPUT: Formatted Excel
│   ├── uoc.jsonl           # OUTPUT: Raw JSON data
│   └── error-log.json      # OUTPUT: Error tracking
├── src/
│   └── autoSync.ts   # Main sync logic
└── package.json
```

---

## Advanced Options

### Custom Input/Output Files

Edit the script or create a custom config:

```typescript
const config = {
   inputExcel: 'MyUnits.xlsx',      // Your input file
   outputExcel: 'MyOutput.xlsx',    // Your output file
   dataDir: 'output',               // Output directory
   maxRetries: 5,                   // Max retry attempts
   retryDelay: 2000                 // Delay between retries (ms)
};
```

### Manual Command Line

```bash
# Default run
npx tsx src/autoSync.ts

# With custom options (edit autoSync.ts to add CLI args)
```

---

## Error Log Format

`data/error-log.json` example:

```json
{
   "timestamp": "2025-11-07T10:30:00.000Z",
   "invalidUnits": [
      {
         "code": "INVALID001",
         "reason": "Unit does not exist (404)"
      }
   ],
   "failedUnits": [
      {
         "code": "TIMEOUT001",
         "error": "Network timeout",
         "attempts": 2
      }
   ]
}
```

- invalidUnits: Permanently skipped (404 errors)
- failedUnits: Will retry next run (network errors)
- attempts: Current retry count (max 3)

---

## Tips

1. Run regularly: Failed units will automatically retry
2. Check error log: See which units failed and why
3. Multiple sheets OK: Put units in any sheet, any column
4. Mixed codes OK: BSB, MAR, HLT, RII all supported
5. Incremental: Add new units anytime, only new ones scraped

---

## Support

If you encounter issues:

1. Check `data/error-log.json` for details
2. Verify `Units.xlsx` exists and has unit codes
3. Check internet connection
4. Ensure Node.js is installed (`node --version`)
5. Try running `npm install` again

---

## What Gets Scraped

For each unit, the program extracts:

### Basic Info

- Unit code and title
- Status (Current/Superseded)
- Release number
- Application and description

### Elements & Performance Criteria

- All elements
- All performance criteria with numbers
- Properly structured and formatted

### Evidence Requirements

- Performance Evidence (with nested lists)
- Knowledge Evidence (with nested lists)
- Assessment Conditions

### Additional Info

- Foundation Skills
- Prerequisites
- Licensing/Regulatory Information
- Supersession information

### Visual Formatting

- Color-coded sections
- Hierarchical indentation (Level 0, 1, 2)
- Proper borders and styling
- Easy to read in Excel

---

## License

Internal use only.

---

## Version

v2.0 — Executable Edition with Auto-Retry

- One-click execution
- Automatic retry logic
- Smart error handling
- Incremental updates
- Production-ready
