/**
 * Custom AI Service - Fast & Free
 * 
 * Uses proven NLP techniques instead of external AI:
 * - TF-IDF for semantic similarity
 * - Keyword extraction and matching
 * - Cosine similarity for text comparison
 * - Rule-based classification
 * 
 * NO external API calls - runs 100% locally and FAST!
 */

// ============================================================================
// TEXT PREPROCESSING
// ============================================================================

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'will', 'with'
]);

/**
 * Tokenize and clean text
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word));
}

/**
 * Extract key terms (nouns, verbs, technical terms)
 */
function extractKeyTerms(text: string): string[] {
  const tokens = tokenize(text);
  
  // Keep technical terms, numbers, and important words
  return tokens.filter(token => {
    // Keep technical terms (uppercase in original, numbers, long words)
    return (
      /\d/.test(token) || // Contains numbers
      token.length > 6 || // Long words tend to be important
      /^[A-Z]/.test(text) && text.includes(token) // Was capitalized
    );
  });
}

// ============================================================================
// TF-IDF VECTORIZATION
// ============================================================================

interface TFIDFVector {
  [term: string]: number;
}

/**
 * Calculate Term Frequency
 */
function calculateTF(tokens: string[]): TFIDFVector {
  const tf: TFIDFVector = {};
  const total = tokens.length;
  
  tokens.forEach(token => {
    tf[token] = (tf[token] || 0) + 1;
  });
  
  // Normalize by document length
  Object.keys(tf).forEach(term => {
    tf[term] = tf[term] / total;
  });
  
  return tf;
}

/**
 * Calculate Inverse Document Frequency
 */
function calculateIDF(documents: string[][]): { [term: string]: number } {
  const idf: { [term: string]: number } = {};
  const docCount = documents.length;
  
  // Count documents containing each term
  const termDocCount: { [term: string]: number } = {};
  documents.forEach(doc => {
    const uniqueTerms = new Set(doc);
    uniqueTerms.forEach(term => {
      termDocCount[term] = (termDocCount[term] || 0) + 1;
    });
  });
  
  // Calculate IDF
  Object.keys(termDocCount).forEach(term => {
    idf[term] = Math.log(docCount / termDocCount[term]);
  });
  
  return idf;
}

/**
 * Calculate TF-IDF vector for a document
 */
function calculateTFIDF(tokens: string[], idf: { [term: string]: number }): TFIDFVector {
  const tf = calculateTF(tokens);
  const tfidf: TFIDFVector = {};
  
  Object.keys(tf).forEach(term => {
    tfidf[term] = tf[term] * (idf[term] || 0);
  });
  
  return tfidf;
}

// ============================================================================
// SIMILARITY CALCULATION
// ============================================================================

/**
 * Calculate cosine similarity between TF-IDF vectors
 */
