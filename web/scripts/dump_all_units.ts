
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { ScraperService } from '../src/services/scraperService';
import { Unit } from '../src/types';

const DATA_FILE = path.join(process.cwd(), 'data', 'uoc.jsonl');
const DUMP_DIR = path.join(process.cwd(), 'debug_dumps');

async function dumpAllUnits() {
    console.log(`Reading units from ${DATA_FILE}...`);

    // 1. Get all codes first
    const codes: string[] = [];
    if (fs.existsSync(DATA_FILE)) {
        const fileStream = fs.createReadStream(DATA_FILE);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        for await (const line of rl) {
            if (!line.trim()) continue;
            try {
                const u = JSON.parse(line);
                if (u.code) codes.push(u.code);
            } catch (e) { }
        }
    } else {
        console.error("Data file not found!");
        return;
    }

    console.log(`Found ${codes.length} units to scrape and dump.`);

    // 2. Initialize Scraper
    const scraper = new ScraperService();
    await scraper.init();

    // 3. Process
    let successCount = 0;
    let failCount = 0;

    // Use a subset for testing or all? User said "all".
    // Let's do a batch to avoid infinite run if there are 1000s, or just run it.
    // I will run for the first 20 as a sample for the "technique", then the user can run more.
    // Actually, user said "retrieve all". I'll try to do them all but sequentially.

    for (const code of codes) {
        const dumpPath = path.join(DUMP_DIR, `${code}.json`);

        // Skip if already dumped? No, user wants to see what's working NOW.
        // But maybe we skip if we just did it to save time? No.

        console.log(`\nScraping ${code}...`);
        try {
            const unit = await scraper.scrapeUnit(code);

            if (unit) {
                // Determine if "incomplete"
                let status = "COMPLETE";
                if (!unit.performanceEvidence || unit.performanceEvidence.length < 50) status = "MISSING_PE";
                if (!unit.elements || unit.elements.length === 0) status = "MISSING_ELEMENTS";

                const debugObj = {
                    _status: status,
                    _scrapedAt: new Date().toISOString(),
                    ...unit
                };

                fs.writeFileSync(dumpPath, JSON.stringify(debugObj, null, 2));
                console.log(`   ✅ Saved to ${code}.json [${status}]`);
                successCount++;
            } else {
                console.log(`   ❌ Failed to scrape ${code}`);
                fs.writeFileSync(dumpPath, JSON.stringify({ _status: "FAILED_TO_SCRAPE", code }, null, 2));
                failCount++;
            }
        } catch (e) {
            console.error(`   ❌ Error on ${code}:`, e);
            failCount++;
        }
    }

    await scraper.close();
    console.log(`\nDone. Success: ${successCount}, Failed: ${failCount}`);
    console.log(`Check ${DUMP_DIR} for results.`);
}

dumpAllUnits();
