import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), 'analysis.log');

class Logger {
    private static instance: Logger;

    private constructor() {
        // Clear log on startup or create if not exists
        // fs.writeFileSync(LOG_FILE, `=== Log Started at ${new Date().toISOString()} ===\n`);
    }

    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    public clear() {
        try {
            fs.writeFileSync(LOG_FILE, `=== New Analysis Started at ${new Date().toISOString()} ===\n`);
        } catch (e) {
            console.error('Failed to clear log file:', e);
        }
    }

    public log(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: any) {
        const timestamp = new Date().toISOString();
        const dataStr = data ? `\nData: ${JSON.stringify(data, null, 2)}` : '';
        const logEntry = `[${timestamp}] [${level}] ${message}${dataStr}\n`;

        // Write to file
        try {
            fs.appendFileSync(LOG_FILE, logEntry);
        } catch (e) {
            console.error('Failed to write to log file:', e);
        }

        // Also log to console for immediate feedback
        if (level === 'ERROR') console.error(message, data || '');
        else if (level === 'WARN') console.warn(message, data || '');
        else console.log(message, data || '');
    }

    public info(message: string, data?: any) { this.log('INFO', message, data); }
    public warn(message: string, data?: any) { this.log('WARN', message, data); }
    public error(message: string, data?: any) { this.log('ERROR', message, data); }
    public debug(message: string, data?: any) { this.log('DEBUG', message, data); }
}

export const logger = Logger.getInstance();
