import { describe, it, expect } from 'vitest';
import { MaritimeExcelService } from '../src/services/maritimeExcelService.js';
import { Uoc } from '../src/models/uoc.js';
import XLSX from 'xlsx-js-style';

// Minimal synthetic UOC fixture
const sampleUnit: any = {
  code: 'TEST001',
  title: 'Sample Unit Title',
  url: 'http://example.com/TEST001',
  elements: [
    {
      element: 'Sample Element',
      performanceCriteria: [
        '1.1 Perform action',
        '1.2 Perform another action'
      ]
    }
  ],
  performanceEvidence: 'Bullet one\nBullet two',
  knowledgeEvidence: 'Fact one\nFact two'
};

// Helper to create test unit
const createTestUnit = (code: string): Uoc => ({
  code,
  title: `Test Unit ${code}`,
  url: `https://training.gov.au/Training/Details/${code}`,
  status: 'Current',
  release: '1',
  elements: [
    {
      element: '1. Test Element One',
      performanceCriteria: [
        '1.1 First performance criterion',
        '1.2 Second performance criterion'
      ]
    }
  ],
  performanceEvidence: 'Evidence of ability to:\n- perform task A\n- perform task B',
  knowledgeEvidence: 'Knowledge of:\n- concept X',
  assessmentConditions: 'Assessment must be conducted in workplace.',
  supersededBy: null,
  supersedes: null,
  lastFetchedAt: new Date().toISOString()
});

