import { promises as fs } from "fs";
import path from "path";
import { Uoc } from "../models/uoc.js";

export class ExportService {
  private outDir: string;
  private jsonlPath: string;
  private existingCodes: Set<string>;

  constructor(outDir = "data") {
    this.outDir = outDir;
    this.jsonlPath = path.join(outDir, "uoc.jsonl");
    this.existingCodes = new Set();
  }

  async init() {
    // Create output directory if it doesn't exist
    await fs.mkdir(this.outDir, { recursive: true });
    
    // Load existing unit codes from JSONL file
    try {
      const content = await fs.readFile(this.jsonlPath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      
      for (const line of lines) {
        try {
          const unit = JSON.parse(line);
          if (unit.code) {
            this.existingCodes.add(unit.code);
          }
        } catch (e) {
          // Skip invalid JSON lines
        }
      }
      
      console.log(`📋 Loaded ${this.existingCodes.size} existing units from JSONL`);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.log(`📄 Creating new JSONL file`);
        // Create empty file
        await fs.writeFile(this.jsonlPath, "", 'utf-8');
      } else {
        console.log(`⚠️  Error reading JSONL: ${error.message}`);
      }
    }
  }

  async writeJsonl(item: Uoc) {
    // Check if unit already exists
    if (this.existingCodes.has(item.code)) {
      console.log(`🔄 Updating existing unit: ${item.code}`);
      // Remove old entry and update
      await this.removeUnit(item.code);
    }
    
    // Add to file
    const line = JSON.stringify(item) + "\n";
    await fs.appendFile(this.jsonlPath, line, "utf-8");
    
    // Track this code
    this.existingCodes.add(item.code);
  }

  /**
   * Remove a unit from JSONL file (for updates/overrides)
   */
  private async removeUnit(code: string) {
    try {
      const content = await fs.readFile(this.jsonlPath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      
      // Filter out the old entry
      const updatedLines = lines.filter(line => {
        try {
          const unit = JSON.parse(line);
          return unit.code !== code;
        } catch (e) {
          return true; // Keep invalid lines
        }
      });
      
      // Rewrite file
      await fs.writeFile(this.jsonlPath, updatedLines.join('\n') + '\n', 'utf-8');
    } catch (error) {
      console.log(`⚠️  Could not remove old unit ${code}: ${error}`);
    }
  }
}