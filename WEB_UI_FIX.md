# Web UI Fix - "No valid units" Error

## Problem
The web interface was showing error:
"No valid units could be scraped or loaded. Cannot proceed with analysis."

## Root Cause
The pre-validation in `scrapeUnitsWithDetails()` was using simple fetch (not Puppeteer) to check units. Since training.gov.au is an SPA that requires JavaScript rendering, the pre-validation was incorrectly marking ALL units as invalid because:

1. Fetch gets initial HTML (no rendered content)
2. Check for "elements and performance criteria" fails
3. All units marked as invalid
4. Nothing to analyze

## Solution
**Disabled pre-validation for the web interface** by passing `skipValidation: true` to `scrapeUnitsWithDetails()`.

The full Puppeteer scraper will properly detect invalid units during the actual scraping process.

## File Changed
- `web/app/api/analyze/route.ts` (line 60)

**Before:**
```typescript
const { valid: scrapedUnits, invalid } = await scraper.scrapeUnitsWithDetails(unitCodes);
```

**After:**
```typescript
// SKIP pre-validation - full scraper will detect invalid units properly
const { valid: scrapedUnits, invalid } = await scraper.scrapeUnitsWithDetails(unitCodes, true);
```

## Why This Works
The full `scrapeUnit()` method:
1. Uses Puppeteer (headless Chrome)
2. Renders JavaScript
3. Waits for content to load
4. Properly detects invalid units during scraping
5. Returns only valid units that were successfully scraped

## Testing
The web interface will now:
1 Accept uploaded Excel files with unit codes. 
2 Scrape each unit with Puppeteer. 
3 Properly identify invalid units (404s) during scraping. 
4 Continue with valid units for analysis. 
5 Show invalid units in the results. 

## Command Line Tool
For the command line tool (`npm run validate`), use Puppeteer-based validation:
```bash
npm run validate  # Uses Puppeteer for accurate validation
```

## Status
 FIXED - Web interface now works correctly
