# Performance & Reliability Enhancements

This document describes the scraping/export pipeline optimizations and tuning options.

### Key Features

| Feature | Purpose | Configuration |
|---------|---------|---------------|
| Concurrency (Crawler) | Parallel fetch of units | `Crawler({ concurrency: N })` |
| Retry + Backoff | Resilient against transient network/timeouts | `Fetcher({ maxRetries, backoffMs })` |
| Polite Delay | Avoid server overload / throttling | `Fetcher({ minDelayMs })` |
| Structured Sections | Preserve full heading/list hierarchy | `uoc.sections` field |
| Per-Unit Cache | Fast re-use & debugging | `data/units/<CODE>.json` |
| Error Classification | Faster triage | NETWORK, TIMEOUT, PARSE, UNKNOWN |
| Log Levels | Control verbosity | error, warn, info, debug |

### Recommended Settings

| Scenario | concurrency | minDelayMs | LOG_LEVEL |
|----------|-------------|-----------|-----------|
| Initial full scrape (polite) | 2–3 | 1200–1500 ms | info |
| Re-run small delta | 4–5 | 600–900 ms | debug |
| CI verification | 1 | 1500–2000 ms | warn |

### Environment Variables

```bash
LOG_LEVEL=info
```

Lower to `warn` or `error` to reduce console output; raise to `debug` for detailed timings.

### Error Log Format (`data/error-log.json`)

```json
{
  "timestamp": "2025-11-14T00:00:00.000Z",
  "errors": [
    {
      "url": "https://training.gov.au/training/details/XYZ123/unitdetails",
      "errorType": "NETWORK",
      "message": "FetchFailed:NETWORK: net::ERR_CONNECTION_RESET",
      "stack": "..."
    }
  ]
}
```

### Sections Sheet

Generated to aid advanced mapping. Columns: Unit Code, Heading Level, Heading, Paragraphs, List Items.

### Future Improvements

1. Persistent HTTP session reuse (Puppeteer page pool).
2. Adaptive delay based on recent error rate.
3. Optional AI summarization of large evidence blocks.
4. Selective re-fetch only for outdated units (compare `lastFetchedAt`).

### Troubleshooting

| Symptom | Likely Cause | Action |
|---------|--------------|--------|
| Many TIMEOUT errors | Site slow / concurrency too high | Lower `concurrency`, raise `minDelayMs` |
| High NETWORK errors | Transient network issues | Increase `maxRetries`, verify connectivity |
| Excel missing units | Scrape interrupted | Re-run crawler with same list (idempotent) |
| Excessive console spam | Log level too high | Set `LOG_LEVEL=warn` |

### Quick Run

```bash
LOG_LEVEL=info npm run start
```

### Verification

After a full scrape: `wc -l data/uoc.jsonl` should match target count (129-131). Check error log for persistent failures.
