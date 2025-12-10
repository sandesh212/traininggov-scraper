# Performance Fix Implementation Plan

## Critical Issues Identified

### 1. **Slow Unit Fetching** (PRIMARY ISSUE)
**Root Cause**: 
- Scraper uses Puppeteer (headless Chrome browser) for EVERY unit
- Browser launch overhead: ~2-5 seconds per unit
- SPA detection happens AFTER first fetch, wasting time
- Pre-validation uses fetch, then full scrape uses Puppeteer again (duplicate work)

**Current Flow (SLOW)**:
```
For each unit:
  1. Pre-validation: fetch + HTML check (~1-2s)
  2. Scraper: Detect SPA → Launch Puppeteer → Wait for render (~3-5s)
  3. Total: ~4-7 seconds PER UNIT
  
  10 units = 40-70 seconds
  50 units = 200-350 seconds (3-6 minutes!)
```

**Solution**: Shared browser + smart caching + batch processing
```
ONE TIME: Launch browser (3s)
For batch of units in parallel:
  1. Skip pre-validation (training.gov.au is SPA anyway)
  2. Reuse browser instance
  3. Process 5-10 units concurrently
  4. Total: ~5-8 seconds for 10 units
  
  10 units = 5-8 seconds (6x faster)
  50 units = 25-40 seconds (8x faster)
```

### 2. **Red Text Not Being Used** 
**Root Cause**:
- New red text extraction logic exists in `docxQuestionExtractor.ts`
- But `analyze/route.ts` doesn't return or display the red text data
- Web UI doesn't have section to show red text debug info

**Solution**: Return red text in API response + display in UI

### 3. **Not Fetching All Units**
**Root Cause**:
- Excel extraction regex is too strict: `/^([A-Z]{3,}[0-9]{3,})$/`
- Misses units like: "MARA022 " (trailing space), mixed case, etc.
- Also the pre-validation is incorrectly marking valid units as 404

**Solution**: More flexible regex + remove faulty pre-validation

## Implementation

### Fix 1: Optimize Scraper Performance

#### A. Remove Duplicate Pre-validation (web/src/services/scraperService.ts)
```typescript
// Line 46-119: Remove the entire pre-validation block
// Training.gov.au is a SPA - fetch validation doesn't work anyway
// Let the full scraper handle detection

async scrapeUnitsWithDetails(codes: string[], skipValidation: boolean = true): Promise<...> {
    const valid: Unit[] = [];
    const invalid: { code: string, url: string, reason: string }[] = [];
    
    // REMOVED: Pre-validation code (doesn't work for SPA)
    const codesToScrape = codes; // Use all codes directly
    
    await this.init(); // Initialize browser ONCE
    
    // Continue with batched scraping...
}
```

#### B. Increase Batch Size & Concurrency
```typescript
// Line 130: Increase from 3 to 8 for better parallelism
const BATCH_SIZE = 8; // Was 3, now 8

// Line 170: Reduce delay between batches  
await new Promise(resolve => setTimeout(resolve, 200)); // Was 1000ms, now 200ms
```

#### C. Add Browser Instance Pooling
```typescript
// At class level - reuse browser across requests
private static sharedBrowser: Browser | null = null;
private static browserInitPromise: Promise<Browser> | null = null;

async init() {
    if (ScraperService.sharedBrowser) {
        this.browser = ScraperService.sharedBrowser;
        return;
    }
    
    if (!ScraperService.browserInitPromise) {
        ScraperService.browserInitPromise = puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ]
        });
    }
    
    ScraperService.sharedBrowser = await ScraperService.browserInitPromise;
    this.browser = ScraperService.sharedBrowser;
}

async close() {
    // Don't close shared browser - keep it warm for next request
    this.browser = null;
}
```

### Fix 2: Integrate Red Text Extraction

#### A. Update analyze/route.ts to return red text
```typescript
// After line 122: Also return red text
const { questions: rawQuestions, detectedUnitCodes, instructions, redTextAnswers } = 
    await extractQuestionsFromDocx(Buffer.from(docxBuffer));

logger.info(`Extracted ${rawQuestions.length} questions, ${redTextAnswers?.length || 0} red text answers`);

// Add to reportData (line 157)
const reportData = {
    // ... existing fields
    redTextAnswers: redTextAnswers || [], // NEW
    redTextCount: redTextAnswers?.length || 0 // NEW
};
```

