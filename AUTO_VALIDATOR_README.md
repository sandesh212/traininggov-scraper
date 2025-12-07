# 🤖 Fully Automated Assessment Validator

## ✨ Zero Configuration - Just Run It!

Drop your files in this folder and run one command. The system does **everything** automatically.

---

## 🚀 Quick Start (3 Steps)

### 1. Set API Key (One Time Only)

```bash
export OPENAI_API_KEY="sk-proj-your-key-here"

# Make it permanent (add to ~/.zshrc)
echo 'export OPENAI_API_KEY="sk-proj-your-key-here"' >> ~/.zshrc
source ~/.zshrc
```

Get your key from: https://platform.openai.com/api-keys

### 2. Drop Your Files Here

Put these files in the project folder:
- ✅ **Unit list Excel** (e.g., `Units.xlsx`) - Contains unit codes
- ✅ **Assessment files** (Word `.docx` or Excel `.xlsx`)

That's it! No configuration needed.

### 3. Run the Validator

```bash
./VALIDATE.sh
```

Or from anywhere:
```bash
cd .config && npm run auto
```

**Done!** The system handles everything else automatically.

---

## 🎯 What Happens Automatically

The system performs **10 automated steps**:

### 1. 🔍 Finds Your Unit List
- Automatically locates Excel file with "unit" in the name
- Or uses the only Excel file if there's just one
- Extracts all unit codes automatically

### 2. 📥 Scrapes Unit Data (If Needed)
- Checks if unit details are already downloaded
- If missing, scrapes from training.gov.au automatically
- Saves to local database (data/uoc.jsonl)

### 3. 📂 Finds All Assessments
- Locates all Word documents (.docx, .doc)
- Locates all Excel files (.xlsx, .xls)
- Excludes marking sheets automatically
- Skips temporary files (starting with ~$)

### 4. 📄 Parses Documents
- Extracts questions from Word documents intelligently
- Parses Excel files (generic or SMT format)
- Identifies question types (knowledge/performance)
- Captures context for better AI matching

### 5. 🔗 Detects Clustering
- Identifies if assessments cover multiple units
- Maps which questions address which units
- Tracks cross-unit coverage automatically

### 6. 🤖 AI Validation
- Uses OpenAI embeddings for semantic understanding
- Matches questions to performance criteria
- Calculates similarity scores (not keyword matching!)
- Generates AI explanations for each match

### 7. 📊 Gap Analysis
- Identifies uncovered performance criteria
- Highlights low-confidence matches
- Suggests improvements

### 8. ✅ Compliance Checking
- Validates Rules of Evidence (Validity, Sufficiency, Authenticity, Currency)
- Validates Principles of Assessment (Fairness, Flexibility, Validity, Reliability)
- Provides pass/fail status for each rule

### 9. 📑 Report Generation
- Creates Excel report with 4 detailed sheets
- Generates text summary for quick review
- Saves to `validation-reports/` folder

### 10. 📺 Displays Results
- Shows summary in the terminal
- Lists compliance status
- Provides file locations

---

## 📊 Example Output

