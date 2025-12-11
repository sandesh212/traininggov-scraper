import { NextRequest, NextResponse } from 'next/server';
import { extractQuestionsFromDocx } from '@/services/docxQuestionExtractor';
import { UocLoader } from '@/services/uocLoader';
import * as XLSX from 'xlsx';
import { ScraperService } from '@/services/scraperService';
import { AIService } from '@/services/aiService';
import { logger } from '@/utils/logger';

export const maxDuration = 300; // 5 minutes timeout

export async function POST(req: NextRequest) {
    logger.clear();
    logger.info('🚀 Received analysis request');

    try {
        const formData = await req.formData();
        const assessmentFile = formData.get('assessmentFile') as File;
        const unitsFile = formData.get('unitsFile') as File;
        const saveToDatabase = formData.get('saveToDatabase') === 'true';

        logger.info(`Files received: Assessment=${assessmentFile?.name} (${assessmentFile?.size} bytes), Units=${unitsFile?.name ?? 'None'} (${unitsFile?.size ?? 0} bytes)`);
        logger.info(`Configuration: saveToDatabase=${saveToDatabase}`);

        // 1. Initialize Loader & Check Existing Units
        const loader = new UocLoader();
        await loader.load(); // Load existing units from disk
        let allUnits = loader.getAllUnits();
        const existingCount = allUnits.length;

        logger.info(`Loaded ${existingCount} existing units from database.`);

        // 2. Validate Inputs
        if (!assessmentFile) {
            logger.error('Missing assessment file');
            return NextResponse.json({ error: 'Assessment file is required' }, { status: 400 });
        }

        if (!unitsFile && existingCount === 0) {
            logger.error('Missing units file and database is empty');
            return NextResponse.json({ error: 'Units file is required because the unit database is empty.' }, { status: 400 });
        }

        // 3. Process Units File (if provided)
        let scrapedUnits: any[] = [];
        let invalid: any[] = [];
        let duplicatesInInput: any[] = [];
        let unitCodes: string[] = [];
        const dbStats = { added: 0, modified: 0, deleted: 0, total: existingCount };

        if (unitsFile) {
            logger.info('1️⃣ Processing uploaded units file...');

            const unitsBuffer = await unitsFile.arrayBuffer();
            const workbook = XLSX.read(unitsBuffer);

            let parsedUnitsMap = new Map<string, any>();
            let unitElementsMap = new Map<string, Map<string, { title: string, pcs: any[] }>>();

            logger.info(`   📂 Found ${workbook.SheetNames.length} sheets in workbook.`);

            for (const sheetName of workbook.SheetNames) {
                const sheet = workbook.Sheets[sheetName];
                const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

                logger.info(`   Processing sheet "${sheetName}" (${rawData.length} rows)...`);

                if (rawData.length === 0) continue;

                // Check for Header Check Row 0
                let startRow = 0;
                const firstRow = rawData[0];
                if (firstRow && Array.isArray(firstRow)) {
                    const rowStr = firstRow.join(' ').toLowerCase();
                    // If row 0 contains "unit" and "element", assume it's a header
                    if (rowStr.includes('unit') && rowStr.includes('element')) {
                        startRow = 1;
                    }
                }

                // Iterate Rows
                for (let i = startRow; i < rawData.length; i++) {
                    const row = rawData[i];
                    if (!Array.isArray(row) || row.length < 2) continue;

                    // STRICT COLUMN MAPPING (0-based)
                    // 0: Unit Code/Title (e.g. "MARF027 Apply basic...")
                    // 1: Element Title (e.g. "1. Prepare...")
                    // 2: ID (e.g. "1.1", "KE1.0", "PE")
                    // 3: Text Content

                    const rawUnit = String(row[0] || '').trim();
                    const rawElement = String(row[1] || '').trim();
                    const rawId = String(row[2] || '').trim();
                    const rawText = String(row[3] || '').trim();

                    if (!rawUnit) continue;

                    // Extract Unit Code
                    let code = '';
                    let title = '';

                    // Regex for Code (MARF027, CPCC...)
                    const codeMatch = rawUnit.match(/^([A-Z]{3,}[0-9]+[A-Z]*)/i);
                    if (codeMatch) {
                        code = codeMatch[1].toUpperCase();
                        title = rawUnit.substring(code.length).trim().replace(/^[-–: ]+/, '');
                    } else if (rawUnit.length < 15 && /[A-Z]/.test(rawUnit) && /[0-9]/.test(rawUnit)) {
                        // Fallback for just code
                        code = rawUnit.toUpperCase().replace(/[^A-Z0-9]/g, '');
                    }

                    if (!code || code.length < 5) continue;

                    // Init Unit
                    if (!parsedUnitsMap.has(code)) {
                        parsedUnitsMap.set(code, {
                            code: code,
                            title: title || 'Unknown Title',
                            description: '',
                            elements: [], // Will populate at end
                            knowledgeEvidence: '',
                            performanceEvidence: '',
                            assessmentConditions: '',
                            sections: [],
                            status: 'Current'
                        });
                        unitElementsMap.set(code, new Map());
                    }
                    const unit = parsedUnitsMap.get(code);

                    // Determine Content Type
                    const idLower = rawId.toLowerCase();
                    const elemLower = rawElement.toLowerCase();

                    // STRICT SEPARATION: content comes from rawText (Col 3), ID comes from rawId (Col 2)
                    // Do NOT fallback to rawId for content, as that causes "1.1" to be the text.
                    const content = rawText;

                    if (!content) {
                        // If no text content, this row might be a header or malformed.
                        // Exception: If it's a known section header row like "Assessment Conditions" in Element column 
                        // but usually content is in text column.
                        continue;
                    }

                    // Construct final line: Prepend ID/Bullet if it looks like one (and isn't a section marker)
                    let finalLine = content;
                    const cleanId = rawId.replace(/\s+/g, '');
                    // Check if ID is likely a bullet/number (e.g. "1.", "1.1", "-", "•") and NOT a section keyword
                    const isBullet = /^[\d\.\-\•\*\>]+$/.test(cleanId) || (cleanId.length < 10 && /\d/.test(cleanId));
                    const isSectionHeader = /^(ke|pe|ac|knowledge|performance|assessment)/i.test(cleanId);

                    if (isBullet && !isSectionHeader) {
                        // Indent bullet points for better hierarchy
                        finalLine = `    ${rawId} ${content}`;
                    } else {
                        // Keep headings or non-bullet content flat
                        finalLine = content;
                    }

                    if (idLower.includes('ke') || idLower.includes('knowledge') || elemLower.includes('knowledge')) {
                        unit.knowledgeEvidence += (unit.knowledgeEvidence ? '\n' : '') + finalLine;
                    }
                    else if (idLower.includes('pe') || (idLower.includes('performance') && !idLower.includes('criteria')) || elemLower.includes('performance evidence')) {
                        unit.performanceEvidence += (unit.performanceEvidence ? '\n' : '') + finalLine;
                    }
                    else if (idLower.includes('ac') || idLower.includes('assessment') || elemLower.includes('assessment conditions')) {
                        unit.assessmentConditions += (unit.assessmentConditions ? '\n' : '') + finalLine;
                    }
                    else {
                        // Performance Criteria / Element
                        if (rawElement) {
                            const elemMap = unitElementsMap.get(code)!;
                            let elemKey = rawElement;
                            let elemTitle = rawElement;

                            // Clean "1. Title" -> Key="1", Title="Title"
                            const elemMatch = rawElement.match(/^(\d+)\.?\s*(.*)/);
                            if (elemMatch) {
                                elemKey = elemMatch[1];
                                elemTitle = elemMatch[2] || rawElement;
                            }

                            if (!elemMap.has(elemKey)) {
                                elemMap.set(elemKey, { title: elemTitle, pcs: [] });
                            }

                            // Add PC
                            // Ensure ID is just the ID (e.g. "1.1")
                            elemMap.get(elemKey)?.pcs.push({
                                id: rawId || '', // explicit ID or empty
                                text: content
                            });
                        } else {
                            // Empty element col -> Description?
                            if (!unit.description) unit.description = content;
                        }
                    }
                }
            }

            // Convert Maps to Final Arrays
            let parsedUnits: any[] = [];
            parsedUnitsMap.forEach((unit, code) => {
                const elemMap = unitElementsMap.get(code);
                if (elemMap) {
                    // Sort by key (numeric)
                    const sortedKeys = Array.from(elemMap.keys()).sort((a, b) => {
                        const numA = parseInt(a);
                        const numB = parseInt(b);
                        return isNaN(numA) || isNaN(numB) ? a.localeCompare(b) : numA - numB;
                    });
                    unit.elements = sortedKeys.map(k => ({
                        title: elemMap.get(k)?.title,
                        performanceCriteria: elemMap.get(k)?.pcs
                    }));
                }
                parsedUnits.push(unit);
            });

            logger.info(`   ✅ Parsed ${parsedUnits.length} total units from workbook.`);

            if (parsedUnits.length > 0) {
                scrapedUnits = parsedUnits;
                unitCodes = Array.from(parsedUnitsMap.keys());

                if (saveToDatabase) {
                    logger.info(`Saving parsed units to database...`);
                    for (const unit of parsedUnits) {
                        const exists = loader.getUnit(unit.code);
                        await loader.addUnit(unit);
                        if (!exists) dbStats.added++; else dbStats.modified++;
                    }
                    allUnits = parsedUnits; // Use parsed units
                } else {
                    allUnits = parsedUnits;
                }
            } else {
                return NextResponse.json({
                    error: 'No units found in Excel file',
                    details: 'Evaluated all sheets but found no valid unit rows.'
                }, { status: 400 });
            }

            // Fallback Scraper Logic
            const hasContent = parsedUnits.some(u => u.elements.length > 0 || u.knowledgeEvidence);
            if (!hasContent && parsedUnits.length > 0) {
                logger.info('   ⚠️ Only Codes found (no content). Switching to SCRAPER fallback...');
                const scraper = new ScraperService();
                try {
                    const result = await scraper.scrapeUnitsWithDetails(unitCodes, true);
                    scrapedUnits = result.valid;
                    invalid = result.invalid;
                } catch (err: any) {
                    return NextResponse.json({ error: 'Scraping failed', details: err.message }, { status: 500 });
                }

                if (saveToDatabase) {
                    for (const unit of scrapedUnits) {
                        await loader.addUnit(unit);
                    }
                    allUnits = loader.getAllUnits();
                } else {
                    const unitMap = new Map(allUnits.map(u => [u.code, u]));
                    scrapedUnits.forEach(u => unitMap.set(u.code, u));
                    allUnits = Array.from(unitMap.values());
                }
            }
        } else {
            logger.info('Using existing database units only.');
        }

        dbStats.total = allUnits.length;
        logger.info(`Total units available for analysis: ${allUnits.length}`);

        if (allUnits.length === 0) {
            return NextResponse.json({
                error: 'No valid units available. Please upload a units list.',
                invalidUnits: invalid
            }, { status: 400 });
        }

        // 3. Extract Questions
        logger.info('3️⃣ Extracting questions from DOCX...');
        let rawQuestions, detectedUnitCodes, instructions, redTextAnswers, title;
        try {
            const docxBuffer = await assessmentFile.arrayBuffer();
            const extractionResult = await extractQuestionsFromDocx(Buffer.from(docxBuffer));
            rawQuestions = extractionResult.questions;
            detectedUnitCodes = extractionResult.detectedUnitCodes;
            instructions = extractionResult.instructions;
            redTextAnswers = extractionResult.redTextAnswers || [];
            title = extractionResult.title;
            logger.info(`Extracted ${rawQuestions.length} questions (black text)`);
            logger.info(`Separated ${redTextAnswers.length} answers (red text)`);
        } catch (docxError) {
            logger.error('Error extracting questions from DOCX:', docxError);
            console.error('Full DOCX extraction error:', docxError);
            return NextResponse.json({
                error: 'Failed to extract questions from assessment file',
                details: docxError instanceof Error ? docxError.message : String(docxError),
                stack: docxError instanceof Error ? docxError.stack : undefined
            }, { status: 500 });
        }

        // 4. AI Analysis & Mapping
        logger.info('4️⃣ Starting AI Analysis & Mapping...');
        const aiService = new AIService(
            process.env.OPENAI_API_KEY || 'ollama',
            process.env.AI_MODEL || 'gpt-4o',
            process.env.AI_BASE_URL
        );

        let cleanedQuestions = rawQuestions;

        // Describe images if any - SKIPPED FOR SPEED
        // logger.info('   🖼️ Describing images...');
        // cleanedQuestions = await aiService.describeImages(cleanedQuestions);

        logger.info(`Processing ${cleanedQuestions.length} questions for validation...`);

        // Validate/Map each question
        const results = [];
        const questionErrors = [];

        if (!Array.isArray(cleanedQuestions) || cleanedQuestions.length === 0) {
            logger.warn('No questions to analyze');
            return NextResponse.json({
                error: 'No questions found in assessment file',
                details: 'The DOCX file was parsed but no questions were extracted'
            }, { status: 400 });
        }

        const AI_BATCH_SIZE = 5; // Reduced from 10 to ensure smoother progress
        logger.info(`Processing ${cleanedQuestions.length} questions in batches of ${AI_BATCH_SIZE}...`);

        for (let i = 0; i < cleanedQuestions.length; i += AI_BATCH_SIZE) {
            const batch = cleanedQuestions.slice(i, i + AI_BATCH_SIZE);
            const batchNum = Math.floor(i / AI_BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(cleanedQuestions.length / AI_BATCH_SIZE);
            logger.info(`   AI Batch ${batchNum}/${totalBatches} (${batch.length} questions)...`);

            const batchPromises = batch.map(async (q) => {
                try {
                    const result = await aiService.validateQuestion(q, allUnits);
                    return {
                        questionId: q.id,
                        questionText: q.text,
                        questionSection: q.section,
                        isValid: result.isValid,
                        mappedUnit: result.mappedUnit,
                        mappedCriteria: result.mappedCriteria,
                        mappedKnowledge: result.mappedKnowledge,
                        reasoning: result.reasoning,
                        gaps: result.gaps,
                        confidence: result.confidence,
                        images: q.images,
                        imageDescription: q.imageDescription,
                        parentQuestionId: q.parentQuestionId
                    };
                } catch (questionError) {
                    logger.error(`Error analyzing question ${q.id}:`, questionError);
                    questionErrors.push({
                        questionId: q.id,
                        error: questionError instanceof Error ? questionError.message : String(questionError)
                    });
                    return {
                        questionId: q.id,
                        questionText: q.text,
                        questionSection: q.section,
                        isValid: false,
                        mappedUnit: null,
                        mappedCriteria: [],
                        mappedKnowledge: [],
                        reasoning: `Error during analysis: ${questionError instanceof Error ? questionError.message : String(questionError)}`,
                        gaps: [],
                        confidence: 0,
                        images: q.images,
                        imageDescription: q.imageDescription
                    };
                }
            });

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
        }

        const mappedCount = results.filter(r => r.mappedUnit).length;
        logger.info(`Analysis complete. Mapped ${mappedCount}/${results.length} questions.`);
        if (questionErrors.length > 0) {
            logger.warn(`Encountered ${questionErrors.length} errors during question analysis`);
        }

        const uniqueMappedUnitCodes = new Set<string>();
        results.forEach(r => {
            if (r.mappedUnit) {
                uniqueMappedUnitCodes.add(r.mappedUnit);
            }
        });

        const mappedUnits = allUnits.filter(u => uniqueMappedUnitCodes.has(u.code));
        logger.info(`Unique units mapped to questions: ${uniqueMappedUnitCodes.size} out of ${allUnits.length} fetched units`);

        const reportData = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            questionsCount: results.length,
            mappedUnits: mappedUnits,
            mappedUnitsCount: uniqueMappedUnitCodes.size,
            fetchedUnits: allUnits,
            fetchedUnitsCount: allUnits.length,
            results: results,
            instructions: instructions || [],
            title: title || 'Assessment Report',
            redTextAnswers: redTextAnswers || [],
            invalidUnits: invalid.map(inv => ({
                code: inv.code,
                reason: inv.reason || 'Unknown error'
            })),
            duplicateUnits: duplicatesInInput,
            totalUnitCodesFound: unitCodes.length,
            validUnitsScraped: scrapedUnits.length,
            invalidUnitsCount: invalid.length,
            duplicatesCount: duplicatesInInput.length,
            dbStats: dbStats
        };

        logger.info('✅ Sending response');
        return NextResponse.json(reportData);

    } catch (error) {
        logger.error('❌ Fatal error in analysis route:', error);
        console.error('Full error stack:', error);
        return NextResponse.json(
            {
                error: 'Internal server error',
                details: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            },
            { status: 500 }
        );
    }
}
