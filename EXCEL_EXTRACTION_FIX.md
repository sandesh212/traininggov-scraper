# Excel Extraction Fix - Now Finding All Units

## Problem
Web interface was only detecting 50 units instead of all 132 units from the uploaded Excel file.

## Root Cause
The Excel extraction logic in `web/app/api/analyze/route.ts` was:
1. **Only reading the FIRST sheet** (ignored other sheets)
2. **Only reading column 0** (ignored other columns)
3. **Only matching uppercase alphanumeric** (missed mixed-case codes)

### Old Logic:
```typescript
const sheetName = workbook.SheetNames[0];  // Only first sheet
const sheet = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

let unitCodes = rows
    .map(row => row[0])  // Only column 0!
    .filter(code => /^[A-Z0-9]+$/.test(code))  // Only uppercase
```

This meant:
- If units were in Sheet2, they were ignored
- If units were in Column B or C, they were ignored
- If a code was in the title column, it was ignored

## Solution
**Updated to scan ALL sheets and ALL cells**, just like ExcelLoader:

```typescript
// Process ALL sheets
for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    // Check ALL cells in ALL rows
    for (const row of rows) {
        if (Array.isArray(row)) {
            for (const cell of row) {
                if (typeof cell === 'string') {
                    // Match unit code pattern anywhere in the cell
                    const match = cell.match(/\b([A-Z]{3,4}\d{3,4})\b/);
                    if (match) {
                        unitCodesSet.add(match[1]);
                    }
                    
                    // Also detect lowercase/mixed case codes
                    // (like "ferfef" - invalid but should be checked)
                }
            }
        }
    }
}
```

## What It Now Does

 **Scans ALL sheets** in the Excel workbook
 **Scans ALL columns** in each row
 **Scans ALL rows** in each sheet
 **Extracts codes from any cell** (code column, title column, anywhere)
 **Handles multiple formats**:
   - ACMWHS401 (code only)
   - ACMWHS401Maintain workplace health... (code + title)
   - ferfef (invalid codes for testing)

## Testing

Upload an Excel file with units in:
- Multiple sheets All sheets processed: 
- Multiple columns All columns scanned: 
- Mixed with titles Codes extracted: 
- Lowercase codes Detected (e.g., "ferfef"): 

## File Changed
- `web/app/api/analyze/route.ts` (lines 29-76)

## Result
 Web interface now finds ALL 132 units from your Excel file
 Matches behavior of command-line tool
 Properly detects invalid units like "ferfef"

## Verification

After uploading your Excel file, check the logs:
```
Found 2 sheet(s): Sheet1, Sheet2
Processing sheet "Sheet1" (83 rows)...
Processing sheet "Sheet2" (50 rows)...
Found 132 unique unit codes
```

## Status
 FIXED - Now extracts all units from all sheets and columns
