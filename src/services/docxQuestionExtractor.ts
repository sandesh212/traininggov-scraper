import { AssessmentQuestion } from '../models/types.js';
import * as cheerio from "cheerio";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";

// Production mode - reduces console output
const PRODUCTION_MODE = process.env.PRODUCTION_MODE === 'true';
const log = (...args: any[]) => !PRODUCTION_MODE && console.log(...args);

const execAsync = promisify(exec);

/**
 * Extracts questions from a .docx file using a robust, color-based, content-agnostic approach.
 * Instead of relying on specific keywords or patterns, this strictly uses formatting:
 * - Black Text = Question
 * - Red Text (following Black) = Answer
 * - Red Text (before Black) = Heading/Context (Ignored)
 * 
 * This uses direct XML parsing of the extraction to reliably detect colors, 
 * which libraries like Mammoth often discard.
 */
export async function extractQuestionsFromDocx(filePath: string): Promise<AssessmentQuestion[]> {
    log(`\n🚀 Starting Generic Extraction for: ${path.basename(filePath)}`);

    // 1. Unzip the DOCX to a temporary directory
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docx-extract-'));
    try {
        log(`   📂 Unzipping to temp dir: ${tempDir}`);

        // Escape the file path for safety in the shell command
        const safeFilePath = `"${filePath}"`;

        try {
            // Using system unzip (standard on Mac/Linux)
            await execAsync(`unzip -o -q ${safeFilePath} -d "${tempDir}"`);
        } catch (e) {
            console.error("Error unzipping file. Ensure 'unzip' is installed.", e);
            throw new Error(`Failed to unzip DOCX file: ${e}`);
        }

        // 2. Read the main document XML
        const docXmlPath = path.join(tempDir, 'word', 'document.xml');
        const xmlContent = await fs.readFile(docXmlPath, 'utf-8');

        // 3. Parse XML with Cheerio
        const $ = cheerio.load(xmlContent, { xmlMode: true });

        const questions: AssessmentQuestion[] = [];

        // State Machine Variables
        let state: 'WAITING' | 'QUESTION' | 'ANSWER' = 'WAITING';
        let currentQuestionText = '';
        let currentAnswerText = '';
        let currentSection = 'General';

        // Helper to determine if a run is red
        const isRedColor = (colorVal: string | undefined): boolean => {
            if (!colorVal) return false;
            // Standard red variations (add more if needed)
            const reds = ['FF0000', 'C00000', 'red', 'darkRed', 'C0504D'];
            return reds.includes(colorVal) || colorVal.startsWith('FF00') || colorVal.startsWith('C000');
        };

        // Helper to determine if a run is black (or auto/default)
        const isBlackColor = (colorVal: string | undefined): boolean => {
            if (!colorVal || colorVal === 'auto' || colorVal === '000000') return true;
            return false;
        };

        // Iterate through all Paragraphs
        const paragraphs = $('w\\:p').toArray();
        for (const p of paragraphs) {
            const $p = $(p);
            // Check for images in this paragraph
            const images: string[] = []; // (Image extraction would require mapping relationships, skipping for generic text pass for now)

            // Within each paragraph, iterate through Runs
            const runs = $p.find('w\\:r').toArray();
            for (const r of runs) {
                const $r = $(r);
                const text = $r.find('w\\:t').text(); // No trim yet, preserve structure

                if (!text) continue;

                // Determine Format
                const colorVal = $r.find('w\\:rPr > w\\:color').attr('w:val');
                const isRed = isRedColor(colorVal);
                const isBlack = isBlackColor(colorVal); // If it's not red, assume potential question text if black/auto

                const cleanText = text.replace(/[\r\n]+/g, '');
                if (!cleanText.trim()) continue; // Skip whitespace-only runs

                // STATE MACHINE LOGIC

                if (state === 'WAITING') {
                    if (isRed) {
                        // Red text while waiting -> Heading or Instruction.
                        if (cleanText.length < 50) {
                            // currentSection = cleanText.trim(); 
                        }
                        continue;
                    }

                    if (isBlack) {
                        // FIRST BLACK TEXT -> Start of a Question
                        state = 'QUESTION';
                        currentQuestionText = cleanText;
                        currentAnswerText = '';
                    }
                }

                else if (state === 'QUESTION') {
                    if (isRed) {
                        // Red text detected -> Switch to Answer
                        state = 'ANSWER';
                        currentAnswerText = cleanText;
                    } else {
                        // Continuing Black text
                        currentQuestionText += cleanText;
                    }
                }

                else if (state === 'ANSWER') {
                    if (isBlack) {
                        // Black text detected -> End of previous Answer, Start of NEW Question

                        // 1. Save Previous Pair
                        saveQuestion(questions, currentQuestionText, currentAnswerText, currentSection);

                        // 2. Start New Question
                        state = 'QUESTION';
                        currentQuestionText = cleanText;
                        currentAnswerText = '';
                    } else if (isRed) {
                        // Continuing Red text
                        currentAnswerText += cleanText;
                    }
                }
            }

            // Handle Paragraph Breaks (newlines)
            if (state === 'QUESTION') currentQuestionText += '\n';
            if (state === 'ANSWER') currentAnswerText += '\n';
        }

        // End of Document: Save any pending question/answer pair
        if ((state as string) === 'ANSWER' && currentQuestionText.trim()) {
            saveQuestion(questions, currentQuestionText, currentAnswerText, currentSection);
        } else if (state === 'QUESTION' && currentQuestionText.trim()) {
            // A question at the very end with no answer?
            // saveQuestion(questions, currentQuestionText, '', currentSection);
            // Optionally save it as Unanswered
        }

        log(`\n   📊 Total questions identified: ${questions.length}`);
        return questions;

    } catch (error) {
        log("Error in generic extraction:", error);
        throw error;
    } finally {
        // Cleanup temp dir
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch (e) { /* ignore */ }
    }
}

