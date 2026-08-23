# Integration, Offline Mapping, and Lint Review

**Project:** traininggov-scraper

**Review date:** 23 August 2026
**Scope:** End-to-end assessment-upload workflow, offline mapping behavior, and production lint advisories.

## Executive Summary

A new live integration suite now verifies the application from its rendered upload interface through its saved-unit APIs and document-analysis endpoint. The suite exposed and corrected one genuine defect: after red-text answers were removed from a DOCX block, the parser could retain an empty question record. The parser now drops such records before mapping and report generation.

The current production build passes, the integration suite passes **8 of 8** checks, and lint completes with **0 errors**. The remaining **72 lint advisories** are intentional non-blocking warnings that should be removed incrementally through the plan below.

## Integration Coverage and Results

The live suite is implemented at `web/scripts/integration-test.cjs` and can be executed with `npm run test:integration` while the production server is running.

| Workflow or edge case | Verification | Result |
|---|---|---|
| Application startup and rendered shell | `GET /` returns HTTP 200 and displays the primary upload interface copy | Passed |
| Saved-unit availability | `GET /api/units` returns a non-empty, internally consistent list | Passed |
| Unit search | `GET /api/units?search=MARN008` returns the expected saved unit | Passed |
| No assessment upload | `POST /api/analyze` returns HTTP 400 with a clear required-file message | Passed |
| Incorrect assessment type | A `.txt` upload is rejected with HTTP 400 before document processing | Passed |
| Corrupt units workbook | An invalid `.xlsx` body is rejected cleanly rather than causing a server error | Passed |
| Complete workflow using saved units | A real DOCX is parsed, analyzed, and returned as a full report without a units workbook | Passed |
| Scoped Excel workflow without persistence | A real DOCX plus Excel units list uses only externally verified scoped units and leaves the JSONL database checksum unchanged | Passed |

The final observed live run completed all eight checks. The two complete document-analysis requests took materially longer than validation-only requests because they parse the DOCX, perform unit lookups, and produce a mapping for every extracted question.

> The scoped workflow deliberately permits a result set of one or two units when the uploaded spreadsheet contains two codes. This is appropriate because training.gov.au is an external source: a code may be unavailable, superseded, or fail live verification. The suite requires at least one verified unit, consistent returned scope counts, and no database mutation when persistence is disabled.

## Regression Fixed During Integration Testing

The real assessment fixture initially produced one result with a valid question ID but an empty `questionText`. The cause was the red-text-removal step in `docxQuestionExtractor.ts`: it could remove the entire candidate text while the parser still constructed a `newQuestion` object.

The parser now performs the following guard after answer/red-text removal:

```ts
pQuestionText = removeRedText(pQuestionText);
if (!pQuestionText) return;
```

This prevents answer-only fragments from entering AI mapping, report export, or the report UI. After the change, the complete integration suite passed.

## Offline Fallback Mapping Logic

`AIService.validateQuestion()` uses a deterministic local mapper in two situations:

1. No usable API key is configured, which results in the internal `mock-key` value or an explicitly supplied key beginning with `sk-mock`.
2. A configured AI request throws, returns no content, or returns a response that cannot be parsed. The error is logged and the same local mapper is called instead.

### Mapping Pipeline

| Step | Current behavior |
|---|---|
| Candidate selection | Removes only units without a `code`; all remaining supplied units are candidates. |
| No valid candidates | Returns `isValid: false`, `mappedUnit: null`, empty mappings, confidence `0`, and a `No valid units are available for mapping.` gap. |
| Question terms | Lowercases the concatenation of question text and its section, splits on non-alphanumeric separators, and retains terms of four or more characters. |
| Unit search corpus | Joins the unit code, title, description, application, knowledge evidence, performance evidence, assessment conditions, element titles, and performance-criterion text. |
| Score | Adds one point for every retained question term found within the candidate corpus. |
| Selection | Chooses the highest-scoring unit. Ties retain the first candidate in the supplied unit order. |
| Criteria and knowledge output | Returns up to the first two non-empty performance-criterion IDs and up to the first 200 characters of knowledge evidence. |
| Confidence | Uses `min(95, 50 + 5 × score)` for a positive score; uses `35` for a zero-score fallback. |

