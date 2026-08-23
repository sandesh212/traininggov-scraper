/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const repositoryRoot = path.resolve(__dirname, '..', '..');
const webRoot = path.resolve(__dirname, '..');
const assessmentPath = path.join(repositoryRoot, 'Knowledge Seamanship Marking Sheet.docx');
const unitsPath = path.join(webRoot, 'sample-units.xlsx');
const databasePath = path.join(webRoot, 'data', 'uoc.jsonl');
const timeout = AbortSignal.timeout(180_000);

const results = [];

function filePart(filePath, contentType) {
  return new Blob([fs.readFileSync(filePath)], { type: contentType });
}

function databaseHash() {
  return crypto.createHash('sha256').update(fs.readFileSync(databasePath)).digest('hex');
}

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, { ...options, signal: timeout });
  const body = await response.text();
  let json;
  try {
    json = JSON.parse(body);
  } catch {
    json = undefined;
  }
  return { response, body, json };
}

async function expect(name, action) {
  const startedAt = Date.now();
  await action();
  results.push({ name, status: 'passed', durationMs: Date.now() - startedAt });
}

async function postAnalyze(form) {
  return request('/api/analyze', { method: 'POST', body: form });
}

function assertReport(report, expectedUnitCount) {
  const reportFields = [
    'questionsCount',
    'totalUnitsInDatabase',
    'mappedUnits',
    'results',
    'instructions',
    'redTextSegments',
    'databaseStats',
  ];

  for (const field of reportFields) {
    assert.ok(field in report, `report is missing ${field}`);
  }

  assert.ok(report.questionsCount > 0, 'at least one question must be extracted');
  assert.equal(report.results.length, report.questionsCount, 'each question must produce a result');
  assert.equal(report.totalUnitsInDatabase, expectedUnitCount, 'the analysis scope must match the expected unit count');
  assert.equal(report.mappedUnits.length, expectedUnitCount, 'the returned units must match the analysis scope');
  const incompleteQuestionRecords = report.results.filter((item) => !item.questionId || !item.questionText);
  assert.equal(
    incompleteQuestionRecords.length,
    0,
    `each result needs identifying question data; invalid records: ${JSON.stringify(incompleteQuestionRecords.slice(0, 3))}`
  );
  const mappedResults = report.results.filter((item) => item.mappedUnit);
  const unmappedResults = report.results.filter((item) => !item.mappedUnit);
  assert.ok(mappedResults.length > 0, 'the workflow should produce at least one relevant local mapping');
  assert.ok(
    mappedResults.every((item) => item.isValid && item.confidence >= 55 && item.reasoning.startsWith('Local fallback mapped the question')),
    'mapped results must be valid, scored matches'
  );
  assert.ok(
    unmappedResults.every((item) => !item.isValid && item.confidence === 0 && item.gaps.includes('No meaningful keyword overlap was found; manual mapping is required.')),
    'unmapped results must be explicit manual-review cases'
  );
}

async function main() {
  assert.ok(fs.existsSync(assessmentPath), `Missing assessment fixture: ${assessmentPath}`);
  assert.ok(fs.existsSync(unitsPath), `Missing units fixture: ${unitsPath}`);
  assert.ok(fs.existsSync(databasePath), `Missing unit database fixture: ${databasePath}`);

  await expect('Application shell renders', async () => {
    const { response, body } = await request('/');
    assert.equal(response.status, 200);
    assert.match(body, /Validate Your/);
  });

  await expect('Saved units list is available', async () => {
    const { response, json } = await request('/api/units');
    assert.equal(response.status, 200);
    assert.ok(json.count > 0);
    assert.equal(json.units.length, json.count);
  });

  await expect('Saved unit search filters correctly', async () => {
    const { response, json } = await request('/api/units?search=MARN008');
    assert.equal(response.status, 200);
    assert.ok(json.count >= 1);
    assert.ok(json.units.some((unit) => unit.code === 'MARN008'));
  });

  await expect('Missing assessment is rejected cleanly', async () => {
    const form = new FormData();
    form.append('saveToDatabase', 'false');
    const { response, json } = await postAnalyze(form);
    assert.equal(response.status, 400);
    assert.match(json.error, /assessment DOCX file is required/i);
  });

  await expect('Non-DOCX assessment is rejected cleanly', async () => {
    const form = new FormData();
    form.append('assessmentFile', new Blob(['not a DOCX'], { type: 'text/plain' }), 'assessment.txt');
    form.append('saveToDatabase', 'false');
    const { response, json } = await postAnalyze(form);
    assert.equal(response.status, 400);
    assert.match(json.error, /must be a \.docx/i);
  });

  await expect('Malformed units workbook is rejected cleanly', async () => {
    const form = new FormData();
    form.append(
      'assessmentFile',
      filePart(assessmentPath, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
      path.basename(assessmentPath)
    );
    form.append(
      'unitsFile',
      new Blob(['This is not an Excel workbook.'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      'invalid-units.xlsx'
    );
    form.append('saveToDatabase', 'false');
    const { response, json } = await postAnalyze(form);
    assert.equal(response.status, 400);
    assert.match(json.error, /No valid unit codes|Unable to complete/i);
  });

  await expect('Complete assessment uses the saved unit database', async () => {
    const form = new FormData();
    form.append(
      'assessmentFile',
      filePart(assessmentPath, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
      path.basename(assessmentPath)
    );
    form.append('saveToDatabase', 'false');
    const { response, json } = await postAnalyze(form);
    assert.equal(response.status, 200, json?.error || 'analysis request failed');
    assertReport(json, 50);
    assert.equal(json.databaseStats.total, 50);
    assert.equal(json.databaseStats.added, 0);
    assert.equal(json.databaseStats.modified, 0);
  });

  await expect('Scoped Excel upload stays non-persistent when requested', async () => {
    const before = databaseHash();
    const form = new FormData();
    form.append(
      'assessmentFile',
      filePart(assessmentPath, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
      path.basename(assessmentPath)
    );
    form.append(
      'unitsFile',
      filePart(unitsPath, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
      path.basename(unitsPath)
    );
    form.append('saveToDatabase', 'false');
    const { response, json } = await postAnalyze(form);
    assert.equal(response.status, 200, json?.error || 'scoped analysis request failed');
    assert.ok(json.totalUnitsInDatabase >= 1 && json.totalUnitsInDatabase <= 2, 'the scoped request must use the verified uploaded units');
    assertReport(json, json.totalUnitsInDatabase);
    assert.equal(json.databaseStats.total, 50);
    assert.equal(json.databaseStats.added, 0);
    assert.equal(json.databaseStats.modified, 0);
    assert.equal(databaseHash(), before, 'a one-time scoped analysis must not change the stored unit database');
  });

  console.log(JSON.stringify({
    baseUrl,
    status: 'passed',
    testCount: results.length,
    results,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    baseUrl,
    status: 'failed',
    completedTests: results,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  }, null, 2));
  process.exitCode = 1;
});
