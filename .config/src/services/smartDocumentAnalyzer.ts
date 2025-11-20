/**
 * Smart Document Analyzer
 * 
 * Intelligently analyzes assessment documents to:
 * 1. Auto-detect unit codes (from text or semantic matching)
 * 2. Differentiate questions vs answers vs instructions
 * 3. Extract all relevant units from database
 * 4. No hardcoded values!
 */

import { readFileSync } from 'fs';
import { join } from 'path';

export interface SmartAnalysisResult {
  detectedUnits: string[];
  questions: Array<{
    id: string;
    text: string;
    type: 'question' | 'answer' | 'instruction' | 'image_reference';
    context: string;
  }>;
  metadata: {
    filename: string;
    totalContent: string;
    hasExplicitUnits: boolean;
    suggestedUnits: string[];
  };
}

/**
 * Detect unit codes explicitly mentioned in the document
 */
export function detectExplicitUnits(content: string): string[] {
  const unitPatterns = [
    /\b([A-Z]{3,4}\d{3,4}[A-Z]?)\b/g,  // MARI003, MARH013, BSBTWK201
  ];
  
  const found = new Set<string>();
  
  unitPatterns.forEach(pattern => {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const code = match[1];
      // Filter out false positives (dates, etc.)
      if (/^[A-Z]{3,}/.test(code) && /\d{3,}/.test(code)) {
        found.add(code);
      }
    }
  });
  
  return Array.from(found);
}

/**
 * Intelligently differentiate content types
 */
export function classifyContent(text: string): 'question' | 'answer' | 'instruction' | 'image_reference' {
  const lower = text.toLowerCase();
  
  // Image references
  if (/image|figure|diagram|photo|illustration/i.test(text) && text.length < 100) {
    return 'image_reference';
  }
  
  // Instructions (imperative, procedural)
  if (/^(complete|read|refer|ensure|provide|submit|attach|note:|important:)/i.test(text)) {
    return 'instruction';
  }
  
  if (/instruction|guideline|please|must|should|required|assessment condition/i.test(lower)) {
    return 'instruction';
  }
  
  // Questions (interrogative)
  if (text.trim().endsWith('?')) {
    return 'question';
  }
  
  if (/^(what|when|where|who|why|how|describe|explain|list|identify|name|state)\b/i.test(text)) {
    return 'question';
  }
  
  // Numbered questions
  if (/^(q\.?|question)\s*\d+/i.test(text)) {
    return 'question';
  }
  
  // Task/Activity (treat as questions)
  if (/^(task|activity|exercise)\s*\d+/i.test(text)) {
    return 'question';
  }
  
  // Answers (declarative, often follow questions)
  if (/^answer|^response|^a\.|^option [a-d]/i.test(text)) {
    return 'answer';
  }
  
  // Default: if short and specific, likely an answer; if explanatory, likely a question
  if (text.length < 50 && !text.includes('?')) {
    return 'answer';
  }
  
  return 'question'; // Default to question if unclear
}

/**
 * Extract meaningful content blocks from document
 */
export function extractContentBlocks(content: string): Array<{ text: string; type: string }> {
  // Split by paragraphs and clean
  const paragraphs = content
    .split('\n')
    .map(p => p.trim())
    .filter(p => p.length > 10); // Ignore very short lines
  
  const blocks: Array<{ text: string; type: string }> = [];
  
  for (const para of paragraphs) {
    const type = classifyContent(para);
    blocks.push({ text: para, type });
  }
  
  return blocks;
}

/**
 * Semantic matching to suggest relevant units based on document content
 */
export function suggestUnitsSemanticly(content: string, allUnits: any[]): string[] {
  const keywords = extractDomainKeywords(content.toLowerCase());
  const suggestions = new Set<string>();
  
  // Match keywords against unit titles and descriptions
  allUnits.forEach(unit => {
    const unitText = `${unit.title} ${unit.code}`.toLowerCase();
    const elementText = unit.elements?.map((el: any) => el.element || '').join(' ').toLowerCase() || '';
    
    let score = 0;
    keywords.forEach(keyword => {
      if (unitText.includes(keyword)) score += 3;
      if (elementText.includes(keyword)) score += 1;
    });
    
    if (score >= 2) {
      suggestions.add(unit.code);
    }
  });
  
  return Array.from(suggestions);
}

/**
 * Extract domain-specific keywords from content
 */
function extractDomainKeywords(content: string): string[] {
  // Maritime-specific terms (customize for your domain)
  const domainTerms = [
    'vessel', 'marine', 'navigation', 'safety', 'propulsion', 'engine',
    'maintenance', 'cargo', 'crew', 'deck', 'machinery', 'steering',
    'emergency', 'radio', 'communication', 'stability', 'electrical',
    'hydraulic', 'fuel', 'oil', 'pump', 'system', 'equipment',
    'inspection', 'repair', 'service', 'operation', 'procedure'
  ];
  
  const found: string[] = [];
  domainTerms.forEach(term => {
    if (content.includes(term)) {
      found.push(term);
    }
  });
  
  return found;
}

/**
 * Main smart analysis function
 */
export async function analyzeDocumentSmart(
  filePath: string,
  allUnitsData: any[]
): Promise<SmartAnalysisResult> {
  // Read the assessment file (assume Word parser already extracts text)
  const { parseWordAssessment } = await import('./wordAssessmentParser.js');
  const assessment = await parseWordAssessment(filePath);
  
  const fullContent = assessment.questions.map(q => q.questionText).join('\n');
  
  // 1. Detect explicit unit codes
  const explicitUnits = detectExplicitUnits(fullContent);
  
  // 2. Suggest units semantically if no explicit codes found
  const suggestedUnits = explicitUnits.length === 0
    ? suggestUnitsSemanticly(fullContent, allUnitsData)
    : [];
  
  // 3. Use explicit OR suggested units
  const detectedUnits = explicitUnits.length > 0 ? explicitUnits : suggestedUnits;
  
  // 4. Classify each content block
  const blocks = extractContentBlocks(fullContent);
  
  const questions = blocks
    .filter(b => b.type === 'question')
    .map((b, idx) => ({
      id: `q${idx + 1}`,
      text: b.text.substring(0, 200), // Truncate for display
      type: b.type as any,
      context: b.text
    }));
  
  return {
    detectedUnits,
    questions,
    metadata: {
      filename: filePath.split('/').pop() || 'unknown',
      totalContent: fullContent,
      hasExplicitUnits: explicitUnits.length > 0,
      suggestedUnits
    }
  };
}
