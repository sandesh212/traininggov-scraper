import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { extractQuestionsFromDocx } from '@/services/docxQuestionExtractor';
import { RedTextExtractor } from '@/services/redTextExtractor';
import { UocLoader } from '@/services/uocLoader';
import { ScraperService } from '@/services/scraperService';
import { AIService } from '@/services/aiService';
import { logger } from '@/utils/logger';
import type { DatabaseStats, QuestionResult, Unit } from '@/types';

export const maxDuration = 300;

const MAX_ASSESSMENT_FILE_SIZE = 10 * 1024 * 1024;
const MAX_UNITS_FILE_SIZE = 5 * 1024 * 1024;

function getFile(formData: FormData, fieldName: string): File | null {
    const value = formData.get(fieldName);
    return value instanceof File ? value : null;
}

function isExcelFile(file: File): boolean {
    const filename = file.name.toLowerCase();
    return filename.endsWith('.xlsx') || filename.endsWith('.xls');
}

function extractUnitCodes(fileBuffer: ArrayBuffer): string[] {
    const workbook = XLSX.read(fileBuffer);
    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
        return [];
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

    return [...new Set(
        rows
            .map((row) => row[0])
            .filter((code): code is string => typeof code === 'string')
            .map((code) => code.trim().toUpperCase())
            .filter((code) => /^[A-Z0-9]+$/.test(code))
    )];
}

export async function POST(req: NextRequest) {
    logger.clear();
    logger.info('Received analysis request');

    try {
        const formData = await req.formData();
        const assessmentFile = getFile(formData, 'assessmentFile');
        const unitsFile = getFile(formData, 'unitsFile');
        const saveToDatabase = formData.get('saveToDatabase') === 'true';

        if (!assessmentFile) {
            return NextResponse.json({ error: 'An assessment DOCX file is required.' }, { status: 400 });
        }

        if (!assessmentFile.name.toLowerCase().endsWith('.docx')) {
            return NextResponse.json({ error: 'The assessment file must be a .docx document.' }, { status: 400 });
        }

        if (assessmentFile.size === 0 || assessmentFile.size > MAX_ASSESSMENT_FILE_SIZE) {
            return NextResponse.json({ error: 'The assessment file must be between 1 byte and 10 MB.' }, { status: 400 });
        }

        if (unitsFile && !isExcelFile(unitsFile)) {
            return NextResponse.json({ error: 'The units list must be an .xlsx or .xls file.' }, { status: 400 });
        }

        if (unitsFile && (unitsFile.size === 0 || unitsFile.size > MAX_UNITS_FILE_SIZE)) {
            return NextResponse.json({ error: 'The units list must be between 1 byte and 5 MB.' }, { status: 400 });
        }

        logger.info(
            `Assessment received: ${assessmentFile.name} (${assessmentFile.size} bytes). ` +
            `Units list: ${unitsFile ? `${unitsFile.name} (${unitsFile.size} bytes)` : 'not supplied'}. ` +
            `Save to database: ${saveToDatabase}.`
        );

        const loader = new UocLoader();
        await loader.load();
        const existingUnitCount = loader.getAllUnits().length;
        const databaseStats: DatabaseStats = { added: 0, modified: 0, deleted: 0, total: existingUnitCount };

        let analysisUnits: Unit[] = loader.getAllUnits();
        let invalidUnits: { code: string; url: string; reason: string }[] = [];

        if (unitsFile) {
            const unitCodes = extractUnitCodes(await unitsFile.arrayBuffer());

            if (unitCodes.length === 0) {
                return NextResponse.json({ error: 'No valid unit codes were found in the uploaded Excel file.' }, { status: 400 });
            }

            logger.info(`Scraping ${unitCodes.length} unit code(s) from the uploaded list.`);
            const scraper = new ScraperService();
            const { valid: scrapedUnits, invalid } = await scraper.scrapeUnitsWithDetails(unitCodes);
            invalidUnits = invalid;

            for (const unit of scrapedUnits) {
                if (loader.getUnit(unit.code)) {
                    databaseStats.modified++;
                } else {
                    databaseStats.added++;
                }

                // Always keep uploaded units available for this request. Persistence is opt-in.
                await loader.addUnit(unit, false);
            }

            if (saveToDatabase && scrapedUnits.length > 0) {
                await loader.persist();
                databaseStats.total = loader.getAllUnits().length;
            } else {
                // A one-time run must not report temporary memory state as persisted database data.
                databaseStats.added = 0;
                databaseStats.modified = 0;
            }

            // An uploaded list explicitly scopes this analysis to those units, rather than every saved unit.
            analysisUnits = scrapedUnits;
        }

        if (analysisUnits.length === 0) {
            return NextResponse.json(
                {
                    error: unitsFile
                        ? 'None of the supplied unit codes could be verified on training.gov.au.'
                        : 'No saved units are available. Upload a units list or add units in Manage Units first.',
                    invalidUnits
                },
                { status: 400 }
            );
        }

        logger.info(`Extracting questions against ${analysisUnits.length} unit(s).`);
        const assessmentBuffer = Buffer.from(await assessmentFile.arrayBuffer());
        const redTextSegments = new RedTextExtractor().extractRedText(assessmentBuffer);
        const { questions: rawQuestions, instructions } = await extractQuestionsFromDocx(assessmentBuffer, redTextSegments);
        logger.info(`Extracted ${rawQuestions.length} question block(s) and ${instructions.length} instruction block(s).`);

        const aiService = new AIService(process.env.OPENAI_API_KEY || '');
        const cleanedQuestions = await aiService.refineQuestions(rawQuestions);
        const results: QuestionResult[] = [];

        for (const question of cleanedQuestions) {
            const validation = await aiService.validateQuestion(question, analysisUnits);
            results.push({
                questionId: question.id,
                questionText: question.text,
                questionSection: question.section,
                isValid: validation.isValid,
                mappedUnit: validation.mappedUnit ?? null,
                mappedCriteria: validation.mappedCriteria,
                mappedKnowledge: validation.mappedKnowledge,
                confidence: validation.confidence,
                reasoning: validation.reasoning,
                images: question.images,
                imageDescription: question.imageDescription
            });
        }

        const mappedCount = results.filter((result) => result.mappedUnit).length;
        logger.info(`Analysis complete. Mapped ${mappedCount} of ${results.length} question(s).`);

        return NextResponse.json({
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            questionsCount: results.length,
            totalUnitsInDatabase: analysisUnits.length,
            mappedUnits: analysisUnits,
            results,
            instructions,
            redTextSegments,
            invalidUnits,
            databaseStats
        });
    } catch (error) {
        const details = error instanceof Error ? error.message : String(error);
        logger.error('Fatal error in analysis route:', error);
        return NextResponse.json({ error: 'Unable to complete the analysis.', details }, { status: 500 });
    }
}
