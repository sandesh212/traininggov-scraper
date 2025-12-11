import * as XLSX from 'xlsx';

export interface CodeWithSource {
    code: string;
    sourceSheet: string;
    row: number;
}

export class ExcelLoader {
    /**
     * Extract unit codes from an Excel file (Buffer)
     * Looks for patterns like AAAXXX00 or AAANNN(N)
     */
    static readUnitCodes(buffer: Buffer): { codes: string[], duplicates: string[] } {
        const wb = XLSX.read(buffer, { type: 'buffer' });
        const foundCodes = new Map<string, CodeWithSource>();
        const duplicates: string[] = [];

        // Common column names that might contain unit codes
        const targetHeaders = ['unit', 'code', 'uoc', 'unit code', 'unit_code'];

        wb.SheetNames.forEach(sheetName => {
            const ws = wb.Sheets[sheetName];
            const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');

            // Loop through every single cell in the range
            for (let r = range.s.r; r <= range.e.r; ++r) {
                for (let c = range.s.c; c <= range.e.c; ++c) {
                    const cellAddress = XLSX.utils.encode_cell({ r, c });
                    const cell = ws[cellAddress];

                    if (!cell || !cell.v) continue;

                    const text = String(cell.v).trim();
                    if (!text) continue;

                    // Robust Regex for Unit Codes
                    // Matches: BSBADM502, BSB-ADM-502, BSB ADM 502, CPCCWHS1001, UEECD0007
                    // Must start with 3-4 letters, allowing optional separator, then 3+ digits, optional suffix letters
                    const validCodeRegex = /\b([A-Z]{3,4})[\s-]?([A-Z0-9]{0,4})[\s-]?(\d{3,})([A-Z]*)\b/i;

                    // Execute regex
                    const match = text.match(validCodeRegex);
                    if (match) {
                        // Reconstruct standard format: AAABBB123 or AAA123
                        // match[1] = Prefix (e.g. BSB)
                        // match[2] = Middle (e.g. ADM or empty)
                        // match[3] = Digits (e.g. 502)
                        // match[4] = Suffix (e.g. A or empty)

                        // We strictly want to concatenate alphanumeric parts
                        const fullCode = (match[1] + match[2] + match[3] + match[4]).toUpperCase().replace(/[^A-Z0-9]/g, '');

                        // Filter out common false positives (like 'UNIT', 'CODE', dates, heavy text)
                        // TGA codes are generally 8-12 characters long.
                        if (fullCode.length >= 7 && fullCode.length <= 13) {
                            if (foundCodes.has(fullCode)) {
                                if (!duplicates.includes(fullCode)) duplicates.push(fullCode);
                            } else {
                                foundCodes.set(fullCode, {
                                    code: fullCode,
                                    sourceSheet: sheetName,
                                    row: r + 1
                                });
                            }
                        }
                    }
                }
            }
        });

        return {
            codes: Array.from(foundCodes.keys()).sort(),
            duplicates: duplicates.sort()
        };
    }
}
