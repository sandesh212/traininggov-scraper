#!/usr/bin/env node
/**
 * AI Assessment Validator - Command Line Interface
 * 
 * Validates RTO assessments against Training Package Units of Competency
 * using AI-powered semantic matching.
 * 
 * Usage:
 *   npx tsx src/validateAssessment.ts --units MARH013,MARB027 --assessment path/to/assessment.xlsx
 *   npx tsx src/validateAssessment.ts --units-file Units.xlsx --assessment assessment.xlsx
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import XLSX from 'xlsx';
import type { Uoc } from './models/uoc.js';
import type { UnitOfCompetency, Element, PerformanceCriteria } from './services/aiValidationService.js';
import { validateAssessments } from './services/aiValidationService.js';
import {
  parseAssessmentExcel,
  parseSMTMaritimeAssessment,
  parseMultipleAssessments,
} from './services/assessmentParser.js';
import {
  parseWordAssessment,
  parseMultipleWordAssessments,
  convertWordToAssessmentFormat,
} from './services/wordAssessmentParser.js';
import {
  generateExcelReport,
  saveTextReport,
  printReport,
} from './services/reportGenerator.js';

// ============================================================================
// UNIT DATA LOADING
// ============================================================================

/**
 * Load unit data from JSONL file (scraped by autoSync)
 */
async function loadUnitsFromJSONL(filePath: string, unitCodes: string[]): Promise<UnitOfCompetency[]> {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  const units: UnitOfCompetency[] = [];
  
  for (const line of lines) {
    try {
      const uoc = JSON.parse(line) as Uoc;
      
      // Filter by unit codes if specified
      if (unitCodes.length > 0 && !unitCodes.includes(uoc.code)) {
        continue;
      }
      
      // Convert to UnitOfCompetency format
      const unit: UnitOfCompetency = {
        code: uoc.code,
        title: uoc.title,
        elements: uoc.elements.map(el => ({
          number: el.number,
          title: el.title,
          performanceCriteria: el.performanceCriteria.map(pc => ({
            number: pc.number,
            text: pc.text,
          })),
        })),
        performanceEvidence: uoc.performanceEvidence || [],
        knowledgeEvidence: uoc.knowledgeEvidence || [],
      };
      
      units.push(unit);
    } catch (error) {
      // Skip invalid JSON lines
      continue;
    }
  }
  
  return units;
}

/**
 * Load unit codes from Excel file (like Units.xlsx)
 */
async function loadUnitCodesFromExcel(filePath: string): Promise<string[]> {
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
        if (!cell || !cell.v) continue;
        
        const text = String(cell.v).toUpperCase();
        const matches = text.matchAll(unitCodePattern);
        for (const match of matches) {
          codes.add(match[1]);
        }
      }
    }
  }
  
  return Array.from(codes);
}

