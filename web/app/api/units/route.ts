
import { NextRequest, NextResponse } from 'next/server';
import { UocLoader } from '@/services/uocLoader';
import { ScraperService } from '@/services/scraperService';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const search = searchParams.get('search')?.toLowerCase();

        const loader = new UocLoader('data/uoc.jsonl');
        await loader.load();
        let units = loader.getAllUnits();
        const lastUpdated = loader.getLastUpdated();

        if (search) {
            units = units.filter(u => {
                // Basic fields
                if (u.code.toLowerCase().includes(search) || u.title.toLowerCase().includes(search)) return true;

                // Deep search
                if (u.description?.toLowerCase().includes(search)) return true;
                if (u.knowledgeEvidence?.toLowerCase().includes(search)) return true;
                if (u.performanceEvidence?.toLowerCase().includes(search)) return true;
                if (u.assessmentConditions?.toLowerCase().includes(search)) return true;

                // Search in elements and PC
                return u.elements.some(el =>
                    el.title.toLowerCase().includes(search) ||
                    el.performanceCriteria.some(pc => pc.text.toLowerCase().includes(search))
                );
            });
        }

        // Return simplified list for the table
        const simpleList = units.map(u => ({
            code: u.code,
            title: u.title,
            elementCount: u.elements.length
        }));

        return NextResponse.json({
            units: simpleList,
            count: units.length,
            lastUpdated: lastUpdated ? lastUpdated.toISOString() : null
        });
    } catch {
        return NextResponse.json({ error: 'Failed to fetch units' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { code } = body;

        if (!code) {
            return NextResponse.json({ error: 'Unit code is required' }, { status: 400 });
        }

        // Split by comma or space and clean up
        const codes = code.split(/[\s,]+/).map((c: string) => c.trim().toUpperCase()).filter(Boolean);

        if (codes.length === 0) {
            return NextResponse.json({ error: 'No valid unit codes provided' }, { status: 400 });
        }

        const scraper = new ScraperService();
        const loader = new UocLoader('data/uoc.jsonl');
        await loader.load();

        const added: string[] = [];
        const failed: { code: string; reason: string }[] = [];

        // Process sequentially to be nice to TGA
        for (const c of codes) {
            try {
                const unit = await scraper.scrapeUnit(c);
                if (unit) {
                    await loader.addUnit(unit);
                    added.push(c);
                } else {
                    failed.push({ code: c, reason: 'Not found on training.gov.au' });
                }
            } catch {
                failed.push({ code: c, reason: 'Scraping error' });
            }
        }

        return NextResponse.json({
            message: `Processed ${codes.length} units`,
            added,
            failed
        });

    } catch (error) {
        console.error('Error adding units:', error);
        return NextResponse.json({ error: 'Failed to add units' }, { status: 500 });
    }
}

export async function DELETE() {
    try {
        const loader = new UocLoader('data/uoc.jsonl');
        await loader.clearAll();
        return NextResponse.json({ message: 'All units cleared' });
    } catch {
        return NextResponse.json({ error: 'Failed to clear units' }, { status: 500 });
    }
}
