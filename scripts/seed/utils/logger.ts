/**
 * Simple structured logger for seed scripts.
 * Writes to stdout with timestamps and source tags.
 */

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const COLORS: Record<LogLevel, string> = {
  info: '\x1b[36m',   // cyan
  warn: '\x1b[33m',   // yellow
  error: '\x1b[31m',  // red
  debug: '\x1b[90m',  // gray
};
const RESET = '\x1b[0m';

let verboseMode = false;

export function setVerbose(verbose: boolean): void {
  verboseMode = verbose;
}

function formatTime(): string {
  return new Date().toISOString().slice(11, 19);
}

function log(level: LogLevel, source: string, message: string, data?: Record<string, unknown>): void {
  if (level === 'debug' && !verboseMode) return;

  const color = COLORS[level];
  const prefix = `${color}[${formatTime()}] [${level.toUpperCase()}] [${source}]${RESET}`;
  const suffix = data ? ` ${JSON.stringify(data)}` : '';
  console.log(`${prefix} ${message}${suffix}`);
}

export function createLogger(source: string) {
  return {
    info: (msg: string, data?: Record<string, unknown>) => log('info', source, msg, data),
    warn: (msg: string, data?: Record<string, unknown>) => log('warn', source, msg, data),
    error: (msg: string, data?: Record<string, unknown>) => log('error', source, msg, data),
    debug: (msg: string, data?: Record<string, unknown>) => log('debug', source, msg, data),
  };
}

/** Progress tracker for batch operations */
export function createProgress(source: string, total: number) {
  const logger = createLogger(source);
  let current = 0;
  const startTime = Date.now();

  return {
    tick(label?: string) {
      current++;
      if (current % 50 === 0 || current === total) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const rate = (current / Number(elapsed)).toFixed(1);
        logger.info(`${current}/${total} (${rate}/s, ${elapsed}s elapsed)${label ? ` — ${label}` : ''}`);
      }
    },
    get count() { return current; },
    summary() {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      logger.info(`Done: ${current}/${total} in ${elapsed}s`);
    },
  };
}
