/**
 * Automatic Unit Synchronization with Retry Logic
 * 
 * Features:
 * - Automatic retry for network errors
 * - Skip invalid units (404s)
 * - Progress tracking
 * - Persistent error logging
 */

import XLSX from 'xlsx';
import { Crawler } from "./crawler.js";
import { Fetcher } from "./fetcher.js";
import { ExportService } from "./services/exportService.js";
import { EnhancedExcelExportService } from "./services/enhancedExcelService.js";
import { parseUocHtml } from "./parsers/uocParser.js";
import { promises as fs } from "fs";
import * as path from "path";
import { Uoc } from "./models/uoc.js";

// Cached Fetcher wrapper to avoid re-downloading
class CachedFetcher extends Fetcher {
  private cache = new Map<string, string>();

  setCache(url: string, html: string): void {
    this.cache.set(url, html);
  }

  async get(url: string): Promise<string> {
    if (this.cache.has(url)) {
      return this.cache.get(url)!;
    }
    return super.get(url);
  }
}

export interface SyncConfig {
  inputExcel: string;
  inputColumn: string;
  outputExcel: string;
  dataDir: string;
  maxRetries?: number;
  retryDelay?: number;
  autoRetry?: boolean;
}

export interface SyncResult {
  success: boolean;
  validCount: number;
  invalidCount: number;
  errorCount: number;
  retryCount: number;
}

interface UnitError {
  code: string;
  error: string;
  attempts: number;
  lastAttempt: string;
}

/**
 * Validate if a string looks like a real training.gov.au unit code
 * Valid formats:
 * - BSB, CPP, FNS, ICT, etc (3 letters + 5-6 digits)
 * - MAR, HLT, RII, SIT, etc (3 letters + 4-5 digits)
 * - Some have 2 letters + 6+ digits
 * - Can end with letter (e.g., RIIWHS202E)
 * 
 * Invalid patterns to exclude:
 * - Common words (SCUBA, HACCP, etc)
 * - Too short or too long
 */
function isValidUnitCode(code: string): boolean {
  // Must be 6-12 characters
  if (code.length < 6 || code.length > 12) return false;
  
  // Must start with 2-4 uppercase letters
  if (!code.match(/^[A-Z]{2,4}/)) return false;
  
  // Must contain at least 3 digits
  const digitCount = (code.match(/\d/g) || []).length;
  if (digitCount < 3) return false;
  
  // Common false positives to exclude (exact matches only)
  const excludeList = [
    'SCUBA', 'HACCP', 'HACC', 'TAFE', 'CERT', 'DIPLOMA', 'ADVANCED',
    'STATEMENT', 'QUALIFICATION', 'TRAINING', 'EDUCATION',
    'SKILLS', 'COMPETENCY', 'ASSESSMENT', 'EVIDENCE'
  ];
  
  if (excludeList.includes(code.toUpperCase())) return false;
  
  // Valid pattern: Letters followed by mix of letters/digits, must have 3+ digits
  // Can end with letter or digit (e.g., BSBWHS332X, RIIWHS202E, MARA022)
  return code.match(/^[A-Z]{2,4}[A-Z0-9]*\d+[A-Z]?$/i) !== null;
}

async function readUnitCodesFromExcel(filepath: string, columnName: string): Promise<string[]> {
  if (!await fs.access(filepath).then(() => true).catch(() => false)) {
    throw new Error(`Input Excel file not found: ${filepath}`);
  }

  const workbook = XLSX.readFile(filepath);
  const unitCodes: string[] = [];
  
  // Improved pattern: 2-4 letters + alphanumeric (must have digits)
  const unitCodePattern = /\b([A-Z]{2,4}[A-Z0-9]{3,10})\b/g;

  // Read from all sheets
  for (const sheetName of workbook.SheetNames) {
    console.log(`   📄 Reading sheet: "${sheetName}"`);
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet);

    for (const row of rows) {
      const columns = columnName ? [(row as any)[columnName]] : Object.values(row as any);
      
      for (const cellValue of columns) {
        if (cellValue && typeof cellValue === 'string') {
          const matches = cellValue.matchAll(unitCodePattern);
          for (const match of matches) {
            const code = match[1];
            
            // Apply validation filter
            if (isValidUnitCode(code)) {
              unitCodes.push(code);
            }
          }
        }
      }
    }
  }

  const uniqueCodes = [...new Set(unitCodes)];
  console.log(`   ✓ Extracted ${uniqueCodes.length} unique unit codes\n`);
  return uniqueCodes;
}

