import { NextRequest, NextResponse } from 'next/server';
import { extractQuestionsFromDocx } from '@/services/docxQuestionExtractor';
import { LocalAgent } from '@/services/localAgent';
import { UocLoader } from '@/services/uocLoader';
import * as XLSX from 'xlsx';
import { ScraperService } from '@/services/scraperService';
import { AIService } from '@/services/aiService';
import { Unit } from '@/types';
import { RedTextExtractor } from '@/services/redTextExtractor';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const assessmentFile = formData.get('assessmentFile') as File;
        const unitsFile = formData.get('unitsFile') as File;
        const ignoreInvalid = formData.get('ignoreInvalid') === 'true';
        const saveToDatabase = formData.get('saveToDatabase') !== 'false'; // Default true for backwards compatibility

        if (!assessmentFile) {
            return NextResponse.json({ error: 'No assessment file provided' }, { status: 400 });
        }

        console.log(`📂 Processing Assessment File: ${assessmentFile.name} (${assessmentFile.size} bytes)`);

        // 1. Load Units
        const loader = new UocLoader('data/uoc.jsonl');

        try {
            await loader.load();
        } catch (error) {
            console.error("Failed to load UoC data:", error);
            return NextResponse.json({ error: 'Failed to load Unit of Competency database.' }, { status: 500 });
        }

        let units = loader.getAllUnits();
        console.log(`   ✅ Loaded ${units.length} units from database`);

        // 3. Extract Questions & Detect Units
        const arrayBuffer = await assessmentFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // --- NEW: Parse Structured Q&A Pairs (black→red pattern) ---
        console.log("   📋 Analyzing document structure for sub-questions...");
        const { StructuredDocxParser } = await import('@/services/structuredDocxParser');
        const structuredParser = new StructuredDocxParser();
        const structuredPairs = structuredParser.parseStructuredQA(buffer);
        console.log(`   ✅ Found ${structuredPairs.length} structured Q&A pairs.`);

        // --- NEW: Extract Red Text ---
        console.log("   🔴 Extracting red text segments...");
        const redExtractor = new RedTextExtractor();
        const redTextSegments = redExtractor.extractRedText(buffer);
        console.log(`   ✅ Found ${redTextSegments.length} red text segments.`);

        console.log("   🔍 Extracting questions and detecting units...");
        const { questions, detectedUnitCodes, instructions } = await extractQuestionsFromDocx(buffer, redTextSegments);
        console.log(`   ✅ Extracted ${questions.length} questions.`);

        // --- NEW: Merge Structured Pairs into Questions ---
        console.log("   🔗 Integrating structured sub-questions...");
        const enhancedQuestions = integrateStructuredPairs(questions, structuredPairs);
        console.log(`   ✅ Enhanced to ${enhancedQuestions.length} questions (including sub-questions).`);

        // --- NEW: Merge Red Text Answers ---
        console.log("   🔗 Merging Red Text segments into questions...");
        const questionsWithAnswers = mergeRedTextAnswers(enhancedQuestions, redTextSegments);
        const questionsValidated = ensureAnswers(questionsWithAnswers, redTextSegments);

        console.log(`   ✅ Detected ${detectedUnitCodes.length} unit codes in document: ${detectedUnitCodes.join(', ')}`);

        if (questionsWithAnswers.length === 0) {
            return NextResponse.json({ error: 'No questions found in the document. Please check the file format.' }, { status: 400 });
        }

        // 4. Apply Scoping & Scraping
        let unitsToAnalyze: Unit[] = units; // Default to all loaded units
        let scopedCodes: string[] = [];

        if (unitsFile) {
            try {
                console.log(`   📂 Processing Units Scope File: ${unitsFile.name}`);
                const buffer = await unitsFile.arrayBuffer();
                const workbook = XLSX.read(buffer);
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];

                const unitCodeRegex = /^[A-Z]{3,4}[0-9]{3,4}[A-Z]?$/;
                const extractedCodes = new Set<string>();

                data.forEach(row => {
                    row.forEach(cell => {
                        if (typeof cell === 'string') {
                            const trimmed = cell.trim();
                            if (unitCodeRegex.test(trimmed)) {
                                extractedCodes.add(trimmed);
                            }
                        }
                    });
                });
                scopedCodes = Array.from(extractedCodes);
            } catch (e) {
                console.error("   ❌ Error parsing units file:", e);
            }
        } else if (detectedUnitCodes.length > 0) {
            console.log("   🤖 Auto-scoping to detected units...");
            scopedCodes = detectedUnitCodes;
        }

        // Track database changes for real-time stats
        let dbStats = { added: 0, modified: 0, deleted: 0, total: units.length };

        if (scopedCodes.length > 0) {
            console.log(`   🎯 Scoping to ${scopedCodes.length} units: ${scopedCodes.join(', ')}`);

            const scraper = new ScraperService();
            const scrapedUnits: Unit[] = [];
            const missingFromDb = scopedCodes.filter(code => !units.some(u => u.code === code));

            // If units were provided via file, we MUST validate them all
            if (unitsFile && missingFromDb.length > 0) {
                console.log(`   🌐 Verifying ${missingFromDb.length} units from file on training.gov.au...`);
                // Use detailed scraping for better error messages
                const { valid, invalid } = await scraper.scrapeUnitsWithDetails(missingFromDb);
                scrapedUnits.push(...valid);

                // If user did not ignore invalid and there are invalid units, return them
                if (!ignoreInvalid && invalid.length > 0) {
                    return NextResponse.json({
                        invalidUnits: invalid,
                        message: `The following units could not be verified: ${invalid.map(u => u.code).join(', ')}`
                    }, { status: 200 });
                }

                // Track additions if saving to database
                if (saveToDatabase && valid.length > 0) {
                    dbStats.added = valid.length;
                    dbStats.total += valid.length;
                    console.log(`   💾 Will add ${valid.length} new units to database`);
                }
            } else if (scopedCodes.length <= 10 && !unitsFile) {
                // Auto-scoping behavior (small number): try to refresh
                console.log(`   🌐 Scraping fresh data from training.gov.au...`);
                const { valid, invalid } = await scraper.scrapeUnitsWithDetails(scopedCodes);
                scrapedUnits.push(...valid);

                if (invalid.length > 0) {
                    console.warn(`   ⚠️ ${invalid.length} units failed validation: ${invalid.map(u => u.code).join(', ')}`);
                }

                // Check if any existing units were updated
                if (saveToDatabase) {
                    for (const fresh of valid) {
                        const existing = units.find(u => u.code === fresh.code);
                        if (existing) {
                            dbStats.modified++;
                        } else {
                            dbStats.added++;
                            dbStats.total++;
                        }
                    }
                    if (dbStats.modified > 0 || dbStats.added > 0) {
                        console.log(`   💾 Database changes: ${dbStats.added} added, ${dbStats.modified} modified`);
                    }
                }
            }

            unitsToAnalyze = [];

            for (const code of scopedCodes) {
                // Priority 1: Freshly scraped (verified)
                const fresh = scrapedUnits.find(u => u.code === code);
                if (fresh) {
                    unitsToAnalyze.push(fresh);
                    continue;
                }

                // Priority 2: Existing in DB
                const fromDb = units.find(u => u.code === code);
                if (fromDb) {
                    console.log(`   Using DB version for ${code}`);
                    unitsToAnalyze.push(fromDb);
                    continue;
                }

                // Invalid units already handled above
            }

            // Save to database if requested
            if (saveToDatabase && scrapedUnits.length > 0) {
                console.log(`   💾 Saving ${scrapedUnits.length} units to database...`);
                for (const unit of scrapedUnits) {
                    await loader.addUnit(unit);
                }
                console.log(`   ✅ Database updated`);
            } else if (!saveToDatabase) {
                console.log(`   ℹ️ Skipping database save (one-time validation mode)`);
            }
        }

        // --- NEW: Refine Questions with AI ---
        const apiKey = process.env.OPENAI_API_KEY || 'mock-key';
        const aiService = new AIService(apiKey);

        console.log("   🧹 Refining extracted questions with AI...");
        let refinedQuestions = await aiService.refineQuestions(questionsValidated);

        // --- NEW: Describe Images ---
        console.log("   🖼️  Describing images with Vision AI...");
        refinedQuestions = await aiService.describeImages(refinedQuestions);

        console.log(`   ✅ Refined to ${refinedQuestions.length} questions (from ${questions.length}).`);


        // 5. Analyze with AI
        console.log("   🧠 Initializing AI Agent...");
        const agent = await LocalAgent.getInstance();

        console.log(`   📚 Training AI on ${unitsToAnalyze.length} units...`);
        await agent.train(unitsToAnalyze);

        console.log("   🚀 Analyzing questions...");
        const results = await Promise.all(refinedQuestions.map(q => agent.analyze(q)));
        console.log("   ✅ Analysis complete.");

        const mappedUnitsDetails = units.filter(u =>
            results.some(r => r.mappedUnit === u.code)
        );

        return NextResponse.json({
            questionsCount: refinedQuestions.length,
            totalUnitsInDatabase: units.length,
            mappedUnits: mappedUnitsDetails,
            results,
            instructions,
            redTextSegments,
            databaseStats: dbStats
        });

    } catch (error) {
        console.error('Error processing request:', error);
        return NextResponse.json(
            { error: `Internal server error processing the file: ${error instanceof Error ? error.message : String(error)}` },
            { status: 500 }
        );
    }
}

