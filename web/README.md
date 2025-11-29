# AI Assessment Validator - Web Application

A premium web-based tool for validating assessment questions against Units of Competency using AI.

## Features

✨ **Drag & Drop File Upload**
- Upload your Units of Competency list (Excel format)
- Upload assessment files (DOCX format)

🤖 **AI-Powered Analysis**
- Automatically maps questions to relevant units
- Identifies performance criteria and knowledge evidence
- Provides detailed reasoning for each mapping

📊 **Interactive Reports**
- Visual summary cards showing key metrics
- Detailed question-by-question analysis
- Confidence scores and validation status

## Getting Started

### Prerequisites

- Node.js 18+ installed
- OpenAI API key (optional - uses mock mode if not provided)

### Installation

1. Navigate to the web directory:
```bash
cd web
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables (optional):
```bash
# Create a .env.local file
echo "OPENAI_API_KEY=your-api-key-here" > .env.local
```

### Running the Application

**Development Mode:**
```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000)

**Production Build:**
```bash
npm run build
npm start
```

## Usage

### 1. Prepare Your Files

**Units List (Excel):**
- Create an Excel file with unit codes
- The file should contain unit codes like `MARN008`, `MARB027`, etc.
- You can use the sample file: `sample-units.xlsx`

**Assessment File (DOCX):**
- Upload your assessment document in DOCX format
- The file should contain numbered questions
- Use the sample: `Knowledge Coxswain Deck Marking Sheet.docx` from the parent directory

### 2. Upload Files

1. Click or drag your Units Excel file to the first upload zone
2. Click or drag your Assessment DOCX file to the second upload zone
3. Click "Run Analysis"

### 3. View Results

The report will show:
- **Summary**: Total questions, target units, and valid mappings
- **Detailed Analysis**: Each question with:
  - Mapped unit code
  - Validation status
  - Confidence score
  - AI reasoning

## File Structure

```
web/
├── app/
│   ├── api/
│   │   └── analyze/
│   │       └── route.ts          # API endpoint for analysis
│   ├── page.tsx                   # Main UI page
│   └── layout.tsx                 # App layout
├── src/
│   ├── components/                # Reusable UI components
│   ├── models/
│   │   └── types.ts               # TypeScript interfaces
│   └── services/
│       ├── aiService.ts           # AI validation logic
│       ├── docxQuestionExtractor.ts  # DOCX parsing
│       ├── excelParser.ts         # Excel parsing
│       ├── pdfQuestionExtractor.ts   # PDF parsing (disabled)
│       └── uocLoader.ts           # UoC data loader
├── data/
│   └── uoc.jsonl                  # Units of Competency database
└── public/                        # Static assets
```

## API Reference

### POST `/api/analyze`

Analyzes an assessment file against a list of units.

**Request:**
- Content-Type: `multipart/form-data`
- Fields:
  - `unitsFile`: Excel file with unit codes
  - `assessmentFile`: DOCX file with questions

**Response:**
```json
{
  "unitCodes": ["MARN008", "MARB027"],
  "mappedUnits": ["MARN008", "MARB027"],
  "questionsCount": 50,
  "results": [
    {
      "questionId": "Part1_Q1",
      "isValid": true,
      "mappedUnit": "MARN008",
      "mappedCriteria": ["1.1", "1.2"],
      "mappedKnowledge": ["K1"],
      "reasoning": "Question relates to...",
      "gaps": [],
      "confidence": 85
    }
  ]
}
```

## Known Limitations

- **PDF Support**: Currently disabled due to build compatibility issues with Next.js. Use DOCX files only.
- **Mock Mode**: If no OpenAI API key is provided, the system runs in mock mode with simulated results.

## Troubleshooting

**Build Errors:**
- Ensure you're using Node.js 18 or higher
- Delete `node_modules` and `.next` folders, then reinstall: `npm install`

**File Upload Issues:**
- Check file formats (Excel must be .xlsx, Assessment must be .docx)
- Ensure files contain valid data (unit codes in Excel, questions in DOCX)

**API Errors:**
- Check that `data/uoc.jsonl` exists and contains unit data
- Verify OpenAI API key if using real AI mode

## Development

**Tech Stack:**
- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- OpenAI API
- Mammoth (DOCX parsing)
- XLSX (Excel parsing)

**Adding New Features:**
1. Backend logic goes in `src/services/`
2. UI components go in `src/components/`
3. API routes go in `app/api/`

## License

This project is part of the traininggov-scraper toolkit.
