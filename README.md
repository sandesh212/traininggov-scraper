# AI Assessment Validator - Training.gov.au Scraper

## Project Summary
A Next.js application that validates and analyzes training assessment documents against Australian training.gov.au unit standards.

## Key Features
- **Document Analysis**: Extracts questions and answers from DOCX files
- **Unit Validation**: Scrapes and validates Units of Competency from training.gov.au
- **AI Mapping**: Uses local AI to map assessment questions to unit elements and performance criteria
- **Compliance Reports**: Generates detailed HTML reports showing coverage and gaps

## Architecture

### Stack
- **Frontend**: Next.js 16 (React 19), TailwindCSS, Framer Motion
- **Backend**: Next.js API Routes (Server-side)
- **Scraping**: Puppeteer (headless Chrome) + Cheerio for HTML parsing
- **AI**: Local transformer models via @xenova/transformers
- **File Processing**: Mammoth (DOCX), XLSX (Excel), custom parsers

### Key Services
1. **ScraperService** (`/src/services/scraperService.ts`)
   - Fetches unit data from training.gov.au
   - Uses Puppeteer to handle SPA (Single Page Application) pages
   - Extracts elements, performance criteria, and assessment requirements
   
2. **AIService** (`/src/services/aiService.ts`)
   - Semantic similarity matching between questions and performance criteria
   - Uses sentence transformers for embeddings

3. **UocLoader** (`/src/services/uocLoader.ts`)
   - Manages unit database (stored in JSON)
   - Handles unit refresh and restoration

4. **Document Parsers**
   - `structuredDocxParser.ts`: Extracts structured question-answer pairs
   - `redTextExtractor.ts`: Extracts red-colored text (answers) from DOCX
   - `extractQuestionsFromDocx.ts`: Main question extraction logic

## Installation

```bash
# Install dependencies
cd web
npm install

# Build the project
npm run build

# Start development server
npm run dev

# Start production server
npm run build && npm start
```

## Environment Variables

Create a `.env.local` file in the `/web` directory:

```
# Optional: OpenAI API key for enhanced AI features
OPENAI_API_KEY=your_key  # Can use local models instead
```

## Usage

1. **Upload Assessment File** (DOCX)  
   The main assessment document containing questions and answers (in red text)

2. **Upload Units List** (Excel, optional)  
   An Excel file containing a list of unit codes to validate against. If not provided, the system will auto-detect units from the assessment.

3. **Analyze**  
   The system will:
   - Extract questions and answers
   - Validate/scrape units from training.gov.au
   - Map questions to unit performance criteria
   - Generate a compliance report

4. **Review Report**  
   - View question-to-unit mappings
   - See coverage statistics
   - Identify gaps and recommendations

## Troubleshooting

### Units showing as "invalid" when they exist
**Problem**: training.gov.au migrated to a Nuxt.js SPA, requiring JavaScript execution to view content.

**Solution**: The scraper now uses Puppeteer (headless Chrome) to render pages. Ensure:
- Chrome/Chromium is installed
- Sufficient timeout settings (45s page load, 15s content wait)
- Network stability

**Debug**: Check server logs for Puppeteer errors like:
```
Detected SPA shell for XXX. Switching to Puppeteer...
Content loaded for XXX
Page text length: XXXX chars
```

### Slow analysis
Puppeteer adds ~5-10 seconds per unit. For 50 units, expect ~5-10 minutes.

### Out of memory
Puppeteer is resource-intensive. For large batches:
- Increase Node memory: `NODE_OPTIONS="--max-old-space-size=4096" npm run dev`
- Process units in smaller batches

## API Routes

### `POST /api/analyze`
**Request Body (FormData)**:
- `assessmentFile`: DOCX file
- `unitsFile`: Excel file (optional)
- `ignoreInvalid`: boolean (optional) - Continue even if some units invalid

**Response**:
```json
{
  "report": { ... },
  "redTextSegments": [ ... ],
  "invalidUnits": [  // If ignoreInvalid=false
    { "code": "XXX", "url": "https://...", "reason": "..." }
  ]
}
```

### `GET /api/units`
Get all units in the database.

### `GET /api/units/[code]`
Get a specific unit.

### `POST /api/units/refresh`
Re-scrape all units from training.gov.au.

### `POST /api/units/restore`
Restore units from backup.

## Development Notes

### Recent Changes (Dec 2025)
- **Puppeteer Integration**: Added headless browser support for SPA scraping
- **Failure Reasons**: Scraper now tracks WHY units fail validation
- **Enhanced Wait Conditions**: Waits for "Assessment Conditions" text before parsing
- **Better Error Handling**: More descriptive console logs and error messages

### Known Issues
1. **Puppeteer Performance**: Slow for large batches (working as intended, can't be avoided for SPA pages)
2. **UI Responsiveness**: Some overlap issues on mobile (to be fixed)
3. **Bulk Upload**: Not yet implemented in Manage Units

### TODO
- [ ] Add detailed failure reasons in UI
- [ ] Implement bulk unit upload in Manage Units
- [ ] Add toggle for "save to database" vs "one-time use"
- [ ] Fix responsive design issues (logo, title overlap)
- [ ] Show real-time database update status
- [ ] Improve scraper resilience

## Contributing

When making changes:
1. Test with both valid and invalid unit codes
2. Check console logs for detailed scraping output
3. Verify Puppeteer screenshots (if debugging)
4. Run `npm run build` to check for TypeScript errors

## License
[Specify your license]

## Support
For issues or questions, please [create an issue](link-to-issues).
