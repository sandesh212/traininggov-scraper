import XLSX from 'xlsx';
import { Uoc } from '../models/uoc.js';
import { promises as fs } from 'fs';
import * as path from 'path';

export class ExcelExportService {
  private outputDir: string;
  private defaultFilename: string;

  constructor(outputDir: string = 'data', defaultFilename: string = 'UnitsOfCompetency.xlsx') {
    this.outputDir = outputDir;
    this.defaultFilename = defaultFilename;
  }

  async exportToExcel(units: Uoc[], filename?: string, append: boolean = true): Promise<void> {
    const filepath = path.join(this.outputDir, filename || this.defaultFilename);
    
    // Ensure output directory exists
    await fs.mkdir(this.outputDir, { recursive: true });

    let existingRows: any[] = [];
    
    // If append mode and file exists, read existing data
    if (append) {
      try {
        const workbook = XLSX.readFile(filepath);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        existingRows = XLSX.utils.sheet_to_json(worksheet);
        console.log(`📝 Appending to existing file with ${existingRows.length} rows`);
      } catch (error) {
        // File doesn't exist, will create new one
        console.log(`📄 Creating new Excel file`);
      }
    }

    // Create new rows from units
    const newRows: any[] = [];

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

            newRows.push({
              'Unit Code': unit.code,
              'Release': unit.release || '',
              'Unit': `${unit.code} ${unit.title}`,
              'Element': i === 0 ? element.element : '', // Only show element on first PC
              'Criteria/Action': pcNumber,
              'Performance Criteria': pcText,
              'AMPA Conditions': '', // Empty for now
              'Mapping Comment': '', // Empty for now
              'Knowledge/Assessment': '', // Will be filled from KE
              'Performance Evidence': '' // Will be filled from PE
            });
          }
        }
      }

      // Add Knowledge Evidence rows
      if (unit.knowledgeEvidence) {
        const keLines = unit.knowledgeEvidence.split('\n');
        for (const line of keLines) {
          // Remove bullet points and extract text
          const cleanLine = line.replace(/^[•◦\s]+/, '').trim();
          if (cleanLine) {
            newRows.push({
              'Unit Code': unit.code,
              'Release': unit.release || '',
              'Unit': `${unit.code} ${unit.title}`,
              'Element': '',
              'Criteria/Action': '',
              'Performance Criteria': '',
              'AMPA Conditions': '',
              'Mapping Comment': '',
              'Knowledge/Assessment': cleanLine,
              'Performance Evidence': ''
            });
          }
        }
      }

      // Add Performance Evidence rows
      if (unit.performanceEvidence) {
        const peLines = unit.performanceEvidence.split('\n');
        for (const line of peLines) {
          // Remove bullet points and extract text
          const cleanLine = line.replace(/^[•◦\s]+/, '').trim();
          if (cleanLine) {
            newRows.push({
              'Unit Code': unit.code,
              'Release': unit.release || '',
              'Unit': `${unit.code} ${unit.title}`,
              'Element': '',
              'Criteria/Action': '',
              'Performance Criteria': '',
              'AMPA Conditions': '',
              'Mapping Comment': '',
              'Knowledge/Assessment': '',
              'Performance Evidence': cleanLine
            });
          }
        }
      }

      // Add Assessment Conditions if available
      if (unit.assessmentConditions) {
        const acLines = unit.assessmentConditions.split('\n\n');
        for (const line of acLines) {
          const cleanLine = line.replace(/^[•◦\s]+/, '').trim();
          if (cleanLine) {
            newRows.push({
              'Unit Code': unit.code,
              'Release': unit.release || '',
              'Unit': `${unit.code} ${unit.title}`,
              'Element': '',
              'Criteria/Action': '',
              'Performance Criteria': '',
              'AMPA Conditions': cleanLine,
              'Mapping Comment': '',
              'Knowledge/Assessment': '',
              'Performance Evidence': ''
            });
          }
        }
      }
    }

    // Combine existing and new rows
    const allRows = [...existingRows, ...newRows];

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(allRows);

    // Set column widths
    ws['!cols'] = [
      { wch: 15 }, // Unit Code
      { wch: 15 }, // Release
      { wch: 50 }, // Unit
      { wch: 35 }, // Element
      { wch: 12 }, // Criteria/Action
      { wch: 60 }, // Performance Criteria
      { wch: 20 }, // AMPA Conditions
      { wch: 20 }, // Mapping Comment
      { wch: 60 }, // Knowledge/Assessment
      { wch: 60 }  // Performance Evidence
    ];

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Units');

    // Write file
    XLSX.writeFile(wb, filepath);
    
    console.log(`\n📊 Excel file saved: ${filepath}`);
    console.log(`   Previous rows: ${existingRows.length}`);
    console.log(`   New rows added: ${newRows.length}`);
    console.log(`   Total rows: ${allRows.length}`);
  }

  async exportFromJsonl(jsonlPath: string, excelFilename?: string, append: boolean = true): Promise<void> {
    // Read JSONL file
    const content = await fs.readFile(jsonlPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const units: Uoc[] = lines.map(line => JSON.parse(line));

    if (!append) {
      // If not appending, export all units (replace mode)
      await this.exportToExcel(units, excelFilename, false);
      return;
    }

    // In append mode, check which units are already in the Excel file
    const filepath = path.join(this.outputDir, excelFilename || this.defaultFilename);
    const existingUnitCodes = new Set<string>();

    try {
      const workbook = XLSX.readFile(filepath);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const existingRows = XLSX.utils.sheet_to_json(worksheet);
      
      // Extract unit codes from existing rows
      for (const row of existingRows) {
        const unitCell = (row as any)['Unit'];
        if (unitCell) {
          // Extract code from "CODE Title" format
          const match = unitCell.match(/^([A-Z0-9]+)\s/);
          if (match) {
            existingUnitCodes.add(match[1]);
          }
        }
      }
      
      console.log(`📋 Found ${existingUnitCodes.size} existing units in Excel: ${Array.from(existingUnitCodes).join(', ')}`);
    } catch (error: any) {
      // File doesn't exist, all units are new
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
