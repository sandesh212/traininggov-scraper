import XLSX from 'xlsx-js-style';
import { Uoc, UocSection } from '../models/uoc.js';
import { promises as fs } from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger.js';

/**
 * Maritime-style Excel Export Service
 * Matches the structure of "Maritime-Mapping (Master) 2025 - Uploaded.xlsx"
 * 
 * Features:
 * - Multiple sheets (one per mapping type)
 * - Two-row headers with merged cells for assessment categories
 * - 11 columns: Unit, Element, Criteria/Evidence, Performance Criteria, AMPA Conditions, 
 *   Mapping Count, and 5 assessment-specific columns
 * - Assessment columns are blank (for manual RTO entry)
 */
export class MaritimeExcelService {
  private outputDir: string;
  private defaultFilename: string;

  // Define sheet configurations - matching the example file structure exactly
  // Note: Assessment column names are RTO-specific and can be customized per organization
  private readonly SHEET_CONFIGS = [
    {
      name: 'ESS Mapping',
      hasAMPAConditions: true,
      mappingCountLabel: 'Mapping Count',
      // Filter: Emergency / Survival units (MARF*)
      filterPrefixes: ['MARF'],
      assessmentColumns: [
        'Sea Survival Knowledge',
        'Fire Fighting at Sea Knowledge',
        'Fire Fighting at Sea - Classroom',
        'Sea Survival - Pool -Performance',
        'Fire fighting at Sea - The Lea - Performance '
      ]
    },
    {
      name: 'Deck Mapping',
      hasAMPAConditions: true,
      mappingCountLabel: 'Mapping Count',
      // Filter: Deck operations (MARC, MARJ, MARI, MARK, MARN)
      filterPrefixes: ['MARC', 'MARJ', 'MARI', 'MARK', 'MARN'],
      assessmentColumns: [
        'Knowledge Coxswain Deck ',
        'Seamanship Knowledge ',
        'Watchkeeping (Open book)',
        'Watchkeeping (Closed book)',
        'Vessel',
        'Classroom',
        'Readiness for assessment'
      ]
    },
    {
      name: 'Navigation Mapping',
      hasAMPAConditions: true,
      mappingCountLabel: 'Mapping Count',
      // Filter: Navigation (MARH*)
      filterPrefixes: ['MARH'],
      assessmentColumns: [
        'Symbols, Abbreviation, ENA, and Weather',
        'Passage Plan',
        'Vessel Passage'
      ]
    },
    {
      name: 'Engineering Mapping',
      hasAMPAConditions: true,
      mappingCountLabel: 'Mapping Count',
      // Filter: Engineering (MARB*)
      filterPrefixes: ['MARB'],
      assessmentColumns: [
        'Engineering',
        'Engineering Vessel',
        'Readiness for Assessment',
        'Work shop '
      ]
    },
    {
      name: 'LROCP Mapping',
      hasAMPAConditions: false,
      mappingCountLabel: 'Mapping Count',
      // Filter: Long Range Operator Certificate of Proficiency (MARO*, MARL*)
      filterPrefixes: ['MARO', 'MARL'],
      assessmentColumns: [
        'Learners workbook question',
        'Workbook Classroom Activity',
        'Workbook Practical assessment '
      ]
    },
    {
      name: 'DMLA',
      hasAMPAConditions: false,
      mappingCountLabel: 'Mapping Count',
      // Filter: Diploma / Advanced level - remaining MAR units not in other sheets
      filterPrefixes: ['MAR'],
      assessmentColumns: [
        'Stability',
        'Machinery',
        'Machinery Practical',
        'Stability Practical',
        'Ropework'
      ]
    },
    {
      name: 'Assessment Conditions',
      hasAMPAConditions: false,
      mappingCountLabel: 'Mapping Count',
      filterPrefixes: ['MAR'],
      assessmentColumns: []
    },
    {
      name: 'GPH-Not Delivered',
      hasAMPAConditions: false,
      mappingCountLabel: 'Mapping count',  // Note: lowercase 'count' in example
      filterPrefixes: [], // No filter - for manually tracked units
      assessmentColumns: [
        'Column1',
        'Column2',
        'Column3',
        'Column4',
        'Column5'
      ]
    }
  ];

  constructor(outputDir: string = 'data', defaultFilename: string = 'UnitsData.xlsx') {
    this.outputDir = outputDir;
    this.defaultFilename = defaultFilename;
  }

