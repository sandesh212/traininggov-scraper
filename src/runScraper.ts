/**
 * Run Scraper with Progress Bars
 * 
 * This script runs the full scraping pipeline:
 * 1. Load units from Units.xlsx
 * 2. Validate units (checking for 404s) with progress bar
 * 3. Scrape content for valid units with progress bar
 * 4. Save results to data/units.json
 * 
 * Usage: npx tsx src/runScraper.ts [--skip-validation]
 */

import { ExcelLoader } from './services/excelLoader.js';
import { UnitValidator, ValidationResult } from './services/unitValidator.js';
import { ScraperService } from '../web/src/services/scraperService.js';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    const args = process.argv.slice(2);
    const skipValidation = args.includes('--skip-validation');
    const excelPath = args.find(arg => arg.endsWith('.xlsx')) || 'Units.xlsx';

    console.log('\n🚀 FULL SCRAPER PIPELINE\n');

    // 1. Load from Excel
    console.log(`\n📊 Loading units from ${excelPath}...`);
    const loader = new ExcelLoader(excelPath);
    const excelUnits = loader.loadUnits();

    if (excelUnits.length === 0) {
        console.error('❌ No units found in Excel file!');
        process.exit(1);
    }

    const allCodes = excelUnits.map((u: { code: string }) => u.code);
    console.log(`   Found ${allCodes.length} units.`);

    let codesToScrape = allCodes;

    // 2. Validate
    if (!skipValidation) {
        console.log('\n🔍 Validating units...');
        const validator = new UnitValidator();
        const { valid, invalid } = await validator.validateUnits(allCodes);
        codesToScrape = valid.map((v: ValidationResult) => v.code);

        // Save invalid report
        fs.writeFileSync('invalid-units.txt', invalid.map((i: ValidationResult) => `${i.code}: ${i.reason}`).join('\n'));
        console.log(`   ✅ Validation done. ${codesToScrape.length} valid, ${invalid.length} invalid.`);
    } else {
        console.log('\n⚠️  Skipping validation.');
    }

    if (codesToScrape.length === 0) {
        console.log('No valid units to scrape.');
        return;
    }

    // 3. Scrape
    console.log(`\n⬇️  Scraping ${codesToScrape.length} units...`);
    const scraper = new ScraperService();

    // We use scrapeUnitsWithDetails because it has the progress bar I added
    // The second argument 'skipValidation' is true because we already validated (or skipped)
    const { valid: scrapedUnits, invalid: failedScrapes } = await scraper.scrapeUnitsWithDetails(codesToScrape, true);

    // 4. Save Results
    console.log(`\n💾 Saving results...`);

    if (!fs.existsSync('data')) fs.mkdirSync('data');

    const outputPath = 'data/scraped_units.json';
    fs.writeFileSync(outputPath, JSON.stringify(scrapedUnits, null, 2));

    console.log(`   ✅ Saved ${scrapedUnits.length} units to ${outputPath}`);

    if (failedScrapes.length > 0) {
        console.log(`   ⚠️  ${failedScrapes.length} units failed to scrape. See data/failed_scrapes.json`);
        fs.writeFileSync('data/failed_scrapes.json', JSON.stringify(failedScrapes, null, 2));
    }

    console.log('\n✨ Done!');
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
