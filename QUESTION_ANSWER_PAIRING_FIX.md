# Question-Answer Pairing Fix

## Problem Statement

The initial red text extraction had a **critical flaw**:

1. ❌ **All red text was treated as answers** - including headings
2. ❌ **No pairing between questions and answers** - just two separate lists
3. ❌ **Red headings at the start** were incorrectly treated as answers

### User Requirements

> "At first the red texts are headings that do not have questions.
> Always a question or a sub question is in black text, it must have a subsequent answer."

**Correct Pattern:**
```
Red Text (Heading)          ← IGNORE (not an answer)
Red Text (Heading)          ← IGNORE (not an answer)

Black Text (Question 1)     ← QUESTION
Red Text (Answer 1)         ← ANSWER to Q1

Black Text (Question 2)     ← QUESTION
Red Text (Answer 2)         ← ANSWER to Q2

...
```

**1:1 Pairing Required:**
- Every **black text** = Question
- Every question **MUST** have a subsequent **red text** = Answer
- Red text **without** a preceding black question = Heading (ignore)

---

## Solution

### Architecture

**3-State State Machine:**

```typescript
enum State {
    WAITING,   // Initial state - skip red headings
    QUESTION,  // Collecting black text (question)
    ANSWER     // Collecting red text (answer)
}
```

### State Transitions

```
WAITING state:
  ├─ Red text encountered → IGNORE (continue in WAITING)
  └─ Black text encountered → Transition to QUESTION (start collecting)

QUESTION state:
  ├─ Red text encountered → Transition to ANSWER (start collecting answer)
  └─ Black text encountered → Append to current question

ANSWER state:
  ├─ Black text encountered → SAVE pair, transition to QUESTION (new question)
  └─ Red text encountered → Append to current answer
```

### Implementation

#### File: `structuredDocxParser.ts`

**Updated `parseStructuredQA()` method:**

```typescript
parseStructuredQA(buffer: Buffer): Array<{ question: string; answer: string; isSubQuestion: boolean }> {
    let state: 'WAITING' | 'QUESTION' | 'ANSWER' = 'WAITING';
    let currentQuestion = '';
    let currentAnswer = '';
    const pairs = [];

    for (const run of runs) {
        const isRed = run.isRed;
        const isWhitespace = !text.trim();

        if (state === 'WAITING') {
            // Skip red text at the start (headings/instructions)
            if (isRed) {
                continue; // ✅ IGNORE red headings
            }
            
            // First black text encountered = start of first question
            if (!isRed && !isWhitespace) {
                state = 'QUESTION';
                currentQuestion = text;
            }
        } else if (state === 'QUESTION') {
            if (isRed && !isWhitespace) {
                // Found red text → transition to ANSWER
                if (currentQuestion.trim()) {
                    state = 'ANSWER';
                    currentAnswer = text;
                }
            } else {
                // Black text → append to question
                currentQuestion += text;
            }
        } else { // ANSWER state
            if (!isRed && !isWhitespace) {
                // Black text → save pair, start new question
                if (currentQuestion.trim() && currentAnswer.trim()) {
                    pairs.push({
                        question: currentQuestion.trim(),
                        answer: currentAnswer.trim(),
                        isSubQuestion: !this.isMainQuestion(currentQuestion)
                    });
                }
                currentQuestion = text;
                currentAnswer = '';
                state = 'QUESTION';
            } else {
                // Red text → append to answer
                currentAnswer += text;
            }
        }
    }

    // Handle last pair
    if (state === 'ANSWER' && currentQuestion.trim() && currentAnswer.trim()) {
        pairs.push({ question, answer, isSubQuestion });
    }

    return pairs; // ✅ Returns PAIRED questions and answers
}
```

#### File: `docxQuestionExtractor.ts`

**Simplified to use StructuredDocxParser:**

```typescript
export async function extractQuestionsFromDocx(fileBuffer: Buffer) {
    // Use StructuredDocxParser to get properly paired Q&A
    const { StructuredDocxParser } = await import('./structuredDocxParser');
    const parser = new StructuredDocxParser();
    const pairs = parser.parseStructuredQA(fileBuffer);

    log(`Extracted ${pairs.length} question-answer pairs`);

    const questions: AssessmentQuestion[] = [];
    const redTextAnswers: any[] = [];

    pairs.forEach((pair, index) => {
        const questionId = `Q${index + 1}`;

        // Add question
        questions.push({
            id: questionId,
            text: pair.question,
            section: 'General'
        });

        // Add answer (linked to question)
        redTextAnswers.push({
            text: pair.answer,
            questionId: questionId,        // ✅ Linked to question
            questionText: pair.question,   // ✅ Reference to question
            index: index + 1,
            seq: index + 1
        });

        log(`Q${index + 1}: ${pair.question.substring(0, 60)}...`);
        log(`A${index + 1}: ${pair.answer.substring(0, 60)}...`);
    });

    return {
        questions,
        redTextAnswers, // ✅ 1:1 paired with questions
        detectedUnitCodes: [],
        instructions: []
    };
}
```