describe('MaritimeExcelService', () => {
  describe('Mapping Count Formulas', () => {
    it('inserts SUMPRODUCT formula into Mapping Count column for each data row', () => {
      const service = new MaritimeExcelService('data', 'Test.xlsx');
      const config = {
        hasAMPAConditions: true,
        mappingCountLabel: 'Mapping Count',
        assessmentColumns: ['Assess A', 'Assess B', 'Assess C']
      };

      // Access private method via cast (runtime allows it)
      const usedCodes = new Set<string>();
      const ws: XLSX.WorkSheet = (service as any).createSheet('Test', config, [sampleUnit], usedCodes);

      // Determine expected positions
      // Row indices: 0 & 1 are headers, first data row is r=2 (zero-based)
      // Column indices: 0 Unit,1 Element,2 Criteria/Evidence,3 Performance Criteria,4 AMPA,5 Mapping Count,6..8 assessment columns
      const mappingCountCol = 5;

      // With new consolidated format: PC rows (2) + 1 PE row + 1 KE row = 4 total data rows
      const pcCount = sampleUnit.elements[0].performanceCriteria.length; // 2
      const peRowCount = sampleUnit.performanceEvidence ? 1 : 0; // 1 consolidated row
      const keRowCount = sampleUnit.knowledgeEvidence ? 1 : 0; // 1 consolidated row
      const totalDataRows = pcCount + peRowCount + keRowCount; // 4

      for (let i = 0; i < totalDataRows; i++) {
        const sheetRowNumber = 2 + i; // zero-based
        const addr = XLSX.utils.encode_cell({ r: sheetRowNumber, c: mappingCountCol });
        const cell: any = ws[addr];
        expect(cell, `Mapping Count cell missing at row index ${sheetRowNumber}`).toBeTruthy();
        expect(cell.f, `Expected SUMPRODUCT formula at ${addr}`).toMatch(/^SUMPRODUCT\(--\(\([A-Z]+\d+:[A-Z]+\d+<>""\)\*\( [A-Z]+\d+:[A-Z]+\d+<>0\)\)\)$/);
        // Specifically should reference G..I for this config (note: space before second range)
        const rowOneBased = sheetRowNumber + 1; // convert to Excel row number
        expect(cell.f).toBe(`SUMPRODUCT(--((G${rowOneBased}:I${rowOneBased}<>"")*( G${rowOneBased}:I${rowOneBased}<>0)))`);
      }
    });

    it('adjusts formula range when hasAMPAConditions is false', () => {
      const service = new MaritimeExcelService('data', 'Test.xlsx');
      const config = {
        hasAMPAConditions: false,
        mappingCountLabel: 'Mapping Count',
        assessmentColumns: ['Assess A', 'Assess B']
      };

      const usedCodes = new Set<string>();
      const ws: XLSX.WorkSheet = (service as any).createSheet('Test', config, [sampleUnit], usedCodes);

      // Without AMPA: 0 Unit, 1 Element, 2 Criteria/Evidence, 3 Performance Criteria, 4 Mapping Count, 5..6 assessment
      const mappingCountCol = 4;
      const addr = XLSX.utils.encode_cell({ r: 2, c: mappingCountCol });
      const cell: any = ws[addr];
      
      expect(cell).toBeTruthy();
      expect(cell.f).toBe(`SUMPRODUCT(--((F3:G3<>"")*( F3:G3<>0)))`);
    });
  });

  describe('Row Generation', () => {
    it('generates PC rows with correct numbering', () => {
      const service = new MaritimeExcelService('data', 'Test.xlsx');
      const unit = createTestUnit('ROW001');
      const rows = (service as any).generateUnitRows(unit, true, 3);

      // Find PC rows
      const pcRows = rows.filter((r: any[]) => r[2].match(/^\d+\.\d+$/));
      expect(pcRows.length).toBe(2);
      expect(pcRows[0][2]).toBe('1.1');
      expect(pcRows[1][2]).toBe('1.2');
      // Element should be numbered
      expect(pcRows[0][1]).toMatch(/^1\./);
    });

    it('generates grouped Performance Evidence rows with numbering and bullet children inside parent row', () => {
      const service = new MaritimeExcelService('data', 'Test.xlsx');
      const unit = createTestUnit('ROW002');
      const rows = (service as any).generateUnitRows(unit, true, 3);

      const peRows = rows.filter((r: any[]) => r[1] === 'Performance Evidence');
      // Single grouped parent with bullets under it (P1)
      expect(peRows.length).toBe(1);
      expect(peRows[0][2]).toBe('P1');
      expect(peRows[0][3]).toContain('-\tperform task A');
      expect(peRows[0][3]).toContain('-\tperform task B');
    });

    it('generates grouped Knowledge Evidence rows with numbering and bullet children inside parent row', () => {
      const service = new MaritimeExcelService('data', 'Test.xlsx');
      const unit = createTestUnit('ROW003');
      const rows = (service as any).generateUnitRows(unit, true, 3);

      const keRows = rows.filter((r: any[]) => r[1] === 'Knowledge Evidence');
      expect(keRows.length).toBe(1);
      expect(keRows[0][2]).toBe('K1');
      expect(keRows[0][3]).toContain('-\tconcept X');
    });

    it('handles units with no performance or knowledge evidence', () => {
      const service = new MaritimeExcelService('data', 'Test.xlsx');
      const unit: Uoc = {
        code: 'NOEV',
        title: 'No Evidence',
        url: 'https://test.com',
        elements: [
          {
            element: '1. Element',
            performanceCriteria: ['1.1 Criterion']
          }
        ],
        supersededBy: null,
        supersedes: null,
        lastFetchedAt: new Date().toISOString()
      };
      
      const rows = (service as any).generateUnitRows(unit, true, 3);
      
      // Should only have PC rows
      expect(rows.length).toBe(1);
      expect(rows[0][2]).toBe('1.1');
    });
  });

  describe('Header Generation', () => {
    it('creates two-row headers with correct columns', () => {
      const service = new MaritimeExcelService('data', 'Test.xlsx');
      const result = (service as any).createHeaders(['Test A', 'Test B'], true, 'Mapping Count');
      
      expect(result.row1).toContain('Unit');
      expect(result.row1).toContain('Element');
      expect(result.row1).toContain('Criteria/Evidence');
      expect(result.row1).toContain('Performance Criteria');
      expect(result.row1).toContain('AMPA Conditions');
      expect(result.row1).toContain('Mapping Count');
      expect(result.row1).toContain('Test A');
      expect(result.row1).toContain('Test B');
    });

    it('omits AMPA Conditions column when hasAMPAConditions is false', () => {
      const service = new MaritimeExcelService('data', 'Test.xlsx');
      const result = (service as any).createHeaders(['Test A'], false, 'Mapping Count');
      
      expect(result.row1).not.toContain('AMPA Conditions');
      expect(result.row1).toContain('Mapping Count');
    });

    it('creates vertical merges for base columns', () => {
      const service = new MaritimeExcelService('data', 'Test.xlsx');
      const result = (service as any).createHeaders(['Test A', 'Test B'], true, 'Mapping Count');
      
      // Should have vertical merges for first 6 columns
      const verticalMerges = result.merges.filter((m: any) => m.s.c === m.e.c && m.s.r === 0 && m.e.r === 1);
      expect(verticalMerges.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe('Text Parsing', () => {
    it('parses bulleted lists into separate lines (skipping preamble)', () => {
      const service = new MaritimeExcelService('data', 'Test.xlsx');
      const text = 'Items:\n- item one\n- item two\n- item three';
      const lines = (service as any).parseTextToLines(text);
      
      // Should skip "Items:" preamble, parse 3 items
      expect(lines.length).toBe(3);
      expect(lines[0]).toContain('item one');
      expect(lines[2]).toContain('item three');
    });

    it('handles plain text without bullets', () => {
      const service = new MaritimeExcelService('data', 'Test.xlsx');
      const text = 'Single line of text';
      const lines = (service as any).parseTextToLines(text);
      
      expect(lines.length).toBe(1);
      expect(lines[0]).toBe(text);
    });
  });
});