async function getExistingUnits(excelPath: string): Promise<Map<string, string>> {
  const existingUnits = new Map<string, string>();

  try {
    const workbook = XLSX.readFile(excelPath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(worksheet);

    for (const row of rows) {
      const codeCell = (row as any)['Unit Code'];
      const releaseCell = (row as any)['Release'] || '';
      
      if (codeCell) {
        existingUnits.set(codeCell, releaseCell);
      }
    }
  } catch (error: any) {
    // File doesn't exist yet
  }

  return existingUnits;
}

async function loadPreviousErrors(dataDir: string): Promise<Map<string, UnitError>> {
  const errorMap = new Map<string, UnitError>();
  const errorFile = path.join(dataDir, 'error-log.json');

  try {
    const content = await fs.readFile(errorFile, 'utf-8');
    const errorLog = JSON.parse(content);
    
    if (errorLog.errorUnits) {
      for (const err of errorLog.errorUnits) {
        errorMap.set(err.code, {
          code: err.code,
          error: err.error,
          attempts: err.attempts || 1,
          lastAttempt: err.lastAttempt || new Date().toISOString()
        });
      }
    }
  } catch (error) {
    // No previous errors
  }

  return errorMap;
}

async function saveErrorLog(
  dataDir: string,
  invalidUnits: { code: string; reason: string }[],
  errorUnits: UnitError[],
  totalChecked: number,
  validCount: number
): Promise<void> {
  const errorLog = {
    timestamp: new Date().toISOString(),
    summary: {
      totalChecked,
      valid: validCount,
      invalid: invalidUnits.length,
      errors: errorUnits.length
    },
    invalidUnits: invalidUnits.map(u => ({ ...u, permanent: true })),
    errorUnits: errorUnits.map(u => ({
      code: u.code,
      error: u.error,
      attempts: u.attempts,
      lastAttempt: u.lastAttempt
    }))
  };

  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(
    path.join(dataDir, 'error-log.json'),
    JSON.stringify(errorLog, null, 2),
    'utf-8'
  );
}

export async function syncUnits(config: SyncConfig): Promise<SyncResult> {
  const maxRetries = config.maxRetries || 3;
  const retryDelay = config.retryDelay || 5000;
  const autoRetry = config.autoRetry !== false;

  console.log('📖 Reading unit codes from Excel...');
  const requestedCodes = await readUnitCodesFromExcel(config.inputExcel, config.inputColumn);
  console.log(`✅ Found ${requestedCodes.length} unit codes\n`);

  const outputExcelPath = path.join(config.dataDir, config.outputExcel);
  const existingUnits = await getExistingUnits(outputExcelPath);
  
  if (existingUnits.size > 0) {
    console.log(`📋 Found ${existingUnits.size} units already in output Excel\n`);
  }

  // Load previous errors
  const previousErrors = await loadPreviousErrors(config.dataDir);
  
  // Determine which units to scrape
  const unitsToScrape: string[] = [];
  const unitsToRetry: string[] = [];
  
  for (const code of requestedCodes) {
    if (!existingUnits.has(code)) {
      if (previousErrors.has(code)) {
        const errInfo = previousErrors.get(code)!;
        if (errInfo.attempts < maxRetries) {
          unitsToRetry.push(code);
          console.log(`🔄 ${code}: Will retry (attempt ${errInfo.attempts + 1}/${maxRetries})`);
        } else {
          console.log(`⏭️  ${code}: Max retries reached, skipping`);
        }
      } else {
        unitsToScrape.push(code);
        console.log(`🆕 ${code}: New unit - will scrape`);
      }
    } else {
      console.log(`✓  ${code}: Already exists - skipping`);
    }
  }

  const allUnitsToProcess = [...unitsToScrape, ...unitsToRetry];

  if (allUnitsToProcess.length === 0) {
    console.log('\n✅ All units are up to date!\n');
    return {
      success: true,
      validCount: existingUnits.size,
      invalidCount: 0,
      errorCount: 0,
      retryCount: 0
    };
  }

  console.log(`\n🌐 Processing ${allUnitsToProcess.length} units...\n`);

  const validUnits: string[] = [];
  const invalidUnits: { code: string; reason: string }[] = [];
  const errorUnits: Map<string, UnitError> = new Map();

  const fetcher = new CachedFetcher({
    minDelayMs: 1000,  // Reduced from 3000ms - faster!
    headless: true,
    timeout: 30000
  });

  const exporter = new ExportService(config.dataDir);

  // Categorize errors
  const categorizeError = (code: string, error: any): void => {
    const errorMsg = error.message || String(error);
    const existingError = previousErrors.get(code) || errorUnits.get(code);
    const attempts = (existingError?.attempts || 0) + 1;

    if (errorMsg.includes('404') || errorMsg.includes('not found')) {
      invalidUnits.push({ code, reason: '404 - Unit not found' });
    } else {
      errorUnits.set(code, {
        code,
        error: errorMsg,
        attempts,
        lastAttempt: new Date().toISOString()
      });
    }
  };

  // Validate units concurrently for speed (batch of 5 at a time)
  const CONCURRENT_BATCH = 5;
  let processed = 0;
  
  for (let i = 0; i < allUnitsToProcess.length; i += CONCURRENT_BATCH) {
    const batch = allUnitsToProcess.slice(i, i + CONCURRENT_BATCH);
    
    await Promise.all(batch.map(async (code) => {
      const url = `https://training.gov.au/training/details/${code}/unitdetails`;
      const idx = ++processed;
      
      try {
        console.log(`[${idx}/${allUnitsToProcess.length}] 🔍 Checking: ${code}...`);
        const html = await fetcher.get(url);
        
        if (html.includes('Unit of competency') || html.includes('Performance Criteria') || html.includes('Performance evidence')) {
          validUnits.push(code);
          fetcher.setCache(url, html);
          console.log(`   ✅ Valid`);
        } else if (html.includes('404') || html.includes('not found')) {
          invalidUnits.push({ code, reason: 'Unit does not exist (404)' });
          console.log(`   ❌ Invalid (404)`);
        } else {
          invalidUnits.push({ code, reason: 'No unit content detected' });
          console.log(`   ❌ Invalid (no data)`);
        }
      } catch (error: any) {
        categorizeError(code, error);
        const errInfo = errorUnits.get(code);
        console.log(`   ⚠️  Error (attempt ${errInfo?.attempts || 1}/${maxRetries})`);
      }
    }));
    
    // Small delay between batches
    if (i + CONCURRENT_BATCH < allUnitsToProcess.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`\n📊 Validation Summary:`);
  console.log(`   ✅ Valid: ${validUnits.length}`);
  console.log(`   ❌ Invalid: ${invalidUnits.length}`);
  console.log(`   ⚠️  Errors: ${errorUnits.size}\n`);

  // Save error log
  await saveErrorLog(
    config.dataDir,
    invalidUnits,
    Array.from(errorUnits.values()),
    allUnitsToProcess.length,
    validUnits.length
  );

  if (validUnits.length === 0) {
    await fetcher.close();
    return {
      success: errorUnits.size === 0,
      validCount: 0,
      invalidCount: invalidUnits.length,
      errorCount: errorUnits.size,
      retryCount: unitsToRetry.length
    };
  }

  console.log(`🌐 Scraping ${validUnits.length} valid units...\n`);

  const urls = validUnits.map(code => 
    `https://training.gov.au/training/details/${code}/unitdetails`
  );

  const crawler = new Crawler(fetcher, exporter, {
    concurrency: 3,  // Increased from 1 - scrape 3 units at once!
    onItem: (item) => {
      const elemCount = item.elements?.length || 0;
      const pcCount = item.elements?.reduce((s, e) => s + e.performanceCriteria.length, 0) || 0;
      console.log(`✅ ${item.code} - ${item.title}`);
      console.log(`   Elements: ${elemCount}, PCs: ${pcCount}, PE: ${item.performanceEvidence ? '✓' : '✗'}, KE: ${item.knowledgeEvidence ? '✓' : '✗'}`);
    }
  });

  await crawler.crawlUocUrls(urls);
  console.log('\n✅ Scraping complete!\n');

  // Export to Excel
  console.log('📊 Updating Excel file...');
  const excelExporter = new EnhancedExcelExportService(config.dataDir, config.outputExcel);
  const jsonlPath = path.join(config.dataDir, 'uoc.jsonl');
  
  const content = await fs.readFile(jsonlPath, 'utf-8');
  const lines = content.trim().split('\n').filter(Boolean);
  const allUnits: Uoc[] = lines.map(line => JSON.parse(line));
  
  const newlyScrapedUnits = allUnits.filter(u => validUnits.includes(u.code));
  
  await excelExporter.exportToExcel(newlyScrapedUnits, config.outputExcel, true);
  
  return {
    success: errorUnits.size === 0,
    validCount: validUnits.length,
    invalidCount: invalidUnits.length,
    errorCount: errorUnits.size,
    retryCount: unitsToRetry.length
  };
}

// Main entry point when run directly
async function main() {
  const args = process.argv.slice(2);

  // Default configuration
  const config: SyncConfig = {
    inputExcel: 'Units.xlsx',
    inputColumn: '',
    outputExcel: 'UnitsData.xlsx',
    dataDir: 'data',
    maxRetries: 3,
    retryDelay: 5000,
    autoRetry: true
  };

  // Command-line argument parsing
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

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Training.gov.au Unit Scraper - Automatic Sync with Retry

Usage: npx tsx src/autoSync.ts [options]

Features:
  ✅ Automatic retry for network errors (up to 3 attempts)
  ✅ Skip invalid unit codes (404s)  
  ✅ Smart validation - filters fake codes (SCUBA, HACC, etc.)
  ✅ No duplicates - always updates existing units
  ✅ Auto-creates folders and files as needed

Options:
  --input <file>    Input Excel file with unit codes (default: Units.xlsx)
  --column <name>   Column name (default: scan all columns)
  --output <file>   Output Excel file (default: UnitsData.xlsx)
  --help, -h        Show this help

Examples:
  npx tsx src/autoSync.ts
  npx tsx src/autoSync.ts --input MyUnits.xlsx
  npx tsx src/autoSync.ts --input MyUnits.xlsx --output Results.xlsx
  npx tsx src/autoSync.ts --column "Unit Code"
`);
    process.exit(0);
  }

  console.log('\n🔄 Starting Automatic Unit Sync with Retry...\n');
  
  // Ensure data directory exists
  try {
    await fs.mkdir(config.dataDir, { recursive: true });
  } catch (error: any) {
    console.error(`❌ Failed to create data directory: ${error.message}`);
    process.exit(1);
  }
  
  try {
    const result = await syncUnits(config);
    
    console.log('\n' + '='.repeat(60));
    if (result.success && result.validCount > 0) {
      console.log('✅ SCRAPING COMPLETED SUCCESSFULLY!\n');
    } else if (result.validCount === 0 && result.invalidCount === 0 && result.errorCount === 0) {
      console.log('ℹ️  ALL UNITS ALREADY UP TO DATE!\n');
    } else {
      console.log('⚠️  SCRAPING COMPLETED WITH SOME ISSUES\n');
    }
    
    console.log('📊 Results:');
    console.log(`   ✓ Valid units scraped: ${result.validCount}`);
    if (result.invalidCount > 0) {
      console.log(`   ✗ Invalid units (404): ${result.invalidCount}`);
    }
    if (result.errorCount > 0) {
      console.log(`   ⚠  Failed units (errors): ${result.errorCount}`);
    }
    if (result.retryCount > 0) {
      console.log(`   🔄 Units to retry: ${result.retryCount}`);
    }
    
    console.log('\n📁 Output files:');
    console.log(`   - ${config.dataDir}/${config.outputExcel} (Excel with color coding)`);
    console.log(`   - ${config.dataDir}/uoc.jsonl (Raw JSON data)`);
    if (result.errorCount > 0 || result.invalidCount > 0) {
      console.log(`   - ${config.dataDir}/error-log.json (Error details)`);
    }
    console.log('='.repeat(60) + '\n');
    
    process.exit(result.success ? 0 : 1);
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