  /**
   * Parse text into individual lines for PE/KE sections
   */
  private parseTextToLines(text: string): string[] {
    if (!text) return [];

    // Split and normalize bullet markers, trim whitespace
    const rawLines = text.split('\n').map(l => l.trim());

    const lines: string[] = [];
    for (const raw of rawLines) {
      if (!raw) continue;

      // Skip common preamble/header lines (end with ':' and are short headings)
      // e.g., "Items:", "Knowledge of:", "Evidence of ability to:"
      const isHeaderLine = /:$/u.test(raw) && raw.length <= 40 && !/^[\-\*•·]/u.test(raw);
      if (isHeaderLine) continue;

      // Normalize leading bullets like '-', '*', '•', '◦' and extra spaces
      const cleaned = raw.replace(/^[\s•◦\-*]+/, '').trim();
      if (cleaned.length === 0) continue;
      lines.push(cleaned);
    }

    return lines;
  }

  /**
   * Generate data rows for a unit
   * Elements get sequential numbering (1, 2, 3, ...) in Column B
   * Performance Evidence and Knowledge Evidence do NOT get numbered
   * PE/KE with multiple items are consolidated into ONE row with bullet-prefixed text (expanding row height)
   */
  private generateUnitRows(unit: Uoc, hasAMPAConditions: boolean, assessmentColumnCount: number): any[][] {
    const rows: any[][] = [];
    const fullUnitName = `${unit.code} ${unit.title}`;
    let elementCounter = 0;

    const capitalizeLead = (text: string): string => {
      if (!text) return text;
      return text.replace(/^[a-z]/, c => c.toUpperCase());
    };

    // Light sentence capitalization: after period + space lowercase letter => uppercase
    const capitalizeSentences = (text: string): string => {
      return text
        .replace(/(^|[\.\?\!]\s+)([a-z])/g, (_m, prefix, char) => prefix + char.toUpperCase());
    };

    // Helper to append a row with common trailing blank columns
    const appendRow = (base: any[]) => {
      if (hasAMPAConditions) base.push(undefined); // leave truly blank
      base.push(undefined); // Mapping Count (formula later)
      for (let i = 0; i < assessmentColumnCount; i++) base.push(undefined);
      rows.push(base);
    };

    // 1. Performance Criteria rows (with numbered elements)
    if (unit.elements && unit.elements.length > 0) {
      for (const element of unit.elements) {
        let elementHeading = element.element;
        if (elementHeading && elementHeading.match(/^\d+\.\d+$/)) elementHeading = '';
        if (elementHeading === 'Elements' || elementHeading === 'Performance Criteria') elementHeading = '';
        if (elementHeading) {
          elementCounter++;
          elementHeading = `${elementCounter}. ${elementHeading.replace(/^\d+\.\s*/, '')}`;
        }
        if (element.performanceCriteria && element.performanceCriteria.length > 0) {
          for (const pc of element.performanceCriteria) {
            if (pc === 'Performance Criteria' || pc === 'Elements') continue;
            const pcMatch = pc.match(/^(\d+\.\d+)\s+(.+)$/);
            const pcNumber = pcMatch ? pcMatch[1] : '';
            const pcText = pcMatch ? pcMatch[2] : pc;
            if (!pcNumber) continue;
            const pcClean = capitalizeLead(capitalizeSentences(pcText));
            appendRow([
              fullUnitName,
              elementHeading || '',
              pcNumber,
              pcClean
            ]);
          }
        }
      }
    }

    // Grouping logic for Performance / Knowledge Evidence
    const groupEvidence = (raw: string): { parent: string; children: string[] }[] => {
      const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const groups: { parent: string; children: string[] }[] = [];
      let current: { parent: string; children: string[] } | null = null;

      const cleanTail = (t: string) => t
        .replace(/\s*(?:including|includes|and):\s*$/i, '')
        .replace(/\s*:\s*$/,'')
        .trim();

      for (const lineRaw of lines) {
        let line = lineRaw;
        // Determine bullet level: '•' top-level, '◦' child; '-' treat as child if after a parent header
        const isTopBullet = /^•\s*/.test(line);
        const isChildBullet = /^◦\s*/.test(line) || (/^-\s*/.test(line) && !!current);
        if (isTopBullet) {
          const parentText = cleanTail(line.replace(/^•\s*/, ''));
          current = { parent: parentText, children: [] };
          // Deduplicate adjacent identical parents
          if (groups.length === 0 || groups[groups.length - 1].parent !== current.parent) {
            groups.push(current);
          }
          continue;
        }
        if (isChildBullet) {
          const childText = line.replace(/^(?:◦|-)\s*/, '').trim();
          if (!current) {
            current = { parent: childText, children: [] };
            groups.push(current);
          } else {
            // Avoid duplicate adjacent children
            const last = current.children[current.children.length - 1];
            if (childText && childText !== last) current.children.push(childText);
          }
          continue;
        }

        // Non-bullet line -> new parent
        const parentText = cleanTail(line);
        if (!current || current.parent !== parentText) {
          current = { parent: parentText, children: [] };
          groups.push(current);
        }
      }
      return groups;
    };

    // 2. Performance Evidence rows (P1, P2...) - each parent becomes a row; children bullet items stay inside same cell below
    if (unit.performanceEvidence) {
      const groups = groupEvidence(unit.performanceEvidence);
      groups.forEach((g, idx) => {
        let parentLine = capitalizeLead(capitalizeSentences(g.parent));
        const text = g.children.length > 0
          ? `"${parentLine} and:\n${g.children.map(c => `-\t${c}`)}"`.replace(/,/g,'\n')
          : `"${parentLine}"`;
        appendRow([
          fullUnitName,
          'Performance Evidence',
          `P${idx + 1 + 0}`, // start at P1
          text
        ]);
      });
    }

    // 3. Knowledge Evidence rows (K1, K2...) similar grouping
    if (unit.knowledgeEvidence) {
      const groups = groupEvidence(unit.knowledgeEvidence);
      groups.forEach((g, idx) => {
        let parentLine = capitalizeLead(capitalizeSentences(g.parent));
        const text = g.children.length > 0
          ? `"${parentLine} includes:\n${g.children.map(c => `-\t${c}`)}"`.replace(/,/g,'\n')
          : `"${parentLine}"`;
        appendRow([
          fullUnitName,
          'Knowledge Evidence',
          `K${idx + 1}`,
          text
        ]);
      });
    }

    return rows;
  }

