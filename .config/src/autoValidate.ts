#!/usr/bin/env tsx
/**
 * FULLY AUTOMATED ASSESSMENT VALIDATOR
 * 
 * Just drop your files and run - the system does EVERYTHING automatically:
 * 1. Finds unit list file (Excel)
 * 2. Scrapes unit details from training.gov.au
 * 3. Finds all assessment files (Word/Excel)
 * 4. Detects clustering automatically
 * 5. Uses AI to validate questions against PCs
 * 6. Generates comprehensive compliance report
 * 
 * USAGE:
 *   node autoValidate.js
 *   
 * That's it! Just run it.
 */

import * as path from 'path';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import { spawn } from 'child_process';
import XLSX from 'xlsx';
import type { UnitOfCompetency } from './services/aiValidationService.js';
import { validateAssessments } from './services/aiValidationService.js';
import {
  parseWordAssessment,
  parseMultipleWordAssessments,
  convertWordToAssessmentFormat,
} from './services/wordAssessmentParser.js';
import {
  parseAssessmentExcel,
  parseSMTMaritimeAssessment,
} from './services/assessmentParser.js';
import {
  generateExcelReport,
  saveTextReport,
  printReport,
} from './services/reportGenerator.js';
import {
  checkOllamaAvailability,
  downloadOllamaModels,
} from './services/ollamaService.js';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function log(message: string, indent: number = 0) {
  const prefix = '   '.repeat(indent);
  console.log(`${prefix}${message}`);
}

