import { promises as fs } from "fs";
import path from "path";
import { Uoc } from "../models/uoc.js";
import { logger } from '../utils/logger.js';

export class ExportService {
  private outDir: string;
  private jsonlPath: string;
  private existingCodes: Set<string>;
  private unitsDir: string;
  private errorLogPath: string;

  constructor(outDir = "data") {
    this.outDir = outDir;
    this.jsonlPath = path.join(outDir, "uoc.jsonl");
    this.existingCodes = new Set();
    this.unitsDir = path.join(this.outDir, 'units');
    this.errorLogPath = path.join(this.outDir, 'error-log.json');
  }

  async init() {
  // Create output directory & subdirs
  await fs.mkdir(this.outDir, { recursive: true });
  await fs.mkdir(this.unitsDir, { recursive: true });
    
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
      
  logger.debug(`Loaded existing units ${this.existingCodes.size}`);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
  logger.info('Creating new uoc.jsonl');
        // Create empty file
        await fs.writeFile(this.jsonlPath, "", 'utf-8');
      } else {
  logger.warn(`Read jsonl error ${error.message}`);
      }
    }
  }

  async writeJsonl(item: Uoc) {
    // Check if unit already exists
    if (this.existingCodes.has(item.code)) {
  logger.debug(`Update unit ${item.code}`);
      // Remove old entry and update
      await this.removeUnit(item.code);
    }
    
    // Add to file
    const line = JSON.stringify(item) + "\n";
    await fs.appendFile(this.jsonlPath, line, "utf-8");
    
    // Track this code
    this.existingCodes.add(item.code);

    // Also write structured per-unit JSON for caching / reuse
    const unitPath = path.join(this.unitsDir, `${item.code}.json`);
    await fs.writeFile(unitPath, JSON.stringify(item, null, 2), 'utf-8');
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
      logger.warn(`Remove old unit ${code} failed ${error}`);
    }
  }

  async logError(entry: {
    code?: string;
    url?: string;
    errorType: string;
    message: string;
    stack?: string;
  }) {
    let payload: any = {
      timestamp: new Date().toISOString(),
      errors: [] as any[]
    };
    try {
      const existing = await fs.readFile(this.errorLogPath, 'utf-8');
      if (existing.trim()) {
        payload = JSON.parse(existing);
        if (!Array.isArray(payload.errors)) payload.errors = [];
      }
    } catch { /* ignore */ }
    payload.errors.push(entry);
    // Keep file compact: cap at last 500 errors
    if (payload.errors.length > 500) {
      payload.errors = payload.errors.slice(-500);
    }
    await fs.writeFile(this.errorLogPath, JSON.stringify(payload, null, 2), 'utf-8');
    logger.debug(`Logged error ${entry.errorType} ${entry.url || entry.code || ''}`);
  }
}