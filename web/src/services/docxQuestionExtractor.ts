import mammoth from "mammoth";
import * as cheerio from "cheerio";
import { AssessmentQuestion } from '../models/types';

// Production mode - reduces console output
const PRODUCTION_MODE = process.env.PRODUCTION_MODE === 'true';
const log = (...args: any[]) => !PRODUCTION_MODE && console.log(...args);

/**
 * Extracts questions from a .docx file using robust HTML parsing with Cheerio.
 * Handles complex layouts, tables, images, and varying formats.
 * Improved to separate questions from answers and avoid duplicates.
 * Also detects Unit Codes for auto-scoping.
 * @param input - DOCX file buffer or path
 * @param redTextSegments - Array of red text segments to exclude from questions
 */
export async function extractQuestionsFromDocx(
    input: string | Buffer,
    redTextSegments: string[] = []
): Promise<{ questions: AssessmentQuestion[], detectedUnitCodes: string[], instructions: string[] }> {
    // Helper to check if text contains red text
    const containsRedText = (text: string): boolean => {
        if (!text || redTextSegments.length === 0) return false;

        const normalizedText = text.toLowerCase().replace(/[\s\W_]+/g, '');

        for (const segment of redTextSegments) {
            const normalizedSegment = segment.toLowerCase().replace(/[\s\W_]+/g, '');
            if (normalizedSegment.length > 10 && normalizedText.includes(normalizedSegment)) {
                return true;
            }
        }
        return false;
    };

    // Helper to remove red text from a string
    const removeRedText = (text: string): string => {
        if (!text || redTextSegments.length === 0) return text;

        let cleanText = text;
        const normalizedClean = cleanText.toLowerCase().replace(/[\s\W_]+/g, '');

        for (const segment of redTextSegments) {
            const normalizedSegment = segment.toLowerCase().replace(/[\s\W_]+/g, '');

            if (normalizedSegment.length > 10 && normalizedClean.includes(normalizedSegment)) {
                // Find position in normalized text
                const answerStartIndex = normalizedClean.indexOf(normalizedSegment);

                // Map back to original position
                let charCount = 0;
                let originalIndex = 0;

                for (let i = 0; i < cleanText.length && charCount < answerStartIndex; i++) {
                    if (cleanText[i].match(/[a-z0-9]/i)) {
                        charCount++;
                    }
                    originalIndex = i + 1;
                }

                cleanText = cleanText.substring(0, originalIndex).trim();
                break; // Only remove first match
            }
        }

        return cleanText;
    };

    // 1. Convert DOCX to HTML with embedded images
    const options = {
        convertImage: (mammoth.images as any).inline(function (element: any) {
            return element.read("base64").then((imageBuffer: any) => {
                return { src: `data:${element.contentType};base64,${imageBuffer}` };
            });
        })
    };

    let result;
    if (Buffer.isBuffer(input)) {
        result = await mammoth.convertToHtml({ buffer: input }, options);
    } else {
        result = await mammoth.convertToHtml({ path: input as string }, options);
    }

    const { value: html } = result;

    // 2. Load into Cheerio
    const $ = cheerio.load(html);
    const questions: AssessmentQuestion[] = [];

    let currentSection = "General";

    // Track seen question text to avoid duplicates (normalized)
    const seenQuestions = new Set<string>();
    const instructions: string[] = [];
    const seenInstructionTexts = new Set<string>(); // Track normalized instruction text

    // 3. Traverse paragraphs and list items (more targeted than all elements)
    $('p, li, tr').each((i, elem) => {
        const $el = $(elem);
        const text = $el.text().trim();

        // Skip empty or very short text
        if (!text || text.length < 5) return;

        // A. Detect Section Headers
        let tagName = '';
        if (elem.type === 'tag' && typeof elem.name === 'string') {
            tagName = elem.name.toLowerCase();
        }
        const isBold = $el.find('strong, b').length > 0 || $el.is('strong, b');
        const isHeader = tagName && ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName);

        // Improved Section Detection: Catch "Part 1", "Section A", etc.
        const sectionMatch = text.match(/^(?:Part|Section|Module)\s+(?:\d+|[A-Z])(?:\s|$)/i);

        if ((isHeader || (isBold && text.length < 100) || (sectionMatch && text.length < 50))) {
            if (text.match(/^(PART|SECTION|MODULE|UNIT|KNOWLEDGE|PRACTICAL|ASSESSMENT)\s/i) || sectionMatch) {
                currentSection = text.trim();
                log(`   📂 Section detected: ${currentSection}`);
                return;
            }
        }

        // Check for Instruction/Marking Guide noise to skip
        const instructionPhrases = [
            "Instructions for marking",
            "answers within this marking sheet",
            "Listed below are the questions",
            "Assessors must refer",
            "course participant is not expected",
            "Reasonable Adjustment",
            "purpose of reasonable adjustment",
            "Inherent requirements",
            "Assessors may accept variations",
            "Assessors must ensure",
            "Revision Date",
            "Next Review",
            "RTO Code",
            "NovaCore CMS"
        ];

        const isInstruction = instructionPhrases.some(phrase => text.includes(phrase));
        if (isInstruction) {
            // Aggressive normalization for deduplication
            const normalizedText = text
                .toLowerCase()
                .replace(/\s+/g, ' ')
                .replace(/[^\w\s]/g, '')
                .trim();

            // Check if we already have this exact instruction
            let isDuplicate = false;
            for (const existingNorm of seenInstructionTexts) {
                // Check if very similar (90% match)
                const longer = normalizedText.length > existingNorm.length ? normalizedText : existingNorm;
                const shorter = normalizedText.length > existingNorm.length ? existingNorm : normalizedText;

                // If one contains most of the other, it's a duplicate
                if (longer.includes(shorter) ||
                    (normalizedText === existingNorm) ||
                    (normalizedText.length > 20 && existingNorm.length > 20 &&
                        (normalizedText.substring(0, 50) === existingNorm.substring(0, 50)))) {
                    isDuplicate = true;
                    break;
                }
            }

            if (!isDuplicate) {
                seenInstructionTexts.add(normalizedText);
                const htmlContent = $.html(elem);
                instructions.push(htmlContent);
                log(`   📋 Captured instruction: ${text.substring(0, 50)}...`);
            } else {
                log(`   ⏭️  Skipping duplicate instruction: ${text.substring(0, 50)}...`);
            }
            return;
        }

        // Pattern 4: Table row with ID in first cell
        let tableQuestion: { id: string, text: string } | null = null;
        if ($el.is('tr')) {
            const cells = $el.find('td, th');
            if (cells.length >= 2) {
                const c1 = $(cells[0]).text().trim();
                const c2 = $(cells[1]).text().trim();
                if (c1.match(/^(\d+|[a-z])[\.\ )\:]?$/i) && c2.length > 10) {
                    tableQuestion = {
                        id: c1.replace(/[^\w]/g, ''),
                        text: c2
                    };
                }
            }
        }

        // Check for "Hidden Questions" merged in the same block
        const splitPattern = /(?:^|\s+)(\d+[\.\)]\s+[A-Z])/g;
        let match;
        const splitIndices: number[] = [];

        while ((match = splitPattern.exec(text)) !== null) {
            if (match.index === 0 && splitIndices.length === 0) continue;
            splitIndices.push(match.index);
        }

        let textParts: string[] = [];
        if (splitIndices.length > 0) {
            let lastIndex = 0;
            splitIndices.forEach(idx => {
                const matchStr = text.substring(idx);
                const numberStart = matchStr.search(/\d/);
                const splitPoint = idx + numberStart;

                textParts.push(text.substring(lastIndex, splitPoint).trim());
                lastIndex = splitPoint;
            });
            textParts.push(text.substring(lastIndex).trim());
        } else {
            textParts = [text];
        }

        // Process each part as a separate entity
        textParts.forEach(partText => {
            if (!partText || partText.length < 2) return;

            // Re-evaluate regexes for this part
            const partNumberedMatch = partText.match(/^(?:Q(?:uestion)?\s*)?(\d+(?:\.\d+)*|[a-z])(?:\)|\.|:)?\s+(.*)/i);
            const partQuestionWordMatch = partText.match(/^(Which|What|Who|Where|When|Why|How|List|Describe|Explain|Identify|Define|Calculate|Match|Select|Name|State|Give|Provide)\s+(.+?)(?:\?|\.)?$/i);
            const partEndsWithQuestion = partText.endsWith('?');

            let pQuestionId = null;
            let pQuestionText = null;
            let pIsNewQuestion = false;

            if (tableQuestion && textParts.length === 1) {
                pQuestionId = tableQuestion.id;
                pQuestionText = tableQuestion.text;
                pIsNewQuestion = true;
            } else if (partNumberedMatch && partNumberedMatch[2].length > 5) {
                const idPart = partNumberedMatch[1];
                const contentPart = partNumberedMatch[2];
                const isLetter = /^[a-z]$/i.test(idPart);
                if (isLetter && questions.length > 0) {
                    pIsNewQuestion = false;
                } else {
                    pQuestionId = idPart.replace(/[^\w]/g, '');
                    pQuestionText = contentPart;
                    pIsNewQuestion = true;
                }
            } else if ((partQuestionWordMatch || partEndsWithQuestion) && partText.length > 10) {
                pQuestionId = `Q${questions.length + 1}`;
                pQuestionText = partText;
                pIsNewQuestion = true;
            } else if (questions.length > 0 && partText.length > 15) {
                // AGGRESSIVE new question detection - default to new question unless clearly a continuation
                const isClearlyContinuation =
                    partText.length < 15 ||
                    partText.match(/^(Yes|No|True|False|N\/?A|None|Correct|Incorrect|One|Two|Three|Four|Five)$/i) ||
                    partText.match(/^\d+\s*(kg|m|cm|mm|L|mL|%|degrees?|hours?|minutes?)$/i) ||
                    partText.match(/^[•\-\*]\s+/) ||
                    partText.match(/^\([a-z0-9ivxlcdm]+\)/i) || // (a), (1), (i)
                    partText.match(/^[a-z0-9ivxlcdm]+\)/i) || // a), 1), i)
                    partText.match(/^[a-z](\s|$)/) || // Starts with single lowercase letter
                    partText.match(/^(and|or|but|also|additionally|furthermore|moreover|however|therefore|thus)/i) ||
                    partText.match(/^\s+/) ||
                    partText.match(/^(including|such as|for example|e\.g\.|i\.e\.)/i);

                if (!isClearlyContinuation) {
                    pQuestionId = `Q${questions.length + 1}`;
                    pQuestionText = partText;
                    pIsNewQuestion = true;
                    log(`   🔍 Treating text as new question: ${partText.substring(0, 40)}...`);
                }
            }

            if (pIsNewQuestion && pQuestionId && pQuestionText) {
                // Detect Mapping Hint
                let mappingHint: string | undefined = undefined;
                const hintMatch = pQuestionText.match(/([A-Z0-9]{3,4}-(?:PC|K|P|Element)[\d\.\,\s\:]+)$/i);
                if (hintMatch) {
                    mappingHint = hintMatch[1].trim();
                    pQuestionText = pQuestionText.substring(0, hintMatch.index).trim();
                }

                const doubleNumbering = pQuestionText.match(/^(\d+|[a-z])[\.\)\:]\s+(.*)/);
                if (doubleNumbering) {
                    pQuestionText = doubleNumbering[2];
                }

                const normalizedText = pQuestionText.toLowerCase().replace(/[^\w\s]/g, '').trim();

                // Deduplication
                let isDuplicate = false;
                let replaceIndex = -1;

                for (let i = 0; i < questions.length; i++) {
                    const existingQ = questions[i];
                    const existingNorm = existingQ.text.toLowerCase().replace(/[^\w\s]/g, '').trim();

                    // Check for exact duplicate
                    if (normalizedText === existingNorm) {
                        isDuplicate = true;
                        log(`   ⏭️  Skipping exact duplicate: ${pQuestionText.substring(0, 40)}...`);
                        break;
                    }

                    // Check if new question contains existing (longer version)
                    if (normalizedText.includes(existingNorm) && normalizedText.length > existingNorm.length + 10) {
                        replaceIndex = i;
                        break;
                    }

                    // Check if existing contains new (new is subset)
                    if (existingNorm.includes(normalizedText)) {
                        isDuplicate = true;
                        break;
                    }
                }

                if (isDuplicate) return;

                const sectionPrefix = currentSection.replace(/[^\w\s-]/g, '').trim();
                const uniqueId = `${sectionPrefix} - ${pQuestionId}`;

                const images: string[] = [];
                if (textParts.length === 1) {
                    $el.find('img').each((_, img) => {
                        const src = $(img).attr('src');
                        if (src) images.push(src);
                    });
                }

                pQuestionText = pQuestionText.replace(/\s+/g, ' ').trim();

                // Remove any red text that might have been included
                pQuestionText = removeRedText(pQuestionText);

                const newQuestion = {
                    id: uniqueId,
                    text: pQuestionText,
                    section: currentSection,
                    images: images.length > 0 ? images : undefined,
                    mappingHint
                };

                if (replaceIndex !== -1) {
                    questions[replaceIndex] = newQuestion;
                    log(`   🔄 Replaced Q${replaceIndex + 1} with longer version`);
                } else {
                    questions.push(newQuestion);
                    log(`   ✓ Extracted Q${questions.length}: ${uniqueId}`);
                }
            } else {
                // Append to previous
                if (questions.length > 0) {
                    const lastQ = questions[questions.length - 1];

                    // Deduplication: Check if text is already in the question
                    const normText = partText.toLowerCase().replace(/\s+/g, ' ').trim();
                    const normLastQ = lastQ.text.toLowerCase().replace(/\s+/g, ' ').trim();

                    if (partText.length > 3 && (normLastQ.includes(normText) || normLastQ.endsWith(normText))) {
                        log(`   Skipping duplicate text append: ${partText.substring(0, 20)}...`);
                        return;
                    }

                    lastQ.text += `\n${partText}`;

                    if (textParts.length === 1) {
                        $el.find('img').each((_, img) => {
                            const src = $(img).attr('src');
                            if (src) {
                                if (!lastQ.images) lastQ.images = [];
                                lastQ.images.push(src);
                            }
                        });
                    }

                    const hintMatch = partText.match(/([A-Z0-9]{3,4}-(?:PC|K|P|Element)[\d\.\,\s\:]+)$/i);
                    if (hintMatch && !lastQ.mappingHint) {
                        lastQ.mappingHint = hintMatch[1].trim();
                    }
                }
            }
        });
    });

    // 4. Detect Unit Codes in the document (for auto-scoping)
    const fullText = $.root().text();
    const unitCodeRegex = /\b([A-Z]{3,4}[0-9]{3,4}[A-Z]?)\b/g;
    const matches = fullText.match(unitCodeRegex) || [];
    const detectedUnitCodes = Array.from(new Set(matches));

    log(`\n   📊 Total questions extracted: ${questions.length}`);
    log(`   🔍 Detected Unit Codes: ${detectedUnitCodes.join(', ')}`);

    return { questions, detectedUnitCodes, instructions };
}