  /**
   * Format Knowledge Evidence lines adding letter suffixes for sub-points beneath a numbered main point.
   * Logic:
   * - A line starting with a numbered list marker (e.g. "7." or "7)") becomes base: K7 (main)
   * - Subsequent bullet/indented lines until the next numbered marker become K7a, K7b, ...
   * - If there are only bullet lines (no numbering) they become sequential K1, K2...
   */
  private formatKnowledgeEvidenceLines(lines: string[]): { code: string; text: string }[] {
    const results: { code: string; text: string }[] = [];
    let currentMainIndex = 0;
    let currentBaseNumber: number | null = null;
    let suffixCounter = 0;

    const numberedPattern = /^\s*(\d+)\s*[.)]/; // Matches '7.' or '7)' style
    const bulletPattern = /^\s*[-*•·]/; // Common bullet characters

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;

      const numberedMatch = line.match(numberedPattern);
      if (numberedMatch) {
        // New main point
        currentMainIndex = parseInt(numberedMatch[1], 10);
        currentBaseNumber = currentMainIndex;
        suffixCounter = 0;
        // Strip the leading numbering for text cleanliness
        const cleaned = line.replace(numberedPattern, '').trim();
        results.push({ code: `K${currentMainIndex}`, text: cleaned });
        continue;
      }

      const isBullet = bulletPattern.test(line);
      if (isBullet && currentBaseNumber !== null) {
        // Sub-point of current base number
        const cleaned = line.replace(bulletPattern, '').trim();
        const suffixLetter = String.fromCharCode('a'.charCodeAt(0) + suffixCounter);
        results.push({ code: `K${currentBaseNumber}${suffixLetter}`, text: cleaned });
        suffixCounter++;
        continue;
      }

