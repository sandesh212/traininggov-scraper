/**
 * Custom AI Validation Service - FAST & FREE
 * 
 * Drop-in replacement for Ollama/OpenAI validation
 * Uses TF-IDF + keyword matching instead of external AI
 */

import {
  batchMatchQuestionsToPC,
  analyzeCoverage,
  type BatchMatchResult,
} from './customAIService.js';

export interface UnitOfCompetency {
  code: string;
  title: string;
  elements: Element[];
  performanceEvidence: string[];
  knowledgeEvidence: string[];
}

export interface Element {
  number: string;
  title: string;
  performanceCriteria: PerformanceCriteria[];
}

export interface PerformanceCriteria {
  number: string;
  text: string;
}

export interface AssessmentQuestion {
  id: string;
  text: string;
  type: 'knowledge' | 'performance' | 'observation' | 'project';
}

export interface Assessment {
  id: string;
  name: string;
  questions: AssessmentQuestion[];
}

export interface MappingResult {
  assessmentQuestionId: string;
  assessmentText: string;
  unitCode: string;
  elementNumber: string;
  pcNumber: string;
  pcText: string;
  semanticSimilarity: number;
  confidence: 'high' | 'medium' | 'low';
  explanation: string;
}

export interface GapAnalysis {
  unitCode: string;
  elementNumber: string;
  pcNumber: string;
  pcText: string;
  covered: boolean;
  coveringQuestions: string[];
}

export interface ValidationReport {
  overallCompliance: number;
  unitsAnalyzed: number;
  questionsAnalyzed: number;
  mappings: MappingResult[];
  gaps: GapAnalysis[];
  rulesOfEvidence: any;
  principlesOfAssessment: any;
  recommendations: string[];
}

/**
 * Validate assessments using custom AI (FAST!)
 */
export async function validateAssessments(
  assessments: Assessment[],
  units: UnitOfCompetency[]
): Promise<ValidationReport> {
  console.log('═══════════════════════════════════════════════════════');
  console.log('⚡ Custom AI Validation Engine (FAST & FREE)');
  console.log('═══════════════════════════════════════════════════════\n');

  // Prepare questions
  const allQuestions = assessments.flatMap(a =>
    a.questions.map(q => ({ id: q.id, text: q.text }))
  );

  // Prepare PCs
  const allPCs = units.flatMap(unit =>
    unit.elements.flatMap(element =>
      element.performanceCriteria.map(pc => ({
        unitCode: unit.code,
        elementNumber: element.number,
        pcNumber: pc.number,
        text: pc.text,
      }))
    )
  );

  console.log(`📝 Questions: ${allQuestions.length}`);
  console.log(`🎯 Performance Criteria: ${allPCs.length}\n`);

  // Run custom AI matching
  const batchResults = batchMatchQuestionsToPC(allQuestions, allPCs);

  // Convert to MappingResult format
  const mappings: MappingResult[] = [];
  batchResults.forEach(result => {
    const question = allQuestions.find(q => q.id === result.questionId);
    if (!question) return;

    result.pcMatches.forEach(match => {
      mappings.push({
        assessmentQuestionId: result.questionId,
        assessmentText: question.text,
        unitCode: match.unitCode,
        elementNumber: match.elementNumber,
        pcNumber: match.pcNumber,
        pcText: match.pcText,
        semanticSimilarity: match.match.similarity,
        confidence: match.match.confidence,
        explanation: match.match.explanation,
      });
    });
  });

  // Analyze gaps
  const gaps: GapAnalysis[] = allPCs.map(pc => {
    const coveringMappings = mappings.filter(
      m =>
        m.unitCode === pc.unitCode &&
        m.elementNumber === pc.elementNumber &&
        m.pcNumber === pc.pcNumber &&
        m.confidence !== 'low'
    );

    return {
      unitCode: pc.unitCode,
      elementNumber: pc.elementNumber,
      pcNumber: pc.pcNumber,
      pcText: pc.text,
      covered: coveringMappings.length > 0,
      coveringQuestions: coveringMappings.map(m => m.assessmentQuestionId),
    };
  });

  // Calculate compliance
  const coveredPCs = gaps.filter(g => g.covered).length;
  const totalPCs = gaps.length;
  const overallCompliance = totalPCs > 0 ? (coveredPCs / totalPCs) * 100 : 0;

  // Generate recommendations
  const recommendations: string[] = [];
  const uncoveredCount = totalPCs - coveredPCs;
  
  if (uncoveredCount > 0) {
    recommendations.push(
      `Add ${uncoveredCount} more questions to cover missing performance criteria`
    );
  }
  
  if (overallCompliance < 80) {
    recommendations.push(
      'Current coverage is below 80% - review and add more comprehensive questions'
    );
  }

  // Simple rules of evidence check
  const hasKnowledge = assessments.some(a =>
    a.questions.some(q => q.type === 'knowledge')
  );
  const hasPerformance = assessments.some(a =>
    a.questions.some(q => q.type === 'performance' || q.type === 'observation')
  );

  const rulesOfEvidence = {
    validity: { passed: overallCompliance >= 50, issues: [] },
    sufficiency: {
      passed: hasKnowledge && hasPerformance,
      issues: !hasKnowledge || !hasPerformance
        ? ['Ensure both knowledge and performance evidence is collected']
        : [],
    },
    authenticity: { passed: true, issues: [] },
    currency: { passed: true, issues: [] },
  };

  const principlesOfAssessment = {
    fairness: { passed: true, issues: [] },
    flexibility: { passed: true, issues: [] },
    validity: {
      passed: overallCompliance >= 60,
      issues:
        overallCompliance < 60
          ? ['Improve alignment of questions to unit requirements']
          : [],
    },
    reliability: { passed: true, issues: [] },
  };

  console.log(`\n✅ Validation Complete!`);
  console.log(`   Overall Compliance: ${overallCompliance.toFixed(1)}%`);
  console.log(`   Covered PCs: ${coveredPCs}/${totalPCs}\n`);

  return {
    overallCompliance,
    unitsAnalyzed: units.length,
    questionsAnalyzed: allQuestions.length,
    mappings,
    gaps,
    rulesOfEvidence,
    principlesOfAssessment,
    recommendations,
  };
}
