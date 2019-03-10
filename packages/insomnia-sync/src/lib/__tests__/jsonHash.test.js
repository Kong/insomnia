import { jsonHash } from '../jsonHash';

describe('jsonHash()', () => {
  it('ignore object key order', () => {
    const result1 = jsonHash({ c: 'c', a: 'a', b: 'b' });
    const result2 = jsonHash({ a: 'a', b: 'b', c: 'c' });

    expect(result1).toBe(result2);
    expect(result1).toBe('fed03259e8027e1fab2e2e57b402671bef7f3eb9');
    expect(result2).toBe('fed03259e8027e1fab2e2e57b402671bef7f3eb9');
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

    expect(result1).toBe(result2);
    expect(result1).toBe('7eaaa8a03bada54b403aeada681aad6892a28ab3');
    expect(result2).toBe('7eaaa8a03bada54b403aeada681aad6892a28ab3');
  });

  it('array order matters', () => {
    const result1 = jsonHash(['c', 'a', 'b']);
    const result2 = jsonHash(['a', 'b', 'c']);

    expect(result1).not.toBe(result2);
    expect(result1).toBe('edf94aad27c26bdcfe7477e0ed68991cbaedf8d8');
    expect(result2).toBe('e13460afb1e68af030bb9bee8344c274494661fa');
  });

  it('works with strange types', () => {
    const sDate1 = jsonHash(new Date(1541178019555));
    const sDate2 = jsonHash('2018-11-02T17:00:19.555Z');
    expect(sDate1).toBe(sDate2);
    expect(sDate1).toBe('ec0a18c47fb39de00204c57b5b492fd408394a01');
    expect(sDate2).toBe('ec0a18c47fb39de00204c57b5b492fd408394a01');

    const sNull1 = jsonHash(null);
    const sNull2 = jsonHash('null');
    expect(sNull1).not.toBe(sNull2);
    expect(sNull1).toBe('2be88ca4242c76e8253ac62474851065032d6833');
    expect(sNull2).toBe('8c1030365643f1f4b7f00e3d88c0a3c555522b60');
  });

  it('skips non-json types', () => {
    const sFunc1 = jsonHash({
      a: [0, () => null],
      fn: () => null,
    });

    const sFunc2 = jsonHash({
      a: [0],
    });

    expect(sFunc1).toBe(sFunc2);
    expect(sFunc1).toBe('38b742facb1034438d82cf1e294d9e71051bf120');
    expect(sFunc2).toBe('38b742facb1034438d82cf1e294d9e71051bf120');
  });
});
