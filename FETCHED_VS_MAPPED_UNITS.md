# Fetched Units vs Mapped Units - Clear Distinction

## Problem Statement

There was confusion between two different unit counts:

1. **Fetched Units** - All valid units extracted from Excel and successfully scraped
2. **Mapped Units** - Units that are actually relevant to the assessment questions

These were being conflated, making it unclear which units were actually being tested.

## User Requirement

> "Fetched units are the number of units if a units file is uploaded, it is the count of all valid units fetched from the given list. Whereas mapped units is the count of units that are relevant to the questions and answers. A question and answer may be relevant to 1 unit, or multiple units."

## Critical Understanding

### Fetched Units
- **Definition**: Total count of valid units from Excel that were successfully scraped from training.gov.au
- **Source**: Excel file upload
- **Validation**: HTTP 200, page exists, has content
- **Purpose**: Complete pool of available units to check against

**Example:**
```
Excel contains: MARA022, MARA024, MARB027, MARB028, MARB029
All scraped successfully → Fetched Units = 5
```

### Mapped Units
- **Definition**: Unique units that have at least one question mapped to them
- **Source**: AI analysis of question-to-unit relevance
- **Validation**: Semantic/conceptual match between question and unit
- **Purpose**: Actual units being assessed

**Example:**
```
Fetched Units = 5 (MARA022, MARA024, MARB027, MARB028, MARB029)

Questions:
Q1 maps to MARA022
Q2 maps to MARA022  (same unit)
Q3 maps to MARB027
Q4 maps to MARB029

Mapped Units = 3 (MARA022, MARB027, MARB029)
Unmapped Units = 2 (MARA024, MARB028) - fetched but not tested
```

---

## Implementation

### 1. Calculate Unique Mapped Units

**File:** `web/app/api/analyze/route.ts`

```typescript
// Calculate unique units that are actually mapped to questions
// A question may map to 1 or multiple units
const uniqueMappedUnitCodes = new Set<string>();
results.forEach(r => {
    if (r.mappedUnit) {
        uniqueMappedUnitCodes.add(r.mappedUnit);
    }
});

// Get the full unit details for mapped units only
const mappedUnits = allUnits.filter(u => uniqueMappedUnitCodes.has(u.code));

logger.info(`Unique units mapped to questions: ${uniqueMappedUnitCodes.size} out of ${allUnits.length} fetched units`);
```

### 2. Return Both in Response

```typescript
const reportData = {
    // Units that are actually relevant to questions (mapped)
    mappedUnits: mappedUnits,              // Array of unit objects
    mappedUnitsCount: uniqueMappedUnitCodes.size,  // Count
    
    // All units fetched from Excel (for reference)
    fetchedUnits: allUnits,                 // Array of all unit objects
    fetchedUnitsCount: allUnits.length,     // Count
    
    // ... other data
};
```

### 3. Clear Logging

```typescript
logger.info(`Summary: ${unitCodes.length} unit codes found in Excel`);
logger.info(`  - ${scrapedUnits.length} valid units fetched from training.gov.au`);
logger.info(`  - ${uniqueMappedUnitCodes.size} unique units mapped to questions (relevant)`);
logger.info(`  - ${invalid.length} invalid units, ${duplicatesInInput.length} duplicates`);
logger.info(`  - ${results.length} questions analyzed, ${mappedCount} successfully mapped`);
```

---

## Intelligent Mapping (Semantic, Not Just Keywords)

### User Requirement

> "Not always there would be exact matching words, sentences. But there may be relevant words and synonyms, or forms different types of sentences, ways of testing knowledge, performance etc."

### Enhanced AI Prompt

**File:** `web/src/services/aiService.ts`

The AI is explicitly instructed to use semantic matching:

```typescript
2. **Match to Units**:
   - **IMPORTANT**: Look beyond exact keyword matches:
     * Consider synonyms (e.g., "WLL" = "Working Load Limit" = "Safe Working Load")
     * Consider related concepts (e.g., "mooring" relates to "securing", "fastening", "anchoring")
     * Consider different ways of testing the same knowledge
     * Consider practical vs theoretical formulations of the same concept
   - A question may test knowledge from ONE unit or MULTIPLE units
```

### Examples of Semantic Matching

#### Example 1: Synonyms

**Question:** "What is the SWL for a 10mm wire rope?"

**Unit:** Contains "Working Load Limit" (not "SWL")

**Match:** ✅ YES
- AI recognizes: SWL = Safe Working Load = Working Load Limit
- Synonym detection

#### Example 2: Related Concepts

**Question:** "How do you secure a vessel to a wharf?"

**Unit:** Contains "mooring procedures" and "fastening lines"

**Match:** ✅ YES
- AI recognizes: "secure" relates to "mooring" and "fastening"
- Conceptual alignment

