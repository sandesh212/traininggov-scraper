# Development Guidelines - Training.gov.au Scraper

## Project Architecture

### Technology Stack
- **Framework**: Next.js 16 (App Router, React 19)
- **Styling**: TailwindCSS, Framer Motion
- **Scraping**: Puppeteer (headless Chrome) + Cheerio
- **AI/ML**: @xenova/transformers (local models)
- **Database**: JSON-based file storage (uoc.jsonl)

### Directory Structure
```
web/
├── app/                    # Next.js app router
│   ├── api/               # API routes
│   │   ├── analyze/       # Main analysis endpoint
│   │   └── units/         # Unit management endpoints
│   └── page.tsx           # Main UI page
├── src/
│   ├── components/        # React components
│   ├── services/          # Business logic
│   │   ├── scraperService.ts    # Web scraping + Puppeteer
│   │   ├── aiService.ts         # AI mapping logic
│   │   ├── uocLoader.ts         # Unit database management
│   │   └── *Parser.ts           # Document parsers
│   ├── types.ts           # TypeScript definitions
│   └── utils/             # Helper utilities
└── data/
    └── uoc.jsonl          # Unit of Competency database
```

## Code Style & Standards

### TypeScript
- **Strict Mode**: Always enabled
- **Naming**:
  - Components: PascalCase (`QuestionCard`)
  - Functions: camelCase (`scrapeUnit`)
  - Constants: UPPER_SNAKE_CASE (`MAX_RETRIES`)
  - Types/Interfaces: PascalCase (`QuestionResult`)
  
### React Components
- **Function components only** (no class components)
- **Props destructuring** preferred
- **Use TypeScript interfaces** for all props
- **Key prop**: Always unique, use `${index}-${id}` pattern if needed

### CSS/Styling
- **TailwindCSS utility-first** approach
- **Responsive design**: Always test mobile, tablet, desktop
- **Dark mode**: Not currently implemented but structure supports it
- **Animations**: Use Framer Motion for complex animations

## Critical Development Patterns

### 1. Scraping Strategy
```typescript
// Always follow this pattern:
async scrapeUnit(code: string): Promise<Unit | null> {
  // 1. Try direct fetch first (fast)
  // 2. Detect if SPA (Nuxt.js markers)
  // 3. If SPA, use Puppeteer with proper waits
  // 4. If 404, try search fallback
  // 5. Log detailed failure reasons
}
```

**Key Rules**:
- Always wait for content-specific text (e.g., "Assessment Conditions")
- Use `networkidle0` for initial page load
- Add extra 2s delay after content loads for animations
- Maximum timeout: 45s for page load, 15s for content wait

### 2. Error Handling
```typescript
try {
  // Operation
  console.log(`✓ Success for ${code}`);
} catch (e) {
  console.error(`✗ Failed for ${code}. Reason: ${e}`);
  // Always log WHY it failed, not just that it failed
  return null;
}
```

### 3. React Keys
**NEVER** use just `id` or `questionId` as keys if there might be duplicates:
```typescript
// ❌ BAD - can cause duplicate key errors
{items.map(item => <Card key={item.id} />)}

// ✅ GOOD - guaranteed unique
{items.map((item, idx) => <Card key={`card-${idx}-${item.id}`} />)}
```

### 4. AnimatePresence
**NEVER** have multiple children with mode="wait":
```typescript
// ❌ BAD - causes warning
<AnimatePresence mode="wait">
  {loading && <LoadingView key="loading" />}
  {!loading && <ContentView key="content" />}
</AnimatePresence>

// ✅ GOOD - single child via ternary
<AnimatePresence mode="wait">
  {loading ? (
    <LoadingView key="loading" />
  ) : (
    <ContentView key="content" />
  )}
</AnimatePresence>
```

## Testing Checklist

### Before Committing
- [ ] Run `npm run build` - must pass with 0 errors
- [ ] Check browser console - no React warnings
- [ ] Test on mobile viewport (responsive)
- [ ] Test with actual training.gov.au units
- [ ] Verify Puppeteer screenshots if debugging

