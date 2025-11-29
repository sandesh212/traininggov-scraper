export interface QuestionResult {
    questionId: string;
    questionText: string;
    questionSection?: string;
    isValid: boolean;
    mappedUnit: string | null;
    mappedCriteria: string[];
    mappedKnowledge: string[];
    mappedPerformanceEvidence?: string[];
    confidence: number;
    reasoning: string;
    images?: string[];
    imageDescription?: string;
}

export interface PerformanceCriteria {
    id: string;
    text: string;
}

export interface Element {
    title: string;
    performanceCriteria: PerformanceCriteria[];
}

export interface Unit {
    code: string;
    title: string;
    elements: Element[];
    knowledgeEvidence: string;
    performanceEvidence: string;
    assessmentConditions: string;
}

export interface ReportData {
    questionsCount: number;
    totalUnitsInDatabase: number;
    mappedUnits: Unit[];
    results: QuestionResult[];
    instructions: string[];
    redTextSegments?: string[];
}
