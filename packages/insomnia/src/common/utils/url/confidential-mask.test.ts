import { HTTPSnippet } from 'httpsnippet';
import { describe, expect, it } from 'vitest';

import { convertHarRequestKeepingMask, encodeUrlKeepingMask } from './confidential-mask';

const MASK = '••••••';

describe('encodeUrlKeepingMask()', () => {
  it('keeps the mask instead of punycoding or percent-encoding it', () => {
    expect(encodeUrlKeepingMask(`https://${MASK}/users/${MASK}?q=${MASK}`, true)).toBe(
      `https://${MASK}/users/${MASK}?q=${MASK}`,
    );
  });

  it('does not prepend a default scheme when the URL starts with the mask', () => {
    expect(encodeUrlKeepingMask(`${MASK}/users`, true)).toBe(`${MASK}/users`);
    expect(encodeUrlKeepingMask('api.example.com/users', true)).toBe('http://api.example.com/users');
  });
});

describe('convertHarRequestKeepingMask()', () => {
  it('keeps the mask through httpsnippet code generation', () => {
    const harRequest = {
      method: 'GET',
      url: `${MASK}/users?q=${MASK}`,
      httpVersion: 'HTTP/1.1',
      cookies: [],
      headers: [{ name: 'Authorization', value: `Basic ${MASK}` }],
      queryString: [{ name: 'q', value: MASK }],
      headersSize: -1,
      bodySize: -1,
    };

    const snippet = convertHarRequestKeepingMask(harRequest, har => new HTTPSnippet(har).convert('shell', 'curl') || '');

    expect(snippet).toContain(`--url '${MASK}/users?q=${MASK}'`);
    expect(snippet).toContain(`Authorization: Basic ${MASK}`);
  });
});
