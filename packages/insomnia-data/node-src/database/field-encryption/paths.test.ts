import { describe, expect, it } from 'vitest';

import { forEachEncryptedLeaf } from './paths';

const collect = (doc: unknown, paths: string[]) => {
  const seen: { path: string; value: unknown }[] = [];
  forEachEncryptedLeaf(doc, paths, ({ container, key, path }) => seen.push({ path, value: container[key] }));
  return seen;
};

describe('forEachEncryptedLeaf()', () => {
  it('walks object keys', () => {
    expect(collect({ passphrase: 'a', other: 'b' }, ['passphrase'])).toEqual([{ path: 'passphrase', value: 'a' }]);
    expect(collect({ authentication: { password: 'p', username: 'u' } }, ['authentication.password'])).toEqual([
      { path: 'authentication.password', value: 'p' },
    ]);
  });

  it('walks every element of an array with []', () => {
    const doc = { cookies: [{ key: 'a', value: '1' }, { key: 'b', value: '2' }, { key: 'c' }] };
    expect(collect(doc, ['cookies[].value'])).toEqual([
      { path: 'cookies[0].value', value: '1' },
      { path: 'cookies[1].value', value: '2' },
    ]);
  });

  it('supports arrays of strings and nested arrays', () => {
    expect(collect({ tokens: ['a', 'b'] }, ['tokens[]'])).toEqual([
      { path: 'tokens[0]', value: 'a' },
      { path: 'tokens[1]', value: 'b' },
    ]);
    expect(collect({ a: [{ b: [{ c: 'x' }, { c: 'y' }] }] }, ['a[].b[].c'])).toEqual([
      { path: 'a[0].b[0].c', value: 'x' },
      { path: 'a[0].b[1].c', value: 'y' },
    ]);
  });

  it('lets the visitor replace the value in place', () => {
    const doc = { authentication: { password: 'p' }, cookies: [{ value: '1' }] };
    forEachEncryptedLeaf(doc, ['authentication.password', 'cookies[].value'], ({ container, key }) => {
      container[key] = 'replaced';
    });
    expect(doc).toEqual({ authentication: { password: 'replaced' }, cookies: [{ value: 'replaced' }] });
  });

  it('visits null, empty and non-string leaves as they are and leaves the filtering to the caller', () => {
    expect(collect({ a: null, b: '', c: 5, d: { x: 1 } }, ['a', 'b', 'c', 'd'])).toEqual([
      { path: 'a', value: null },
      { path: 'b', value: '' },
      { path: 'c', value: 5 },
      { path: 'd', value: { x: 1 } },
    ]);
  });

  it('skips shapes that do not match instead of throwing', () => {
    const paths = ['authentication.password', 'cookies[].value'];
    for (const doc of [
      {},
      { authentication: null, cookies: null },
      { authentication: 'str', cookies: 'str' },
      { authentication: [], cookies: {} },
      { authentication: { password: undefined }, cookies: [null, 1, 'x', [], { value: undefined }] },
      null,
      undefined,
      'text',
      42,
    ]) {
      expect(() => collect(doc, paths)).not.toThrow();
    }
    expect(collect({ authentication: [{ password: 'p' }] }, ['authentication.password'])).toEqual([]);
  });

  it('does not follow inherited properties', () => {
    expect(collect({}, ['toString', 'constructor.name'])).toEqual([]);
  });
});
