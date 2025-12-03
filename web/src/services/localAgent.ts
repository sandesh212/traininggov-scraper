import { pipeline } from '@xenova/transformers';
import { Unit } from './uocLoader';
import { AssessmentQuestion } from '../models/types';
import { parseEvidenceHierarchy, EvidenceNode } from '../../src/utils/evidenceHierarchy';

// Define the structure for our "Knowledge Base"
interface VectorEntry {
    unitCode: string;
    type: 'criteria' | 'knowledge' | 'performance';
    id: string;
    text: string;
    embedding: number[];
}

export class LocalAgent {
    private extractor: any;
    private vectorIndex: VectorEntry[] = [];
    private isInitialized: boolean = false;

    // Singleton instance to avoid reloading model
    private static instance: LocalAgent;

    public static async getInstance(): Promise<LocalAgent> {
        if (!LocalAgent.instance) {
            LocalAgent.instance = new LocalAgent();
            await LocalAgent.instance.init();
        }
        return LocalAgent.instance;
    }

    private async init() {
        console.log("🧠 Loading local AI model (Xenova/all-MiniLM-L6-v2)...");
        // This downloads the model once and runs it locally
        this.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        this.isInitialized = true;
        console.log("✅ AI Model loaded successfully.");
    }

    /**
     * "Train" the agent by indexing the provided Units of Competency.
     * This converts all text into mathematical vectors.
     */
    public async train(units: Unit[]) {
        if (!this.isInitialized) await this.init();

        console.log(`📚 Training agent on ${units.length} units...`);
        this.vectorIndex = []; // Clear previous training

        for (const unit of units) {
            // 1. Index Performance Criteria
            for (const element of unit.elements) {
                for (const pc of element.performanceCriteria) {
                    const text = `${unit.code} ${unit.title} - ${element.title}: ${pc.text}`;
                    const embedding = await this.getEmbedding(text);
                    this.vectorIndex.push({
                        unitCode: unit.code,
                        type: 'criteria',
                        id: pc.id,
                        text: pc.text,
                        embedding
                    });
                }
            }

            // 2. Index Knowledge Evidence (hierarchical)
            if (unit.knowledgeEvidence) {
                const keNodes = parseEvidenceHierarchy(unit.knowledgeEvidence);
                // Recursively index all nodes with hierarchical IDs
                const indexEvidence = async (nodes: EvidenceNode[], prefix: string) => {
                    for (let i = 0; i < nodes.length; i++) {
                        const node = nodes[i];
                        const nodeId = prefix ? `${prefix}.${i + 1}` : `K${i + 1}`;
                        const embedding = await this.getEmbedding(`${unit.code} ${unit.title} Knowledge: ${node.text}`);
                        this.vectorIndex.push({
                            unitCode: unit.code,
                            type: 'knowledge',
                            id: nodeId,
                            text: node.text.trim(),
                            embedding
                        });
                        if (node.children && node.children.length > 0) {
                            await indexEvidence(node.children, nodeId);
                        }
                    }
                };
                await indexEvidence(keNodes, '');
            }

            // 3. Index Performance Evidence (hierarchical)
            if (unit.performanceEvidence) {
                const peNodes = parseEvidenceHierarchy(unit.performanceEvidence);
                const indexPE = async (nodes: EvidenceNode[], prefix: string) => {
                    for (let i = 0; i < nodes.length; i++) {
                        const node = nodes[i];
                        const nodeId = prefix ? `${prefix}.${i + 1}` : `PE${i + 1}`;
                        const embedding = await this.getEmbedding(`${unit.code} ${unit.title} Performance: ${node.text}`);
                        this.vectorIndex.push({
                            unitCode: unit.code,
                            type: 'performance',
                            id: nodeId,
                            text: node.text.trim(),
                            embedding
                        });
                        if (node.children && node.children.length > 0) {
                            await indexPE(node.children, nodeId);
                        }
                    }
                };
                await indexPE(peNodes, '');
            }
        }
        console.log(`✅ Training complete. Indexed ${this.vectorIndex.length} knowledge points.`);
    }

