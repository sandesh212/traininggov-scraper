# Red Text Separation - Implementation Complete

## Overview
Enhanced the DOCX question extractor to properly separate red text (answers) from black text (questions, instructions, headings) and provide debug information.

## What Was Fixed

### 1. Color-Aware Extraction
- **NEW**: Parse raw DOCX XML to identify text with color formatting (`<w:color w:val="FF0000"/>`)
- Create a map of all red text elements before HTML conversion
- Reference this map during extraction to filter out answers

### 2. Enhanced Question Detection
The system now properly identifies and categorizes:

#### Questions (Black Text)
- Numbered questions: "1.", "Q1", "1.1", etc.
- Questions ending with "?"
- Table-based questions with ID in first cell
- Sub-questions: "a)", "b)", etc.

#### Instructions (Black Text)
- Commands starting with action verbs (List, Describe, Explain, Identify, etc.)
- Properly detects number requirements: "List THREE", "Identify TWO"
- Formatted with `type: 'instruction'`

#### Headings (Black Text, Bold)
- **Part/Section Headers**: "PART A", "Section 1", "MODULE B"
- **Sub-headings**: Topic headers and category names
- Used for context but not counted as questions

#### Answers (Red Text) - **EXCLUDED from Unified Report**
- All text with color `FF0000` (red)
- Stored separately in debug section
- Not included in question count
- Listed with section context for reference

### 3. Debug Output
The system now provides:

```
📊 Extraction Summary:
   - Questions (black text): 25
   - Answers (red text): 148

🔴 RED TEXT DEBUG SECTION:
   1. [Section] Answer text...
   2. [Section] Answer text...
   ...
```

### 4. Unified Report (Clean Questions Only)
```
=== UNIFIED REPORT (Questions Only - Black Text) ===
Total questions detected: 25

1. [instruction] List two (2) signs of approaching bad weather.
2. [question] How can the risk of capsizing be reduced?
3. [instruction] Match the following with their average wind strengths.
...
```

## Files Modified

### `/src/services/docxQuestionExtractor.ts`
- Added `adm-zip` for raw DOCX ZIP extraction
- Added `xml2js` for XML parsing
- Implemented `extractWithColorInfo()` - extracts color metadata from DOCX XML
- Implemented `traverseForRedText()` - recursively finds red text elements
- Enhanced `extractQuestionsFromColoredElements()` - filters using color map
- Added `isRedText()` helper - checks if text is marked as red

## Dependencies Added
```json
{
  "adm-zip": "^0.5.x",
  "xml2js": "^0.6.x",
  "@types/adm-zip": "^0.5.x",
  "@types/xml2js": "^0.4.x"
}
```

## How It Works

### Step 1: Extract Color Information
```
DOCX File
    ↓
Unzip to XML
    ↓
Parse document.xml
    ↓
Find <w:color w:val="FF0000"/>
    ↓
Create Map<text, isRed>
```

### Step 2: Filter During Extraction
```
For each element:
    ├─ Is text in red map? → Store in redTextAnswers[]
    ├─ Is bold header? → Update currentSection
    ├─ Is instruction? → Add to questions[] with type='instruction'
    ├─ Is numbered question? → Add to questions[] with type='question'
    └─ Is question (ends with "?")? → Add to questions[] with type='question'
```

### Step 3: Output Separation
- **Unified Report**: Only black text questions (25 found)
- **Debug Section**: All red text answers (148 found) with context

## Testing

### Sample Output from "Knowledge Seamanship Marking Sheet.docx"

#### Questions Detected (Black Text)
1. List two (2) signs of approaching bad weather
2. Match wind strength warnings  
3. List six courses of action after grounding
4. List FIVE actions for person overboard
5. Fire risk controls
6. Towing considerations
7. Engine propulsion characteristics
8. Capsizing risk reduction
... (25 total)

#### Answers Detected (Red Text) - Debug Only
1. All crew up in safe area-Not below deck
2. Monitor wave sets and safe water potential
3. Crew briefed on crossing
4. PPE fitted and checked
5. Increase in wave height from storm direction
6. Rain increasing
7. Wind increasing
... (148 total)

## Next Steps

### Optional Enhancements
1. **Answer Linking**: Associate red text answers with their corresponding questions
2. **Answer Numbering**: Number red text answers based on their question context
3. **Multi-color Support**: Handle other colors (blue for notes, green for examples)
4. **Table Answer Extraction**: Better handling of answers within table cells
5. **Answer Validation**: Check if student answers match the red text model answers

### Usage in Main Application
The enhanced extractor can now be used to:
- Generate clean question lists without answer contamination
- Create separate answer keys for assessors
- Build question-answer pairs for validation
- Generate student worksheets (questions only)
- Create marking guides (questions + red text answers)

## Status
✅ **COMPLETE** - Red text separation is fully functional

The system now correctly:
- Identifies red text using DOCX XML color tags
- Separates questions from answers
- Provides debug output for red text
- Generates clean unified reports with questions only
- Properly numbers and categorizes questions
- Preserves section context for both questions and answers
