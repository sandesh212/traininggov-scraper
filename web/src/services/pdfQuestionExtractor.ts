import { PDFParse } from 'pdf-parse';
import { AssessmentQuestion } from '../models/types';

export async function extractQuestionsFromPdf(buffer: Buffer): Promise<AssessmentQuestion[]> {
    const parser = new PDFParse({ data: buffer });
    const data = await parser.getText();
    await parser.destroy();
    const text = data.text;

    // Split text into lines
    const lines = text.split(/\n+/);
    const questions: AssessmentQuestion[] = [];
    let currentSection = "General";

    // Regex patterns (similar to DOCX extractor but adapted for plain text lines)
    const sectionRegex = /^(PART|SECTION|MODULE|UNIT|KNOWLEDGE|PRACTICAL|ASSESSMENT)\s/i;
    const numberedQuestionRegex = /^(?:Q(?:uestion)?\s*)?(\d+(?:\.\d+)*|[a-z])(?:\)|\.|:)?\s+(.*)/i;
    const questionWordRegex = /^(What|Who|Where|When|Why|How|List|Describe|Explain|Identify|Define|Calculate|Match|Select|Name|State|Give|Provide)\s+(.+?)(?:\?|\.)?$/i;

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length < 5) continue;

        // Detect Section
        if (sectionRegex.test(trimmed) && trimmed.length < 100) {
            currentSection = trimmed;
            continue;
        }

        let questionId: string | null = null;
        let questionText: string | null = null;

        const numMatch = trimmed.match(numberedQuestionRegex);
        const wordMatch = trimmed.match(questionWordRegex);
        const endsWithQuestion = trimmed.endsWith('?');

        if (numMatch && numMatch[2].length > 5) {
            questionId = numMatch[1].replace(/[^\w]/g, '');
            questionText = numMatch[2];
        } else if ((wordMatch || endsWithQuestion) && trimmed.length > 10 && trimmed.length < 300) {
            questionId = `Q${questions.length + 1}`;
            questionText = trimmed;
        }

        if (questionId && questionText) {
            // Filter out likely non-questions (same heuristic as DOCX)
            if (numMatch) {
                const startsWithQuestionWord = /^(What|Who|Where|When|Why|How|List|Describe|Explain|Identify|Define|Calculate|Match|Select|Name|State|Give|Provide)\b/i.test(questionText);
                const hasQuestionMark = questionText.includes('?');
                if (!startsWithQuestionWord && !hasQuestionMark && questionText.length < 60) {
                    continue;
                }
            }

            // Clean up answer text (simple split by ?)
            if (questionText.includes('?')) {
                questionText = questionText.split('?')[0].trim() + '?';
            }

            const sectionPrefix = currentSection.substring(0, 15).replace(/[^\w]/g, '');
            const uniqueId = `${sectionPrefix}_${questionId}`;

            questions.push({
                id: uniqueId,
                text: questionText,
                section: currentSection
            });
        }
    }

    return questions;
}