#### B. Update docxQuestionExtractor.ts return type
```typescript
// Export red text in return value
export async function extractQuestionsFromDocx(filePath: string | Buffer): Promise<{
    questions: AssessmentQuestion[];
    detectedUnitCodes: string[];
    instructions: string[];
    redTextAnswers: Array<{ text: string; section: string; context: string }>; // NEW
}> {
    // ... extraction logic
    
    return {
        questions,
        detectedUnitCodes,
        instructions,
        redTextAnswers // NEW
    };
}
```

#### C. Display red text in web UI (web/app/page.tsx)
```tsx
// Add new section after mappingReport
{reportData.redTextCount > 0 && (
    <div className="bg-red-50 border border-red-200 rounded p-4">
        <h3 className="font-bold text-red-800 mb-2">
            🔴 Red Text Debug Section ({reportData.redTextCount} answers)
        </h3>
        <div className="text-sm space-y-1">
            {reportData.redTextAnswers.slice(0, 20).map((answer, idx) => (
                <div key={idx} className="text-red-700">
                    {idx + 1}. [{answer.section}] {answer.text.substring(0, 100)}...
                </div>
            ))}
            {reportData.redTextCount > 20 && (
                <div className="text-red-600 italic mt-2">
                    ... and {reportData.redTextCount - 20} more red text answers
                </div>
            )}
        </div>
    </div>
)}
```

### Fix 3: Improve Excel Unit Extraction

#### A. More flexible regex (web/app/api/analyze/route.ts, line 55)
```typescript
// OLD: const match = cellTrimmed.match(/^([A-Z]{3,}[0-9]{3,})$/);

// NEW: More flexible - handle spaces, case variations
const cellCleaned = cellTrimmed.toUpperCase().replace(/\s+/g, '');
const match = cellCleaned.match(/^([A-Z]{2,}[0-9]{2,})$/);
if (match) {
    unitCodesSet.add(match[1]);
}

// Also check for patterns with spaces/hyphens
const matchWithSeparators = cellTrimmed.match(/^([A-Z]{2,}[\s\-]?[0-9]{2,})$/i);
if (matchWithSeparators) {
    const cleaned = matchWithSeparators[1].toUpperCase().replace(/[\s\-]/g, '');
    if (/^[A-Z]{2,}[0-9]{2,}$/.test(cleaned)) {
        unitCodesSet.add(cleaned);
    }
}
```

### Fix 4: Add Progress Reporting

#### A. WebSocket or SSE for real-time progress
```typescript
// Alternative: Use streaming response
export async function POST(req: NextRequest) {
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    
    // Send progress updates
    const sendProgress = (msg: string) => {
        writer.write(encoder.encode(`data: ${JSON.stringify({ progress: msg })}\n\n`));
    };
    
    sendProgress('Starting analysis...');
    // ... rest of analysis with progress updates
    
    return new Response(stream.readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        }
    });
}
```

## Expected Performance Improvements

### Before Fixes
- 10 units: 40-70 seconds
- 50 units: 3-6 minutes
- Pre-validation: Wasted time (doesn't work for SPA)
- Browser launches: 10 times for 10 units

### After Fixes
- 10 units: 5-8 seconds (6-9x faster!)
- 50 units: 25-40 seconds (4-9x faster!)
- Pre-validation: Removed
- Browser launches: 1 time total (reused)
- Batch processing: 8 units in parallel
- Red text: Properly separated and displayed

## Priority Order

1. **CRITICAL**: Fix scraper performance (Fix 1)
   - Remove pre-validation
   - Shared browser instance
   - Increase batch size
   
2. **HIGH**: Improve unit extraction (Fix 3)
   - More flexible regex
   - Better cell parsing
   
3. **MEDIUM**: Red text integration (Fix 2)
   - Return in API
   - Display in UI
   
4. **LOW**: Progress reporting (Fix 4)
   - Real-time updates
   - Better UX

## Testing

After implementing fixes, test with:
```bash
# 1. Small batch (3 units)
curl -X POST http://localhost:3000/api/analyze \
  -F "assessmentFile=@test.docx" \
  -F "unitsFile=@units-small.xlsx"

# 2. Medium batch (10 units)  
# Should complete in <10 seconds

# 3. Large batch (50 units)
# Should complete in <1 minute
```

## Notes

- Training.gov.au IS an SPA (Vue/Nuxt based)
- Pre-validation with fetch() doesn't work (returns empty shell)
- Must use Puppeteer but can optimize by:
  - Reusing browser instance
  - Batch processing
  - Parallel page loading
  - Removing duplicate work
