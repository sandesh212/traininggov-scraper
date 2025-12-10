# Quick Start Guide - Updated Features

## What's New?

Three major improvements have been implemented:

1. **Unit Validation** - Pre-check units for 404 errors before scraping
2. **Performance** - Deferred image processing for faster extraction
3. **Better Question Detection** - Improved separation of questions from answers

## Quick Usage

### 1. Validate Units from Excel

```bash
# Validate all units in Units.xlsx
npm run validate

# This will create:
# - validation-report.json (full results)
# - invalid-units.txt (404 errors)
# - valid-units.txt (units that exist)
```

### 2. Understanding the Output

**invalid-units.txt** - These units don't exist on training.gov.au:
```
MARA001X: HTTP 404 - Page not found
BSBT999: Redirected to search page - unit not found
```

**valid-units.txt** - These units can be scraped:
```
MARA022
MARA024
MARA025
...
```

### 3. What Changed?

#### Before:
- Scraper tried to scrape ALL units, including 404s
- Image processing slowed down extraction
- Questions included answer text

#### After:
- Only valid units are scraped (saves time)
- Images processed only when needed (faster)
- Better question/answer separation (more accurate)

## Performance Comparison

### Old Approach:
```
Loading 100 units...
Scraping 100 units (including 20 invalid)...
Time: ~15 minutes
Result: 80 valid, 20 failed
```

### New Approach:
```
Validating 100 units... (30 seconds)
Found 80 valid, 20 invalid
Scraping 80 units...
Time: ~8 minutes
Result: 80 valid, 0 failed
```

**Savings**: ~7 minutes + better accuracy

## Question Extraction Improvements

### Old Behavior:
```
Question: "What is the safety procedure? The answer is to check all equipment first."
```

### New Behavior:
```
Question: "What is the safety procedure?"
(Answer text filtered out)
```

### Filtered Out Automatically:
- Answer indicators: "Answer:", "Solution:", "Correct answer:"
- Multiple choice options: "A.", "B.", "C.", "D."
- Answer text after question marks
- Answer lists and explanations

## Command Reference

```bash
# Validate units from Units.xlsx
npm run validate

# Skip validation (just load units)
npm run validate:skip

# Run with custom Excel file
npx tsx src/validateAndScrape.ts MyUnits.xlsx

# Skip validation for specific file
npx tsx src/validateAndScrape.ts MyUnits.xlsx --skip-validation
```

## Integration with Existing Code

### Using Pre-Validation in Your Scraper:

```typescript
import { UnitValidator } from './services/unitValidator.js';
import { ExcelLoader } from './services/excelLoader.js';

// Load units from Excel
const loader = new ExcelLoader('Units.xlsx');
const units = loader.loadUnits();

// Validate them
const validator = new UnitValidator();
const { valid, invalid } = await validator.validateUnits(
  units.map(u => u.code)
);

// Only scrape valid units
const validCodes = valid.map(v => v.code);
const scraper = new ScraperService();
const results = await scraper.scrapeUnitsWithDetails(validCodes);
```

### Using Web Scraper with Validation:

```typescript
const scraper = new ScraperService();

// With pre-validation (default, recommended)
const results = await scraper.scrapeUnitsWithDetails(codes);

// Skip pre-validation if you already validated
const results = await scraper.scrapeUnitsWithDetails(codes, true);
```

## Troubleshooting

### "No units found in Excel"
- Check that Units.xlsx is in the project root
- Ensure unit codes match pattern: 3-4 letters + 3-4 digits (e.g., MARA022)

### "All units marked as invalid"
- Check internet connection
- Verify training.gov.au is accessible
- Try with `--skip-validation` to bypass

### "Questions still include answers"
- Check document format - may need custom patterns
- Review logs to see what's being filtered
- Report specific cases for improvement

## Tips

1. **Always validate before scraping** - Saves time and reduces errors
2. **Review invalid-units.txt** - Check if units are truly invalid or just typos
3. **Keep validation reports** - Track which units are available over time
4. **Use batch processing** - Don't validate/scrape too many units at once

## Next Steps

1. Run `npm run validate` on your Units.xlsx
2. Review the invalid-units.txt file
3. Fix any typos in unit codes
4. Use valid-units.txt for scraping
5. Enjoy faster, more accurate results!

## Need Help?

- Check IMPROVEMENTS.md for detailed technical information
- Review the validation-report.json for full details
- Check logs for specific error messages
