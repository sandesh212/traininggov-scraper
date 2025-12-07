import * as fs from 'fs';
import { AdvancedDocxParser } from './src/services/advancedDocxParser';
import * as path from 'path';

const parser = new AdvancedDocxParser();
const buffer = fs.readFileSync(path.join('..', 'Knowledge Coxswain Deck Marking Sheet.docx'));
const result = parser.parseDocument(buffer);

console.log('---------------------------------------------------');
console.log('📄 DOCUMENT TITLE:', result.title);
console.log('---------------------------------------------------');
console.log('📋 INSTRUCTIONS:', result.instructions.length);
result.instructions.forEach((inst, i) => console.log(`  ${i + 1}. ${inst.substring(0, 100)}...`));
console.log('---------------------------------------------------');
console.log('❓ QUESTIONS:', result.questions.length);
// result.questions.forEach(q => console.log(`  ${q.id}: ${q.questionText.substring(0, 50)}...`));
console.log('---------------------------------------------------');
console.log('Images extracted (map size):', (parser as any).imageMap.size);
console.log('Images mapped to questions:', result.questions.reduce((acc, q) => acc + q.images.length, 0));
