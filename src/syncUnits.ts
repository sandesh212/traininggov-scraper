import XLSX from 'xlsx';
import { Crawler } from "./crawler.js";
import { Fetcher } from "./fetcher.js";
import { ExportService } from "./services/exportService.js";
import { EnhancedExcelExportService } from "./services/enhancedExcelService.js";
import { parseUocHtml } from "./parsers/uocParser.js";
import { promises as fs } from "fs";
import * as path from "path";
import { Uoc } from "./models/uoc.js";

// Cached Fetcher wrapper to avoid re-downloading during validation
class CachedFetcher extends Fetcher {
  private cache = new Map<string, string>();

  setCache(url: string, html: string): void {
    this.cache.set(url, html);
  }

  async get(url: string): Promise<string> {
    if (this.cache.has(url)) {
      console.log(`[CachedFetcher] Using cached HTML for: ${url}`);
      return this.cache.get(url)!;
    }
    return super.get(url);
  }
}

interface SyncConfig {
  inputExcel: string;      // Excel file with unit codes to check
  inputColumn: string;     // Column name containing unit codes (e.g., "Unit Code")
  outputExcel: string;     // Excel file to store scraped data
  dataDir: string;         // Directory for JSONL data
  forceRescrape?: boolean; // If true, rescrape even if unit exists
}

/**
 * Validate if a string looks like a real training.gov.au unit code
 */
function isValidUnitCode(code: string): boolean {
  if (code.length < 6 || code.length > 12) return false;
  if (!code.match(/^[A-Z]{2,4}/)) return false;
  
  const digitCount = (code.match(/\d/g) || []).length;
  if (digitCount < 3) return false;
  
  const excludeList = [
    'SCUBA', 'HACCP', 'HACC', 'TAFE', 'CERT', 'DIPLOMA', 'ADVANCED',
    'STATEMENT', 'QUALIFICATION', 'TRAINING', 'EDUCATION',
    'SKILLS', 'COMPETENCY', 'ASSESSMENT', 'EVIDENCE'
  ];
  
  if (excludeList.includes(code.toUpperCase())) return false;
  return code.match(/^[A-Z]{2,4}[A-Z0-9]*\d+[A-Z]?$/i) !== null;
}

async function readUnitCodesFromExcel(filepath: string, columnName: string): Promise<string[]> {
  if (!await fs.access(filepath).then(() => true).catch(() => false)) {
    throw new Error(`Input Excel file not found: ${filepath}`);
  }

  const workbook = XLSX.readFile(filepath);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(worksheet);

  const unitCodes: string[] = [];
  const unitCodePattern = /\b([A-Z]{2,4}[A-Z0-9]{3,10})\b/g;

  for (const row of rows) {
    const columns = columnName ? [(row as any)[columnName]] : Object.values(row as any);
    
    for (const cellValue of columns) {
      if (cellValue && typeof cellValue === 'string') {
        const matches = cellValue.matchAll(unitCodePattern);
        for (const match of matches) {
          const code = match[1];
          if (isValidUnitCode(code)) {
            unitCodes.push(code);
          }
        }
      }
    }
  }

  const uniqueCodes = [...new Set(unitCodes)];
  console.log(`🔍 Extracted ${uniqueCodes.length} potential unit codes from Excel`);
  
  return uniqueCodes;
}

