const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const concurrency = Number(process.env.MONITOR_CONCURRENCY || 2);
const rounds = Number(process.env.MONITOR_ROUNDS || 3);
const maxLatencyMs = Number(process.env.MAX_LATENCY_MS || 3000);
const repositoryRoot = path.resolve(__dirname, '..', '..');
const assessmentPath = path.join(repositoryRoot, 'Knowledge Seamanship Marking Sheet.docx');
const assessmentBuffer = fs.readFileSync(assessmentPath);

function percentile(values, point) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * point) - 1)] || 0;
}

async function timed(name, action) {
  const startedAt = performance.now();
  const response = await action();
  const durationMs = Math.round(performance.now() - startedAt);
  const body = await response.text();
  assert.equal(response.status, 200, `${name} failed with ${response.status}: ${body.slice(0, 300)}`);
  return { name, durationMs };
}

function savedAssessmentForm() {
  const form = new FormData();
  form.append('assessmentFile', new Blob([assessmentBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), path.basename(assessmentPath));
  form.append('saveToDatabase', 'false');
  return form;
}

async function runRound(round) {
  const operations = [];
  for (let slot = 0; slot < concurrency; slot += 1) {
    operations.push(timed(`units-r${round}-c${slot}`, () => fetch(`${baseUrl}/api/units`)));
    operations.push(timed(`analysis-r${round}-c${slot}`, () => fetch(`${baseUrl}/api/analyze`, { method: 'POST', body: savedAssessmentForm() })));
  }
  return Promise.all(operations);
}

async function main() {
  assert.ok(fs.existsSync(assessmentPath), `Missing assessment fixture: ${assessmentPath}`);
  const results = [];
  for (let round = 1; round <= rounds; round += 1) results.push(...await runRound(round));
  const byEndpoint = Object.groupBy(results, (result) => result.name.startsWith('analysis') ? 'analysis' : 'units');
  const summary = Object.fromEntries(Object.entries(byEndpoint).map(([endpoint, measurements]) => {
    const durations = measurements.map((measurement) => measurement.durationMs);
    return [endpoint, {
      samples: durations.length,
      minMs: Math.min(...durations),
      medianMs: percentile(durations, 0.5),
      p95Ms: percentile(durations, 0.95),
      maxMs: Math.max(...durations),
      belowTarget: durations.every((duration) => duration < maxLatencyMs),
    }];
  }));
  const failures = results.filter((result) => result.durationMs >= maxLatencyMs);
  console.log(JSON.stringify({
    status: failures.length === 0 ? 'passed' : 'failed',
    baseUrl,
    concurrency,
    rounds,
    maxLatencyMs,
    summary,
    failures,
  }, null, 2));
  if (failures.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
