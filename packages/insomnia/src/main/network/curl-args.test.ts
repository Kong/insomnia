import { describe, expect, it } from 'vitest';

import { jsonToCurl } from './curl-args';
describe('jsonToCurl', () => {
  it('should correctly transform JSON to a curl command with headers and cookies', () => {
    const jsonData = {
      req: {
        url: 'http://example.com',
        headers: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'User-Agent', value: 'test-agent' },
        ],
        cookieJar: {
          cookies: [
            { key: 'session', value: 'abc123' },
            { key: 'preferences', value: 'dark-mode' },
          ],
        },
        parameters: [
          { name: 'param1', value: 'value1' },
          { name: 'param2', value: 'value2' },
        ],
      },
    };

    expect(jsonToCurl(jsonData)).toStrictEqual([
      'curl',
      '--location',
      "-H 'Content-Type: application/json'",
      "-H 'User-Agent: test-agent'",
      "--cookie 'session=abc123'",
      "--cookie 'preferences=dark-mode'",
      "'http://example.com/?param1=value1&param2=value2'",
    ]);
  });

  it('should correctly transform JSON to a curl command without optional fields', () => {
    const jsonData = {
      req: {
        url: 'http://example.com',
        headers: [],
        cookieJar: {
          cookies: [],
        },
        parameters: [],
      },
    };

    expect(jsonToCurl(jsonData)).toStrictEqual(['curl', '--location', "'http://example.com/'"]);
  });

  it('should correctly handle JSON without cookies or parameters', () => {
    const jsonData = {
      req: {
        url: 'http://example.com',
        headers: [{ name: 'Content-Type', value: 'application/json' }],
      },
    };

    expect(jsonToCurl(jsonData)).toStrictEqual([
      'curl',
      '--location',
      "-H 'Content-Type: application/json'",
      "'http://example.com/'",
    ]);
  });
  it('should correctly handle JSON with body text', () => {
    const jsonData = {
      req: {
        url: 'http://example.com',
        headers: [{ name: 'Content-Type', value: 'application/json' }],
        body: { text: '{"key":"value"}' },
        method: 'POST',
      },
    };

    expect(jsonToCurl(jsonData)).toStrictEqual([
      'curl',
      '-X POST',
      '--location',
      "-H 'Content-Type: application/json'",
      '--data-raw',
      '{"key":"value"}',
      "'http://example.com/'",
    ]);
  });
  // add test for follow redirects '--location'
  it('should respects follow redirects config', () => {
    const jsonData = {
      req: {
        url: 'http://example.com',
        method: 'GET',
        settingFollowRedirects: 'on',
      },
    };
    expect(jsonToCurl(jsonData)).toStrictEqual(['curl', '--location', "'http://example.com/'"]);
    const jsonData2 = {
      req: {
        url: 'http://example.com',
        method: 'GET',
        settingFollowRedirects: 'off',
      },
    };
    expect(jsonToCurl(jsonData2)).toStrictEqual(['curl', "'http://example.com/'"]);
  });
});
