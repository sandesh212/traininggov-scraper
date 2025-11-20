/**
 * Fast Test - Custom AI Engine
 * No external API calls - runs in seconds, not minutes!
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseWordAssessment } from './src/services/wordAssessmentParser.js';
import { batchMatchQuestionsToPC, analyzeCoverage } from './src/services/customAIService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Sample maritime units for testing
const SAMPLE_UNITS = ['MARI003', 'MARN008', 'MARC037', 'MARK007', 'MARJ006', 'MARH013'];

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║       ⚡ FAST TEST - Custom AI Engine                   ║');
  console.log('║       No Ollama, No OpenAI - Just Pure Speed!            ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // Load scraped units
  console.log('📚 Loading unit data...');
  const uocPath = join(dirname(__dirname), 'data/uoc.jsonl');
  const lines = readFileSync(uocPath, 'utf-8').split('\n').filter(l => l.trim());
  const rawUnits = lines
    .map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(u => u !== null && SAMPLE_UNITS.includes(u.code));

  console.log(`✅ Loaded ${rawUnits.length} units\n`);

  // Extract all PCs
  const allPCs: Array<{
    unitCode: string;
    elementNumber: string;
    pcNumber: string;
    text: string;
  }> = [];

  rawUnits.forEach(unit => {
    unit.elements?.forEach((el: any, elIdx: number) => {
      const elementText = el.element || el.title || '';
      const elementNumber = elementText.match(/^(\d+)/)?.[1] || String(elIdx + 1);
      
      (el.performanceCriteria || []).forEach((pc: string) => {
        const pcMatch = pc.match(/^([\d\.]+)\s+(.+)$/);
        if (pcMatch) {
          allPCs.push({
            unitCode: unit.code,
            elementNumber,
            pcNumber: pcMatch[1],
            text: pcMatch[2],
          });
        }
      });
    });
  });

  console.log(`📋 Extracted ${allPCs.length} Performance Criteria\n`);

  // Parse assessment
  console.log('📄 Parsing assessment...');
  const assessmentPath = join(dirname(__dirname), 'Knowledge Coxswain Deck.docx');
  const wordAssessment = await parseWordAssessment(assessmentPath);
  
  const questions = wordAssessment.questions
    .filter(q => q.questionText && q.questionText.trim().length > 0)
    .map(q => ({
      id: q.id,
      text: q.questionText,
    }));

  console.log(`✅ Extracted ${questions.length} questions\n`);

  // Run custom AI matching
  const startTime = Date.now();
  const results = batchMatchQuestionsToPC(questions, allPCs);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  // Analyze coverage
  const coverage = analyzeCoverage(results, allPCs);

  // Display results
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 RESULTS');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log(`⚡ Processing Time: ${elapsed}s`);
  console.log(`📝 Questions Analyzed: ${questions.length}`);
  console.log(`🎯 Performance Criteria: ${allPCs.length}`);
  console.log(`✅ Coverage Rate: ${coverage.coverageRate.toFixed(1)}%`);
  console.log(`   Covered PCs: ${coverage.covered.size}`);
  console.log(`   Uncovered PCs: ${coverage.uncovered.size}`);
  
  // Show sample matches
  console.log('\n📌 Sample Matches:\n');
  results.slice(0, 3).forEach(result => {
    const question = questions.find(q => q.id === result.questionId);
    console.log(`Q: "${question?.text.substring(0, 60)}..."`);
    
    if (result.pcMatches.length > 0) {
      const topMatch = result.pcMatches[0];
      console.log(`   → ${topMatch.unitCode} ${topMatch.elementNumber}.${topMatch.pcNumber}`);
      console.log(`   → Similarity: ${(topMatch.match.similarity * 100).toFixed(1)}% (${topMatch.match.confidence})`);
      console.log(`   → ${topMatch.match.explanation}\n`);
    } else {
      console.log(`   → No matches found\n`);
    }
  });

  // Show uncovered PCs
  if (coverage.uncovered.size > 0) {
    console.log('\n⚠️  Uncovered Performance Criteria (first 10):\n');
    const uncoveredArray = [...coverage.uncovered].slice(0, 10);
    uncoveredArray.forEach(pcId => {
      const [unitCode, pcNum] = pcId.split(':');
      const pc = allPCs.find(p => 
        `${p.unitCode}:${p.elementNumber}.${p.pcNumber}` === pcId
      );
      if (pc) {
        console.log(`   ${pcId}: "${pc.text.substring(0, 70)}..."`);
      }
    });
    if (coverage.uncovered.size > 10) {
      console.log(`   ... and ${coverage.uncovered.size - 10} more`);
    }
  }

  console.log('\n✅ Test completed!\n');
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
