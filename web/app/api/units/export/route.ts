import { NextRequest, NextResponse } from 'next/server';
import { UocLoader } from '@/services/uocLoader';
import { MaritimeExcelService } from '@/services/MaritimeExcelService';
import { UnitMapper } from '@/utils/unitMapper';
import { promises as fs } from 'fs';
import * as path from 'path';

export async function GET(req: NextRequest) {
    // URL Params
    const { searchParams } = new URL(req.url);
    const unitCode = searchParams.get('unit'); // Optional: filter by unit code

    try {
        const loader = new UocLoader('data/uoc.jsonl');
        await loader.load();
        let units = loader.getAllUnits();

        if (units.length === 0) {
            return NextResponse.json({ error: 'No units to export' }, { status: 400 });
        }

        // Filter if specific unit requested
        if (unitCode) {
            units = units.filter(u => u.code === unitCode);
            if (units.length === 0) {
                return NextResponse.json({ error: `Unit ${unitCode} not found` }, { status: 404 });
            }
        }

        // Map to Uoc format
        const uocs = units.map(u => UnitMapper.toUoc(u));

        // Generate Excel
        const timestamp = new Date().toISOString().split('T')[0];
        const downloadName = unitCode ? `${unitCode}.xlsx` : `AllUnitsData.xlsx`;
        const tempName = `Export_${Date.now()}.xlsx`;
        const outputDir = path.join(process.cwd(), 'temp_exports');

        const excelService = new MaritimeExcelService(outputDir, tempName);
        const filePath = await excelService.generateExcel(tempName, uocs);

        // Read file
        const fileBuffer = await fs.readFile(filePath);

        // Cleanup
        try {
            await fs.unlink(filePath);
            await fs.rmdir(outputDir).catch(() => { });
        } catch (e) {
            console.error('Cleanup error:', e);
        }

        // Return file
        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${downloadName}"`,
            }
        });

    } catch (error) {
        console.error('Export error:', error);
        return NextResponse.json({ error: 'Failed to generate Excel file' }, { status: 500 });
    }
}