### Scraper Testing
```bash
# Test individual unit
node web/test-scrape.js

# Check console for:
# - "Detected SPA shell" messages
# - "Content loaded" confirmations  
# - "Page text length" debug info
```

### Performance Targets
- **Static unit fetch**: < 1s
- **Puppeteer SPA fetch**: < 10s
- **AI mapping per question**: < 2s
- **Full analysis (50 questions)**: < 5 minutes

## Common Issues & Solutions

### Issue: Units showing as invalid
**Diagnostic**: Check server logs for:
```
Detected SPA shell for XXX. Switching to Puppeteer...
Page text length: XXXX chars
```

**Solution**: If text length is < 1000, Puppeteer isn't waiting long enough:
- Increase content wait timeout
- Add more specific wait conditions
- Check if training.gov.au structure changed

### Issue: Build fails with type errors
**Solution**:
1. Run `npm run build` to see exact error
2. Check `TargetFile` path is correct
3. Verify all imports are typed
4. Update `types.ts` if needed

### Issue: Out of memory (Puppeteer)
**Solution**:
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run dev
```

Or process units in smaller batches.

## API Endpoint Conventions

### Request/Response Format
```typescript
// POST /api/analyze
Request: FormData {
  assessmentFile: File (DOCX)
  unitsFile?: File (XLSX)  
  ignoreInvalid?: boolean
}

Response: {
  report: AnalysisReport
  redTextSegments: RedTextSegment[]
  invalidUnits?: InvalidUnit[]  // if ignoreInvalid=false
}
```

### Error Handling Pattern
```typescript
try {
  // Process
  return NextResponse.json({ success: true, data });
} catch (error) {
  console.error('API Error:', error);
  return NextResponse.json(
    { error: 'Detailed error message' },
    { status: 500 }
  );
}
```

## Database Management

### Unit Storage (uoc.jsonl)
- One JSON object per line
- Each object is a complete `Unit` type
- Backup created before refresh (`uoc.jsonl.backup`)

### Adding New Units
```typescript
// Via scraper refresh
POST /api/units/refresh
// Scrapes all units again

// Via manual upload (future feature)
POST /api/units/upload  
// Bulk import from Excel/JSON
```

## Performance Optimization

### Puppeteer Best Practices
1. **Reuse browser instance**: Don't launch new browser per unit
2. **Close pages properly**: Always use try/finally
3. **Limit concurrency**: Process units sequentially to avoid memory issues
4. **Cache static content**: Consider caching unit data for 24 hours

### AI Model Loading
- Models lazy-load on first use
- Consider preloading during app startup for better UX

## Future Enhancements

### Planned Features
- [ ] Real-time database update notifications
- [ ] Bulk unit upload via Excel/CSV
- [ ] "Save to DB" toggle on unit validation
- [ ] Unit freshness indicators (last updated timestamp)
- [ ] Retry mechanism for failed units
- [ ] Export failed units list
- [ ] Dark mode support
- [ ] Mobile-optimized report viewer

### Technical Debt
- Consider migrating from JSON to SQLite for better performance
- Add rate limiting to prevent training.gov.au blocking
- Implement service worker for offline capability
- Add unit tests for critical scraping logic

## Security Considerations

- Never commit API keys or secrets
- Validate all file uploads (size, type, content)
- Sanitize HTML from scraped content before rendering
- Use CSP headers in production
- Rate limit API endpoints

## Deployment

### Production Build
```bash
cd web
npm run build
npm start
```

### Environment Variables
```env
# Optional - for enhanced AI features
OPENAI_API_KEY=sk-...
```

### Server Requirements
- Node.js 18+
- 4GB RAM minimum (for Puppeteer)
- Chrome/Chromium installed (for Puppeteer)

## Contributing

When contributing:
1. Create feature branch from `main`
2. Follow code style guidelines
3. Add TypeScript types for all new code
4. Test with real training.gov.au data
5. Update this file if adding new patterns
6. Commit with descriptive messages

## Support

For issues or questions:
- Check existing GitHub issues
- Review console logs for detailed error messages
- Test in isolation with `test-scrape.js`
- Provide unit codes that fail for debugging
