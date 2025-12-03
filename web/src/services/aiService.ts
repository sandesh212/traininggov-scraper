import OpenAI from 'openai';
import { Unit } from './uocLoader';
import { AssessmentQuestion } from '../models/types';

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
        uocs: Unit[]
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

    private buildPrompt(q: AssessmentQuestion, uocs: Unit[]): string {
        // Build detailed context for ALL units with better formatting
        const unitsContext = uocs.map(u => {
            const elementsText = u.elements.map((el, idx) => {
                const criteriaText = el.performanceCriteria
                    .map(pc => `    ${pc.id || `${idx + 1}.${el.performanceCriteria.indexOf(pc) + 1}`} ${pc.text}`)
                    .join('\n');
                return `  Element ${idx + 1}: ${el.title}\n${criteriaText}`;
            }).join('\n\n');

            return `
=== UNIT: ${u.code} - ${u.title} ===

Description: ${u.description || 'N/A'}

Elements and Performance Criteria:
${elementsText}

Knowledge Evidence Required:
${u.knowledgeEvidence || 'Not specified'}

Performance Evidence Required:
${u.performanceEvidence || 'Not specified'}
`;
        }).join('\n' + '='.repeat(80) + '\n');

        return `
You are an expert VET (Vocational Education and Training) assessment validator specializing in Australian training packages.

**YOUR TASK:**
Analyze the assessment question below and determine which Unit of Competency it best aligns with.

**IMPORTANT CONTEXT:**
- The question has already been extracted and separated from any answer text
- Focus on what skill, knowledge, or competency the question is testing
- Match it to the unit whose performance criteria and knowledge evidence best cover what's being assessed

**AVAILABLE UNITS OF COMPETENCY:**
${unitsContext}

**ASSESSMENT QUESTION TO ANALYZE:**
Question ID: ${q.id}
Section/Context: ${q.section || 'General'}
Question Text: "${q.text}"

**ANALYSIS INSTRUCTIONS:**

1. **Understand the Question**: 
   - What specific skill, knowledge, or competency is being tested?
   - What domain does it belong to (e.g., safety, navigation, equipment, procedures)?
   - What level of knowledge is required (basic awareness, detailed understanding, practical application)?

2. **Match to Units**:
   - Compare the question's focus against EACH unit's:
     * Title and description
     * Performance criteria (what the person must be able to do)
     * Knowledge evidence (what they must know)
   - Look for keyword matches AND conceptual alignment
   - Consider which unit would logically include this question in its assessment

3. **Select Best Match**:
   - Choose the ONE unit with the strongest alignment
   - If the question could fit multiple units, choose the most specific one
   - If NO unit adequately covers the question, set mappedUnit to null

4. **Identify Specific Mappings**:
   - List the specific performance criteria IDs (e.g., "1.1", "2.3") that this question tests
   - List the knowledge evidence areas that this question addresses
   - Be specific - don't just list all criteria, only the relevant ones

5. **Validate**:
   - Is this a valid, well-formed question for the mapped unit?
   - Does it actually test the competency?
   - Are there any gaps or issues?

**OUTPUT FORMAT (JSON):**
{
    "mappedUnit": "UNIT_CODE" or null,
    "isValid": true/false,
    "mappedCriteria": ["1.1", "1.2"],
    "mappedKnowledge": ["Specific knowledge area 1", "Specific knowledge area 2"],
    "reasoning": "Detailed explanation: This question tests [specific skill/knowledge]. It aligns with [Unit Code] because [specific reasons]. The question specifically addresses performance criteria [X] which requires [Y]. Keywords like '[keyword]' indicate focus on [concept] which is central to this unit's Element [N].",
    "gaps": ["Any issues or missing coverage"],
    "confidence": 0-100 (how confident you are in this mapping)
}

**EXAMPLE REASONING (for reference):**
"This question tests knowledge of Working Load Limits (WLL) for lifting equipment. It aligns with MARN008 'Apply seamanship skills aboard a vessel up to 12 metres' because Element 1 'Handle ropes and mooring lines' includes performance criteria 1.1 'Ropes are handled safely' and 1.3 'Lifting operations are conducted safely'. The knowledge evidence specifically requires understanding of 'safe working loads' and 'rope handling procedures'. Keywords 'WLL', 'lifting sling', and 'crane' directly relate to safe lifting operations covered in this unit."

Now analyze the question and provide your response in JSON format.
`;
    }
    public async refineQuestions(rawQuestions: AssessmentQuestion[]): Promise<AssessmentQuestion[]> {
        // If mocking, return raw questions to avoid breaking flow
        if (this.openai.apiKey === 'mock-key' || this.openai.apiKey.startsWith('sk-mock')) {
            console.log("   (Mocking refinement - returning raw questions)");
            return rawQuestions;
        }

        // Limit batch size to avoid token limits (approx 20-30 questions per batch)
        // For now, we'll process all if small, or slice. 
        // Real implementation should chunk. We'll assume < 50 questions for this demo.
        // If > 50, we might hit limits. Let's just take the first 50 for safety in this iteration, 
        // or implement chunking if needed. The user's file seems small.

        const inputList = rawQuestions.map((q, index) => ({
            index: index,
            text: q.text.substring(0, 500) // Truncate very long text to save tokens
        }));

        const prompt = `
You are an expert data cleaner for assessment documents.
I have extracted a list of text blocks from a document. The extraction logic was imperfect and captured some answers as separate questions, or split questions into multiple parts.

**YOUR TASK:**
Review the list of text blocks and reconstruct the actual assessment questions.

**RULES:**
1. **Merge Answers**: If a text block appears to be an answer to the previous question (e.g., starts with "Answer:", "Response:", or contains specific technical details that answer the previous prompt), MERGE it into the previous question's text.
2. **Format Answers**: When merging an answer, wrap the answer text in "[[ANSWER: ...]]".
   - Example: "What is the WHS Act? [[ANSWER: Work Health and Safety Act 2011]]"
   - If the answer text is already merged but just plain text, wrap it.
   - **CRITICAL**: You MUST wrap the answer text. If the text is "Q1. ... Answer: ...", convert it to "Q1. ... [[ANSWER: Answer: ...]]".
3. **Merge Split Questions**: If a question is split across two blocks (e.g. block 1 is "1. What is", block 2 is "the capital?"), MERGE them.
4. **Remove Noise**: Remove blocks that are purely instructions (e.g. "Marking Guide", "End of Section", "Page 1 of 5") or page numbers.
5. **Preserve Content**: Do not summarize or rewrite the text, keep it exact. Only merge and format.

**INPUT LIST:**
${JSON.stringify(inputList, null, 2)}

**OUTPUT FORMAT (JSON):**
{
  "questions": [
    { 
      "text": "The full merged text with [[ANSWER: ...]] formatting", 
      "source_indices": [0, 1] // The indices from the input list that were merged to create this question
    }
  ]
}
`;

        try {
            console.log("   🧹 Refinement: Sending to AI for cleaning...");
            const completion = await this.openai.chat.completions.create({
                messages: [
                    { role: "system", content: "You are a precise data cleaning assistant." },
                    { role: "user", content: prompt }
                ],
                model: this.model,
                response_format: { type: "json_object" },
                temperature: 0 // Deterministic
            });

            const content = completion.choices[0].message.content;
            if (!content) return rawQuestions;

            const result = JSON.parse(content);
            const cleanedQuestions = result.questions;

            console.log(`   ✨ Refinement complete. Reduced ${rawQuestions.length} blocks to ${cleanedQuestions.length} questions.`);

            const finalQuestions: AssessmentQuestion[] = cleanedQuestions.map((q: any) => {
                const indices = q.source_indices as number[];
                if (!indices || indices.length === 0) return null;

                const primaryIndex = indices[0];
                const primaryOriginal = rawQuestions[primaryIndex];

                // Merge images from all source blocks
                let allImages: string[] = [];
                indices.forEach(idx => {
                    if (rawQuestions[idx] && rawQuestions[idx].images) {
                        allImages = allImages.concat(rawQuestions[idx].images!);
                    }
                });

                return {
                    ...primaryOriginal,
                    text: q.text,
                    images: allImages.length > 0 ? allImages : undefined
                };
            }).filter((q: AssessmentQuestion | null) => q !== null);

            return finalQuestions;

        } catch (error) {
            console.error("   ❌ Refinement failed:", error);
            return rawQuestions; // Fallback to raw
        }
    }
    public async describeImages(questions: AssessmentQuestion[]): Promise<AssessmentQuestion[]> {
        // Filter questions with images
        const questionsWithImages = questions.filter(q => q.images && q.images.length > 0);

        if (questionsWithImages.length === 0) return questions;

        console.log(`   🖼️  Analyzing ${questionsWithImages.length} questions with images...`);

        // Process in parallel
        const updatedQuestions = await Promise.all(questions.map(async (q) => {
            if (!q.images || q.images.length === 0) return q;

            // Only analyze the first image for now to save tokens/time
            const imageBase64 = q.images[0];
            // Ensure it has data prefix if missing (mammoth usually adds it, but safe check)
            const imageUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;

            try {
                // If mocking
                if (this.openai.apiKey === 'mock-key' || this.openai.apiKey.startsWith('sk-mock')) {
                    return { ...q, imageDescription: "MOCK DESCRIPTION: Image shows an anchor." };
                }

                const response = await this.openai.chat.completions.create({
                    model: "gpt-4o", // Force vision-capable model
                    messages: [
                        {
                            role: "user",
                            content: [
                                { type: "text", text: "Describe this image in detail. Identify any technical diagrams, equipment (e.g. anchors, ropes), and specifically read any RED TEXT or markings (like circles) on the image. Explain what the red markings are highlighting." },
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
                console.error(`   ❌ Failed to describe image for Q${q.id}:`, error);
                return q;
            }
        }));

        return updatedQuestions;
    }
}
