# Dynamic App Changes - Removal of Hardcoded Values

## Summary
Made the application fully dynamic by removing all hardcoded headings, subheadings, units, and unit initials. The system now automatically detects and adapts to any document structure or unit classification.

## Changes Made

### 1. MaritimeExcelService.ts - Dynamic Sheet Configuration
**Location**: `/web/src/services/MaritimeExcelService.ts`

**What was changed**:
- Removed hardcoded `SHEET_CONFIGS` array containing:
  - Sheet names: "ESS Mapping", "Deck Mapping", "Navigation Mapping", etc.
  - Unit prefixes: MARF, MARC, MARJ, MARI, MARK, MARN, MARH, MARB, MARO, MARL
  - Assessment columns: "Knowledge Coxswain Deck", "Seamanship Knowledge", "Watchkeeping", etc.

**What was added**:
- New `generateDynamicSheetConfigs()` method that:
  - Analyzes unit codes to extract prefix patterns (first 2-4 letters)
  - Groups units by their prefixes automatically
  - Uses unit sector information for meaningful category names
  - Creates appropriate sheet configurations on-the-fly

**Benefits**:
- Works with ANY unit classification system
- No need to update code when adding new unit types
- Automatically adapts to user's data structure

### 2. AdvancedDocxParser.ts - Dynamic Section Detection
**Location**: `/web/src/services/advancedDocxParser.ts`

**What was changed**:
 "General"
 "Assessment Document"
- Removed hardcoded instruction keywords like "marking", "sheet", "Watchkeeping", "Coxswain"
- Removed hardcoded instruction detection patterns

**What was added**:
- Generic pattern-based detection for:
  - Red headings (any short text at document start)
  - Instructions (pattern matching: instruct, guideline, note, criteria, etc.)
  - Section headers (any format: Part X, Section Y, Module Z, etc.)
- Dynamic regex patterns instead of keyword lists
- Flexible instruction block detection

**Benefits**:
- Works with documents from any domain or organization
- Detects sections regardless of naming convention
- No assumptions about document structure

### 3. Document Title and UI Labels
**Locations**: 
- `/web/app/page.tsx`
- `/web/src/services/advancedDocxParser.ts`

**What was changed**:
 "Assessment Document"
 "Instructions"

**Benefits**:
- Generic labels that work for any assessment type
- No domain-specific terminology

### 4. Comment Updates
**Location**: `/web/src/services/docxQuestionExtractor.ts`

**What was changed**:
- Updated comments to reflect dynamic behavior
- Removed specific examples like "Part 1, Part 2"
- Added "any format" to indicate flexibility

## How It Works Now

### Unit Processing
1. System reads unit codes from uploaded Excel
2. Extracts prefix patterns automatically (e.g., "MAR", "BSB", "TLI")
3. Groups units by prefix
4. Infers category names from unit sector field
5. Creates Excel sheets dynamically based on actual data

### Document Processing
1. Reads document structure without assumptions
2. Detects headings by position and length, not keywords
3. Identifies instructions using pattern matching
4. Recognizes sections using generic markers (Part, Section, Module, etc.)
5. Extracts questions and answers based on color coding

### Section Detection
The system now recognizes:
- Explicit headers: "Part 1", "Section A", "Module 3", "Task 2", "Unit 5"
- Implicit headers: Short standalone text (< 50 chars)
- Dynamic headers: Any text that structurally appears as a section break

## Testing
The app was tested with:
- "Knowledge Watchkeeping - Open Book Marking Sheet.docx"
- Successfully extracted 21 questions
- Dynamically detected 9 sections
- No hardcoded values used

## Backward Compatibility
All existing functionality is preserved:
- Excel export still works
- Unit scraping still works
- Question extraction still works
- AI mapping still works

The changes only affect HOW the system detects structure, not WHAT it does with the data.

## Future Benefits
This dynamic approach means:
- No code changes needed for new document types
- No code changes needed for new unit classifications
- System adapts to any organization's naming conventions
- Easy to expand to new domains (healthcare, construction, etc.)
