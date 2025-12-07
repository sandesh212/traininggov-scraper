/**
 * Document Analyzer - Analyzes sample assessment files to understand their structure
 * This helps train and optimize the AI validation system
 */

import * as fs from 'fs';
import * as path from 'path';
import mammoth from 'mammoth';
import xlsx from 'xlsx';

export interface DocumentAnalysis {
  filename: string;
  type: 'word' | 'excel' | 'pdf';
  content: string;
  structure: {
    paragraphs?: number;
    tables?: number;
    questions?: string[];
    keywords?: string[];
    unitCodes?: string[];
  };
  metadata: {
    size: number;
    analyzed: Date;
  };
}

export interface AssessmentPattern {
  questionIndicators: string[];
  answerIndicators: string[];
  unitCodePatterns: RegExp[];
  commonStructures: string[];
}

/**
 * Extract text content from a Word document
 */
export async function extractWordContent(filePath: string): Promise<string> {
  try {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error(`Error extracting Word content from ${filePath}:`, error);
    throw error;
  }
}

/**
 * Extract content from an Excel file
 */
export function extractExcelContent(filePath: string): string {
  try {
    const workbook = xlsx.readFile(filePath);
    let content = '';
    
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      content += `\n=== Sheet: ${sheetName} ===\n`;
      content += xlsx.utils.sheet_to_txt(worksheet);
    });
    
    return content;
  } catch (error) {
    console.error(`Error extracting Excel content from ${filePath}:`, error);
    throw error;
  }
}

/**
 * Identify questions in text content
 */
export function identifyQuestions(content: string): string[] {
  const questions: string[] = [];
  
  // Common question patterns
  const patterns = [
    /Q\d+[:.)\s]+([^\n]+)/gi,                    // Q1: or Q1. or Q1)
    /Question\s+\d+[:.)\s]+([^\n]+)/gi,          // Question 1:
    /\d+\.\s+([^\n]+\?)/gi,                      // 1. What is...?
    /Task\s+\d+[:.)\s]+([^\n]+)/gi,              // Task 1:
    /Activity\s+\d+[:.)\s]+([^\n]+)/gi,          // Activity 1:
    /^[A-Z][^.!?]*\?$/gm,                        // Standalone questions
  ];
  
  patterns.forEach(pattern => {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const question = match[1] || match[0];
      if (question.trim().length > 10) {  // Filter out very short matches
        questions.push(question.trim());
      }
    }
  });
  
  return [...new Set(questions)];  // Remove duplicates
}

/**
 * Identify unit codes in content (e.g., MARH013, MARB027)
 */
export function identifyUnitCodes(content: string): string[] {
  const unitCodes: string[] = [];
  
  // Common unit code patterns
  const patterns = [
    /\b[A-Z]{3,4}\d{3,4}\b/g,                    // MAR013, MARH013
    /\b[A-Z]{2,4}[A-Z]\d{3,4}[A-Z]?\b/g,         // More flexible
  ];
  
  patterns.forEach(pattern => {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      unitCodes.push(match[0]);
    }
  });
  
  return [...new Set(unitCodes)];  // Remove duplicates
}

/**
 * Extract keywords from content
 */
