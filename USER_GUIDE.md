# Training.gov.au Unit Scraper - User Guide

## 📋 What This Program Does

Automatically scrapes Unit of Competency data from training.gov.au and exports to a beautifully formatted Excel file with:
- ✅ All unit details (code, title, release, status)
- ✅ Elements and Performance Criteria
- ✅ Performance Evidence & Knowledge Evidence  
- ✅ Assessment Conditions
- ✅ Color-coded Excel with visual hierarchy
- ✅ Automatic retry for network errors
- ✅ Skip invalid unit codes (404s)
- ✅ **No duplicates** - always updates existing units with fresh data
- ✅ **Auto-creates folders and files** as needed
- ✅ **Auto-installs dependencies** on first run
- ✅ **Dynamic code matching** — provide codes with or without suffixes; the program tries common variations (e.g., `RIIWHS202` resolves to `RIIWHS202D/E`).

## 🚀 Quick Start (One-Click)

### **First Time Setup (Optional)**

If you want to ensure everything is ready before running:

**Mac/Linux:**
```bash
./setup.sh
```

**Windows:**
```
Double-click setup.bat
```

This will:
- ✅ Check Node.js installation
- ✅ Install all dependencies
- ✅ Create data folder
- ✅ Make scripts executable

### **Running the Scraper**

### **For Mac/Linux:**
1. **Place your Excel file with unit codes** in the same folder
   - Name it `Units.xlsx` OR any name you prefer