      // Fallback: treat as a new standalone main point with sequential numbering
      currentMainIndex = (currentMainIndex || results.length) + 1;
      currentBaseNumber = currentMainIndex;
      suffixCounter = 0;
      results.push({ code: `K${currentMainIndex}`, text: line });
    }

    // If there were no explicit numbered lines at all (only bullets or plain lines), renumber sequentially K1..Kn
    const hasExplicitNumbering = results.some(r => /^K\d+$/.test(r.code));
    const anyWithSuffix = results.some(r => /[a-z]$/.test(r.code));
    if (!hasExplicitNumbering || (!anyWithSuffix && results.every(r => /^K\d+$/.test(r.code)))) {
      // Simplify: sequential K1..Kn
      return results.map((r, idx) => ({ code: `K${idx + 1}`, text: r.text }));
    }
    return results;
  }

  /**
   * Create two-row header structure with merged cells
   * Row 0: Merged headers for assessment categories
   * Row 1: Actual column names
   */
  private createHeaders(assessmentColumns: string[], hasAMPAConditions: boolean, mappingCountLabel: string): { row0: any[], row1: any[], merges: any[] } {
    // Color constants for header styling (matched to provided screenshot palette approximations)
    const COLORS = {
      headerBlue: '4472C4',           // Dark blue for primary headers
      categoryKnowledge: 'D0CECE',    // Grey for knowledge category
      categoryPerformance: 'FFD966',  // Yellow for performance category
      assessmentFont: '00B050',       // Green font for assessment column names
      borderBlue: '8EA8DB'
    };

    // Row 0: Category headers & top-level base headers (will be merged vertically)
    const row0 = ['Unit', 'Element', 'Criteria/Evidence', 'Performance Criteria'];
    if (hasAMPAConditions) row0.push('AMPA Conditions');
    row0.push(mappingCountLabel);

    // Determine knowledge vs performance counts
    const knowledgeCount = assessmentColumns.filter(col => 
      /knowledge|workbook/i.test(col)
    ).length;
    const performanceCount = assessmentColumns.length - knowledgeCount;

    // Add category header placeholders (merged horizontally later)
    if (knowledgeCount > 0) {
      row0.push('Knowledge Assessment/s');
      for (let i = 1; i < knowledgeCount; i++) row0.push('');
    }
    if (performanceCount > 0) {
      row0.push('Performance Assessment/s');
      for (let i = 1; i < performanceCount; i++) row0.push('');
    }

    // Row 1: Actual column names below categories
    const row1: any[] = new Array(4 + (hasAMPAConditions ? 1 : 0) + 1).fill(''); // leave blank; we will duplicate names for clarity
    // Provide explicit names again for filter usability (Excel filters on second row)
    row1[0] = 'Unit';
    row1[1] = 'Element';
    row1[2] = 'Criteria/Evidence';
    row1[3] = 'Performance Criteria';
    let colPtr = 4;
    if (hasAMPAConditions) {
      row1[colPtr] = 'AMPA Conditions';
      colPtr++;
    }
    row1[colPtr] = mappingCountLabel;
    colPtr++;
    // Assessment column names
    assessmentColumns.forEach((cName, idx) => {
      row1.push(cName);
    });

    // Define merge ranges for the headers
    const merges: any[] = [];
    const baseColumnsCount = 4 + (hasAMPAConditions ? 1 : 0) + 1; // core + AMPA + mapping count
    // Merge vertical for base columns
    for (let c = 0; c < baseColumnsCount; c++) merges.push({ s: { r: 0, c }, e: { r: 1, c } });

    // Horizontal merges for knowledge/performance category headers (row0 only)
    let categoryStart = baseColumnsCount;
    if (knowledgeCount > 0) {
      merges.push({ s: { r: 0, c: categoryStart }, e: { r: 0, c: categoryStart + knowledgeCount - 1 } });
      categoryStart += knowledgeCount;
    }
    if (performanceCount > 0) {
      merges.push({ s: { r: 0, c: categoryStart }, e: { r: 0, c: categoryStart + performanceCount - 1 } });
    }

    return { row0, row1, merges };
  }

  /**
   * Apply styling to the worksheet
   */
  private applyStyles(ws: XLSX.WorkSheet, dataRowCount: number, columnCount: number): void {
    // Header styling constants
    const headerBlue = '4472C4';
    const categoryKnowledge = 'D0CECE';
    const categoryPerformance = 'FFD966';
    const borderBlue = '8EA8DB';
    const assessmentGreen = '00B050';

    // Determine knowledge/performance column spans from row0 values
    const row0Values = [] as string[];
    for (let c = 0; c < columnCount; c++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c });
      row0Values.push(ws[addr] ? (ws[addr] as any).v || '' : '');
    }
    const knowledgeIndexes: number[] = [];
    const performanceIndexes: number[] = [];
    row0Values.forEach((v, idx) => {
      if (v === 'Knowledge Assessment/s') knowledgeIndexes.push(idx);
      if (v === 'Performance Assessment/s') performanceIndexes.push(idx);
    });
    // Expand merged ranges for category styling
    const merged = (ws['!merges'] || []) as any[];
    const categoryCells: { type: 'knowledge' | 'performance'; cells: { r: number; c: number }[] }[] = [];
    merged.forEach(m => {
      if (m.s.r === 0 && m.e.r === 0) {
        const firstVal = ws[XLSX.utils.encode_cell({ r:0, c: m.s.c })]?.v;
        if (firstVal === 'Knowledge Assessment/s' || firstVal === 'Performance Assessment/s') {
          const cells = [] as { r:number; c:number }[];
          for (let c = m.s.c; c <= m.e.c; c++) cells.push({ r:0, c });
          categoryCells.push({ type: firstVal === 'Knowledge Assessment/s' ? 'knowledge' : 'performance', cells });
        }
      }
    });

    // Style row0 (base headers + categories)
    for (let c = 0; c < columnCount; c++) {
      const cellAddr = XLSX.utils.encode_cell({ r: 0, c });
      if (!ws[cellAddr]) continue;
      let fillColor = headerBlue;
      const value = (ws[cellAddr] as any).v;
      if (value === 'Knowledge Assessment/s') fillColor = categoryKnowledge;
      if (value === 'Performance Assessment/s') fillColor = categoryPerformance;
      (ws[cellAddr] as any).s = {
        font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
        fill: { patternType: 'solid', fgColor: { rgb: fillColor } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: {
          top: { style: 'thin', color: { rgb: borderBlue } },
          bottom: { style: 'thin', color: { rgb: borderBlue } },
          left: { style: 'thin', color: { rgb: borderBlue } },
          right: { style: 'thin', color: { rgb: borderBlue } }
        }
      };
    }

    // Style row1 (column names) - assessment columns get green font
    for (let c = 0; c < columnCount; c++) {
      const cellAddr = XLSX.utils.encode_cell({ r: 1, c });
      if (!ws[cellAddr]) continue;
      const isAssessment = c >= columnCount - (ws[cellAddr] ? 0 : 0); // fallback heuristic
      (ws[cellAddr] as any).s = {
        font: { bold: true, sz: 11, color: { rgb: (c >= (4 + 1) ? assessmentGreen : 'FFFFFF') } },
        fill: { patternType: 'solid', fgColor: { rgb: headerBlue } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: {
          top: { style: 'thin', color: { rgb: borderBlue } },
          bottom: { style: 'thin', color: { rgb: borderBlue } },
          left: { style: 'thin', color: { rgb: borderBlue } },
          right: { style: 'thin', color: { rgb: borderBlue } }
        }
      };
    }

    // Style data rows (light borders)
    for (let r = 2; r < dataRowCount + 2; r++) {
      // Check if this row is a separator (column 0 has sentinel value)
      const firstCellAddr = XLSX.utils.encode_cell({ r, c: 0 });
      const firstCellValue = ws[firstCellAddr] ? (ws[firstCellAddr] as any).v : null;
      const isSeparatorRow = firstCellValue === '__UNIT_SEPARATOR__';
      
      for (let c = 0; c < columnCount; c++) {
        const cellAddr = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellAddr]) {
          ws[cellAddr] = { t: 's', v: '' };
        }
        
        if (isSeparatorRow) {
          // Full black row styling for ALL columns
          (ws[cellAddr] as any).s = {
            font: { bold: true, color: { rgb: 'FFFFFF' } },
            fill: { patternType: 'solid', fgColor: { rgb: '000000' } },
            border: {
              top: { style: 'thin', color: { rgb: '000000' } },
              bottom: { style: 'thin', color: { rgb: '000000' } },
              left: { style: 'thin', color: { rgb: '000000' } },
              right: { style: 'thin', color: { rgb: '000000' } }
            },
            alignment: { vertical: 'center', horizontal: 'center' }
          };
          // Clear the sentinel value for cleaner appearance
          if (c === 0) (ws[cellAddr] as any).v = '';
        } else {
          // Normal data cell styling - no borders set here, zebra striping will add them based on row color
          (ws[cellAddr] as any).s = {
            alignment: { vertical: 'top', wrapText: true }
          };
        }
      }
    }
  }

    /**
     * Apply zebra striping row-by-row - alternating blue/white for EACH row (not per unit)
     * Color: RGB(217, 225, 242) = D9E1F2
     * Alignment: Center all columns EXCEPT Performance Criteria (column 3)
     * Skip separator rows (they're already styled black)
     */
    private applyZebraStriping(ws: XLSX.WorkSheet, dataRowCount: number, columnCount: number): void {
      // Alternating colors for each row (white and light blue RGB(217, 225, 242))
      const rowColors = ['FFFFFF', 'D9E1F2']; // white and light blue
    
      for (let r = 2; r < dataRowCount + 2; r++) {
        // Check if this is a separator row (already styled black - skip it)
        const firstCellAddr = XLSX.utils.encode_cell({ r, c: 0 });
        const isSeparatorRow = ws[firstCellAddr] && (ws[firstCellAddr] as any).s?.fill?.fgColor?.rgb === '000000';
        
        if (isSeparatorRow) continue; // Skip separator rows
        
        // Alternate color based on row index
        const bgColor = rowColors[(r - 2) % 2];
        const isBlueRow = bgColor === 'D9E1F2';
      
        for (let c = 0; c < columnCount; c++) {
          const cellAddr = XLSX.utils.encode_cell({ r, c });
        
          // Ensure cell exists
          if (!ws[cellAddr]) {
            ws[cellAddr] = { t: 's', v: '' };
          }
        
          // Preserve existing style and add fill
          const existingStyle = (ws[cellAddr] as any).s || {};
          
          // Column 3 (index 3) is Performance Criteria - left align, others center
          const horizontalAlign = (c === 3) ? 'left' : 'center';
          
          // Determine borders based on row color:
          // Blue rows: only EXTERNAL borders (#8EA8DB) - no left/right borders for internal cells
          // White rows: all borders (#D4D4D4)
          let border;
          if (isBlueRow) {
            // Blue row - only external borders
            border = {
              top: { style: 'thin', color: { rgb: '8EA8DB' } },
              bottom: { style: 'thin', color: { rgb: '8EA8DB' } },
              left: c === 0 ? { style: 'thin', color: { rgb: '8EA8DB' } } : undefined,
              right: c === columnCount - 1 ? { style: 'thin', color: { rgb: '8EA8DB' } } : undefined
            };
          } else {
            // White row - all borders (#D4D4D4)
            border = {
              top: { style: 'thin', color: { rgb: 'D4D4D4' } },
              bottom: { style: 'thin', color: { rgb: 'D4D4D4' } },
              left: { style: 'thin', color: { rgb: 'D4D4D4' } },
              right: { style: 'thin', color: { rgb: 'D4D4D4' } }
            };
          }
          
          (ws[cellAddr] as any).s = {
            ...existingStyle,
            fill: { patternType: 'solid', fgColor: { rgb: bgColor } },
            border,
            alignment: { 
              horizontal: horizontalAlign,
              vertical: 'center',
              wrapText: true
            }
          };
        }
      }
    }

  /**
   * Set column widths
   */
  private setColumnWidthsFromData(ws: XLSX.WorkSheet, allRows: any[][], hasAMPAConditions: boolean, assessmentColumnCount: number): void {
    // Determine column count from headers
    const columnCount = (allRows[1] || []).length;

    // Measure max string length per column over data rows (row index >= 2)
    const maxLen: number[] = new Array(columnCount).fill(0);
    for (let r = 0; r < allRows.length; r++) {
      const row = allRows[r] || [];
      for (let c = 0; c < columnCount; c++) {
        const v = row[c];
        const s = v == null ? '' : String(v);
        // Heuristic: multi-line cells count extra
        const length = Math.max(...s.split('\n').map(part => part.length));
        if (length > maxLen[c]) maxLen[c] = length;
      }
    }

    // Map measured lengths to Excel widths (wch) with per-column min/max caps
    const computeWidth = (len: number, { min, max, factor }: { min: number; max: number; factor: number }) => {
      const w = Math.ceil(len * factor);
      return Math.max(min, Math.min(max, w));
    };

    const cols: { wch: number }[] = [];
    // Base columns
    cols.push({ wch: computeWidth(maxLen[0], { min: 40, max: 80, factor: 0.9 }) }); // Unit
    cols.push({ wch: computeWidth(maxLen[1], { min: 25, max: 60, factor: 0.9 }) }); // Element
    cols.push({ wch: computeWidth(maxLen[2], { min: 10, max: 18, factor: 0.8 }) }); // Criteria/Evidence
    cols.push({ wch: computeWidth(maxLen[3], { min: 50, max: 100, factor: 0.9 }) }); // Performance Criteria
    
    let idx = 4;
    if (hasAMPAConditions) {
      cols.push({ wch: computeWidth(maxLen[idx], { min: 18, max: 40, factor: 0.9 }) }); // AMPA
      idx++;
    }
    cols.push({ wch: computeWidth(maxLen[idx], { min: 8, max: 14, factor: 0.7 }) }); // Mapping Count
    idx++;
    for (let i = 0; i < assessmentColumnCount; i++) {
      cols.push({ wch: computeWidth(maxLen[idx + i], { min: 20, max: 40, factor: 0.85 }) }); // Assessments
    }

    ws['!cols'] = cols;
  }

  /**
   * Create a special Assessment Conditions sheet with simplified structure
   */
  private createAssessmentConditionsSheet(units: Uoc[]): XLSX.WorkSheet {
    const dataRows: any[][] = [];
    
    // Add header
    dataRows.push(['Unit', 'Assessment conditions']);
    
    // Add each unit with its assessment conditions
    for (const unit of units) {
      if (unit.assessmentConditions) {
        dataRows.push([
          `${unit.code} ${unit.title}`,
          unit.assessmentConditions
        ]);
        // Add blank row after each unit (matching template pattern)
        dataRows.push(['', '']);
      }
    }
    
    // Add AMSA Mandated Practical Assessment codes (constant footer)
    dataRows.push(['AMSA Mandated Practical Assessment', 'W= Task mat be complete either in a workshop or on a vessel that meets the requirements of a simulated workplace']);
    dataRows.push(['AMSA Mandated Practical Assessment', 'P= Task must be completed in water (pool, or other safe water)']);
    dataRows.push(['AMSA Mandated Practical Assessment', 'F= Task must be completed on a fire ground']);
    dataRows.push(['AMSA Mandated Practical Assessment', 'S= Task may be completed on an approved simulator where realistic conditions are replicated']);
    dataRows.push(['AMSA Mandated Practical Assessment', 'O= Tasks may be completed by observation']);
    
    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(dataRows);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 60 },  // Unit (wide)
      { wch: 100 }  // Assessment conditions (very wide)
    ];
    
    // Style header row
    for (let c = 0; c < 2; c++) {
      const cellAddr = XLSX.utils.encode_cell({ r: 0, c });
      if (!ws[cellAddr]) continue;
      
      (ws[cellAddr] as any).s = {
        font: { bold: true, sz: 11 },
        fill: { patternType: 'solid', fgColor: { rgb: 'D9E1F2' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } }
        }
      };
    }
    
    // Style data rows
    for (let r = 1; r < dataRows.length; r++) {
      for (let c = 0; c < 2; c++) {
        const cellAddr = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellAddr]) continue;
        
        (ws[cellAddr] as any).s = {
          border: {
            top: { style: 'thin', color: { rgb: 'D3D3D3' } },
            bottom: { style: 'thin', color: { rgb: 'D3D3D3' } },
            left: { style: 'thin', color: { rgb: 'D3D3D3' } },
            right: { style: 'thin', color: { rgb: 'D3D3D3' } }
          },
          alignment: { vertical: 'top', wrapText: true }
        };
      }
    }
    
    // Freeze top row (header)
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    
    // Enable auto filter
    ws['!autofilter'] = { ref: `A1:B${dataRows.length}` };
    
    return ws;
  }

  /**
   * Create a single sheet with the given configuration
   */
  private createSheet(sheetName: string, config: { hasAMPAConditions: boolean, mappingCountLabel: string, assessmentColumns: string[], filterPrefixes?: string[] }, units: Uoc[], usedUnitCodes: Set<string>): XLSX.WorkSheet {
    // Generate headers
    const { row0, row1, merges } = this.createHeaders(
      config.assessmentColumns, 
      config.hasAMPAConditions, 
      config.mappingCountLabel
    );
    
    // Generate data rows for all units
    const dataRows: any[][] = [];
    // Filter units by prefixes (if provided), else include all remaining unused units
    const filteredUnits = units.filter(u => {
      if (!u.code) return false;
      const code = u.code.toUpperCase();
      
      // Skip units already used in other sheets (for specificity - most specific sheet wins)
      if (usedUnitCodes.has(code)) return false;
      
      if (config.filterPrefixes && config.filterPrefixes.length > 0) {
        return config.filterPrefixes.some(pref => code.startsWith(pref));
      }
      // No prefixes provided: include all remaining units
      return true;
    })
    // Alphabetically sort by code
    .sort((a, b) => a.code.localeCompare(b.code));

    // Mark these units as used
    for (let i = 0; i < filteredUnits.length; i++) {
      const unit = filteredUnits[i];
      usedUnitCodes.add(unit.code.toUpperCase());
      
      const unitRows = this.generateUnitRows(
        unit, 
        config.hasAMPAConditions, 
        config.assessmentColumns.length
      );
      dataRows.push(...unitRows);
      
      // Add separator row between units (except after last unit)
      if (i < filteredUnits.length - 1) {
        const totalColumns = 4 + (config.hasAMPAConditions ? 1 : 0) + 1 + config.assessmentColumns.length;
        const separatorRow = Array(totalColumns).fill('');
        separatorRow[0] = '__UNIT_SEPARATOR__'; // Sentinel value for styling
        dataRows.push(separatorRow);
      }
    }

    // Combine headers and data
    const allRows = [row0, row1, ...dataRows];
    
    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(allRows);
    
    // Apply merged cells
    if (merges.length > 0) {
      ws['!merges'] = merges;
    }
    
    // Set column widths (use actual combined rows so widths are measured from header + data)
    const totalColumns = 4 + (config.hasAMPAConditions ? 1 : 0) + 1 + config.assessmentColumns.length;
    this.setColumnWidthsFromData(ws, allRows, config.hasAMPAConditions, config.assessmentColumns.length);
    
    // Apply styles
    this.applyStyles(ws, dataRows.length, totalColumns);
    
    // Apply zebra striping per unit
    this.applyZebraStriping(ws, dataRows.length, totalColumns);
    
    // Freeze top 2 rows (headers)
    ws['!freeze'] = { xSplit: 0, ySplit: 2 };
    
    // Enable auto filter on row 1 (second header row)
    const lastCol = XLSX.utils.encode_col(totalColumns - 1);
    ws['!autofilter'] = { ref: `A2:${lastCol}${dataRows.length + 2}` };

    // Auto-populate Mapping Count with formula counting non-empty assessment cells
    // Logic: COUNTA over assessment column range in each data row.
    // This mirrors manual mapping updates—when assessors fill assessment columns, count updates.
    // Apply template-equivalent Mapping Count formula:
    // ((COLUMNS(TableESS[])) - 6) - (COUNTBLANK(TableESS[[#This Row],[FirstAssess]:[LastAssess]]))
    // We mimic logic without structured table by converting to equivalent COUNTA range but subtract blanks relative to number of assessment columns.
    if (config.assessmentColumns.length > 0) {
      const mappingCountColIndex = config.hasAMPAConditions ? 5 : 4;
      const firstAssessmentColIndex = mappingCountColIndex + 1;
      const lastAssessmentColIndex = mappingCountColIndex + config.assessmentColumns.length;
      for (let i = 0; i < dataRows.length; i++) {
        const r = 2 + i;
        const mappingAddr = XLSX.utils.encode_cell({ r, c: mappingCountColIndex });
        const startAddr = XLSX.utils.encode_cell({ r, c: firstAssessmentColIndex });
        const endAddr = XLSX.utils.encode_cell({ r, c: lastAssessmentColIndex });
        if (!ws[mappingAddr]) (ws as any)[mappingAddr] = { t: 'n' };
        // Equivalent formula: (#assessmentCols) - COUNTBLANK(range)
        (ws[mappingAddr] as any).f = `${config.assessmentColumns.length}-COUNTBLANK(${startAddr}:${endAddr})`;
      }
    }
    
    return ws;
  }

  /**
   * Generate complete workbook with all sheets
   */
  async generateExcel(filename?: string): Promise<string> {
    // Read JSONL data
    const jsonlPath = path.join(this.outputDir, 'uoc.jsonl');
    const fileContent = await fs.readFile(jsonlPath, 'utf-8');
    
    const units: Uoc[] = [];
    const lines = fileContent.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines
      if (!line) continue;
      
      // Strip BOM if present
      const cleanLine = line.replace(/^\uFEFF/, '');
      
      try {
        const unit = JSON.parse(cleanLine);
        units.push(unit);
      } catch (error: any) {
        console.warn(`⚠️  Skipping invalid JSON at line ${i + 1}: ${error.message}`);
      }
    }

  logger.info(`Excel load units=${units.length} path=${jsonlPath}`);

    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Track which units have been used (to avoid duplicates across sheets)
    const usedUnitCodes = new Set<string>();

    // Create each sheet (order matters - more specific filters first)
    for (const config of this.SHEET_CONFIGS) {
  logger.debug(`Create sheet ${config.name}`);
      
      // Special handling for Assessment Conditions sheet
      let ws: XLSX.WorkSheet;
      if (config.name === 'Assessment Conditions') {
        ws = this.createAssessmentConditionsSheet(units);
      } else {
        ws = this.createSheet(config.name, config, units, usedUnitCodes);
      }
      
      XLSX.utils.book_append_sheet(wb, ws, config.name);
    }

    // Write to file
    const outputFilename = filename || this.defaultFilename;
    const outputPath = path.join(this.outputDir, outputFilename);
    
    await fs.mkdir(this.outputDir, { recursive: true });
    XLSX.writeFile(wb, outputPath);

  logger.info(`Excel written ${outputPath} sheets=${this.SHEET_CONFIGS.length} units=${units.length}`);
    
    // Count total rows (using first sheet config as reference)
    let totalRows = 0;
    for (const unit of units) {
      const rows = this.generateUnitRows(
        unit, 
        this.SHEET_CONFIGS[0].hasAMPAConditions, 
        this.SHEET_CONFIGS[0].assessmentColumns.length
      );
      totalRows += rows.length;
    }
  logger.debug(`Rows per sheet approx=${totalRows}`);

    return outputPath;
  }

  /**
   * Create a sheet summarizing hierarchical sections for each unit.
   * Columns: Code, Heading Level, Heading, Paragraphs (joined), List Items (joined).
   */
  createSectionsSheet(units: Uoc[]): XLSX.WorkSheet {
    const header = ['Unit Code', 'Heading Level', 'Heading', 'Paragraphs', 'List Items'];
    const rows: any[][] = [header];
    for (const u of units) {
      if (!u.sections) continue;
      for (const s of u.sections as UocSection[]) {
        const paragraphs = (s.paragraphs || []).join('\n');
        const lists = (s.lists || []).map(list => list.join('; ')).join('\n');
        rows.push([u.code, s.level, s.heading, paragraphs, lists]);
      }
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 14 },
      { wch: 6 },
      { wch: 50 },
      { wch: 80 },
      { wch: 80 }
    ];
    // Style header
    for (let c = 0; c < header.length; c++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c });
      if (ws[addr]) (ws[addr] as any).s = {
        font: { bold: true },
        fill: { patternType: 'solid', fgColor: { rgb: 'D9E1F2' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: '8EA8DB' } },
          bottom: { style: 'thin', color: { rgb: '8EA8DB' } },
          left: { style: 'thin', color: { rgb: '8EA8DB' } },
          right: { style: 'thin', color: { rgb: '8EA8DB' } }
        }
      };
    }
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    ws['!autofilter'] = { ref: `A1:E${rows.length}` };
    return ws;
  }
}
