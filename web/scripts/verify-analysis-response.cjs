const fs = require('node:fs');

const responsePath = process.argv[2];
if (!responsePath) {
  throw new Error('Usage: node scripts/verify-analysis-response.cjs <response.json>');
}

const response = JSON.parse(fs.readFileSync(responsePath, 'utf8'));
const requiredFields = [
  'questionsCount',
  'totalUnitsInDatabase',
  'mappedUnits',
  'results',
  'instructions',
  'redTextSegments',
  'databaseStats',
];

const missingFields = requiredFields.filter((field) => !(field in response));
if (missingFields.length > 0) {
  throw new Error(`Missing response fields: ${missingFields.join(', ')}`);
}

const arrayFields = ['mappedUnits', 'results', 'instructions', 'redTextSegments'];
for (const field of arrayFields) {
  if (!Array.isArray(response[field])) {
    throw new Error(`${field} must be an array.`);
  }
}

if (response.results.length > 0) {
  const firstResult = response.results[0];
  for (const field of ['questionId', 'questionText', 'isValid', 'mappedUnit', 'mappedCriteria', 'mappedKnowledge', 'confidence', 'reasoning']) {
    if (!(field in firstResult)) {
      throw new Error(`First result is missing ${field}.`);
    }
  }
}

console.log(JSON.stringify({
  questionsCount: response.questionsCount,
  totalUnitsInDatabase: response.totalUnitsInDatabase,
  resultCount: response.results.length,
  instructionCount: response.instructions.length,
  redTextSegmentCount: response.redTextSegments.length,
  databaseStats: response.databaseStats,
  firstResult: response.results[0]
    ? {
      questionId: response.results[0].questionId,
      mappedUnit: response.results[0].mappedUnit,
      isValid: response.results[0].isValid,
    }
    : null,
}, null, 2));