2. **Double-click `START.sh`**
3. **Wait** for completion (you'll see progress in the terminal)
4. **Find results** in `data/UnitsData.xlsx`

### **For Windows:**
1. **Place your Excel file with unit codes** in the same folder
   - Name it `Units.xlsx` OR any name you prefer
2. **Double-click `START.bat`**
3. **Wait** for completion (you'll see progress in the command prompt)
4. **Find results** in `data/UnitsData.xlsx`

**Note:** On first run, dependencies will be installed automatically (1-2 minutes). Subsequent runs will be faster.

## 📁 What Gets Created Automatically

The program automatically creates everything it needs:

```
your-folder/
├── START.sh                    ← Double-click on Mac/Linux
├── START.bat                   ← Double-click on Windows
├── Units.xlsx                  ← YOUR INPUT (only thing you provide)
└── data/                       ← AUTO-CREATED
    ├── uoc.jsonl              ← AUTO-CREATED (raw data, no duplicates)
    ├── UnitsData.xlsx         ← AUTO-CREATED (formatted output)
    └── error-log.json         ← AUTO-CREATED (if errors occur)
```

**You only need to provide: `Units.xlsx` with unit codes**

Everything else is created automatically!

## 📊 Your Input File (Units.xlsx)

Your Excel file can have **any structure**. The program automatically:
- ✅ Scans **all sheets**
- ✅ Finds unit codes in **any column**
- ✅ Extracts valid codes like: `MARA022`, `BSBTWK201`, `HLTAID011`
- ✅ **Filters out invalid codes** (SCUBA, HACC, etc.)

### Supported Formats (all work automatically!)

**Format 1: Simple list**
```
Unit Code
---------
MARA022
BSBTWK201
HLTAID011
```

**Format 2: Table with multiple columns**
```
| Description        | Code      | Notes      |
|--------------------|-----------|------------|
| Maritime unit      | MARA022   | Important  |
| Business unit      | BSBTWK201 | Review     |
```

**Format 3: Mixed text**
```
Notes
-----
Need to fetch MARA022 and BSBTWK201 for training
Also check HLTAID011 from last semester
```

**All formats work!** The program uses smart pattern matching.

Tip: You can write unit codes without their trailing letter/number. The program will attempt common suffixes automatically to match current training.gov.au codes.

## 🔄 How Duplicates Are Handled

### **JSONL Data File (data/uoc.jsonl)**
- **If unit exists**: Old entry is **removed** and replaced with new data
- **If unit is new**: Added to the file
- **Result**: No duplicates, always latest data

### **Excel Output (data/UnitsData.xlsx)**
- **If unit exists**: All old rows for that unit are **removed** before adding new data
- **If unit is new**: Added to the file
- **Result**: No duplicates, always latest data

### **Example Scenario:**
```
Run 1: Scrape MARA022, BSBTWK201
       → Creates UnitsData.xlsx with 2 units

Run 2: Scrape MARA022 (again), HLTAID011 (new)
       → Removes old MARA022 data
       → Adds fresh MARA022 data
       → Adds HLTAID011
       → Result: 3 units, no duplicates
```

## 🔄 Automatic Retry Logic

### **Network Errors** (temporary)
- ✅ Automatically retried up to **3 times**
- ✅ 5-second delay between attempts
- ✅ Progress tracked in `error-log.json`
- ✅ Continues on next run

### **Invalid Unit Codes** (permanent 404s)
- ❌ Marked as invalid and skipped
- ❌ Not retried (waste of time)
- ❌ Listed in `error-log.json`
- ❌ Examples filtered: SCUBA, HACC (not real unit codes)

### **How It Works:**
1. First run: Tries all units
2. Network error occurs → saved to `error-log.json`
3. Next run: Automatically retries failed units
4. After 3 attempts: Gives up, marks as persistent error

## 📈 Output Files

### **1. data/UnitsData.xlsx** (Main output)

- 📊 Maritime-format workbook with 7 sheets (ESS, Deck, Navigation, Engineering, LROCP, DMLA, Assessment Conditions)
- 🎨 Two-row headers with merged category cells; white header text; zebra striping and borders
- 📝 Performance/Knowledge Evidence grouped; Assessment Conditions preserved with bullets/line breaks
- ✅ Ready for review/mapping; Mapping Count uses `SUMPRODUCT` to count only cells with actual values in the same row (excludes empty, null, and 0)
- 🔄 **Always up-to-date** — existing units replaced, not duplicated

**Columns (mapping sheets):**

- Unit
- Element
- Criteria/Evidence
- Performance Criteria
- AMPA Conditions (if applicable)
- Mapping Count
- Assessment columns (vary per sheet)

### **2. data/uoc.jsonl** (Raw data)
- One JSON object per line
- Complete unit data
- 🔄 **No duplicates** - existing units updated automatically
- Easy to process programmatically

### **3. data/error-log.json** (Error tracking - if errors occur)
- Invalid units (404s)
- Network errors with retry count
- Timestamp and details

## 🎯 Unit Code Validation

The program automatically filters out invalid codes:

**✅ Valid Examples:**
- `MARA022` - 3 letters + 3 digits
- `BSBTWK201` - 3 letters + TWK + 3 digits
- `HLTAID011` - 3 letters + AID + 3 digits

**❌ Filtered Out (not real unit codes):**
- `SCUBA` - common word
- `HACC` - too short, no digits
- `TAFE` - organization name
- `DIPLOMA` - qualification level

**Validation Rules:**
- 6-12 characters total
- Starts with 2-4 uppercase letters
- Contains at least 3 digits
- Ends with a digit
- Not in exclusion list

## ⚙️ Advanced Options (Optional)

### Command Line Usage

```bash
# Basic usage (uses Units.xlsx)
npx tsx src/autoSync.ts

# Custom input file
npx tsx src/autoSync.ts --input MyUnits.xlsx

# Custom output file
npx tsx src/autoSync.ts --output Results.xlsx

# Specific column name
npx tsx src/autoSync.ts --column "Unit Code"

# Force re-scrape everything (ignore existing data)
npx tsx src/autoSync.ts --force

# Combine options
npx tsx src/autoSync.ts --input MyUnits.xlsx --output Results.xlsx --force
```

### Configuration Options

Edit scripts if needed to customize:

```typescript
const config = {
  inputExcel: 'Units.xlsx',      // Your Excel file with codes
  inputColumn: '',               // Blank = scan all columns
  outputExcel: 'UnitsData.xlsx', // Output file name
  dataDir: 'data',               // Folder for all output
  maxRetries: 3,                 // Retry attempts for errors
  retryDelay: 5000,              // Delay between retries (ms)
  autoRetry: true                // Auto-retry on network errors
};
```

## 🐛 Troubleshooting

### **Problem: "Units.xlsx not found"**
**Solution:** 
- Place `Units.xlsx` in the same folder as `START.sh` or `START.bat`
- OR use any file name and run: `npx tsx src/autoSync.ts --input YourFile.xlsx`

### **Problem: "Node.js is not installed"**
**Solution:** 
- Install Node.js from https://nodejs.org/ (v18 or higher)
- Restart your terminal/command prompt

### **Problem: "Network timeout" or "Connection closed"**
**Solution:** 
- Check internet connection
- Run again - **program automatically retries** failed units
- Failed units tracked in `error-log.json`
- After 3 attempts, marked as persistent error

### **Problem: Some units showing "Invalid (404)"**
**Solution:** 
- These unit codes **don't exist** on training.gov.au
- Check spelling in your Units.xlsx
- Unit might be superseded or deleted
- See `data/error-log.json` for full list

### **Problem: "Browser launch failed" or "Chromium error"**
**Solution:** 
- Close other applications to free memory
- Ensure you have internet access
- On first run, Playwright downloads Chromium automatically
- Check disk space (needs ~300MB for browser)

### **Problem: Getting duplicate entries**
**Solution:** 
- **This should not happen** - duplicates are automatically prevented
- If you see duplicates, ensure you're using the latest version
- Delete `data/uoc.jsonl` and `data/UnitsData.xlsx` to start fresh

## 📊 Example Runs

### First Time (New Units)
```
� Starting Unit Sync...

🔍 Extracted 5 potential unit codes from Excel
   Units: MARA022, BSBTWK201, HLTAID011, SCUBA, HACC

📋 Found 0 units already in output Excel

🆕 MARA022: New unit - will scrape
🆕 BSBTWK201: New unit - will scrape
🆕 HLTAID011: New unit - will scrape
❌ SCUBA: Filtered (invalid pattern)
❌ HACC: Filtered (invalid pattern)

🌐 Validating and scraping 3 units...

✅ MARA022 - Manage loading, discharging and stowing of cargo
   Elements: 6, Performance Evidence: ✓, Knowledge Evidence: ✓

✅ BSBTWK201 - Work effectively with others
   Elements: 3, Performance Evidence: ✓, Knowledge Evidence: ✓

✅ HLTAID011 - Provide First Aid
   Elements: 4, Performance Evidence: ✓, Knowledge Evidence: ✓

📊 Excel file saved: data/UnitsData.xlsx
   New rows added: 156
   Total rows: 156

✨ Sync complete!
```

### Update Existing Units
```
🔄 Starting Unit Sync...

🔍 Extracted 4 potential unit codes from Excel
   Units: MARA022, BSBTWK201, CPCCWHS1001

� Found 2 units already in output Excel
   Existing: MARA022, BSBTWK201

✓  MARA022: Already exists - skipping
✓  BSBTWK201: Already exists - skipping
🆕 CPCCWHS1001: New unit - will scrape

🌐 Validating and scraping 1 unit...

✅ CPCCWHS1001 - Prepare to work safely in the construction industry
   Elements: 4, Performance Evidence: ✓, Knowledge Evidence: ✓

� Found 2 existing units in Excel
   Keeping: 2 units
   Updating: 0 units

📊 Excel file saved: data/UnitsData.xlsx
   Previous rows: 156
   New rows added: 48
   Total rows: 204

✨ Sync complete!
```

## 💡 Tips & Best Practices

1. **Keep Units.xlsx simple** - Just paste your codes, program handles the rest
2. **Run periodically** - Program only scrapes new/updated units
3. **Check error-log.json** - See which units failed and why
4. **Use --force sparingly** - Only when you need to refresh all data
5. **Backup your data** - Copy `data/` folder before major changes
6. **Internet required** - Program needs to access training.gov.au
7. **Be patient** - Scraping 130 units takes ~5-8 minutes with optimization
8. **Performance optimized** - Validates 5 units concurrently, scrapes 3 at a time

## ⚡ Performance Optimizations

The program includes several speed optimizations:

**Concurrent Validation**: Checks 5 units simultaneously instead of one-by-one
**Concurrent Scraping**: Scrapes 3 units at once (3x faster)
**Reduced Delays**: 1 second between requests (was 3 seconds)
**Smart Caching**: HTML cached during validation, reused for scraping
**Skip Existing**: Only processes new units

**Speed Comparison:**
- Old: ~15-20 minutes for 130 units (sequential)
- New: ~5-8 minutes for 130 units (concurrent)

## 📞 Support

If you encounter issues:
1. Check this guide's Troubleshooting section
2. Look at `data/error-log.json` for detailed error info
3. Ensure you have the latest Node.js version
4. Try deleting `data/` folder and starting fresh

## 🔧 Requirements

- **Node.js**: v18 or higher ([Download](https://nodejs.org/))
- **Internet**: Active connection to training.gov.au
- **Disk Space**: ~500MB for dependencies + data
- **RAM**: 2GB minimum recommended

## 📄 License

Free to use for educational and commercial purposes.

## 🆘 Support

For issues or questions:
1. Check `error-log.json` for details
2. Verify `Units.xlsx` format
3. Ensure internet connection is stable
4. Try running again (auto-retry will handle temporary errors)

---

**Made with ❤️ for Australian training professionals**
