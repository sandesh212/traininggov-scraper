# Training.gov.au Scraper (Maritime Excel Format)

Scrapes Units of Competency from training.gov.au, preserves structure (elements, PCs, performance/knowledge evidence, assessment conditions), and generates a maritime-format multi‑sheet Excel workbook with category headers, zebra striping, and formulas.

## Highlights

- Multi‑strategy parser: handles varied HTML structures; preserves line breaks and bullets for Assessment Conditions and Evidence.
- Dynamic code matching: automatically tries code variations (e.g., `RIIWHS202` finds `RIIWHS202D` or `RIIWHS202E`) to handle suffix changes on training.gov.au.
- Maritime Excel: 7 sheets with two‑row headers, category merges, white header text, zebra striping, black separator rows, and `SUMPRODUCT` mapping counts (excludes null/0/empty).
- One‑click runners: `START.sh` (Mac/Linux) and `START.bat` (Windows) auto‑install deps, read `Units.xlsx`, retry failed units, and regenerate Excel.
- Robust retry + logging: invalid codes skipped; transient errors retried and logged to `data/error-log.json`.

## Project Structure

```text
traininggov-scraper
├── src
│   ├── index.ts                  # CLI: scrape specific URLs, then export
│   ├── autoSync.ts               # Main flow: read Units.xlsx, validate, scrape, export
│   ├── crawler.ts                # Orchestrates scraping
│   ├── fetcher.ts                # Headless browser fetcher
│   ├── parsers/uocParser.ts      # Robust parser (bullets, line breaks preserved)
│   ├── services/exportService.ts # JSONL writer + per‑unit cache
│   ├── services/maritimeExcelService.ts # Maritime multi‑sheet Excel generator
│   ├── models/*.ts               # Types
│   └── utils/logger.ts           # Lightweight logger
├── tests
│   ├── maritimeExcelService.test.ts
│   └── uocParser.test.ts
├── START.sh / START.bat          # One‑click launchers (Units.xlsx input)
├── Unit Scraper.app (macOS)      # Double‑clickable app bundle (optional)
├── data/                         # Outputs (created automatically)
│   ├── uoc.jsonl                 # One JSON object per unit
│   ├── UnitsData.xlsx            # Maritime workbook
│   └── error-log.json            # Validation + retry tracking
└── package.json, tsconfig.json
```

## Run

### Easiest: Double‑click

- macOS/Linux: double‑click `START.sh`
- Windows: double‑click `START.bat`

Requirements: Node.js v18+, an `Units.xlsx` file in the project root. Results are written to `data/UnitsData.xlsx` and `data/uoc.jsonl`.

### CLI: Use Units.xlsx

```bash
# Install deps (first time)
npm install

# Run autosync (reads Units.xlsx, all sheets/columns)
npx tsx src/autoSync.ts

# Options
npx tsx src/autoSync.ts --input MyUnits.xlsx --output Results.xlsx --column "Unit Code"
```

### CLI: Direct URLs

```bash
npx tsx src/index.ts \
  https://training.gov.au/training/details/MARK007/unitdetails \
  https://training.gov.au/training/details/MARH013/unitdetails
```

## Output

### JSONL (`data/uoc.jsonl`)

- One unit per line; complete structured fields; duplicates replaced.

### Excel (`data/UnitsData.xlsx`)

- Sheets: ESS Mapping, Deck Mapping, Navigation Mapping, Engineering Mapping, LROCP Mapping, DMLA, Assessment Conditions.
- Headers: Two rows with merged category cells; white header text; category colors (Knowledge grey, Performance yellow).
- Columns (mapping sheets): `Unit`, `Element`, `Criteria/Evidence`, `Performance Criteria`, optional `AMPA Conditions`, `Mapping Count`, followed by assessment columns per sheet.
- Styling: Zebra striping, full‑black separator rows between units, borders, freeze panes, auto‑filters.
- Formulas: `Mapping Count` uses `COUNTA` across assessment columns.
- Assessment Conditions sheet: Unit rows in blue, blank black separators between units, and AMSA footer with 8 codes.
- Headers: Two rows with merged category cells; white header text; category colors (Knowledge grey, Performance yellow).
- Columns (mapping sheets): `Unit`, `Element`, `Criteria/Evidence`, `Performance Criteria`, optional `AMPA Conditions`, `Mapping Count`, followed by assessment columns per sheet.
- Styling: Zebra striping, full‑black separator rows between units, borders, freeze panes, auto‑filters.
- Formulas: `Mapping Count` uses `SUMPRODUCT` to count only cells with actual values (excludes empty, null, and 0) across assessment columns in the same row.
- Assessment Conditions sheet: Unit rows in blue, blank black separators between units, and AMSA footer with 8 codes.

## Tests

```bash
npm test
```

Validates parser behavior and Excel generation (including `SUMPRODUCT` mapping counts).

## Requirements

- Node.js v18+
- macOS/Windows/Linux
- Network connectivity to training.gov.au

## Contributing

Issues and PRs welcome. Please run `npm test` before submitting.

## License

MIT
