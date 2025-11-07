import XLSX from 'xlsx-js-style';
import { Uoc } from '../models/uoc.js';
import { promises as fs } from 'fs';
import * as path from 'path';

// Color scheme for visual hierarchy
const COLORS = {
  header: { fgColor: { rgb: "4472C4" } }, // Blue header
  unit: { fgColor: { rgb: "E7E6E6" } },    // Light gray for unit rows
  element: { fgColor: { rgb: "D9E1F2" } }, // Light blue for elements
  pc: { fgColor: { rgb: "FFFFFF" } },       // White for PC
  ke_level0: { fgColor: { rgb: "FFF2CC" } }, // Light yellow for KE level 0
  ke_level1: { fgColor: { rgb: "FCF8E3" } }, // Lighter yellow for KE level 1
  ke_level2: { fgColor: { rgb: "FEFDF8" } }, // Very light yellow for KE level 2
  pe_level0: { fgColor: { rgb: "E2EFDA" } }, // Light green for PE level 0
  pe_level1: { fgColor: { rgb: "F0F8EA" } }, // Lighter green for PE level 1
  pe_level2: { fgColor: { rgb: "F8FCF5" } }, // Very light green for PE level 2
};

const FONT_BOLD = { bold: true };
const FONT_NORMAL = { bold: false };
const ALIGN_LEFT = { horizontal: "left", vertical: "top", wrapText: true };
const ALIGN_CENTER = { horizontal: "center", vertical: "center" };

interface ExcelRow {
  'Unit Code': string;
  'Release': string;
  'Unit': string;
  'Element': string;
  'Criteria/Action': string;
  'Performance Criteria': string;
  'AMPA Conditions': string;
  'Mapping Comment': string;
  'Knowledge/Assessment': string;
  'Performance Evidence': string;
  _style?: any; // Custom styling for the row
}

export class EnhancedExcelExportService {
  private outputDir: string;
  private defaultFilename: string;

  constructor(outputDir: string = 'data', defaultFilename: string = 'UnitsOfCompetency.xlsx') {
    this.outputDir = outputDir;
    this.defaultFilename = defaultFilename;
  }

  private parseNestedList(text: string): { content: string; level: number }[] {
    const lines = text.split('\n');
    const parsed: { content: string; level: number }[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      // Count leading spaces to determine nesting level
      const leadingSpaces = line.match(/^(\s*)/)?.[1].length || 0;
      const level = Math.floor(leadingSpaces / 2); // 2 spaces per level

      // Remove bullet points and trim
      const content = line.replace(/^[\s•◦]+/, '').trim();
      
      if (content) {
        parsed.push({ content, level });
      }
    }

    return parsed;
  }

