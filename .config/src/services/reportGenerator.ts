/**
 * Validation Report Generator
 * 
 * Generates comprehensive reports for assessment validation results
 * in Excel and text formats.
 */

import XLSX from 'xlsx';
import type { ValidationReport, MappingResult, GapAnalysis } from './aiValidationService.js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// EXCEL REPORT GENERATION
// ============================================================================

/**
 * Generate comprehensive Excel report
 */
export function generateExcelReport(
  report: ValidationReport,
  outputPath: string
): void {
  const workbook = XLSX.utils.book_new();
  
  // Sheet 1: Summary
  const summaryData = [
    ['AI Assessment Validation Report'],
    [''],
    ['Overall Compliance', `${report.overallCompliance.toFixed(1)}%`],
    ['Units Analyzed', report.unitsAnalyzed],
    ['Assessment Questions Analyzed', report.questionsAnalyzed],
    ['Total Mappings Found', report.mappings.length],
    ['High Confidence Matches', report.mappings.filter(m => m.confidence === 'high').length],
    ['Medium Confidence Matches', report.mappings.filter(m => m.confidence === 'medium').length],
    ['Low Confidence Matches', report.mappings.filter(m => m.confidence === 'low').length],
    ['Uncovered Performance Criteria', report.gaps.filter(g => !g.covered).length],
    [''],
    ['Rules of Evidence'],
    ['Validity', report.rulesOfEvidence.validity.passed ? 'PASSED' : 'FAILED'],
    ['Sufficiency', report.rulesOfEvidence.sufficiency.passed ? 'PASSED' : 'FAILED'],
    ['Authenticity', report.rulesOfEvidence.authenticity.passed ? 'PASSED' : 'FAILED'],
    ['Currency', report.rulesOfEvidence.currency.passed ? 'PASSED' : 'FAILED'],
    [''],
    ['Principles of Assessment'],
    ['Fairness', report.principlesOfAssessment.fairness.passed ? 'PASSED' : 'FAILED'],
    ['Flexibility', report.principlesOfAssessment.flexibility.passed ? 'PASSED' : 'FAILED'],
    ['Validity', report.principlesOfAssessment.validity.passed ? 'PASSED' : 'FAILED'],
    ['Reliability', report.principlesOfAssessment.reliability.passed ? 'PASSED' : 'FAILED'],
    [''],
    ['Recommendations'],
    ...report.recommendations.map(r => [r]),
  ];
  
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
  
  // Sheet 2: Coverage Matrix (Question → PC Mappings)
  const mappingData = [
    [
      'Assessment Question ID',
      'Question Text',
      'Question Type',
      'Unit Code',
      'Element',
      'PC Number',
      'PC Text',
      'Similarity %',
      'Confidence',
      'AI Explanation',
    ],
    ...report.mappings.map(m => [
      m.assessmentQuestionId,
      m.assessmentText,
      '', // Type not stored in mapping, could enhance
      m.unitCode,
      m.elementNumber,
      m.pcNumber,
      m.pcText,
      (m.semanticSimilarity * 100).toFixed(1),
      m.confidence.toUpperCase(),
      m.explanation,
    ]),
  ];
  
  const mappingSheet = XLSX.utils.aoa_to_sheet(mappingData);
  
  // Set column widths
  mappingSheet['!cols'] = [
    { wch: 20 }, // Question ID
    { wch: 50 }, // Question Text
    { wch: 15 }, // Type
    { wch: 12 }, // Unit Code
    { wch: 10 }, // Element
    { wch: 10 }, // PC Number
    { wch: 50 }, // PC Text
    { wch: 12 }, // Similarity
    { wch: 12 }, // Confidence
    { wch: 60 }, // Explanation
  ];
  
  XLSX.utils.book_append_sheet(workbook, mappingSheet, 'Coverage Matrix');
  
  // Sheet 3: Gap Analysis (Uncovered PCs)
  const uncoveredGaps = report.gaps.filter(g => !g.covered);
  const gapData = [
    ['Unit Code', 'Element', 'PC Number', 'PC Text', 'Status', 'Covering Questions'],
    ...report.gaps.map(g => [
      g.unitCode,
      g.elementNumber,
      g.pcNumber,
      g.pcText,
      g.covered ? 'COVERED' : 'GAP',
      g.coveringQuestions.join(', '),
    ]),
  ];
  
  const gapSheet = XLSX.utils.aoa_to_sheet(gapData);
  gapSheet['!cols'] = [
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 60 },
    { wch: 12 },
    { wch: 40 },
  ];
  
  XLSX.utils.book_append_sheet(workbook, gapSheet, 'Gap Analysis');
  
  // Sheet 4: Issues & Recommendations
  const issuesData = [
    ['Category', 'Rule/Principle', 'Status', 'Issues'],
    [''],
    ['Rules of Evidence', '', '', ''],
    ['', 'Validity', report.rulesOfEvidence.validity.passed ? 'PASSED' : 'FAILED', report.rulesOfEvidence.validity.issues.join('; ')],
    ['', 'Sufficiency', report.rulesOfEvidence.sufficiency.passed ? 'PASSED' : 'FAILED', report.rulesOfEvidence.sufficiency.issues.join('; ')],
    ['', 'Authenticity', report.rulesOfEvidence.authenticity.passed ? 'PASSED' : 'FAILED', report.rulesOfEvidence.authenticity.issues.join('; ')],
    ['', 'Currency', report.rulesOfEvidence.currency.passed ? 'PASSED' : 'FAILED', report.rulesOfEvidence.currency.issues.join('; ')],
    [''],
    ['Principles of Assessment', '', '', ''],
    ['', 'Fairness', report.principlesOfAssessment.fairness.passed ? 'PASSED' : 'FAILED', report.principlesOfAssessment.fairness.issues.join('; ')],
    ['', 'Flexibility', report.principlesOfAssessment.flexibility.passed ? 'PASSED' : 'FAILED', report.principlesOfAssessment.flexibility.issues.join('; ')],
    ['', 'Validity', report.principlesOfAssessment.validity.passed ? 'PASSED' : 'FAILED', report.principlesOfAssessment.validity.issues.join('; ')],
    ['', 'Reliability', report.principlesOfAssessment.reliability.passed ? 'PASSED' : 'FAILED', report.principlesOfAssessment.reliability.issues.join('; ')],
  ];
  
  const issuesSheet = XLSX.utils.aoa_to_sheet(issuesData);
  issuesSheet['!cols'] = [
    { wch: 25 },
    { wch: 15 },
    { wch: 12 },
    { wch: 80 },
  ];
  
  XLSX.utils.book_append_sheet(workbook, issuesSheet, 'Issues & Recommendations');
  
  // Write file
  XLSX.writeFile(workbook, outputPath);
  console.log(`📊 Excel report generated: ${outputPath}`);
}

