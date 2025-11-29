import OpenAI from 'openai';
import { UnitOfCompetency } from './uocLoader.js';
import { AssessmentQuestion } from '../models/types.js';

export interface ValidationResult {
    questionId: string;
    isValid: boolean;
    mappedUnit?: string | null; // Added for clustering
    mappedCriteria: string[]; // IDs of mapped Performance Criteria
    mappedKnowledge: string[]; // IDs/Text of mapped Knowledge Evidence
    reasoning: string;
    gaps: string[];
    confidence: number; // 0-100
}

export class AIService {
    private openai: OpenAI;
    private model: string;

    constructor(apiKey: string, model: string = 'gpt-4o') {
        this.openai = new OpenAI({ apiKey: apiKey || 'mock-key' }); // Allow mock key
        this.model = model;
    }

    public async validateQuestion(
        question: AssessmentQuestion,
        uocs: UnitOfCompetency[]
    ): Promise<ValidationResult> {
        // MOCK MODE: If API key is 'mock-key' or starts with 'sk-mock', return dummy data
        if (this.openai.apiKey === 'mock-key' || this.openai.apiKey.startsWith('sk-mock')) {
            console.log(`   (Mocking AI response for Q${question.id})`);
            await new Promise(resolve => setTimeout(resolve, 500)); // Simulate latency

            // Heuristic: Match question text/section to Unit Title/Code
            const bestMatch = uocs.find(u =>
                question.text.toLowerCase().includes(u.title.toLowerCase().split(' ')[0]) ||
                question.section?.toLowerCase().includes(u.title.toLowerCase().split(' ')[0])
            ) || uocs[0];

            return {
                questionId: question.id,
                isValid: true,
                mappedUnit: bestMatch.code,
                mappedCriteria: ["1.1", "1.2"],
                mappedKnowledge: ["K1"],
                reasoning: `MOCK ANALYSIS: Question matched to ${bestMatch.code} based on keywords.`,
                gaps: [],
                confidence: 85
            };
        }

        const prompt = this.buildPrompt(question, uocs);

        try {
            const completion = await this.openai.chat.completions.create({
                messages: [
                    { role: "system", content: "You are an expert Vocational Education and Training (VET) Assessment Validator. Your job is to map assessment questions to the most relevant Unit of Competency (UoC) from a provided list." },
                    { role: "user", content: prompt }
                ],
                model: this.model,
                response_format: { type: "json_object" }
            });

            const content = completion.choices[0].message.content;
            if (!content) throw new Error("Empty response from AI");

            const result = JSON.parse(content);
            return {
                questionId: question.id,
                isValid: result.isValid,
                mappedUnit: result.mappedUnit || null,
                mappedCriteria: result.mappedCriteria || [],
                mappedKnowledge: result.mappedKnowledge || [],
                reasoning: result.reasoning,
                gaps: result.gaps || [],
                confidence: result.confidence || 0
            };

        } catch (error) {
            console.error(`AI Validation failed for Q${question.id}:`, error);
            return {
                questionId: question.id,
                isValid: false,
                mappedUnit: null,
                mappedCriteria: [],
                mappedKnowledge: [],
                reasoning: "AI Analysis Failed: " + (error instanceof Error ? error.message : String(error)),
                gaps: [],
                confidence: 0
            };
        }
    }

    private buildPrompt(q: AssessmentQuestion, uocs: UnitOfCompetency[]): string {
        // Build context for ALL units
        const unitsContext = uocs.map(u => `
        === UNIT: ${u.code} - ${u.title} ===
        Performance Criteria:
        ${u.elements.flatMap(e => e.performanceCriteria.map(pc => `${pc.id} ${pc.text}`)).join('\n')}
        
        Knowledge Evidence:
        ${u.knowledgeEvidence}
        `).join('\n\n');

        return `
        Analyze the following Assessment Question and map it to the MOST RELEVANT Unit of Competency from the list below.
        
        **Context:**
        The user has provided a list of potential Units of Competency. Your goal is to identify which of these units (if any) is the PRIMARY target of this question.
        
        **Units of Competency:**
        ${unitsContext}

        **Assessment Question:**
        ID: ${q.id}
        Text: "${q.text}"
        Context/Section: ${q.section || 'N/A'}

        **Task:**
        1.  **Analyze**: Read the question and understand the specific skill or knowledge it tests.
        2.  **Match**: Compare this against the Performance Criteria and Knowledge Evidence of EACH provided unit.
        3.  **Select**: Choose the ONE unit that is the *best fit*. If multiple fit, choose the one with the most specific coverage. If NONE fit, set "mappedUnit" to null.
        4.  **Validate**: Determine if the question is a valid assessment for that unit.
        5.  **Map**: List the specific criteria/knowledge IDs.

        **Output JSON Format:**
        {
            "mappedUnit": "CODE" (e.g., MARK007) or null,
            "isValid": boolean,
            "mappedCriteria": ["1.1", "1.2"],
            "mappedKnowledge": ["K1", "description of knowledge"],
            "reasoning": "Detailed explanation of why [Unit Code] was selected over others. Cite specific keywords.",
            "gaps": ["List any missing aspects"],
            "confidence": number (0-100)
        }
        `;
    }
}
