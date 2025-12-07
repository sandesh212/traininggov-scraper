#!/usr/bin/env tsx
/**
 * Analyze Sample Assessments
 * 
 * This tool analyzes the sample assessment files to:
 * 1. Understand their structure and patterns
 * 2. Extract questions, keywords, and unit codes
 * 3. Generate training data for improving AI matching
 * 4. Identify common patterns across assessments
 * 
 * Usage:
 *   npx tsx src/analyzeSamples.ts [--dir <directory>] [--output <path>]
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  analyzeAssessmentPatterns,
  saveAnalysisResults,
  generateTrainingData,
  DocumentAnalysis,
} from './utils/documentAnalyzer.js';

interface CliArgs {
  dir: string;
  output: string;
  verbose: boolean;
  help: boolean;
}

function parseArgs(): CliArgs {
  const args: CliArgs = {
    dir: path.resolve('../'),  // Parent directory (project root)
    output: path.resolve('../analysis-results'),
    verbose: false,
    help: false,
  };

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    
    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--dir' || arg === '-d') {
      args.dir = path.resolve(process.argv[++i]);
    } else if (arg === '--output' || arg === '-o') {
      args.output = path.resolve(process.argv[++i]);
    } else if (arg === '--verbose' || arg === '-v') {
      args.verbose = true;
    }
  }

  return args;
}

function printHelp(): void {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║           📊 Assessment Sample Analyzer                        ║
╚════════════════════════════════════════════════════════════════╝

Analyzes sample assessment documents to understand their structure
and patterns, helping to train and optimize the AI validation system.

USAGE:
  npx tsx src/analyzeSamples.ts [OPTIONS]

OPTIONS:
  --dir, -d <path>      Directory containing assessment files
                        (default: project root)
  
  --output, -o <path>   Output directory for analysis results
                        (default: ../analysis-results)
  
  --verbose, -v         Show detailed analysis information
  
  --help, -h            Show this help message

EXAMPLES:
  # Analyze all assessments in project root
  npx tsx src/analyzeSamples.ts

  # Analyze specific directory
  npx tsx src/analyzeSamples.ts --dir /path/to/assessments

  # Save results to custom location
  npx tsx src/analyzeSamples.ts --output ./my-analysis

WHAT IT DOES:
  ✓ Extracts text from Word documents (.docx)
  ✓ Parses Excel files (.xlsx)
  ✓ Identifies questions, keywords, and unit codes
  ✓ Finds common patterns across documents
  ✓ Generates training data for AI improvement
  ✓ Creates detailed analysis reports

OUTPUT:
  The tool generates several files:
  - analysis-summary.json       Overall statistics and patterns
  - document-analyses.json      Detailed analysis per document
  - training-data.json          Data for AI training/tuning
  - patterns-report.txt         Human-readable summary
`);
}

function findAssessmentFiles(directory: string): string[] {
  const files: string[] = [];
  
  if (!fs.existsSync(directory)) {
    console.error(`❌ Directory not found: ${directory}`);
    return files;
  }
  
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (['.docx', '.doc', '.xlsx', '.xls'].includes(ext)) {
        // Skip temporary files
        if (!entry.name.startsWith('~$')) {
          files.push(path.join(directory, entry.name));
        }
      }
    }
  }
  
  return files;
}

function printSummary(
  analyses: DocumentAnalysis[],
  patterns: any,
  summary: any
): void {
  console.log('\n' + '═'.repeat(70));
  console.log('📊 ANALYSIS SUMMARY');
  console.log('═'.repeat(70));
  
  console.log('\n📁 Documents Analyzed:');
  analyses.forEach(a => {
    console.log(`   • ${a.filename}`);
    console.log(`     Type: ${a.type} | Size: ${(a.metadata.size / 1024).toFixed(1)} KB`);
    console.log(`     Questions: ${a.structure.questions?.length || 0}`);
    console.log(`     Unit Codes: ${a.structure.unitCodes?.join(', ') || 'None'}`);
  });
  
  console.log('\n📝 Overall Statistics:');
  console.log(`   Total Documents:    ${summary.totalDocuments}`);
  console.log(`   Total Questions:    ${summary.totalQuestions}`);
  console.log(`   Average per Doc:    ${(summary.totalQuestions / summary.totalDocuments).toFixed(1)}`);
  
  if (summary.commonUnits.length > 0) {
    console.log('\n🎯 Common Unit Codes (appear in multiple documents):');
    summary.commonUnits.slice(0, 10).forEach((code: string) => {
      console.log(`   • ${code}`);
    });
  }
  
  if (summary.topKeywords.length > 0) {
    console.log('\n🔑 Top Keywords Across All Documents:');
    console.log(`   ${summary.topKeywords.slice(0, 20).join(', ')}`);
  }
  
  console.log('\n📋 Question Patterns Found:');
  patterns.questionIndicators.slice(0, 10).forEach((indicator: string) => {
    console.log(`   • ${indicator}`);
  });
  
  console.log('\n' + '═'.repeat(70));
}

function generateTextReport(
  analyses: DocumentAnalysis[],
  patterns: any,
  summary: any
): string {
  let report = '';
  
  report += '═'.repeat(70) + '\n';
  report += 'ASSESSMENT SAMPLE ANALYSIS REPORT\n';
  report += `Generated: ${new Date().toLocaleString()}\n`;
  report += '═'.repeat(70) + '\n\n';
  
  report += 'OVERVIEW\n';
  report += '─'.repeat(70) + '\n';
  report += `Total Documents Analyzed: ${summary.totalDocuments}\n`;
  report += `Total Questions Found:    ${summary.totalQuestions}\n`;
  report += `Average Questions/Doc:    ${(summary.totalQuestions / summary.totalDocuments).toFixed(1)}\n\n`;
  
  report += 'DOCUMENTS\n';
  report += '─'.repeat(70) + '\n';
  analyses.forEach(a => {
    report += `\n${a.filename}\n`;
    report += `  Type:          ${a.type}\n`;
    report += `  Size:          ${(a.metadata.size / 1024).toFixed(1)} KB\n`;
    report += `  Questions:     ${a.structure.questions?.length || 0}\n`;
    report += `  Paragraphs:    ${a.structure.paragraphs || 0}\n`;
    report += `  Unit Codes:    ${a.structure.unitCodes?.join(', ') || 'None'}\n`;
    report += `  Top Keywords:  ${a.structure.keywords?.slice(0, 10).join(', ') || 'None'}\n`;
  });
  
  report += '\n\nCOMMON PATTERNS\n';
  report += '─'.repeat(70) + '\n';
  report += '\nCommon Unit Codes:\n';
  summary.commonUnits.forEach((code: string) => {
    report += `  • ${code}\n`;
  });
  
  report += '\nTop Keywords Across All Documents:\n';
  summary.topKeywords.forEach((keyword: string, index: number) => {
    if (index % 5 === 0) report += '\n  ';
    report += `${keyword}, `;
  });
  report += '\n';
  
  report += '\nQuestion Indicators:\n';
  patterns.questionIndicators.forEach((indicator: string) => {
    report += `  • ${indicator}\n`;
  });
  
  report += '\n' + '═'.repeat(70) + '\n';
  
  return report;
}

async function main() {
  const args = parseArgs();
  
  if (args.help) {
    printHelp();
    process.exit(0);
  }
  
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║           📊 Assessment Sample Analyzer                        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  
  console.log(`\n📂 Searching for assessment files in: ${args.dir}`);
  
  const files = findAssessmentFiles(args.dir);
  
  if (files.length === 0) {
    console.log('\n❌ No assessment files found!');
    console.log('   Looking for: .docx, .doc, .xlsx, .xls files');
    console.log(`   In directory: ${args.dir}`);
    process.exit(1);
  }
  
  console.log(`\n✅ Found ${files.length} assessment file(s):`);
  files.forEach(f => console.log(`   • ${path.basename(f)}`));
  
  try {
    // Analyze all documents
    const { analyses, patterns, summary } = await analyzeAssessmentPatterns(files);
    
    // Print summary to console
    printSummary(analyses, patterns, summary);
    
    // Generate training data
    console.log('\n🤖 Generating training data...');
    const trainingData = generateTrainingData(analyses);
    console.log(`   ✅ Generated ${trainingData.examples.length} training examples`);
    
    // Create output directory
    if (!fs.existsSync(args.output)) {
      fs.mkdirSync(args.output, { recursive: true });
    }
    
    // Save results
    console.log(`\n💾 Saving results to: ${args.output}`);
    
    saveAnalysisResults(
      { summary, patterns },
      path.join(args.output, 'analysis-summary.json')
    );
    
    saveAnalysisResults(
      analyses.map(a => ({
        filename: a.filename,
        type: a.type,
        structure: a.structure,
        metadata: a.metadata,
        // Don't save full content to keep file size manageable
      })),
      path.join(args.output, 'document-analyses.json')
    );
    
    saveAnalysisResults(
      trainingData,
      path.join(args.output, 'training-data.json')
    );
    
    // Generate text report
    const textReport = generateTextReport(analyses, patterns, summary);
    fs.writeFileSync(
      path.join(args.output, 'patterns-report.txt'),
      textReport,
      'utf-8'
    );
    console.log(`   ✅ Saved: patterns-report.txt`);
    
    // If verbose, print sample questions
    if (args.verbose) {
      console.log('\n📝 Sample Questions Found:');
      analyses.forEach(a => {
        if (a.structure.questions && a.structure.questions.length > 0) {
          console.log(`\n   From ${a.filename}:`);
          a.structure.questions.slice(0, 5).forEach(q => {
            console.log(`      • ${q.substring(0, 80)}${q.length > 80 ? '...' : ''}`);
          });
        }
      });
    }
    
    console.log('\n✅ Analysis complete!');
    console.log('\n💡 Next Steps:');
    console.log('   1. Review the analysis results in:', args.output);
    console.log('   2. Check patterns-report.txt for detailed findings');
    console.log('   3. Use training-data.json to improve AI matching');
    console.log('   4. Run validation with: npm run validate');
    
  } catch (error) {
    console.error('\n❌ Error during analysis:', error);
    process.exit(1);
  }
}

main();
