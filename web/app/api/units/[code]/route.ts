
import { NextRequest, NextResponse } from 'next/server';
import { UocLoader } from '@/services/uocLoader';

import { ScraperService } from '@/services/scraperService';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ code: string }> }
) {
    void request;
    try {
        const { code } = await params;
        const loader = new UocLoader('data/uoc.jsonl');
        await loader.load();
        const unit = loader.getUnit(code);

        if (!unit) {
            return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
        }

        return NextResponse.json(unit);
    } catch {
        return NextResponse.json({ error: 'Failed to fetch unit details' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ code: string }> }
) {
    void request;
    try {
        const { code } = await params;
        const loader = new UocLoader('data/uoc.jsonl');
        await loader.load();
        const success = await loader.removeUnit(code);

        if (!success) {
            return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Unit deleted successfully' });
    } catch {
        return NextResponse.json({ error: 'Failed to delete unit' }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ code: string }> }
) {
    void request;
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
    } catch {
        return NextResponse.json({ error: 'Failed to update unit' }, { status: 500 });
    }
}
