import { describe, expect, it } from 'vitest';

import type { CookieJar } from '../../models/cookie-jar';
import { addSetCookiesToToughCookieJar } from '../set-cookie-util';

describe('addSetCookiesToToughCookieJar()', () => {
  it('preserves cookie IDs when updating existing cookies', async () => {
    const cookieJar: CookieJar = {
      _id: 'jar1',
      type: 'CookieJar',
      parentId: 'wrk1',
      modified: Date.now(),
      created: Date.now(),
      isPrivate: false,
      name: 'Test Jar',
      cookies: [
        {
          id: 'cookie-id-1',
          key: 'session',
          value: 'old-value',
          domain: 'insomnia.rest',
          path: '/',
          secure: true,
          httpOnly: true,
          expires: null,
        },
      ],
    };

    const result = await addSetCookiesToToughCookieJar({
      setCookieStrings: ['session=new-value; Domain=insomnia.rest; Path=/'],
      currentUrl: 'https://insomnia.rest/',
      cookieJar,
    });

    expect(result.cookies).toHaveLength(1);
    expect(result.cookies[0].id).toBe('cookie-id-1');
    expect(result.cookies[0].value).toBe('new-value');
  });

  it('handles multiple cookies with different domains', async () => {
    const cookieJar: CookieJar = {
      _id: 'jar1',
      type: 'CookieJar',
      parentId: 'wrk1',
      modified: Date.now(),
      created: Date.now(),
      isPrivate: false,
      name: 'Test Jar',
      cookies: [
        {
          id: 'cookie-id-1',
          key: 'foo',
          value: 'bar',
          domain: 'example.com',
          path: '/',
          secure: false,
          httpOnly: false,
          expires: null,
        },
        {
          id: 'cookie-id-2',
          key: 'baz',
          value: 'qux',
          domain: 'insomnia.rest',
          path: '/',
          secure: false,
          httpOnly: false,
          expires: null,
        },
      ],
    };

    const result = await addSetCookiesToToughCookieJar({
      setCookieStrings: ['foo=updated; Domain=example.com; Path=/'],
      currentUrl: 'https://example.com/',
      cookieJar,
    });

    expect(result.cookies).toHaveLength(2);
    
    const updatedCookie = result.cookies.find(c => c.domain === 'example.com');
    expect(updatedCookie?.id).toBe('cookie-id-1');
    expect(updatedCookie?.value).toBe('updated');
    
    const unchangedCookie = result.cookies.find(c => c.domain === 'insomnia.rest');
    expect(unchangedCookie?.id).toBe('cookie-id-2');
    expect(unchangedCookie?.value).toBe('qux');
  });

  it('adds new cookies without affecting existing ones', async () => {
    const cookieJar: CookieJar = {
      _id: 'jar1',
      type: 'CookieJar',
      parentId: 'wrk1',
      modified: Date.now(),
      created: Date.now(),
      isPrivate: false,
      name: 'Test Jar',
      cookies: [
        {
          id: 'existing-id',
          key: 'existing',
          value: 'value',
          domain: 'insomnia.rest',
          path: '/',
          secure: false,
          httpOnly: false,
          expires: null,
        },
      ],
    };

    const result = await addSetCookiesToToughCookieJar({
      setCookieStrings: ['newcookie=newvalue; Domain=insomnia.rest; Path=/'],
      currentUrl: 'https://insomnia.rest/',
      cookieJar,
    });

    expect(result.cookies).toHaveLength(2);
    
    const existingCookie = result.cookies.find(c => c.key === 'existing');
    expect(existingCookie?.id).toBe('existing-id');
    
    const newCookie = result.cookies.find(c => c.key === 'newcookie');
    expect(newCookie?.value).toBe('newvalue');
  });
});