// Helper to merge Red Text segments into Question text
function mergeRedTextAnswers(questions: any[], redSegments: string[]): any[] {
    const merged = JSON.parse(JSON.stringify(questions));

    // Helper to aggressively normalize text for matching
    const normalize = (s: string) => s
        .replace(/\s+/g, ' ') // Normalize all whitespace to single space
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .trim()
        .toLowerCase();

    redSegments.forEach(segment => {
        if (!segment || segment.length < 2) return;

        const cleanSegment = segment.replace(/\s+/g, ' ').trim();
        const normSegment = normalize(segment);

        let matched = false;

        // Strategy 1: Exact inclusion (with normalized whitespace)
        for (let i = 0; i < merged.length; i++) {
            const q = merged[i];
            if (q.text.includes('[[ANSWER:')) continue;

            const cleanQ = q.text.replace(/\s+/g, ' ').trim();

            if (cleanQ.toLowerCase().includes(cleanSegment.toLowerCase())) {
                // Build a flexible regex that allows any whitespace between words
                const words = cleanSegment.split(/\s+/).filter((w: string) => w.length > 0);
                if (words.length === 0) continue;

                // Escape special regex chars and join with flexible whitespace matcher
                const pattern = words
                    .map((w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                    .join('\\s*'); // Allow zero or more whitespace between words

                const regex = new RegExp(pattern, 'i');

                if (regex.test(q.text)) {
                    q.text = q.text.replace(regex, `[[ANSWER: ${segment}]]`);
                    matched = true;
                    break;
                }
            }
        }

        // Strategy 2: Normalized matching (ignores ALL punctuation and extra whitespace)
        if (!matched) {
            for (let i = 0; i < merged.length; i++) {
                const q = merged[i];
                if (q.text.includes('[[ANSWER:')) continue;

                const normQ = normalize(q.text);

                if (normQ.includes(normSegment)) {
                    // Found it with normalization - now find the actual text to replace
                    const words = segment.split(/\s+/).filter((w: string) => w.length > 0);
                    if (words.length === 0) continue;

                    // Build pattern that allows 0-5 whitespace chars between each word
                    // This handles cases like "2012Navigation" (0 spaces) and "2012 Navigation" (1 space)
                    const pattern = words
                        .map((w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                        .join('\\s{0,5}'); // Allow 0 to 5 whitespace characters between words

                    const regex = new RegExp(pattern, 'i');

                    if (regex.test(q.text)) {
                        q.text = q.text.replace(regex, `[[ANSWER: ${segment}]]`);
                        matched = true;
                        break;
                    }
                }
            }
        }

        // Strategy 3:  Partial match for long answers (> 50 chars)
        // Match if 70% of the words are present in order
        if (!matched && segment.length > 50) {
            const segmentWords = segment.split(/\s+/).filter((w: string) => w.length > 3); // Only significant words

            for (let i = 0; i < merged.length; i++) {
                const q = merged[i];
                if (q.text.includes('[[ANSWER:')) continue;

                const qWords = q.text.toLowerCase().split(/\s+/);
                let matchCount = 0;
                let lastIdx = -1;

                // Check if words appear in order
                for (const word of segmentWords) {
                    const idx = qWords.findIndex((qw: string, i: number) => i > lastIdx && qw.includes(word.toLowerCase()));
                    if (idx > lastIdx) {
                        matchCount++;
                        lastIdx = idx;
                    }
                }

                const matchRatio = matchCount / segmentWords.length;

                if (matchRatio >= 0.7) {
                    // Found a good match - append the answer
                    q.text += `\n[[ANSWER: ${segment}]]`;
                    matched = true;
                    break;
                }
            }
        }

        // Strategy 4: Very short answers (< 15 chars) - be more aggressive
        if (!matched && segment.length < 15) {
            for (let i = 0; i < merged.length; i++) {
                const q = merged[i];
                if (q.text.includes('[[ANSWER:')) continue;

                // For very short answers, just check if the text appears anywhere
                const normQ = normalize(q.text);
                const normSeg = normalize(segment);

                if (normQ.includes(normSeg)) {
                    // Try to find and replace the exact position
                    const words = segment.trim().split(/\s+/);
                    const pattern = words
                        .map((w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                        .join('[\\s\\S]{0,5}');

                    const regex = new RegExp(pattern, 'i');

                    if (regex.test(q.text)) {
                        q.text = q.text.replace(regex, `[[ANSWER: ${segment}]]`);
                        matched = true;
                        break;
                    } else {
                        // Just append if we can't find exact position
                        q.text += `\n[[ANSWER: ${segment}]]`;
                        matched = true;
                        break;
                    }
                }
            }
        }
    });

    return merged;
}
// --- NEW: Ensure every question has an answer and every answer has a question ---
function ensureAnswers(questions: any[], redSegments: string[]): any[] {
    const usedIndices = new Set<number>();
    // Record already used red segments from existing answer tags
    questions.forEach(q => {
        const match = q.text.match(/\[\[ANSWER:\s*([\s\S]*?)\]\]/);
        if (match) {
            const ans = match[1].trim();
            const idx = redSegments.findIndex(seg => seg.trim() === ans);
            if (idx !== -1) usedIndices.add(idx);
        }
    });

    // Assign missing answers to questions lacking an [[ANSWER]] tag
    let segIdx = 0;
    for (const q of questions) {
        if (!q.text.includes('[[ANSWER:')) {
            while (segIdx < redSegments.length && usedIndices.has(segIdx)) segIdx++;
            if (segIdx < redSegments.length) {
                const seg = redSegments[segIdx];
                q.text = `${q.text}\n[[ANSWER: ${seg}]]`;
                usedIndices.add(segIdx);
                console.log(`   ✅ Assigned missing answer to ${q.id}`);
            } else {
                console.warn(`   ⚠️ No answer found for question ${q.id}`);
            }
        }
    }

    // Remove duplicate answer tags (same answer appearing multiple times)
    const seenAnswers = new Set<string>();
    questions.forEach(q => {
        const ansMatch = q.text.match(/\[\[ANSWER:\s*([\s\S]*?)\]\]/);
        if (ansMatch) {
            const ans = ansMatch[1].trim();
            if (seenAnswers.has(ans)) {
                q.text = q.text.replace(/\[\[ANSWER:\s*[\s\S]*?\]\]/, '').trim();
            } else {
                seenAnswers.add(ans);
            }
        }
    });
    return questions;
}


// Helper to integrate structured pairs (sub-questions) into the main question list
function integrateStructuredPairs(existingQuestions: any[], structuredPairs: any[]): any[] {
    const integrated = [...existingQuestions];
    const normalize = (s: string) => s.toLowerCase().replace(/[\s\W_]+/g, '');

    // Map to track which existing questions have been matched
    const matchedIndices = new Set<number>();

    // We iterate through structured pairs to maintain document order
    // If a pair matches an existing question, we update it and mark position
    // If it doesn't match, we insert it after the last matched position

    let lastInsertIndex = -1;

    for (const pair of structuredPairs) {
        if (!pair.question || pair.question.length < 2) continue;

        const normPairQ = normalize(pair.question);

        // Try to find matching existing question
        // We look for exact matches or strong partial matches
        const existingIndex = integrated.findIndex((q, idx) => {
            // Optimization: only check if not already matched? 
            // Actually, duplicates might exist, so check all, but prefer unmatched.
            const normQ = normalize(q.text);
            return normQ === normPairQ || (normQ.includes(normPairQ) && normQ.length < normPairQ.length + 20);
        });

        if (existingIndex !== -1) {
            // Found match
            matchedIndices.add(existingIndex);
            lastInsertIndex = existingIndex;

            // Update answer if present and not already tagged
            if (pair.answer && !integrated[existingIndex].text.includes('[[ANSWER:')) {
                integrated[existingIndex].text += `\n[[ANSWER: ${pair.answer}]]`;
            }
        } else {
            // No match found - this is a new sub-question

            // Construct new question
            const newQ = {
                id: `SubQ-${Math.random().toString(36).substr(2, 5)}`,
                text: pair.question + (pair.answer ? `\n[[ANSWER: ${pair.answer}]]` : ''),
                section: lastInsertIndex !== -1 ? integrated[lastInsertIndex].section : 'General',
                mappingHint: null
            };

            // Insert after the last matched question to preserve relative order
            if (lastInsertIndex !== -1 && lastInsertIndex < integrated.length - 1) {
                integrated.splice(lastInsertIndex + 1, 0, newQ);
                lastInsertIndex++; // Move pointer
            } else {
                integrated.push(newQ);
                lastInsertIndex = integrated.length - 1;
            }
        }
    }

    return integrated;
}
