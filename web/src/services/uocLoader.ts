import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { Unit } from '../types';

export type { Unit }; // Re-export for compatibility

export class UocLoader {
    private uocMap: Map<string, Unit> = new Map();
    private dataPath: string;

    constructor(dataPath: string = 'data/uoc.jsonl') {
        this.dataPath = dataPath;
    }

    public async load(): Promise<void> {
        const absolutePath = path.resolve(process.cwd(), this.dataPath);

        // Ensure directory exists
        const dir = path.dirname(absolutePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        if (!fs.existsSync(absolutePath)) {
            // Create empty file if it doesn't exist
            fs.writeFileSync(absolutePath, '');
            console.log(`Created new UoC data file at: ${absolutePath}`);
            return;
        }

        const fileStream = fs.createReadStream(absolutePath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        this.uocMap.clear();

        for await (const line of rl) {
            try {
                if (!line.trim()) continue;
                const raw = JSON.parse(line);
                const uoc = this.transform(raw);
                this.uocMap.set(uoc.code, uoc);
            } catch (e) {
                console.error('Failed to parse line in UoC file:', e);
            }
        }
        console.log(`Loaded ${this.uocMap.size} Units of Competency.`);
    }

    public getUnit(code: string): Unit | undefined {
        return this.uocMap.get(code);
    }

    public getAllUnits(): Unit[] {
        return Array.from(this.uocMap.values());
    }

    public getLastUpdated(): Date | null {
        const absolutePath = path.resolve(process.cwd(), this.dataPath);
        if (fs.existsSync(absolutePath)) {
            return fs.statSync(absolutePath).mtime;
        }
        return null;
    }

    public async addUnit(unit: Unit): Promise<void> {
        // Update memory
        this.uocMap.set(unit.code, unit);
        // Append to file (thread-safeish for OS) instead of rewriting entire file (race condition prone)
        await this.append(unit);
    }

    public async removeUnit(code: string): Promise<boolean> {
        if (this.uocMap.has(code)) {
            this.uocMap.delete(code);
            await this.rewrite();
            return true;
        }
        return false;
    }

    private async append(unit: Unit): Promise<void> {
        const absolutePath = path.resolve(process.cwd(), this.dataPath);
        const persistenceUnit = this.toPersistence(unit);
        // Use fs.promises.appendFile for non-blocking append
        await fs.promises.appendFile(absolutePath, JSON.stringify(persistenceUnit) + '\n');
    }

    private async rewrite(): Promise<void> {
        const absolutePath = path.resolve(process.cwd(), this.dataPath);
        const stream = fs.createWriteStream(absolutePath);

        for (const unit of this.uocMap.values()) {
            const persistenceUnit = this.toPersistence(unit);
            stream.write(JSON.stringify(persistenceUnit) + '\n');
        }

        stream.end();
        await new Promise<void>(resolve => stream.on('finish', () => resolve()));
    }

    private toPersistence(unit: Unit): any {
        const persistenceUnit: any = { ...unit };

        // Transform elements to string-based format if needed
        if (unit.elements) {
            persistenceUnit.elements = unit.elements.map((el, i) => {
                const pcStrings = el.performanceCriteria.map(pc => {
                    return pc.id ? `${pc.id} ${pc.text}` : pc.text;
                });

                return {
                    element: el.title,
                    performanceCriteria: pcStrings
                };
            });
        }
        return persistenceUnit;
    }

    public async clearAll(): Promise<void> {
        const absolutePath = path.resolve(process.cwd(), this.dataPath);
        const backupPath = `${absolutePath}.bak`;

        if (fs.existsSync(absolutePath)) {
            fs.copyFileSync(absolutePath, backupPath);
            fs.writeFileSync(absolutePath, ''); // Clear file
            this.uocMap.clear();
        }
    }

    public async restore(): Promise<boolean> {
        const absolutePath = path.resolve(process.cwd(), this.dataPath);
        const backupPath = `${absolutePath}.bak`;

        if (fs.existsSync(backupPath)) {
            fs.copyFileSync(backupPath, absolutePath);
            await this.load(); // Reload from restored file
            return true;
        }
        return false;
    }

    private transform(raw: any): Unit {
        // Transform raw JSONL structure to our internal interface
        const elements = (raw.elements || []).map((el: any) => {
            const pcs = (el.performanceCriteria || []).map((pcText: any) => {
                // Handle both string and object formats
                if (typeof pcText === 'object' && pcText.id) {
                    return pcText;
                }

                // Extract ID if possible (e.g., "1.1 Identify...")
                const match = (pcText as string).match(/^(\d+\.\d+)\s+(.+)/);
                if (match) {
                    return { id: match[1], text: match[2] };
                }
                return { id: '', text: pcText };
            });

            return {
                title: el.title || el.element,
                performanceCriteria: pcs
            };
        });

        return {
            code: raw.code,
            title: raw.title,
            url: raw.url,
            status: raw.status,
            release: raw.release,
            description: raw.description || raw.application || '',
            application: raw.application || '',
            unitSector: raw.unitSector || '',
            modificationHistory: raw.modificationHistory || '',
            foundationSkills: raw.foundationSkills || '',
            elements,
            performanceEvidence: raw.performanceEvidence || '',
            knowledgeEvidence: raw.knowledgeEvidence || '',
            assessmentConditions: raw.assessmentConditions || '',
            sections: raw.sections || [],
            lastFetchedAt: raw.lastFetchedAt
        };
    }
}
