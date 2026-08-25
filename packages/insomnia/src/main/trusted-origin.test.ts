import { describe, expect, it } from 'vitest';

import { isTrustedAppOrigin } from './trusted-origin';

// Guards against regressing to a raw string-prefix comparison.
describe('isTrustedAppOrigin', () => {
  const appUrl = 'https://insomnia-app.local';

  it('trusts the exact app origin', () => {
    expect(isTrustedAppOrigin('https://insomnia-app.local', appUrl)).toBe(true);
  });

  it('trusts the app origin with a different path or query', () => {
    expect(isTrustedAppOrigin('https://insomnia-app.local/some/path?x=1', appUrl)).toBe(true);
  });

  it('rejects a hostname with an extra dot-separated suffix sharing the app origin as a prefix', () => {
    expect(isTrustedAppOrigin('https://insomnia-app.local.example.com/', appUrl)).toBe(false);
  });

  it('rejects a hostname extended with extra characters and no separator', () => {
    expect(isTrustedAppOrigin('https://insomnia-app.localexample.com/', appUrl)).toBe(false);
  });

  it('rejects userinfo-style prefix tricks', () => {
    expect(isTrustedAppOrigin('https://insomnia-app.local@example.com/', appUrl)).toBe(false);
  });

  it('rejects a different scheme even with the same host', () => {
    expect(isTrustedAppOrigin('http://insomnia-app.local/', appUrl)).toBe(false);
  });

  it('rejects a different port', () => {
    expect(isTrustedAppOrigin('https://insomnia-app.local:8443/', appUrl)).toBe(false);
  });

  it('is not fooled when the app origin appears in the path/query instead of the host', () => {
    expect(isTrustedAppOrigin('https://example.com/https://insomnia-app.local', appUrl)).toBe(false);
  });

  it('treats an unparsable URL as untrusted rather than throwing', () => {
    expect(isTrustedAppOrigin('not-a-valid-url', appUrl)).toBe(false);
  });

  it('applies the same suffix-bypass check against a non-default appUrl (e.g. dev server)', () => {
    const devAppUrl = 'http://localhost:3334';
    expect(isTrustedAppOrigin('http://localhost:3334', devAppUrl)).toBe(true);
    expect(isTrustedAppOrigin('http://localhost:33340/', devAppUrl)).toBe(false);
    expect(isTrustedAppOrigin('http://localhost:3334@example.com/', devAppUrl)).toBe(false);
  });
});
