import { jsonHash } from '../jsonHash';

describe('jsonHash()', () => {
  it('ignore object key order', () => {
    const result1 = jsonHash({ c: 'c', a: 'a', b: 'b' });
    const result2 = jsonHash({ a: 'a', b: 'b', c: 'c' });

    expect(result1.hash).toBe(result2.hash);
    expect(result1.hash).toBe('fed03259e8027e1fab2e2e57b402671bef7f3eb9');
    expect(result2.hash).toBe('fed03259e8027e1fab2e2e57b402671bef7f3eb9');
    expect(result1.content.toString('utf8')).toBe('{"a":"a","b":"b","c":"c"}');
    expect(result2.content.toString('utf8')).toBe('{"a":"a","b":"b","c":"c"}');
  });

  it('works on recursive things', () => {
    const result1 = jsonHash({
      arr: [{ b: 'b', a: 'a' }],
      obj: {
        obj2: { b: 'b', a: 'a' },
      },
    });

    const result2 = jsonHash({
      arr: [{ b: 'b', a: 'a' }],
      obj: {
        obj2: { a: 'a', b: 'b' },
      },
    });

    expect(result1.hash).toBe(result2.hash);
    expect(result1.hash).toBe('7eaaa8a03bada54b403aeada681aad6892a28ab3');
    expect(result2.hash).toBe('7eaaa8a03bada54b403aeada681aad6892a28ab3');
    expect(result1.content.toString('utf8')).toBe(
      '{"arr":[{"a":"a","b":"b"}],"obj":{"obj2":{"a":"a","b":"b"}}}',
    );
    expect(result2.content.toString('utf8')).toBe(
      '{"arr":[{"a":"a","b":"b"}],"obj":{"obj2":{"a":"a","b":"b"}}}',
    );
  });

  it('array order matters', () => {
    const result1 = jsonHash(['c', 'a', 'b']);
    const result2 = jsonHash(['a', 'b', 'c']);

    expect(result1.hash).not.toBe(result2.hash);
    expect(result1.hash).toBe('edf94aad27c26bdcfe7477e0ed68991cbaedf8d8');
    expect(result2.hash).toBe('e13460afb1e68af030bb9bee8344c274494661fa');
    expect(result1.content.toString('utf8')).toBe('["c","a","b"]');
    expect(result2.content.toString('utf8')).toBe('["a","b","c"]');
  });

  it('works with strange types', () => {
    const sDate1 = jsonHash(new Date(1541178019555));
    const sDate2 = jsonHash('2018-11-02T17:00:19.555Z');

    expect(sDate1.hash).toBe(sDate2.hash);
    expect(sDate1.hash).toBe('ec0a18c47fb39de00204c57b5b492fd408394a01');
    expect(sDate2.hash).toBe('ec0a18c47fb39de00204c57b5b492fd408394a01');
    expect(sDate1.content.toString('utf8')).toBe('"2018-11-02T17:00:19.555Z"');
    expect(sDate2.content.toString('utf8')).toBe('"2018-11-02T17:00:19.555Z"');

    const sNull1 = jsonHash(null);
    const sNull2 = jsonHash('null');
    expect(sNull1.hash).not.toBe(sNull2.hash);
    expect(sNull1.hash).toBe('2be88ca4242c76e8253ac62474851065032d6833');
    expect(sNull2.hash).toBe('8c1030365643f1f4b7f00e3d88c0a3c555522b60');
    expect(sNull1.content.toString('utf8')).toBe('null');
    expect(sNull2.content.toString('utf8')).toBe('"null"');
  });

  it('skips non-json types', () => {
    const sFunc1 = jsonHash({
      a: [0, () => null],
      fn: () => null,
    });

    const sFunc2 = jsonHash({
      a: [0],
    });

    expect(sFunc1.hash).toBe(sFunc2.hash);
    expect(sFunc1.hash).toBe('38b742facb1034438d82cf1e294d9e71051bf120');
    expect(sFunc2.hash).toBe('38b742facb1034438d82cf1e294d9e71051bf120');
    expect(sFunc1.content.toString('utf8')).toBe('{"a":[0]}');
    expect(sFunc2.content.toString('utf8')).toBe('{"a":[0]}');
  });

  it('fails on undefined', () => {
    try {
      jsonHash(undefined);
      jsonHash();
    } catch (err) {
      return;
    }
    throw new Error('Expected jsonHash(undefined) to fail');
  });
});
