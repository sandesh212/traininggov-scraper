
import { NextResponse } from 'next/server';
import { UocLoader } from '@/services/uocLoader';
import { ScraperService } from '@/services/scraperService';

export async function POST() {
    try {
        const loader = new UocLoader('data/uoc.jsonl');
        await loader.load();
        const units = loader.getAllUnits();

        if (units.length === 0) {
            return NextResponse.json({ message: 'No units to refresh', updated: 0, failed: 0 });
        }

        const scraper = new ScraperService();
        let updatedCount = 0;
        let failedCount = 0;
        const failedCodes: string[] = [];

        // Process in sequence to avoid rate limiting
        for (const existingUnit of units) {
            try {
                const freshUnit = await scraper.scrapeUnit(existingUnit.code);
                if (freshUnit) {
                    await loader.addUnit(freshUnit); // addUnit overwrites existing
                    updatedCount++;
                } else {
                    failedCount++;
                    failedCodes.push(existingUnit.code);
                }
            } catch (error) {
                console.error(`Failed to refresh ${existingUnit.code}:`, error);
                failedCount++;
                failedCodes.push(existingUnit.code);
            }
        }

        return NextResponse.json({
            message: `Refreshed ${updatedCount} units`,
            updated: updatedCount,
            failed: failedCount,
            failedCodes
        });

    } catch (error) {
        console.error('Bulk refresh failed:', error);
        return NextResponse.json({ error: 'Failed to refresh units' }, { status: 500 });
    }
}