    /**
     * Analyze a question and find the best matching Unit and Criteria.
     * Uses Hybrid Search (Vector + Keyword Boosting) for better accuracy.
     */
    public async analyze(question: AssessmentQuestion) {
        if (!this.isInitialized) await this.init();

        // 1. Understand the question (Vectorize)
        const textToEmbed = question.text + (question.imageDescription ? ` [Image Context: ${question.imageDescription}]` : "");
        const qEmbedding = await this.getEmbedding(textToEmbed);
        const qKeywords = this.getKeywords(question.text);
        const qLower = question.text.toLowerCase();

        // Heuristic: Determine intent based on question words
        const isKnowledgeQuestion = /^(how|what|why|explain|describe|list|define|identify|state|give|name|outline|compare)/.test(qLower);
        const isPerformanceQuestion = /^(demonstrate|perform|show|apply|operate|use|conduct|carry out)/.test(qLower);

        // Parse Mapping Hint if available
        let hintUnit: string | null = null;
        let hintCriteria: string[] = [];
        let hintKnowledge: string[] = [];

        if (question.mappingHint) {
            const parts = question.mappingHint.split('-');
            if (parts.length >= 2) {
                const unitSuffix = parts[0].trim(); // e.g. "N008"

                // Find matching unit in index (e.g. MARN008 ends with N008)
                const matchedUnit = this.vectorIndex.find(v => v.unitCode.endsWith(unitSuffix));
                if (matchedUnit) {
                    hintUnit = matchedUnit.unitCode;
                }

                const items = parts[1].split(/[,:]/).map(s => s.trim()).filter(Boolean);
                hintCriteria = items.filter(i => i.startsWith('PC') || /^\d+\.\d+$/.test(i));
                hintKnowledge = items.filter(i => i.startsWith('K'));
            }
        }

        // 2. Hybrid Search (Cosine Similarity + Keyword Boost)
        const matches = this.vectorIndex.map(entry => {
            const vectorScore = this.cosineSimilarity(qEmbedding, entry.embedding);

            // Keyword Boost
            let keywordBoost = 0;
            const entryTextLower = entry.text.toLowerCase();

            // Check for keyword matches
            let matchCount = 0;
            for (const kw of qKeywords) {
                // Whole word match preferred, but partial is okay for now
                if (entryTextLower.includes(kw)) {
                    matchCount++;
                }
            }

            // Boost logic: 0.05 (5%) per keyword match, max 0.30 (30%)
            keywordBoost = Math.min(matchCount * 0.05, 0.30);

            // Intent Boost (Knowledge vs Performance)
            if (isKnowledgeQuestion && entry.type === 'knowledge') {
                keywordBoost += 0.15; // Boost Knowledge Evidence for "How/What/Why" questions
            }
            if (isPerformanceQuestion && entry.type === 'performance') {
                keywordBoost += 0.15; // Boost Performance Evidence for "Demonstrate/Perform" questions
            }

            // Hint Boost
            if (hintUnit && entry.unitCode === hintUnit) {
                keywordBoost += 0.5; // Strong boost for unit match
            }

            if (hintCriteria.some(c => {
                const cleanC = c.replace(/^PC/, '');
                return entry.id === cleanC || entry.id === c;
            })) {
                keywordBoost += 1.0; // Massive boost for exact criteria match
            }

            if (hintKnowledge.some(k => {
                return entry.id === k || entry.id.startsWith(k + '.');
            })) {
                keywordBoost += 1.0; // Massive boost for exact knowledge match
            }

            return {
                ...entry,
                score: vectorScore + keywordBoost,
                vectorScore
            };
        });

        // 3. Sort by best match
        matches.sort((a, b) => b.score - a.score);

        // Get top 5 matches to form a consensus
        const topMatches = matches.slice(0, 5);
        const bestMatch = topMatches[0];

        if (!bestMatch) {
            return {
                questionId: question.id,
                questionText: question.text,
                isValid: false,
                mappedUnit: null,
                mappedCriteria: [],
                mappedKnowledge: [],
                confidence: 0,
                reasoning: "Analysis Failed: No matching units found in knowledge base. Please ensure Units of Competency are loaded."
            };
        }

        // --- COMPLIANCE CHECKS ---

        // 1. Validity: Does the question align with the unit?
        // Threshold: 0.25 (higher now due to boost)
        const isValid = bestMatch.score > 0.25;

        // If the best match is extremely weak, return invalid
        if (!isValid) {
            return {
                questionId: question.id,
                questionText: question.text,
                isValid: false,
                mappedUnit: null,
                mappedCriteria: [],
                mappedKnowledge: [],
                confidence: Math.min(Math.round(bestMatch.score * 100), 100),
                reasoning: "Non-Compliant (Validity): The question does not demonstrate sufficient semantic alignment with any Unit requirements. It may be irrelevant or poorly worded."
            };
        }

        // Group matches by unit to find the dominant unit
        const unitScores: Record<string, number> = {};
        topMatches.forEach(m => {
            unitScores[m.unitCode] = (unitScores[m.unitCode] || 0) + m.score;
        });

        const bestUnit = Object.entries(unitScores).sort((a, b) => b[1] - a[1])[0][0];

        // Filter matches for the best unit
        const unitMatches = topMatches.filter(m => m.unitCode === bestUnit);
        const criteria = unitMatches.filter(m => m.type === 'criteria').map(m => m.id);
        // Return Knowledge as hierarchical ID: Text (e.g., K1, K1.1, ...)
        const knowledge = unitMatches.filter(m => m.type === 'knowledge').map(m => `${m.id}: ${m.text}`);
        const performance = unitMatches.filter(m => m.type === 'performance').map(m => `${m.id}: ${m.text}`);

        // 2. Sufficiency (Partial): Does it cover multiple aspects?
        let coverageNote = '';
        if (criteria.length > 0) {
            coverageNote = criteria.length > 1
                ? `Covers multiple criteria (${criteria.join(', ')}).`
                : `Addresses criterion ${criteria[0]}.`;
        } else if (knowledge.length > 0 || performance.length > 0) {
            coverageNote = `Aligns with Knowledge/Performance Evidence.`;
        } else {
            coverageNote = `Weak alignment with unit requirements.`;
        }

        const intentDescription = isKnowledgeQuestion ? 'knowledge' : isPerformanceQuestion ? 'skills' : 'requirements';

        return {
            questionId: question.id,
            questionText: question.text,
            questionSection: question.section,
            images: question.images,
            imageDescription: question.imageDescription,
            isValid: true,
            mappedUnit: bestUnit,
            mappedCriteria: [...new Set(criteria)], // Unique IDs
            mappedKnowledge: [...new Set(knowledge)],
            mappedPerformanceEvidence: [...new Set(performance)],
            confidence: Math.min(Math.round(bestMatch.score * 100), 99), // Cap at 99%
            reasoning: `Compliant: Matched to ${bestUnit} (${bestMatch.id}). The question tests ${intentDescription} related to "${bestMatch.text}". Hybrid score: ${Math.round(bestMatch.score * 100)}%.`
        };
    }

    private getKeywords(text: string): string[] {
        const stopwords = new Set(['the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'in', 'to', 'of', 'for', 'with', 'by', 'how', 'what', 'why', 'when', 'where', 'do', 'does', 'did', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'it', 'its', 'from', 'as', 'that', 'this', 'these', 'those', 'or', 'if', 'but', 'not', 'can', 'will', 'may', 'should', 'could', 'would']);
        return text.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 2 && !stopwords.has(w));
    }

    // --- Helper Functions ---

    private async getEmbedding(text: string): Promise<number[]> {
        const output = await this.extractor(text, { pooling: 'mean', normalize: true });
        return Array.from(output.data);
    }

    private cosineSimilarity(a: number[], b: number[]): number {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}
