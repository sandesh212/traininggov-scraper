
import { NextRequest, NextResponse } from 'next/server';
import { UocLoader } from '@/services/uocLoader';

import { ScraperService } from '@/services/scraperService';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ code: string }> }
) {
    try {
        const { code } = await params;
        const loader = new UocLoader('data/uoc.jsonl');
        await loader.load();
        const unit = loader.getUnit(code);

        if (!unit) {
            return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
        }

        return NextResponse.json(unit);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch unit details' }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ code: string }> }
) {
    try {
        const { code } = await params;
        const loader = new UocLoader('data/uoc.jsonl');
        await loader.load();
        const success = await loader.removeUnit(code);

        if (!success) {
            return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Unit deleted successfully' });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete unit' }, { status: 500 });
    }
}

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ code: string }> }
) {
    try {
        const { code } = await params;
        const scraper = new ScraperService();
        const unit = await scraper.scrapeUnit(code);

        if (!unit) {
            return NextResponse.json({ error: 'Unit not found on training.gov.au' }, { status: 404 });
        }

        const loader = new UocLoader('data/uoc.jsonl');
        await loader.load();
        await loader.addUnit(unit);

        return NextResponse.json({ message: 'Unit updated successfully', unit });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update unit' }, { status: 500 });
    }
}
