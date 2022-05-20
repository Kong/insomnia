import { describe, expect, it } from '@jest/globals';

import { deterministicStringify } from '../deterministicStringify';

describe('deterministicStringify()', () => {
  it('sorts object keys', () => {
    const result = deterministicStringify({
      c: 'c',
      a: 'a',
      b: 'b',
    });
    expect(result).toBe('{"a":"a","b":"b","c":"c"}');
  });

  it('works recursively', () => {
    const result = deterministicStringify({
      arr: [
        {
          b: 'b',
          a: 'a',
        },
      ],
      obj: {
        obj2: {
          b: 'b',
          a: 'a',
        },
      },
    });
    expect(result).toBe('{"arr":[{"a":"a","b":"b"}],"obj":{"obj2":{"a":"a","b":"b"}}}');
  });

  it('works with strange types', () => {
    const sDate = deterministicStringify(new Date(1541178019555));
    expect(sDate).toBe('"2018-11-02T17:00:19.555Z"');
    const sNull = deterministicStringify(null);
    expect(sNull).toBe('null');
  });

  it('skips non-json types', () => {
    const sFunc = deterministicStringify({
      a: [0, () => null],
      fn: () => null,
    });
    expect(sFunc).toBe('{"a":[0]}');
  });
});
