import { NextRequest, NextResponse } from 'next/server';
import { ExcelLoader } from '@/services/excelLoader';
import { ScraperService } from '@/services/scraperService';
import { UocLoader } from '@/services/uocLoader';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        let codes: string[] = [];
        let duplicates: any[] = [];

        if (file.name.endsWith('.txt')) {
            const text = new TextDecoder().decode(buffer);
            codes = text.split(/\r?\n/)
                .map(line => line.trim())
                .filter(line => line.length > 0 && !line.startsWith('#')); // Simple filtering
        } else {
            // ExcelLoader handles .xlsx, .xls, and .csv using SheetJS
            const result = ExcelLoader.readUnitCodes(buffer);
            codes = result.codes;
            duplicates = result.duplicates;
        }

        if (codes.length === 0) {
            // Fallback: try treating as text file unit list if Excel fails?
            // But ExcelLoader checks XLSX format. 
            return NextResponse.json({ error: 'No unit codes found in Excel file' }, { status: 400 });
        }

        const scraper = new ScraperService();
        const loader = new UocLoader('data/uoc.jsonl');
        await loader.load();

        const uniqueAdded = new Set<string>();
        const failed: { code: string; reason: string }[] = [];

        // Use scrapeUnitsWithDetails with incremental saving
        const { valid, invalid } = await scraper.scrapeUnitsWithDetails(codes, true, async (unit) => {
            await loader.addUnit(unit);
            uniqueAdded.add(unit.code);
        });

        // Loop for valid units REMOVED because we save incrementally in callback above.
        // We still iterate invalid for the response report.

        for (const inv of invalid) {
            failed.push({ code: inv.code, reason: inv.reason });
        }

        return NextResponse.json({
            success: true,
            message: `Processed ${codes.length} input codes. Resulted in ${uniqueAdded.size} unique units (Added/Updated). Failed: ${failed.length}`,
            added: Array.from(uniqueAdded),
            failed,
            duplicates
        });

    } catch (error) {
        console.error('File scrape error:', error);
        return NextResponse.json({ error: 'Failed to process file' }, { status: 500 });
    }
}
