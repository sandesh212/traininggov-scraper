type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

const levelOrder: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4
};

const envLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
const currentLevel: LogLevel = (['silent','error','warn','info','debug'] as LogLevel[]).includes(envLevel as LogLevel)
  ? envLevel as LogLevel
  : 'info';

function should(level: LogLevel) {
  return levelOrder[level] <= levelOrder[currentLevel];
}

function fmt(level: string, msg: any, extra?: any) {
  const base = `[${new Date().toISOString()}] ${level.toUpperCase()}:`;
  if (extra !== undefined) return base + ' ' + msg + ' ' + (typeof extra === 'string' ? extra : JSON.stringify(extra));
  return base + ' ' + msg;
}

export const logger = {
  level: currentLevel,
  debug: (...args: any[]) => { if (should('debug')) console.log(fmt('debug', args[0], args[1])); },
  info:  (...args: any[]) => { if (should('info'))  console.log(fmt('info', args[0], args[1])); },
  warn:  (...args: any[]) => { if (should('warn'))  console.warn(fmt('warn', args[0], args[1])); },
  error: (...args: any[]) => { if (should('error')) console.error(fmt('error', args[0], args[1])); }
};

export type ErrorType = 'NETWORK' | 'TIMEOUT' | 'PARSE' | 'UNKNOWN';

export function classifyError(e: any): ErrorType {
  if (!e) return 'UNKNOWN';
  const msg = (e.message || String(e)).toLowerCase();
  if (msg.includes('timed out') || msg.includes('timeout')) return 'TIMEOUT';
  if (msg.includes('net::err') || msg.includes('econn') || msg.includes('socket') || msg.includes('epipe')) return 'NETWORK';
  if (msg.includes('parse') || msg.includes('json')) return 'PARSE';
  return 'UNKNOWN';
}
