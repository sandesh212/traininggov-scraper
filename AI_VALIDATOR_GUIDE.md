# AI Assessment Validator - Quick Start Guide

## 🎯 What This Tool Does

The AI Assessment Validator uses artificial intelligence to validate your RTO assessments against Training Package Units of Competency (UoCs). It:

- ✅ Maps assessment questions to UoC performance criteria using **semantic AI** (understands meaning, not just exact words)
- ✅ Identifies coverage gaps (which PCs aren't covered)
- ✅ Validates against **Rules of Evidence** (Validity, Sufficiency, Authenticity, Currency)
- ✅ Validates against **Principles of Assessment** (Fairness, Flexibility, Validity, Reliability)
- ✅ Generates comprehensive Excel reports with AI explanations
- ✅ Handles multiple units and multiple assessments simultaneously

## 📋 Prerequisites

### 1. OpenAI API Key (Required)

This tool uses OpenAI's GPT-4 for semantic understanding. You need an API key:

1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Set it as an environment variable:

```bash
export OPENAI_API_KEY="sk-proj-your-key-here"
```

**Add to your shell profile** (~/.zshrc or ~/.bashrc) to make it permanent:

```bash
echo 'export OPENAI_API_KEY="sk-proj-your-key-here"' >> ~/.zshrc
source ~/.zshrc
```

### 2. Scraped Unit Data

First run the scraper to download unit data:

```bash
./RUN_SCRAPER.command
```

Or:

```bash
npm start
```

This creates `data/uoc.jsonl` with all unit information.

## 🚀 Basic Usage

### Option 1: Validate Specific Units

```bash
cd .config
npm run validate -- --units MARH013,MARB027 --assessment ../MyAssessment.xlsx
```

### Option 2: Validate Units from Excel File

```bash
cd .config
npm run validate -- --units-file ../Units.xlsx --assessment ../MyAssessment.xlsx
```

### Option 3: Specify Output Directory

```bash
cd .config
npm run validate -- --units MARH013 --assessment ../test.xlsx --output ../my-reports
```

## 📊 Assessment File Format

### Generic Format

Your assessment Excel should have questions in any of these column names:
- `Question`
- `Assessment Question`
- `Task`
- `Activity`
- `Knowledge Question`
- `Performance Task`

Example:

| Question | Type |
|----------|------|
| Describe the safety procedures for engine maintenance | Knowledge |
| Demonstrate proper use of navigation equipment | Performance |

### SMT Maritime Format

If your Excel uses SMT's format (like UnitsData.xlsx), the tool will auto-detect it:
- Row 0: Category headers (Knowledge Assessment/s, Performance Assessment/s)
- Row 1: Column headers (Learners workbook question, Workbook Classroom Activity, etc.)
- Row 2+: Unit data with questions

Use `--format smt` to force SMT format parsing.

## 📈 Understanding the Results

### Overall Compliance Score

- **90-100%**: Excellent coverage
- **70-89%**: Good, but some gaps exist
- **50-69%**: Significant gaps, review needed
- **<50%**: Major issues, substantial rework required

### Semantic Similarity Scores

- **High (80%+)**: Strong match - the question clearly addresses the PC
- **Medium (70-80%)**: Reasonable match - review to ensure adequate coverage
- **Low (<70%)**: Weak match - likely doesn't fully cover the requirement

### AI Explanations

Each mapping includes an AI-generated explanation like:

> "This assessment question addresses the performance criterion by requiring students to demonstrate knowledge of safety protocols, which aligns with the requirement to 'apply safety procedures when maintaining equipment.'"

## 📁 Report Outputs

The tool generates two files in the output directory:

### 1. Excel Report (`validation-report-YYYY-MM-DD.xlsx`)

Four sheets:

1. **Summary**: Overview, compliance scores, pass/fail status
2. **Coverage Matrix**: Detailed question → PC mappings with AI explanations
3. **Gap Analysis**: All PCs showing which are covered and which aren't
4. **Issues & Recommendations**: Detailed validation issues and recommendations

### 2. Text Report (`validation-report-YYYY-MM-DD.txt`)

Console-friendly summary showing:
- Compliance scores
- Rules of Evidence validation
- Principles of Assessment validation
- Critical gaps
- Recommendations

## 🔍 Example Workflow

```bash
# 1. Set your OpenAI API key (one time)
export OPENAI_API_KEY="sk-proj-your-key-here"

# 2. Scrape unit data (if not already done)
./RUN_SCRAPER.command

# 3. Prepare your assessment Excel file
# Place it in the project root or note its path

# 4. Run validation
cd .config
npm run validate -- --units-file ../Units.xlsx --assessment ../MyAssessment.xlsx

# 5. Review reports
# Check validation-reports/ directory for Excel and text reports

# 6. Fix gaps and re-validate
# Add questions to cover uncovered PCs
# Run validation again to verify improvements
```

## 💡 Tips for Best Results

1. **Use Descriptive Questions**: The AI works best with clear, detailed questions
2. **Mix Question Types**: Include both knowledge and performance/observation questions
3. **Review Medium Confidence Matches**: These may need clarification
4. **Address Gaps Systematically**: Start with the most critical uncovered PCs
5. **Iterative Validation**: Re-run after making changes to track improvements

## 🐛 Troubleshooting

### "OPENAI_API_KEY environment variable not set"

Set your API key:
```bash
export OPENAI_API_KEY="your-key-here"
```

### "No unit data found"

Run the scraper first:
```bash
npm start
```

### "No assessment questions found"

Check your Excel file format. Try specifying column names:
```bash
npm run validate -- --units MARH013 --assessment test.xlsx
```

Or use SMT format:
```bash
npm run validate -- --units MARH013 --assessment test.xlsx --format smt
```

### API Rate Limits

If processing many questions, OpenAI may rate-limit you. The tool will automatically retry, but consider:
- Processing fewer units at once
- Upgrading your OpenAI API tier
- Adding delays between batches

## 📞 Support

For issues or questions:
- Check the detailed Excel report for specific guidance
- Review AI explanations for low-confidence matches
- Consult Rules of Evidence and Principles of Assessment documentation

## 🎓 Understanding Validation Rules

### Rules of Evidence

- **Validity**: Assessments must cover all UoC requirements
- **Sufficiency**: Must have both knowledge AND performance evidence
- **Authenticity**: Evidence must be verifiable as student's own work
- **Currency**: Evidence must be current

### Principles of Assessment

- **Fairness**: Considers individual needs, variety of methods
- **Flexibility**: Multiple assessment methods, recognizes prior learning
- **Validity**: Aligned to UoC, integrates knowledge and skills
- **Reliability**: Consistent interpretation across assessors
