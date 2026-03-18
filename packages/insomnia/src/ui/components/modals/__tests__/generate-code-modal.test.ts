// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { harToSdkParams } from '../generate-code-modal.utils';

const mockSdk = { id: 'sdk-123', languages: ['typescript', 'python'] };

const baseHar = {
  url: 'https://api.example.com/users/list',
  method: 'GET',
  httpVersion: 'HTTP/1.1',
  queryString: [],
  headers: [],
  cookies: [],
  headersSize: -1,
  bodySize: -1,
};

describe('harToSdkParams()', () => {
  it('maps basic GET request correctly', () => {
    const result = harToSdkParams(mockSdk, 'python', { ...baseHar });

    expect(result).toMatchObject({
      id: 'sdk-123',
      language: 'python',
      method: 'GET',
      path: '/users/list',
      parameters: [],
      body: undefined,
    });
  });

  it('maps HAR queryString, headers, and cookies to parameters', () => {
    const result = harToSdkParams(mockSdk, 'typescript', {
      ...baseHar,
      queryString: [{ name: 'page', value: '1' }],
      headers: [{ name: 'Authorization', value: 'Bearer token' }],
      cookies: [{ name: 'session', value: 'abc123' }],
    });

    expect(result.parameters).toEqual(
      expect.arrayContaining([
        { in: 'query', name: 'page', value: '1' },
        { in: 'header', name: 'Authorization', value: 'Bearer token' },
        { in: 'cookie', name: 'session', value: 'abc123' },
      ]),
    );
  });

  it('parses valid JSON postData into body', () => {
    const result = harToSdkParams(mockSdk, 'typescript', {
      ...baseHar,
      method: 'POST',
      postData: { text: '{"name":"Alice","age":30}', mimeType: 'application/json' },
    });

    expect(result.body).toEqual({ name: 'Alice', age: 30 });
  });

  it('sets body to undefined and adds bodyWarning when postData text is not a JSON object', () => {
    const result = harToSdkParams(mockSdk, 'typescript', {
      ...baseHar,
      method: 'POST',
      postData: { text: '[1,2,3]', mimeType: 'application/json' },
    });

    expect(result.body).toBeUndefined();
    expect(result.bodyWarning).toBeDefined();
  });

  it('sets body to undefined and adds bodyWarning for non-JSON text body', () => {
    const result = harToSdkParams(mockSdk, 'typescript', {
      ...baseHar,
      method: 'POST',
      postData: { text: 'plain text body', mimeType: 'text/plain' },
    });

    expect(result.body).toBeUndefined();
    expect(result.bodyWarning).toBeDefined();
  });

  it('converts form params to a body object', () => {
    const result = harToSdkParams(mockSdk, 'typescript', {
      ...baseHar,
      method: 'POST',
      postData: {
        mimeType: 'application/x-www-form-urlencoded',
        params: [{ name: 'username', value: 'alice' }, { name: 'age', value: '30' }],
      },
    });

    expect(result.body).toEqual({ username: 'alice', age: '30' });
    expect(result.bodyWarning).toBeUndefined();
  });

  it('has no bodyWarning when there is no postData', () => {
    const result = harToSdkParams(mockSdk, 'python', { ...baseHar });

    expect(result.bodyWarning).toBeUndefined();
  });
});