#### Example 3: Different Formulations

**Question:** "List the steps for conducting a safety inspection"

**Unit Performance Criteria:** "Safety equipment is inspected according to standards"

**Match:** ✅ YES
- Question tests practical application (list steps)
- Unit requires theoretical knowledge (what to inspect)
- Same underlying competency, different formulation

#### Example 4: Practical vs Theoretical

**Question:** "Demonstrate the correct way to tie a bowline knot"

**Unit Knowledge Evidence:** "Different types of knots and their uses"

**Match:** ✅ YES
- Question = practical demonstration
- Unit = theoretical knowledge
- Both test the same competency

---

## One Question, Multiple Units

### Scenario

A question might test knowledge from multiple units simultaneously.

**Example:**

**Question:** "Explain the safety procedures for lifting heavy equipment using a crane on board a vessel"

**This tests:**
- **Unit A (MARA022):** Rigging and lifting operations
- **Unit B (MARB027):** Deck operations and safety
- **Unit C (MARN008):** Seamanship and vessel operations

**Current Implementation:**
- AI selects the **PRIMARY** unit (most directly tested)
- In this case: **MARA022** (Rigging and lifting)

**Future Enhancement Possibility:**
- Could track secondary/related units
- For now, we map to the strongest match

---

## Response Structure

### Before Fix

```json
{
  "mappedUnits": [/* ALL 130 fetched units */],  // ❌ Confusing
  "validUnitsScraped": 130
}
```

**Problem:** No distinction between what was fetched vs what was actually tested.

### After Fix

```json
{
  "fetchedUnits": [/* All 130 units */],
  "fetchedUnitsCount": 130,
  
  "mappedUnits": [/* Only 15 units actually tested */],
  "mappedUnitsCount": 15,
  
  "results": [
    {
      "questionId": "Q1",
      "questionText": "What is WLL?",
      "mappedUnit": "MARA022",
      "confidence": 95
    },
    {
      "questionId": "Q2",
      "questionText": "Define mooring",
      "mappedUnit": "MARB027",
      "confidence": 92
    }
  ]
}
```

**Clear distinction:**
- 130 units were fetched (available pool)
- 15 units are actually being tested (mapped)
- 115 units were fetched but not tested

---

## Use Cases

### Use Case 1: Coverage Analysis

**Fetched:** 50 units  
**Mapped:** 30 units

**Insight:** The assessment covers 60% of the units in the list. 20 units are not being tested.

### Use Case 2: Comprehensive Assessment

**Fetched:** 10 units  
**Mapped:** 10 units

**Insight:** The assessment tests all units. Full coverage.

### Use Case 3: Focused Assessment

**Fetched:** 100 units  
**Mapped:** 5 units

**Insight:** The assessment is focused on 5 specific units out of a larger pool.

---

## Logging Examples

### Example Output:

```
Summary: 130 unit codes found in Excel
  - 128 valid units fetched from training.gov.au
  - 15 unique units mapped to questions (relevant)
  - 2 invalid units, 0 duplicates
  - 45 questions analyzed, 42 successfully mapped
```

**Interpretation:**
- Excel contained 130 unit codes
- 128 were successfully scraped (valid)
- Only 15 of those 128 are actually being tested
- 45 questions in total
- 42 questions successfully mapped to those 15 units
- 3 questions couldn't be mapped to any unit

---

## Benefits

### 1. Clear Reporting
- ✅ Users know how many units were fetched
- ✅ Users know how many are actually tested
- ✅ Gap analysis possible (which units not tested)

### 2. Semantic Matching
- ✅ Synonyms recognized
- ✅ Related concepts matched
- ✅ Different formulations detected
- ✅ Practical vs theoretical aligned

### 3. Flexible Mapping
- ✅ One question can map to one unit
- ✅ Or one unit can have many questions
- ✅ AI chooses best match
- ✅ Not just keyword matching

---

## Summary

### Key Distinctions

| Aspect | Fetched Units | Mapped Units |
|--------|---------------|--------------|
| **Definition** | All valid units from Excel | Units with questions mapped to them |
| **Source** | Excel upload → training.gov.au | AI analysis of Q&A relevance |
| **Count** | Total available pool | Actual units being tested |
| **Always** | ≥ Mapped Units | ≤ Fetched Units |
| **Purpose** | Complete reference set | Assessment coverage |

### Example Relationship

```
Excel File: 50 units
  ↓
Fetch from training.gov.au
  ↓
Fetched Units: 48 valid (2 were 404)
  ↓
AI Analysis of Questions
  ↓
Mapped Units: 12 relevant (36 not tested)
```

**The system now clearly reports both!** ✅

---

## Build Status

✅ **Build Successful**
```
✓ Compiled successfully
✓ Finished TypeScript
Exit code: 0
```
