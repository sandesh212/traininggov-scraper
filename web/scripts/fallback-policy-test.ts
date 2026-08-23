import assert from 'node:assert/strict';
import { AIService, MINIMUM_FALLBACK_SCORE } from '../src/services/aiService';
import type { AssessmentQuestion } from '../src/models/types';
import type { Unit } from '../src/types';

const unit: Unit = {
  code: 'MARN008',
  title: 'Operate a vessel safely',
  description: 'Plan navigation and operate a vessel using safe seamanship procedures.',
  application: 'Applies to navigation and vessel operations.',
  elements: [
    {
      title: 'Plan vessel navigation',
      performanceCriteria: [
        { id: '1.1', text: 'Navigation hazards are identified before departure.' },
        { id: '1.2', text: 'A safe passage plan is prepared.' },
      ],
    },
  ],
  knowledgeEvidence: 'Navigation rules and safe vessel operation.',
  performanceEvidence: 'Operate a vessel according to a navigation plan.',
  assessmentConditions: 'Access to a vessel and navigation equipment is required.',
};

const matchedQuestion: AssessmentQuestion = {
  id: 'matched-question',
  text: 'Describe how navigation hazards are identified before vessel departure.',
  section: 'Navigation',
};

const unrelatedQuestion: AssessmentQuestion = {
  id: 'unrelated-question',
  text: 'Explain quantum lattice teleportation for extraterrestrial architecture.',
  section: 'Astrophysics',
};

async function main() {
  const service = new AIService('mock-key');
  const mapped = await service.validateQuestion(matchedQuestion, [unit]);
  const unmapped = await service.validateQuestion(unrelatedQuestion, [unit]);

  assert.equal(MINIMUM_FALLBACK_SCORE, 1);
  assert.equal(mapped.isValid, true);
  assert.equal(mapped.mappedUnit, unit.code);
  assert.ok(mapped.confidence >= 55);

  assert.equal(unmapped.isValid, false);
  assert.equal(unmapped.mappedUnit, null);
  assert.equal(unmapped.confidence, 0);
  assert.deepEqual(unmapped.gaps, ['No meaningful keyword overlap was found; manual mapping is required.']);
  assert.match(unmapped.reasoning, /Manual mapping is required/);

  console.log(JSON.stringify({
    status: 'passed',
    minimumFallbackScore: MINIMUM_FALLBACK_SCORE,
    mapped: {
      questionId: mapped.questionId,
      mappedUnit: mapped.mappedUnit,
      confidence: mapped.confidence,
    },
    unmapped: {
      questionId: unmapped.questionId,
      mappedUnit: unmapped.mappedUnit,
      confidence: unmapped.confidence,
      gaps: unmapped.gaps,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
