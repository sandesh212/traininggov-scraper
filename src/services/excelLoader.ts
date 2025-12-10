/**
 * Excel Loader Service
 * Loads unit codes from Units.xlsx file
 */

import XLSX from 'xlsx';
import * as path from 'path';

export interface ExcelUnit {
    code: string;
    title?: string;
}

export class ExcelLoader {
    private filePath: string;

    constructor(filePath: string = 'Units.xlsx') {
        this.filePath = path.resolve(process.cwd(), filePath);
    }

    /**
     * Load unit codes from Excel file
     * The Excel file has unit codes in columns, we extract all unique codes
     * Handles multiple formats: code in any column, with or without titles
     */
    loadUnits(): ExcelUnit[] {
        try {
            const workbook = XLSX.readFile(this.filePath);
            const units: ExcelUnit[] = [];
            const seenCodes = new Set<string>();

            console.log(`\n📊 Loading units from ${this.filePath}...`);
            console.log(`   Found ${workbook.SheetNames.length} sheet(s): ${workbook.SheetNames.join(', ')}`);

            // Process all sheets
            for (const sheetName of workbook.SheetNames) {
                const sheet = workbook.Sheets[sheetName];
                const data: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                
                console.log(`   Processing sheet "${sheetName}" (${data.length} rows)...`);

                // Iterate through all cells to find unit codes
                for (const row of data) {
                    if (Array.isArray(row)) {
                        for (const cell of row) {
                            if (typeof cell === 'string') {
                                const cellTrimmed = cell.trim();
                                
                                // Match unit code pattern - more flexible
                                // Pattern: 3+ uppercase letters followed by 3+ digits, optionally followed by letters
                                // Examples: MARA022, BSBTWK201, HLTAID011, ACMWHS401, SFIAQU101, RIIWHS202E
                                const match = cellTrimmed.match(/^([A-Z]{3,}[0-9]{3,}[A-Z]*)$/);
                                if (match) {
                                    const code = match[1];
                                    if (!seenCodes.has(code)) {
                                        seenCodes.add(code);
                                        units.push({ code });
                                    }
                                }
                            }
                        }
                    }
                }
            }

            console.log(`   ✅ Loaded ${units.length} unique unit codes\n`);
            return units;

        } catch (error: any) {
            console.error(`   ❌ Failed to load Excel file: ${error.message}`);
            throw error;
        }
    }

    /**
     * Load units with their titles if available
     * Attempts to parse structured data where code and title are in adjacent columns
     */
    loadUnitsWithTitles(): ExcelUnit[] {
        try {
            const workbook = XLSX.readFile(this.filePath);
            const units: ExcelUnit[] = [];
            const seenCodes = new Set<string>();

            // Process all sheets
            for (const sheetName of workbook.SheetNames) {
                const sheet = workbook.Sheets[sheetName];
                const data: any[] = XLSX.utils.sheet_to_json(sheet);

                // Try to find code-title pairs in the data
                for (const row of data) {
                    const rowValues = Object.values(row);
                    
                    for (let i = 0; i < rowValues.length; i++) {
                        const cell = rowValues[i];
                        if (typeof cell === 'string') {
                            const match = cell.match(/\b([A-Z]{3,4}\d{3,4})\b/);
                            if (match) {
                                const code = match[1];
                                if (!seenCodes.has(code)) {
                                    seenCodes.add(code);
                                    
                                    // Try to get title from next column
                                    const nextCell = rowValues[i + 1];
                                    const title = i + 1 < rowValues.length && 
                                                  typeof nextCell === 'string'
                                        ? nextCell
                                        : undefined;
                                    
                                    units.push({ code, title });
                                }
                            }
                        }
                    }
                }
            }

            console.log(`📊 Loaded ${units.length} unique unit codes from ${this.filePath}`);
            return units;

        } catch (error: any) {
            console.error(`Failed to load Excel file: ${error.message}`);
            throw error;
        }
    }
}
