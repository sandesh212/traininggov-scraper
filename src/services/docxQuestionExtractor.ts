import mammoth from "mammoth";
import * as cheerio from "cheerio";
import { AssessmentQuestion } from '../models/types.js';

// Production mode - reduces console output
const PRODUCTION_MODE = process.env.PRODUCTION_MODE === 'true';
const log = (...args: any[]) => !PRODUCTION_MODE && console.log(...args);

/**
 * Extracts questions from a .docx file using robust HTML parsing with Cheerio.
 * Handles complex layouts, tables, images, and varying formats.
 * Improved to separate questions from answers and avoid duplicates.
 */
export async function extractQuestionsFromDocx(filePath: string): Promise<AssessmentQuestion[]> {
  try {
    // 1. Convert DOCX to HTML with embedded images
    const { value: html } = await mammoth.convertToHtml({ path: filePath }, {
      convertImage: mammoth.images.imgElement((element) => {
        return element.read("base64").then((base64) => {
          return { src: `data:${element.contentType};base64,${base64}` };
        });
      })
    });

    // 2. Load into Cheerio
    const $ = cheerio.load(html);
    const questions: AssessmentQuestion[] = [];

    let currentSection = "General";

    // Track seen question text to avoid duplicates (normalized)
    const seenQuestions = new Set<string>();

    // 3. Traverse paragraphs and list items (more targeted than all elements)
    $('p, li, tr').each((i, elem) => {
      const $el = $(elem);
      const text = $el.text().trim();

      // Skip empty or very short text
      if (!text || text.length < 5) return;

      // A. Detect Section Headers
      let tagName = '';
      if (elem.type === 'tag' && typeof elem.name === 'string') {
        tagName = elem.name.toLowerCase();
      }
      const isBold = $el.find('strong, b').length > 0 || $el.is('strong, b');
      const isHeader = tagName && ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName);

      if ((isHeader || (isBold && text.length < 100)) && text.match(/^(PART|SECTION|MODULE|UNIT|KNOWLEDGE|PRACTICAL|ASSESSMENT)\s/i)) {
        currentSection = text;
        log(`   📂 Section detected: ${currentSection}`);
        return;
      }

      // B. Detect Questions
      // Pattern 1: Numbered questions "1.", "Q1", "1.1", etc.
      // Improved regex to capture the ID and the rest of the text separately
      const numberedMatch = text.match(/^(?:Q(?:uestion)?\s*)?(\d+(?:\.\d+)*|[a-z])(?:\)|\.|:)?\s+(.*)/i);

      // Pattern 2: Question words at start
      const questionWordMatch = text.match(/^(What|Who|Where|When|Why|How|List|Describe|Explain|Identify|Define|Calculate|Match|Select|Name|State|Give|Provide)\s+(.+?)(?:\?|\.)?$/i);

      // Pattern 3: Ends with question mark
      const endsWithQuestion = text.endsWith('?');

      // Pattern 4: Table row with ID in first cell
      let tableQuestion: { id: string; text: string } | null = null;
      if ($el.is('tr')) {
        const cells = $el.find('td, th');
        if (cells.length >= 2) {
          const c1 = $(cells[0]).text().trim();
          const c2 = $(cells[1]).text().trim();
          // First cell looks like an ID, second has content
          if (c1.match(/^(\d+|[a-z])[\.)\:]?$/i) && c2.length > 10) {
            tableQuestion = {
              id: c1.replace(/[^\w]/g, ''),
              text: c2
            };
          }
        }
      }

      let questionId: string | null = null;
      let questionText: string | null = null;

      if (tableQuestion) {
        questionId = tableQuestion.id;
        questionText = tableQuestion.text;
      } else if (numberedMatch && numberedMatch[2].length > 5) {
        questionId = numberedMatch[1].replace(/[^\w]/g, '');
        questionText = numberedMatch[2];
      } else if ((questionWordMatch || endsWithQuestion) && text.length > 10 && text.length < 300) {
        // Only extract if it looks like a standalone question (not too long)
        // Use a temporary ID, will be prefixed later
        questionId = `Q${questions.length + 1}`;
        questionText = text;
      }

      if (questionId && questionText) {
        // Clean up question text - remove answer text that might be appended
        // Strategy 1: Split by '?' if present
        if (questionText.includes('?')) {
          const parts = questionText.split('?');
          // If we have parts after the ?, check if they look like answers
          // We assume the question ends at the first '?'
          // But we keep the '?'
          questionText = parts[0].trim() + '?';
        } else {
          // Strategy 2: Look for ". " followed by Capital letter (if no ?)
          // e.g. "List three items. Item 1, Item 2..."
          const answerMatch = questionText.match(/(\.\!)\s+([A-Z])/);
          if (answerMatch && answerMatch.index !== undefined) {
            questionText = questionText.substring(0, answerMatch.index + 1);
          }

          // Strategy 3: Look for lowercase followed immediately by Uppercase (missing space/newline)
          // e.g. "...at seaEngine hatch..."
          const runOnMatch = questionText.match(/([a-z])([A-Z])/);
          if (runOnMatch && !questionText.includes('?') && runOnMatch.index !== undefined) {
            // Only apply if we haven't found a ? delimiter
            // And make sure it's not just a typo in a word (heuristic)
            // We assume the question ends at the split
            questionText = questionText.substring(0, runOnMatch.index + 1);
          }
        }

        // Normalize question text for duplicate detection
        const normalizedText = questionText.toLowerCase().replace(/[^\w\s]/g, '').trim();

        // Additional Filter: If it was a numbered match, ensure it actually looks like a question
        // unless it's very long (likely a scenario).
        // This filters out list items like "1. Hearing loss" or "a) Option A"
        if (numberedMatch && !tableQuestion) {
          const startsWithQuestionWord = /^(What|Who|Where|When|Why|How|List|Describe|Explain|Identify|Define|Calculate|Match|Select|Name|State|Give|Provide)\b/i.test(questionText);
          const hasQuestionMark = questionText.includes('?');

          if (!startsWithQuestionWord && !hasQuestionMark && questionText.length < 60) {
            log(`   ⚠️  Skipping likely list item/option: ${questionText.substring(0, 50)}...`);
            return;
          }
        }

        // Skip if we've seen this question before (by text similarity)
        if (seenQuestions.has(normalizedText)) {
          log(`   ⚠️  Skipping duplicate question: ${questionText.substring(0, 50)}...`);
          return;
        }

        // Skip if this looks like answer text (starts with capital letter but no question word)
        // And doesn't look like a question (no ?)
        const looksLikeAnswer = /^[A-Z][a-z]+\s+(the|a|an|in|on|at|to|from|by|with)\s/i.test(questionText);
        if (looksLikeAnswer && !questionWordMatch && !questionText.includes('?')) {
          log(`   ⚠️  Skipping answer text: ${questionText.substring(0, 50)}...`);
          return;
        }

        seenQuestions.add(normalizedText);

        // Create unique ID with section prefix
        const sectionPrefix = currentSection.substring(0, 15).replace(/[^\w]/g, '');
        const uniqueId = `${sectionPrefix}_${questionId}`;

        // Extract images within this element
        const images: string[] = [];
        $el.find('img').each((_, img) => {
          const src = $(img).attr('src');
          if (src) images.push(src);
        });

        // Final clean and trim
        questionText = questionText
          .replace(/\s+/g, ' ')  // Normalize whitespace
          .trim();

        questions.push({
          id: uniqueId,
          text: questionText,
          section: currentSection,
          images: images.length > 0 ? images : undefined
        });

        log(`   ✓ Extracted Q${questions.length}: ${uniqueId} - ${questionText.substring(0, 60)}...`);
      }
    });

    log(`\n   📊 Total questions extracted: ${questions.length}`);
    return questions;
  } catch (error) {
    console.error('Error extracting questions from DOCX:', error);
    throw new Error(`Failed to extract questions from ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
