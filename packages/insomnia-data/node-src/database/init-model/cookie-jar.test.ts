import type { CookieJar } from 'insomnia-data';
import { describe, expect, it } from 'vitest';

import { migrate } from './cookie-jar';

function makeCookieJar(cookies: Partial<CookieJar['cookies'][number]>[]): CookieJar {
  return { cookies } as CookieJar;
}

describe('migrateCookieSource()', () => {
  it('grandfathers a pre-existing cookie with no source field in as manual', () => {
    const jar = makeCookieJar([{ id: 'c1', key: 'legacy', value: '{{ _.base_url }}' }]);
    const result = migrate(jar);

    expect(result.cookies[0].source).toBe('manual');
  });

  it('leaves a cookie that already has a source untouched', () => {
    const jar = makeCookieJar([{ id: 'c1', key: 'fromServer', source: 'response' }]);
    const result = migrate(jar);

    expect(result.cookies[0].source).toBe('response');
  });

  it('is idempotent across repeated migrations', () => {
    const jar = makeCookieJar([{ id: 'c1', key: 'legacy' }]);
    const once = migrate(jar);
    const twice = migrate(once);

    expect(twice.cookies[0].source).toBe('manual');
  });
});

describe('migrateCookieId()', () => {
  it('assigns an id to a cookie missing one', () => {
    const jar = makeCookieJar([{ key: 'noId' }]);
    const result = migrate(jar);

    expect(result.cookies[0].id).toBeTruthy();
  });

  it('keeps an existing id unchanged', () => {
    const jar = makeCookieJar([{ id: 'keep-me', key: 'hasId' }]);
    const result = migrate(jar);

    expect(result.cookies[0].id).toBe('keep-me');
  });
});