  private getCellStyle(type: string, level: number = 0): any {
    let fill;
    
    switch (type) {
      case 'header':
        fill = COLORS.header;
        return {
          fill,
          font: { ...FONT_BOLD, color: { rgb: "FFFFFF" } },
          alignment: ALIGN_CENTER,
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } }
          }
        };
      
      case 'element':
        fill = COLORS.element;
        return {
          fill,
          font: FONT_BOLD,
          alignment: ALIGN_LEFT,
          border: {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" }
          }
        };
      
      case 'ke':
        fill = level === 0 ? COLORS.ke_level0 : level === 1 ? COLORS.ke_level1 : COLORS.ke_level2;
        return {
          fill,
          font: level === 0 ? FONT_BOLD : FONT_NORMAL,
          alignment: { ...ALIGN_LEFT, indent: level },
          border: {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" }
          }
        };
      
      case 'pe':
        fill = level === 0 ? COLORS.pe_level0 : level === 1 ? COLORS.pe_level1 : COLORS.pe_level2;
        return {
          fill,
          font: level === 0 ? FONT_BOLD : FONT_NORMAL,
          alignment: { ...ALIGN_LEFT, indent: level },
          border: {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" }
          }
        };
      
      default:
        return {
          fill: COLORS.pc,
          font: FONT_NORMAL,
          alignment: ALIGN_LEFT,
          border: {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" }
          }
        };
    }
  }

  async exportToExcel(units: Uoc[], filename?: string, append: boolean = true): Promise<void> {
    const filepath = path.join(this.outputDir, filename || this.defaultFilename);
    
    // Ensure output directory exists
    await fs.mkdir(this.outputDir, { recursive: true });

    let existingData: any[][] = [];
    const existingUnitCodes = new Set<string>();
    
    // If append mode and file exists, read existing data
    if (append) {
      try {
        const workbook = XLSX.readFile(filepath);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        existingData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
        
        // Track which units already exist and remove them (will be replaced)
        const unitsToUpdate = new Set(units.map(u => u.code));
        const filteredData: any[][] = [existingData[0]]; // Keep header
        
        for (let i = 1; i < existingData.length; i++) {
          const row = existingData[i];
          const unitCode = row[0]; // Unit Code is first column
          
          if (!unitCode) continue;
          
          existingUnitCodes.add(unitCode);
          
          // Keep row only if it's NOT being updated
          if (!unitsToUpdate.has(unitCode)) {
            filteredData.push(row);
          }
        }
        
        existingData = filteredData;
        const removedCount = unitsToUpdate.size;
        const keptCount = existingUnitCodes.size - removedCount;
        
        console.log(`📝 Found ${existingUnitCodes.size} existing units in Excel`);
        console.log(`   Keeping: ${keptCount} units`);
        console.log(`   Updating: ${removedCount} units (removing old data)`);
      } catch (error) {
        console.log(`📄 Creating new Excel file`);
      }
    }

    // Create new rows
    const newData: any[][] = [];
    
    // Add headers if starting fresh
    if (existingData.length === 0) {
      newData.push([
        'Unit Code',
        'Release',
        'Unit',
        'Element',
        'Criteria/Action',
        'Performance Criteria',
        'AMPA Conditions',
        'Mapping Comment',
        'Knowledge/Assessment',
        'Performance Evidence'
      ]);
    }

    for (const unit of units) {
      // Add rows for each element and its performance criteria
      if (unit.elements && unit.elements.length > 0) {
        for (const element of unit.elements) {
          for (let i = 0; i < element.performanceCriteria.length; i++) {
            const pc = element.performanceCriteria[i];
            // Parse PC number and text (format: "1.1 Text here")
            const pcMatch = pc.match(/^(\d+\.\d+)\s+(.+)$/);
            const pcNumber = pcMatch ? pcMatch[1] : '';
            const pcText = pcMatch ? pcMatch[2] : pc;

            newData.push([
              unit.code,
              unit.release || '',
              i === 0 ? `${unit.code} ${unit.title}` : '', // Show full unit only on first PC of element
              i === 0 ? element.element : '', // Show element only on first PC
              pcNumber,
              pcText,
              '', // AMPA Conditions
              '', // Mapping Comment
              '', // Knowledge/Assessment
              ''  // Performance Evidence
            ]);
          }
        }
      }

      // Add Knowledge Evidence rows with hierarchy
      if (unit.knowledgeEvidence) {
        const keItems = this.parseNestedList(unit.knowledgeEvidence);
        for (const { content, level } of keItems) {
          const indent = '  '.repeat(level);
          newData.push([
            unit.code,
            unit.release || '',
            `${unit.code} ${unit.title}`,
            '',
            '',
            '',
            '',
            '',
            `${indent}${content}`,
            ''
          ]);
        }
      }

      // Add Performance Evidence rows with hierarchy
      if (unit.performanceEvidence) {
        const peItems = this.parseNestedList(unit.performanceEvidence);
        for (const { content, level } of peItems) {
          const indent = '  '.repeat(level);
          newData.push([
            unit.code,
            unit.release || '',
            `${unit.code} ${unit.title}`,
            '',
            '',
            '',
            '',
            '',
            '',
            `${indent}${content}`
          ]);
        }
      }
    }

    // Combine existing and new data
    const allData = existingData.length > 0 
      ? [...existingData, ...newData]
      : newData;

    // Create worksheet from array
    const ws = XLSX.utils.aoa_to_sheet(allData);

    // Apply styling to header row
    if (allData[0]) {
      const headerStyle = this.getCellStyle('header');
      for (let col = 0; col < 10; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!ws[cellAddress]) ws[cellAddress] = { t: 's', v: '' };
        ws[cellAddress].s = headerStyle;
      }
    }

    // Apply styling to data rows (simplified - you can enhance this based on content type)
    for (let row = 1; row < allData.length; row++) {
      for (let col = 0; col < 10; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (!ws[cellAddress]) continue;

        // Determine cell type based on content and column
        let cellType = 'default';
        const cellValue = String(ws[cellAddress].v || '');
        
        if (col === 3 && cellValue) {
          cellType = 'element'; // Element column
        } else if (col === 8 && cellValue) {
          const level = (cellValue.match(/^(\s*)/)?.[1].length || 0) / 2;
          cellType = 'ke';
          ws[cellAddress].s = this.getCellStyle(cellType, level);
          continue;
        } else if (col === 9 && cellValue) {
          const level = (cellValue.match(/^(\s*)/)?.[1].length || 0) / 2;
          cellType = 'pe';
          ws[cellAddress].s = this.getCellStyle(cellType, level);
          continue;
        }

        ws[cellAddress].s = this.getCellStyle(cellType);
      }
    }

    // Set column widths
    ws['!cols'] = [
      { wch: 15 }, // Unit Code
      { wch: 12 }, // Release
      { wch: 50 }, // Unit
      { wch: 40 }, // Element
      { wch: 10 }, // Criteria/Action
      { wch: 60 }, // Performance Criteria
      { wch: 20 }, // AMPA Conditions
      { wch: 20 }, // Mapping Comment
      { wch: 70 }, // Knowledge/Assessment
      { wch: 70 }  // Performance Evidence
    ];

    // Build an additional summary sheet with horizontal KE/P columns (K1..Kn, P1..Pm)
    // Only include top-level items (one level down), no multi-level numbering
    const buildEvidenceSummary = (unitsList: Uoc[]) => {
      // Collect KE/PE arrays per unit (level 0 only)
      const perUnit = unitsList.map(u => {
        const ke = u.knowledgeEvidence
          ? this.parseNestedList(u.knowledgeEvidence).filter(i => i.level === 0).map(i => i.content)
          : [] as string[];
        const pe = u.performanceEvidence
          ? this.parseNestedList(u.performanceEvidence).filter(i => i.level === 0).map(i => i.content)
          : [] as string[];
        return { u, ke, pe };
      });

      const maxK = perUnit.reduce((m, x) => Math.max(m, x.ke.length), 0);
      const maxP = perUnit.reduce((m, x) => Math.max(m, x.pe.length), 0);

      const header: any[] = [
        'Unit Code',
        'Release',
        'Unit'
      ];
      // K1..Kmax then P1..Pmax
      for (let i = 1; i <= maxK; i++) header.push(`K${i}`);
      for (let i = 1; i <= maxP; i++) header.push(`P${i}`);

      const rows: any[][] = [header];

      for (const { u, ke, pe } of perUnit) {
        const row: any[] = [
          u.code,
          u.release || '',
          `${u.code} ${u.title}`
        ];
        // Fill KE cells
        for (let i = 0; i < maxK; i++) row.push(ke[i] || '');
        // Fill PE cells
        for (let i = 0; i < maxP; i++) row.push(pe[i] || '');
        rows.push(row);
      }

      return { rows, maxK, maxP };
    };

    const { rows: summaryRows, maxK, maxP } = buildEvidenceSummary(units);
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);

    // Style summary header
    if (summaryRows[0]) {
      const headerStyle = this.getCellStyle('header');
      for (let col = 0; col < summaryRows[0].length; col++) {
        const addr = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!wsSummary[addr]) wsSummary[addr] = { t: 's', v: '' } as any;
        (wsSummary[addr] as any).s = headerStyle;
      }
    }

    // Column widths for summary
    const summaryCols: any[] = [
      { wch: 15 }, // Unit Code
      { wch: 12 }, // Release
      { wch: 50 }, // Unit
    ];
    for (let i = 0; i < maxK; i++) summaryCols.push({ wch: 50 });
    for (let i = 0; i < maxP; i++) summaryCols.push({ wch: 50 });
    (wsSummary as any)['!cols'] = summaryCols;

    // Create workbook with both sheets
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Units');
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Evidence (Horizontal)');

    // Write file
    XLSX.writeFile(wb, filepath);
    
    const previousRows = existingData.length > 0 ? existingData.length - 1 : 0;
    const newRows = newData.length - (existingData.length === 0 ? 1 : 0); // Subtract header if new file
    
    console.log(`\n📊 Excel file saved: ${filepath}`);
    console.log(`   Previous rows: ${previousRows}`);
    console.log(`   New rows added: ${newRows}`);
    console.log(`   Total rows (Units sheet): ${allData.length - 1}`); // Subtract header
    console.log(`   Evidence summary columns: K1..K${maxK}, P1..P${maxP}`);
  }

  async exportFromJsonl(jsonlPath: string, excelFilename?: string, append: boolean = true): Promise<void> {
    // Read JSONL file
    const content = await fs.readFile(jsonlPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const units: Uoc[] = lines.map(line => JSON.parse(line));

    if (!append) {
      await this.exportToExcel(units, excelFilename, false);
      return;
    }

    // In append mode, check which units are already in the Excel file
    const filepath = path.join(this.outputDir, excelFilename || this.defaultFilename);
    const existingUnitCodes = new Set<string>();

    try {
      const workbook = XLSX.readFile(filepath);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const existingRows: any[] = XLSX.utils.sheet_to_json(worksheet);
      
      for (const row of existingRows) {
        const code = row['Unit Code'];
        if (code) {
          existingUnitCodes.add(code);
        }
      }
      
      console.log(`📋 Found ${existingUnitCodes.size} existing units in Excel: ${Array.from(existingUnitCodes).join(', ')}`);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.log(`📄 Excel file doesn't exist yet`);
      } else {
        console.log(`⚠️  Could not read existing Excel (${error.message}), treating as new file`);
      }
    }

    // Filter to only new units
    const newUnits = units.filter(u => !existingUnitCodes.has(u.code));
    
    if (newUnits.length === 0) {
      console.log(`✅ All ${units.length} units already in Excel file - nothing to add`);
      return;
    }

    console.log(`📝 Adding ${newUnits.length} new units: ${newUnits.map(u => u.code).join(', ')}`);
    await this.exportToExcel(newUnits, excelFilename, true);
  }
}
