import { describe, expect, it } from 'vitest';

import { Console, getExistingConsole, getNewConsole } from '../console';

describe('Console', () => {
  it.each(['log', 'warn', 'debug', 'info', 'error'] as const)('%s pushes a single row with the correct prefix', level => {
    const con = new Console();
    con[level]('hello world');

    expect(con.rows).toHaveLength(1);
    expect(con.rows[0].value).toBe(`${level}: hello world`);
    expect(con.rows[0].name).toBe('Text');
    expect(typeof con.rows[0].timestamp).toBe('number');
  });

  it('joins multiple string args with a space', () => {
    const con = new Console();
    con.log('foo', 'bar', 'baz');

    expect(con.rows[0].value).toBe('log: foo bar baz');
  });

  it('JSON.stringifies non-string args', () => {
    const con = new Console();
    const obj = { key: 'value' };
    con.log('message', obj);

    expect(con.rows[0].value).toContain(JSON.stringify(obj, null, 2));
    expect(con.rows[0].value).toBe(`log: message ${JSON.stringify(obj, null, 2)}`);
  });

  it('accumulates rows across multiple calls', () => {
    const con = new Console();
    con.log('one');
    con.warn('two');
    con.error('three');

    expect(con.rows).toHaveLength(3);
  });

  it('clear() throws', () => {
    const con = new Console();
    // @ts-expect-error clear expects a level argument
    expect(() => con.clear()).toThrowError(/currently "clear" is not supported/);
  });

  it('dumpLogsAsArray returns one JSON-stringified entry per row, each parseable', () => {
    const con = new Console();
    con.log('one');
    con.warn('two');

    const dumped = con.dumpLogsAsArray();

    expect(dumped).toHaveLength(2);
    dumped.forEach((entry, index) => {
      expect(entry.endsWith('\n')).toBe(true);
      expect(JSON.parse(entry.trim())).toEqual(con.rows[index]);
    });
  });
});

describe('getExistingConsole / getNewConsole', () => {
  it('getExistingConsole returns the same instance on repeated calls', () => {
    const first = getExistingConsole();
    const second = getExistingConsole();

    expect(first).toBe(second);
  });

  it('getNewConsole returns a fresh, empty Console distinct from the previous instance', () => {
    const previous = getExistingConsole();
    previous.log('should not carry over');

    const fresh = getNewConsole();

    expect(fresh).not.toBe(previous);
    expect(fresh.rows).toEqual([]);
    expect(getExistingConsole()).toBe(fresh);
  });
});
