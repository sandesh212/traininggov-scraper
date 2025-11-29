export interface AssessmentQuestion {
    id: string;
    text: string;
    section?: string;
    images?: string[];
    imageDescription?: string;
    mappingHint?: string;
}

export interface ValidationResult {
    questionId: string;
    isValid: boolean;
    mappedUnit?: string | null;
    mappedCriteria: string[];
    mappedKnowledge: string[];
    reasoning: string;
    gaps: string[];
    confidence: number;
}

export interface UnitOfCompetency {
    code: string;
    title: string;
    description?: string;
    elements: Element[];
    performanceEvidence: string;
    knowledgeEvidence: string;
    assessmentConditions: string;
}

export interface Element {
    title: string;
    performanceCriteria: PerformanceCriteria[];
}

export interface PerformanceCriteria {
    id: string;
    text: string;
}
