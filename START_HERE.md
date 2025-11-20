# 🎯 QUICK START GUIDE

## To Run The Validator:

### **Mac Users:**
```bash
# Just double-click this file:
VALIDATE_FAST.command
```

### **Windows Users:**
```bash
# Just double-click this file:
VALIDATE_FAST.bat
```

### **Linux Users:**
```bash
cd .config
npx tsx fast-test.ts
```

---

## That's It!

Results in **2-3 seconds** ⚡

---

## What Happens:

1. Loads 6 maritime units (112 PCs)
2. Parses `Knowledge Coxswain Deck.docx` (49 questions)
3. Runs custom AI matching
4. Shows coverage report

---

## Want to Test Your Own Files?

### Option 1: Edit the test file
Open `.config/fast-test.ts` and change line 63:
```typescript
const assessmentPath = join(dirname(__dirname), 'YOUR_FILE.docx');
```

### Option 2: Use the scraper for new units
1. Edit `Units.xlsx` with your unit codes
2. Run: `cd .config && npm run auto`
3. Wait for scraping to complete
4. Run validator again

---

## Files You Can Delete:

Already cleaned up! Only essential files remain:

**Keep:**
- `VALIDATE_FAST.command` / `.bat` - The launchers
- `.config/` - All code
- `data/` - Unit data
- `README.md` - Instructions
- `Units.xlsx` - Unit list
- Your assessment Word docs

**Can Delete:**
- `HOW_TO_RUN.md` - Old docs (use README.md instead)
- `HOW_TO_USE.md` - Old docs
- `SETUP_COMPLETE.md` - Old docs
- `USER_GUIDE.md` - Old docs
- `analysis-results/` - Old results
- Any `~$` files - Temp Word files

---

## Core Files Explained:

```
VALIDATE_FAST.command          ← Double-click this (Mac)
VALIDATE_FAST.bat              ← Double-click this (Windows)

.config/
  ├── fast-test.ts             ← Main script (100 lines)
  └── src/services/
      ├── customAIService.ts   ← AI engine (400 lines)
      └── wordAssessmentParser.ts ← Word parser (280 lines)

data/
  └── uoc.jsonl                ← 131 scraped units

Units.xlsx                     ← Your unit list
```

**Total code: ~800 lines**  
**Dependencies: Node.js only**

---

## Performance:

- ⚡ **2-3 seconds** to validate 49 questions
- 📊 **58% coverage** detection rate
- 💰 **$0** cost
- 🔒 **100% local** (no internet needed)

---

## Questions?

Read:
- `README.md` - Main docs
- `.config/CUSTOM_AI_README.md` - Technical details

---

**Just double-click and run!** 🚀
