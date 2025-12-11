import { AssessmentQuestion } from '../models/types';
import { AdvancedDocxParser, ParsedQuestion } from './advancedDocxParser';

const log = (...args: any[]) => {
    console.log(...args);
};

/**
 * Extract questions and answers from DOCX with FULL structure recognition
 * 
 * Features:
 * - Separates instructions from content
 * - Dynamically detects section headers (any format)
 * - Handles sub-questions (a, b, c, i, ii, etc.)
 * - Preserves "Refer to" headings
 * - Keeps answer sub-headings intact
 * - Preserves bold formatting
 * - Extracts images
 * - Works with ANY document structure
 */
export async function extractQuestionsFromDocx(fileBuffer: Buffer): Promise<{
    questions: AssessmentQuestion[],
    detectedUnitCodes: string[],
    instructions: string[],
    redTextAnswers?: any[],
    title?: string,
    titleFormatted?: { text: string; isBold: boolean; isRed: boolean; size: number; }
}> {
    log('\n📄 Starting ADVANCED DOCX extraction v2.0...');

    // Use Advanced Parser
    const parser = new AdvancedDocxParser();
    const parsed = parser.parseDocument(fileBuffer);

    log(`   ✅ Found ${parsed.instructions.length} instruction blocks`);
    log(`   ✅ Extracted ${parsed.questions.length} questions with full structure`);
    if (parsed.titleFormatted) {
        log(`   📋 Document heading: "${parsed.titleFormatted.text}" (Bold: ${parsed.titleFormatted.isBold}, Red: ${parsed.titleFormatted.isRed}, Size: ${parsed.titleFormatted.size}pt)`);
    }

    // Convert to our internal format
    const questions: AssessmentQuestion[] = [];
    const redTextAnswers: any[] = [];

    parsed.questions.forEach((pq: ParsedQuestion, index: number) => {
        // Build complete question text
        let fullQuestionText = '';

        // Add "Refer to" heading if present (as part of question)
        if (pq.referHeading) {
            fullQuestionText += `${pq.referHeading}\n`;
        }

        // Add main question
        fullQuestionText += pq.questionText;

        // Create question
        questions.push({
            id: pq.id,
            text: fullQuestionText.trim(),
            section: pq.section,
            parentQuestionId: pq.parentQuestionId,
            _answer: pq.answerText, // Combine answer for AI analysis
            subQuestions: pq.subQuestions?.map(sq => ({
                id: sq.id,
                text: sq.questionText,
                section: sq.section,
                _answer: sq.answerText // Also map sub-question answers
            }))
        });

        // Create answer with metadata
        redTextAnswers.push({
            text: pq.answerText,
            section: pq.section,
            questionId: pq.id,
            questionText: fullQuestionText.trim(),
            index: index + 1,
            seq: index + 1,
            questionNumber: pq.questionNumber,
            referHeading: pq.referHeading,
            boldParts: pq.boldParts,
            images: pq.images
        });

        // Detailed logging
        const sectionLabel = pq.section ? `[${pq.section}]` : '';
        const refLabel = pq.referHeading ? `[Ref: ${pq.referHeading.substring(0, 30)}...]` : '';
        log(`   Q${index + 1} ${sectionLabel}${refLabel}: ${pq.questionText.substring(0, 50)}...`);
    });

    log(`\n✅ COMPLETE: ${parsed.instructions.length} instructions, ${questions.length} questions`);
    log(`   📊 Sections found: ${new Set(parsed.questions.map(q => q.section)).size}`);
    log(`   📋 Bold formatting preserved in ${parsed.questions.filter(q => q.boldParts.length > 0).length} questions`);
    log(`   🖼️  Images extracted: ${parsed.questions.reduce((sum, q) => sum + q.images.length, 0)}`);

    return {
        questions,
        detectedUnitCodes: [],
        instructions: parsed.instructions,
        redTextAnswers,
        title: parsed.title,
        titleFormatted: parsed.titleFormatted ? {
            text: parsed.titleFormatted.text,
            isBold: parsed.titleFormatted.isBold,
            isRed: parsed.titleFormatted.isRed,
            size: parsed.titleFormatted.size
        } : undefined
    };
}
