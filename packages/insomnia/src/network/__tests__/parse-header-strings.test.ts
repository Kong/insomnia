import { describe, expect, it } from 'vitest';

import { CONTENT_TYPE_FORM_DATA } from '../../common/constants';
import { getCookieHeaderValue, parseHeaderStrings } from '../parse-header-strings';

describe('parseHeaderStrings', () => {
  it('should default with empty inputs', () => {
    const req = { authentication: {}, body: {}, headers: [], method: 'GET' };
    expect(parseHeaderStrings({ req, finalUrl: '' })).toEqual(['Accept: */*', 'Accept-Encoding:', 'content-type:']);
  });

  it('should disable expect and transfer-encoding with body', () => {
    const req = { authentication: {}, body: {}, headers: [], method: 'GET' };
    expect(parseHeaderStrings({ req, requestBody: 'test', finalUrl: '' })).toEqual([
      'Expect:',
      'Transfer-Encoding:',
      'Accept: */*',
      'Accept-Encoding:',
      'content-type:',
    ]);
  });

  it('should add boundary with multipart body path', () => {
    const req = { authentication: {}, body: { mimeType: CONTENT_TYPE_FORM_DATA }, headers: [], method: 'GET' };
    expect(parseHeaderStrings({ req, requestBodyPath: '/tmp/x.z', finalUrl: '' })).toEqual([
      'Expect:',
      'Transfer-Encoding:',
      'Content-Type: multipart/form-data; boundary=X-INSOMNIA-BOUNDARY',
      'Accept: */*',
      'Accept-Encoding:',
    ]);
  });

  it('should sign with aws iam', () => {
    const req = {
      authentication: {
        sessionToken: 'someTokenSomethingSomething',
        type: 'iam',
      },
      body: {},
      headers: [],
      method: 'POST',
    };
    const [host, token, date, authorization] = parseHeaderStrings({ req, finalUrl: 'http://x.y' });
    expect(host).toBe('Host: x.y');
    expect(token).toContain('X-Amz-Security-Token: someTokenSomethingSomething');
    expect(date).toContain('X-Amz-Date: ');
    expect(authorization).toContain('Authorization: AWS4-HMAC-SHA256 ');
    expect(authorization).toContain('Credential=');
    expect(authorization).toContain('SignedHeaders=host;x-amz-date;x-amz-security-token');
    expect(authorization).toContain('Signature=');
  });
});

describe('managed cookie headers', () => {
  const cookieHeaders = [
    { name: 'Cookie', value: 'session_id=abc' },
    { name: 'cookie', value: 'other=1' },
  ];

  it('should hand Cookie headers to the cookie engine instead of curl headers when cookies are managed', () => {
    const req = { authentication: {}, body: {}, headers: cookieHeaders, method: 'GET', settingSendCookies: true };
    expect(parseHeaderStrings({ req, finalUrl: '' })).toEqual(['Accept: */*', 'Accept-Encoding:', 'content-type:']);
  });

  it('should drop a Cookie auth header when cookies are managed', () => {
    const req = { authentication: {}, body: {}, headers: [], method: 'GET', settingSendCookies: true };
    const headers = parseHeaderStrings({ req, finalUrl: '', authHeader: { name: 'Cookie', value: 'key=secret' } });
    expect(headers).toEqual(['Accept: */*', 'Accept-Encoding:', 'content-type:']);
  });

  it('should keep Cookie headers when cookies are not managed', () => {
    const req = { authentication: {}, body: {}, headers: cookieHeaders, method: 'GET', settingSendCookies: false };
    expect(parseHeaderStrings({ req, finalUrl: '' })).toContain('Cookie: session_id=abc');
  });

  it('should join every header and auth cookie value into one cookie string', () => {
    expect(getCookieHeaderValue(cookieHeaders, { name: 'Cookie', value: 'auth=token' })).toBe(
      'session_id=abc; other=1; auth=token',
    );
    expect(getCookieHeaderValue(cookieHeaders)).toBe('session_id=abc; other=1');
    expect(getCookieHeaderValue([], { name: 'Authorization', value: 'Bearer x' })).toBe('');
  });
});
