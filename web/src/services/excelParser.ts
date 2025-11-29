import * as xlsx from 'xlsx';
import * as fs from 'fs';

export async function extractUnitCodesFromExcel(input: Buffer | string): Promise<string[]> {
    try {
        let workbook;

        console.log('📊 Excel Parser: Starting...');
        console.log(`   Input type: ${Buffer.isBuffer(input) ? 'Buffer' : 'FilePath'}`);

        if (Buffer.isBuffer(input)) {
            console.log(`   Buffer size: ${input.length} bytes`);
            workbook = xlsx.read(input, { type: 'buffer' });
        } else {
            console.log(`   File path: ${input}`);
            console.log(`   File exists: ${fs.existsSync(input)}`);
            if (!fs.existsSync(input)) {
                throw new Error(`File not found: ${input}`);
            }
            const stats = fs.statSync(input);
            console.log(`   File size: ${stats.size} bytes`);

            // Read file into buffer first (more reliable than xlsx.readFile for temp files)
            const fileBuffer = fs.readFileSync(input);
            console.log(`   Buffer loaded: ${fileBuffer.length} bytes`);
            workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        }

        console.log(`   Workbook loaded successfully`);
        console.log(`   Sheet names: ${workbook.SheetNames.join(', ')}`);

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Convert to JSON array of arrays
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        console.log(`   Rows found: ${data.length}`);

        const unitCodes: string[] = [];

        // Regex for Unit Codes (e.g., MARN008, BSBADM502)
        const codeRegex = /^[A-Z]{3,4}[0-9]{3,4}[A-Z]?$/;

        for (const row of data) {
            for (const cell of row) {
                if (typeof cell === 'string') {
                    const trimmed = cell.trim();
                    if (codeRegex.test(trimmed)) {
                        unitCodes.push(trimmed);
                    }
                }
            }
        }

        const uniqueCodes = Array.from(new Set(unitCodes));
        console.log(`   ✅ Extracted ${uniqueCodes.length} unique unit codes: ${uniqueCodes.join(', ')}`);
        return uniqueCodes;
    } catch (error) {
        console.error('❌ Excel Parser Error:', error);
        throw new Error(`Excel parsing failed: ${(error as Error).message}`);
    }
}
