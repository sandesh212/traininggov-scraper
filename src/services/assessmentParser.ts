import fs from 'fs';
import path from 'path';
import { extractQuestionsFromDocx } from './docxQuestionExtractor.js';
import { AssessmentQuestion } from '../models/types.js';

export class AssessmentParser {
    public async parse(filePath: string): Promise<AssessmentQuestion[]> {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.docx') {
            return await extractQuestionsFromDocx(filePath);
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        return this.parseText(content);
    }

    private parseText(content: string): AssessmentQuestion[] {
        const questions: AssessmentQuestion[] = [];
        const lines = content.split('\n');

        let currentSection = '';
        let currentQ: AssessmentQuestion | null = null;

        // Regex for question start: "1. ", "Q1.", "Question 1:"
        const qStartRegex = /^(?:Q(?:uestion)?\s*)?(\d+)[\.:\)]\s+(.+)/i;
        const sectionRegex = /^(?:PART|SECTION)\s+([A-Z0-9]+)[\s:-]+(.+)/i;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Check for Section Header
            const sectionMatch = line.match(sectionRegex);
            if (sectionMatch) {
                currentSection = sectionMatch[2].trim();
                continue;
            }

            // Check for Question Start
            const qMatch = line.match(qStartRegex);
            if (qMatch) {
                // Save previous question
                if (currentQ) {
                    questions.push(currentQ);
                }

                currentQ = {
                    id: qMatch[1],
                    text: qMatch[2],
                    section: currentSection
                };
            } else if (currentQ) {
                // Append to current question text if it's not a new question or section
                // Heuristic: if line starts with a bullet or letter, it might be part of the question
                // or a sub-question. For now, we append everything until the next number.
                currentQ.text += ' ' + line;
            }
        }

        // Push last question
        if (currentQ) {
            questions.push(currentQ);
        }

        return questions;
    }
}