### Handling Unmapped or Weakly Mapped Questions

The mapper has an important current design choice: **when at least one valid unit exists, it always returns a selected unit**, including when the highest score is zero. A zero-score result is marked as valid but gets a low confidence of `35` and the gap:

> `No strong keyword overlap was detected; review this mapping manually.`

Therefore, truly unmapped questions occur only when **no valid units are available**. This is practical for ensuring that every report row remains actionable, but it can create a low-confidence first-unit tie when there is no semantic overlap.

### Recommended Mapping Improvement

Introduce a configurable `MINIMUM_FALLBACK_SCORE`, initially `1`. Under that policy, a zero-score candidate would return:

```json
{
  "isValid": false,
  "mappedUnit": null,
  "confidence": 0,
  "gaps": ["No meaningful keyword overlap was found; manual mapping is required."]
}
```

The report UI should then display a distinct **Unmapped — manual review required** state. This would improve precision and prevent the first unit in the uploaded order from being presented as a substantive match. If preserving the current coverage-first behavior is preferred, retain the existing fallback but make the weak-match status visually prominent.

## Lint Advisory Inventory

The production lint command is `npm run lint`. It currently reports **72 advisories and 0 errors**.

| Advisory category | Count | Main locations | Risk assessment |
|---|---:|---|---|
| `@typescript-eslint/no-unused-vars` | 37 | API routes, page/component imports, state values, service helpers | Low direct runtime risk; obscures genuinely unused or incomplete code. |
| `@typescript-eslint/no-explicit-any` | 28 | Scraper, loader, logger, document/Excel parsers, AI response handling | Medium risk; masks malformed external data and complicates safe refactoring. |
| `react-hooks/exhaustive-deps` | 3 | `MatrixView.tsx`, `UnitManager.tsx` | High priority; can lead to stale state, missed refreshes, or repeated effects. |
| `@next/next/no-img-element` | 2 | Report views rendering document images | Low-to-medium; mainly image performance behavior. |
| `react/no-unescaped-entities` | 1 | `RedTextColumn.tsx` | Low; markup correctness/readability. |
| `@typescript-eslint/no-require-imports` | 1 | `pdfQuestionExtractor.ts` | Low; module-consistency and tooling compatibility. |

## Lint Remediation Roadmap

### Phase 1 — Correctness and stale-state risks

Fix the three React-hook dependency advisories first. Move `fetchUnits` and `scrollToMapping` into `useCallback` where needed, include them in the dependency arrays, and add focused UI/API regression checks. This phase should be completed before broad style cleanup because stale effects can change actual user-visible behavior.

### Phase 2 — Remove unused production code

Resolve the 37 unused-variable warnings. Remove unused icon imports and state setters, use `catch {}` where an error object is deliberately ignored, and either wire or remove dormant report helpers. This is low-risk work that reduces cognitive overhead and will make later type work clearer.

### Phase 3 — Type external-data boundaries

Replace the 28 `any` warnings with explicit types and runtime narrowing. Prioritize `scraperService.ts` and `uocLoader.ts`, where untrusted scraped or persisted JSON becomes application data. Define a `RawScrapedUnit`/`UnknownJsonRecord` boundary, validate nested elements and criteria, and use `unknown` plus type guards instead of `any`. Then type Excel row inputs and AI JSON output with a schema validator such as the already-installed `zod` package.

### Phase 4 — Modernize module and image handling

Convert the PDF extractor’s CommonJS `require()` import to ES module syntax. For DOCX data-URI images, assess whether `next/image` with `unoptimized` is suitable; otherwise preserve `<img>` with a narrowly scoped documented lint exception because data-URI content is generated at runtime and cannot use Next’s remote-image optimization normally.

### Phase 5 — Restore strict enforcement gradually

After each category reaches zero, promote that lint rule from warning back to error. Add CI steps for `npm run build`, `npm run lint`, and `npm run test:integration`. The integration job should start the production server, wait for readiness, execute the suite, and always stop the server.

## Reproduction Commands

From `web/`, build and start the production application:

```bash
npm ci
npm run build
npm start
```

In a second terminal, run the end-to-end suite:

```bash
cd web
npm run test:integration
```

Run the quality gate:

```bash
npm run lint
```
