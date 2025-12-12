
import { NextRequest, NextResponse } from 'next/server';
import { UocLoader } from '@/services/uocLoader';
import { ScraperService } from '@/services/scraperService';

export async function POST(req: NextRequest) {
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

        // Process in batches to improve speed but avoid overwhelming the server
        const BATCH_SIZE = 3;
        const chunks = [];
        for (let i = 0; i < units.length; i += BATCH_SIZE) {
            chunks.push(units.slice(i, i + BATCH_SIZE));
        }

        for (const chunk of chunks) {
            await Promise.all(chunk.map(async (existingUnit) => {
                try {
                    const freshUnit = await scraper.scrapeUnit(existingUnit.code);
                    if (freshUnit) {
                        await loader.addUnit(freshUnit);
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
            }));
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
