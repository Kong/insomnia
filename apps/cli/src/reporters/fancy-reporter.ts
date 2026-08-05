import path from 'node:path';
import { formatWithOptions } from 'node:util';

import type { ConsolaOptions, ConsolaReporter, FormatOptions, LogLevel, LogObject, LogType } from 'consola';
import { type ColorName, colors, getColor } from 'consola/utils';
import fastStringWidth from 'fast-string-width';
import isUnicodeSupported from 'is-unicode-supported';

const TYPE_COLOR_MAP: Partial<Record<LogType, ColorName>> = {
  info: 'cyan',
  fail: 'red',
  success: 'green',
  ready: 'green',
  start: 'magenta',
};

const LEVEL_COLOR_MAP: Partial<Record<LogLevel, ColorName>> = {
  0: 'red',
  1: 'yellow',
};

const unicode = isUnicodeSupported();
const icon = (value: string, fallback: string) => (unicode ? value : fallback);

const TYPE_ICONS: Partial<Record<LogType, string>> = {
  error: icon('✖', '×'),
  fatal: icon('✖', '×'),
  ready: icon('✔', '√'),
  warn: icon('⚠', '‼'),
  info: icon('ℹ', 'i'),
  success: icon('✔', '√'),
  debug: icon('⚙', 'D'),
  trace: icon('→', '→'),
  fail: icon('✖', '×'),
  start: icon('◐', 'o'),
  log: '',
};

function getBgColor(color: ColorName) {
  const bgKey = `bg${color[0].toUpperCase()}${color.slice(1)}` as ColorName;
  return colors[bgKey] ?? colors.bgWhite;
}

function parseStack(stack: string, message: string) {
  const cwd = process.cwd() + path.sep;
  return stack
    .split('\n')
    .splice(message.split('\n').length)
    .map(l => l.trim().replace('file://', '').replace(cwd, ''));
}

function characterFormat(str: string) {
  return str
    .replace(/`([^`]+)`/gm, (_, match: string) => colors.cyan(match))
    .replace(/\s+_([^_]+)_\s+/gm, (_, match: string) => ` ${colors.underline(match)} `);
}

function writeStream(data: string, stream: NodeJS.WriteStream) {
  const write = (stream as NodeJS.WriteStream & { __write?: typeof stream.write }).__write || stream.write;
  return write.call(stream, data);
}

function formatType(logObj: LogObject, isBadge: boolean) {
  const typeColor = TYPE_COLOR_MAP[logObj.type] || LEVEL_COLOR_MAP[logObj.level] || 'gray';

  if (isBadge) {
    return getBgColor(typeColor)(colors.black(` ${logObj.type.toUpperCase()} `));
  }

  const typeIcon =
    typeof TYPE_ICONS[logObj.type] === 'string'
      ? TYPE_ICONS[logObj.type]
      : (logObj as LogObject & { icon?: string }).icon || logObj.type;

  return typeIcon ? getColor(typeColor)(typeIcon) : '';
}

function formatTraceStack(stack: string, message: string, errorLevel = 0) {
  const indent = '  '.repeat(errorLevel + 1);
  return (
    `\n${indent}` +
    parseStack(stack, message)
      .map(
        line =>
          '  ' +
          line
            .replace(/^at +/, match => colors.gray(match))
            .replace(/\((.+)\)/, (_, match: string) => `(${colors.cyan(match)})`),
      )
      .join(`\n${indent}`)
  );
}

function formatError(err: Error & { cause?: unknown }, opts: FormatOptions): string {
  const message = err.message ?? formatWithOptions(opts, err);
  const stack = err.stack
    ? '  '.repeat((opts.errorLevel || 0) + 1) +
      parseStack(err.stack, message).join(`\n${'  '.repeat((opts.errorLevel || 0) + 1)}`)
    : '';
  const level = opts.errorLevel || 0;
  const causedPrefix = level > 0 ? `${'  '.repeat(level)}[cause]: ` : '';
  const causedError = err.cause
    ? '\n\n' + formatError(err.cause as Error & { cause?: unknown }, { ...opts, errorLevel: level + 1 })
    : '';
  return causedPrefix + message + '\n' + stack + causedError;
}

function formatArgs(args: unknown[], opts: FormatOptions) {
  const formattedArgs = args.map(arg => {
    if (arg && typeof arg === 'object' && 'stack' in arg && typeof (arg as Error).stack === 'string') {
      return formatError(arg as Error & { cause?: unknown }, opts);
    }
    return arg;
  });
  return formatWithOptions(opts, ...formattedArgs);
}

function formatLogObj(logObj: LogObject, opts: FormatOptions) {
  const [message, ...additional] = formatArgs(logObj.args, opts).split('\n');
  const coloredDate = opts.date ? colors.gray(logObj.date.toLocaleTimeString()) : '';
  const isBadge = (logObj.badge as boolean | undefined) ?? logObj.level < 2;
  const type = formatType(logObj, isBadge);
  const tag = logObj.tag ? colors.gray(logObj.tag) : '';
  const join = (parts: unknown[]) => parts.filter(Boolean).join(' ');

  const left = join([type, characterFormat(message)]);
  const right = join(opts.columns ? [tag, coloredDate] : [tag]);
  const space = (opts.columns || 0) - fastStringWidth(left) - fastStringWidth(right) - 2;

  let line =
    space > 0 && (opts.columns || 0) >= 80
      ? left + ' '.repeat(space) + right
      : (right ? `${colors.gray(`[${right}]`)} ` : '') + left;

  line += characterFormat(additional.length > 0 ? '\n' + additional.join('\n') : '');

  if (logObj.type === 'trace') {
    const err = new Error('Trace: ' + logObj.message);
    line += formatTraceStack(err.stack || '', err.message);
  }

  return isBadge ? '\n' + line + '\n' : line;
}

export class FancyReporter implements ConsolaReporter {
  log(logObj: LogObject, ctx: { options: ConsolaOptions }) {
    const line = formatLogObj(logObj, {
      columns: (ctx.options.stdout as NodeJS.WriteStream | undefined)?.columns || 0,
      ...ctx.options.formatOptions,
    });

    return writeStream(
      line + '\n',
      logObj.level < 2
        ? (ctx.options.stderr as NodeJS.WriteStream) || process.stderr
        : (ctx.options.stdout as NodeJS.WriteStream) || process.stdout,
    );
  }
}
