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

        logger.info(`Files received: Assessment=${assessmentFile.name} (${assessmentFile.size} bytes), Units=${unitsFile.name} (${unitsFile.size} bytes)`);
        logger.info(`Configuration: saveToDatabase=${saveToDatabase}`);

        if (!assessmentFile || !unitsFile) {
            logger.error('Missing files');
            return NextResponse.json({ error: 'Missing files' }, { status: 400 });
        }

        // 1. Extract Unit Codes
        logger.info('1️⃣ Extracting unit codes from Excel...');
        const unitsBuffer = await unitsFile.arrayBuffer();
        const workbook = XLSX.read(unitsBuffer);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];

        // Extract codes (assuming first column)
        let unitCodes = rows
            .map(row => row[0])
            .filter(code => code && typeof code === 'string' && /^[A-Z0-9]+$/.test(code.trim()))
            .map(code => code.trim());

        // Remove duplicates
        unitCodes = [...new Set(unitCodes)];
        logger.info(`Found ${unitCodes.length} unique unit codes:`, unitCodes);

        if (unitCodes.length === 0) {
            logger.error('No valid unit codes found in Excel');
            return NextResponse.json({ error: 'No valid unit codes found in Excel file' }, { status: 400 });
        }

        // 2. Scrape/Load Units
        logger.info('2️⃣ Scraping units from training.gov.au...');
        const scraper = new ScraperService();
        const loader = new UocLoader();

        // Initialize DB stats
        const dbStats = { added: 0, modified: 0, deleted: 0, total: 0 };

        const { valid: scrapedUnits, invalid } = await scraper.scrapeUnitsWithDetails(unitCodes);

        logger.info(`Scraping complete. Valid: ${scrapedUnits.length}, Invalid: ${invalid.length}`);
        if (invalid.length > 0) {
            logger.warn('Invalid units details:', invalid);
        }

        // Add to loader
        for (const unit of scrapedUnits) {
            if (saveToDatabase) {
                const exists = loader.getUnit(unit.code);
                await loader.addUnit(unit);
                if (!exists) dbStats.added++;
                else dbStats.modified++;
            } else {
                // Just add to local memory for this session
                await loader.addUnit(unit); // UocLoader is in-memory for this request instance anyway
            }
        }

        const allUnits = loader.getAllUnits();
        dbStats.total = allUnits.length;
        logger.info(`Total units available for analysis: ${allUnits.length}`);

        if (allUnits.length === 0) {
            logger.error('No units available for matching. Aborting analysis.');
            return NextResponse.json({
                error: 'No valid units could be scraped or loaded. Cannot proceed with analysis.',
                invalidUnits: invalid
            }, { status: 400 });
        }

        // 3. Extract Questions
        logger.info('3️⃣ Extracting questions from DOCX...');
        const docxBuffer = await assessmentFile.arrayBuffer();
        const { questions: rawQuestions, detectedUnitCodes, instructions } = await extractQuestionsFromDocx(Buffer.from(docxBuffer));
        logger.info(`Extracted ${rawQuestions.length} raw text blocks/questions`);

        // 4. AI Analysis & Mapping
        logger.info('4️⃣ Starting AI Analysis & Mapping...');
        const aiService = new AIService(process.env.OPENAI_API_KEY || '');

        // Refine questions (clean up, merge)
        const cleanedQuestions = await aiService.refineQuestions(rawQuestions);
        logger.info(`Refined to ${cleanedQuestions.length} clean questions`);

        // Validate/Map each question
        const results = [];
        for (const q of cleanedQuestions) {
            // logger.debug(`Analyzing Question ${q.id}...`); // Too verbose?
            const result = await aiService.validateQuestion(q, allUnits);
            results.push({
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
                imageDescription: q.imageDescription
            });
        }

        const mappedCount = results.filter(r => r.mappedUnit).length;
        logger.info(`Analysis complete. Mapped ${mappedCount}/${results.length} questions.`);

        const reportData = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            questionsCount: results.length,
            mappedUnits: allUnits,
            results: results,
            instructions: [], // TODO: Extract instructions
            invalidUnits: invalid,
            dbStats: dbStats
        };

        logger.info('✅ Sending response');
        return NextResponse.json(reportData);

    } catch (error) {
        logger.error('❌ Fatal error in analysis route:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
