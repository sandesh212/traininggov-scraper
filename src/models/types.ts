export interface AssessmentQuestion {
    id: string;
    text: string;
    section?: string;
    context?: string; // Surrounding text or sub-questions
    images?: string[];
    type?: string;
}
