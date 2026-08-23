import assert from 'node:assert/strict';
import { AIService } from '../src/services/aiService';
import type { AssessmentQuestion } from '../src/models/types';
import type { Unit } from '../src/types';

type MutableOpenAIClient = {
  openai: {
    chat: {
      completions: {
        create: () => Promise<never>;
      };
    };
  };
};

const unit: Unit = {
  code: 'MARN008',
  title: 'Operate a vessel safely',
  description: 'Plan navigation and operate a vessel using safe seamanship procedures.',
  application: 'Applies to navigation and vessel operations.',
  elements: [],
  knowledgeEvidence: 'Navigation rules and safe vessel operation.',
  performanceEvidence: 'Operate a vessel according to a navigation plan.',
  assessmentConditions: 'Access to a vessel is required.',
};

const questions: AssessmentQuestion[] = [
  { id: 'first', text: 'How are navigation hazards identified before vessel departure?' },
  { id: 'second', text: 'How should a vessel navigation plan be prepared?' },
];

async function main() {
  const service = new AIService('test-live-key', 'gpt-4o', 'auto');
  const mutableService = service as unknown as MutableOpenAIClient;
  let remoteAttempts = 0;
  mutableService.openai.chat.completions.create = async () => {
    remoteAttempts += 1;
    throw new Error('simulated provider outage');
  };

  const first = await service.validateQuestion(questions[0], [unit]);
  const second = await service.validateQuestion(questions[1], [unit]);
  const status = service.getMappingStatus();

  assert.equal(remoteAttempts, 1, 'only the first question may attempt an unavailable provider');
  assert.equal(status.providerStatus, 'unavailable');
  assert.match(status.providerFailureReason ?? '', /simulated provider outage/);
  assert.equal(first.mappedUnit, unit.code);
  assert.equal(second.mappedUnit, unit.code);

  const localModeService = new AIService('test-live-key', 'gpt-4o', 'local');
  const localMutableService = localModeService as unknown as MutableOpenAIClient;
  localMutableService.openai.chat.completions.create = async () => {
    throw new Error('local mode must not call the provider');
  };
  const localResult = await localModeService.validateQuestion(questions[0], [unit]);
  assert.equal(localResult.mappedUnit, unit.code);
  assert.equal(localModeService.getMappingStatus().providerStatus, 'unknown');

  console.log(JSON.stringify({
    status: 'passed',
    remoteAttempts,
    autoModeStatus: status,
    localModeMappedUnit: localResult.mappedUnit,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
