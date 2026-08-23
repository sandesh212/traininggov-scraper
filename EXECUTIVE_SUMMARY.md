# Executive Summary: Training.gov.au Assessment Validator

**Prepared for:** Project stakeholders
**Status:** Production build verified; integration quality gate automated on pull requests.

## Overview

The assessment-validator application has been stabilized across its document-upload workflow, reference-data handling, offline mapping fallback, performance behavior, and automated verification. The work converted a previously fragile analysis path into a validated API contract with controlled persistence, deterministic degradation when AI services are unavailable, and repeatable integration coverage.

## Business Impact

| Area | Outcome |
|---|---|
| Reliability | Invalid uploads and malformed workbooks now return clear client errors rather than triggering unhandled server failures. |
| Data safety | One-time Excel-scoped analyses remain isolated from the persisted unit database. |
| Continuity | Local mapping keeps assessment analysis available when the remote AI provider is unavailable. |
| Performance | The failed-provider analysis path decreased from 28.343 seconds to 2.663 seconds in the saved-database benchmark. |
| Delivery quality | Every pull request now builds the app and runs the complete eight-workflow live integration suite. |

## Major Code and Architecture Improvements

The upload API now treats an assessment DOCX as mandatory, supports an optional Excel unit list, enforces file-type and size constraints, and returns a consistent report shape to the interface. Saved units are used when no spreadsheet is supplied. When a spreadsheet is supplied, verified units scope only that analysis unless explicit persistence is selected. The data store is unchanged after a non-persistent analysis.

The DOCX pipeline was repaired to use the supported Mammoth image-conversion API and to discard empty question blocks that can remain after answer/red-text removal. This prevents incomplete report records from reaching the mapping and presentation layers.

The local mapping policy uses keyword overlap and a minimum threshold. Questions without meaningful overlap are not assigned to an arbitrary unit; they are returned as unmapped with zero confidence and an explicit manual-review reason.

The remote mapping layer has a request-scoped circuit breaker. The first provider failure marks the provider unavailable for that request, and all remaining questions use local mapping. This prevents dozens of repeated slow provider calls during an outage. The application supports `auto`, `remote`, and `local` mapping modes.

## Performance Evidence

| Test | Configuration | Result |
|---|---|---:|
| Failed-provider saved-database workflow before circuit breaker | 67 questions, 50 saved units | 28.343 s |
| Failed-provider saved-database workflow after circuit breaker | 67 questions, 50 saved units | 2.663 s |
| Deterministic local workflow | 67 questions, 50 saved units | 310 ms |
| Concurrent live API monitor: unit reads | 2 concurrent clients × 3 rounds | p95 158 ms |
| Concurrent live API monitor: saved-database analyses | 2 concurrent clients × 3 rounds | p95 2.822 s |
| Concurrent live API monitor target | Maximum response time | All 12 monitored requests below 3.000 s |
| Remote-validation scheduling benchmark | 24 simulated 120 ms provider calls | 2.892 s sequential; 723 ms at concurrency 4 |

The concurrent monitor deliberately covers saved-database analysis, which is fully under application control. Spreadsheet uploads that trigger external training.gov.au scraping are excluded from the three-second service-level target because their latency depends on a third-party service.

## Quality and Delivery Controls

The repository includes a full eight-workflow integration suite covering application rendering, stored-unit retrieval and searching, missing-file validation, incorrect file-type validation, malformed workbook handling, saved-database assessment analysis, and scoped non-persistent Excel analysis.

The pull-request workflow uses the locked web dependencies, executes lint policy, validates local fallback and circuit-breaker behavior, builds the production app, starts the production server, waits for readiness, runs the full integration suite, and uploads server logs if a failure occurs.

## Current Status and Next Priorities

The production build, lint policy, fallback policy test, circuit-breaker test, concurrent live monitor, and full integration suite are passing. The current main branch is suitable for pull-request enforcement.

The next capacity improvement should be bounded remote-validation concurrency when a healthy provider is intentionally enabled. The measured four-worker strategy completed four times faster than sequential validation in the deterministic provider simulation. Before enabling that change in production, provider rate limits and response error behavior should be measured in the deployed environment.
