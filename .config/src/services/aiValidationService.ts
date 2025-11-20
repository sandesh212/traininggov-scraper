/**
 * AI Validation Service
 * 
 * Validates assessments against Training Package Unit of Competency requirements
 * using semantic AI matching (not exact word matching).
 * 
 * Features:
 * - Multi-unit, multi-assessment validation
 * - Semantic matching using AI embeddings (Ollama - FREE & LOCAL)
 * - Rules of Evidence validation
 * - Principles of Assessment validation
 * - Comprehensive reporting
 */

import {
  generateOllamaEmbedding,
  generateOllamaMatchExplanation,
  checkOllamaAvailability,
} from './ollamaService.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

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
  category?: string;
  subcategory?: string;
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
  semanticSimilarity: number; // 0-1 score
  confidence: 'high' | 'medium' | 'low';
  explanation: string; // AI explanation of why they match
}

export interface GapAnalysis {
  unitCode: string;
  elementNumber: string;
  pcNumber: string;
  pcText: string;
  covered: boolean;
  coveringQuestions: string[]; // Assessment question IDs
}

export interface ValidationReport {
  overallCompliance: number; // 0-100%
  unitsAnalyzed: number;
  questionsAnalyzed: number;
  mappings: MappingResult[];
  gaps: GapAnalysis[];
  rulesOfEvidence: RulesOfEvidenceValidation;
  principlesOfAssessment: PrinciplesOfAssessmentValidation;
  recommendations: string[];
}

export interface RulesOfEvidenceValidation {
  validity: { passed: boolean; issues: string[] };
  sufficiency: { passed: boolean; issues: string[] };
  authenticity: { passed: boolean; issues: string[] };
  currency: { passed: boolean; issues: string[] };
}

export interface PrinciplesOfAssessmentValidation {
  fairness: { passed: boolean; issues: string[] };
  flexibility: { passed: boolean; issues: string[] };
  validity: { passed: boolean; issues: string[] };
  reliability: { passed: boolean; issues: string[] };
}

// ============================================================================
// SEMANTIC MATCHING ENGINE
// ============================================================================

