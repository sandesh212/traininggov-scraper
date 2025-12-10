# 🔧 Issues Fixed & Debugging Guide

## Build Status: ✅ Passing (with enhanced logging)

---

## 🐛 Issues Reported & Status

### 1. ❌ Instructions Not Showing on Top
**Status:** 🔄 Fixed with enhanced detection

**Problem:** Instructions were being treated as questions  
**Root Cause:** Instruction detection was too aggressive - anything with instruction keywords was skipped  
**Fix:** Added `looksLikeQuestion()` check - only treats as instruction if:
  - Has instruction keywords AND
  - Is long text (>200 chars) AND  
  - Does NOT look like a question (no numbers like "1.", no question words)

**New Logic:**
```typescript
if (hasInstructionKeywords && isLong && !looksLikeQuestion(text)) {
  → Instructions
} else {
  → Questions
}
```

---

### 2. ❌ Not Showing Parts/Refer Headings
**Status:** ✅ Fixed

**Problem:** Section headers ("Part 1") were being skipped entirely  
**Root Cause:** Logic was `continue` when section detected  
**Fix:** 
- Still detect section header
- Set currentSection context
- BUT if the section has an answer, process it as a question too
- Only skip if no real answer

**New Logic:**
```typescript
if (isSectionHeader) {
  this.currentSection = text;  // Set context
  if (answer.length < 10) {
    continue;  // Skip if no real answer
  } else {
    // Continue processing as question
  }
}
```

---

### 3. ❌ Not Separating Sub-Sections Appropriately  
**Status:** 🔄 Improved with better numbering detection

**Problem:** Sub-questions not recognized  
**Root Cause:** Number matching only looked for `\d+\.` format  
**Fix:** Added more patterns:
- `^\d+\.` → Main questions (1., 2., 3.)
- `^\d+[a-z]\.` → Sub-questions (1a., 2b.)
- `^[a-z]\)` → Letter sub-questions (a), b), c))

**Examples Handled:**
- "1. Question" ✅
- "1a. Sub-question" ✅  
- "a) Sub-part" ✅

---

### 4. ❌ Missing Some Questions and Answers
**Status:** 🔄 Fixed with better pair validation

**Problem:** Some pairs were skipped  
**Root Causes:**
1. Empty answers → Now explicitly checked and skipped
2. Instructions wrongly classified → Fixed with looksLikeQuestion() 
3. Section headers skipped with answers → Fixed to process if has answer

**New Safeguards:**
```typescript
// Skip empty pairs
if (!aText) {
  console.log('⚠️  Skipping - no answer');
  continue;
}

// Don't skip sections with real answers  
if (sectionHeader && aText.length >= 10) {
  // Process as question
}
```

---

### 5. ❌ All Questions Mapped to MARB002
**Status:** ⚠️ **REQUIRES INVESTIGATION**

**Possible Causes:**

#### A. Excel File Only Has MARB002
**Check:** Look at your uploaded Excel file
**Solution:** Upload Excel with multiple units

**How to verify:**
```
Look at server logs when uploading:
"Total units available for analysis: X"

If X = 1, only one unit in Excel
If X > 1, units are loaded correctly
```

#### B. AI is Defaulting to First Unit
**Check:** If AI returns same unit for everything
**Solution:** This is in the AI prompt - it should match semantically

**Debug in logs:**
```
Check for lines like:
"MOCK ANALYSIS: Question matched to MARB002"

If you see this, you're in MOCK mode (no real AI)
→ Use real OpenAI API key
```

#### C. All Questions Actually Relate to Same Unit
**Check:** Your test document  
**Possibility:** If document only tests one unit's competencies

---

## 🔍 Enhanced Logging (Now Active)

The parser now logs detailed info to console:

```
🔍 Analyzing 52 pairs...

--- Pair 1 ---
Q: Trainer / Assessor Instructions...
A: (empty or short)
📋 Detected as INSTRUCTION

--- Pair 2 ---
Q: Part 1 – Ropework and lifting
A: (short)
📂 Section header: Part 1 – Ropework and lifting
⚠️  Skipping - no real answer

--- Pair 3 ---
Q: 1. How do you work out the WLL...
A: Read the label, colour match...
✓ Question 1 (Number: 1)
  📊 Section: Part 1 – Ropework and lifting

--- Pair 13 ---
Q: Refer to NSCV Part C
List SIX pieces of safety equipment...
A: Distress Signals: 3 Parachute...  
✓ Question 11 (Number: 13)
  📎 Refer heading: Refer to NSCV Part C
  💪 Bold parts: Distress Signals:, Navigation Equipment:
  📊 Section: Part 2 – Domestic Regulations

✅ Analysis complete:
   Instructions: 2
   Questions: 50
```

