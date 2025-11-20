/**
 * Enhanced Word Document Assessment Parser
 * 
 * Parses Word documents (.docx) to extract assessment questions and their context.
 * Based on analysis of SMT maritime assessment files.
 */

import mammoth from 'mammoth';
import * as fs from 'fs';

export interface WordQuestion {
  id: string;
  questionText: string;
  context: string;
  type: 'knowledge' | 'performance' | 'observation';
  unitCodes: string[];
  section?: string;
  expectedAnswer?: string;
}

export interface WordAssessment {
  filename: string;
  title: string;
  unitCodes: string[];
  questions: WordQuestion[];
  metadata: {
    totalQuestions: number;
    assessmentType: 'knowledge' | 'performance' | 'mixed';
    hasMarkingSheet: boolean;
  };
}

/**
 * Extract text from Word document with paragraph structure
 */
async function extractWordWithStructure(filePath: string): Promise<{
  text: string;
  paragraphs: string[];
}> {
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer });
  
  const text = result.value;
  const paragraphs = text
    .split('\n')
    .map(p => p.trim())
    .filter(p => p.length > 0);
  
  return { text, paragraphs };
}

/**
 * Identify unit codes in text (e.g., MARI003, MARN008, MARH013)
 */
function extractUnitCodes(text: string): string[] {
  const patterns = [
    /\b[A-Z]{3,4}\d{3,4}[A-Z]?\b/g,  // MAR013, MARI003, MARH013
  ];
  
  const codes = new Set<string>();
  patterns.forEach(pattern => {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      // Filter out false positives (e.g., dates like "2024")
      const code = match[0];
      if (/^[A-Z]/.test(code) && /[A-Z]{3,}/.test(code)) {
        codes.add(code);
      }
    }
  });
  
  return Array.from(codes);
}

/**
 * Detect question type from filename and content
 */
function detectAssessmentType(filename: string, content: string): 'knowledge' | 'performance' | 'mixed' {
  const lower = filename.toLowerCase();
  
  if (lower.includes('knowledge')) return 'knowledge';
  if (lower.includes('performance')) return 'performance';
  
  // Check content
  const knowledgeKeywords = ['question', 'answer', 'what', 'why', 'how', 'explain'];
  const performanceKeywords = ['demonstrate', 'perform', 'activity', 'task', 'observation'];
  
  const lowerContent = content.toLowerCase();
  let knowledgeScore = 0;
  let performanceScore = 0;
  
  knowledgeKeywords.forEach(kw => {
    knowledgeScore += (lowerContent.match(new RegExp(kw, 'g')) || []).length;
  });
  
  performanceKeywords.forEach(kw => {
    performanceScore += (lowerContent.match(new RegExp(kw, 'g')) || []).length;
  });
  
  if (Math.abs(knowledgeScore - performanceScore) < 5) return 'mixed';
  return knowledgeScore > performanceScore ? 'knowledge' : 'performance';
}

/**
 * Extract questions from paragraphs
 */
