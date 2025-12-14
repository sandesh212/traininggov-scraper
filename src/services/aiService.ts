import OpenAI from 'openai';
import { UnitOfCompetency } from './uocLoader.js';
import { AssessmentQuestion } from '../models/types.js';
// import { logger } from '../utils/logger.js'; // Broken import
const logger = { info: console.log, error: console.error, warn: console.warn };

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
    private visionModel: string;
    private isOllama: boolean;

    constructor(apiKey: string, model: string = 'gpt-4o', baseUrl?: string) {
        // DETECT OLLAMA / LOCAL AI CONFIGURATION
        if (baseUrl && (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1'))) {
            this.isOllama = true;
            this.model = model || 'llama3';
            this.visionModel = process.env.AI_VISION_MODEL || 'llava'; // Default vision model for local
            this.openai = new OpenAI({
                baseURL: baseUrl,
                apiKey: 'ollama',
            });
            logger.info(`🤖 AIService initialized in LOCAL mode (Ollama at ${baseUrl}) with models: Text=${this.model}, Vision=${this.visionModel}`);
        } else {
            // STANDARD OPENAI CONFIGURATION
            this.isOllama = false;
            this.model = model;
            this.visionModel = 'gpt-4o'; // OpenAI handles both
            this.openai = new OpenAI({ apiKey: apiKey || 'mock-key' });
            logger.info(`☁️ AIService initialized in CLOUD mode (OpenAI) with model: ${this.model}`);
        }
    }

    public async validateQuestion(
        question: AssessmentQuestion,
        uocs: UnitOfCompetency[]
    ): Promise<ValidationResult> {
        // Mock mode removed for dynamic behavior
        // if (this.openai.apiKey === 'mock-key') { ... }

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

    public async describeImages(questions: AssessmentQuestion[]): Promise<AssessmentQuestion[]> {
        // Filter questions with images
        const questionsWithImages = questions.filter(q => q.images && q.images.length > 0);

        if (questionsWithImages.length === 0) return questions;

        console.log(`   🖼️  Analyzing ${questionsWithImages.length} questions with images using ${this.visionModel}...`);

        // Process in parallel
        const updatedQuestions = await Promise.all(questions.map(async (q) => {
            if (!q.images || q.images.length === 0) return q;

            // Only analyze the first image for now to save tokens/time
            let imageBase64 = q.images[0];

            // Format check for Ollama vs OpenAI
            // Ollama often prefers just base64 or a specific format depending on the client, 
            // but the OpenAI standard client usually expects data URI.
            const imageUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;

            try {
                // Mock image description removed

                // Prepare message content based on provider
                // Ollama with 'llava' via OpenAI compatible endpoint works similar to GPT-4 Vision
                const response = await this.openai.chat.completions.create({
                    model: this.visionModel, // Use the specific vision model
                    messages: [
                        {
                            role: "user",
                            content: [
                                { type: "text", text: "Describe this image in detail. Identify technical diagrams, equipment, and read any text." },
                                {
                                    type: "image_url",
                                    image_url: {
                                        url: imageUrl,
                                        detail: "high"
                                    }
                                }
                            ]
                        }
                    ],
                    max_tokens: 300
                });

                const description = response.choices[0].message.content || "";
                console.log(`   ✅ Image described for Q${q.id}: ${description.substring(0, 50)}...`);

                return {
                    ...q,
                    imageDescription: description
                };
            } catch (error) {
                console.error(`   ❌ Failed to describe image for Q${q.id} using ${this.visionModel}:`, error);
                return q; // Return original without description on error
            }
        }));

        return updatedQuestions;
    }
}
