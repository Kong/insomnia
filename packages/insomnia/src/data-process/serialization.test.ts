import { describe, expect, it } from 'vitest';

import { deserializeError, serializeError } from './serialization';

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
