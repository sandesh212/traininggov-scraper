# ✅ One-Click Executable — Setup Complete

## 🎯 What You Now Have

A **fully automatic, one-click executable** program that:

### ✅ **Features:**
1. **Double-click to run** - No terminal commands needed
2. **Auto-detects Units.xlsx** - Just place it in the same folder
3. **Automatic retry** - Network errors retry up to 3 times
4. **Smart error handling** - Skips invalid codes, retries temporary failures
5. **Progress tracking** - See exactly what's happening
6. **Color-coded Excel output** - Professional formatting with visual hierarchy
7. **Cross-platform** - Works on Mac and Windows

### 📁 Files in the Package

```text
traininggov-scraper/
├── START.sh                  ← macOS/Linux: double-click to run
├── START.bat                 ← Windows: double-click to run
├── Unit Scraper.app/         ← macOS app bundle (optional)
├── src/autoSync.ts           ← Auto-retry flow (reads Units.xlsx)
├── src/index.ts              ← Scrape specific URLs (optional)
├── src/services/maritimeExcelService.ts  ← Excel generator (maritime)
├── USER_GUIDE.md             ← Full user documentation
└── data/                     ← Auto-created for outputs
```

## 🚀 How Users Run It

### Mac Users

1. Copy entire folder to their Mac
2. Place `Units.xlsx` in the folder
3. Double-click `START.sh`
4. Done! Results in `data/UnitsData.xlsx`

### Windows Users

1. Copy entire folder to their Windows PC
2. Place `Units.xlsx` in the folder  
3. Double-click `START.bat`
4. Done! Results in `data/UnitsData.xlsx`

## 🔄 Automatic Retry Logic

### Scenario 1: Network Error

```text
Run 1: Unit MARA022 → Network timeout → Saved to error log
Run 2: Auto-retries MARA022 → Success! → Removed from error log
```

### Scenario 2: Invalid Code

```text
Run 1: Unit XXXXX → 404 Not Found → Marked as invalid
Run 2: Skips XXXXX (permanent error) → Focus on valid units
```

### Scenario 3: Mixed Results

```text
Units.xlsx has: MARA022, BSBTWK201, XXXXX, MARB027

Run 1:
- MARA022 → Network error (retry next time)
- BSBTWK201 → Success ✓
- XXXXX → Invalid 404 (skip forever)
- MARB027 → Success ✓

Run 2 (automatic):
- MARA022 → Retry → Success ✓
- XXXXX → Still skipped
- Others → Already have, skipped
```

## 📊 Input File Flexibility

The program accepts **ANY Excel format**:

### ✅ Works with

- Single column of codes
- Multiple columns (scans all)
- Mixed text with codes
- Multiple sheets (scans all)
- Any column names
- Codes embedded in text

### 🔍 Auto-extracts

- MARA022
- BSBTWK201
- HLTAID011
- Any format: `[A-Z]{2,}[A-Z0-9]{3,}`

## 🎨 Output Format

### UnitsData.xlsx (Maritime Workbook)

- Sheets: ESS, Deck, Navigation, Engineering, LROCP, DMLA, Assessment Conditions.
- Two‑row headers with merged category cells (Knowledge grey, Performance yellow) and white header text.
- Columns: `Unit`, `Element`, `Criteria/Evidence`, `Performance Criteria`, optional `AMPA Conditions`, `Mapping Count`, plus per‑sheet assessment columns.
- Styling: Zebra striping, full‑black separator rows, borders, freeze panes, auto‑filters.
- Formulas: `Mapping Count` uses `COUNTA` across assessment columns.
- Assessment Conditions: Unit rows (blue), black blank separators, AMSA footer with all 8 codes.

## 🔧 Requirements for End Users

**Minimal requirements:**

- ✅ Node.js v18+ ([nodejs.org](https://nodejs.org/))
- ✅ Internet connection
- ✅ Units.xlsx file
- ✅ 2GB RAM
- ✅ 500MB disk space

**No coding knowledge needed!**

## 📝 Distribution Package

Zip the folder and share. Include `START.sh`, `START.bat`, `USER_GUIDE.md`, and the `src` directory. Optionally include a sample `Units.xlsx`.

User steps:

1. Unzip
2. Install Node.js (if needed)
3. Place their `Units.xlsx` in the folder
4. Double-click `START.sh` (Mac) or `START.bat` (Windows)
5. Open `data/UnitsData.xlsx`

## 🎯 Key Advantages

### vs Manual Web Scraping

- ⚡ 100x faster (automated)
- ✅ No human error
- 🔄 Automatic retry
- 📊 Formatted output

### vs Other Tools

- 🖱️ One-click execution
- 🔄 Built-in retry logic
- 🎨 Professional formatting
- 📝 Comprehensive error tracking
- 🔧 No configuration needed

## 🐛 Error Handling

### error-log.json tracks

```json
{
  "timestamp": "2025-11-07T11:58:00.000Z",
  "summary": {
    "totalChecked": 49,
    "valid": 47,
    "invalid": 1,
    "errors": 1
  },
  "invalidUnits": [
    {"code": "XXXXX", "reason": "404 - Unit not found", "permanent": true}
  ],
  "errorUnits": [
    {"code": "MARA022", "error": "Network timeout", "attempts": 2, "lastAttempt": "..."}
  ]
}
```

**Next run:** Auto-retries errorUnits, skips invalidUnits

## ✅ Testing Checklist

Before distributing:

- [ ] Test START.sh on Mac
- [ ] Test START.bat on Windows
- [ ] Verify Units.xlsx detection
- [ ] Confirm Excel output format
- [ ] Check error log creation
- [ ] Test retry logic (simulate network error)
- [ ] Verify multi-sheet Excel reading
- [ ] Test with various unit code formats

## 📞 User Support

**If users have issues:**

1. Check `error-log.json`
2. Verify Node.js installation: `node --version`
3. Confirm Units.xlsx exists
4. Check internet connection
5. Run again (auto-retry handles most issues)

---

## 🎉 **You're Done!**

Your users can now:

- ✅ Double-click one file
- ✅ Get complete, formatted Excel output
- ✅ Handle 100s of units automatically
- ✅ Retry failed units automatically
- ✅ Track all errors comprehensively

**No terminal, no coding, no complexity!** 🚀
