import type { ConsolaOptions, LogObject, LogType } from 'consola';
import { LogTypes } from 'consola';
import { describe, expect, it, vi } from 'vitest';

vi.mock('is-unicode-supported', () => ({ default: () => true }));

import { FancyReporter } from './fancy-reporter';

const render = (
  input: Partial<LogObject>,
  columns = 0,
  formatOptions: ConsolaOptions['formatOptions'] = {},
) => {
  let stdout = '';
  let stderr = '';
  const sink = (target: 'stdout' | 'stderr') =>
    ({
      write: (chunk: string) => {
        if (target === 'stdout') stdout += chunk;
        else stderr += chunk;
        return true;
      },
      columns,
    }) as unknown as NodeJS.WriteStream;

  const logObj = {
    date: new Date('2026-01-01T12:34:56'),
    args: ['hello'],
    type: 'info',
    level: 3,
    tag: '',
    ...input,
  } as LogObject;
  // toLocaleTimeString is locale-dependent — pin it for stable snapshots.
  vi.spyOn(logObj.date, 'toLocaleTimeString').mockReturnValue('12:34:56 PM');

  new FancyReporter().log(logObj, {
    options: {
      stdout: sink('stdout'),
      stderr: sink('stderr'),
      formatOptions: { date: false, ...formatOptions },
    } as ConsolaOptions,
  });

  // Stack frames are non-deterministic — collapse them so snapshots are stable.
  const normalize = (s: string) => s.replace(/(\n\s{2,}at [^\n]+)+/g, '\n      at <stack-frame>');
  return { stdout: normalize(stdout), stderr: normalize(stderr) };
};

describe('FancyReporter', () => {
  const types = (Object.keys(LogTypes) as LogType[]).filter(t => t !== 'silent' && t !== 'verbose');

  it.each(types)('renders log type: %s', type => {
    expect(render({ type, level: LogTypes[type].level as number, args: [`hello from ${type}`] })).toMatchSnapshot();
  });

  it('renders tag and date in a two-column layout when columns are wide', () => {
    expect(render({ tag: 'cli' }, 120, { date: true })).toMatchSnapshot();
  });

  it('renders tag inline when columns is 0', () => {
    expect(render({ tag: 'cli' })).toMatchSnapshot();
  });

  it('character-formats `backticks` and _underscores_', () => {
    expect(render({ args: ['use `foo` and _bar_ properly'] })).toMatchSnapshot();
  });

  it('preserves additional lines after the first', () => {
    expect(render({ args: ['line one\nline two\nline three'] })).toMatchSnapshot();
  });

  it('formats Error args with stack', () => {
    const err = Object.assign(new Error('boom'), {
      stack: 'Error: boom\n    at foo (/repo/file.ts:1:1)\n    at bar (/repo/file.ts:2:2)',
    });
    expect(render({ type: 'error', level: 0, args: [err] })).toMatchSnapshot();
  });

  it('formats chained Error.cause', () => {
    const inner = Object.assign(new Error('inner'), {
      stack: 'Error: inner\n    at inner (/repo/inner.ts:5:5)',
    });
    const outer = Object.assign(new Error('outer', { cause: inner }), {
      stack: 'Error: outer\n    at outer (/repo/outer.ts:3:3)',
    });
    expect(render({ type: 'error', level: 0, args: [outer] })).toMatchSnapshot();
  });

  it('honors the badge override on the log object', () => {
    expect(render({ badge: true } as Partial<LogObject>)).toMatchSnapshot();
    expect(render({ type: 'error', level: 0, badge: false } as Partial<LogObject>)).toMatchSnapshot();
  });

  it('falls back to logObj.icon for types without a built-in icon', () => {
    expect(render({ type: 'verbose' as LogType, level: 5, icon: '★' } as Partial<LogObject>)).toMatchSnapshot();
  });
});