```
╔════════════════════════════════════════════════════════════════════════╗
║          🤖 FULLY AUTOMATED ASSESSMENT VALIDATOR                       ║
║          Just drop your files and run - I do the rest!                ║
╚════════════════════════════════════════════════════════════════════════╝

══════════════════════════════════════════════════════════════════════
  STEP 1: Finding Unit List
══════════════════════════════════════════════════════════════════════

✅ Found unit list: Units.xlsx

══════════════════════════════════════════════════════════════════════
  STEP 2: Extracting Unit Codes
══════════════════════════════════════════════════════════════════════

📖 Extracting unit codes from: Units.xlsx
   ✅ Found 5 unit codes: MARI003, MARN008, MARJ006, MARC037, MARK007

══════════════════════════════════════════════════════════════════════
  STEP 3: Checking Unit Data
══════════════════════════════════════════════════════════════════════

✅ All unit data already available!

══════════════════════════════════════════════════════════════════════
  STEP 4: Loading Unit Data
══════════════════════════════════════════════════════════════════════

✅ Loaded 5 units of competency
   • MARI003: Maintain safe navigation watch on a vessel
   • MARN008: Apply seamanship skills aboard a vessel
   • MARJ006: Operate and maintain main propulsion unit and auxiliary systems

══════════════════════════════════════════════════════════════════════
  STEP 5: Finding Assessment Files
══════════════════════════════════════════════════════════════════════

📂 Found assessment files:
   Word documents: 7
      • Knowledge Coxswain Deck.docx
      • Knowledge Seamanship.docx
      • Performance Coxswain Deck.docx
      ... (4 more)
   Excel files: 0

══════════════════════════════════════════════════════════════════════
  STEP 6: Parsing Assessments
══════════════════════════════════════════════════════════════════════

📄 Parsing 7 Word document(s)...
   ✅ Extracted 152 questions

✅ Total: 7 assessments with 152 questions

══════════════════════════════════════════════════════════════════════
  STEP 7: Analyzing Assessment Structure
══════════════════════════════════════════════════════════════════════

🔗 CLUSTERING DETECTED - Assessments cover multiple units:
   • Knowledge Coxswain Deck
     Units: MARI003, MARN008, MARJ006, MARC037, MARK007
   • Performance Coxswain Deck
     Units: MARN008, MARJ006, MARC037

══════════════════════════════════════════════════════════════════════
  STEP 8: Running AI Validation
══════════════════════════════════════════════════════════════════════

🤖 Using OpenAI to validate questions against performance criteria...
   This may take a few minutes depending on the number of questions...

[Progress bars and status updates...]

══════════════════════════════════════════════════════════════════════
  STEP 9: Generating Reports
══════════════════════════════════════════════════════════════════════

✅ Reports generated:
   • validation-report-2024-11-20.xlsx
   • validation-report-2024-11-20.txt

══════════════════════════════════════════════════════════════════════
  VALIDATION COMPLETE
══════════════════════════════════════════════════════════════════════

══════════════════════════════════════════════════════════════════════
  📊 SUMMARY
══════════════════════════════════════════════════════════════════════

Overall Compliance:        87.3%
Units Analyzed:            5
Assessments Processed:     7
Questions Analyzed:        152
Total PC Mappings:         398
  • High Confidence:       312
  • Medium Confidence:     68
  • Low Confidence:        18
Uncovered PCs:             12

🔗 Clustering:             Yes (multi-unit assessments)

──────────────────────────────────────────────────────────────────────
  ✅ COMPLIANCE STATUS
──────────────────────────────────────────────────────────────────────

Validity:      ✗ FAILED (12 uncovered PCs)
Sufficiency:   ✓ PASSED
Authenticity:  ✓ PASSED
Currency:      ✓ PASSED
Fairness:      ✓ PASSED
Flexibility:   ✓ PASSED
Reliability:   ✓ PASSED

══════════════════════════════════════════════════════════════════════
📁 Reports saved to: validation-reports/
══════════════════════════════════════════════════════════════════════

✅ AUTOMATION COMPLETE! All work done automatically.
```

---

## 📁 File Structure

```
your-project/
├── VALIDATE.sh                 ← Run this!
├── Units.xlsx                  ← Your unit list
├── Knowledge Assessment.docx   ← Your assessments
├── Performance Assessment.docx
├── validation-reports/         ← Generated reports appear here
│   ├── validation-report-2024-11-20.xlsx
│   └── validation-report-2024-11-20.txt
├── data/
│   └── uoc.jsonl              ← Scraped unit data (auto-generated)
└── .config/                   ← Hidden code (don't touch)
```

---

## 📊 Understanding the Reports

### Excel Report (4 Sheets)

#### Sheet 1: Summary
- Overall compliance percentage
- Pass/fail status for each validation rule
- Recommendations for improvement
- Quick stats (questions analyzed, mappings, gaps)

#### Sheet 2: Coverage Matrix
- Every question mapped to performance criteria
- AI similarity scores (80%+ = strong match)
- AI explanations of why they match
- Unit codes for each question
- Confidence levels (High/Medium/Low)

#### Sheet 3: Gap Analysis
- All performance criteria listed
- Coverage status (Covered/Not Covered)
- Which questions cover each PC
- PCs that need additional questions

#### Sheet 4: Issues & Recommendations
- Detailed validation findings
- Specific issues per rule
- Actionable recommendations
- Priority actions to fix gaps

### Text Report
- Quick console-friendly summary
- Same info as Excel, plain text format
- Good for quick review

---

## 🤖 How AI Matching Works

### Traditional Keyword Matching (FAILS)
```
Question: "inspect fire extinguisher"
PC: "apply fire safety procedures"
Match: NO ❌ (different words)
```

### Our AI Semantic Matching (SUCCEEDS)
```
Question: "inspect fire extinguisher"
    ↓ OpenAI Embedding
[0.123, -0.456, 0.789, ...] (1536 dimensions)

PC: "apply fire safety procedures"
    ↓ OpenAI Embedding
[0.134, -0.442, 0.801, ...] (1536 dimensions)

    ↓ Cosine Similarity
87% Match! ✅

    ↓ GPT-4 Explanation
"Inspecting fire equipment is a key component of applying
fire safety procedures, demonstrating knowledge of proper
safety equipment maintenance."
```

