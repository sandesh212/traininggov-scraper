
import { NextRequest, NextResponse } from 'next/server';
import { UocLoader } from '@/services/uocLoader'; // Adjust path if necessary, assuming alias or relative
import { Unit } from '@/types'; // Adjust path

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const text = await file.text();
        const loader = new UocLoader();
        await loader.load(); // Load existing to prevent overwrites or duplicates if needed, or just to init map

        const lines = text.split('\n');
        let addedCount = 0;
        let errorCount = 0;

        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const rawUnit = JSON.parse(line);

                // Validate minimal requirements
                if (!rawUnit.code || !rawUnit.title) {
                    console.warn('Skipping invalid unit line (missing code/title)');
                    errorCount++;
                    continue;
                }

                // Transform raw unit to internal Unit format if necessary
                // The UocLoader.transform method is private, but we can rely on the fact that
                // if we construct a Unit object manually here or use public methods if available.
                // However, UocLoader.transform is what handles the "custom format" -> "internal format" logic.
                // Since transform is private, we should ideally expose a method in UocLoader to "parse and add" raw data.
                // But for now, let's use a trick: we can just append to the file if we trust the format, 
                // OR we can try to duplicate the transform logic here, 
                // OR we can make transform public.
                // Best approach: Add a method to UocLoader or ScraperService? 
                // Actually, ScraperService isn't involved.

                // Let's assume the UocLoader logic:
                // It reads from the file and calls transform.
                // If we want to add a unit, we call addUnit(unit: Unit).
                // So we need to transform the raw JSON into a Unit object here.

                // Re-implementing the transform logic briefly here to be safe, 
                // matching what we did in UocLoader.ts step 231/228.

                const elements = (rawUnit.elements || []).map((el: any) => {
                    const pcs = (el.performanceCriteria || []).map((pcText: any) => {
                        if (typeof pcText === 'object' && pcText.id) return pcText;
                        const match = (pcText as string).match(/^(\d+\.\d+)\s+(.+)/);
                        if (match) return { id: match[1], text: match[2] };
                        return { id: '', text: pcText };
                    });
                    return {
                        title: el.title || el.element, // Handle 'element' key from custom format
                        performanceCriteria: pcs
                    };
                });

                const unit: Unit = {
                    code: rawUnit.code,
                    title: rawUnit.title,
                    url: rawUnit.url,
                    status: rawUnit.status,
                    release: rawUnit.release,
                    description: rawUnit.description || rawUnit.application || '',
                    application: rawUnit.application || '',
                    unitSector: rawUnit.unitSector || '',
                    modificationHistory: rawUnit.modificationHistory || '',
                    foundationSkills: rawUnit.foundationSkills || '',
                    elements,
                    performanceEvidence: rawUnit.performanceEvidence || '',
                    knowledgeEvidence: rawUnit.knowledgeEvidence || '',
                    assessmentConditions: rawUnit.assessmentConditions || '',
                    sections: rawUnit.sections || [],
                    lastFetchedAt: rawUnit.lastFetchedAt || new Date().toISOString()
                };

                await loader.addUnit(unit);
                addedCount++;
            } catch (e) {
                console.error('Failed to parse line:', e);
                errorCount++;
            }
        }

        return NextResponse.json({
            success: true,
            message: `Successfully processed file. Added/Updated ${addedCount} units. Failed: ${errorCount}`,
            stats: { added: addedCount, failed: errorCount }
        });

    } catch (error) {
        console.error('Upload failed:', error);
        return NextResponse.json({ error: 'Failed to process file' }, { status: 500 });
    }
}
