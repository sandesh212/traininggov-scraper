/**
 * SMART UNIVERSAL VALIDATOR
 * 
 * Intelligent assessment validator that:
 * 1. Auto-detects units from ANY assessment document
 * 2. Differentiates questions/answers/instructions automatically
 * 3. Maps to PC/PE/KE (not just PC!)
 * 4. NO HARDCODED VALUES
 * 
 * Usage:
 *   node smart-validate.ts <assessment-file.docx>
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { analyzeDocumentSmart } from './src/services/smartDocumentAnalyzer.js';
import { extractAllCriteria, getAllCriteriaFlat, filterCriteriaByUnits } from './src/services/criteriaExtractor.js';
import { batchMatchQuestionsToPC } from './src/services/customAIService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║   🧠 SMART UNIVERSAL VALIDATOR                          ║');
  console.log('║   Auto-detects Everything - No Hardcoded Values!        ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // Get assessment file from command line OR use default
  const assessmentFile = process.argv[2] || join(dirname(__dirname), 'Knowledge Coxswain Deck.docx');
  
  if (!assessmentFile) {
    console.error('❌ Usage: node smart-validate.ts <assessment-file.docx>');
    process.exit(1);
  }
  
  console.log(`📄 Assessment File: ${assessmentFile.split('/').pop()}\n`);
  
  // 1. Load ALL units from database
  console.log('📚 Loading ALL units from database...');
  const uocPath = join(dirname(__dirname), 'data/uoc.jsonl');
  const lines = readFileSync(uocPath, 'utf-8').split('\n').filter(l => l.trim());
  const allUnits = lines
    .map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(u => u !== null);
  
  console.log(`✅ Loaded ${allUnits.length} units\n`);
  
  // 2. Smart document analysis
  console.log('🔍 Analyzing assessment document (auto-detecting units)...');
  const analysis = await analyzeDocumentSmart(assessmentFile, allUnits);
  
  console.log(`✅ Detected ${analysis.detectedUnits.length} units:`);
  analysis.detectedUnits.forEach(code => {
    const unit = allUnits.find(u => u.code === code);
    console.log(`   - ${code}: ${unit?.title || 'Unknown'}`);
  });
  console.log();
  
  if (analysis.detectedUnits.length === 0) {
    console.warn('⚠️  No units detected! Using semantic suggestions...');
    console.log(`   Suggested: ${analysis.metadata.suggestedUnits.join(', ')}\n`);
    
    if (analysis.metadata.suggestedUnits.length === 0) {
      console.error('❌ Could not identify relevant units. Please check the assessment document.');
      process.exit(1);
    }
    
    // Use suggestions
    analysis.detectedUnits.push(...analysis.metadata.suggestedUnits.slice(0, 10));
  }
  
  console.log(`📝 Extracted ${analysis.questions.length} questions\n`);
  
  // 3. Extract ALL criteria (PC + PE + KE)
  console.log('📋 Extracting criteria (PC, PE, KE) from detected units...');
  const relevantUnits = allUnits.filter(u => analysis.detectedUnits.includes(u.code));
  const allCriteria = extractAllCriteria(relevantUnits);
  const flatCriteria = getAllCriteriaFlat(allCriteria);
  
  const pcCount = flatCriteria.filter(c => c.type === 'PC').length;
  const peCount = flatCriteria.filter(c => c.type === 'PE').length;
  const keCount = flatCriteria.filter(c => c.type === 'KE').length;
  
  console.log(`✅ Extracted:`);
  console.log(`   - ${pcCount} Performance Criteria (PC)`);
  console.log(`   - ${peCount} Performance Evidence (PE)`);
  console.log(`   - ${keCount} Knowledge Evidence (KE)`);
  console.log(`   - TOTAL: ${flatCriteria.length} criteria\n`);
  
  // 4. Match questions to criteria
  console.log('🧠 Matching questions to criteria using Custom AI...');
  
  // Convert to format expected by AI
  const questionsForAI = analysis.questions.map(q => ({
    questionText: q.text,
    id: q.id,
    context: q.context
  }));
  
  const criteriaForAI = flatCriteria.map(c => ({
    unitCode: c.unitCode,
    elementNumber: '1', // We'll show type instead
    pcNumber: c.reference,
    text: c.text
  }));
  
  const matches = await batchMatchQuestionsToPC(questionsForAI, criteriaForAI);
  
  console.log(`✅ Matching complete!\n`);
  
  // 5. Analyze results
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 RESULTS');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log(`⚡ Processing Time: ${(matches.processingTimeMs / 1000).toFixed(2)}s`);
  console.log(`📝 Questions Analyzed: ${analysis.questions.length}`);
  console.log(`🎯 Total Criteria: ${flatCriteria.length}`);
  console.log(`   - PC: ${pcCount}`);
  console.log(`   - PE: ${peCount}`);
  console.log(`   - KE: ${keCount}`);
  
  // Calculate coverage
  const coveredCriteria = new Set(
    matches.matches
      .filter(m => m.match && m.match.similarity >= 0.2)
      .map(m => m.match!.criterionReference)
  );
  
  const coverageRate = (coveredCriteria.size / flatCriteria.length) * 100;
  
  console.log(`\n✅ Coverage Rate: ${coverageRate.toFixed(1)}%`);
  console.log(`   Covered Criteria: ${coveredCriteria.size}`);
  console.log(`   Uncovered Criteria: ${flatCriteria.length - coveredCriteria.size}\n`);
  
  // 6. Show sample matches
  console.log('📌 Sample Matches:\n');
  
  matches.matches.slice(0, 5).forEach(match => {
    if (match.match) {
      const truncQ = match.question.questionText.substring(0, 65);
      const type = match.match.criterionReference.split(':')[1]; // Extract type
      console.log(`Q: "${truncQ}..."`);
      console.log(`   → ${match.match.criterionReference}`);
      console.log(`   → Type: ${type} | Similarity: ${(match.match.similarity * 100).toFixed(1)}%`);
      console.log(`   → ${match.match.explanation}\n`);
    }
  });
  
  // 7. Show uncovered criteria by type
  const uncoveredByType = {
    PC: [] as string[],
    PE: [] as string[],
    KE: [] as string[]
  };
  
  flatCriteria.forEach(c => {
    if (!coveredCriteria.has(c.reference)) {
      uncoveredByType[c.type].push(`${c.reference}: ${c.text.substring(0, 70)}...`);
    }
  });
  
  console.log('⚠️  Uncovered Criteria Summary:\n');
  console.log(`   Uncovered PC: ${uncoveredByType.PC.length}`);
  console.log(`   Uncovered PE: ${uncoveredByType.PE.length}`);
  console.log(`   Uncovered KE: ${uncoveredByType.KE.length}\n`);
  
  if (uncoveredByType.PC.length > 0) {
    console.log('   Sample Uncovered PC (first 3):');
    uncoveredByType.PC.slice(0, 3).forEach(pc => console.log(`      ${pc}`));
    console.log();
  }
  
  console.log('✅ Validation complete!\n');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
