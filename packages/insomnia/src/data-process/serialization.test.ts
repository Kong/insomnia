import { describe, expect, it } from 'vitest';

import { deserializeError, deserializeValue, serializeError, serializeValue } from './serialization';

describe('serializeError', () => {
  it('serializes an Error instance', () => {
    const err = new TypeError('bad input');
    const s = serializeError(err);
    expect(s.name).toBe('TypeError');
    expect(s.message).toBe('bad input');
    expect(s.stack).toContain('bad input');
  });

  it('serializes a non-Error value', () => {
    const s = serializeError('string failure');
    expect(s).toEqual({ name: 'Error', message: 'string failure', stack: '' });
  });
});

describe('deserializeError', () => {
  it('reconstructs an Error with name, message, and stack', () => {
    const err = deserializeError({ name: 'RangeError', message: 'out of bounds', stack: 'fake stack' });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('RangeError');
    expect(err.message).toBe('out of bounds');
    expect(err.stack).toBe('fake stack');
  });

  it('roundtrips through serialize → deserialize', () => {
    const original = new Error('roundtrip');
    const restored = deserializeError(serializeError(original));
    expect(restored.name).toBe(original.name);
    expect(restored.message).toBe(original.message);
    expect(restored.stack).toBe(original.stack);
  });
});

describe('serializeValue / deserializeValue', () => {
  it('roundtrips a Buffer', () => {
    const buf = Buffer.from([1, 2, 3]);
    const result = deserializeValue(serializeValue(buf));
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result).toEqual(buf);
  });

  it('roundtrips a Buffer nested in an object', () => {
    const obj = { body: Buffer.from('hello'), meta: { code: 200 } };
    const result = deserializeValue(serializeValue(obj)) as typeof obj;
    expect(Buffer.isBuffer(result.body)).toBe(true);
    expect(result.body.toString()).toBe('hello');
    expect(result.meta.code).toBe(200);
  });

  it('roundtrips a Buffer nested in an array', () => {
    const arr = [Buffer.from('a'), Buffer.from('b')];
    const result = deserializeValue(serializeValue(arr)) as Buffer[];
    expect(Buffer.isBuffer(result[0])).toBe(true);
    expect(result[0].toString()).toBe('a');
    expect(result[1].toString()).toBe('b');
  });

  it('passes through primitives unchanged', () => {
    expect(serializeValue(42)).toBe(42);
    expect(serializeValue('str')).toBe('str');
    expect(serializeValue(null)).toBe(null);
    // @ts-expect-error for testing
    expect(serializeValue()).toBe(undefined);
  });

  it('roundtrips a Date', () => {
    const d = new Date('2024-01-15T12:00:00.000Z');
    const result = deserializeValue(serializeValue(d));
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).toISOString()).toBe(d.toISOString());
  });

  it('roundtrips a Date nested in an object', () => {
    const obj = { expires: new Date('2025-06-01T00:00:00.000Z'), name: 'session' };
    const result = deserializeValue(serializeValue(obj)) as typeof obj;
    expect(result.expires).toBeInstanceOf(Date);
    expect(result.expires.toISOString()).toBe(obj.expires.toISOString());
    expect(result.name).toBe('session');
  });
});