function cosineSimilarity(vecA: TFIDFVector, vecB: TFIDFVector): number {
  const allTerms = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  allTerms.forEach(term => {
    const a = vecA[term] || 0;
    const b = vecB[term] || 0;
    
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  });
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Calculate Jaccard similarity (for keyword overlap)
 */
function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

// ============================================================================
// DOMAIN-SPECIFIC KEYWORD MATCHING
// ============================================================================

/**
 * Extract maritime/RTO-specific keywords
 */
function extractDomainKeywords(text: string): Set<string> {
  const keywords = new Set<string>();
  const lowerText = text.toLowerCase();
  
  // Maritime terms
  const maritimeTerms = [
    'vessel', 'boat', 'ship', 'marine', 'navigation', 'maritime', 'seamanship',
    'anchor', 'mooring', 'crew', 'master', 'coxswain', 'deck', 'hull', 'safety',
    'equipment', 'regulations', 'legislation', 'license', 'certification',
    'environmental', 'fuel', 'engine', 'motor', 'propulsion', 'cargo', 'passenger'
  ];
  
  // Technical/procedural terms
  const technicalTerms = [
    'perform', 'operate', 'maintain', 'inspect', 'monitor', 'manage', 'plan',
    'demonstrate', 'identify', 'comply', 'ensure', 'check', 'follow', 'apply'
  ];
  
  // Add domain keywords found in text
  [...maritimeTerms, ...technicalTerms].forEach(term => {
    if (lowerText.includes(term)) {
      keywords.add(term);
    }
  });
  
  return keywords;
}

// ============================================================================
// MAIN MATCHING ENGINE
// ============================================================================

export interface MatchResult {
  similarity: number;
  confidence: 'high' | 'medium' | 'low';
  explanation: string;
  keywordOverlap: number;
  semanticScore: number;
}

/**
 * Match a question to a Performance Criterion
 */
export function matchQuestionToPC(
  questionText: string,
  pcText: string,
  allPCTexts: string[]
): MatchResult {
  // Tokenize both texts
  const questionTokens = tokenize(questionText);
  const pcTokens = tokenize(pcText);
  
  // Calculate IDF across all PCs for better context
  const allDocuments = [questionTokens, ...allPCTexts.map(pc => tokenize(pc))];
  const idf = calculateIDF(allDocuments);
  
  // Calculate TF-IDF vectors
  const questionVector = calculateTFIDF(questionTokens, idf);
  const pcVector = calculateTFIDF(pcTokens, idf);
  
  // Calculate semantic similarity (TF-IDF cosine)
  const semanticScore = cosineSimilarity(questionVector, pcVector);
  
  // Calculate keyword overlap
  const questionKeywords = extractDomainKeywords(questionText);
  const pcKeywords = extractDomainKeywords(pcText);
  const keywordOverlap = jaccardSimilarity(questionKeywords, pcKeywords);
  
  // Check for exact keyword matches (boosts score)
  const exactMatches = [...questionKeywords].filter(k => pcKeywords.has(k)).length;
  const exactMatchBonus = Math.min(exactMatches * 0.1, 0.3); // Up to 0.3 bonus
  
  // Hybrid score (weighted combination with bonus)
  const similarity = Math.min(
    (semanticScore * 0.5) + (keywordOverlap * 0.3) + exactMatchBonus + 0.2, // Base boost for any match
    1.0
  );
  
  // Determine confidence (more lenient thresholds)
  let confidence: 'high' | 'medium' | 'low';
  if (similarity >= 0.4) confidence = 'high';
  else if (similarity >= 0.25) confidence = 'medium';
  else confidence = 'low';
  
  // Generate explanation
  const explanation = generateExplanation(
    questionText,
    pcText,
    questionKeywords,
    pcKeywords,
    similarity
  );
  
  return {
    similarity,
    confidence,
    explanation,
    keywordOverlap,
    semanticScore,
  };
}

/**
 * Generate human-readable explanation for match
 */
function generateExplanation(
  questionText: string,
  pcText: string,
  questionKeywords: Set<string>,
  pcKeywords: Set<string>,
  similarity: number
): string {
  const sharedKeywords = [...questionKeywords].filter(k => pcKeywords.has(k));
  
  if (similarity >= 0.5) {
    if (sharedKeywords.length > 0) {
      return `Strong match: Both texts focus on ${sharedKeywords.slice(0, 3).join(', ')}. ` +
             `The question directly addresses concepts in this performance criterion.`;
    }
    return `Strong semantic match: Question content aligns well with PC requirements.`;
  } else if (similarity >= 0.3) {
    if (sharedKeywords.length > 0) {
      return `Moderate match: Shared concepts include ${sharedKeywords.slice(0, 2).join(', ')}. ` +
             `Question partially addresses this performance criterion.`;
    }
    return `Moderate match: Some conceptual overlap between question and PC.`;
  } else {
    if (sharedKeywords.length > 0) {
      return `Weak match: Limited overlap (${sharedKeywords.join(', ')}). ` +
             `Question may touch on related concepts but doesn't directly assess this PC.`;
    }
    return `Weak match: Minimal alignment between question content and PC requirements.`;
  }
}

// ============================================================================
// BATCH PROCESSING
// ============================================================================

export interface BatchMatchResult {
  questionId: string;
  pcMatches: Array<{
    unitCode: string;
    elementNumber: string;
    pcNumber: string;
    pcText: string;
    match: MatchResult;
  }>;
}

/**
 * Match multiple questions to multiple PCs efficiently
 */
export function batchMatchQuestionsToPC(
  questions: Array<{ id: string; text: string }>,
  performanceCriteria: Array<{
    unitCode: string;
    elementNumber: string;
    pcNumber: string;
    text: string;
  }>
): BatchMatchResult[] {
  console.log(`\n🧠 Custom AI Engine - Processing ${questions.length} questions against ${performanceCriteria.length} PCs...`);
  
  // Pre-compute IDF for all PCs (one-time calculation)
  const allPCTexts = performanceCriteria.map(pc => pc.text);
  const startTime = Date.now();
  
  const results: BatchMatchResult[] = [];
  
  questions.forEach((question, idx) => {
    const matches: BatchMatchResult['pcMatches'] = [];
    
    // Match question against all PCs
    performanceCriteria.forEach(pc => {
      const matchResult = matchQuestionToPC(question.text, pc.text, allPCTexts);
      
      // Only keep matches above threshold (0.2 for broader coverage)
      if (matchResult.similarity >= 0.2) {
        matches.push({
          unitCode: pc.unitCode,
          elementNumber: pc.elementNumber,
          pcNumber: pc.pcNumber,
          pcText: pc.text,
          match: matchResult,
        });
      }
    });
    
    // Sort by similarity (best matches first)
    matches.sort((a, b) => b.match.similarity - a.match.similarity);
    
    results.push({
      questionId: question.id,
      pcMatches: matches.slice(0, 5), // Keep top 5 matches
    });
    
    // Progress indicator
    if ((idx + 1) % 10 === 0 || idx === questions.length - 1) {
      const progress = ((idx + 1) / questions.length * 100).toFixed(0);
      console.log(`   [${idx + 1}/${questions.length}] ${progress}% complete`);
    }
  });
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✅ Completed in ${elapsed}s (average ${(parseFloat(elapsed) / questions.length).toFixed(2)}s per question)\n`);
  
  return results;
}

// ============================================================================
// PERFORMANCE ANALYSIS
// ============================================================================

/**
 * Analyze coverage of PCs by questions
 */
export function analyzeCoverage(
  batchResults: BatchMatchResult[],
  allPCs: Array<{ unitCode: string; elementNumber: string; pcNumber: string }>
): {
  covered: Set<string>;
  uncovered: Set<string>;
  coverageRate: number;
} {
  const covered = new Set<string>();
  
  batchResults.forEach(result => {
    result.pcMatches.forEach(match => {
      // Consider covered if high or medium confidence
      if (match.match.confidence !== 'low') {
        const pcId = `${match.unitCode}:${match.elementNumber}.${match.pcNumber}`;
        covered.add(pcId);
      }
    });
  });
  
  const allPCIds = new Set(
    allPCs.map(pc => `${pc.unitCode}:${pc.elementNumber}.${pc.pcNumber}`)
  );
  
  const uncovered = new Set(
    [...allPCIds].filter(pcId => !covered.has(pcId))
  );
  
  return {
    covered,
    uncovered,
    coverageRate: allPCIds.size > 0 ? (covered.size / allPCIds.size) * 100 : 0,
  };
}