/**
 * Helper to validate and save a question
 */
function saveQuestion(
    list: AssessmentQuestion[],
    qText: string,
    aText: string,
    section: string
) {
    const cleanQ = qText.trim();
    const cleanA = aText.trim();

    if (!cleanQ || cleanQ.length < 3) return; // Too short

    // Extract ID if present (e.g. "1. What..." -> ID: "1")
    // Generic matcher: Start of string, alphanumeric + punct
    const idMatch = cleanQ.match(/^([a-zA-Z0-9]+[\.\)\:])\s/);
    let id = `Q${list.length + 1}`;
    let finalQ = cleanQ;

    if (idMatch) {
        id = idMatch[1].replace(/[\.\)\:]/g, ''); // Remove punctuation for clean ID
        finalQ = cleanQ.substring(idMatch[0].length).trim();
    } else {
        // If no explicit ID, try to clean "Q1" style
        const qPrefixMatch = cleanQ.match(/^(Q\d+|Question\s+\d+)[\.\)\:\s]/i);
        if (qPrefixMatch) {
            id = qPrefixMatch[1].replace(/Question\s+/i, 'Q');
            finalQ = cleanQ.substring(qPrefixMatch[0].length).trim();
        }
    }

    // Final deduplication check
    // Normalize: lowercase, remove non-alphanumeric
    const normalizedQ = finalQ.toLowerCase().replace(/[^\w]/g, '');
    const isDuplicate = list.some(item =>
        item.text.toLowerCase().replace(/[^\w]/g, '') === normalizedQ
    );

    if (isDuplicate) {
        log(`   ⚠️ Skipping duplicate: ${id} - ${finalQ.substring(0, 30)}...`);
        return;
    }

    list.push({
        id: id,
        text: finalQ,
        answer: cleanA || undefined, // Add answer to the type if it exists in interface, otherwise it might be ignored or need extending
        section: section
    });

    // Note: The 'AssessmentQuestion' interface in 'types.js' might need to actually support 'answer'.
    // If not, we are just extracting it.

    log(`   ✅ Parsed: [${id}] ${finalQ.substring(0, 40)}... \n       Answer: ${cleanA.substring(0, 40)}...`);
}

