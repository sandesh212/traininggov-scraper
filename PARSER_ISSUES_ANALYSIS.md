# CRITICAL ISSUES - Question-Answer Extraction

## 🔴 Current Problems

### 1. **Missing First Question of Part 1**
**Expected:**
```
Q1: How do you work out the Working Load Limit (WLL) of a lifting sling?
A1: Read the label, colour match with manufacturer guide, identify number of strips on sling
```

**Actual:** This question is completely missing from the output.

**Root Cause:** The parser skips the first black text after red instruction blocks, or the numbering pattern "1." is being filtered.

---

### 2. **Part Headings Merged into Questions**
**Expected:**
```
SECTION HEADER: Part 2 – Domestic Regulations

Q: 1. List THREE pieces of Legislation...
```

**Actual:**
```
Q5: Part 2 – Domestic Regulations
1. List THREE pieces of Legislation...  
```

**Root Cause:** Part headers are treated as part of the next question instead of being separated as section breaks.

---

### 3. **Sub-Headings Treated as Separate Questions**
**Expected (Question 13):**
```
Q13: List SIX pieces of safety equipment required for a 10 m 1D vessel as stated in the NSCV Part C Section 7 subsection 7A.

A13: 
Distress Signals:
1. 3 Parachute distress rockets
2. 2 Red hand-held flares
3. 1 hand-held orange smoke signal
4. Manual or water activated EPIRB

Navigation Equipment:
5. Clock (May be included in other nav equipment
6. Binoculars
7. Echo sounder
... etc
```

