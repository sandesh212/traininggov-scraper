import { AssessmentQuestion } from '../models/types';
import AdmZip from 'adm-zip';
import * as cheerio from 'cheerio';

const log = (...args: any[]) => {
    console.log(...args);
};

/**
 * Extract questions and answers from DOCX using Generic Color-Based Logic
 * 
 * Rules:
 * - Black Text = Question
 * - Red Text (following Black) = Answer
 * - Red Text (before Black) = Heading/Context/Instruction
 */
export async function extractQuestionsFromDocx(fileBuffer: Buffer): Promise<{
    questions: AssessmentQuestion[],
    detectedUnitCodes: string[],
    instructions: string[],
    redTextAnswers?: any[],
    title?: string,
    titleFormatted?: { text: string; isBold: boolean; isRed: boolean; size: number; }
}> {
    log('\n📄 Starting GENERIC DOCX extraction (Color-Based)...');

    const zip = new AdmZip(fileBuffer);
    const docXml = zip.readAsText('word/document.xml');

    if (!docXml) {
        throw new Error("Could not read document.xml from DOCX");
    }

    const $ = cheerio.load(docXml, { xmlMode: true });

    const questions: AssessmentQuestion[] = [];
    const instructions: string[] = [];
    let title: string | undefined;

    // State Machine
    let state: 'WAITING' | 'QUESTION' | 'ANSWER' = 'WAITING';
    let currentQuestionText = '';
    let currentAnswerText = '';
    let currentSection = 'General';
    let questionCounter = 0;

    // Helper to determine if a run is red
    const isRedColor = (colorVal: string | undefined): boolean => {
        if (!colorVal) return false;
        // Standard red variations
        const reds = ['FF0000', 'C00000', 'red', 'darkRed', 'C0504D', 'ED1C24', 'E60000'];
        return reds.includes(colorVal) || colorVal.startsWith('FF00') || colorVal.startsWith('C000');
    };

    // Helper to determine if a run is black (or auto/default)
    const isBlackColor = (colorVal: string | undefined): boolean => {
        if (!colorVal || colorVal === 'auto' || colorVal === '000000') return true;
        return false;
    };

    const paragraphs = $('w\\:p').toArray();

    for (const p of paragraphs) {
        const $p = $(p);
        const runs = $p.find('w\\:r').toArray();

        let paragraphText = '';
        let paragraphIsRed = true; // Assume red until blue/black found
        let paragraphIsBlack = true; // Assume black until red found (logic mix, handled per run below)

        // We iterate runs to handle inline color changes, but also need to handle paragraph breaks

        for (const r of runs) {
            const $r = $(r);
            const text = $r.find('w\\:t').text();
            if (!text) continue;

            const colorVal = $r.find('w\\:rPr > w\\:color').attr('w:val');
            const isRed = isRedColor(colorVal);
            const isBlack = isBlackColor(colorVal);

            const cleanText = text.replace(/[\r\n]+/g, '');
            if (!cleanText) continue;

            // STATE TRANSITIONS
            if (state === 'WAITING') {
                if (isRed) {
                    // Red text at start -> Instruction or Heading
                    // If it's the very first significant red text, it's likely the Title
                    if (!title) {
                        title = cleanText.trim();
                    } else {
                        instructions.push(cleanText.trim());
                    }
                } else if (isBlack && cleanText.trim().length > 0) {
                    // First Black text -> Start Question
                    state = 'QUESTION';
                    currentQuestionText = cleanText;
                    currentAnswerText = '';
                }
            }
            else if (state === 'QUESTION') {
                if (isRed) {
                    // Switch to Answer
                    state = 'ANSWER';
                    currentAnswerText = cleanText;
                } else {
                    // Continue Question
                    currentQuestionText += cleanText;
                }
            }
            else if (state === 'ANSWER') {
                if (isBlack && cleanText.trim().length > 0) {
                    // Switch to New Question -> Save previous
                    saveQuestion(questions, currentQuestionText, currentAnswerText, currentSection, ++questionCounter);

                    state = 'QUESTION';
                    currentQuestionText = cleanText;
                    currentAnswerText = '';
                } else if (isRed) {
                    // Continue Answer
                    currentAnswerText += cleanText;
                }
            }
        }

        // Handle Paragraph End (newlines)
        if (state === 'QUESTION') currentQuestionText += '\n';
        if (state === 'ANSWER') currentAnswerText += '\n';
    }

    // Final flush
    if ((state as string) === 'ANSWER' && currentQuestionText.trim()) {
        saveQuestion(questions, currentQuestionText, currentAnswerText, currentSection, ++questionCounter);
    }

    log(`✅ Generic Extraction Complete: ${questions.length} questions found.`);

    return {
        questions,
        detectedUnitCodes: [], // Can implement regex search if needed
        instructions,
        redTextAnswers: [], // Deprecated/merged into questions
        title,
        titleFormatted: title ? { text: title, isBold: true, isRed: true, size: 14 } : undefined
    };
}

function saveQuestion(list: AssessmentQuestion[], q: string, a: string, section: string, index: number) {
    const cleanQ = q.trim();
    if (!cleanQ || cleanQ.length < 2) return;

    // Id Strategy: Try to extract actual numbering, else use counter
    const idMatch = cleanQ.match(/^((?:Q|Question)?\s*\d+(?:\.\d+)*|[a-z])[\.\)\:]/i);
    let id = `Q${index}`;
    let finalQ = cleanQ;

    if (idMatch) {
        // Keep the ID in the text for context, or strip it? 
        // Usually better to have clean text, but ID is useful.
        // Let's use the found number as ID.
        id = idMatch[1].replace(/[^\w\.]/g, '');
    }

    list.push({
        id: id,
        text: finalQ,
        section: section,
        _answer: a.trim() // Using internal _answer field
    });
}
