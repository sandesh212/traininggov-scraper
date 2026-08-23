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

    public async addUnit(unit: Unit, persist: boolean = true): Promise<void> {
        // Update memory for the current request or management session.
        this.uocMap.set(unit.code, unit);

        // Persist only when the caller explicitly requests a database update.
        if (persist) {
            await this.save();
        }
    }

    public async persist(): Promise<void> {
        await this.save();
    }

    public async removeUnit(code: string): Promise<boolean> {
        if (this.uocMap.has(code)) {
            this.uocMap.delete(code);
            await this.save();
            return true;
        }
        return false;
    }

    private async save(): Promise<void> {
        const absolutePath = path.resolve(process.cwd(), this.dataPath);
        const stream = fs.createWriteStream(absolutePath);

        for (const unit of this.uocMap.values()) {
            stream.write(JSON.stringify(unit) + '\n');
        }

        stream.end();
        await new Promise<void>(resolve => stream.on('finish', () => resolve()));
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
            description: raw.description || raw.application || '',
            application: raw.application || '',
            unitSector: raw.unitSector || '',
            modificationHistory: raw.modificationHistory || '',
            foundationSkills: raw.foundationSkills || '',
            elements,
            performanceEvidence: raw.performanceEvidence || '',
            knowledgeEvidence: raw.knowledgeEvidence || '',
            assessmentConditions: raw.assessmentConditions || ''
        };
    }
}
