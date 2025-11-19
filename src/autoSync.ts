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
import { MaritimeExcelService } from "./services/maritimeExcelService.js";
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

async function readUnitCodesFromExcel(filepath: string, columnName: string): Promise<{ codes: string[]; duplicates: { code: string; count: number }[] }> {
  if (!await fs.access(filepath).then(() => true).catch(() => false)) {
    throw new Error(`Input Excel file not found: ${filepath}`);
  }

  const workbook = XLSX.readFile(filepath);
  const unitCodes: string[] = [];
  
  // Primary pattern: 2-4 letters + alphanumeric (must have digits)
  const unitCodePattern = /\b([A-Z]{2,4}[A-Z0-9]{3,10})\b/g;
  // Fallback pattern: allow a space between prefix and the rest (e.g., "ACM WHS401")
  const spacedPattern = /\b([A-Z]{2,4})\s+([A-Z0-9]{3,10})\b/g;

  // Read from all sheets - scan ALL cells including first row
  for (const sheetName of workbook.SheetNames) {
    console.log(`   📄 Reading sheet: "${sheetName}"`);
    const worksheet = workbook.Sheets[sheetName];
    
    // Get sheet range to scan ALL cells including first row
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    
    // Scan every cell in the sheet
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = worksheet[cellAddress];
        if (!cell || !cell.v) continue;
        
        const cellValue = cell.v;
        if (typeof cellValue === 'string') {
          const text = cellValue.toUpperCase();
          // Exact pattern matches
          const matches = text.matchAll(unitCodePattern);
          for (const match of matches) {
            const code = match[1].toUpperCase().trim();
            if (isValidUnitCode(code)) unitCodes.push(code);
          }
          // Spaced pattern matches -> concatenate groups
          const spaced = text.matchAll(spacedPattern);
          for (const m of spaced) {
            const code = (m[1] + m[2]).toUpperCase().trim();
            if (isValidUnitCode(code)) unitCodes.push(code);
          }
        } else if (typeof cellValue === 'number') {
          // Skip pure numbers
          continue;
        } else {
          // Convert to string if possible
          const s = String(cellValue || '').toUpperCase();
          if (!s) continue;
          const matches = s.matchAll(unitCodePattern);
          for (const match of matches) {
            const code = match[1].toUpperCase().trim();
            if (isValidUnitCode(code)) unitCodes.push(code);
          }
        }
      }
    }
  }

  // Detect duplicates before deduplication
  const duplicates = new Map<string, number>();
  unitCodes.forEach(code => {
    duplicates.set(code, (duplicates.get(code) || 0) + 1);
  });
  
  const duplicateList = Array.from(duplicates.entries())
    .filter(([_, count]) => count > 1)
    .map(([code, count]) => ({ code, count }));
  
  const uniqueCodes = [...new Set(unitCodes)];
  console.log(`   ✓ Extracted ${uniqueCodes.length} unique unit codes\n`);
  
  if (duplicateList.length > 0) {
    console.log(`   ⚠️  Duplicate codes found (these were deduplicated):`);
    duplicateList.forEach(({ code, count }) => {
      console.log(`      - ${code} (appeared ${count} times)`);
    });
    console.log('');
  }
  
  return { codes: uniqueCodes, duplicates: duplicateList };
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
  validCount: number,
  duplicates?: { code: string; count: number }[]
): Promise<void> {
  const errorLog: any = {
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
  
  // Add duplicate information if present
  if (duplicates && duplicates.length > 0) {
    errorLog.duplicates = duplicates.map(d => ({
      code: d.code,
      occurrences: d.count,
      note: 'This code appeared multiple times in the Excel file but was only processed once'
    }));
    errorLog.summary.duplicates = duplicates.length;
  }

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
  const { codes: requestedCodes, duplicates: duplicateCodes } = await readUnitCodesFromExcel(config.inputExcel, config.inputColumn);
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
    console.log('\n✅ All units are up to date!');
    // Ensure Excel reflects latest layout (maritime multi-sheet format)
    try {
      console.log('📊 Rebuilding Excel with maritime format...');
      const excelExporter = new MaritimeExcelService(config.dataDir, config.outputExcel);
      await excelExporter.generateExcel(config.outputExcel);
    } catch (e) {
      console.log('⚠️  Could not rebuild Excel:', (e as any)?.message || e);
    }
    console.log('');
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

  // Try code variations to handle suffixes and leading E (e.g., RIIWHS202 -> RIIWHS202E, ACMWHS401 -> EACMWHS401)
  const tryCodeVariations = async (baseCode: string): Promise<{ found: boolean; actualCode: string; html?: string }> => {
    const base = baseCode.toUpperCase().trim();
    const suffixes = ['A','B','C','D','E','F','1','2'];
    const variants = new Set<string>();
    // Exact first
    variants.add(base);
    // Suffixes
    for (const s of suffixes) variants.add(base + s);
    // Leading E prefix variants
    variants.add('E' + base);
    for (const s of suffixes) variants.add('E' + base + s);
    
    for (const variation of variants) {
      const url = `https://training.gov.au/training/details/${variation}/unitdetails`;
      try {
        const html = await fetcher.get(url);
        
        // Check if page contains valid unit content
        if (html.includes('Unit of competency') || html.includes('Performance Criteria') || html.includes('Performance evidence')) {
          return { found: true, actualCode: variation, html };
        }
      } catch (error: any) {
        // If 404 or not found, try next variation
        if (error.message?.includes('404') || error.message?.includes('not found')) {
          continue;
        }
        // For other errors (network, timeout), stop trying variations
        throw error;
      }
    }
    
    return { found: false, actualCode: base };
  };

  // Fallback: Search training.gov.au and pick the first matching unit details link
  const trySearchFallback = async (queryCode: string): Promise<{ found: boolean; actualCode: string; html?: string }> => {
    const q = encodeURIComponent(queryCode);
    const searchUrl = `https://training.gov.au/Search/Training?searchTerm=${q}`;
    try {
      const html = await fetcher.get(searchUrl);
      // Look for links like /training/details/CODE/unitdetails
      const re = /\/training\/details\/([A-Z0-9]{4,16})\/unitdetails/gi;
      let match: RegExpExecArray | null;
      const seen = new Set<string>();
      while ((match = re.exec(html)) !== null) {
        const candidate = match[1].toUpperCase();
        if (seen.has(candidate)) continue;
        seen.add(candidate);
        // Basic sanity: must include at least 3 digits
        if ((candidate.match(/\d/g) || []).length < 3) continue;
        // Fetch candidate page to verify
        const url = `https://training.gov.au/training/details/${candidate}/unitdetails`;
        try {
          const pageHtml = await fetcher.get(url);
          if (pageHtml.includes('Unit of competency') || pageHtml.includes('Performance Criteria') || pageHtml.includes('Performance evidence')) {
            return { found: true, actualCode: candidate, html: pageHtml };
          }
        } catch (_) {
          // try next
        }
      }
    } catch (_) {
      // ignore search failure
    }
    return { found: false, actualCode: queryCode.toUpperCase() };
  };

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

  // Validate units concurrently for speed (batch of 3 at a time to handle variations)
  const CONCURRENT_BATCH = 3;  // Reduced since we're trying multiple variations per code
  let processed = 0;
  const codeMapping = new Map<string, string>(); // Maps requested code -> actual code found
  
  for (let i = 0; i < allUnitsToProcess.length; i += CONCURRENT_BATCH) {
    const batch = allUnitsToProcess.slice(i, i + CONCURRENT_BATCH);
    
    await Promise.all(batch.map(async (code) => {
      const idx = ++processed;
      
      try {
        console.log(`[${idx}/${allUnitsToProcess.length}] 🔍 Checking: ${code}...`);
        // First try direct and common variations
        let result = await tryCodeVariations(code);
        // If still not found, try site search fallback
        if (!result.found) {
          const searchResult = await trySearchFallback(code);
          if (searchResult.found) result = searchResult;
        }
        
        if (result.found) {
          validUnits.push(result.actualCode);
          codeMapping.set(code, result.actualCode);
          if (result.html) {
            const url = `https://training.gov.au/training/details/${result.actualCode}/unitdetails`;
            fetcher.setCache(url, result.html);
          }
          if (result.actualCode !== code) {
            console.log(`   ✅ Found as: ${result.actualCode}`);
          } else {
            console.log(`   ✅ Valid`);
          }
        } else {
          invalidUnits.push({ code, reason: 'Unit does not exist (404 - tried variations)' });
          console.log(`   ❌ Invalid (not found with any variation)`);
        }
      } catch (error: any) {
        categorizeError(code, error);
        const errInfo = errorUnits.get(code);
        console.log(`   ⚠️  Error (attempt ${errInfo?.attempts || 1}/${maxRetries})`);
      }
    }));
    
    // Small delay between batches
    if (i + CONCURRENT_BATCH < allUnitsToProcess.length) {
      await new Promise(resolve => setTimeout(resolve, 800));
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
    validUnits.length,
    duplicateCodes
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
    concurrency: 2,  // Reduced to 2 to prevent "frame detached" errors
    onItem: (item) => {
      const elemCount = item.elements?.length || 0;
      const pcCount = item.elements?.reduce((s, e) => s + e.performanceCriteria.length, 0) || 0;
      console.log(`✅ ${item.code} - ${item.title}`);
      console.log(`   Elements: ${elemCount}, PCs: ${pcCount}, PE: ${item.performanceEvidence ? '✓' : '✗'}, KE: ${item.knowledgeEvidence ? '✓' : '✗'}`);
    }
  });

  await crawler.crawlUocUrls(urls);
  console.log('\n✅ Scraping complete!\n');

  // Export to Excel with maritime multi-sheet format
  console.log('📊 Updating Excel file with maritime format...');
  const excelExporter = new MaritimeExcelService(config.dataDir, config.outputExcel);
  const jsonlPath = path.join(config.dataDir, 'uoc.jsonl');
  
  // Generate Excel file with maritime multi-sheet format
  await excelExporter.generateExcel(config.outputExcel);
  
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