**Actual:** Split into 6 separate questions (#17-21):
```
Q17: List SIX pieces... → Distress Signals: 3 Parachute...
Q18: Navigation Equipment: → Clock...
Q19: Onboard communication: → Signalling light...
Q20: Firefighting equipment: → Refer to NSCV Part C4
Q21: Lifejackets: → Coastal lifejacket...
```

**Root Cause:** The parser treats each black→red transition as a new Q&A pair, not understanding that sub-headings are part of a larger answer.

---

### 4. **Question Numbering Issues**
**Expected:**
```
Part 2:
1. List THREE pieces of Legislation...
2. What documentation onboard...
3. What is the minimum crew...
```

**Actual:**
```
Part 2:
1. List THREE... (appears as Q5)
2. What documentation... (appears as Q6, but numbered "2." in text)
```

**Root Cause:** Document has **nested numbering** (Part 2, Question 1, Question 2) but parser treats everything as flat.

---

### 5. **Sub-question Parts Not Grouped**
**Expected (Question 1 of Part 4):**
```
Q: 1. a) What would you do if any equipment required...
      b) Would your vessel be seaworthy if not rectified?

A: a) Replace or repair if competent to do so...
   b) No
```

**Actual:** Two separate questions (#27, #28)

**Root Cause:** Parser doesn't group (a), (b), (c) sub-parts together.

---

### 6. **"Refer to" Sub-Headings**
**Expected:**
```
Refer to Marine Safety Act 2012 Part 5
Q: What must the Master of a vessel do...
```

**Actual:**
```
Q: 5. Refer to Marine Safety (Domestic Commercial Vessel) National Law Act 2012 Part 5
What must the Master of a vessel do on becoming aware of another vessel in distress?
```

**Root Cause:** "Refer to" lines should be **sub-headings** (formatted with bold), not part of question text.

---

### 7. **Images Not Extracted**
**Expected:** Questions with images should have image data extracted and displayed.

**Actual:** All image references are missing.

**Root Cause:** Parser only extracts text, not image blobs from DOCX.

---

## 🎯 Required Parser Logic

### Document Structure Recognition:

```
INSTRUCTIONS (red, long paragraphs at top)
  ↓
PART 1 HEADING (bold, "Part X – Description")
  ↓
  Main Question 1 (numbered "1.")
    ↓
    Answer (red text)
  ↓
  Main Question 2 (numbered "2.")
    Sub-heading: "Refer to X" (bold, optional)
      ↓
      Question text
      ↓
      Sub-question (a) (optional)
      Sub-question (b) (optional)
    ↓
    Answer (red text, may include sub-heading like "Distress Signals:")
      ↓
      Sub-answer (a)
      Sub-answer (b)
  ↓
PART 2 HEADING
  ↓
  Main Question 1
  ...
```

### Required Features:

1. **Section Detection**
   - Detect "Part X" headers
   - Don't treat them as questions
   - Use as section context

2. **Main Question Detection**
   - Pattern: `^\d+\.` at start of new black text after answer
   - May have "Refer to..." sub-heading (bold)

3. **Sub-Question Grouping**
   - Pattern: same number with (a), (b), (c) parts
   - Keep all parts together as one question

4. **Sub-Heading Recognition**
   - Bold text at start of answer (e.g., "Distress Signals:")
   - Keep with answer, don't split into new question

5. **Bold Preservation**
   - Sub-headings should maintain bold formatting
   - "Refer to..." should show as bold

6. **Image Extraction**
   - Extract image blobs from DOCX
   - Associate with correct question
   - Store as base64 or file reference

7. **Numbering Preservation**
   - Answers may have numbered lists (1., 2., 3.)
   - Don't confuse answer numbering with question numbering

---

## 📋 Proposed Solution Phases

### Phase 1: Fix Structure Recognition
- [ ] Detect "Part X" headers → section breaks
- [ ] Fix main question numbering (1., 2., 3.)
- [ ] Group sub-questions (a, b, c) together
- [ ] Preserve "Refer to" sub-headings with questions

### Phase 2: Fix Answer Extraction
- [ ] Keep sub-headings within answers (Distress Signals:, Navigation:, etc.)
- [ ] Preserve all numbering in answers
- [ ] Don't split answers with sub-headings

### Phase 3: Add Image Support
- [ ] Extract image blobs from DOCX
- [ ] Associate with questions
- [ ] Display in UI

### Phase 4: Formatting Preservation
- [ ] Preserve bold text
- [ ] Preserve italic text
- [ ] Preserve indentation/structure

---

## 🔧 Technical Implementation Needed

### 1. Enhanced Parser State Machine

```typescript
enum State {
  WAITING,           // Before first question
  INSTRUCTION,       // Reading instruction blocks
  SECTION_HEADER,    // Reading "Part X" header
  QUESTION,          // Reading main question
  SUB_QUESTION,      // Reading sub-question (a), (b)
  REFER_HEADING,     // Reading "Refer to..." sub-heading
  ANSWER,            // Reading answer
  ANSWER_SUB_HEADING // Reading answer sub-heading (Distress Signals:)
}
```

### 2. Pattern Recognition

```typescript
// Section header
/^Part\s+\d+\s*[–-].*$/i

// Main question number
/^\d+\.\s+/

// Sub-question letter
/^\d+\.\s+[a-z]\)\s+/i

// "Refer to" sub-heading
/^Refer to/i

// Answer sub-heading (bold, ends with colon)
/^[A-Za-z\s]+:$/ && isBold
```

### 3. Grouping Logic

```typescript
interface Question {
  mainNumber: number;           // 1, 2, 3
  subPart?: string;             // "a", "b", "c"
  section: string;              // "Part 1 – Ropework and lifting"
  referHeading?: string;        // "Refer to Marine Safety Act..."
  questionText: string;
  answer: string;
  answerSubHeadings?: string[]; // ["Distress Signals:", "Navigation Equipment:"]
  images?: Buffer[];
  isBold?: boolean[];           // Track which parts are bold
}
```

---

## 🚨 Critical: This Requires Major Refactor

**Estimated Complexity:** High (8-10 hours of work)

**Why Complex:**
1. Need to re-architect the parser state machine
2. XML structure is nested and variable
3. Must handle 7+ different content patterns
4. Risk of breaking existing functionality
5. Extensive testing required

**Recommendation:**
- Create NEW parser file: `advancedDocxParser.ts`
- Keep old parser as fallback
- Implement incrementally with tests
- Switch once validated

---

## 📊 Test Cases Needed

After implementation, must verify:
- [ ] All 53 questions extracted (currently missing Q1)
- [ ] Part headers separated (not in question text)
- [ ] Sub-questions grouped (1a, 1b together)
- [ ] "Refer to" sub-headings preserved with questions
- [ ] Answer sub-headings not split into questions
- [ ] Images extracted and displayed
- [ ] Bold formatting preserved
- [ ] Answer numbering not confused with question numbering

---

## Summary

The current parser is **fundamentally too simple** for this document structure. It assumes:
- Flat black→red pattern
- No nested structure
- No section headers
- No sub-headings

The actual document has:
- 7 hierarchical levels
- Multiple heading types
- Bold sub-headings
- Nested numbering
- Images

**This needs a complete parser rewrite, not a patch.**
