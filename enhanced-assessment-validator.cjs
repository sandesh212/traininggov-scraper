#!/usr/bin/env ts-node
"use strict";
/**
 * Enhanced Assessment Validator with Accurate Unit Code Mapping
 * Based on actual assessment document analysis
 */
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
// Define comprehensive unit mappings based on actual assessment documents
const UNIT_MAPPINGS = {
    'MARK007': {
        fullCode: 'MARK007',
        title: 'Handle a vessel up to 12 metres',
        keywords: [
            'vessel handling', 'maneuvering', 'manoeuvring', 'steering', 'propulsion',
            'crossing bar', 'weather', 'emergency', 'grounding', 'person overboard',
            'towing', 'squatting', 'shallow water', 'interaction', 'mooring lines',
            'stability', 'heel', 'list', 'trim', 'capsizing', 'swamping', 'seas'
        ],
        sections: ['emergency preparedness', 'vessel handling', 'watertight integrity'],
        pcCodes: ['PC1.1', 'PC1.2', 'PC1.3', 'PC1.4', 'PC1.5', 'PC1.6', 'PC2.1', 'PC2.2', 'PC2.4', 'PC2.5', 'PC3.1', 'PC3.2', 'PC3.3', 'PC3.4', 'PC3.5', 'PC3.6', 'PC4.1', 'PC4.2'],
        knowledge: ['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7', 'K8', 'K9', 'K10', 'K11', 'K12', 'K13', 'K14', 'K15', 'K16', 'K17']
    },
    'MARN008': {
        fullCode: 'MARN008',
        title: 'Apply seamanship skills aboard a vessel up to 12 metres',
        keywords: [
            'seamanship', 'rope', 'ropework', 'lifting', 'sling', 'WLL', 'working load',
            'anchor', 'anchoring', 'beaching', 'mooring', 'refuelling', 'fuel',
            'watertight', 'hull integrity', 'compartments', 'bilge', 'freeboard',
            'bulkhead', 'scupper', 'pre-start checks', 'equipment test'
        ],
        sections: ['ropework', 'anchoring', 'pre-start', 'refuelling', 'construction', 'watertight'],
        pcCodes: ['PC1.1', 'PC1.2', 'PC1.3', 'PC1.4', 'PC1.5', 'PC1.6', 'PC2.1', 'PC2.2', 'PC2.3', 'PC2.4', 'PC2.5', 'PC3.1', 'PC3.2', 'PC3.3', 'PC4.1', 'PC4.2', 'PC4.3', 'PC4.4', 'PC4.5', 'PC4.6', 'PC5.1', 'PC5.2', 'PC5.3', 'PC5.4'],
        knowledge: ['K1', 'K2', 'K3', 'K4', 'K6', 'K7', 'K8', 'K9', 'K10', 'K11', 'K12', 'K13', 'K14', 'K15', 'K16', 'K17', 'K18', 'K19', 'K20', 'K21', 'K22', 'K23']
    },
    'MARI003': {
        fullCode: 'MARI003',
        title: 'Comply with regulations to ensure safe operation of a vessel up to 12 metres',
        keywords: [
            'regulations', 'legislation', 'domestic', 'DCV', 'compliance', 'NSCV',
            'marine orders', 'safety management', 'SMS', 'certification', 'master',
            'crew', 'distress', 'mayday', 'emergency', 'documentation', 'logbook',
            'safety equipment', 'collision regulations', 'COLREGS', 'buoyage', 'IALA',
            'watchkeeping', 'lookout', 'safe speed', 'risk of collision', 'cardinal mark'
        ],
        sections: ['domestic regulations', 'watchkeeping', 'emergency'],
        pcCodes: ['PC1.1', 'PC1.2', 'PC1.3', 'PC2.1', 'PC2.2', 'PC3.1', 'PC3.2', 'PC3.3', 'PC3.4', 'PC4.1', 'PC4.2', 'PC4.3', 'PC5.1', 'PC5.2'],
        knowledge: ['K1', 'K2', 'K4', 'K5', 'K6', 'K7', 'K8', 'K9', 'K10', 'K11', 'K12', 'K13', 'K14', 'K15', 'K16', 'K17']
    },
    'MARC037': {
        fullCode: 'MARC037',
        title: 'Operate inboard and outboard motors',
        keywords: [
            'engine', 'motor', 'outboard', 'inboard', 'propulsion', 'start', 'fail',
            'overheat', 'overheating', 'fuel system', 'electrical', 'battery',
            'cooling', 'propeller', 'prop', 'pre-start check', 'maintenance',
            'lubrication', 'gearbox', 'fuel consumption', 'refuel', 'unsafe equipment'
        ],
        sections: ['outboards', 'vessel systems', 'pre-start'],
        pcCodes: ['PC1.1', 'PC1.2', 'PC1.3', 'PC1.4', 'PC1.5', 'PC2.1', 'PC2.2', 'PC2.3', 'PC2.4', 'PC2.5', 'PC3.1', 'PC3.2', 'PC3.3', 'PC3.4', 'PC4.1', 'PC4.2', 'PC4.3'],
        knowledge: ['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7']
    },
    'MARJ006': {
        fullCode: 'MARJ006',
        title: 'Follow environmental work practices',
        keywords: [
            'environmental', 'pollution', 'MARPOL', 'waste', 'garbage', 'disposal',
            'fuel spill', 'spillage', 'sewage', 'discharge', 'recycle', 'compact',
            'storage', 'chemicals', 'oil', 'waste oil', 'anchoring impact', 'noise',
            'propeller wash', 'bilge'
        ],
        sections: ['environmental', 'refuelling', 'anchoring'],
        pcCodes: ['PC1.1', 'PC1.2', 'PC1.3', 'PC1.4', 'PC1.5', 'PC1.6', 'PC2.1', 'PC2.2', 'PC3.1', 'PC3.2'],
        knowledge: ['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7', 'K8', 'K10', 'K11']
    },
    'MARH013': {
        fullCode: 'MARH013',
        title: 'Plan and navigate a passage for a vessel up to 12 metres',
        keywords: [
            'voyage plan', 'navigation', 'passage', 'chart', 'fuel calculation',
            'fuel consumption', 'route', 'weather forecast', 'conditions', 'tide',
            'distance', 'safe water', 'hazards', 'plan', 'departure', 'destination'
        ],
        sections: ['voyage planning', 'pre-start'],
        pcCodes: ['PC1.1', 'PC1.2', 'PC2.1', 'PC2.2', 'PC3.1', 'PC3.2'],
        knowledge: ['K1', 'K2', 'K3', 'K4', 'K5', 'K6']
    }
};
class EnhancedAssessmentValidator {
    constructor(assessmentPath) {
        this.assessmentFile = assessmentPath;
        const baseName = path.basename(assessmentPath, path.extname(assessmentPath));
        this.outputFile = `${baseName}_ENHANCED_ANALYSIS.txt`;
    }
    /**
     * Parse assessment document and extract questions with context
     */
    parseAssessmentDocument(content) {
        const mappings = [];
        const lines = content.split('\n');
        let currentSection = '';
        let currentQuestionNumber = 0;
        let questionBuffer = [];
        let inQuestion = false;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            // Detect section headers
            if (line.match(/^Part [A-Z][\s–-]/i) || line.match(/^PART [A-Z][\s–-]/i)) {
                currentSection = line.replace(/^PART\s+/i, '').replace(/^Part\s+/i, '');
                continue;
            }
            // Detect question numbers with various patterns
            const questionMatch = line.match(/^(\d+)\.\s+(.+)/) ||
                line.match(/^Question\s+(\d+)[:\.]?\s*(.*)$/i) ||
                line.match(/^Q(\d+)[\.\)]\s*(.*)$/i);
            if (questionMatch) {
                // Save previous question if exists
                if (inQuestion && questionBuffer.length > 0) {
                    const mapping = this.analyzeQuestion(currentQuestionNumber.toString(), questionBuffer.join(' '), currentSection);
                    if (mapping)
                        mappings.push(mapping);
                }
                // Start new question
                currentQuestionNumber = parseInt(questionMatch[1]);
                questionBuffer = [questionMatch[2] || ''];
                inQuestion = true;
            }
            else if (inQuestion && line.length > 0 && !line.match(/^[A-Z]+\d+/)) {
                // Continue current question (multi-line)
                questionBuffer.push(line);
            }
            // Detect sub-questions (a), b), c), etc.)
            const subQuestionMatch = line.match(/^([a-z])\)\s+(.+)/i);
            if (subQuestionMatch && inQuestion) {
                const subQuestion = `${currentQuestionNumber}${subQuestionMatch[1]}`;
                const subText = subQuestionMatch[2];
                const mapping = this.analyzeQuestion(subQuestion, subText, currentSection);
                if (mapping)
                    mappings.push(mapping);
            }
        }
        // Don't forget the last question
        if (inQuestion && questionBuffer.length > 0) {
            const mapping = this.analyzeQuestion(currentQuestionNumber.toString(), questionBuffer.join(' '), currentSection);
            if (mapping)
                mappings.push(mapping);
        }
        return mappings;
    }
    /**
     * Analyze a question and match it to appropriate units
     */
    analyzeQuestion(questionNumber, questionText, section) {
        if (!questionText || questionText.length < 10)
            return null;
        const lowerText = questionText.toLowerCase();
        const lowerSection = section.toLowerCase();
        const unitScores = new Map();
        // Score each unit based on keyword matches
        for (const [unitCode, unitData] of Object.entries(UNIT_MAPPINGS)) {
            let score = 0;
            const matches = [];
            // Check section match (high weight)
            for (const sectionKeyword of unitData.sections) {
                if (lowerSection.includes(sectionKeyword)) {
                    score += 30;
                    matches.push(`section:${sectionKeyword}`);
                }
            }
            // Check keyword matches
            for (const keyword of unitData.keywords) {
                if (lowerText.includes(keyword.toLowerCase())) {
                    score += 10;
                    matches.push(keyword);
                }
            }
            // Bonus for multiple keyword matches
            if (matches.length > 3) {
                score += matches.length * 2;
            }
            if (score > 0) {
                unitScores.set(unitCode, { score, matches });
            }
        }
        // Sort units by score
        const sortedUnits = Array.from(unitScores.entries())
            .sort((a, b) => b[1].score - a[1].score)
            .slice(0, 4); // Top 4 units
        if (sortedUnits.length === 0) {
            return null;
        }
        const units = sortedUnits.map(([code, data]) => ({
            unitCode: code,
            performanceCriteria: UNIT_MAPPINGS[code].pcCodes || [],
            knowledge: UNIT_MAPPINGS[code].knowledge || [],
            description: UNIT_MAPPINGS[code].title
        }));
        const maxScore = sortedUnits[0][1].score;
        const confidence = Math.min(95, Math.round((maxScore / 100) * 100));
        return {
            questionNumber,
            questionText: questionText.substring(0, 200) + (questionText.length > 200 ? '...' : ''),
            section,
            units,
            confidence,
            rationale: `Matched ${sortedUnits[0][1].matches.length} keywords: ${sortedUnits[0][1].matches.slice(0, 5).join(', ')}`
        };
    }
    /**
     * Generate comprehensive validation report
     */
    generateReport(mappings) {
        let report = '';
        report += '═══════════════════════════════════════════════════════════════\n';
        report += '  ENHANCED ASSESSMENT VALIDATION REPORT\n';
        report += '═══════════════════════════════════════════════════════════════\n\n';
        report += `Assessment: ${path.basename(this.assessmentFile)}\n`;
        report += `Total Questions Detected: ${mappings.length}\n`;
        report += `Analysis Date: ${new Date().toLocaleString()}\n\n`;
        // Unit summary
        const unitStats = new Map();
        for (const mapping of mappings) {
            for (const unit of mapping.units) {
                if (!unitStats.has(unit.unitCode)) {
                    unitStats.set(unit.unitCode, { count: 0, avgConfidence: 0 });
                }
                const stats = unitStats.get(unit.unitCode);
                stats.count++;
                stats.avgConfidence += mapping.confidence;
            }
        }
        report += '───────────────────────────────────────────────────────────────\n';
        report += 'RECOMMENDED UNITS OF COMPETENCY\n';
        report += '───────────────────────────────────────────────────────────────\n\n';
        const sortedUnits = Array.from(unitStats.entries())
            .sort((a, b) => b[1].count - a[1].count);
        for (const [unitCode, stats] of sortedUnits) {
            const avgConf = Math.round(stats.avgConfidence / stats.count);
            const unitInfo = UNIT_MAPPINGS[unitCode];
            report += `${unitCode}: ${unitInfo.title}\n`;
            report += `  Questions Matched: ${stats.count}/${mappings.length}\n`;
            report += `  Average Confidence: ${avgConf}%\n`;
            report += `  Section Coverage: ${unitInfo.sections.join(', ')}\n`;
            report += `  Performance Criteria: ${unitInfo.pcCodes.slice(0, 8).join(', ')}${unitInfo.pcCodes.length > 8 ? '...' : ''}\n`;
            report += `  Knowledge Items: ${unitInfo.knowledge.slice(0, 10).join(', ')}${unitInfo.knowledge.length > 10 ? '...' : ''}\n\n`;
        }
        // Detailed question mappings
        report += '───────────────────────────────────────────────────────────────\n';
        report += 'DETAILED QUESTION MAPPINGS\n';
        report += '───────────────────────────────────────────────────────────────\n\n';
        for (const mapping of mappings) {
            report += `Q${mapping.questionNumber}. ${mapping.questionText}\n`;
            if (mapping.section) {
                report += `  Section: ${mapping.section}\n`;
            }
            report += `  Recommended Units:\n`;
            for (const unit of mapping.units) {
                report += `    → ${unit.unitCode}: ${unit.description}\n`;
                report += `       PC: ${unit.performanceCriteria.slice(0, 6).join(', ')}${unit.performanceCriteria.length > 6 ? '...' : ''}\n`;
                report += `       K: ${unit.knowledge.slice(0, 8).join(', ')}${unit.knowledge.length > 8 ? '...' : ''}\n`;
            }
            report += `  Confidence: ${mapping.confidence}%\n`;
            report += `  Rationale: ${mapping.rationale}\n\n`;
        }
        return report;
    }
    /**
     * Main validation process
     */
    async validate() {
        try {
            console.log(`\n🔍 Analyzing: ${this.assessmentFile}`);
            // Read assessment content
            const content = fs.readFileSync(this.assessmentFile, 'utf-8');
            // Parse and analyze
            const mappings = this.parseAssessmentDocument(content);
            console.log(`✓ Detected ${mappings.length} questions`);
            // Generate report
            const report = this.generateReport(mappings);
            // Save report
            fs.writeFileSync(this.outputFile, report, 'utf-8');
            console.log(`✓ Report saved: ${this.outputFile}`);
            console.log(`✓ Validation complete!\n`);
        }
        catch (error) {
            console.error(`✗ Error during validation:`, error.message);
            throw error;
        }
    }
}
// Main execution
async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.log('Usage: ./enhanced-assessment-validator.ts <assessment-file.txt>');
        console.log('\nProcessing all Seamanship files...');
        const seamanshipFiles = [
            'Knowledge Seamanship Marking Sheet.docx'
        ];
        for (const file of seamanshipFiles) {
            if (fs.existsSync(file)) {
                // For DOCX, we'd need to convert first - skip for now
                console.log(`Skipping ${file} (DOCX format - needs conversion)`);
            }
        }
        process.exit(0);
    }
    const assessmentFile = args[0];
    if (!fs.existsSync(assessmentFile)) {
        console.error(`✗ File not found: ${assessmentFile}`);
        process.exit(1);
    }
    const validator = new EnhancedAssessmentValidator(assessmentFile);
    await validator.validate();
}
main().catch(console.error);
