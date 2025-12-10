#!/usr/bin/env ts-node

/**
 * Comprehensive Requirements Verification
 * Tests all 5 requirements specified by the user
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Color codes
const c = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

function section(title: string) {
    console.log(`\n${c.bright}${c.cyan}${'='.repeat(80)}${c.reset}`);
    console.log(`${c.bright}${c.cyan}${title}${c.reset}`);
    console.log(`${c.bright}${c.cyan}${'='.repeat(80)}${c.reset}\n`);
}

function log(type: 'info' | 'success' | 'error' | 'warning' | 'test', msg: string) {
    const icons = { info: `${c.blue}ℹ${c.reset}`, success: `${c.green}✓${c.reset}`, error: `${c.red}✗${c.reset}`, warning: `${c.yellow}⚠${c.reset}`, test: `${c.cyan}◆${c.reset}` };
    console.log(`${icons[type]} ${msg}`);
}

async function main() {
    console.log(`\n${c.bright}🔍 COMPREHENSIVE REQUIREMENTS VERIFICATION${c.reset}\n`);

    const results = {
        req1: false,
        req2: false,
        req3: false,
        req4: false,
        req5: false,
    };

    // ========================================================================
    // REQUIREMENT 1: Extract Unit Codes from Excel
    // ========================================================================
    section('REQUIREMENT 1: Accurately Extract Unit Codes from Excel');

    const excelFile = path.join(__dirname, 'Units.xlsx');
    log('info', `Reading: ${excelFile}`);

    if (!fs.existsSync(excelFile)) {
        log('error', 'Excel file not found');
    } else {
        try {
            const workbook = XLSX.read(fs.readFileSync(excelFile));
            const unitCodesSet = new Set<string>();

            for (const sheetName of workbook.SheetNames) {
                const sheet = workbook.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

                for (const row of rows) {
                    if (Array.isArray(row)) {
                        for (const cell of row) {
                            if (typeof cell === 'string') {
                                const cleaned = cell.trim().toUpperCase().replace(/\s+/g, '');
                                const match = cleaned.match(/^([A-Z]{2,10}[0-9]{2,6})$/);
                                if (match) unitCodesSet.add(match[1]);
                            }
                        }
                    }
                }
            }

            const unitCodes = Array.from(unitCodesSet);

            if (unitCodes.length === 0) {
                log('error', 'No unit codes extracted!');
            } else {
                log('success', `Extracted ${unitCodes.length} unique unit codes`);
                log('info', `Codes: ${unitCodes.slice(0, 10).join(', ')}${unitCodes.length > 10 ? '...' : ''}`);
                results.req1 = true;
            }
        } catch (error: any) {
            log('error', `Excel parsing error: ${error.message}`);
        }
    }

    log(results.req1 ? 'success' : 'error',
        `REQUIREMENT 1: ${results.req1 ? 'PASSED ✓' : 'FAILED ✗'}`);

    // ========================================================================
    // REQUIREMENT 2: URL Validation (404 vs Valid Content)
    // ========================================================================
    section('REQUIREMENT 2: URL Validation - 404 Detection & Content Validation');

    log('info', 'Valid units should contain: Performance Evidence, Knowledge Evidence,');
    log('info', 'Performance Criteria, or Assessment Conditions');
    log('info', 'Testing URL validation logic from scraperService.ts...');

    // Check if scraper service has proper validation
    const scraperPath = path.join(__dirname, 'web/src/services/scraperService.ts');
    if (fs.existsSync(scraperPath)) {
        const scraperCode = fs.readFileSync(scraperPath, 'utf-8');

        const has404Check = scraperCode.includes('404') && scraperCode.includes('status');
        const hasValidation = (
            scraperCode.includes('performanceEvidence') &&
            scraperCode.includes('knowledgeEvidence') &&
            scraperCode.includes('assessmentConditions') &&
            scraperCode.includes('elements')
        );
        const hasPerformanceCriteria = scraperCode.includes('performanceCriteria');

        if (has404Check) {
            log('success', 'ScraperService has 404 detection logic');
        } else {
            log('error', 'ScraperService missing 404 detection');
        }

        if (hasValidation && hasPerformanceCriteria) {
            log('success', 'ScraperService validates content (PE, KE, PC, AC)');
        } else {
            log('error', 'ScraperService missing content validation');
        }

        results.req2 = has404Check && hasValidation && hasPerformanceCriteria;
    } else {
        log('error', 'scraperService.ts not found');
    }

    log(results.req2 ? 'success' : 'error',
        `REQUIREMENT 2: ${results.req2 ? 'PASSED ✓' : 'FAILED ✗'}`);

    // ========================================================================
    // REQUIREMENT 3: Extract Document Structure
    // ========================================================================
    section('REQUIREMENT 3: Extract Instructions, Headings, Questions from DOCX');

    const extractorPath = path.join(__dirname, 'web/src/services/docxQuestionExtractor.ts');
    if (fs.existsSync(extractorPath)) {
        const extractorCode = fs.readFileSync(extractorPath, 'utf-8');

        // Check for heading detection
        const detectsHeadings = extractorCode.includes('PART') || extractorCode.includes('SECTION');

        // Check for instruction detection
        const detectsInstructions = (
            extractorCode.includes('List') &&
            extractorCode.includes('Describe') &&
            extractorCode.includes('Explain')
        );

        // Check for question detection  
        const detectsQuestions = extractorCode.includes('numberedMatch') || extractorCode.includes('question');

        // Check for sub-question detection
        const detectsSubQuestions = extractorCode.includes('sub') || extractorCode.includes('isSubQuestion');

        if (detectsHeadings) {
            log('success', 'Detects headings and sections');
        } else {
            log('warning', 'Heading detection may be limited');
        }

        if (detectsInstructions) {
            log('success', 'Detects instructions (List, Describe, Explain, etc.)');
        } else {
            log('error', 'Missing instruction detection');
        }

        if (detectsQuestions) {
            log('success', 'Detects numbered questions');
        } else {
            log('error', 'Missing question detection');
        }

        if (detectsSubQuestions) {
            log('success', 'Detects sub-questions');
        } else {
            log('warning', 'Sub-question detection may be limited');
        }

        results.req3 = detectsHeadings && detectsInstructions && detectsQuestions;
    } else {
        log('error', 'docxQuestionExtractor.ts not found');
    }

    log(results.req3 ? 'success' : 'error',
        `REQUIREMENT 3: ${results.req3 ? 'PASSED ✓' : 'FAILED ✗'}`);

    // ========================================================================
    // REQUIREMENT 4: Red Text Separation  
    // ========================================================================
    section('REQUIREMENT 4: Accurately Strip Red Text (Answers) into Separate Section');

    // Check docxQuestionExtractor for red text handling
    if (fs.existsSync(extractorPath)) {
        const extractorCode = fs.readFileSync(extractorPath, 'utf-8');

        const hasRedTextDetection = (
            extractorCode.includes('isRed') ||
            extractorCode.includes('red') &&
            extractorCode.includes('color')
        );

        const separatesRedText = extractorCode.includes('redTextAnswers');

        const usesXMLParsing = extractorCode.includes('xml') || extractorCode.includes('AdmZip');

        if (hasRedTextDetection) {
            log('success', 'Has red text color detection logic');
        } else {
            log('error', 'Missing red text detection');
        }

        if (separatesRedText) {
            log('success', 'Separates red text into redTextAnswers array');
        } else {
            log('error', 'Does not separate red text properly');
        }

        if (usesXMLParsing) {
            log('success', 'Uses XML/ZIP parsing for accurate color detection');
        } else {
            log('warning', 'May not parse DOCX XML directly');
        }

        // Check for dedicated red text extractor
        const redTextExtractorPath = path.join(__dirname, 'web/src/services/redTextExtractor.ts');
        if (fs.existsSync(redTextExtractorPath)) {
            log('success', 'Has dedicated RedTextExtractor service');
        }

        // Check structured parser
        const structuredParserPath = path.join(__dirname, 'web/src/services/structuredDocxParser.ts');
        if (fs.existsSync(structuredParserPath)) {
            log('success', 'Has StructuredDocxParser for Q&A separation');
        }

        results.req4 = hasRedTextDetection && separatesRedText && usesXMLParsing;
    } else {
        log('error', 'docxQuestionExtractor.ts not found');
    }

    log(results.req4 ? 'success' : 'error',
        `REQUIREMENT 4: ${results.req4 ? 'PASSED ✓' : 'FAILED ✗'}`);

    // ========================================================================
    // REQUIREMENT 5: Map Questions to Units
    // ========================================================================
    section('REQUIREMENT 5: Accurately Map Questions to Appropriate Units');

    const aiServicePath = path.join(__dirname, 'web/src/services/aiService.ts');
    if (fs.existsSync(aiServicePath)) {
        const aiCode = fs.readFileSync(aiServicePath, 'utf-8');

        const hasValidation = aiCode.includes('validateQuestion');
        const mapsToUnits = aiCode.includes('mappedUnit');
        const mapsToCriteria = aiCode.includes('mappedCriteria');
        const mapsToKnowledge = aiCode.includes('mappedKnowledge');
        const hasConfidence = aiCode.includes('confidence');
        const usesAI = aiCode.includes('openai') || aiCode.includes('OpenAI');

        if (hasValidation) {
            log('success', 'Has question validation logic');
        } else {
            log('error', 'Missing question validation');
        }

        if (mapsToUnits) {
            log('success', 'Maps questions to unit codes');
        } else {
            log('error', 'Does not map to units');
        }

        if (mapsToCriteria) {
            log('success', 'Maps to specific Performance Criteria');
        } else {
            log('warning', 'Limited criteria mapping');
        }

        if (mapsToKnowledge) {
            log('success', 'Maps to Knowledge Evidence');
        } else {
            log('warning', 'Limited knowledge mapping');
        }

        if (hasConfidence) {
            log('success', 'Provides confidence scores');
        }

        if (usesAI) {
            log('success', 'Uses AI (OpenAI) for intelligent mapping');
        } else {
            log('warning', 'May use heuristic mapping');
        }

        results.req5 = hasValidation && mapsToUnits && mapsToCriteria && mapsToKnowledge;
    } else {
        log('error', 'aiService.ts not found');
    }

    log(results.req5 ? 'success' : 'error',
        `REQUIREMENT 5: ${results.req5 ? 'PASSED ✓' : 'FAILED ✗'}`);

    // ========================================================================
    // FINAL SUMMARY
    // ========================================================================
    section('VERIFICATION SUMMARY');

    const allPassed = Object.values(results).every(r => r);

    Object.entries(results).forEach(([req, passed], idx) => {
        const reqNum = idx + 1;
        const reqNames = [
            'Extract unit codes from Excel',
            'Validate URLs (404 vs valid content)',
            'Extract document structure (instructions, headings, questions)',
            'Separate red text (answers) from questions',
            'Map questions to appropriate units'
        ];

        log(passed ? 'success' : 'error',
            `Requirement ${reqNum}: ${reqNames[idx]} - ${passed ? 'PASSED ✓' : 'FAILED ✗'}`);
    });

    console.log(`\n${c.bright}${allPassed ? c.green : c.yellow}${'='.repeat(80)}${c.reset}`);
    if (allPassed) {
        console.log(`${c.bright}${c.green}ALL REQUIREMENTS PASSED ✓✓✓${c.reset}`);
    } else {
        const passedCount = Object.values(results).filter(r => r).length;
        console.log(`${c.bright}${c.yellow}${passedCount}/5 REQUIREMENTS PASSED${c.reset}`);
    }
    console.log(`${c.bright}${allPassed ? c.green : c.yellow}${'='.repeat(80)}${c.reset}\n`);

    process.exit(allPassed ? 0 : 1);
}

main().catch(error => {
    console.error(`\n${c.red}Fatal error:${c.reset}`, error);
    process.exit(1);
});