// ============================================================================
// MAIN CLI FUNCTION
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  
  // Show help
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    console.log(`
╔════════════════════════════════════════════════════════════════════════╗
║                AI Assessment Validator for RTOs                        ║
║        Validates assessments against Training Package UoCs             ║
╚════════════════════════════════════════════════════════════════════════╝

REQUIREMENTS:
  • Set OPENAI_API_KEY environment variable (for AI semantic matching)
  • Have scraped unit data in ../data/uoc.jsonl (run npm start first)

USAGE:
  npx tsx src/validateAssessment.ts [options]

OPTIONS:
  --units <codes>           Comma-separated unit codes (e.g., MARH013,MARB027)
  --units-file <path>       Excel file with unit codes (e.g., Units.xlsx)
  --assessment <path>       Assessment Excel file to validate (required)
  --output <dir>            Output directory for reports (default: validation-reports)
  --format <type>           Assessment format: auto|smt|generic (default: auto)
  --help, -h                Show this help

EXAMPLES:
  # Validate specific units
  npx tsx src/validateAssessment.ts --units MARH013,MARB027 --assessment MyAssessment.xlsx

  # Validate units from file
  npx tsx src/validateAssessment.ts --units-file Units.xlsx --assessment MyAssessment.xlsx

  # Specify output directory
  npx tsx src/validateAssessment.ts --units MARH013 --assessment test.xlsx --output reports

NOTES:
  • The tool uses AI to understand meaning, not just match exact words
  • High similarity (80%+) = strong semantic match
  • Medium (70-80%) = reasonable match, review recommended
  • Low (<70%) = weak match, likely not covering the requirement
  • Gaps indicate performance criteria not covered by any assessment question
`);
    process.exit(0);
  }
  
  // Check for OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ ERROR: OPENAI_API_KEY environment variable not set');
    console.error('   Get your API key from https://platform.openai.com/api-keys');
    console.error('   Then set it: export OPENAI_API_KEY="your-key-here"');
    process.exit(1);
  }
  
  // Parse arguments
  let unitCodes: string[] = [];
  let assessmentFile = '';
  let outputDir = 'validation-reports';
  let format: 'auto' | 'smt' | 'generic' = 'auto';
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--units' && args[i + 1]) {
      unitCodes = args[i + 1].split(',').map(c => c.trim().toUpperCase());
      i++;
    } else if (args[i] === '--units-file' && args[i + 1]) {
      const unitsFilePath = path.resolve(args[i + 1]);
      console.log(`📖 Reading unit codes from: ${unitsFilePath}`);
      unitCodes = await loadUnitCodesFromExcel(unitsFilePath);
      console.log(`   Found ${unitCodes.length} unit codes\n`);
      i++;
    } else if (args[i] === '--assessment' && args[i + 1]) {
      assessmentFile = path.resolve(args[i + 1]);
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      outputDir = args[i + 1];
      i++;
    } else if (args[i] === '--format' && args[i + 1]) {
      format = args[i + 1] as any;
      i++;
    }
  }
  
  // Validate inputs
  if (!assessmentFile) {
    console.error('❌ ERROR: --assessment file is required');
    process.exit(1);
  }
  
  if (unitCodes.length === 0) {
    console.error('❌ ERROR: Must specify --units or --units-file');
    process.exit(1);
  }
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('           AI Assessment Validator');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // Load unit data
  console.log('📚 Loading unit data from scraped database...');
  const uocJsonlPath = path.resolve(__dirname, '../../data/uoc.jsonl');
  const units = await loadUnitsFromJSONL(uocJsonlPath, unitCodes);
  
  if (units.length === 0) {
    console.error('❌ ERROR: No unit data found');
    console.error('   Run "npm start" first to scrape unit data');
    process.exit(1);
  }
  
  console.log(`   ✅ Loaded ${units.length} units of competency\n`);
  
  // Parse assessment
  console.log('📄 Parsing assessment file...');
  console.log(`   File: ${assessmentFile}`);
  
  let assessments;
  const fileExt = path.extname(assessmentFile).toLowerCase();
  
  if (fileExt === '.docx' || fileExt === '.doc') {
    console.log('   Format: Word Document\n');
    const wordAssessment = await parseWordAssessment(assessmentFile);
    assessments = convertWordToAssessmentFormat([wordAssessment]);
  } else if (format === 'smt' || (format === 'auto' && assessmentFile.toLowerCase().includes('maritime'))) {
    console.log('   Format: SMT Maritime\n');
    assessments = parseSMTMaritimeAssessment(assessmentFile);
  } else {
    console.log('   Format: Generic\n');
    assessments = parseAssessmentExcel(assessmentFile);
  }
  
  if (assessments.length === 0 || assessments.every(a => a.questions.length === 0)) {
    console.error('❌ ERROR: No assessment questions found');
    console.error('   Check the file format');
    process.exit(1);
  }
  
  const totalQuestions = assessments.reduce((sum, a => sum + a.questions.length, 0);
  console.log(`   ✅ Parsed ${assessments.length} assessment(s) with ${totalQuestions} questions\n`);
  
  // Run validation
  const report = await validateAssessments(assessments, units);
  
  // Generate reports
  console.log('📊 Generating reports...\n');
  
  // Create output directory
  await fs.mkdir(outputDir, { recursive: true });
  
  // Generate Excel report
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const excelPath = path.join(outputDir, `validation-report-${timestamp}.xlsx`);
  generateExcelReport(report, excelPath);
  
  // Generate text report
  const textPath = path.join(outputDir, `validation-report-${timestamp}.txt`);
  saveTextReport(report, textPath);
  
  // Print summary to console
  printReport(report);
  
  console.log(`\n📁 Reports saved to: ${path.resolve(outputDir)}`);
  console.log(`   • ${path.basename(excelPath)}`);
  console.log(`   • ${path.basename(textPath)}\n`);
  
  // Exit with appropriate code
  const hasFailures =
    !report.rulesOfEvidence.validity.passed ||
    !report.rulesOfEvidence.sufficiency.passed ||
    !report.principlesOfAssessment.validity.passed;
  
  process.exit(hasFailures ? 1 : 0);
}

// Run main function
main().catch(error => {
  console.error('\n❌ Fatal Error:', error.message);
  if (error.stack) {
    console.error('\nStack trace:', error.stack);
  }
  process.exit(1);
});
