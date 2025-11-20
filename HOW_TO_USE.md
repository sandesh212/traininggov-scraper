# 🚀 How to Use - RTO Assessment Validator

## Quick Start - Just Double-Click!

### macOS 🍎
1. **Double-click** `VALIDATE.command`
2. That's it! The validator will:
   - Check Ollama is installed and running
   - Download required AI models (if needed)
   - Find your assessment files automatically
   - Validate everything
   - Generate reports

**First Time Only:** macOS may ask for permission to run the file. If you see "cannot be opened because it is from an unidentified developer":
- Right-click `VALIDATE.command` → Open
- Click "Open" in the security dialog
- Enter your password if prompted

### Windows 🪟
1. **Double-click** `VALIDATE.bat`
2. That's it! Same automatic process as macOS

### Linux 🐧
1. **Double-click** `VALIDATE.sh`
2. If that doesn't work, right-click → Properties → Permissions → Check "Allow executing file as program"
3. Then double-click again

---

## What Files Do I Need?

Just put your files in the project folder:

### Required:
1. **Unit List Excel File** - Any Excel file with unit codes (e.g., `MARI003`, `MARN008`)
   - Can be named anything (e.g., `units.xlsx`, `unit_list.xlsx`)
   - Must have unit codes in one of the columns

2. **Assessment Files** - Put in any subfolder
   - **Word documents** (`.docx`) - For written assessments
   - **Excel files** (`.xlsx`) - For maritime practical assessments
   - Can be in any folder structure

### That's All!
The validator automatically:
- Finds your unit list file
- Extracts unit codes
- Scrapes unit data from training.gov.au
- Finds all assessment files (Word and Excel)
- Detects if units are clustered
- Validates everything with AI
- Generates comprehensive reports

---

## Where Are the Reports?

After validation completes, check:
- `.config/validation-reports/` - All reports saved here
- Each unit gets its own detailed report
- Reports include:
  - Coverage analysis (which PCs are covered)
  - Gap analysis (what's missing)
  - Question-to-PC mappings
  - AI explanations for each match
  - Compliance summary

---

## Requirements

### First Time Setup:
1. **Install Ollama** (FREE, local AI - no API keys needed)
   - Visit: https://ollama.com/download
   - Download for your OS (Mac/Windows/Linux)
   - Install and run it

2. **AI Models** (Automatic)
   - The launcher will automatically download:
     - `llama3.2` (text generation, ~2GB)
     - `nomic-embed-text` (embeddings, ~274MB)
   - This happens once, first time you run

### Already Installed:
- Node.js (you already have this)
- The validator (you already have this)

---

## Troubleshooting

### "Ollama is not installed"
- Install Ollama from: https://ollama.com/download
- Make sure it's in your system PATH

### "Ollama is not running"
- The launcher will try to start it automatically
- If that fails, manually run: `ollama serve`
- Keep that terminal open while validating

### "No unit list file found"
- Make sure you have an Excel file with unit codes
- File can be named anything
- Must be in the project root or `.config/` folder

### "No assessment files found"
- Put Word (`.docx`) or Excel (`.xlsx`) files anywhere in the project
- The validator searches all subfolders automatically

### Still Having Issues?
- Check the console output for detailed error messages
- Make sure all files are in the correct location
- Verify Ollama is running: Open browser to http://localhost:11434

---

## What Gets Validated?

### Word Documents:
- Extracts all questions automatically
- Maps questions to Performance Criteria (PCs)
- Identifies knowledge and skill gaps
- Checks coverage completeness

### Excel Files (Maritime):
- Extracts practical tasks and criteria
- Maps to unit elements and PCs
- Validates performance standards
- Checks assessment conditions

### Clustering Detection:
- Automatically detects if multiple units are in one assessment
- Validates cross-unit coverage
- Ensures all clustered units are properly assessed

---

## Zero Configuration Required!

You don't need to:
- ❌ Edit any config files
- ❌ Set up API keys
- ❌ Specify unit codes manually
- ❌ Tell it where files are
- ❌ Choose validation options
- ❌ Type terminal commands

Just:
- ✅ Put your files in the folder
- ✅ Double-click the launcher
- ✅ Wait for results

**It's that simple!** 🎉
