#!/usr/bin/env tsx
/**
 * Test Word Document Parser
 * 
 * Tests the Word document parsing on sample assessment files
 */

import * as path from 'path';
import * as fs from 'fs';
import {
  parseWordAssessment,
  parseMultipleWordAssessments,
  convertWordToAssessmentFormat,
} from './services/wordAssessmentParser.js';

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('       Word Document Parser Test');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // Find Word documents in parent directory (ESM compatible)
  const currentDir = path.dirname(new URL(import.meta.url).pathname);
  const rootDir = path.resolve(currentDir, '../..');
  const files = fs.readdirSync(rootDir)
    .filter(f => /\.(docx|doc)$/i.test(f) && !f.startsWith('~$'))
    .map(f => path.join(rootDir, f));
  
  if (files.length === 0) {
    console.log('❌ No Word documents found in:', rootDir);
    process.exit(1);
  }
  
  console.log(`📁 Found ${files.length} Word documents:\n`);
  files.forEach(f => console.log(`   • ${path.basename(f)}`));
  
  console.log('\n🔍 Parsing documents...\n');
  
  const assessments = await parseMultipleWordAssessments(files);
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  PARSING RESULTS');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  let totalQuestions = 0;
  
  assessments.forEach(assessment => {
    console.log(`\n📄 ${assessment.filename}`);
    console.log(`   Title: ${assessment.title}`);
    console.log(`   Type: ${assessment.metadata.assessmentType}`);
    console.log(`   Marking Sheet: ${assessment.metadata.hasMarkingSheet ? 'Yes' : 'No'}`);
    console.log(`   Unit Codes: ${assessment.unitCodes.join(', ') || 'None detected'}`);
    console.log(`   Questions: ${assessment.questions.length}`);
    
    totalQuestions += assessment.questions.length;
    
    if (assessment.questions.length > 0) {
      console.log('\n   Sample Questions:');
      assessment.questions.slice(0, 3).forEach(q => {
        const preview = q.questionText.substring(0, 80);
        console.log(`      ${q.id}: ${preview}${q.questionText.length > 80 ? '...' : ''}`);
        console.log(`           Type: ${q.type}`);
        if (q.section) {
          console.log(`           Section: ${q.section}`);
        }
        if (q.unitCodes.length > 0) {
          console.log(`           Unit Codes: ${q.unitCodes.join(', ')}`);
        }
      });
      
      if (assessment.questions.length > 3) {
        console.log(`      ... and ${assessment.questions.length - 3} more`);
      }
    }
  });
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`Total Documents Parsed:    ${assessments.length}`);
  console.log(`Total Questions Extracted: ${totalQuestions}`);
  console.log(`Average Questions/Doc:     ${(totalQuestions / assessments.length).toFixed(1)}`);
  
  // Filter out marking sheets
  const validAssessments = assessments.filter(a => !a.metadata.hasMarkingSheet);
  console.log(`\nAssessments (no marking): ${validAssessments.length}`);
  
  // Show unit code distribution
  const unitCodeCounts = new Map<string, number>();
  assessments.forEach(a => {
    a.unitCodes.forEach(code => {
      unitCodeCounts.set(code, (unitCodeCounts.get(code) || 0) + 1);
    });
  });
  
  if (unitCodeCounts.size > 0) {
    console.log('\nUnit Code Distribution:');
    Array.from(unitCodeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([code, count]) => {
        console.log(`   ${code}: ${count} document(s)`);
      });
  }
  
  // Test conversion to validation format
  console.log('\n🔄 Testing conversion to validation format...\n');
  const converted = convertWordToAssessmentFormat(validAssessments);
  console.log(`   ✅ Converted ${converted.length} assessments`);
  console.log(`   ✅ Total questions ready for validation: ${converted.reduce((sum, a) => sum + a.questions.length, 0)}`);
  
  console.log('\n✅ Parser test complete!\n');
}

main().catch(error => {
  console.error('\n❌ Error:', error);
  process.exit(1);
});