async function getExistingUnits(excelPath: string): Promise<Map<string, string>> {
  const existingUnits = new Map<string, string>(); // code -> release

  try {
    console.log(`🔍 Checking for existing units in: ${excelPath}`);
    const workbook = XLSX.readFile(excelPath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(worksheet);
    console.log(`📄 Found ${rows.length} rows in Excel`);

    for (const row of rows) {
      const codeCell = (row as any)['Unit Code'];
      const releaseCell = (row as any)['Release'] || '';
      
      if (codeCell) {
        existingUnits.set(codeCell, releaseCell);
      }
    }
    console.log(`✅ Extracted ${existingUnits.size} unique unit codes`);
  } catch (error: any) {
    console.log(`ℹ️  Could not read existing Excel: ${error.message}`);
  }

  return existingUnits;
}

async function syncUnits(config: SyncConfig): Promise<void> {
  console.log('\n🔄 Starting Unit Sync...\n');
  console.log(`📖 Reading unit codes from: ${config.inputExcel}`);
  console.log(`📊 Output Excel: ${config.outputExcel}`);
  console.log(`💾 Data directory: ${config.dataDir}\n`);

  // Step 1: Read unit codes from input Excel
  const requestedCodes = await readUnitCodesFromExcel(config.inputExcel, config.inputColumn);
  console.log(`✅ Found ${requestedCodes.length} unit codes in input Excel`);
  console.log(`   Units: ${requestedCodes.join(', ')}\n`);

  // Step 2: Check which units already exist in output Excel
  const outputExcelPath = path.join(config.dataDir, config.outputExcel);
  const existingUnits = await getExistingUnits(outputExcelPath);
  console.log(`📋 Found ${existingUnits.size} units already in output Excel`);
  if (existingUnits.size > 0) {
    console.log(`   Existing: ${Array.from(existingUnits.keys()).join(', ')}\n`);
  }

  // Step 3: Determine which units to scrape
  const unitsToScrape: string[] = [];
  
  for (const code of requestedCodes) {
    if (config.forceRescrape) {
      unitsToScrape.push(code);
    } else if (!existingUnits.has(code)) {
      console.log(`🆕 ${code}: New unit - will scrape`);
      unitsToScrape.push(code);
    } else {
      console.log(`✓  ${code}: Already exists (${existingUnits.get(code)}) - skipping`);
    }
  }

  if (unitsToScrape.length === 0) {
    console.log('\n✅ All units are up to date. Nothing to scrape!\n');
    return;
  }

  console.log(`\n🌐 Validating and scraping ${unitsToScrape.length} units...\n`);

  // Step 4: Validate and scrape the units
  const validUnits: string[] = [];
  const invalidUnits: { code: string; reason: string }[] = [];
  const errorUnits: { code: string; error: string }[] = [];

  // Use CachedFetcher to avoid re-downloading HTML
  const fetcher = new CachedFetcher({
    minDelayMs: 3000,
    headless: true,
    timeout: 30000
  });

  const exporter = new ExportService(config.dataDir);
  
  // Helper to categorize errors
  const categorizeError = (code: string, error: any): void => {
    const errorMsg = error.message || String(error);
    if (errorMsg.includes('404') || errorMsg.includes('not found')) {
      invalidUnits.push({ code, reason: '404 - Unit not found' });
      console.log(`   ❌ Invalid unit (404)`);
    } else if (errorMsg.includes('timeout') || errorMsg.includes('ETIMEDOUT')) {
      errorUnits.push({ code, error: 'Network timeout' });
      console.log(`   ⚠️  Network timeout`);
    } else if (errorMsg.includes('Connection closed') || errorMsg.includes('Protocol error')) {
      errorUnits.push({ code, error: 'Browser connection closed' });
      console.log(`   ⚠️  Connection error`);
    } else {
      errorUnits.push({ code, error: errorMsg });
      console.log(`   ⚠️  Error: ${errorMsg.substring(0, 50)}...`);
    }
  };
  
  // Validate each unit and cache HTML for later use
  for (const code of unitsToScrape) {
    const url = `https://training.gov.au/training/details/${code}/unitdetails`;
    
    try {
      console.log(`🔍 Checking: ${code}...`);
      const html = await fetcher.get(url);
      
      // Check if it's a valid unit page (not 404 or error page)
      if (html.includes('Unit of competency') || html.includes('Performance Criteria') || html.includes('Performance evidence')) {
        validUnits.push(code);
        fetcher.setCache(url, html); // Cache for later use
        console.log(`   ✅ Valid unit found`);
      } else if (html.includes('404') || html.includes('not found') || html.includes('does not exist')) {
        invalidUnits.push({ code, reason: 'Unit does not exist on training.gov.au (404)' });
        console.log(`   ❌ Invalid unit (404)`);
      } else {
        invalidUnits.push({ code, reason: 'Page found but no unit content detected' });
        console.log(`   ❌ Invalid unit (no data)`);
      }
    } catch (error: any) {
      categorizeError(code, error);
    }
    
    // Small delay between checks
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n📊 Validation Summary:`);
  console.log(`   ✅ Valid units: ${validUnits.length}`);
  console.log(`   ❌ Invalid units: ${invalidUnits.length}`);
  console.log(`   ⚠️  Error units: ${errorUnits.length}\n`);

  // Write error log if needed
  if (invalidUnits.length > 0 || errorUnits.length > 0) {
    const errorLog = {
      timestamp: new Date().toISOString(),
      summary: {
        totalChecked: unitsToScrape.length,
        valid: validUnits.length,
        invalid: invalidUnits.length,
        errors: errorUnits.length
      },
      invalidUnits,
      errorUnits
    };
    
    await fs.writeFile(
      path.join(config.dataDir, 'error-log.json'),
      JSON.stringify(errorLog, null, 2),
      'utf-8'
    );
    console.log(`📝 Error log saved to: ${path.join(config.dataDir, 'error-log.json')}\n`);
  }

  if (invalidUnits.length > 0) {
    console.log(`❌ Invalid units (not found on training.gov.au):`);
    invalidUnits.forEach(({code, reason}) => console.log(`   ${code}: ${reason}`));
    console.log();
  }
  if (errorUnits.length > 0) {
    console.log(`⚠️  Error units (may retry):`);
    errorUnits.forEach(({code, error}) => console.log(`   ${code}: ${error}`));
    console.log();
  }

  if (validUnits.length === 0) {
    console.log('\n⚠️  No valid units to scrape!\n');
    await fetcher.close();
    return;
  }

  console.log(`\n🌐 Scraping ${validUnits.length} valid units...\n`);

  // Step 5: Scrape only the valid units using same fetcher instance
  const urls = validUnits.map(code => 
    `https://training.gov.au/training/details/${code}/unitdetails`
  );

  const crawler = new Crawler(fetcher, exporter, {
    concurrency: 1,
    onItem: (item) => {
      console.log(`\n✅ Scraped: ${item.code} - ${item.title}`);
      console.log(`   Release: ${item.release || 'N/A'}`);
      console.log(`   Elements: ${item.elements?.length || 0}`);
      console.log(`   Performance Evidence: ${item.performanceEvidence ? '✓' : '✗'}`);
      console.log(`   Knowledge Evidence: ${item.knowledgeEvidence ? '✓' : '✗'}`);
    }
  });

  await crawler.crawlUocUrls(urls);
  console.log('\n✅ Scraping complete!\n');

  // Step 6: Export to Excel (append mode)
  console.log('📊 Updating Excel file...');
  const excelExporter = new EnhancedExcelExportService(config.dataDir, config.outputExcel);
  const jsonlPath = path.join(config.dataDir, 'uoc.jsonl');
  
  // Read only the newly scraped units from JSONL
  const content = await fs.readFile(jsonlPath, 'utf-8');
  const lines = content.trim().split('\n').filter(Boolean);
  const allUnits: Uoc[] = lines.map(line => JSON.parse(line));
  
  // Filter to only units we just scraped
  const newlyScrapedUnits = allUnits.filter(u => validUnits.includes(u.code));
  
  await excelExporter.exportToExcel(newlyScrapedUnits, config.outputExcel, true);
  
  console.log('\n✨ Sync complete!\n');
  
  // Summary
  console.log('📋 Summary:');
  console.log(`   ✅ Successfully scraped: ${validUnits.length} units`);
  if (invalidUnits.length > 0) {
    console.log(`   ❌ Invalid units (not found): ${invalidUnits.length}`);
    invalidUnits.slice(0, 5).forEach(({code, reason}) => console.log(`      - ${code}: ${reason}`));
    if (invalidUnits.length > 5) {
      console.log(`      ... and ${invalidUnits.length - 5} more (see error-log.json)`);
    }
  }
  if (errorUnits.length > 0) {
    console.log(`   ⚠️  Error units (can retry): ${errorUnits.length}`);
    errorUnits.slice(0, 5).forEach(({code, error}) => console.log(`      - ${code}: ${error}`));
    if (errorUnits.length > 5) {
      console.log(`      ... and ${errorUnits.length - 5} more (see error-log.json)`);
    }
  }
  console.log();
}

// Main entry point
async function main() {
  const args = process.argv.slice(2);

  // Default configuration
  const config: SyncConfig = {
    inputExcel: 'Units.xlsx',           // Your Excel with unit codes
    inputColumn: '',                     // Empty = scan all columns
    outputExcel: 'UnitsData.xlsx',       // Output with full unit data
    dataDir: 'data',
    forceRescrape: args.includes('--force')
  };

  // Allow command-line overrides
  const inputIndex = args.indexOf('--input');
  if (inputIndex >= 0 && args[inputIndex + 1]) {
    config.inputExcel = args[inputIndex + 1];
  }

  const outputIndex = args.indexOf('--output');
  if (outputIndex >= 0 && args[outputIndex + 1]) {
    config.outputExcel = args[outputIndex + 1];
  }

  const columnIndex = args.indexOf('--column');
  if (columnIndex >= 0 && args[columnIndex + 1]) {
    config.inputColumn = args[columnIndex + 1];
  }

  // Show help if requested
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npx tsx src/syncUnits.ts [options]

This program reads unit codes from an Excel file, validates them on training.gov.au,
and scrapes data for valid units. It automatically detects unit code patterns like
MARK007, BSBPMG430, etc. from any column in the Excel file.

Options:
  --input <file>    Input Excel file with unit codes (default: Units.xlsx)
  --column <name>   Column name containing unit codes (default: scan all columns)
  --output <file>   Output Excel file for scraped data (default: UnitsData.xlsx)
  --force           Re-scrape all units even if they exist
  --help, -h        Show this help message

Example:
  npx tsx src/syncUnits.ts
  npx tsx src/syncUnits.ts --input myunits.xlsx --output results.xlsx
  npx tsx src/syncUnits.ts --column "UOC Code" --force

How it works:
  1. Reads Units.xlsx and extracts unit codes using pattern matching
  2. Checks which units already exist in UnitsData.xlsx (skips them)
  3. Validates each new unit on training.gov.au (404 = invalid)
  4. Scrapes only valid units and appends to UnitsData.xlsx
  5. Handles network errors separately from invalid units
`);
    return;
  }

  // Ensure data directory exists
  try {
    await fs.mkdir(config.dataDir, { recursive: true });
  } catch (error: any) {
    console.error(`❌ Failed to create data directory: ${error.message}`);
    process.exit(1);
  }

  await syncUnits(config);
}

main().catch((e) => {
  console.error("\n❌ Fatal error:", e.message);
  process.exit(1);
});
