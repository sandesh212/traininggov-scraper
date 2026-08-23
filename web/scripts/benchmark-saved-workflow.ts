import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { AIService } from '../src/services/aiService';
import { extractQuestionsFromDocx } from '../src/services/docxQuestionExtractor';
import { RedTextExtractor } from '../src/services/redTextExtractor';
import { UocLoader } from '../src/services/uocLoader';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..', '..');
const assessmentPath = join(repositoryRoot, 'Knowledge Seamanship Marking Sheet.docx');

interface Timing {
  stage: string;
  durationMs: number;
}

async function measure<T>(stage: string, timings: Timing[], action: () => Promise<T> | T): Promise<T> {
  const startedAt = performance.now();
  const value = await action();
  timings.push({ stage, durationMs: Math.round(performance.now() - startedAt) });
  return value;
}

function summarize(samples: number[]) {
  const sorted = [...samples].sort((left, right) => left - right);
  const percentile = (value: number) => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * value))] ?? 0;
  return {
    count: samples.length,
    totalMs: Math.round(samples.reduce((total, sample) => total + sample, 0)),
    minMs: Math.round(sorted[0] ?? 0),
    medianMs: Math.round(percentile(0.5)),
    p95Ms: Math.round(percentile(0.95)),
    maxMs: Math.round(sorted.at(-1) ?? 0),
  };
}

async function main() {
  const timings: Timing[] = [];
  const workflowStartedAt = performance.now();

  const assessmentBuffer = await measure('Read assessment DOCX from disk', timings, () => readFile(assessmentPath));
  const loader = new UocLoader();
  await measure('Load saved unit database', timings, () => loader.load());
  const units = loader.getAllUnits();
  const redTextSegments = await measure('Extract red-text segments', timings, () => new RedTextExtractor().extractRedText(assessmentBuffer));
  const extraction = await measure('Extract DOCX question blocks', timings, () => extractQuestionsFromDocx(assessmentBuffer, redTextSegments));

  const aiService = new AIService(process.env.OPENAI_API_KEY || '');
  const refinedQuestions = await measure('Refine extracted question blocks', timings, () => aiService.refineQuestions(extraction.questions));

  const mappingSamples: number[] = [];
  let mappedCount = 0;
  let unmappedCount = 0;
  for (const question of refinedQuestions) {
    const mappingStartedAt = performance.now();
    const result = await aiService.validateQuestion(question, units);
    mappingSamples.push(performance.now() - mappingStartedAt);
    if (result.mappedUnit) mappedCount += 1;
    else unmappedCount += 1;
  }
  timings.push({ stage: 'Validate all questions against saved units', durationMs: Math.round(mappingSamples.reduce((total, sample) => total + sample, 0)) });

  const totalMs = Math.round(performance.now() - workflowStartedAt);
  const output = {
    status: 'completed',
    fixture: assessmentPath,
    unitCount: units.length,
    rawQuestionCount: extraction.questions.length,
    refinedQuestionCount: refinedQuestions.length,
    mappedCount,
    unmappedCount,
    totalMs,
    stages: timings.map((timing) => ({
      ...timing,
      sharePercent: Number(((timing.durationMs / totalMs) * 100).toFixed(1)),
    })),
    perQuestionMapping: summarize(mappingSamples),
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
