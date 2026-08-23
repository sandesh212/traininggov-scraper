# Remaining Advisory Remediation and Saved-Workflow Performance Review

**Project:** traininggov-scraper

**Scope:** The 30 remaining lint advisories and the saved-database assessment workflow benchmark.

## Executive Findings

The lint command reports **30 advisories and zero errors**. The advisories consist of 26 broad `any` usages, two image-optimization advisories, one unescaped-entity advisory, and one CommonJS import advisory.

The saved-database workflow is not bottlenecked by document parsing or local mapping. In the stage benchmark, validation consumed **27.318 seconds (96.4%)** of a **28.343-second** run for 67 questions. The cause is repeated provider attempts: each question sequentially invokes the configured AI client and only then falls back to local mapping when the response has no usable completion choice. Forcing the deterministic local mapper completed the same workflow in **310 ms**, including DOCX parsing.

> The immediate performance priority is to stop attempting the unavailable provider after its first failure in a request. The current per-question retry pattern causes 67 failed remote attempts before the stable local fallback executes.

## Benchmark Methodology

The reproducible command is `npm run benchmark:saved-workflow` from `web/`. It loads the same 50-unit saved database and processes `Knowledge Seamanship Marking Sheet.docx`, the document used by the live integration test. A direct multipart request to the production `/api/analyze` endpoint was also measured.

| Scenario | Total time | Questions | Key observation |
|---|---:|---:|---|
| Stage benchmark with current configured provider | 28,343 ms | 67 | Each mapping attempts the provider, then falls back locally. |
| Direct production multipart API request | 27,649 ms | 67 | Confirms framework/upload overhead is minor relative to mapping. |
| Live integration-suite saved-database case | 50,892 ms | 67 | A slower earlier run, consistent with provider latency variability and cold/runtime effects. |
| Stage benchmark with `OPENAI_API_KEY=mock-key` | 310 ms | 67 | Forces deterministic local mapping and removes remote attempts. |

### Stage Timing

| Stage | Current-provider run | Share | Forced-local run | Share |
|---|---:|---:|---:|---:|
| Read DOCX from disk | 1 ms | 0.0% | 1 ms | 0.3% |
| Load 50 saved units | 5 ms | 0.0% | 5 ms | 1.6% |
| Extract red-text segments | 9 ms | 0.0% | 9 ms | 2.9% |
| Extract DOCX question blocks | 214 ms | 0.8% | 217 ms | 70.0% |
| Refine question blocks | 793 ms | 2.8% | 0 ms | 0.0% |
| Validate all questions | 27,318 ms | 96.4% | 75 ms | 24.2% |
| **End-to-end total** | **28,343 ms** | **100.0%** | **310 ms** | **100.0%** |

The current-provider mapping distribution was 253 ms minimum, 480 ms median, 512 ms p95, and 1,417 ms maximum per question. Because the route validates in a sequential `for ... of` loop, these costs add rather than overlap.

## Performance Optimization Roadmap

### Priority 0 — Add a per-request provider circuit breaker

Modify `AIService` to store an internal provider state such as `unknown`, `available`, or `unavailable`. After the first failed completion, mark the provider unavailable and direct all remaining `validateQuestion` calls to `localValidateQuestion` without another client request. Keep a single warning containing the initial error and a count of locally handled questions in the final report log.

This is low-risk because it preserves the current fallback result shape and only removes repeated requests known to be failing. In the measured run, it should remove approximately 66 of 67 failed mapping attempts and bring a provider-unavailable request close to the forced-local baseline plus one failed request.

### Priority 1 — Make AI mode explicit and observable

Introduce `AI_MAPPING_MODE=auto|remote|local` and report the effective mode in structured logs or the analysis response metadata. In `local` mode, bypass refinement and remote validation immediately; in `auto` mode, use the circuit breaker; in `remote` mode, surface a clear configuration failure rather than silently retrying every question.

This makes local behavior deliberate in development and protects users from a long wait when the provider credentials, proxy, or response contract are invalid.

### Priority 2 — Bound remote-mode concurrency

When the provider is available, replace the sequential validation loop with bounded concurrency, initially four to six requests at a time. Preserve output order by mapping each question with its index and sorting/reassembling the results after `Promise.all`.

At the observed 480 ms median per call, a concurrency limit of five would reduce the validation wall-clock component from approximately 32 seconds for 67 serial calls to roughly 6–8 seconds, subject to provider throughput and rate limits. Add retry backoff only for transient, classified transport failures.

### Priority 3 — Reduce remote prompt volume

The current validator repeatedly supplies the full saved-unit scope to every question. Introduce a local lexical prefilter that selects the highest-scoring three to five units before an optional provider decision. For a 50-unit database, this reduces repeated prompt context and cost while retaining local fallback as a guardrail.

