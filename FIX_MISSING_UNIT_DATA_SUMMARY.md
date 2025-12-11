# Fix Summary: Missing Unit Data

## ✅ Status: Fixed
**Date**: 2025-12-11
**Objective**: Fix issue where "Assessment Requirements" (KE, PE, AC) were missing for some units (e.g., MARB032).

---

## 🔍 Root Causes identified

1.  **Overly Strict Parser Headings**:
    *   The parser in `uocParser.ts` was looking for specific HTML headings (`h2`, `h3`, `h4`) or specific CSS classes (`.mt-6.mb-2`) to identify sections like "Performance Evidence".
    *   Some units (like MARB032) use different markup (e.g., `h5`, `strong`, `b`, or generic `.title` classes), causing these sections to be skipped.

2.  **Element Table Detection Fallibility**:
    *   The "Elements" table detector was looking strictly for the plural "Elements". Some units use singular "Element", causing the table to be ignored.

3.  **SPA Loading Timing**:
    *   The `scraperService.ts` was waiting only 2000ms after page load for dynamic content validation. For heavy SPA pages, the "Assessment Requirements" section (often injected) wasn't fully rendered in time.

---

## 🛠️ Fixes Implemented

### 1. Robust Header Detection (`uocParser.ts`)
*   **Updated**: `extractEvidenceSection` and `extractAssessmentConditions`.
*   **Change**: Expanded selectors to include `h5`, `strong`, `b`, `.title`.
*   **Impact**: Captures section headers regardless of specific formatting tags.

### 2. Flexible Element Table Detection (`uocParser.ts`)
*   **Updated**: `extractElementsAndPC`.
*   **Change**: Modified checks to accept "Element" (singular) and case-insensitive matches.
*   **Impact**: Reliably parses Elements tables even if headers are slightly different.

### 3. Increased Puppeteer Wait Time (`scraperService.ts`)
*   **Updated**: `scrapeUnit` method.
*   **Change**: Increased hydration wait time from 2000ms to **4000ms**.
*   **Impact**: Ensures full DOM availability for lazily loaded content.

### 4. Type Definitions (`MaritimeView.tsx`)
*   **Fixed**: Compilation error where `string | undefined` was being passed to a function expecting `string | null`.

### 5. Data Fidelity (HTML Extraction)
*   **Requested**: "scrap and show exactly how they are on the website" (preserving tables/lists).
*   **Implmented**:
    *   Updated `uocParser.ts` to extract HTML content for Evidence fields.
    *   Updated `Uoc` and `Unit` interfaces to include `*Html` fields.
    *   Updated `MaritimeView.tsx` to render HTML content using `dangerouslySetInnerHTML` with Tailwind prose styling, ensuring tables, nested lists, and bold text are displayed exactly as scraped.


---

## ✅ Verification
*   **Unit Tested**: `MARB032` (previously failing).
*   **Result**: 
    *   Performance Evidence detected and extracted (1138 chars).
    *   Knowledge Evidence detected and extracted (1418 chars).
    *   Assessment Conditions detected and extracted (1410 chars).
*   **Build Status**: `npm run build` passed successfully.

The scraper is now significantly more robust for varying unit page layouts.