### Similarity Thresholds
- **80-100%** 🟢 High Confidence - Strong semantic match
- **70-80%** 🟡 Medium Confidence - Reasonable match, review recommended
- **Below 70%** 🔴 Low Confidence - Weak match, may need improvement

---

## 🔗 Clustering Support

The system automatically detects and handles **clustering** (multi-unit assessments).

### What is Clustering?
One assessment covering multiple Units of Competency.

**Example:**
```
"Coxswain Deck Assessment"
├── MARI003: Safe navigation watch
├── MARN008: Seamanship skills
├── MARJ006: Propulsion systems
├── MARC037: Communications
└── MARK007: Equipment maintenance
```

### How It's Handled
✅ Automatically detects multi-unit coverage  
✅ Maps questions to all relevant units  
✅ Validates coverage for each unit  
✅ Identifies gaps per unit  
✅ Provides unit-specific compliance scores

---

## 💰 Cost

### OpenAI API Costs (November 2024)
- **Text Embeddings**: $0.02 per 1M tokens
- **GPT-4o-mini**: $0.15 input + $0.60 output per 1M tokens

### Typical Usage
- **50 questions**: ~$0.03
- **150 questions**: ~$0.08
- **500 questions**: ~$0.25

**Very affordable!** Most validations cost less than $0.10.

---

## 🛠️ Troubleshooting

### "OPENAI_API_KEY not set"
```bash
export OPENAI_API_KEY="sk-proj-your-key-here"
echo 'export OPENAI_API_KEY="sk-proj-your-key-here"' >> ~/.zshrc
source ~/.zshrc
```

### "No unit list file found"
- Ensure you have an Excel file with unit codes
- Name it something with "unit" (e.g., Units.xlsx, UOC-List.xlsx)
- Or have only one Excel file in the folder

### "No assessment files found"
- Add Word documents (.docx) or Excel files (.xlsx)
- Ensure files don't start with ~$ (temporary files)
- Marking sheets are auto-excluded

### "No questions found"
- Run `cd .config && npm run test-parser` to see what's extracted
- Check if questions follow recognizable patterns:
  - Q1, Question 1, etc.
  - List, Describe, Explain commands
  - Numbered lists with questions

### Rate Limit Errors
- Free tier: 3 requests/minute
- Wait a few minutes and retry
- Or upgrade to paid OpenAI plan

---

## 🎯 Real-World Usage

### Pre-Audit Preparation
```bash
# 1. Drop all assessment files in folder
# 2. Run validator
./VALIDATE.sh

# 3. Review reports
open validation-reports/*.xlsx

# 4. Fix gaps identified
# 5. Run again to verify
./VALIDATE.sh
```

### New Assessment Development
```bash
# As you develop assessments:
# 1. Save the file
# 2. Run validator
./VALIDATE.sh

# 3. Check coverage
# 4. Add questions to fill gaps
# 5. Repeat until 100% compliant
```

### Regular Quality Checks
```bash
# Monthly/quarterly validation
./VALIDATE.sh

# Archive reports
mv validation-reports validation-reports-$(date +%Y-%m)

# Track improvement over time
```

---

## 📚 Documentation

Comprehensive guides available:
- `WORD_SUPPORT_GUIDE.md` - Word document support details
- `AI_VALIDATOR_GUIDE.md` - AI validation deep dive
- `README_AI_VALIDATOR.md` - Project overview
- `SYSTEM_COMPLETE.md` - Complete feature list

---

## ✅ What Makes This Special

### Fully Automated
- ✅ No configuration files
- ✅ No command-line arguments
- ✅ No manual steps
- ✅ Just drop files and run

### Intelligent
- ✅ Auto-discovers files
- ✅ Detects clustering
- ✅ Understands meaning (not keywords)
- ✅ Learns from your documents

### Comprehensive
- ✅ Word & Excel support
- ✅ All RTO compliance rules
- ✅ Detailed reports
- ✅ Actionable recommendations

### Production-Ready
- ✅ Handles 1000+ questions
- ✅ Supports clustering
- ✅ Professional reports
- ✅ Costs pennies

---

## 🎉 Summary

**One Command Does Everything:**

```bash
./VALIDATE.sh
```

**The System Automatically:**
1. Finds your unit list
2. Scrapes unit data (if needed)
3. Finds all assessments
4. Detects clustering
5. Validates with AI
6. Checks compliance
7. Generates reports
8. Shows results

**No configuration. No manual work. Just results!** 🚀

---

**Built for the 9,000+ RTOs across Australia** 🇦🇺

*Zero-config automation for assessment validation*
