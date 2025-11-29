#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const UNIT_MAPPINGS = {
    'MARK007': {
        fullCode: 'MARK007',
        title: 'Handle a vessel up to 12 metres',
        keywords: ['vessel handling', 'maneuvering', 'steering', 'crossing bar', 'weather', 'emergency', 'grounding', 'person overboard', 'towing', 'squatting', 'shallow water', 'mooring lines', 'stability', 'heel', 'list', 'trim', 'capsizing', 'berthing'],
        sections: ['emergency preparedness', 'vessel handling', 'watertight integrity', 'part a', 'part b'],
        questionPatterns: [/crossing.*bar/i, /bad weather/i, /grounding/i, /person.*overboard/i, /tow/i, /squatting/i, /shallow water/i, /mooring line/i, /stability term/i, /heel/i, /list/i, /trim/i]
    },
    'MARN008': {
        fullCode: 'MARN008',
        title: 'Apply seamanship skills aboard a vessel up to 12 metres',
        keywords: ['seamanship', 'rope', 'ropework', 'lifting', 'WLL', 'working load', 'anchor', 'anchoring', 'beaching', 'mooring', 'refuelling', 'fuel', 'watertight', 'hull', 'compartments', 'bilge', 'freeboard', 'bulkhead', 'scupper', 'pre-start checks', 'knot', 'splice', 'bowline'],
        sections: ['ropework', 'anchoring', 'pre-start', 'refuelling', 'construction', 'watertight', 'part 1', 'part 3', 'part 4', 'part 7'],
        questionPatterns: [/WLL/i, /working.*load/i, /rope/i, /knot/i, /splice/i, /anchor/i, /refuel/i, /fuel.*spill/i, /watertight/i, /hull/i, /bilge/i]
    },
    'MARI003': {
        fullCode: 'MARI003',
        title: 'Comply with regulations to ensure safe operation of a vessel up to 12 metres',
        keywords: ['regulations', 'legislation', 'domestic', 'DCV', 'compliance', 'NSCV', 'marine orders', 'SMS', 'certification', 'master', 'crew', 'distress', 'mayday', 'emergency', 'documentation', 'logbook', 'safety equipment', 'COLREGS', 'buoyage', 'IALA', 'watchkeeping', 'lookout', 'safe speed', 'collision', 'cardinal mark'],
        sections: ['domestic regulations', 'watchkeeping', 'emergency', 'part 2', 'watchkeeping'],
        questionPatterns: [/legislation/i, /DCV/i, /marine.*order/i, /certification/i, /logbook/i, /distress/i, /mayday/i, /COLREG/i, /buoyage/i, /cardinal/i, /watchkeeping/i]
    }
};

