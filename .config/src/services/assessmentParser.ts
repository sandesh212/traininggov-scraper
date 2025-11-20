/**
 * Assessment Parser
 * 
 * Parses assessment documents (Excel) to extract questions and tasks.
 * Handles multiple assessment formats and question types.
 */

import XLSX from 'xlsx';
import type { Assessment, AssessmentQuestion } from './aiValidationService.js';

// ============================================================================
// ASSESSMENT PARSING
// ============================================================================

export interface AssessmentParseOptions {
  questionColumnName?: string;
  typeColumnName?: string;
  categoryColumnName?: string;
  subcategoryColumnName?: string;
  sheetName?: string; // Specific sheet to parse, or all sheets if not provided
}

/**
 * Parse assessment Excel file and extract questions
 */
export function parseAssessmentExcel(
  filePath: string,
  options: AssessmentParseOptions = {}
): Assessment[] {
  const workbook = XLSX.readFile(filePath);
  const assessments: Assessment[] = [];
  
  const sheetsToProcess = options.sheetName
    ? [options.sheetName]
    : workbook.SheetNames;
  
  for (const sheetName of sheetsToProcess) {
    if (!workbook.Sheets[sheetName]) continue;
    
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    
    if (rows.length === 0) continue;
    
    const questions: AssessmentQuestion[] = [];
    let questionCounter = 1;
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as any;
      
      // Try to find question text from various column names
      const questionText = findQuestionText(row, options.questionColumnName);
      if (!questionText || questionText.trim().length === 0) continue;
      
      // Determine question type
      const type = determineQuestionType(row, options.typeColumnName);
      
      // Extract category and subcategory if available
      const category = options.categoryColumnName ? row[options.categoryColumnName] : undefined;
      const subcategory = options.subcategoryColumnName ? row[options.subcategoryColumnName] : undefined;
      
      questions.push({
        id: `${sheetName}_Q${questionCounter}`,
        text: questionText,
        type,
        category,
        subcategory,
      });
      
      questionCounter++;
    }
    
    if (questions.length > 0) {
      assessments.push({
        id: sheetName,
        name: sheetName,
        questions,
      });
    }
  }
  
  return assessments;
}

/**
 * Find question text from row, trying common column names
 */
function findQuestionText(row: any, preferredColumn?: string): string {
  if (preferredColumn && row[preferredColumn]) {
    return String(row[preferredColumn]).trim();
  }
  
  // Try common column names for questions
  const commonNames = [
    'Question',
    'question',
    'Assessment Question',
    'Task',
    'Activity',
    'Learners workbook question',
    'Workbook Classroom Activity',
    'Workbook Practical assessment',
    'Knowledge Question',
    'Performance Task',
    'Observation',
    'Description',
  ];
  
  for (const name of commonNames) {
    if (row[name] && String(row[name]).trim().length > 0) {
      return String(row[name]).trim();
    }
  }
  
  // Fallback: use first non-empty column value that looks like a question
  for (const key in row) {
    const value = String(row[key]).trim();
    if (value.length > 10) {
      // Likely a question if it's longer than 10 chars
      return value;
    }
  }
  
  return '';
}

/**
 * Determine question type based on keywords and context
 */
function determineQuestionType(
  row: any,
  typeColumn?: string
): 'knowledge' | 'performance' | 'observation' | 'project' {
  // Check explicit type column
  if (typeColumn && row[typeColumn]) {
    const typeValue = String(row[typeColumn]).toLowerCase();
    if (typeValue.includes('knowledge')) return 'knowledge';
    if (typeValue.includes('performance')) return 'performance';
    if (typeValue.includes('observation')) return 'observation';
    if (typeValue.includes('project')) return 'project';
  }
  
  // Infer from column name or content
  const allText = Object.entries(row)
    .map(([key, val]) => `${key} ${val}`)
    .join(' ')
    .toLowerCase();
  
  // Knowledge indicators
  if (
    allText.includes('knowledge') ||
    allText.includes('describe') ||
    allText.includes('explain') ||
    allText.includes('list') ||
    allText.includes('what is') ||
    allText.includes('define')
  ) {
    return 'knowledge';
  }
  
  // Performance indicators
  if (
    allText.includes('performance') ||
    allText.includes('practical') ||
    allText.includes('demonstrate') ||
    allText.includes('perform') ||
    allText.includes('carry out') ||
    allText.includes('complete')
  ) {
    return 'performance';
  }
  
  // Observation indicators
  if (
    allText.includes('observation') ||
    allText.includes('observe') ||
    allText.includes('witness')
  ) {
    return 'observation';
  }
  
  // Project indicators
  if (
    allText.includes('project') ||
    allText.includes('case study') ||
    allText.includes('scenario')
  ) {
    return 'project';
  }
  
  // Default to knowledge if unclear
  return 'knowledge';
}

/**
 * Parse multiple assessment files
 */
export function parseMultipleAssessments(
  filePaths: string[],
  options: AssessmentParseOptions = {}
): Assessment[] {
  const allAssessments: Assessment[] = [];
  
  for (const filePath of filePaths) {
    try {
      const assessments = parseAssessmentExcel(filePath, options);
      allAssessments.push(...assessments);
    } catch (error: any) {
      console.error(`Error parsing ${filePath}:`, error.message);
    }
  }
  
  return allAssessments;
}

/**
 * Parse SMT-style maritime assessment format
 * This expects specific column structure used by SMT
 */
export function parseSMTMaritimeAssessment(filePath: string): Assessment[] {
  const workbook = XLSX.readFile(filePath);
  const assessments: Assessment[] = [];
  
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    
    const questions: AssessmentQuestion[] = [];
    
    // SMT format typically has:
    // Row 0: Category headers (Knowledge Assessment/s, Performance Assessment/s)
    // Row 1: Column headers (Learners workbook question, Workbook Classroom Activity, etc.)
    // Row 2+: Unit data with assessment questions
    
    // Read column headers from row 1
    const columnHeaders: string[] = [];
    for (let c = 0; c <= range.e.c; c++) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: 1, c })];
      if (cell && cell.v) {
        columnHeaders[c] = String(cell.v).trim();
      }
    }
    
    // Read data rows (starting from row 2)
    for (let r = 2; r <= range.e.r; r++) {
      for (let c = 0; c <= range.e.c; c++) {
        const header = columnHeaders[c];
        if (!header) continue;
        
        // Check if this is an assessment column
        const isAssessmentColumn =
          header.includes('workbook') ||
          header.includes('question') ||
          header.includes('activity') ||
          header.includes('assessment') ||
          header.includes('practical');
        
        if (!isAssessmentColumn) continue;
        
        const cell = worksheet[XLSX.utils.encode_cell({ r, c })];
        if (!cell || !cell.v) continue;
        
        const questionText = String(cell.v).trim();
        if (questionText.length < 5) continue; // Skip very short entries
        
        // Determine type based on column header
        let type: AssessmentQuestion['type'] = 'knowledge';
        if (header.toLowerCase().includes('practical')) {
          type = 'performance';
        } else if (header.toLowerCase().includes('activity')) {
          type = 'performance';
        } else if (header.toLowerCase().includes('question')) {
          type = 'knowledge';
        }
        
        questions.push({
          id: `${sheetName}_R${r}_C${c}`,
          text: questionText,
          type,
          category: sheetName,
        });
      }
    }
    
    if (questions.length > 0) {
      assessments.push({
        id: sheetName,
        name: sheetName,
        questions,
      });
    }
  }
  
  return assessments;
}
