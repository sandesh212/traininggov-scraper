# Training.gov.au Scraper

This project is a web scraper designed to extract data from the Training.gov.au website, specifically targeting Units of Competency (UOCs). The scraper fetches HTML content from specified UOC pages, parses the relevant information, and allows for exporting the data in various formats.

## Project Structure

```
traininggov-scraper
├── src
│   ├── index.ts              # Entry point of the application
│   ├── crawler.ts            # Crawler class for orchestrating the scraping process
│   ├── fetcher.ts            # Fetcher class for handling HTTP requests
│   ├── parsers
│   │   └── uocParser.ts      # Parser for extracting UOC data from HTML
│   ├── models
│   │   └── uoc.ts            # UOC model defining the structure of UOC objects
│   ├── services
│   │   └── exportService.ts   # Service for exporting scraped data
│   └── utils
│       └── requestUtils.ts    # Utility functions for making HTTP requests
├── tests
│   └── uocParser.test.ts      # Unit tests for the UOC parser
├── package.json                # npm configuration file
├── tsconfig.json              # TypeScript configuration file
├── .gitignore                  # Files and directories to ignore in version control
└── README.md                   # Project documentation
```

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/traininggov-scraper.git
   ```
2. Navigate to the project directory:
   ```
   cd traininggov-scraper
   ```
3. Install the dependencies:
   ```
   npm install
   ```

## Usage

### Scraping Units of Competency

To scrape one or more units and automatically export to both JSONL and Excel formats:

```bash
# Scrape a single unit
npx tsx src/index.ts https://training.gov.au/training/details/MARK007/unitdetails

# Scrape multiple units
npx tsx src/index.ts \
  https://training.gov.au/training/details/MARK007/unitdetails \
  https://training.gov.au/training/details/MARH013/unitdetails
```

This will:
1. Scrape the unit(s) data from training.gov.au
2. Save the raw data to `data/uoc.jsonl` (one JSON object per line)
3. Automatically create an Excel file at `data/UnitsOfCompetency.xlsx`

### Excel Export Only

If you already have scraped data in JSONL format and want to export it to Excel:

```bash
npx tsx src/exportToExcel.ts data/uoc.jsonl MyOutput.xlsx
```

### Output Formats

#### JSONL Format (`data/uoc.jsonl`)
- Complete structured data for all units
- One JSON object per line
- Easy to process programmatically
- Contains all fields with nested structures preserved

#### Excel Format (`data/UnitsOfCompetency.xlsx`)
The Excel file follows this column structure:
- **Unit**: Unit code and title (e.g., "MARK007 Handle a vessel up to 12 metres")
- **Element**: Element description
- **Criteria/Action**: Performance criteria number (e.g., "1.1", "2.3")
- **Performance Criteria**: Full text of the performance criterion
- **AMPA Conditions**: Assessment conditions (if applicable)
- **Mapping Comment**: Reserved for manual comments
- **Knowledge/Assessment**: Knowledge evidence items
- **Performance Evidence**: Performance evidence items

Each unit's data is organized with:
- Performance criteria grouped by element
- Knowledge evidence as separate rows
- Performance evidence as separate rows
- Assessment conditions as separate rows


This will initiate the crawling process and start scraping data from the specified UOC pages.

## Exporting Data

The scraped data can be exported to various formats. The default format is JSON. You can modify the export settings in the `exportService.ts` file.

## Running Tests

To run the unit tests for the UOC parser, use the following command:
```
npm test
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.