class ImprovedAssessmentValidator {
    async extractText(docxPath) {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ path: docxPath });
        return result.value;
    }

    parseAssessment(text) {
        const lines = text.split('\n');
        const mappings = [];
        let currentSection = '';
        let currentPartLetter = '';
        let currentQuestion = null;
        let questionCounter = 0;
        let inSubParts = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const partMatch = line.match(/^Part\s+([A-C])\]\s*(.+)/i);s*[-
            if (partMatch) {
                if (currentQuestion) {
                    const mapping = this.analyzeQuestion(currentQuestion.number, currentQuestion.text, currentSection);
                    if (mapping) mappings.push(mapping);
                    currentQuestion = null;
                }
                currentPartLetter = partMatch[1];
                currentSection = partMatch[2].trim();
                questionCounter = 0;
                inSubParts = false;
                console.log(`Found section: Part ${currentPartLetter} - ${currentSection}`);
                continue;
            }

            const numberedMatch = line.match(/^(\d+)\.\s+(.+)/);
            const listQuestionMatch = line.match(/^List\s+(SIX|FIVE|FOUR|THREE|TWO|ONE|\d+)\s+(.+)/i);
            
            if (numberedMatch || listQuestionMatch) {
                if (currentQuestion) {
                    const mapping = this.analyzeQuestion(currentQuestion.number, currentQuestion.text, currentSection);
                    if (mapping) mappings.push(mapping);
                }
                questionCounter++;
                inSubParts = false;
                
                if (numberedMatch) {
                    currentQuestion = {
                        number: `${currentPartLetter || ''}${numberedMatch[1]}`,
                        text: numberedMatch[2]
                    };
                } else {
                    currentQuestion = {
                        number: `${currentPartLetter || 'Q'}${questionCounter}`,
                        text: line
                    };
                }
                
                if (currentQuestion.text.match(/describe.*follow.*term/i) || currentQuestion.text.match(/define.*follow/i)) {
                    inSubParts = true;
                }
                continue;
            }

            const subPartLabel = line.match(/^(Heel|List|Trim|Off-Center|Negative GM|Combination):/i);
            if (subPartLabel && currentQuestion && inSubParts) {
                currentQuestion.text += ' | ' + line;
                let j = i + 1;
                while (j < lines.length && lines[j].trim() && !lines[j].trim().match(/^(Heel|List|Trim|Off-Center|Negative GM|Combination|Part|PART|\d+\.):/i)) {
                    currentQuestion.text += ' ' + lines[j].trim();
                    j++;
                }
                i = j - 1;
                continue;
            }

            const subMatch = line.match(/^([a-z])\)\s+(.+)/i);
            if (subMatch && currentQuestion && !inSubParts) {
                const subQuestion = {
                    number: `${currentQuestion.number}${subMatch[1]}`,
                    text: subMatch[2],
                    parent: currentQuestion.number
                };
                const mapping = this.analyzeQuestion(subQuestion.number, subQuestion.text, currentSection);
                if (mapping) mappings.push(mapping);
                continue;
            }

            if (currentQuestion && !inSubParts && line.length > 15 && !line.match(/^[A-Z]{4}\d{3}/) && !line.match(/^Part [A-C]/i)) {
                currentQuestion.text += ' ' + line;
            }
        }

        if (currentQuestion) {
            const mapping = this.analyzeQuestion(currentQuestion.number, currentQuestion.text, currentSection);
            if (mapping) mappings.push(mapping);
        }

        return mappings;
    }

    analyzeQuestion(questionNumber, questionText, section) {
        if (!questionText || questionText.length < 5) return null;
        const lowerText = questionText.toLowerCase();
        const lowerSection = (section || '').toLowerCase();
        const unitScores = new Map();

        for (const [unitCode, unitData] of Object.entries(UNIT_MAPPINGS)) {
            let score = 0;
            const matches = [];

            for (const sectionKeyword of unitData.sections) {
                if (lowerSection.includes(sectionKeyword.toLowerCase())) {
                    score += 40;
                    matches.push(`SECTION:${sectionKeyword}`);
                    break;
                }
            }

            for (const pattern of unitData.questionPatterns || []) {
                if (pattern.test(questionText)) {
                    score += 50;
                    matches.push(`PATTERN:${pattern.source}`);
                }
            }

            for (const keyword of unitData.keywords) {
                const keywordRegex = new RegExp(`\\b${keyword.replace(/\s+/g, '\\s+')}\\b`, 'i');
                if (keywordRegex.test(questionText)) {
                    score += 10;
                    matches.push(keyword);
                }
            }

            if (matches.length > 3) {
                score += (matches.length - 3) * 5;
            }

            if (score > 0) {
                unitScores.set(unitCode, { score, matches });
            }
        }

        const sortedUnits = Array.from(unitScores.entries())
            .filter(([_, data]) => data.score >= 20)
            .sort((a, b) => b[1].score - a[1].score)
            .slice(0, 3);

        if (sortedUnits.length === 0) return null;

        const units = sortedUnits.map(([code, data]) => ({
            code,
            title: UNIT_MAPPINGS[code].title,
            score: data.score,
            matches: data.matches.slice(0, 5)
        }));

        const primaryUnit = units[0];
        const confidence = Math.min(95, Math.round((primaryUnit.score / (primaryUnit.score + 20)) * 100));

        return {
            questionNumber,
            questionText: questionText.substring(0, 150) + (questionText.length > 150 ? '...' : ''),
            section,
            primaryUnit: primaryUnit.code,
            confidence,
            allUnits: units
        };
    }

    generateReport(assessmentName, mappings) {
        const unitSummary = new Map();
        mappings.forEach(mapping => {
            if (!unitSummary.has(mapping.primaryUnit)) {
                unitSummary.set(mapping.primaryUnit, { questions: [], totalScore: 0, count: 0 });
            }
            const summary = unitSummary.get(mapping.primaryUnit);
            summary.questions.push(mapping);
            summary.totalScore += mapping.allUnits[0].score;
            summary.count++;
        });

        const sortedUnits = Array.from(unitSummary.entries()).sort((a, b) => b[1].count - a[1].count);

\n';        let report = '
        report += '  IMPROVED ASSESSMENT VALIDATION REPORT\n';
\n\n';        report += '
        report += `Assessment: ${assessmentName}\n`;
        report += `Total Questions Detected: ${mappings.length}\n`;
        report += `Analysis Date: ${new Date().toLocaleString()}\n\n`;
        
\n';        report += '
        report += 'RECOMMENDED UNITS OF COMPETENCY\n';
\n\n';        report += '

        sortedUnits.forEach(([unitCode, data]) => {
            const avgScore = Math.round(data.totalScore / data.count);
            const coverage = Math.round((data.count / mappings.length) * 100);
            report += `${unitCode}: ${UNIT_MAPPINGS[unitCode].title}\n`;
            report += `  Questions Matched: ${data.count}/${mappings.length}\n`;
            report += `  Average Score: ${avgScore} points\n`;
            report += `  Coverage: ${coverage}%\n\n`;
        });

\n';        report += '
        report += 'DETAILED QUESTION ANALYSIS\n';
\n\n';        report += '

        mappings.forEach(mapping => {
            report += `Question ${mapping.questionNumber} [${mapping.section}]\n`;
            report += `  "${mapping.questionText}"\n\n`;
            report += `  Primary Unit: ${mapping.primaryUnit} (${mapping.confidence}% confidence)\n`;
            report += `  All Matching Units:\n`;
            mapping.allUnits.forEach(unit => {
                 ${unit.code}: ${unit.title}\n`;report += `    
                report += `      Score: ${unit.score} points\n`;
                report += `      Key Matches: ${unit.matches.join(', ')}\n`;
            });
            report += '\n';
        });

        return report;
    }

    async validate(docxPath) {
        try {
            const assessmentName = path.basename(docxPath);
            console.log(`alyzing: ${assessmentName}`);
            const text = await this.extractText(docxPath);
            const mappings = this.parseAssessment(text);
            console. Detected ${mappings.length} questions`);log(`
            const report = this.generateReport(assessmentName, mappings);
            const reportPath = docxPath.replace('.docx', '_IMPROVED_REPORT.txt');
            fs.writeFileSync(reportPath, report);
            console. Report saved: ${reportPath}`);log(`
            return { mappings, report };
        } catch (error) {
            console. Error:', error.message);error('
            throw error;
        }
    }
}

async function main() {
    const docxPath = process.argv[2];
    if (!docxPath) {
        console.error('Usage: node improved-validator.cjs <path-to-docx>');
        process.exit(1);
    }
    if (!fs.existsSync(docxPath)) {
        console.error(`Error: File not found: ${docxPath}`);
        process.exit(1);
    }
    const validator = new ImprovedAssessmentValidator();
    await validator.validate(docxPath);
    console. Validation complete!');log('
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = ImprovedAssessmentValidator;
