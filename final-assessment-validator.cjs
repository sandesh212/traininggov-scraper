#!/usr/bin/env node
/**
 * Fixed Assessment Validator - Improved Question Detection
 * Handles both numbered questions and bullet-point style questions
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Comprehensive unit mappings with enhanced keywords
const UNIT_MAPPINGS = {
    'MARK007': {
        fullCode: 'MARK007',
        title: 'Handle a vessel up to 12 metres',
        keywords: [
            'vessel handling', 'maneuvering', 'manoeuvring', 'steering', 'propulsion',
            'crossing bar', 'weather', 'emergency', 'grounding', 'person overboard',
            'towing', 'squatting', 'shallow water', 'interaction', 'mooring lines',
            'stability', 'heel', 'list', 'trim', 'capsizing', 'swamping', 'seas',
            'berthing', 'unberthing', 'single engine', 'fixed propeller', 'jet unit',
            'tiller steering', 'outboard', 'manoeuvring characteristics'
        ],
        sections: ['emergency preparedness', 'vessel handling', 'watertight integrity', 'part a', 'part b'],
        questionPatterns: [
            /crossing.*bar/i, /bad weather/i, /tropical.*storm/i, /grounding/i,
            /person.*overboard/i, /man.*overboard/i, /tow/i, /squatting/i,
            /shallow water/i, /mooring line/i, /stability term/i, /heel/i, /list/i, /trim/i
        ]
    },
    'MARN008': {
        fullCode: 'MARN008',
        title: 'Apply seamanship skills aboard a vessel up to 12 metres',
        keywords: [
            'seamanship', 'rope', 'ropework', 'lifting', 'sling', 'WLL', 'working load',
            'anchor', 'anchoring', 'beaching', 'mooring', 'refuelling', 'fuel',
            'watertight', 'hull integrity', 'compartments', 'bilge', 'freeboard',
            'bulkhead', 'scupper', 'pre-start checks', 'equipment test', 'knot',
            'splice', 'bowline', 'clove hitch', 'reef knot', 'sheet bend'
        ],
        sections: ['ropework', 'anchoring', 'pre-start', 'refuelling', 'construction', 'watertight', 'part 1', 'part 3', 'part 4', 'part 7'],
        questionPatterns: [
            /WLL/i, /working.*load/i, /rope/i, /knot/i, /splice/i, /anchor/i,
            /refuel/i, /fuel.*spill/i, /watertight/i, /hull/i, /bilge/i
        ]
    },
    'MARI003': {
        fullCode: 'MARI003',
        title: 'Comply with regulations to ensure safe operation of a vessel up to 12 metres',
        keywords: [
            'regulations', 'legislation', 'domestic', 'DCV', 'compliance', 'NSCV',
            'marine orders', 'safety management', 'SMS', 'certification', 'master',
            'crew', 'distress', 'mayday', 'emergency', 'documentation', 'logbook',
            'safety equipment', 'collision regulations', 'COLREGS', 'buoyage', 'IALA',
            'watchkeeping', 'lookout', 'safe speed', 'risk of collision', 'cardinal mark',
            'service category', 'induction', 'stand-on', 'give-way', 'fog signal'
        ],
        sections: ['domestic regulations', 'watchkeeping', 'emergency', 'part 2', 'watchkeeping'],
        questionPatterns: [
            /legislation/i, /DCV/i, /marine.*order/i, /certification/i, /logbook/i,
            /distress/i, /mayday/i, /COLREG/i, /buoyage/i, /cardinal/i, /watchkeeping/i
        ]
    },
    'MARC037': {
        fullCode: 'MARC037',
        title: 'Operate inboard and outboard motors',
        keywords: [
            'engine', 'motor', 'outboard', 'inboard', 'propulsion', 'start', 'fail',
            'overheat', 'overheating', 'fuel system', 'electrical', 'battery',
            'cooling', 'propeller', 'prop', 'pre-start check', 'maintenance',
            'lubrication', 'gearbox', 'fuel consumption', 'refuel', 'unsafe equipment',
            'pre-departure', 'start-up procedure'
        ],
        sections: ['outboards', 'vessel systems', 'pre-start', 'part 4', 'part 5', 'part c'],
        questionPatterns: [
            /engine.*overheat/i, /engine.*fail/i, /outboard/i, /inboard/i,
            /fuel.*system/i, /electrical.*system/i, /battery/i, /propeller/i
        ]
    },
    'MARJ006': {
        fullCode: 'MARJ006',
        title: 'Follow environmental work practices',
        keywords: [
            'environmental', 'pollution', 'MARPOL', 'waste', 'garbage', 'disposal',
            'fuel spill', 'spillage', 'sewage', 'discharge', 'recycle', 'compact',
            'storage', 'chemicals', 'oil', 'waste oil', 'anchoring impact', 'noise',
            'propeller wash', 'bilge', 'annex'
        ],
        sections: ['environmental', 'refuelling', 'anchoring', 'part 6'],
        questionPatterns: [
            /MARPOL/i, /annex/i, /garbage/i, /waste/i, /sewage/i, /fuel.*spill/i,
            /environmental.*impact/i, /pollution/i
        ]
    },
    'MARH013': {
        fullCode: 'MARH013',
        title: 'Plan and navigate a passage for a vessel up to 12 metres',
        keywords: [
            'voyage plan', 'navigation', 'passage', 'chart', 'fuel calculation',
            'fuel consumption', 'route', 'weather forecast', 'conditions', 'tide',
            'distance', 'safe water', 'hazards', 'plan', 'departure', 'destination'
        ],
        sections: ['voyage planning', 'pre-start', 'part 4'],
        questionPatterns: [
            /voyage.*plan/i, /fuel.*consumption/i, /fuel.*calc/i, /navigation/i,
            /chart/i, /passage/i
        ]
    }
};

class FixedAssessmentValidator {
    constructor(assessmentPath) {
        this.assessmentFile = assessmentPath;
        const baseName = path.basename(assessmentPath, path.extname(assessmentPath));
        this.outputFile = `${baseName}_FIXED_REPORT.txt`;
    }

    /**
     * Extract text from DOCX file
     */
    async extractTextFromDocx(filePath) {
        try {
            const { stdout } = await execPromise(`textutil -convert txt "${filePath}" -stdout 2>/dev/null`);
            return stdout;
        } catch (error) {
            throw new Error(`Failed to extract text from DOCX: ${error.message}`);
        }
    }

    /**
     * Parse assessment document with improved question detection
     */
    parseAssessmentDocument(content) {
        const mappings = [];
        const lines = content.split('\n');
        let currentSection = '';
        let currentPartLetter = '';
        let questionCounter = 0;
        let currentQuestion = null;
        let inSubParts = false;  // Add this tracking flag

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Skip empty lines
            if (!line) continue;

            // Detect Part headers (Part A, Part B, Part C, etc.)
            const partMatch = line.match(/^Part\s+([A-C])\s*[–-]\s*(.+)/i) || 
                            line.match(/^PART\s+([A-C])\s*[–-]\s*(.+)/i);
            if (partMatch) {
                currentPartLetter = partMatch[1];
                currentSection = partMatch[2].trim();
                questionCounter = 0;
                console.log(`Found section: Part ${currentPartLetter} - ${currentSection}`);
                continue;
            }

            // Skip answer-like patterns that look like questions
            const isAnswerPattern = (line && line.match && line.match(/^(No fuel|Disconnected|Line fitted|Blocked|Off-Center|Negative GM|Combination of)/i)) ||
                                  (line && line.match && line.match(/^\d+\./) && line.length < 50 && !line.endsWith('?')) ||
                                  (line && line.match && line.match(/^[a-z]\)/) && line.length < 40);
            
            if (isAnswerPattern && currentQuestion) {
                // This looks like an answer to the current question, skip it
                continue;
            }
            
            // Detect ALL question patterns:
            // 1. Numbered questions: 1., 2., 3., etc. (longer text, ends with?)
            // 2. Lettered questions: a), b), c), etc. 
            // 3. List questions: "List X...", "List six (6)..."
            // 4. Question words: "What", "How", "When", "Where", "Why", "Match", "Describe", "Explain", "Define", "Identify"
            // 5. Action verbs: "State", "Name", "Give", "Provide"
            
            const numberedMatch = line && line.match && line.match(/^(\d+)\.\s+(.+)/) && line.length > 50;
            const letteredMatch = line && line.match && line.match(/^([a-z])\)\s+(.+)/i);
            const listQuestionMatch = line && line.match && line.match(/^List\s+(SIX|FIVE|FOUR|THREE|TWO|ONE|\d+|\w+\s*\(\d+\))\s+(.+)/i);
            const questionWordMatch = line && line.match && line.match(/^(What|How|When|Where|Why|Which|Match|Describe|Explain|Define|Identify|State|Name|Give|Provide)\s+(.+)/i);
            
            const isQuestion = (numberedMatch && line.length > 50) || letteredMatch || listQuestionMatch || questionWordMatch ||
                             (line && line.endsWith && line.endsWith('?') && line.length > 15);  // Questions ending with ?
            
            if (isQuestion) {
                // Save previous question
                if (currentQuestion) {
                    const mapping = this.analyzeQuestion(
                        currentQuestion.number,
                        currentQuestion.text,
                        currentSection
                    );
                    if (mapping) mappings.push(mapping);
                }

                questionCounter++;
                inSubParts = false;  // Reset sub-parts flag
                inSubParts = false;  // Reset sub-parts flag
                
                let questionText = line;
                let questionNum = `${currentPartLetter || 'Q'}${questionCounter}`;
                
                if (numberedMatch) {
                    questionNum = `${currentPartLetter || ''}${numberedMatch[1]}`;
                    questionText = numberedMatch[2];
                } else if (letteredMatch) {
                    questionNum = `${currentPartLetter || ''}${letteredMatch[1]}`;
                    questionText = letteredMatch[2];
                } else if (listQuestionMatch) {
                    questionText = line;
                } else if (questionWordMatch) {
                    questionText = line;
                }
                
                currentQuestion = {
                    number: questionNum,
                    text: questionText
                };
                
                // Check if this question will have sub-part definitions (Heel, List, Trim, etc.)
                if (currentQuestion && currentQuestion.text && 
                    (currentQuestion.text.match(/describe.*follow.*term/i) || 
                     currentQuestion.text.match(/define.*follow/i) ||
                     currentQuestion.text.match(/stability term/i))) {
                    inSubParts = true;
                }
                
                continue;
            }

            // Detect sub-part labels within a question (Heel:, List:, Trim:, etc.)
            // These are NOT separate questions, they're part of the current question
            const subPartLabel = line.match(/^(Heel|List|Trim|Off-Center|Negative GM|Combination):/i);
            if (subPartLabel && currentQuestion && inSubParts) {
                // This is a definition label, append to current question
                currentQuestion.text += ' | ' + line;
                
                // Continue collecting the definition text
                let j = i + 1;
                while (j < lines.length && lines[j].trim() && 
                       !lines[j].trim().match(/^(Heel|List|Trim|Off-Center|Negative GM|Combination|Part|PART|\d+\.):/i)) {
                    currentQuestion.text += ' ' + lines[j].trim();
                    j++;
                }
                i = j - 1; // Skip the processed lines
                continue;
            }

            // Detect bullet-point questions (• followed by question text)
            const bulletMatch = line.match(/^[•\*]\s+(.+)/);
            if (bulletMatch && bulletMatch[1].match(/\?$/)) {
                // This is a question in bullet form
                if (currentQuestion) {
                    const mapping = this.analyzeQuestion(
                        currentQuestion.number,
                        currentQuestion.text,
                        currentSection
                    );
                    if (mapping) mappings.push(mapping);
                }

                questionCounter++;
                inSubParts = false;  // Reset sub-parts flag
                currentQuestion = {
                    number: `${currentPartLetter || 'Q'}${questionCounter}`,
                    text: bulletMatch[1]
                };
                continue;
            }

            // Detect sub-questions (a), b), c), etc.)
            const subMatch = line.match(/^([a-z])\)\s+(.+)/i);
            if (subMatch && currentQuestion) {
                const subQuestion = {
                    number: `${currentQuestion.number}${subMatch[1]}`,
                    text: subMatch[2],
                    parent: currentQuestion.number
                };
                
                const mapping = this.analyzeQuestion(
                    subQuestion.number,
                    subQuestion.text,
                    currentSection
                );
                if (mapping) mappings.push(mapping);
                continue;
            }

            // Append to current question if it's a continuation
            if (currentQuestion && line.length > 20 && !line.match(/^[A-Z]{4}\d{3}/)) {
                currentQuestion.text += ' ' + line;
            }
        }

        // Don't forget the last question
        if (currentQuestion) {
            const mapping = this.analyzeQuestion(
                currentQuestion.number,
                currentQuestion.text,
                currentSection
            );
            if (mapping) mappings.push(mapping);
        }

        return mappings;
    }

    /**
     * Analyze a question and match it to appropriate units with enhanced scoring
     */
    analyzeQuestion(questionNumber, questionText, section) {
        if (!questionText || questionText.length < 5) return null;

        const lowerText = questionText.toLowerCase();
        const lowerSection = (section || '').toLowerCase();
        const unitScores = new Map();

        // Score each unit
        for (const [unitCode, unitData] of Object.entries(UNIT_MAPPINGS)) {
            let score = 0;
            const matches = [];

            // Section match (high weight - 40 points)
            for (const sectionKeyword of unitData.sections) {
                if (lowerSection.includes(sectionKeyword.toLowerCase())) {
                    score += 40;
                    matches.push(`SECTION:${sectionKeyword}`);
                    break;
                }
            }

            // Pattern matching (very high weight - 50 points)
            for (const pattern of unitData.questionPatterns || []) {
                if (pattern.test(questionText)) {
                    score += 50;
                    matches.push(`PATTERN:${pattern.source}`);
                }
            }

            // Keyword matching (10 points per keyword)
            for (const keyword of unitData.keywords) {
                const keywordRegex = new RegExp(`\\b${keyword.replace(/\s+/g, '\\s+')}\\b`, 'i');
                if (keywordRegex.test(questionText)) {
                    score += 10;
                    matches.push(keyword);
                }
            }

            // Bonus for multiple matches
            if (matches.length > 3) {
                score += (matches.length - 3) * 5;
            }

            if (score > 0) {
                unitScores.set(unitCode, { score, matches });
            }
        }

        // Get top matching units (threshold: at least 20 points)
        const sortedUnits = Array.from(unitScores.entries())
            .filter(([_, data]) => data.score >= 20)
            .sort((a, b) => b[1].score - a[1].score)
            .slice(0, 3);

        if (sortedUnits.length === 0) {
            return null;
        }

        const units = sortedUnits.map(([code, data]) => ({
            unitCode: code,
            title: UNIT_MAPPINGS[code].title,
            score: data.score,
            matches: data.matches.slice(0, 5)
        }));

        const maxScore = sortedUnits[0][1].score;
        const confidence = Math.min(95, Math.round((maxScore / 150) * 100));

        return {
            questionNumber,
            questionText: questionText.substring(0, 150) + (questionText.length > 150 ? '...' : ''),
            section: section || 'Unknown',
            units,
            confidence,
            primaryUnit: units[0].unitCode
        };
    }

    /**
     * Generate comprehensive validation report
     */
    generateReport(mappings) {
        let report = '';
        
        report += '═══════════════════════════════════════════════════════════════\n';
        report += '  FIXED ASSESSMENT VALIDATION REPORT\n';
        report += '═══════════════════════════════════════════════════════════════\n\n';
        report += `Assessment: ${path.basename(this.assessmentFile)}\n`;
        report += `Total Questions Detected: ${mappings.length}\n`;
        report += `Analysis Date: ${new Date().toLocaleString()}\n\n`;

        // Unit summary
        const unitStats = new Map();
        for (const mapping of mappings) {
            for (const unit of mapping.units) {
                if (!unitStats.has(unit.unitCode)) {
                    unitStats.set(unit.unitCode, { 
                        count: 0, 
                        totalScore: 0, 
                        title: unit.title 
                    });
                }
                const stats = unitStats.get(unit.unitCode);
                stats.count++;
                stats.totalScore += unit.score;
            }
        }

        report += '───────────────────────────────────────────────────────────────\n';
        report += 'RECOMMENDED UNITS OF COMPETENCY\n';
        report += '───────────────────────────────────────────────────────────────\n\n';

        const sortedUnits = Array.from(unitStats.entries())
            .sort((a, b) => b[1].count - a[1].count);

        for (const [unitCode, stats] of sortedUnits) {
            const avgScore = Math.round(stats.totalScore / stats.count);
            report += `${unitCode}: ${stats.title}\n`;
            report += `  Questions Matched: ${stats.count}/${mappings.length}\n`;
            report += `  Average Score: ${avgScore} points\n`;
            report += `  Coverage: ${Math.round((stats.count / mappings.length) * 100)}%\n\n`;
        }

        // Detailed question mappings
        report += '───────────────────────────────────────────────────────────────\n';
        report += 'DETAILED QUESTION ANALYSIS\n';
        report += '───────────────────────────────────────────────────────────────\n\n';

        for (const mapping of mappings) {
            report += `Question ${mapping.questionNumber} [${mapping.section}]\n`;
            report += `  "${mapping.questionText}"\n\n`;
            report += `  Primary Unit: ${mapping.primaryUnit} (${mapping.confidence}% confidence)\n`;
            report += `  All Matching Units:\n`;
            
            for (const unit of mapping.units) {
                report += `    • ${unit.unitCode}: ${unit.title}\n`;
                report += `      Score: ${unit.score} points\n`;
                report += `      Key Matches: ${unit.matches.join(', ')}\n`;
            }
            report += '\n';
        }

        report += '═══════════════════════════════════════════════════════════════\n';
        report += 'END OF REPORT\n';
        report += '═══════════════════════════════════════════════════════════════\n';

        return report;
    }

    /**
     * Run the validation process
     */
    async validate() {
        try {
            console.log(`🔍 Analyzing: ${this.assessmentFile}`);
            
            // Extract text from DOCX
            const content = await this.extractTextFromDocx(this.assessmentFile);
            
            // Parse and analyze questions
            const mappings = this.parseAssessmentDocument(content);
            
            console.log(`✓ Detected ${mappings.length} questions`);
            
            // Generate report
            const report = this.generateReport(mappings);
            
            // Save report
            fs.writeFileSync(this.outputFile, report);
            console.log(`✓ Report saved: ${this.outputFile}`);
            console.log(`✓ Validation complete!`);
            
            return mappings;
        } catch (error) {
            console.error('❌ Error during validation:', error.message);
            throw error;
        }
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.error('Usage: node fixed-validator.js <assessment-file.docx>');
        process.exit(1);
    }

    const assessmentFile = args[0];
    
    if (!fs.existsSync(assessmentFile)) {
        console.error(`Error: File not found: ${assessmentFile}`);
        process.exit(1);
    }

    const validator = new FixedAssessmentValidator(assessmentFile);
    await validator.validate();
}

main().catch(console.error);
