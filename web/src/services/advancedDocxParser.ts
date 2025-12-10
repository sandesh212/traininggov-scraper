import AdmZip from 'adm-zip';
import { StructuredDocxParser } from './structuredDocxParser';

/**
 * ADVANCED DOCX PARSER v2.0 - Extends the working StructuredDocxParser
 * 
 * Adds intelligence for:
 * - Dynamic section header detection (any format: Part 1, Section A, Module 1, etc.)
 * - "Refer to" sub-heading detection
 * - Bold preservation
 * - Better structure recognition
 * - Image extraction
 */

export interface ParsedQuestion {
    id: string;
    questionNumber: string;
    section: string;
    referHeading?: string;
    questionText: string;
    answerText: string;
    boldParts: string[];
    images: ImageData[];
    subQuestions?: ParsedQuestion[];
    parentQuestionId?: string;
}

export interface ImageData {
    name: string;
    data: string;
    position: 'question' | 'answer';
}

export interface DocumentHeading {
    text: string;
    isBold: boolean;
    isRed: boolean;
    size: number;
    position: 'start' | 'middle' | 'end';
}

export class AdvancedDocxParser extends StructuredDocxParser {
    private imageMap: Map<string, string> = new Map();
    private currentSection: string = 'General';

    /**
     * Main parse method with structure analysis - Enhanced to extract heading properly
     */
    parseDocument(buffer: Buffer): {
        title: string;
        titleFormatted: DocumentHeading | null;
        instructions: string[];
        questions: ParsedQuestion[];
    } {
        // Extract the document heading (bold, big, red text at start)
        const titleFormatted = this.extractDocumentHeading(buffer);

        // Get basic Q&A pairs from parent
        const pairs = this.parseStructuredQA(buffer);

        // Extract images
        const zip = new AdmZip(buffer);
        this.imageMap = this.extractImages(zip);
        const relsMap = this.extractRelationships(zip);

        // Analyze structure
        const { title, instructions, questions } = this.analyzeStructure(pairs, relsMap);

        return {
            title: titleFormatted?.text || title,
            titleFormatted,
            instructions,
            questions
        };
    }

    /**
     * Extract the main document heading - typically bold, large, red text at the start
     */
    private extractDocumentHeading(buffer: Buffer): DocumentHeading | null {
        const zip = new AdmZip(buffer);
        const documentXml = zip.readAsText('word/document.xml');

        // Parse first few paragraphs to find the heading
        const pRegex = /<w:p(?: [^>]*)?>([\s\S]*?)<\/w:p>/g;
        const paragraphs: string[] = [];
        let pMatch;
        let count = 0;

        // Get first 5 paragraphs
        while ((pMatch = pRegex.exec(documentXml)) !== null && count < 5) {
            paragraphs.push(pMatch[1]);
            count++;
        }

        // Analyze each paragraph for heading characteristics
        for (let i = 0; i < paragraphs.length; i++) {
            const pContent = paragraphs[i];

            // Extract text and formatting
            let text = '';
            let isBold = false;
            let isRed = false;
            let maxSize = 0;

            const rRegex = /<w:r(?: [^>]*)?>([\s\S]*?)<\/w:r>/g;
            let rMatch;

            while ((rMatch = rRegex.exec(pContent)) !== null) {
                const rContent = rMatch[1];

                // Check for bold
                if (/<w:b\/>/.test(rContent) || /<w:b\s+w:val="true"/.test(rContent)) {
                    isBold = true;
                }

                // Check for red color
                if (/<w:color\s+w:val="FF0000"/i.test(rContent) ||
                    /<w:color\s+w:val="ED1C24"/i.test(rContent) ||
                    /<w:color\s+w:val="C00000"/i.test(rContent) ||
                    /<w:color\s+w:val="E60000"/i.test(rContent)) {
                    isRed = true;
                }

                // Check font size
                const szMatch = /<w:sz\s+w:val="(\d+)"/.exec(rContent);
                if (szMatch) {
                    const size = parseInt(szMatch[1]) / 2; // Half-points to points
                    if (size > maxSize) maxSize = size;
                }

                // Extract text
                const tMatch = /<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/.exec(rContent);
                if (tMatch) {
                    text += tMatch[1];
                }
            }

            text = text.trim();

            // Check if this looks like a heading:
            // 1. Has substantial text (not just whitespace)
            // 2. Is bold OR large (>= 14pt) OR red
            // 3. Not too long (< 200 chars for a title)
            // 4. Appears in first 3 paragraphs
            if (text && text.length < 200 && i < 3) {
                const isLarge = maxSize >= 14;
                const looksLikeHeading = (isBold || isLarge || isRed) &&
                    !text.toLowerCase().includes('instruction') &&
                    !/^\d+\./.test(text); // Not a numbered item

                if (looksLikeHeading) {
                    return {
                        text,
                        isBold,
                        isRed,
                        size: maxSize,
                        position: i === 0 ? 'start' : 'middle'
                    };
                }
            }
        }

        return null;
    }