For larger batches, consider a single structured batch request only after measuring prompt size and response reliability. A batch request should preserve question IDs, enforce a JSON schema, and degrade to local per-question mapping if it fails.

### Priority 4 — Precompute reusable local search corpora

`localValidateQuestion` currently reconstructs every unit's searchable text for each question. Compute a normalized corpus once per analysis invocation and pass it to the scorer. This is not a current bottleneck—the forced-local 67-question mapping loop required only 75 ms—but it becomes useful as unit counts grow.

### Priority 5 — Trim secondary overhead after provider work

DOCX extraction was 217 ms in local mode and is acceptable relative to the former 28-second workflow. If later needed, suppress verbose extraction logging outside debug mode and retain a per-document extraction cache only where files have stable hashes. The synchronous analysis logger is also a minor candidate for asynchronous buffering, but it should not precede the circuit breaker and concurrency changes.

## Lint Advisory Inventory

| Category | Count | Files / locations | Cleanup objective |
|---|---:|---|---|
| Broad `any` types | 26 | Scraper service (13), logger (5), unit loader (3), and single occurrences in RedTextColumn, AI service, Excel parser, local agent, and Excel export | Replace unchecked data with narrow interfaces, `unknown`, and runtime guards. |
| Image optimization | 2 | `DetailedReportView.tsx`, `UnifiedReportView.tsx` | Classify image sources, then use `next/image` where compatible or document a safe exception for generated data URIs. |
| Unescaped entity | 1 | `RedTextColumn.tsx` | Escape the apostrophe in static JSX copy. |
| CommonJS import | 1 | `pdfQuestionExtractor.ts` | Convert `require('pdf-parse')` to a compatible ESM import. |

## Lint Remediation Plan

### Phase A — External-data boundaries and scraper types

Resolve the 13 `scraperService.ts` advisories first. Replace broad Cheerio values with `CheerioAPI`, `Cheerio<Element>`, and the library's element types for headings, lists, and tables. This is the highest-value type work because HTML from training.gov.au is untrusted, nested, and structurally variable.

In `uocLoader.ts`, parse JSONL as `unknown` and validate an explicit persisted-unit record before accepting it. Use small type guards for arrays, performance criteria, and optional evidence fields. This prevents malformed stored data from propagating into mapping logic.

### Phase B — Service and utility contracts

In `aiService.ts`, define a JSON-schema-backed refinement response and replace the untyped model callback value. In `excelParser.ts`, accept `unknown[][]` and narrow cells to strings before applying the unit-code pattern. In `localAgent.ts` and `excelExport.ts`, type the similarity/matrix and worksheet data records explicitly.

Update `logger.ts` to accept `unknown`, serialize `Error` values predictably, and store only JSON-safe structured metadata. This removes five warnings while improving diagnostic safety.

### Phase C — Report UI and assets

Replace `RedTextColumn`'s `any[]` with the narrow fields it consumes (`questionId`, `questionText`, `questionSection`) or `QuestionResult[]`, then correct the static apostrophe.

Audit the two report-image usages. If they render generated `data:` URLs from uploaded DOCX content, retain `<img>` with a targeted, documented lint suppression and proper `alt`, `loading`, and size attributes because Next image optimization does not meaningfully optimize dynamic inline data. If they render a local or allow-listed remote image, migrate to `next/image` with declared dimensions and appropriate source configuration.

### Phase D — ESM compatibility and enforcement

Modernize `pdfQuestionExtractor.ts` from CommonJS to an ESM-compatible `pdf-parse` import, confirming the package's available typings and default export shape with a focused extraction test.

When each category reaches zero, promote its rule from warning to error. Finish by adding `npm run lint`, `npm run test:fallback`, and `npm run test:integration` as separate CI steps.

## Acceptance Criteria

| Workstream | Acceptance criterion |
|---|---|
| Provider circuit breaker | One provider failure per request at most; all remaining questions use local mapping without remote calls. |
| Local mode | Same fixture completes below 1 second in a warm environment, excluding server startup. |
| Remote concurrency | Preserves result ordering, honors a configured ceiling, and exposes per-mode timing. |
| Type cleanup | `no-explicit-any` count is zero and malformed persisted/scraped inputs are rejected or normalized. |
| Image cleanup | Each image source has either a valid `next/image` implementation or a justified targeted exception. |
| Modernization | `no-require-imports` and JSX entity advisories are zero. |
| Quality gate | Lint completes with zero advisories and zero errors; fallback and integration suites pass. |

## Reproduction Commands

```bash
cd web
npm run benchmark:saved-workflow
OPENAI_API_KEY=mock-key npm run benchmark:saved-workflow
npm run lint
```
