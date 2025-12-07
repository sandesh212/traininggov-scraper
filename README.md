# Training.gov.au Scraper (Maritime Excel Format)

Automated scraper for extracting Units of Competency from training.gov.au with intelligent code matching, duplicate detection, and maritime-format Excel export.

## 🚀 Quick Start

**One-Click Execution:**
- **Mac/Linux**: Double-click `START.sh` or `RUN_SCRAPER.command`
- **Windows**: Double-click `START.bat`

Or run manually:
```bash
npm install
npm start
```

## ✨ Key Features

- **🔍 Smart Code Extraction**: Reads unit codes from Excel, scans **all cells including first row**
- **⚠️ Duplicate Detection**: Warns and logs duplicate codes (e.g., "SFIFSH301 appeared 2 times")
- **🔄 Dynamic Code Matching**: Handles variations (suffixes A-F/1-2, E-prefix like EACMWHS401)
- **🔎 Search Fallback**: Queries training.gov.au when direct lookup fails
- **📊 Maritime Excel Format**: 7-sheet workbook with professional assessment mapping structure
- **✅ Smart Formulas**: Mapping Count shows **blank** when empty (not 0), counts only non-zero/non-empty values
- **🤖 Multi-Strategy Parser**: Adapts to HTML variations, preserves line breaks and bullets
- **📝 Comprehensive Logging**: Tracks errors, duplicates, and invalid codes in `error-log.json`

## 📁 Project Structure

```
traininggov-scraper/
├── src/
│   ├── index.ts                    # Manual scraping entry point
│   ├── autoSync.ts                 # Automatic sync with Excel input (main workflow)
│   ├── crawler.ts                  # Orchestrates scraping process
│   ├── fetcher.ts                  # HTTP requests with Puppeteer
│   ├── parsers/
│   │   └── uocParser.ts           # Multi-strategy HTML parser
│   ├── models/
│   │   ├── uoc.ts                 # UOC data structure
│   │   └── scrapeResult.ts        # Scrape result types
│   ├── services/
│   │   ├── exportService.ts       # JSONL export
│   │   └── maritimeExcelService.ts # Maritime Excel generation
│   └── utils/
│       └── requestUtils.ts        # HTTP utilities
├── tests/
│   ├── uocParser.test.ts          # Parser tests
│   └── maritimeExcelService.test.ts # Excel generation tests
├── data/
│   ├── Units.xlsx                 # INPUT: Unit codes to scrape
│   ├── uoc.jsonl                  # OUTPUT: Scraped data (raw)
│   ├── UnitsData.xlsx             # OUTPUT: Maritime format workbook
│   └── error-log.json             # Errors, duplicates, invalid codes
├── RUN_SCRAPER.command            # Mac one-click launcher
├── START.bat / START.sh           # Cross-platform runners
├── package.json
└── tsconfig.json
```

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/sandesh212/traininggov-scraper.git
cd traininggov-scraper

# Install dependencies
npm install

# Build the project
npm run build
```

**Requirements:**
- Node.js 18+
- npm or yarn
- Chrome/Chromium (for Puppeteer headless browsing)

## 🎯 Usage

### Automatic Scraping (Recommended)

1. **Prepare Input**: Add unit codes to `data/Units.xlsx` (any sheet, any cell position)
   ```
   MARK007  MARH013  SFIAQU101
   MARB027  MARA022  BSBLDR301
   ```

2. **Run Scraper**:
   - **Mac**: Double-click `RUN_SCRAPER.command`
   - **Windows**: Double-click `START.bat`
   - **Terminal**: `npm start`

3. **Output**:
   - `data/uoc.jsonl` - Raw scraped data (one JSON per line)
   - `data/UnitsData.xlsx` - Maritime format Excel (7 sheets)
   - `data/error-log.json` - Errors, duplicates, invalid codes

The scraper will:
- ✅ Extract all codes from Excel (scans every cell including row 1)
- ✅ Detect and log duplicates with warnings
- ✅ Try code variations if direct lookup fails
- ✅ Fall back to training.gov.au search for difficult cases
- ✅ Generate maritime Excel with smart formulas

### Manual Scraping

Scrape specific units by URL:

```bash
# Single unit
npx tsx src/index.ts https://training.gov.au/training/details/MARK007/unitdetails