    /**
     * Analyze Q&A pairs to identify THREE distinct types:
     * 1. Red headings (paper titles, not answers)
     * 2. Black instructions (guidelines for assessors)
     * 3. Actual Q&A pairs (black question → red answer)
     */
    private analyzeStructure(pairs: Array<{ question: string; answer: string; isSubQuestion: boolean }>, relsMap: Map<string, string>): {
        title: string;
        instructions: string[];
        questions: ParsedQuestion[];
    } {
        const redHeadings: string[] = [];      // Red text that's a heading, not an answer
        const instructions: string[] = [];      // Black text instructions
        const questions: ParsedQuestion[] = [];

        let foundFirstQuestion = false;
        let questionCounter = 0;

        console.log(`\n🔍 Analyzing ${pairs.length} pairs for 3 distinct types...`);

        for (let i = 0; i < pairs.length; i++) {
            const pair = pairs[i];

            // Extract images
            const qResult = this.extractImagesFromText(pair.question.trim(), relsMap, 'question');
            const aResult = this.extractImagesFromText(pair.answer.trim(), relsMap, 'answer');

            let qText = qResult.text;
            const aText = aResult.text;
            const pairImages = [...qResult.images, ...aResult.images];

            console.log(`\n--- Pair ${i + 1} ---`);
            console.log(`Q: ${qText.substring(0, 100)}...`);
            console.log(`A: ${aText.substring(0, 100)}...`);

            // Skip empty pairs
            if (!aText) {
                console.log(`⚠️  Skipping - no answer`);
                continue;
            }

            // 0. SPLITTING CLUMPED CONTENT (Instructions + Question) - Only for the FIRST valid question found
            // Strategy A: Look for "Part X" or "Section X" headers. Everything before is instructions.
            // Strategy B: Look for first numbered question marker (fallback).
            // Strategy C (NEW): If we haven't found the first question yet, assume non-question blocks are instructions.

            if (!foundFirstQuestion) {
                // Check if this pair IS Question 1 (starts with "1." or "Q1")
                const isQ1 = /^(1[\.\)]|Q1|Question 1)[\s\t]/.test(qText.trim());

                if (isQ1) {
                    // We found Q1!
                    // Check if there is preamble text BEFORE "1."
                    const splitMatch = /^(1[\.\)]|Q1|Question 1)[\s\t]/.exec(qText.trim());
                    // If match is at index 0, clean start. If >0, split.
                    if (qText.trim().indexOf(splitMatch![0]) > 0) {
                        // This case handled by split logic below
                    } else {
                        foundFirstQuestion = true;
                        // Continue to process as normal Q&A
                    }
                } else {
                    // It is NOT Question 1.
                    // Does it look like a Section Header?
                    if (/^(Part|Section|Module)\s+\d+/i.test(qText)) {
                        // It's a header like "Part 1" - this usually SIGNALS the start of questions or section.
                        // But if it's "Part 1 - Instructions", it's instructions.
                        // Let's assume Part 1 starts the question block for now.
                    } else {
                        // It's not Q1, not a Header.
                        // It's very likely PURE INSTRUCTION.
                        console.log(`📋 Pre-Q1 Content detected as INSTRUCTION: "${qText.substring(0, 30)}..."`);

                        // Treat as instruction
                        if (qText.length < 100) instructions.push(qText.toUpperCase());
                        else instructions.push(qText);

                        if (aText && aText.length > 5) {
                            const lines = aText.split('\n').map(l => l.trim()).filter(l => l);
                            instructions.push(...lines);
                        }
                        continue; // Skip Q&A processing
                    }
                }

                // Check for Section Header (Part/Section) embedded in text
                // This is strongest signal that instructions ended and questions began
                // ... (rest of existing split logic)
                const sectionMatch = /(?:^|\n)((?:Part|Section|Module)\s+\d+.*)(?:\n|$)/i.exec(qText);

                if (sectionMatch) {
                    const splitIdx = sectionMatch.index;
                    const preamble = qText.substring(0, splitIdx).trim();
                    const headerAndRest = qText.substring(splitIdx).trim();

                    if (preamble.length > 0) {
                        console.log('✂️  Splitting Instructions from Question based on Section Header');
                        instructions.push(...preamble.split('\n').map(l => l.trim()).filter(l => l));
                        qText = headerAndRest;
                        // If we split, we likely found the start.
                        // Don't set foundFirstQuestion yet, let Q&A logic handle the rest.
                    }
                } else {
                    // Check for Numbered Question Split (Fallback)
                    const splitRegex = /(?:^|\n)\s*((?:\d+[\.\)]|Q\d+\.?|Question\s+\d+)[\t\s]+)/;
                    const match = splitRegex.exec(qText);

                    if (match) {
                        const matchIndex = match.index;
                        const splitPoint = qText.indexOf(match[1], matchIndex);

                        if (splitPoint > 0) {
                            const preamble = qText.substring(0, splitPoint).trim();
                            const realQuestion = qText.substring(splitPoint).trim();

                            // Only split if preamble DEFINITELY looks like instructions
                            if (this.isInstruction(preamble) || preamble.length > 50) {
                                console.log('✂️  Splitting Instructions from Question based on numbering');
                                instructions.push(...preamble.split('\n').map(l => l.trim()).filter(l => l));
                                qText = realQuestion;
                            }
                        }
                    }
                }
            }

            // === CLASSIFICATION LOGIC ===

            // 1. Check if this is a RED HEADING (title/paper heading in red text)
            // Red headings are typically short, bold, at the top, before instructions
            // Dynamic: Look for any short text at the beginning that's not an instruction
            const isRedHeading = !foundFirstQuestion &&
                aText.length < 100 &&
                qText.length < 150 &&  // Typically headings are short
                !this.isInstruction(qText) &&  // Not an instruction keyword
                !this.looksLikeQuestion(qText);  // Not a question

            if (isRedHeading) {
                console.log(`🔴 Detected as RED HEADING (paper title)`);
                redHeadings.push(qText);
                continue;  // Don't process as Q&A
            }

            // 2. Check if this is BLACK INSTRUCTION (guidelines for assessors)
            // Dynamic: Detect instruction patterns without hardcoded keywords
            const hasInstructionPattern = /instruct|guideline|note|please|must|should|ensure|complete|mark|assess|score|criteria|procedure/i.test(qText);
            const isInstructionTable = hasInstructionPattern && aText.length > 20 && aText.split('\n').length > 1;

            if (isInstructionTable) {
                console.log(`📋 Detected as INSTRUCTION BLOCK`);

                // Capture Q-text as potential heading if it's not just "Instructions"
                if (qText.length < 100 && !/^instructions/i.test(qText)) {
                    instructions.push(qText.toUpperCase()); // Emphasize heading
                }

                // The instructions are likely in the Answer text (right column)
                // Split by newlines or bullets
                const instLines = aText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                instructions.push(...instLines);
                continue;
            }

            // General instruction check
            // PRIORITY: If it matches instruction keywords, treat as instruction even if it has a number (e.g. "1. This marking sheet...")
            const isInstruction = !foundFirstQuestion && this.isInstruction(qText);

            if (isInstruction) {
                console.log(`📋 Detected as BLACK INSTRUCTION (guideline)`);
                // Format as heading if short, otherwise just text
                if (qText.length < 100) {
                    instructions.push(qText.toUpperCase());
                } else {
                    instructions.push(qText);
                }

                // Capture accompanying Answer text too (often the body of the instruction)
                if (aText && aText.length > 0) {
                    const lines = aText.split('\n').map(l => l.trim()).filter(l => l);
                    instructions.push(...lines);
                }
                continue;  // Don't process as Q&A
            }

            // 3. Check for Section Headers (Generic)
            // We look for a distinct header line at the start of the question block.
            // It could be "Part 1", "Section A", or just "Assessment Conditions".

            const qLines = qText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            if (qLines.length > 0) {
                const firstLine = qLines[0];

                // Heuristics for a header:
                // 1. Explicit: Starts with Part/Section/Module/Unit/Task
                // 2. Implicit: Not a question (no number, no question word/mark) AND short

                const isExplicitHeader = /^(Part|Section|Module|Unit|Task)\s+/i.test(firstLine);
                const isNumberedQuestion = /^\d+[\.)]/.test(firstLine);
                const isQuestionText = this.looksLikeQuestion(firstLine) || qResult.images.length > 0;

                // Case A: Header + Question (Split)
                // If we have multiple qLines, and the first line looks like a header
                if (qLines.length > 1 && (isExplicitHeader || (!isNumberedQuestion && !isQuestionText)) && firstLine.length < 100) {
                    this.currentSection = firstLine;
                    console.log(`📂 Section header (split): ${this.currentSection}`);

                    // Remove the header from qText
                    // We need to find where the first line ends in the original string to preserve subsequent formatting
                    // We use the original qText to find the split point
                    const splitIdx = qText.indexOf(firstLine) + firstLine.length;
                    qText = qText.substring(splitIdx).trim();

                    // If qText is now empty (shouldn't be if qLines.length > 1, but safe check)
                    if (!qText) continue;
                }
                // Case B: Just a Header (Standalone)
                // If it's just one line, looks like a header, and has no real answer
                else if (qLines.length === 1 && isExplicitHeader && (!aText || aText.length < 5)) {
                    this.currentSection = firstLine;
                    console.log(`📂 Section header (standalone): ${this.currentSection}`);
                    continue;
                }
                // Case C: Implicit Header (e.g. "Watchkeeping")
                // Short line, no answer, not a question, not numbered
                else if (qLines.length === 1 && firstLine.length < 50 && !isQuestionText && !isNumberedQuestion && (!aText || aText.length < 5)) {
                    // Avoid common labels
                    const isCommonLabel = /^(Note|Example|Hint|Tip|Warning|Caution):/i.test(firstLine);
                    if (!isCommonLabel) {
                        this.currentSection = firstLine;
                        console.log(`📂 Section header (implicit): ${this.currentSection}`);
                        continue;
                    }
                }
            }

            // 4. This is an actual Q&A PAIR - process it
            foundFirstQuestion = true;

            // Detect if it's a sub-question (a., b., i., ii.)
            // Logic: Starts with letter+paren/dot OR roman numeral+dot AND we have a previous question
            const isSubQ = questions.length > 0 && (/^[a-z][\)\.]/i.test(qText) || /^[ivx]+\./i.test(qText));

            let parentId: string | undefined;
            let qId: string;
            let qNum: string;

            if (isSubQ) {
                const parent = questions[questions.length - 1];
                // If the parent is also a sub-question, we might want to go up? 
                // For now, assume 1 level of nesting (Question -> SubQuestion)
                // If parent is sub-question, use ITS parent?
                // Let's keep it simple: attach to the last "main" question if possible, or just the immediate predecessor?
                // Usually sub-questions follow the main question immediately.

                // Check if predecessor is a main question or sub question
                const predecessor = questions[questions.length - 1];
                const mainParent = predecessor.parentQuestionId
                    ? questions.find(q => q.id === predecessor.parentQuestionId)
                    : predecessor;

                if (mainParent) {
                    parentId = mainParent.id;
                    qId = `${parentId}.${(mainParent.subQuestions?.length || 0) + 1}`;
                    qNum = qText.split(/[\)\.]/)[0];

                    console.log(`    ↳ Sub-question linked to ${parentId}`);
                } else {
                    // Fallback
                    questionCounter++;
                    qId = `Q${questionCounter}`;
                    qNum = String(questionCounter);
                }
            } else {
                questionCounter++;
                qId = `Q${questionCounter}`;

                // Extract question number
                const numberMatch = qText.match(/^(\d+)\./) || qText.match(/^(\d+)[a-z]\./);
                qNum = numberMatch ? numberMatch[1] : String(questionCounter);
            }

            console.log(`✓ Q&A PAIR ${qId} (Number: ${qNum})`);

            // Check for "Refer to" sub-heading
            let referHeading: string | undefined;
            let cleanQuestion = qText;
            const referMatch = /^(Refer to [^\n]+)\n(.+[\s\S]*)/i.exec(qText);
            if (referMatch) {
                referHeading = referMatch[1].trim();
                cleanQuestion = referMatch[2].trim();
                console.log(`  📎 Refer heading: ${referHeading}`);
            }

            // Detect bold parts (heuristic: short lines ending with ":")
            const boldParts: string[] = [];
            const lines = aText.split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.endsWith(':') && trimmed.length < 50 && trimmed.length > 3) {
                    boldParts.push(trimmed);
                }
            }

            if (boldParts.length > 0) {
                console.log(`  💪 Bold parts: ${boldParts.join(', ')}`);
            }

            const newQuestion: ParsedQuestion = {
                id: qId,
                questionNumber: qNum,
                section: this.currentSection || 'General',
                referHeading,
                questionText: cleanQuestion,
                answerText: aText,
                boldParts,
                images: pairImages,
                parentQuestionId: parentId,
                subQuestions: []
            };

            questions.push(newQuestion);

            // If it's a sub-question, also add it to the parent's subQuestions array
            if (parentId) {
                const parent = questions.find(q => q.id === parentId);
                if (parent) {
                    if (!parent.subQuestions) parent.subQuestions = [];
                    parent.subQuestions.push(newQuestion);
                }
            }

            console.log(`  📊 Section: ${this.currentSection || 'General'}`);
        }

        console.log(`\n✅ Analysis complete:`);
        console.log(`   🔴 Red Headings: ${redHeadings.length}`);
        console.log(`   📋 Instructions: ${instructions.length}`);
        console.log(`   ✅ Q&A Pairs: ${questions.length}`);

        // Combine red headings as a special instruction type
        const allInstructions = redHeadings.length > 0
            ? [...redHeadings, ...instructions]
            : instructions;

        // Use the first red heading as the title, or extract from document properties
        const title = redHeadings.length > 0 ? redHeadings[0] : 'Assessment Document';

        return {
            title,
            instructions: allInstructions,
            questions
        };
    }

    /**
     * Check if text looks like a question (has question markers)
     */
    private looksLikeQuestion(text: string): boolean {
        // Check for question numbering
        if (/^\d+\./.test(text)) return true;
        if (/^[a-z]\)/i.test(text)) return true;
        if (/^Part\s+\d+/i.test(text)) return true;

        // Check for question words (dynamic pattern matching)
        const questionWords = ['what', 'how', 'why', 'when', 'where', 'which', 'who', 'list', 'name', 'describe', 'explain', 'identify', 'state', 'define'];
        const lowerText = text.toLowerCase();
        if (questionWords.some(word => lowerText.includes(word))) return true;

        return false;
    }

    /**
     * Check if text is an instruction block (dynamic pattern detection)
     */
    private isInstruction(text: string): boolean {
        // Dynamic: Look for instruction patterns without hardcoded keywords
        const instructionPatterns = [
            /instruct/i,
            /guideline/i,
            /note\s*:/i,
            /please\s+(ensure|complete|mark|assess)/i,
            /must\s+(be|ensure|complete|refer)/i,
            /should\s+(be|ensure|complete)/i,
            /criteria/i,
            /procedure/i,
            /assessment\s+conditions/i,
            /reasonable\s+adjustment/i,
            /participant/i,
            /inherent\s+requirements/i,
            /marking\s+sheet/i,
            /model\s+answer/i,
            /satisfactory\s+response/i,
            /benchmark/i,
            /assessors?\s+must/i
        ];

        const hasInstructionPattern = instructionPatterns.some(pattern => pattern.test(text));
        const isLong = text.length > 200;
        const isNumbered = /^\d+\./.test(text);

        return hasInstructionPattern && isLong && !isNumbered;
    }

    /**
     * Extract relationships from document.xml.rels
     */
    private extractRelationships(zip: AdmZip): Map<string, string> {
        const relsMap = new Map<string, string>();
        const relsXml = zip.readAsText('word/_rels/document.xml.rels');
        if (!relsXml) return relsMap;

        const relRegex = /<Relationship Id="([^"]+)" Type="[^"]+" Target="([^"]+)"/g;
        let match;
        while ((match = relRegex.exec(relsXml)) !== null) {
            relsMap.set(match[1], match[2]);
        }
        return relsMap;
    }

    /**
     * Extract images from text using placeholders
     */
    private extractImagesFromText(text: string, relsMap: Map<string, string>, position: 'question' | 'answer'): { text: string, images: ImageData[] } {
        const images: ImageData[] = [];
        const imgRegex = /{{IMAGE:([^}]+)}}/g;

        const cleanText = text.replace(imgRegex, (match, rId) => {
            const target = relsMap.get(rId);
            if (target) {
                // Target is usually "media/image1.png"
                // Zip entry is "word/media/..."
                const zipPath = `word/${target}`;
                const imageData = this.imageMap.get(zipPath);

                if (imageData) {
                    images.push({
                        name: target,
                        data: imageData,
                        position
                    });
                    return ' ';
                }
            }
            return '';
        });

        return { text: cleanText, images };
    }

    /**
     * Extract images from DOCX
     */
    private extractImages(zip: AdmZip): Map<string, string> {
        const images = new Map<string, string>();
        const entries = zip.getEntries();

        for (const entry of entries) {
            if (entry.entryName.startsWith('word/media/')) {
                const imageData = entry.getData();
                const base64 = imageData.toString('base64');
                const ext = entry.entryName.split('.').pop()?.toLowerCase() || 'png';
                const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
                const dataUrl = `data:${mimeType};base64,${base64}`;

                images.set(entry.entryName, dataUrl);
            }
        }

        return images;
    }
}