---

## 📊 What to Check in Browser Console

### When You Upload Files:

1. **Open Browser DevTools** (F12)
2. **Go to Console tab**
3. **Upload your files**
4. **Look for:**

```
✅ Good Signs:
- "🔍 Analyzing X pairs..." 
- "✓ Question N (Number: M)"
- "📊 Section: Part X"
- "✅ Analysis complete: Instructions: N, Questions: M"
- "Total units available for analysis: 10+" (multiple units)

⚠️ Warning Signs:
- "Total units available for analysis: 1" → Only ONE unit loaded!
- All questions show same section → Document might be single-unit
- "(Mocking AI response)" → Using mock API key, not real AI
- Missing expected questions → Check pair extraction logs
```

---

## 🎯 Action Plan

### Step 1: Test Upload & Check Logs
1. Open http://localhost:3001 (or 3000)
2. Open Browser Console (F12 → Console)
3. Upload your files
4. **Watch the logs** - you'll see detailed extraction info
5. Screenshot/copy any errors

### Step 2: Check Unit Count
Look for this line in logs:
```
"Total units available for analysis: X"
```

- If X = 1: **Excel problem** - file only has one unit
- If X > 10: **Good** - multiple units loaded

### Step 3: Check Instructions
Look for:
```
"📋 Detected as INSTRUCTION"
"✅ Analysis complete: Instructions: N"
```

- If N = 0: No instructions detected (might be fine if document has none)
- If N > 0: Instructions found! Should appear in UI

### Step 4: Check Question Count
Look for:
```
"✓ Question N"
```

Count how many you see. Compare to expected count in your document.

### Step 5: Check Unit Mapping
After analysis completes, check the Q&A table:
- Are different units showing?
- Or all the same?

If all same → Check Step 2 (unit count)

---

## 🔧 Quick Fixes

### If Instructions Not Showing in UI:
```bash
# Check if instructions are in the data
In browser console after upload:
> Check Network tab → analyze response → instructions array

If empty: Parser issue
If has data: UI issue (check QuestionAnswerTable.tsx)
```

### If All Mapped to Same Unit:
```bash
# Option 1: Check Excel has multiple units
Open your Excel file → verify multiple rows

# Option 2: Use real OpenAI API
Add OPENAI_API_KEY to .env.local (not mock-key)

# Option 3: Check logs for unit count
Should see "Total units available: 10+" not "1"
```

### If Missing Questions:
```bash
# Check the detailed logs
Look for "Skipping" messages
Each shows WHY a pair was skipped:
- "no answer" → Expected, fine
- "Detected as INSTRUCTION" → Check if wrong classification
```

---

## 📝 Test Checklist

Upload your files and verify:

- [ ] Browser console shows extraction logs
- [ ] Instructions count > 0 (if document has them)
- [ ] Question count matches expected (~60 for your doc)
- [ ] "Total units available" > 1  
- [ ] Section headers detected ("📂 Section header: Part X")
- [ ] "Refer to" headings preserved ("📎 Refer heading")
- [ ] Q&A table displays in UI
- [ ] Instructions section appears at top
- [ ] Different units mapped (not all same)

---

## 🚀 Expected Results with Your Document

Based on the content you shared:

### Instructions:
- Should detect **2 instruction blocks** at the top
- "Trainer / Assessor Instructions..."
- "Reasonable Adjustment..."

### Sections:
- Part 1 – Ropework and lifting
- Part 2 – Domestic Regulations  
- Part 3 – Anchoring and Beaching
- Part 4 – Pre-start checks/Voyage Planning
- Part 5 – Outboards
- Part 6 – Environmental considerations
- Part 7 – Construction and Maintenance

### Questions:
- **~60 questions total** (need to count exact from your doc)
- Question 1: "How do you work out the WLL..." (was missing before, should now appear)
- Questions should show section context
- "Refer to" headings preserved

### Unit Mapping:
- Should map to different units based on topic:
  - Rope questions → Rope/rigging units
  - Safety questions → Safety units  
  - Environmental → Environmental units
  - Etc.

**NOT all to MARB002!**

---

## 💡 Next Steps

1. **Do Step 1-5 from Action Plan** ✅
2. **Share console logs** if issues persist
3. **Check your Excel** - might only have MARB002
4. **Verify OpenAI API key** - not using mock mode

The enhanced logging will tell us exactly what's happening! 🔍