# Multiple units
npx tsx src/index.ts \
  https://training.gov.au/training/details/MARK007/unitdetails \
  https://training.gov.au/training/details/MARH013/unitdetails
```

### CLI Options

```bash
# Custom input/output files
npx tsx src/autoSync.ts --input MyUnits.xlsx --output Results.xlsx
```

## 📊 Output Formats

### JSONL Format (`data/uoc.jsonl`)
- One JSON object per line (easy streaming/processing)
- Complete structured data: elements, criteria, evidence, conditions
- Preserves all nested structures
- Example:
  ```json
  {"code":"MARK007","title":"Handle a vessel up to 12 metres","elements":[...],"performanceEvidence":"...","knowledgeEvidence":"..."}
  ```

### Maritime Excel Format (`data/UnitsData.xlsx`)

**7-sheet workbook** matching maritime training assessment structure:

| Sheet | Purpose | Filter Prefixes |
|-------|---------|----------------|
| **ESS Mapping** | Essential Safety Skills | MARF |
| **Deck Mapping** | Deck operations | MARC, MARJ, MARI, MARK, MARN |
| **Navigation Mapping** | Navigation units | MARH |
| **Engineering Mapping** | Engineering units | MARB |
| **LROCP Mapping** | Launch, Rescue, Operations | MARO, MARL |
| **DMLA** | Diploma of Maritime Leadership | MAR (all) |
| **Assessment Conditions** | Simplified conditions view | MAR (all) |

**Column Structure** (mapping sheets):
1. **Unit** - Code + title (merged across unit rows)
2. **Element** - Numbered elements (1., 2., etc.)
3. **Criteria/Evidence** - PC numbers (1.1, 1.2), P1/K1 for evidence
4. **Performance Criteria** - Full PC text, evidence bullets
5. **AMPA Conditions** - Assessment requirements (optional per sheet)
6. **Mapping Count** - Smart formula (see below)
7. **Assessment Columns** - RTO-specific blank columns for manual entry

**Mapping Count Formula:**
```excel
IF(SUMPRODUCT(--((range<>"")*(range<>0)))=0,"",SUMPRODUCT(--((range<>"")*(range<>0))))
```
- Counts only **non-empty, non-zero** assessment values
- Shows **blank** when count is 0 (not "0")
- Automatically spans all assessment columns in the row

**Features:**
- ✨ Two-row headers with merged Knowledge/Performance categories
- 🎨 Blue/white alternating row colors per unit
- 🔲 Professional borders (#8EA8DB blue, #D4D4D4 grey)
- 🧊 Freeze top 2 header rows
- 🔍 Auto-filters on second header row
- 📏 Dynamic column widths based on content
- 🎯 Category color coding (Knowledge: grey #808080, Performance: yellow #FFD966)

## 🔧 Advanced Features

### Duplicate Detection

Automatically detects and logs duplicate codes in Excel:

```
⚠️  Duplicate codes found (these were deduplicated):
   - SFIFSH301 (appeared 2 times)
```

Saved to `data/error-log.json`:
```json
{
  "timestamp": "2025-11-19T00:24:32.334Z",
  "summary": {
    "totalChecked": 132,
    "valid": 131,
    "duplicates": 1
  },
  "duplicates": [
    {
      "code": "SFIFSH301",
      "occurrences": 2,
      "note": "This code appeared multiple times in the Excel file but was only processed once"
    }
  ]
}
```

### Dynamic Code Matching

If direct lookup fails, automatically tries:

1. **Suffix variations**: A-F, 1-2
   - `RIIWHS202` → tries `RIIWHS202A`, `RIIWHS202B`, ..., `RIIWHS202E`
2. **E-prefix**: Adds leading 'E'
   - `ACMWHS401` → tries `EACMWHS401`
3. **Search fallback**: Queries training.gov.au search and validates first result
   - Ensures matched URL contains correct unit code

**Example console output:**
```
[50/132] 🔍 Checking: RIIWHS202...
   ⚠️  404 error - trying variations...
   ✅ Found via suffix: RIIWHS202E