function logStep(step: string) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  ${step}`);
  console.log(`${'═'.repeat(70)}\n`);
}

// ============================================================================
// AUTO-DISCOVERY FUNCTIONS
// ============================================================================

/**
 * Find the unit list Excel file in the directory
 */
function findUnitListFile(directory: string): string | null {
  const files = fs.readdirSync(directory);
  
  // Look for files with "unit" in the name
  const candidates = files.filter(f => {
    const lower = f.toLowerCase();
    return (
      (lower.includes('unit') || lower.includes('uoc')) &&
      (f.endsWith('.xlsx') || f.endsWith('.xls')) &&
      !f.startsWith('~$')
    );
  });
  
  if (candidates.length > 0) {
    return path.join(directory, candidates[0]);
  }
  
  // If no unit-named file, look for any Excel file
  const excelFiles = files.filter(f => 
    (f.endsWith('.xlsx') || f.endsWith('.xls')) && !f.startsWith('~$')
  );
  
  if (excelFiles.length === 1) {
    return path.join(directory, excelFiles[0]);
  }
  
  return null;
}

/**
 * Extract unit codes from Excel file
 */
function extractUnitCodes(filePath: string): string[] {
  log(`📖 Extracting unit codes from: ${path.basename(filePath)}`);
  
  const workbook = XLSX.readFile(filePath);
  const codes = new Set<string>();
  const unitCodePattern = /\b([A-Z]{2,4}[A-Z0-9]{3,10})\b/g;
  
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = worksheet[cellAddress];
        if (cell && cell.v) {
          const matches = String(cell.v).toUpperCase().matchAll(unitCodePattern);
          for (const match of matches) {
            codes.add(match[1]);
          }
        }
      }
    }
  }
  
  const codeArray = Array.from(codes);
  log(`   ✅ Found ${codeArray.length} unit codes: ${codeArray.slice(0, 5).join(', ')}${codeArray.length > 5 ? '...' : ''}`, 1);
  
  return codeArray;
}

/**
 * Find all assessment files (Word/Excel, excluding unit list)
 */
function findAssessmentFiles(directory: string, unitListFile: string): { word: string[]; excel: string[] } {
  const word: string[] = [];
  const excel: string[] = [];
  
  const files = fs.readdirSync(directory);
  const unitListName = path.basename(unitListFile);
  
  for (const file of files) {
    if (file.startsWith('~$')) continue;
    if (file === unitListName) continue;
    
    const ext = path.extname(file).toLowerCase();
    const filePath = path.join(directory, file);
    const lower = file.toLowerCase();
    
    // Skip marking sheets
    if (lower.includes('marking')) continue;
    
    if (ext === '.docx' || ext === '.doc') {
      word.push(filePath);
    } else if (ext === '.xlsx' || ext === '.xls') {
      excel.push(filePath);
    }
  }
  
  return { word, excel };
}

/**
 * Check if unit data needs scraping
 */
function needsScraping(unitCodes: string[], dataPath: string): { needed: boolean; missing: string[] } {
  if (!fs.existsSync(dataPath)) {
    return { needed: true, missing: unitCodes };
  }
  
  const content = fs.readFileSync(dataPath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  const existingCodes = new Set<string>();
  
  for (const line of lines) {
    try {
      const data = JSON.parse(line);
      if (data.code) {
        existingCodes.add(data.code);
      }
    } catch (e) {
      // Skip invalid lines
    }
  }
  
  const missing = unitCodes.filter(code => !existingCodes.has(code));
  
  return {
    needed: missing.length > 0,
    missing,
  };
}

/**
 * Run the scraper to fetch unit data
 */
async function runScraper(directory: string): Promise<boolean> {
  return new Promise((resolve) => {
    log('🔄 Running scraper to fetch unit data from training.gov.au...');
    
    const scraperPath = path.join(directory, 'RUN_SCRAPER.command');
    
    // Run autoSync.ts directly
    const autoSyncPath = path.join(directory, '.config', 'src', 'autoSync.ts');
    
    const scraper = spawn('npx', ['tsx', autoSyncPath], {
      cwd: path.join(directory, '.config'),
      stdio: 'pipe',
    });
    
    scraper.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach((line: string) => {
        if (line.trim()) {
          log(`   ${line}`, 1);
        }
      });
    });
    
    scraper.stderr.on('data', (data) => {
      log(`   ⚠️  ${data.toString()}`, 1);
    });
    
    scraper.on('close', (code) => {
      if (code === 0) {
        log('   ✅ Scraping complete!', 1);
        resolve(true);
      } else {
        log(`   ❌ Scraping failed with code ${code}`, 1);
        resolve(false);
      }
    });
  });
}

/**
 * Load units from JSONL
 */
async function loadUnitsFromJSONL(filePath: string, unitCodes: string[]): Promise<UnitOfCompetency[]> {
  const content = await fsPromises.readFile(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  const units: UnitOfCompetency[] = [];
  
  for (const line of lines) {
    try {
      const uoc = JSON.parse(line) as any;
      
      if (unitCodes.length > 0 && !unitCodes.includes(uoc.code)) {
        continue;
      }
      
      units.push({
        code: uoc.code,
        title: uoc.title,
        elements: (uoc.elements || []).map((el: any) => ({
          number: el.number || el.id || '',
          title: el.title || el.name || '',
          performanceCriteria: (el.performanceCriteria || []).map((pc: any) => 
            typeof pc === 'string' 
              ? { number: '', text: pc }
              : { number: pc.number || '', text: pc.text || pc }
          ),
        })),
        performanceEvidence: Array.isArray(uoc.performanceEvidence) 
          ? uoc.performanceEvidence 
          : (uoc.performanceEvidence ? [uoc.performanceEvidence] : []),
        knowledgeEvidence: Array.isArray(uoc.knowledgeEvidence)
          ? uoc.knowledgeEvidence
          : (uoc.knowledgeEvidence ? [uoc.knowledgeEvidence] : []),
      });
    } catch (error) {
      continue;
    }
  }
  
  return units;
}

/**
 * Detect if assessments are clustered (cover multiple units)
 */
function detectClustering(assessments: any[], allUnitCodes: string[]): {
  isClustered: boolean;
  clusterInfo: Map<string, string[]>;
} {
  const clusterInfo = new Map<string, string[]>();
  let multiUnitCount = 0;
  
  assessments.forEach(assessment => {
    const unitCodes = new Set<string>();
    
    assessment.questions.forEach((q: any) => {
      if (q.unitCodes && Array.isArray(q.unitCodes)) {
        q.unitCodes.forEach((code: string) => unitCodes.add(code));
      }
    });
    
    const codes = Array.from(unitCodes);
    if (codes.length > 1) {
      multiUnitCount++;
    }
    
    clusterInfo.set(assessment.name, codes.length > 0 ? codes : allUnitCodes);
  });
  
  return {
    isClustered: multiUnitCount > 0,
    clusterInfo,
  };
}

// ============================================================================
// MAIN AUTOMATED WORKFLOW
// ============================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║          🤖 FULLY AUTOMATED ASSESSMENT VALIDATOR                       ║');
  console.log('║          Uses FREE local AI (Ollama) - No API key needed!             ║');
  console.log('╚════════════════════════════════════════════════════════════════════════╝\n');
  
  // Check if Ollama is available
  logStep('Checking Ollama AI');
  
  const ollamaStatus = await checkOllamaAvailability();
  
  if (!ollamaStatus.available) {
    console.error('❌ Ollama is not running or required models are missing\n');
    console.error('To install Ollama:');
    console.error('  1. Visit: https://ollama.com');
    console.error('  2. Download and install for macOS');
    console.error('  3. Run: ollama pull llama3.2');
    console.error('  4. Run: ollama pull nomic-embed-text');
    console.error('  5. Then run this script again\n');
    console.error(`Status: ${ollamaStatus.message}\n`);
    process.exit(1);
  }
  
  log('✅ Ollama is ready!');
  log(`   Models available: ${ollamaStatus.models.slice(0, 3).join(', ')}`, 1);
  
  const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
  const dataPath = path.join(rootDir, 'data', 'uoc.jsonl');
  
  // ========================================================================
  // STEP 1: Auto-discover unit list file
  // ========================================================================
  logStep('STEP 1: Finding Unit List');
  
  const unitListFile = findUnitListFile(rootDir);
  if (!unitListFile) {
    console.error('❌ No unit list file found!');
    console.error('   Please add an Excel file with unit codes (e.g., Units.xlsx)\n');
    process.exit(1);
  }
  
  log(`✅ Found unit list: ${path.basename(unitListFile)}`);
  
  // ========================================================================
  // STEP 2: Extract unit codes
  // ========================================================================
  logStep('STEP 2: Extracting Unit Codes');
  
  const unitCodes = extractUnitCodes(unitListFile);
  if (unitCodes.length === 0) {
    console.error('❌ No unit codes found in the file!\n');
    process.exit(1);
  }
  
  // ========================================================================
  // STEP 3: Check if scraping needed
  // ========================================================================
  logStep('STEP 3: Checking Unit Data');
  
  const { needed, missing } = needsScraping(unitCodes, dataPath);
  
  if (needed) {
    log(`⚠️  Need to scrape ${missing.length} units: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '...' : ''}`);
    
    const success = await runScraper(rootDir);
    if (!success) {
      console.error('\n❌ Failed to scrape unit data. Please run scraper manually.\n');
      process.exit(1);
    }
  } else {
    log('✅ All unit data already available!');
  }
  
  // ========================================================================
  // STEP 4: Load unit data
  // ========================================================================
  logStep('STEP 4: Loading Unit Data');
  
  const units = await loadUnitsFromJSONL(dataPath, unitCodes);
  
  if (units.length === 0) {
    console.error('❌ Failed to load unit data!\n');
    process.exit(1);
  }
  
  log(`✅ Loaded ${units.length} units of competency`);
  units.slice(0, 3).forEach(u => {
    log(`   • ${u.code}: ${u.title}`, 1);
  });
  if (units.length > 3) {
    log(`   ... and ${units.length - 3} more`, 1);
  }
  
  // ========================================================================
  // STEP 5: Find assessment files
  // ========================================================================
  logStep('STEP 5: Finding Assessment Files');
  
  const { word, excel } = findAssessmentFiles(rootDir, unitListFile);
  
  log(`📂 Found assessment files:`);
  log(`   Word documents: ${word.length}`, 1);
  word.forEach(f => log(`      • ${path.basename(f)}`, 2));
  log(`   Excel files: ${excel.length}`, 1);
  excel.forEach(f => log(`      • ${path.basename(f)}`, 2));
  
  if (word.length === 0 && excel.length === 0) {
    console.error('\n❌ No assessment files found!\n');
    process.exit(1);
  }
  
  // ========================================================================
  // STEP 6: Parse assessments
  // ========================================================================
  logStep('STEP 6: Parsing Assessments');
  
  let allAssessments: any[] = [];
  
  if (word.length > 0) {
    log(`📄 Parsing ${word.length} Word document(s)...`);
    const wordAssessments = await parseMultipleWordAssessments(word);
    const converted = convertWordToAssessmentFormat(wordAssessments);
    allAssessments.push(...converted);
    log(`   ✅ Extracted ${converted.reduce((sum, a) => sum + a.questions.length, 0)} questions`, 1);
  }
  
  for (const excelFile of excel) {
    log(`📄 Parsing ${path.basename(excelFile)}...`);
    try {
      const assessments = parseAssessmentExcel(excelFile);
      allAssessments.push(...assessments);
      log(`   ✅ Extracted ${assessments.reduce((sum, a) => sum + a.questions.length, 0)} questions`, 1);
    } catch (error) {
      log(`   ⚠️  Failed to parse (skipping)`, 1);
    }
  }
  
  const totalQuestions = allAssessments.reduce((sum, a) => sum + a.questions.length, 0);
  log(`\n✅ Total: ${allAssessments.length} assessments with ${totalQuestions} questions`);
  
  // ========================================================================
  // STEP 7: Detect clustering
  // ========================================================================
  logStep('STEP 7: Analyzing Assessment Structure');
  
  const { isClustered, clusterInfo } = detectClustering(allAssessments, unitCodes);
  
  if (isClustered) {
    log('🔗 CLUSTERING DETECTED - Assessments cover multiple units:');
    clusterInfo.forEach((codes, name) => {
      if (codes.length > 1) {
        log(`   • ${name}`, 1);
        log(`     Units: ${codes.join(', ')}`, 2);
      }
    });
  } else {
    log('📋 Standard assessments - one unit per assessment');
  }
  
  // ========================================================================
  // STEP 8: Run AI validation
  // ========================================================================
  logStep('STEP 8: Running AI Validation');
  
  log('🤖 Using OpenAI to validate questions against performance criteria...');
  log('   This may take a few minutes depending on the number of questions...', 1);
  
  const report = await validateAssessments(allAssessments, units);
  
  // ========================================================================
  // STEP 9: Generate reports
  // ========================================================================
  logStep('STEP 9: Generating Reports');
  
  const outputDir = path.join(rootDir, 'validation-reports');
  await fsPromises.mkdir(outputDir, { recursive: true });
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const excelPath = path.join(outputDir, `validation-report-${timestamp}.xlsx`);
  const textPath = path.join(outputDir, `validation-report-${timestamp}.txt`);
  
  generateExcelReport(report, excelPath);
  saveTextReport(report, textPath);
  
  log(`✅ Reports generated:`);
  log(`   • ${path.basename(excelPath)}`, 1);
  log(`   • ${path.basename(textPath)}`, 1);
  
  // ========================================================================
  // STEP 10: Display summary
  // ========================================================================
  logStep('VALIDATION COMPLETE');
  
  console.log('\n' + '═'.repeat(70));
  console.log('  📊 SUMMARY');
  console.log('═'.repeat(70) + '\n');
  
  console.log(`Overall Compliance:        ${(report.overallCompliance * 100).toFixed(1)}%`);
  console.log(`Units Analyzed:            ${units.length}`);
  console.log(`Assessments Processed:     ${allAssessments.length}`);
  console.log(`Questions Analyzed:        ${totalQuestions}`);
  console.log(`Total PC Mappings:         ${report.mappings.length}`);
  console.log(`  • High Confidence:       ${report.mappings.filter(m => m.semanticSimilarity >= 0.8).length}`);
  console.log(`  • Medium Confidence:     ${report.mappings.filter(m => m.semanticSimilarity >= 0.7 && m.semanticSimilarity < 0.8).length}`);
  console.log(`  • Low Confidence:        ${report.mappings.filter(m => m.semanticSimilarity < 0.7).length}`);
  console.log(`Uncovered PCs:             ${report.gaps.filter(g => !g.covered).length}`);
  
  if (isClustered) {
    console.log(`\n🔗 Clustering:             Yes (multi-unit assessments)`);
  }
  
  console.log('\n' + '─'.repeat(70));
  console.log('  ✅ COMPLIANCE STATUS');
  console.log('─'.repeat(70) + '\n');
  
  const status = (passed: boolean) => passed ? '✓ PASSED' : '✗ FAILED';
  
  console.log(`Validity:      ${status(report.rulesOfEvidence.validity.passed)}`);
  console.log(`Sufficiency:   ${status(report.rulesOfEvidence.sufficiency.passed)}`);
  console.log(`Authenticity:  ${status(report.rulesOfEvidence.authenticity.passed)}`);
  console.log(`Currency:      ${status(report.rulesOfEvidence.currency.passed)}`);
  console.log(`Fairness:      ${status(report.principlesOfAssessment.fairness.passed)}`);
  console.log(`Flexibility:   ${status(report.principlesOfAssessment.flexibility.passed)}`);
  console.log(`Reliability:   ${status(report.principlesOfAssessment.reliability.passed)}`);
  
  console.log('\n' + '═'.repeat(70));
  console.log(`📁 Reports saved to: ${outputDir}`);
  console.log('═'.repeat(70) + '\n');
  
  // Print detailed report to console
  printReport(report);
  
  console.log('\n✅ AUTOMATION COMPLETE! All work done automatically.\n');
  
  // Exit with appropriate code
  const hasFailures =
    !report.rulesOfEvidence.validity.passed ||
    !report.rulesOfEvidence.sufficiency.passed ||
    !report.principlesOfAssessment.validity.passed;
  
  process.exit(hasFailures ? 1 : 0);
}

// Run the automation
main().catch(error => {
  console.error('\n❌ Fatal Error:', error.message);
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