export function extractKeywords(content: string): string[] {
  // Remove common words and focus on domain-specific terms
  const commonWords = new Set([
    'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but',
    'in', 'with', 'to', 'from', 'by', 'for', 'of', 'as', 'this', 'that',
    'be', 'are', 'was', 'were', 'been', 'have', 'has', 'had', 'do', 'does',
    'did', 'can', 'could', 'will', 'would', 'should', 'may', 'might', 'must'
  ]);
  
  // Extract words (3+ characters)
  const words = content
    .toLowerCase()
    .match(/\b[a-z]{3,}\b/g) || [];
  
  // Count frequencies
  const frequency = new Map<string, number>();
  words.forEach(word => {
    if (!commonWords.has(word)) {
      frequency.set(word, (frequency.get(word) || 0) + 1);
    }
  });
  
  // Get top keywords (appearing 3+ times)
  const keywords = Array.from(frequency.entries())
    .filter(([_, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([word, _]) => word);
  
  return keywords;
}

/**
 * Analyze a single document
 */
export async function analyzeDocument(filePath: string): Promise<DocumentAnalysis> {
  const filename = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const stats = fs.statSync(filePath);
  
  let content = '';
  let type: 'word' | 'excel' | 'pdf' = 'word';
  
  if (ext === '.docx' || ext === '.doc') {
    type = 'word';
    content = await extractWordContent(filePath);
  } else if (ext === '.xlsx' || ext === '.xls') {
    type = 'excel';
    content = extractExcelContent(filePath);
  } else if (ext === '.pdf') {
    type = 'pdf';
    // PDF support can be added later
    content = '';
  }
  
  // Analyze structure
  const questions = identifyQuestions(content);
  const unitCodes = identifyUnitCodes(content);
  const keywords = extractKeywords(content);
  const paragraphs = content.split('\n\n').length;
  
  return {
    filename,
    type,
    content,
    structure: {
      paragraphs,
      questions,
      keywords,
      unitCodes,
    },
    metadata: {
      size: stats.size,
      analyzed: new Date(),
    },
  };
}

/**
 * Analyze multiple documents and identify patterns
 */
export async function analyzeAssessmentPatterns(
  filePaths: string[]
): Promise<{
  analyses: DocumentAnalysis[];
  patterns: AssessmentPattern;
  summary: {
    totalDocuments: number;
    totalQuestions: number;
    commonUnits: string[];
    topKeywords: string[];
  };
}> {
  console.log(`\n🔍 Analyzing ${filePaths.length} assessment documents...\n`);
  
  const analyses: DocumentAnalysis[] = [];
  const allQuestionIndicators = new Set<string>();
  const allAnswerIndicators = new Set<string>();
  const allUnitCodes = new Set<string>();
  const keywordFrequency = new Map<string, number>();
  
  for (const filePath of filePaths) {
    console.log(`   📄 Analyzing ${path.basename(filePath)}...`);
    const analysis = await analyzeDocument(filePath);
    analyses.push(analysis);
    
    // Collect patterns
    analysis.structure.questions?.forEach(q => {
      const prefix = q.match(/^[^:)]+[:)]/)?.[0];
      if (prefix) allQuestionIndicators.add(prefix);
    });
    
    analysis.structure.unitCodes?.forEach(code => allUnitCodes.add(code));
    
    analysis.structure.keywords?.forEach(keyword => {
      keywordFrequency.set(
        keyword,
        (keywordFrequency.get(keyword) || 0) + 1
      );
    });
  }
  
  // Identify common unit codes (appear in multiple documents)
  const unitCodeCount = new Map<string, number>();
  analyses.forEach(a => {
    a.structure.unitCodes?.forEach(code => {
      unitCodeCount.set(code, (unitCodeCount.get(code) || 0) + 1);
    });
  });
  
  const commonUnits = Array.from(unitCodeCount.entries())
    .filter(([_, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([code, _]) => code);
  
  // Top keywords across all documents
  const topKeywords = Array.from(keywordFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([word, _]) => word);
  
  const totalQuestions = analyses.reduce(
    (sum, a) => sum + (a.structure.questions?.length || 0),
    0
  );
  
  return {
    analyses,
    patterns: {
      questionIndicators: Array.from(allQuestionIndicators),
      answerIndicators: Array.from(allAnswerIndicators),
      unitCodePatterns: [
        /\b[A-Z]{3,4}\d{3,4}\b/g,
        /\b[A-Z]{2,4}[A-Z]\d{3,4}[A-Z]?\b/g,
      ],
      commonStructures: [
        'Knowledge assessment',
        'Performance assessment',
        'Marking sheet',
        'Open book',
        'Closed book',
      ],
    },
    summary: {
      totalDocuments: analyses.length,
      totalQuestions,
      commonUnits,
      topKeywords,
    },
  };
}

/**
 * Save analysis results to JSON file
 */
export function saveAnalysisResults(
  results: any,
  outputPath: string
): void {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(
    outputPath,
    JSON.stringify(results, null, 2),
    'utf-8'
  );
  
  console.log(`\n✅ Analysis results saved to: ${outputPath}`);
}

/**
 * Generate training data from analyzed documents
 * This creates examples for fine-tuning or improving matching accuracy
 */
export function generateTrainingData(analyses: DocumentAnalysis[]): {
  examples: Array<{
    question: string;
    unitCodes: string[];
    keywords: string[];
    context: string;
  }>;
} {
  const examples: Array<{
    question: string;
    unitCodes: string[];
    keywords: string[];
    context: string;
  }> = [];
  
  analyses.forEach(analysis => {
    const questions = analysis.structure.questions || [];
    const unitCodes = analysis.structure.unitCodes || [];
    const keywords = analysis.structure.keywords || [];
    
    questions.forEach(question => {
      // Get context around the question (50 chars before and after)
      const questionIndex = analysis.content.indexOf(question);
      const contextStart = Math.max(0, questionIndex - 100);
      const contextEnd = Math.min(
        analysis.content.length,
        questionIndex + question.length + 100
      );
      const context = analysis.content.substring(contextStart, contextEnd);
      
      examples.push({
        question,
        unitCodes,
        keywords,
        context,
      });
    });
  });
  
  return { examples };
}
