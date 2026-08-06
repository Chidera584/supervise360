import pino from 'pino';
import util from 'util';

const isProduction = process.env.NODE_ENV === 'production';

const base = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
});

// console.*-compatible wrapper: existing call sites pass multiple loosely-typed arguments
// (e.g. `logger.error('Failed to X:', err)`), which pino's printf-style LogFn signature
// rejects unless the message string has matching %s/%o placeholders. Formatting args the way
// console does keeps every call site's behavior unchanged while still funneling everything
// through pino's level filtering and dev/prod transport.
function format(args: unknown[]): string {
  return args
    .map((a) => (typeof a === 'string' ? a : util.inspect(a, { depth: 4 })))
    .join(' ');
}

export const logger = {
  info: (...args: unknown[]) => base.info(format(args)),
  warn: (...args: unknown[]) => base.warn(format(args)),
  error: (...args: unknown[]) => base.error(format(args)),
  debug: (...args: unknown[]) => base.debug(format(args)),
};