```

### Error Logging

`data/error-log.json` comprehensively tracks:
- **Invalid units**: 404s, non-existent codes
- **Errors**: Network failures, parsing issues  
- **Duplicates**: Codes appearing multiple times
- **Summary**: Total checked, valid, invalid, error counts

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test file
npx vitest tests/uocParser.test.ts

# Watch mode
npx vitest --watch
```

**Test Coverage:**
- ✅ UOC Parser: Multi-strategy HTML parsing, bullet preservation
- ✅ Maritime Excel: Formula generation, row structure, styling, merged headers
- ✅ 13/13 tests passing

## 🛠️ Configuration

### Input Excel Settings

Edit in `src/autoSync.ts`:
```typescript
const config: SyncConfig = {
  inputExcel: 'data/Units.xlsx',  // Excel file with codes
  inputColumn: 'Unit Code',       // Not used (scans all cells)
  outputExcel: 'UnitsData.xlsx',
  dataDir: 'data',
  maxRetries: 3,                  // Retry failed units
  retryDelay: 5000                // 5 seconds between retries
};
```

### Excel Sheet Configuration

Edit in `src/services/maritimeExcelService.ts`:
```typescript
{
  name: 'Deck Mapping',
  hasAMPAConditions: true,
  mappingCountLabel: 'Mapping Count',
  filterPrefixes: ['MARC', 'MARJ', 'MARI', 'MARK', 'MARN'],
  assessmentColumns: [
    'Knowledge Coxswain Deck',
    'Seamanship Knowledge',
    'Watchkeeping (Open book)',
    'Watchkeeping (Closed book)',
    'Vessel',
    'Classroom',
    'Readiness for assessment'
  ],
  knowledgeColumns: ['Knowledge Coxswain Deck', ...],
  showCategories: true
}
```

## 📝 Troubleshooting

### "Error: Chromium not found"
```bash
npm install puppeteer --force
```

### "No codes extracted from Excel"
- ✓ Check file path: `data/Units.xlsx` must exist
- ✓ Ensure codes are visible text (not formulas returning blank)
- ✓ Codes must match pattern: 2-4 letters + 3+ digits (e.g., MARK007, SFIAQU101)
- ✓ Valid examples: BSBLDR301, RIIWHS202E, EACMWHS401

### "Unit not found (404)"
- ✓ Check if code exists on training.gov.au
- ✓ Try manual search: https://training.gov.au/Search/Training
- ✓ Invalid codes are logged to `data/error-log.json`
- ✓ Scraper tries variations automatically (suffixes, E-prefix)

### "Mapping Count shows 0 instead of blank"
- ✓ Ensure you've pulled latest code (formula updated Nov 2025)
- ✓ Rebuild: `npm run build`
- ✓ Delete old `data/UnitsData.xlsx` and re-run

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Run tests (`npm test`)
5. Push to branch (`git push origin feature/amazing-feature`)
6. Open Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- [Training.gov.au](https://training.gov.au) for providing public UOC data
- [Puppeteer](https://pptr.dev/) for headless browser automation
- [xlsx-js-style](https://github.com/gitbrent/xlsx-js-style) for Excel generation with styling
- Maritime training providers for Excel format specification

---

**Latest Updates (Nov 2025):**
- ✅ First-row Excel scanning (no codes missed)
- ✅ Duplicate detection and logging
- ✅ Blank Mapping Count when empty (not 0)
- ✅ Enhanced code variation matching
- ✅ Search fallback for difficult codes
