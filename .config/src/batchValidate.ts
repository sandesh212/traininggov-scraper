#!/usr/bin/env tsx
/**
 * Batch Validation Script
 * 
 * Validates all assessment files (Word/Excel) in a directory against multiple units
 */

import * as path from 'path';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
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
} from './services/reportGenerator.js';

// Helper to load units from JSONL
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

// Helper to find all assessment files
function findAssessmentFiles(directory: string): { word: string[]; excel: string[] } {
  const word: string[] = [];
  const excel: string[] = [];
  
  const files = fs.readdirSync(directory);
  
  for (const file of files) {
    if (file.startsWith('~$')) continue;  // Skip temp files
    
    const ext = path.extname(file).toLowerCase();
    const filePath = path.join(directory, file);
    
    if (ext === '.docx' || ext === '.doc') {
      // Skip marking sheets for now
      if (!file.toLowerCase().includes('marking')) {
        word.push(filePath);
      }
    } else if (ext === '.xlsx' || ext === '.xls') {
      if (file !== 'Units.xlsx') {  // Skip unit list file
        excel.push(filePath);
      }
    }
  }
  
  return { word, excel };
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
╔════════════════════════════════════════════════════════════════════════╗
║            Batch Assessment Validator                                  ║
╚════════════════════════════════════════════════════════════════════════╝

Validates all assessment files in a directory at once.

USAGE:
  npx tsx src/batchValidate.ts [OPTIONS]

OPTIONS:
  --dir <path>         Directory with assessment files (default: ../)
  --units <codes>      Unit codes to validate (comma-separated)
  --units-file <path>  File with unit codes (default: ../Units.xlsx)
  --output <dir>       Output directory (default: ../batch-validation-reports)
  --help, -h           Show this help

EXAMPLE:
  npx tsx src/batchValidate.ts --units-file ../Units.xlsx --output ../reports
`);
    process.exit(0);
  }
  
  // Check API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ ERROR: OPENAI_API_KEY not set');
    console.error('   Get key from: https://platform.openai.com/api-keys');
    console.error('   Set it: export OPENAI_API_KEY="your-key-here"');
    process.exit(1);
  }
  
  // Parse args
  let assessmentDir = path.resolve('../');
  let unitCodes: string[] = [];
  let unitsFile = path.resolve('../Units.xlsx');
  let outputDir = path.resolve('../batch-validation-reports');
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dir' && args[i + 1]) {
      assessmentDir = path.resolve(args[++i]);
    } else if (args[i] === '--units' && args[i + 1]) {
      unitCodes = args[++i].split(',').map(c => c.trim().toUpperCase());
    } else if (args[i] === '--units-file' && args[i + 1]) {
      unitsFile = path.resolve(args[++i]);
    } else if (args[i] === '--output' && args[i + 1]) {
      outputDir = path.resolve(args[++i]);
    }
  }
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('         Batch Assessment Validator');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // Load unit codes if not specified
  if (unitCodes.length === 0 && fs.existsSync(unitsFile)) {
    console.log(`📖 Reading unit codes from: ${unitsFile}`);
    const workbook = XLSX.readFile(unitsFile);
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
              unitCodes.push(match[1]);
            }
          }
        }
      }
    }
    unitCodes = [...new Set(unitCodes)];
    console.log(`   Found ${unitCodes.length} unit codes\n`);
  }
  
  if (unitCodes.length === 0) {
    console.error('❌ ERROR: No unit codes specified');
    console.error('   Use --units or --units-file');
    process.exit(1);
  }
  
  // Load unit data
  console.log('📚 Loading unit data...');
  const uocJsonlPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../data/uoc.jsonl');
  const units = await loadUnitsFromJSONL(uocJsonlPath, unitCodes);
  console.log(`   ✅ Loaded ${units.length} units\n`);
  
  // Find assessment files
  console.log(`📂 Scanning for assessments in: ${assessmentDir}`);
  const { word, excel } = findAssessmentFiles(assessmentDir);
  console.log(`   Found ${word.length} Word documents`);
  console.log(`   Found ${excel.length} Excel files\n`);
  
  if (word.length === 0 && excel.length === 0) {
    console.log('❌ No assessment files found');
    process.exit(1);
  }
  
  // Parse all files
  console.log('📄 Parsing assessment files...\n');
  
  let allAssessments: any[] = [];
  
  // Parse Word documents
  if (word.length > 0) {
    console.log(`   Parsing ${word.length} Word document(s)...`);
    const wordAssessments = await parseMultipleWordAssessments(word);
    const converted = convertWordToAssessmentFormat(wordAssessments);
    allAssessments.push(...converted);
    console.log(`   ✅ Extracted ${converted.reduce((sum, a) => sum + a.questions.length, 0)} questions from Word files\n`);
  }
  
  // Parse Excel files
  for (const excelFile of excel) {
    console.log(`   Parsing ${path.basename(excelFile)}...`);
    try {
      const assessments = parseAssessmentExcel(excelFile);
      allAssessments.push(...assessments);
      console.log(`   ✅ Extracted ${assessments.reduce((sum, a) => sum + a.questions.length, 0)} questions\n`);
    } catch (error) {
      console.log(`   ⚠️  Failed to parse (skipping)\n`);
    }
  }
  
  const totalQuestions = allAssessments.reduce((sum, a) => sum + a.questions.length, 0);
  console.log(`📊 Total: ${allAssessments.length} assessments with ${totalQuestions} questions\n`);
  
  // Run validation
  console.log('🤖 Running AI validation...\n');
  const report = await validateAssessments(allAssessments, units);
  
  // Create output directory
  await fsPromises.mkdir(outputDir, { recursive: true });
  
  // Generate reports
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const excelPath = path.join(outputDir, `batch-validation-${timestamp}.xlsx`);
  const textPath = path.join(outputDir, `batch-validation-${timestamp}.txt`);
  
  generateExcelReport(report, excelPath);
  saveTextReport(report, textPath);
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  VALIDATION COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`Overall Compliance: ${(report.overallCompliance * 100).toFixed(1)}%`);
  console.log(`Total Mappings: ${report.mappings.length}`);
  console.log(`Uncovered PCs: ${report.gaps.uncoveredPCs.length}\n`);
  console.log(`📁 Reports saved to: ${outputDir}`);
  console.log(`   • ${path.basename(excelPath)}`);
  console.log(`   • ${path.basename(textPath)}\n`);
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
