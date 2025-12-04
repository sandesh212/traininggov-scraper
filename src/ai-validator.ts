import dotenv from 'dotenv';
import { UocLoader } from './services/uocLoader.js';
import { AssessmentParser } from './services/assessmentParser.js';
import { AIService } from './services/aiService.js';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

// Production mode - reduces console output
const PRODUCTION_MODE = process.env.PRODUCTION_MODE === 'true';
const log = (...args: any[]) => !PRODUCTION_MODE && console.log(...args);
const logAlways = (...args: any[]) => console.log(...args);

/**
 * Validates environment variables and configuration
 */
function validateEnvironment(): void {
  const warnings: string[] = [];

  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'mock-key') {
    warnings.push('⚠️ OPENAI_API_KEY not set - running in MOCK MODE');
  }

  if (!process.env.AI_MODEL) {
    warnings.push('ℹ️ AI_MODEL not set - using default: gpt-4o');
  }

  if (warnings.length > 0) {
    logAlways('\n' + warnings.join('\n'));
    logAlways('');
  }
}

/**
 * Validates that required files exist
 */
function validateFiles(assessmentFile: string): void {
  if (!fs.existsSync(assessmentFile)) {
    throw new Error(
      `Assessment file not found: ${assessmentFile}\n\n` +
      `Please check that:\n` +
      `1. The file path is correct\n` +
      `2. The file exists in the specified location\n` +
      `3. You have read permissions for the file`
    );
  }

  const dataPath = path.resolve(process.cwd(), 'data/uoc.jsonl');
  if (!fs.existsSync(dataPath)) {
    throw new Error(
      `UoC data file not found at: ${dataPath}\n\n` +
      `Please run the scraper first to populate the data:\n` +
      `  npm run scrape\n\n` +
      `Or ensure the data/uoc.jsonl file exists.`
    );
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    logAlways('Usage: npx tsx src/ai-validator.ts <assessment-file> <uoc-codes>');
    logAlways('Example: npx tsx src/ai-validator.ts "assessment.docx" MARK007,MARN008');
    logAlways('\nEnvironment Variables:');
    logAlways('  OPENAI_API_KEY - Your OpenAI API key (optional, uses mock mode if not set)');
    logAlways('  AI_MODEL - AI model to use (default: gpt-4o)');
    logAlways('  PRODUCTION_MODE - Set to "true" for minimal console output');
    process.exit(1);
  }

  const assessmentFile = args[0];
  const uocCodesInput = args[1];
  const uocCodes = uocCodesInput.split(',').map(c => c.trim());

  try {
    // Validate environment and files
    validateEnvironment();
    validateFiles(assessmentFile);

    const apiKey = process.env.OPENAI_API_KEY || 'mock-key';

    logAlways(`\n🚀 Starting AI Assessment Validator (Clustering Mode)`);
    log(`   Assessment: ${assessmentFile}`);
    log(`   Target UoCs: ${uocCodes.join(', ')}`);

    // 1. Load UoC Data
    const uocLoader = new UocLoader();
    await uocLoader.load();

    const uocs = [];
    for (const code of uocCodes) {
      const uoc = uocLoader.getUnit(code);
      if (uoc) {
        uocs.push(uoc);
        log(`   ✓ Loaded UoC: ${uoc.code} - ${uoc.title}`);
      } else {
        logAlways(`   ⚠️ Warning: Unit '${code}' not found in data.`);
      }
    }

    if (uocs.length === 0) {
      throw new Error(
        `No valid Units of Competency found for codes: ${uocCodes.join(', ')}\n\n` +
        `Please check that:\n` +
        `1. The unit codes are correct\n` +
        `2. The units exist in data/uoc.jsonl\n` +
        `3. You've run the scraper to populate the data`
      );
    }

    // 2. Parse Assessment
    const parser = new AssessmentParser();
    const questions = await parser.parse(assessmentFile);
    log(`   ✓ Parsed ${questions.length} questions from assessment`);

    if (questions.length === 0) {
      logAlways(`\n⚠️ No questions found in assessment file.`);
      logAlways(
        `  This could mean:\n` +
        `  1. The file format is not supported\n` +
        `  2. The questions are not formatted correctly\n` +
        `  3. The file is empty or corrupted`
      );
      process.exit(1);
    }

    // 3. Initialize AI
    const aiService = new AIService(apiKey, process.env.AI_MODEL);

    // 4. Validate
    log(`\n🤖 Analyzing questions with AI (Clustering)...`);
    const results = [];

    for (const q of questions) {
      if (!PRODUCTION_MODE) process.stdout.write(`   Processing Q${q.id}... `);
      const result = await aiService.validateQuestion(q, uocs);
      results.push(result);
      log(result.isValid ? `✅ Mapped to ${result.mappedUnit}` : "❌ Invalid/Unmapped");
    }

    // 5. Generate Report
    const reportPath = `AI_CLUSTERING_REPORT.md`;
    let report = `# AI Assessment Clustering & Validation Report\n\n`;
    report += `**Date:** ${new Date().toLocaleString()}\n`;
    report += `**Assessment:** ${assessmentFile}\n`;
    report += `**Target Units:** ${uocCodes.join(', ')}\n\n`;

    report += `## Summary by Unit\n`;

    const unitStats = new Map<string, number>();
    uocs.forEach(u => unitStats.set(u.code, 0));
    let unmappedCount = 0;

    results.forEach(r => {
      if (r.isValid && r.mappedUnit) {
        unitStats.set(r.mappedUnit, (unitStats.get(r.mappedUnit) || 0) + 1);
      } else {
        unmappedCount++;
      }
    });

    for (const [code, count] of unitStats) {
      report += `- **${code}:** ${count} questions mapped\n`;
    }
    report += `- **Unmapped/Invalid:** ${unmappedCount}\n\n`;

    report += `## Detailed Analysis\n\n`;

    for (const r of results) {
      const q = questions.find(q => q.id === r.questionId)!;
      report += `### Q${r.questionId}: ${q.text.substring(0, 100)}...\n`;
      report += `- **Mapped Unit:** ${r.mappedUnit || 'None'}\n`;
      report += `- **Status:** ${r.isValid ? '✅ Valid' : '❌ Invalid'} (Confidence: ${r.confidence}%)\n`;
      if (r.mappedUnit) {
        report += `- **Mapped PC:** ${r.mappedCriteria.join(', ') || 'None'}\n`;
        report += `- **Mapped Knowledge:** ${r.mappedKnowledge.join(', ') || 'None'}\n`;
      }
      report += `- **Reasoning:** ${r.reasoning}\n`;
      if (r.gaps.length > 0) {
        report += `- **Gaps:** ${r.gaps.join(', ')}\n`;
      }
      report += `\n---\n\n`;
    }

    fs.writeFileSync(reportPath, report);
    logAlways(`\n📄 Report generated: ${reportPath}`);
    logAlways(`✅ Validation complete! ${results.length} questions processed.`);
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main().catch(error => {
  console.error('\n❌ Unexpected error:', error);
  process.exit(1);
});
