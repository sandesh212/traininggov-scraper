const { ScraperService } = require('./web/src/services/scraperService.ts');

const testCodes = ['MARA022', 'MARA024', 'MARA025', 'MARA004', 'MARA005'];

async function test() {
    const scraper = new ScraperService();
    console.log('\n🔍 Testing with Puppeteer (JavaScript rendering enabled)...\n');

    const results = await scraper.scrapeUnitsWithDetails(testCodes);

    console.log(`\n✅ VALID: ${results.valid.length}`);
    results.valid.forEach(u => console.log(`  ✓ ${u.code} - ${u.title}`));

    console.log(`\n❌ INVALID: ${results.invalid.length}`);
    results.invalid.forEach(u => console.log(`  ✗ ${u.code} - ${u.reason}`));
}

test().catch(console.error);
