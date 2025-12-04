import fs from 'fs';
import readline from 'readline';
import path from 'path';

export interface PerformanceCriteria {
  id: string;
  text: string;
}

export interface Element {
  title: string;
  performanceCriteria: PerformanceCriteria[];
}

export interface UnitOfCompetency {
  code: string;
  title: string;
  description?: string;
  elements: Element[];
  performanceEvidence: string;
  knowledgeEvidence: string;
  assessmentConditions: string;
}

export class UocLoader {
  private uocMap: Map<string, UnitOfCompetency> = new Map();
  private dataPath: string;

  constructor(dataPath: string = 'data/uoc.jsonl') {
    this.dataPath = dataPath;
  }

  public async load(): Promise<void> {
    const absolutePath = path.resolve(process.cwd(), this.dataPath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(
        `UoC data file not found at: ${absolutePath}\n\n` +
        `Please ensure the data file exists. You may need to:\n` +
        `1. Run the scraper first: npm run scrape\n` +
        `2. Check that the file path is correct\n` +
        `3. Verify the data directory exists: mkdir -p data`
      );
    }

    try {
      const fileStream = fs.createReadStream(absolutePath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      let lineNumber = 0;
      for await (const line of rl) {
        lineNumber++;
        try {
          if (!line.trim()) continue;
          const raw = JSON.parse(line);
          const uoc = this.transform(raw);
          this.uocMap.set(uoc.code, uoc);
        } catch (e) {
          console.error(
            `Failed to parse line ${lineNumber} in UoC file:\n` +
            `  Line: ${line.substring(0, 100)}...\n` +
            `  Error: ${e instanceof Error ? e.message : String(e)}`
          );
        }
      }
      console.log(`✓ Loaded ${this.uocMap.size} Units of Competency from ${this.dataPath}`);
    } catch (error) {
      throw new Error(
        `Failed to load UoC data from ${absolutePath}:\n` +
        `${error instanceof Error ? error.message : String(error)}\n\n` +
        `Please check that:\n` +
        `1. The file is not corrupted\n` +
        `2. You have read permissions\n` +
        `3. The file contains valid JSONL data`
      );
    }
  }

  public getUnit(code: string): UnitOfCompetency | undefined {
    return this.uocMap.get(code);
  }

  public getAllUnits(): UnitOfCompetency[] {
    return Array.from(this.uocMap.values());
  }

  private transform(raw: any): UnitOfCompetency {
    // Transform raw JSONL structure to our internal interface
    // The raw structure has 'elements' array with 'element' (title) and 'performanceCriteria' (array of strings)

    const elements: Element[] = (raw.elements || []).map((el: any) => {
      const pcs: PerformanceCriteria[] = (el.performanceCriteria || []).map((pcText: string) => {
        // Extract ID if possible (e.g., "1.1 Identify...")
        const match = pcText.match(/^(\d+\.\d+)\s+(.+)/);
        if (match) {
          return { id: match[1], text: match[2] };
        }
        return { id: '', text: pcText };
      });

      // Clean element title (remove number prefix if needed)
      return {
        title: el.element,
        performanceCriteria: pcs
      };
    });

    return {
      code: raw.code,
      title: raw.title,
      description: raw.description, // Might be missing in raw
      elements,
      performanceEvidence: raw.performanceEvidence || '',
      knowledgeEvidence: raw.knowledgeEvidence || '',
      assessmentConditions: raw.assessmentConditions || ''
    };
  }
}
