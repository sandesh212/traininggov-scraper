/**
 * Quick Test - Validate Sample Maritime Assessments
 * Uses already-scraped data, no scraping needed!
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { UnitOfCompetency } from './src/models/uoc.js';
import { parseWordAssessment } from './src/services/wordAssessmentParser.js';
import { validateAssessments } from './src/services/aiValidationService.js';
import { checkOllamaAvailability } from './src/services/ollamaService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Sample maritime units for quick testing
const SAMPLE_UNITS = ['MARI003', 'MARN008', 'MARC037', 'MARK007', 'MARJ006', 'MARH013'];

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║       🚀 QUICK TEST - Maritime Assessment Validator      ║');
  console.log('║       Uses 6 maritime units + 1 sample assessment         ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // Check Ollama
  console.log('🤖 Checking Ollama...');
  const ollama = await checkOllamaAvailability();
  if (!ollama.available) {
    console.error(`❌ ${ollama.message}`);
    console.error('   Please start Ollama: ollama serve');
    process.exit(1);
  }
  console.log(`✅ Ollama ready (${ollama.models.length} models)\n`);

  // Load scraped units and transform to expected format
  console.log('📚 Loading unit data...');
  const uocPath = join(dirname(__dirname), 'data/uoc.jsonl'); // Go up from .config to project root
  const lines = readFileSync(uocPath, 'utf-8').split('\n').filter(l => l.trim());
  const rawUnits = lines
    .map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(u => u !== null);

  // Transform scraped format to validation service format
  const units: UnitOfCompetency[] = rawUnits
    .filter(u => SAMPLE_UNITS.includes(u.code))
    .map(u => ({
      code: u.code,
      title: u.title,
      elements: u.elements?.map((el: any, idx: number) => {
        // Extract element number from text like "1. Title" or "Element 1"
        const elementText = el.element || el.title || '';
        const numberMatch = elementText.match(/^(\d+)[\.\s]/);
        const number = numberMatch ? numberMatch[1] : String(idx + 1);
        const title = elementText.replace(/^\d+[\.\s]+/, '').trim();

        return {
          number,
          title,
          performanceCriteria: (el.performanceCriteria || []).map((pc: string) => {
            // Extract PC number and text like "1.1 Text"
            const pcMatch = pc.match(/^([\d\.]+)\s+(.+)$/);
            return {
              number: pcMatch ? pcMatch[1] : '',
              text: pcMatch ? pcMatch[2] : pc,
            };
          }),
        };
      }) || [],
      performanceEvidence: u.performanceEvidence || [],
      knowledgeEvidence: u.knowledgeEvidence || [],
    }));
  console.log(`✅ Loaded ${units.length}/${SAMPLE_UNITS.length} units:`);
  units.forEach(u => console.log(`   • ${u.code}: ${u.title}`));

  if (units.length === 0) {
    console.error('\n❌ No unit data found. Run the scraper first.');
    process.exit(1);
  }

  // Parse one assessment file
  console.log('\n📄 Parsing assessment...');
  const assessmentPath = join(__dirname, '../Knowledge Coxswain Deck.docx');
  const wordAssessment = await parseWordAssessment(assessmentPath);
  console.log(`✅ Extracted ${wordAssessment.questions.length} questions`);
  
  // Show first question for debugging
  if (wordAssessment.questions.length > 0) {
    const q = wordAssessment.questions[0];
    console.log(`   Sample: "${q.questionText?.substring(0, 60)}..."\n`);
  }

  // Create assessment object - transform WordQuestion to AssessmentQuestion
  const assessment = {
    id: 'test-1',
    name: 'Knowledge Coxswain Deck',
    questions: wordAssessment.questions
      .filter(q => q.questionText && q.questionText.trim().length > 0)
      .map(q => ({
        id: q.id,
        text: q.questionText, // Map questionText to text
        type: q.type || 'knowledge',
      })),
  };
  
  console.log(`   Filtered to ${assessment.questions.length} non-empty questions\n`);

  // Run validation
  console.log('🤖 Running AI validation...');
  console.log('   This will take a few minutes for embeddings...\n');
  
  const report = await validateAssessments([assessment], units);

  console.log('\n✅ VALIDATION COMPLETE!\n');
  console.log('📊 Results:');
  console.log(`   Overall Compliance: ${report.overallCompliance.toFixed(1)}%`);
  console.log(`   Units Analyzed: ${report.unitsAnalyzed}`);
  console.log(`   Questions Analyzed: ${report.questionsAnalyzed}`);
  console.log(`   Question-to-PC Mappings: ${report.mappings.length}`);
  console.log(`   Uncovered PCs: ${report.gaps.filter(g => !g.covered).length}`);
  
  console.log('\n📈 Per Unit Coverage:');
  units.forEach(unit => {
    const unitGaps = report.gaps.filter(g => g.unitCode === unit.code);
    const covered = unitGaps.filter(g => g.covered).length;
    const total = unitGaps.length;
    const pct = total > 0 ? (covered / total * 100).toFixed(1) : '0.0';
    console.log(`   ${unit.code}: ${pct}% (${covered}/${total} PCs)`);
  });

  if (report.recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    report.recommendations.forEach(rec => console.log(`   • ${rec}`));
  }

  console.log('\n✅ Test completed successfully!\n');
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
