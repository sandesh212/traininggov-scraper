import { performance } from 'node:perf_hooks';
import { AIService } from '../src/services/aiService';
import type { AssessmentQuestion } from '../src/models/types';
import type { Unit } from '../src/types';

type MutableOpenAIClient = {
  openai: { chat: { completions: { create: () => Promise<{ choices: Array<{ message: { content: string } }> }> } } };
};

const questionCount = 24;
const simulatedLatencyMs = 120;
const concurrency = 4;
const unit: Unit = {
  code: 'MARN008', title: 'Operate a vessel safely', description: 'Navigation and vessel operations.', application: '',
  elements: [], knowledgeEvidence: 'Navigation rules.', performanceEvidence: 'Operate a vessel.', assessmentConditions: 'Vessel access.',
};
const questions: AssessmentQuestion[] = Array.from({ length: questionCount }, (_, index) => ({
  id: `Q${index + 1}`, text: `Explain safe vessel navigation procedure ${index + 1}.`, section: 'Navigation',
}));

function createService() {
  const service = new AIService('simulated-live-key', 'gpt-4o', 'remote');
  const mutableService = service as unknown as MutableOpenAIClient;
  mutableService.openai.chat.completions.create = async () => {
    await new Promise((resolve) => setTimeout(resolve, simulatedLatencyMs));
    return { choices: [{ message: { content: JSON.stringify({ isValid: true, mappedUnit: unit.code, mappedCriteria: [], mappedKnowledge: [], reasoning: 'Simulated remote validation.', gaps: [], confidence: 90 }) } }] };
  };
  return service;
}

async function runSequential() {
  const service = createService();
  const startedAt = performance.now();
  for (const question of questions) await service.validateQuestion(question, [unit]);
  return Math.round(performance.now() - startedAt);
}

async function runBoundedParallel() {
  const service = createService();
  const startedAt = performance.now();
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < questions.length) {
      const index = nextIndex++;
      await service.validateQuestion(questions[index], [unit]);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return Math.round(performance.now() - startedAt);
}

async function main() {
  const sequentialMs = await runSequential();
  const parallelMs = await runBoundedParallel();
  console.log(JSON.stringify({ status: 'completed', questionCount, simulatedLatencyMs, concurrency, sequentialMs, parallelMs, speedup: Number((sequentialMs / parallelMs).toFixed(2)) }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
