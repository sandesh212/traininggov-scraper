import fs from 'fs/promises';
import path from 'path';
import mammoth from 'mammoth';
import * as cheerio from 'cheerio';
import { extractQuestionsFromDocx } from '../web/src/services/docxQuestionExtractor.ts';

// Heuristic to detect instruction-like sentences
const INSTRUCTION_RE = /^(List|Describe|Explain|Identify|Define|Calculate|Match|Select|Name|State|Give|Provide|Outline|Compare|Discuss|Demonstrate|Show|Determine|Assess|Fill|Complete|Tick|Circle|Mark|Draw|Write|Read|Review)\s+/i;

async function getDocxFiles(root: string): Promise<string[]> {
    const entries = await fs.readdir(root, { withFileTypes: true });
    return entries
        .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.docx'))
        .filter((e) => !e.name.startsWith('~$')) // skip temporary/lock files
        .map((e) => path.join(root, e.name));
}

function extractHeadings(html: string): { level: number; text: string }[] {
    const $ = cheerio.load(html);
    const headings: { level: number; text: string }[] = [];
    $('h1,h2,h3,h4,h5,h6').each((_, el) => {
        const tag = el.tagName.toLowerCase();
        const level = Number(tag.replace('h', '')) || 0;
        const text = $(el).text().trim();
        if (text) headings.push({ level, text });
    });
    return headings;
}

function extractInstructions(html: string): string[] {
    const $ = cheerio.load(html);
    const instructions: string[] = [];
    $('p,li').each((_, el) => {
        const text = $(el).text().trim();
        if (!text || text.length < 5) return;
        if (INSTRUCTION_RE.test(text)) {
            instructions.push(text);
        }
    });
    return Array.from(new Set(instructions));
}

async function processFile(filePath: string) {
    const buffer = await fs.readFile(filePath);

    try {
        // Structured extraction (questions + red text answers)
        const { questions, redTextAnswers } = await extractQuestionsFromDocx(buffer);

        // HTML parse for headings and instructions
        const { value: html } = await mammoth.convertToHtml({ buffer });
        const headings = extractHeadings(html);
        const instructions = extractInstructions(html);

        const summary = {
            file: path.basename(filePath),
            counts: {
                questions: questions.length,
                answers: redTextAnswers?.length || 0,
                headings: headings.length,
                instructions: instructions.length,
            },
            headings,
            instructions,
            questions,
            answers: redTextAnswers,
        };

        console.log(`\n=== ${path.basename(filePath)} ===`);
        console.log(JSON.stringify(summary, null, 2));
    } catch (err) {
        console.error(`\n=== ${path.basename(filePath)} ===`);
        console.error(`Failed to process: ${(err as Error).message}`);
    }
}

async function main() {
    const root = process.cwd();
    const files = await getDocxFiles(root);
    if (files.length === 0) {
        console.error('No .docx files found in workspace root.');
        process.exit(1);
    }

    for (const file of files) {
        await processFile(file);
    }
}

main().catch((err) => {
    console.error('Failed to process DOCX files:', err);
    process.exit(1);
});