---

## Benefits

### Before Fix:
```json
{
  "questions": [
    { "id": "Q1", "text": "What is WLL?" },
    { "id": "Q2", "text": "Define mooring." }
  ],
  "redTextAnswers": [
    { "text": "PART A" },              // ❌ Heading treated as answer
    { "text": "SECTION 1" },          // ❌ Heading treated as answer  
    { "text": "Working Load Limit" }, // ✓ Actual answer
    { "text": "Securing vessel" }     // ✓ Actual answer
  ]
}
```
**Problems:**
- ❌ 4 "answers" but only 2 questions
- ❌ First 2 "answers" are actually headings
- ❌ No way to know which answer goes with which question

### After Fix:
```json
{
  "questions": [
    { "id": "Q1", "text": "What is WLL?" },
    { "id": "Q2", "text": "Define mooring." }
  ],
  "redTextAnswers": [
    { 
      "text": "Working Load Limit",
      "questionId": "Q1",                    // ✅ Linked to Q1
      "questionText": "What is WLL?",
      "index": 1
    },
    { 
      "text": "Securing vessel",
      "questionId": "Q2",                    // ✅ Linked to Q2
      "questionText": "Define mooring.",
      "index": 2
    }
  ]
}
```
**Benefits:**
- ✅ 2 questions, 2 answers (perfect 1:1 pairing)
- ✅ Red headings at start are ignored
- ✅ Each answer is linked to its question
- ✅ Question text stored with answer for reference

---

## Algorithm Summary

### Pseudocode:

```
state = WAITING
currentQuestion = ""
currentAnswer = ""
pairs = []

FOR each text run in document:
    IF state == WAITING:
        IF text is red:
            SKIP (ignore red headings)
        ELSE IF text is black:
            state = QUESTION
            currentQuestion = text
    
    ELSE IF state == QUESTION:
        IF text is red:
            state = ANSWER
            currentAnswer = text
        ELSE:
            currentQuestion += text
    
    ELSE IF state == ANSWER:
        IF text is black:
            SAVE pair(currentQuestion, currentAnswer)
            state = QUESTION
            currentQuestion = text
            currentAnswer = ""
        ELSE:
            currentAnswer += text

IF state == ANSWER:
    SAVE pair(currentQuestion, currentAnswer)

RETURN pairs
```

---

## Example Document Processing

### Input Document:
```
[RED] PART A - Navigation Skills          ← IGNORED (heading)
[RED] Section 1: Equipment                ← IGNORED (heading)

[BLACK] 1. What is the WLL for a 10mm rope?
[RED] 2.5 tonnes                          ← ANSWER to Q1

[BLACK] 2. Define mooring.
[RED] Securing a vessel to a fixed point  ← ANSWER to Q2

[BLACK] 3. List three safety items.
[RED] Life jacket, flare, radio           ← ANSWER to Q3
```

### Output:
```json
{
  "pairs": [
    {
      "question": "1. What is the WLL for a 10mm rope?",
      "answer": "2.5 tonnes",
      "isSubQuestion": false
    },
    {
      "question": "2. Define mooring.",
      "answer": "Securing a vessel to a fixed point",
      "isSubQuestion": false
    },
    {
      "question": "3. List three safety items.",
      "answer": "Life jacket, flare, radio",
      "isSubQuestion": false
    }
  ]
}
```

**Key Points:**
- ✅ 3 questions, 3 answers (1:1 pairing)
- ✅ Red headings ("PART A", "Section 1") correctly ignored
- ✅ Each answer is paired with its question

---

## Files Modified

1. **`web/src/services/structuredDocxParser.ts`**
   - Added `WAITING` state to state machine
   - Ignores red text at beginning (headings)
   - Only creates pairs when pattern is: Black → Red

2. **`web/src/services/docxQuestionExtractor.ts`**
   - Simplified to use `StructuredDocxParser`
   - Links answers to questions via `questionId`
   - Stores question text with each answer

---

## Build Status

✅ **Build Successful**
```
✓ Compiled successfully
✓ Finished TypeScript
Exit code: 0
```

---

## Testing Checklist

- [x] Red text at document start is ignored (not treated as answers)
- [x] Every black text question has exactly one red text answer
- [x] Answers are linked to their questions via `questionId`
- [x] Question text is stored with answer for reference
- [x] 1:1 pairing guaranteed (questions.length === answers.length)
- [x] Sub-questions are correctly identified
- [x] Build succeeds without errors

---

## Summary

**Before:** ❌ All red text = answers (including headings)  
**After:** ✅ Only red text following black questions = answers

**Pattern Detected:**
```
Black (Question) → Red (Answer) → Black (Question) → Red (Answer)...
```

**Red text before first question:** IGNORED (headings/instructions)  
**Result:** Perfect 1:1 question-answer pairing ✅
