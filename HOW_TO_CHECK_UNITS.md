# How to Check Which Units Are Being Loaded

## Problem
You have 132 units (131 valid + 1 invalid "ferfef") in your file, but the program only finds 47 units.

## Why This Happens
The current `Units.xlsx` file in the project only contains 47 units. You need to provide your actual Excel file with all 132 units.

## How to Check What Units Are Being Loaded

### Method 1: Show All Units
```bash
npm run validate -- --skip-validation --show-all
```

This will:
- Load units from Units.xlsx
- Display ALL unit codes found
- Skip the validation step (fast)
- Show you exactly what the program is reading

### Method 2: Check the Excel File Directly
```bash
node << 'SCRIPT'
const xlsx = require('xlsx');
const wb = xlsx.readFile('Units.xlsx');
wb.SheetNames.forEach(sheetName => {
    const sheet = wb.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, {header: 1});
    console.log(`Sheet: ${sheetName}`);
    console.log(`Rows: ${data.length}`);
});
SCRIPT
```

## Your Options

### Option 1: Replace Units.xlsx
Replace the current `Units.xlsx` file with your actual file containing all 132 units.

### Option 2: Use Different File
```bash
npm run validate MyUnits.xlsx
```

### Option 3: Create Excel from Text List
If you have a text file with unit codes (one per line):

```bash
# Create units.txt with one code per line:
ACMWHS401
AHCBUS407
... (all your codes)
ferfef

# Then run a converter script (I can create this)
```

## Current Situation

**Current Units.xlsx contains**:
- 47 total units
- Includes: MARA022, MARA024, MARB027, ...ferfef
- Missing: ACMWHS401, AHCBUS407, SFIAQU*, and many others

**Your actual file should contain**:
- 132 total units
- 131 valid units (ACMWHS401, AHCBUS407, etc.)
- 1 invalid unit (ferfef)

## Solution

**Replace Units.xlsx with your actual file** or provide the complete list and I'll create the correct Excel file for you.

## Verification

After replacing the file, run:
```bash
npm run validate -- --skip-validation --show-all
```

You should see:
- "Found 132 unique unit codes"
- List showing all 132 units
- Including "ferfef" at the end

Then run actual validation:
```bash
npm run validate
```

Expected output:
- Valid: 131 units
- Invalid: 1 unit (ferfef)