/**
 * Generate embedding vector for text using Ollama (local AI)
 */
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    return await generateOllamaEmbedding(text);
  } catch (error: any) {
    console.error('Error generating embedding:', error.message);
    throw error;
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have same length');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Use AI to explain why an assessment question matches a performance criterion
 */
async function generateMatchExplanation(
  questionText: string,
  pcText: string,
  similarity: number
): Promise<string> {
  try {
    return await generateOllamaMatchExplanation(questionText, pcText, similarity);
  } catch (error: any) {
    console.error('Error generating explanation:', error.message);
    return `Match based on semantic similarity (${(similarity * 100).toFixed(1)}%)`;
  }
}

/**
 * Map assessment questions to UoC performance criteria using semantic AI matching
 */
export async function mapAssessmentToUoCs(
  assessments: Assessment[],
  units: UnitOfCompetency[]
): Promise<MappingResult[]> {
  console.log('\n🤖 Starting AI-powered semantic matching...');
  console.log(`   Assessments: ${assessments.length}`);
  console.log(`   Units: ${units.length}`);
  
  const allQuestions = assessments.flatMap(a => a.questions);
  console.log(`   Total Questions: ${allQuestions.length}\n`);
  
  const mappings: MappingResult[] = [];
  
  // Generate embeddings for all questions
  console.log('📊 Generating embeddings for assessment questions...');
  const questionEmbeddings = new Map<string, number[]>();
  for (const question of allQuestions) {
    const embedding = await generateEmbedding(question.text);
    questionEmbeddings.set(question.id, embedding);
  }
  
  // Generate embeddings for all performance criteria
  console.log('📊 Generating embeddings for performance criteria...');
  const pcEmbeddings: Array<{
    unitCode: string;
    elementNumber: string;
    pcNumber: string;
    pcText: string;
    embedding: number[];
  }> = [];
  
  for (const unit of units) {
    for (const element of unit.elements) {
      for (const pc of element.performanceCriteria) {
        const embedding = await generateEmbedding(pc.text);
        pcEmbeddings.push({
          unitCode: unit.code,
          elementNumber: element.number,
          pcNumber: pc.number,
          pcText: pc.text,
          embedding,
        });
      }
    }
  }
  
  console.log('🔍 Performing semantic matching...\n');
  
  // Match each question to all PCs
  let processed = 0;
  for (const question of allQuestions) {
    processed++;
    const questionEmbed = questionEmbeddings.get(question.id)!;
    
    // Find best matches for this question
    const matches: Array<{
      pc: typeof pcEmbeddings[0];
      similarity: number;
    }> = [];
    
    for (const pc of pcEmbeddings) {
      const similarity = cosineSimilarity(questionEmbed, pc.embedding);
      matches.push({ pc, similarity });
    }
    
    // Sort by similarity and keep top matches (threshold: 0.6 or higher)
    matches.sort((a, b) => b.similarity - a.similarity);
    const topMatches = matches.filter(m => m.similarity >= 0.6).slice(0, 3);
    
    // Generate explanations for top matches
    for (const match of topMatches) {
      const explanation = await generateMatchExplanation(
        question.text,
        match.pc.pcText,
        match.similarity
      );
      
      mappings.push({
        assessmentQuestionId: question.id,
        assessmentText: question.text,
        unitCode: match.pc.unitCode,
        elementNumber: match.pc.elementNumber,
        pcNumber: match.pc.pcNumber,
        pcText: match.pc.pcText,
        semanticSimilarity: match.similarity,
        confidence: match.similarity >= 0.8 ? 'high' : match.similarity >= 0.7 ? 'medium' : 'low',
        explanation,
      });
    }
    
    const percent = Math.round((processed / allQuestions.length) * 100);
    console.log(`[${processed}/${allQuestions.length}] ${percent}% - Matched question: ${question.id}`);
  }
  
  console.log(`\n✅ Semantic matching complete! Found ${mappings.length} matches\n`);
  return mappings;
}

// ============================================================================
// GAP ANALYSIS
// ============================================================================

/**
 * Identify which performance criteria are not covered by any assessment
 */
export function analyzeGaps(
  units: UnitOfCompetency[],
  mappings: MappingResult[]
): GapAnalysis[] {
  const gaps: GapAnalysis[] = [];
  
  for (const unit of units) {
    for (const element of unit.elements) {
      for (const pc of element.performanceCriteria) {
        const coveringQuestions = mappings
          .filter(
            m =>
              m.unitCode === unit.code &&
              m.elementNumber === element.number &&
              m.pcNumber === pc.number &&
              m.confidence !== 'low'
          )
          .map(m => m.assessmentQuestionId);
        
        gaps.push({
          unitCode: unit.code,
          elementNumber: element.number,
          pcNumber: pc.number,
          pcText: pc.text,
          covered: coveringQuestions.length > 0,
          coveringQuestions,
        });
      }
    }
  }
  
  return gaps;
}

// ============================================================================
// RULES OF EVIDENCE VALIDATION
// ============================================================================

/**
 * Validate against Rules of Evidence
 */
export function validateRulesOfEvidence(
  units: UnitOfCompetency[],
  assessments: Assessment[],
  mappings: MappingResult[],
  gaps: GapAnalysis[]
): RulesOfEvidenceValidation {
  const issues = {
    validity: [] as string[],
    sufficiency: [] as string[],
    authenticity: [] as string[],
    currency: [] as string[],
  };
  
  // VALIDITY: All UoC requirements must be covered
  const uncoveredPCs = gaps.filter(g => !g.covered);
  if (uncoveredPCs.length > 0) {
    issues.validity.push(
      `${uncoveredPCs.length} performance criteria not covered by any assessment`
    );
  }
  
  // SUFFICIENCY: Need both knowledge and performance evidence
  const hasKnowledge = assessments.some(a =>
    a.questions.some(q => q.type === 'knowledge')
  );
  const hasPerformance = assessments.some(a =>
    a.questions.some(q => q.type === 'performance' || q.type === 'observation')
  );
  
  if (!hasKnowledge) {
    issues.sufficiency.push('Missing knowledge-based assessment questions');
  }
  if (!hasPerformance) {
    issues.sufficiency.push('Missing performance/observation-based assessment');
  }
  
  // AUTHENTICITY: Check for authentication mechanisms (placeholder - requires assessment metadata)
  // This would need to check if assessments have authentication requirements
  
  // CURRENCY: Check if assessments reflect current UoC version (placeholder)
  // This would need to compare UoC release dates with assessment dates
  
  return {
    validity: { passed: issues.validity.length === 0, issues: issues.validity },
    sufficiency: { passed: issues.sufficiency.length === 0, issues: issues.sufficiency },
    authenticity: { passed: issues.authenticity.length === 0, issues: issues.authenticity },
    currency: { passed: issues.currency.length === 0, issues: issues.currency },
  };
}

// ============================================================================
// PRINCIPLES OF ASSESSMENT VALIDATION
// ============================================================================

/**
 * Validate against Principles of Assessment
 */
export function validatePrinciplesOfAssessment(
  units: UnitOfCompetency[],
  assessments: Assessment[],
  mappings: MappingResult[]
): PrinciplesOfAssessmentValidation {
  const issues = {
    fairness: [] as string[],
    flexibility: [] as string[],
    validity: [] as string[],
    reliability: [] as string[],
  };
  
  // FAIRNESS: Check for variety of assessment methods
  const assessmentTypes = new Set(
    assessments.flatMap(a => a.questions.map(q => q.type))
  );
  if (assessmentTypes.size < 2) {
    issues.fairness.push('Limited assessment methods - consider adding variety for fairness');
  }
  
  // FLEXIBILITY: Check if multiple assessment types are available
  if (!assessments.some(a => a.questions.some(q => q.type === 'project'))) {
    issues.flexibility.push('Consider adding project-based assessments for flexibility');
  }
  
  // VALIDITY: Ensure assessments align with UoC requirements
  const lowConfidenceMappings = mappings.filter(m => m.confidence === 'low');
  if (lowConfidenceMappings.length > mappings.length * 0.3) {
    issues.validity.push(
      `${lowConfidenceMappings.length} assessment questions have weak alignment to UoC requirements`
    );
  }
  
  // RELIABILITY: Check for clear criteria (placeholder - would need rubrics)
  // This would check if assessments have clear marking criteria/rubrics
  
  return {
    fairness: { passed: issues.fairness.length === 0, issues: issues.fairness },
    flexibility: { passed: issues.flexibility.length === 0, issues: issues.flexibility },
    validity: { passed: issues.validity.length === 0, issues: issues.validity },
    reliability: { passed: issues.reliability.length === 0, issues: issues.reliability },
  };
}

// ============================================================================
// MAIN VALIDATION FUNCTION
// ============================================================================

/**
 * Validate assessments against multiple units of competency
 */
export async function validateAssessments(
  assessments: Assessment[],
  units: UnitOfCompetency[]
): Promise<ValidationReport> {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🎓 AI Assessment Validation Engine');
  console.log('═══════════════════════════════════════════════════════\n');
  
  // Step 1: Semantic Mapping
  const mappings = await mapAssessmentToUoCs(assessments, units);
  
  // Step 2: Gap Analysis
  console.log('📋 Analyzing coverage gaps...');
  const gaps = analyzeGaps(units, mappings);
  const uncoveredCount = gaps.filter(g => !g.covered).length;
  console.log(`   Found ${uncoveredCount} uncovered performance criteria\n`);
  
  // Step 3: Rules of Evidence
  console.log('✅ Validating Rules of Evidence...');
  const rulesOfEvidence = validateRulesOfEvidence(units, assessments, mappings, gaps);
  
  // Step 4: Principles of Assessment
  console.log('✅ Validating Principles of Assessment...\n');
  const principlesOfAssessment = validatePrinciplesOfAssessment(units, assessments, mappings);
  
  // Calculate overall compliance
  const totalPCs = gaps.length;
  const coveredPCs = gaps.filter(g => g.covered).length;
  const overallCompliance = totalPCs > 0 ? (coveredPCs / totalPCs) * 100 : 0;
  
  // Generate recommendations
  const recommendations: string[] = [];
  if (uncoveredCount > 0) {
    recommendations.push(
      `Add questions to cover ${uncoveredCount} missing performance criteria`
    );
  }
  if (rulesOfEvidence.sufficiency.issues.length > 0) {
    recommendations.push('Ensure both knowledge and performance evidence is collected');
  }
  if (principlesOfAssessment.validity.issues.length > 0) {
    recommendations.push('Review and improve alignment of assessment questions to UoC requirements');
  }
  
  return {
    overallCompliance,
    unitsAnalyzed: units.length,
    questionsAnalyzed: assessments.flatMap(a => a.questions).length,
    mappings,
    gaps,
    rulesOfEvidence,
    principlesOfAssessment,
    recommendations,
  };
}
