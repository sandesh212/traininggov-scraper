
import { NextResponse } from 'next/server';
import { UocLoader } from '@/services/uocLoader';

export async function POST() {
    try {
        const loader = new UocLoader('data/uoc.jsonl');
        const success = await loader.restore();

        if (success) {
            return NextResponse.json({ message: 'Units restored successfully' });
        } else {
            return NextResponse.json({ error: 'No backup found to restore' }, { status: 404 });
        }
    } catch {
        return NextResponse.json({ error: 'Failed to restore units' }, { status: 500 });
    }
}