function extractQuestions(paragraphs: string[], assessmentType: 'knowledge' | 'performance' | 'mixed'): WordQuestion[] {
  const questions: WordQuestion[] = [];
  let currentSection = '';
  let questionCounter = 0;
  
  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    const nextPara = i < paragraphs.length - 1 ? paragraphs[i + 1] : '';
    
    // Detect section headers (e.g., "Part 1: Ropework", "SECTION A")
    if (
      /^(Part|Section|Activity|Task)\s+\d+/i.test(para) ||
      /^[A-Z\s]{10,}$/.test(para) ||
      (para.length < 50 && para === para.toUpperCase() && /^[A-Z\s\-–]+$/.test(para))
    ) {
      currentSection = para;
      continue;
    }
    
    // Question patterns
    const isQuestion = 
      // Explicit question format
      /^Q\d+[:.)\s]/i.test(para) ||
      /^Question\s+\d+/i.test(para) ||
      /^Activity\s+\d+/i.test(para) ||
      /^Task\s+\d+/i.test(para) ||
      // Numbered list item that's a question
      /^\d+\.\s+.+\?/.test(para) ||
      // Ends with question mark and reasonable length
      (para.endsWith('?') && para.length > 20 && para.length < 500) ||
      // Command-style questions (List, Name, Describe, Explain)
      /^(List|Name|Describe|Explain|Identify|Define|What|When|Where|Why|How)\s+/i.test(para) ||
      // Performance task indicators
      /^(Demonstrate|Perform|Complete|Conduct|Show|Execute)/i.test(para);
    
    if (isQuestion) {
      questionCounter++;
      
      // Extract question text (remove question number prefix)
      let questionText = para
        .replace(/^Q\d+[:.)\s]+/i, '')
        .replace(/^Question\s+\d+[:.)\s]+/i, '')
        .replace(/^Activity\s+\d+[:.)\s]+/i, '')
        .replace(/^Task\s+\d+[:.)\s]+/i, '')
        .trim();
      
      // Skip if too short (likely not a real question)
      if (questionText.length < 10) continue;
      
      // Get context (surrounding paragraphs)
      const contextStart = Math.max(0, i - 2);
      const contextEnd = Math.min(paragraphs.length, i + 3);
      const context = paragraphs.slice(contextStart, contextEnd).join('\n');
      
      // Extract unit codes from context
      const unitCodes = extractUnitCodes(context);
      
      // Detect question type
      let questionType: 'knowledge' | 'performance' | 'observation' = 'knowledge';
      if (assessmentType === 'performance') {
        questionType = 'performance';
      } else if (/demonstrate|perform|show|conduct|execute/i.test(questionText)) {
        questionType = 'performance';
      } else if (/observe|witness|check|verify|inspect/i.test(questionText)) {
        questionType = 'observation';
      }
      
      // Look for expected answer in next few paragraphs
      let expectedAnswer = '';
      for (let j = i + 1; j < Math.min(i + 5, paragraphs.length); j++) {
        const next = paragraphs[j];
        // If next paragraph looks like an answer (not another question)
        if (
          !extractQuestions([next], assessmentType).length &&
          next.length > 10 &&
          next.length < 500 &&
          !next.match(/^(Part|Section|Activity|Task)/i)
        ) {
          expectedAnswer = next;
          break;
        }
      }
      
      questions.push({
        id: `Q${questionCounter}`,
        questionText,
        context,
        type: questionType,
        unitCodes,
        section: currentSection,
        expectedAnswer,
      });
    }
  }
  
  return questions;
}

/**
 * Parse a Word document assessment file
 */
export async function parseWordAssessment(filePath: string): Promise<WordAssessment> {
  const filename = filePath.split('/').pop() || filePath;
  
  // Extract content
  const { text, paragraphs } = await extractWordWithStructure(filePath);
  
  // Detect assessment type
  const assessmentType = detectAssessmentType(filename, text);
  
  // Extract unit codes
  const unitCodes = extractUnitCodes(text);
  
  // Extract questions
  const questions = extractQuestions(paragraphs, assessmentType);
  
  // Determine title
  let title = filename.replace(/\.(docx|doc)$/i, '');
  // Try to find a title in the first few paragraphs
  for (let i = 0; i < Math.min(5, paragraphs.length); i++) {
    const para = paragraphs[i];
    if (
      para.length < 100 &&
      para.length > 10 &&
      !para.includes('?') &&
      /^[A-Z]/.test(para)
    ) {
      title = para;
      break;
    }
  }
  
  return {
    filename,
    title,
    unitCodes,
    questions,
    metadata: {
      totalQuestions: questions.length,
      assessmentType,
      hasMarkingSheet: filename.toLowerCase().includes('marking'),
    },
  };
}

/**
 * Parse multiple Word assessment files
 */
export async function parseMultipleWordAssessments(filePaths: string[]): Promise<WordAssessment[]> {
  const assessments: WordAssessment[] = [];
  
  for (const filePath of filePaths) {
    try {
      const assessment = await parseWordAssessment(filePath);
      assessments.push(assessment);
    } catch (error) {
      console.error(`Error parsing ${filePath}:`, error);
    }
  }
  
  return assessments;
}

/**
 * Convert Word assessments to the format expected by the AI validation system
 */
export function convertWordToAssessmentFormat(wordAssessments: WordAssessment[]): any[] {
  return wordAssessments
    .filter(a => !a.metadata.hasMarkingSheet)  // Skip marking sheets
    .map(assessment => ({
      name: assessment.title,
      questions: assessment.questions.map(q => ({
        id: q.id,
        question: q.questionText,
        type: q.type,
        unitCodes: q.unitCodes.length > 0 ? q.unitCodes : assessment.unitCodes,
        context: q.context,
        expectedAnswer: q.expectedAnswer,
      })),
    }));
}
