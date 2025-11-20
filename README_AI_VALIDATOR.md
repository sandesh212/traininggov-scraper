# 🎓 AI Assessment Validator for RTOs

> **AI-powered assessment validation tool for Australian RTOs** that validates assessments against Training Package requirements using semantic understanding.

## ✨ Key Features

### 🤖 **Semantic AI Matching**
- Uses OpenAI embeddings to understand **meaning**, not just match exact words
- Example: "Inspect the engine" matches "Examine propulsion systems" semantically
- Provides AI explanations for each match

### 📊 **Multi-Unit, Multi-Assessment Support**
- Validate multiple Units of Competency simultaneously
- Handle clustering (multiple UoCs across assessments)
- Process hundreds of assessment questions at once

### ✅ **Comprehensive Validation**
- **Rules of Evidence**: Validity, Sufficiency, Authenticity, Currency
- **Principles of Assessment**: Fairness, Flexibility, Validity, Reliability
- **Gap Analysis**: Identifies uncovered performance criteria
- **Coverage Matrix**: Maps each question to UoC requirements

### 📈 **Professional Reporting**
- Detailed Excel reports with 4 sheets (Summary, Coverage Matrix, Gap Analysis, Issues)
- Text reports for quick review
- AI-generated explanations for all mappings
- Compliance scores and recommendations

## 🚀 Quick Start

### 1. Install & Setup

```bash
# Clone the repository
git clone https://github.com/sandesh212/traininggov-scraper.git
cd traininggov-scraper

# Set your OpenAI API key
export OPENAI_API_KEY="sk-proj-your-key-here"

# Scrape unit data (first time only)
./RUN_SCRAPER.command
```

### 2. Validate an Assessment

```bash
cd .config

# Option A: Specific units
npm run validate -- --units MARH013,MARB027 --assessment ../MyAssessment.xlsx

# Option B: Units from file
npm run validate -- --units-file ../Units.xlsx --assessment ../MyAssessment.xlsx
```

### 3. Review Reports

Check the `validation-reports/` directory for:
- **Excel Report**: Detailed coverage matrix, gap analysis, AI explanations
- **Text Report**: Quick summary with scores and recommendations

## 📖 Documentation

- **[AI Validator Guide](./AI_VALIDATOR_GUIDE.md)**: Complete usage documentation
- **[User Guide](./USER_GUIDE.md)**: Scraper documentation
- **[Setup Guide](./SETUP_COMPLETE.md)**: Installation instructions

## 🎯 How It Works

### 1. Scraping Phase
```
Training.gov.au → Scraper → UoC Database (data/uoc.jsonl)
```

### 2. Assessment Parsing
```
Assessment Excel → Parser → Structured Questions
```

### 3. AI Semantic Matching
```
Questions + UoC PCs → OpenAI Embeddings → Similarity Scores
```

### 4. Validation & Reporting
```
Mappings + Rules + Principles → Validation Engine → Reports
```

## 💡 Use Cases

### ✅ **Pre-Audit Validation**
Validate all assessments before ASQA audit to ensure compliance

### ✅ **Assessment Development**
Check coverage as you develop new assessments

### ✅ **Clustering Analysis**
Verify that clustered assessments cover all required UoCs

### ✅ **Continuous Improvement**
Regular validation to maintain assessment quality

## 📊 Example Report Output

```
═══════════════════════════════════════════════════════════════
           AI ASSESSMENT VALIDATION REPORT
═══════════════════════════════════════════════════════════════

📊 SUMMARY
──────────────────────────────────────────────────────────────
Overall Compliance:        87.3%
Units Analyzed:            5
Questions Analyzed:        47
Total Mappings:            124
  • High Confidence:       98
  • Medium Confidence:     22
  • Low Confidence:        4
Uncovered PCs:             8

✅ RULES OF EVIDENCE
──────────────────────────────────────────────────────────────
Validity:      ✗ FAILED
               - 8 performance criteria not covered
Sufficiency:   ✓ PASSED
Authenticity:  ✓ PASSED
Currency:      ✓ PASSED

💡 RECOMMENDATIONS
──────────────────────────────────────────────────────────────
1. Add questions to cover 8 missing performance criteria
2. Review 4 low-confidence matches for alignment
```

## 🔧 Technical Stack

- **Node.js v22+**: Runtime
- **TypeScript**: Type-safe code
- **OpenAI API**: Semantic embeddings & AI explanations
- **Puppeteer**: Web scraping
- **XLSX**: Excel processing
- **Cosine Similarity**: Vector matching

## 🌟 What Makes This Unique

### Traditional Keyword Matching ❌
```
Assessment: "Inspect engine for defects"
PC: "Examine propulsion systems for faults"
Result: NO MATCH (different words)
```

### AI Semantic Matching ✅
```
Assessment: "Inspect engine for defects"
PC: "Examine propulsion systems for faults"
Result: 85% MATCH (same meaning)
Explanation: "Both require inspection of machinery for defects"
```

## 🎓 For RTOs and Training Providers

This tool helps you:
- ✅ Ensure assessment validity before audits
- ✅ Reduce time spent on manual mapping
- ✅ Improve assessment quality with AI insights
- ✅ Demonstrate compliance systematically
- ✅ Handle complex clustering scenarios

## 📦 Project Structure

```
traininggov-scraper/
├── .config/                          # Hidden source code
│   ├── src/
│   │   ├── autoSync.ts              # Scraper
│   │   ├── validateAssessment.ts    # AI Validator CLI
│   │   └── services/
│   │       ├── aiValidationService.ts     # AI matching engine
│   │       ├── assessmentParser.ts        # Excel parser
│   │       └── reportGenerator.ts         # Report generation
│   └── package.json
├── data/
│   ├── uoc.jsonl                    # Scraped unit data
│   └── UnitsData.xlsx               # Units Excel
├── validation-reports/               # Validation outputs
├── RUN_SCRAPER.command              # One-click scraper
├── Units.xlsx                       # Input: units to scrape
└── AI_VALIDATOR_GUIDE.md           # Full documentation
```

## 🤝 Contributing

This project is maintained by SMT and contributors. For questions:
- Email: jamesg@smt.edu.au
- Issues: GitHub Issues

## 📄 License

Intellectual Property shared between SMT and developers.

## 🚦 System Requirements

- **Node.js**: v18 or higher
- **Memory**: 2GB+ RAM
- **Storage**: 500MB for dependencies
- **Internet**: Required for scraping and OpenAI API
- **OpenAI API Key**: Required for AI validation

## 🎯 Next Steps

1. **Read the Guide**: Check [AI_VALIDATOR_GUIDE.md](./AI_VALIDATOR_GUIDE.md)
2. **Get API Key**: Visit https://platform.openai.com/api-keys
3. **Scrape Units**: Run `./RUN_SCRAPER.command`
4. **Validate**: Run `npm run validate`
5. **Review Reports**: Check your validation results

---

**Made with ❤️ for Australian RTOs**

For the 9,000+ RTOs in Australia that need reliable assessment validation.