// ============================================================================
// TEXT REPORT GENERATION
// ============================================================================

/**
 * Generate text summary report
 */
export function generateTextReport(report: ValidationReport): string {
  const lines: string[] = [];
  
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('           AI ASSESSMENT VALIDATION REPORT');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');
  
  // Summary
  lines.push('📊 SUMMARY');
  lines.push('─'.repeat(60));
  lines.push(`Overall Compliance:        ${report.overallCompliance.toFixed(1)}%`);
  lines.push(`Units Analyzed:            ${report.unitsAnalyzed}`);
  lines.push(`Questions Analyzed:        ${report.questionsAnalyzed}`);
  lines.push(`Total Mappings:            ${report.mappings.length}`);
  lines.push(`  • High Confidence:       ${report.mappings.filter(m => m.confidence === 'high').length}`);
  lines.push(`  • Medium Confidence:     ${report.mappings.filter(m => m.confidence === 'medium').length}`);
  lines.push(`  • Low Confidence:        ${report.mappings.filter(m => m.confidence === 'low').length}`);
  lines.push(`Uncovered PCs:             ${report.gaps.filter(g => !g.covered).length}`);
  lines.push('');
  
  // Rules of Evidence
  lines.push('✅ RULES OF EVIDENCE');
  lines.push('─'.repeat(60));
  lines.push(`Validity:      ${report.rulesOfEvidence.validity.passed ? '✓ PASSED' : '✗ FAILED'}`);
  if (report.rulesOfEvidence.validity.issues.length > 0) {
    report.rulesOfEvidence.validity.issues.forEach(issue => {
      lines.push(`               - ${issue}`);
    });
  }
  lines.push(`Sufficiency:   ${report.rulesOfEvidence.sufficiency.passed ? '✓ PASSED' : '✗ FAILED'}`);
  if (report.rulesOfEvidence.sufficiency.issues.length > 0) {
    report.rulesOfEvidence.sufficiency.issues.forEach(issue => {
      lines.push(`               - ${issue}`);
    });
  }
  lines.push(`Authenticity:  ${report.rulesOfEvidence.authenticity.passed ? '✓ PASSED' : '✗ FAILED'}`);
  if (report.rulesOfEvidence.authenticity.issues.length > 0) {
    report.rulesOfEvidence.authenticity.issues.forEach(issue => {
      lines.push(`               - ${issue}`);
    });
  }
  lines.push(`Currency:      ${report.rulesOfEvidence.currency.passed ? '✓ PASSED' : '✗ FAILED'}`);
  if (report.rulesOfEvidence.currency.issues.length > 0) {
    report.rulesOfEvidence.currency.issues.forEach(issue => {
      lines.push(`               - ${issue}`);
    });
  }
  lines.push('');
  
  // Principles of Assessment
  lines.push('✅ PRINCIPLES OF ASSESSMENT');
  lines.push('─'.repeat(60));
  lines.push(`Fairness:      ${report.principlesOfAssessment.fairness.passed ? '✓ PASSED' : '✗ FAILED'}`);
  if (report.principlesOfAssessment.fairness.issues.length > 0) {
    report.principlesOfAssessment.fairness.issues.forEach(issue => {
      lines.push(`               - ${issue}`);
    });
  }
  lines.push(`Flexibility:   ${report.principlesOfAssessment.flexibility.passed ? '✓ PASSED' : '✗ FAILED'}`);
  if (report.principlesOfAssessment.flexibility.issues.length > 0) {
    report.principlesOfAssessment.flexibility.issues.forEach(issue => {
      lines.push(`               - ${issue}`);
    });
  }
  lines.push(`Validity:      ${report.principlesOfAssessment.validity.passed ? '✓ PASSED' : '✗ FAILED'}`);
  if (report.principlesOfAssessment.validity.issues.length > 0) {
    report.principlesOfAssessment.validity.issues.forEach(issue => {
      lines.push(`               - ${issue}`);
    });
  }
  lines.push(`Reliability:   ${report.principlesOfAssessment.reliability.passed ? '✓ PASSED' : '✗ FAILED'}`);
  if (report.principlesOfAssessment.reliability.issues.length > 0) {
    report.principlesOfAssessment.reliability.issues.forEach(issue => {
      lines.push(`               - ${issue}`);
    });
  }
  lines.push('');
  
  // Gap Analysis Summary
  const uncoveredGaps = report.gaps.filter(g => !g.covered);
  if (uncoveredGaps.length > 0) {
    lines.push('⚠️  CRITICAL GAPS (Uncovered Performance Criteria)');
    lines.push('─'.repeat(60));
    uncoveredGaps.slice(0, 10).forEach(gap => {
      lines.push(`${gap.unitCode} ${gap.elementNumber}.${gap.pcNumber}`);
      lines.push(`   ${gap.pcText.substring(0, 70)}...`);
    });
    if (uncoveredGaps.length > 10) {
      lines.push(`   ... and ${uncoveredGaps.length - 10} more (see Excel report)`);
    }
    lines.push('');
  }
  
  // Recommendations
  if (report.recommendations.length > 0) {
    lines.push('💡 RECOMMENDATIONS');
    lines.push('─'.repeat(60));
    report.recommendations.forEach((rec, i) => {
      lines.push(`${i + 1}. ${rec}`);
    });
    lines.push('');
  }
  
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('For detailed coverage matrix and full gap analysis,');
  lines.push('see the Excel report.');
  lines.push('═══════════════════════════════════════════════════════════════');
  
  return lines.join('\n');
}

/**
 * Save text report to file
 */
export function saveTextReport(report: ValidationReport, outputPath: string): void {
  const content = generateTextReport(report);
  fs.writeFileSync(outputPath, content, 'utf-8');
  console.log(`📄 Text report generated: ${outputPath}`);
}

/**
 * Print report to console
 */
export function printReport(report: ValidationReport): void {
  console.log('\n' + generateTextReport(report) + '\n');
}
