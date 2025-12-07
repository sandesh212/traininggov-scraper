export interface DetailedMapping {
    unitCode: string;
    unitTitle: string;
    elementNumber?: string;
    elementTitle?: string;
    performanceCriteria?: string[];  // e.g., ["1.1", "1.2"]
    performanceCriteriaText?: string[];  // Full text of each PC
    knowledgeEvidence?: string[];
    performanceEvidence?: string[];
    assessmentConditions?: string;
    sourceType: 'element' | 'knowledge' | 'performance' | 'assessment' | 'mixed';
    confidence: number;
}

export interface QuestionResult {
    questionId: string;
    questionText: string;
    questionSection?: string;
    isValid: boolean;
    mappedUnit: string | null;
    mappedCriteria: string[];
    mappedKnowledge: string[];
    mappedPerformanceEvidence?: string[];
    detailedMapping?: DetailedMapping;  // Enhanced mapping info
    confidence: number;
    reasoning: string;
    images?: string[];
    imageDescription?: string;
    parentQuestionId?: string;
}

export interface PerformanceCriteria {
    id: string;
    text: string;
}

export interface Element {
    title: string;
    performanceCriteria: PerformanceCriteria[];
}

export interface ListItem {
    text: string;
    items?: ListItem[]; // nested sub-bullets
}

export interface Section {
    heading: string;
    level: number;
    paragraphs: string[];
    lists: ListItem[];
    subsections?: Section[]; // nested sub-headings
}

export interface Unit {
    code: string;
    title: string;
    url?: string;
    status?: string;
    release?: string;
    description?: string;
    application?: string;
    unitSector?: string;
    modificationHistory?: string;
    foundationSkills?: string;
    elements: Element[];
    knowledgeEvidence: string;
    performanceEvidence: string;
    assessmentConditions: string;
    supersededBy?: string;
    supersedes?: string;
    sections: Section[];
    lastFetchedAt?: string;
    dynamicSections?: { title: string; content: string }[];
}

export interface InvalidUnit {
    code: string;
    url: string;
    reason: string;
}

export interface DatabaseStats {
    added: number;
    modified: number;
    deleted: number;
    total: number;
}

export interface ReportData {
    questionsCount: number;
    totalUnitsInDatabase: number;
    mappedUnits: Unit[];
    mappedUnitsCount: number;
    fetchedUnits?: Unit[]; // All units fetched/available
    fetchedUnitsCount?: number;
    results: QuestionResult[];
    instructions: string[];
    title?: string;
    redTextSegments?: string[]; // legacy field
    redTextAnswers?: {
        text: string;
        section?: string;
        context?: string;
        partIndex?: number;
        seq?: number;
    }[];
    databaseStats?: DatabaseStats;
}
