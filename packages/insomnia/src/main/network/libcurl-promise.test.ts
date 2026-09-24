// @ts-nocheck
import fs from 'node:fs';

import { Curl } from '@getinsomnia/node-libcurl';
import { afterEach, describe, expect, it } from 'vitest';

import { __clearScriptedResponses, __setScriptedResponses } from '../../__mocks__/@getinsomnia/node-libcurl';
import { createConfiguredCurlInstance, curlRequest } from './libcurl-promise';

const baseReq = (overrides: Record<string, unknown> = {}) => ({
  headers: [],
  method: 'GET',
  body: {},
  authentication: {},
  settingFollowRedirects: 'global',
  settingRebuildPath: true,
  settingSendCookies: false,
  url: 'https://api.example.com/v1/messages',
  cookieJar: { cookies: [] },
  cookies: [],
  suppressUserAgent: false,
  ...overrides,
});

const baseSettings = (overrides: Record<string, unknown> = {}) => ({
  preferredHttpVersion: 'default',
  maxRedirects: 10,
  proxyEnabled: true,
  timeout: 0,
  validateSSL: true,
  followRedirects: true,
  maxTimelineDataSizeKB: 1,
  httpProxy: 'http-proxy.local:1111',
  httpsProxy: 'https-proxy.local:2222',
  noProxy: '',
  dataFolders: [],
  ...overrides,
});

describe('createConfiguredCurlInstance', () => {
  it('picks the manual proxy matching req.url\'s protocol', async () => {
    const { curl } = await createConfiguredCurlInstance({
      req: baseReq(),
      settings: baseSettings(),
      caCert: null,
      certificates: [],
    });

    expect(curl._options[Curl.option.PROXY]).toBe('http://https-proxy.local:2222');
  });

  it('bypasses the manual proxy when req.url\'s host matches noProxy', async () => {
    const { curl } = await createConfiguredCurlInstance({
      req: baseReq(),
      settings: baseSettings({ noProxy: 'api.example.com' }),
      caCert: null,
      certificates: [],
    });

    expect(curl._options[Curl.option.PROXY]).toBe('');
  });

  it('restricts redirect targets to http and https', async () => {
    const { curl } = await createConfiguredCurlInstance({
      req: baseReq(),
      settings: baseSettings(),
      caCert: null,
      certificates: [],
    });

    // CurlProtocol.HTTP (1) | CurlProtocol.HTTPS (2)
    expect(curl._options[Curl.option.REDIR_PROTOCOLS]).toBe(3);
  });
});

describe('curlRequest redirect handling', () => {
  afterEach(() => {
    __clearScriptedResponses();
  });

  const secretHeaders = [
    { name: 'X-Api-Key', value: 'prod-secret' },
    { name: 'Accept', value: 'application/json' },
  ];

  const sentHeadersOf = async (responseBodyPath: string) => {
    const echoed = JSON.parse(await fs.promises.readFile(responseBodyPath, 'utf8'));
    return echoed.options.HTTPHEADER as string[];
  };

  it('strips secret headers when following a cross-origin redirect', async () => {
    __setScriptedResponses({
      'https://api.example.com/data': [
        { statusLine: 'HTTP/1.1 302 Found', headerLines: ['Location: https://collector.example/harvest'] },
      ],
    });

    const output = await curlRequest({
      requestId: 'req_redirect_strip_test',
      req: baseReq({ url: 'https://api.example.com/data', headers: secretHeaders }),
      finalUrl: 'https://api.example.com/data',
      settings: baseSettings(),
      certificates: [],
      caCertficatePath: null,
    });

    expect(output.patch.url).toBe('https://collector.example/harvest');
    const sent = await sentHeadersOf(output.responseBodyPath);
    expect(sent.join('\n')).not.toContain('prod-secret');
    expect(sent.join('\n')).toContain('Accept: application/json');
    const timeline = output.debugTimeline.map(entry => entry.value).join('\n');
    expect(timeline).toContain('cross-origin');
    expect(timeline).toContain('X-Api-Key');
  });

  it('preserves headers on a same-origin redirect', async () => {
    __setScriptedResponses({
      'https://api.example.com/v1/data': [
        { statusLine: 'HTTP/1.1 302 Found', headerLines: ['Location: /v2/data'] },
      ],
    });

    const output = await curlRequest({
      requestId: 'req_redirect_same_origin_test',
      req: baseReq({ url: 'https://api.example.com/v1/data', headers: secretHeaders }),
      finalUrl: 'https://api.example.com/v1/data',
      settings: baseSettings(),
      certificates: [],
      caCertficatePath: null,
    });

    expect(output.patch.url).toBe('https://api.example.com/v2/data');
    const sent = await sentHeadersOf(output.responseBodyPath);
    expect(sent.join('\n')).toContain('X-Api-Key: prod-secret');
  });

  it('refuses a redirect to a file URL', async () => {
    __setScriptedResponses({
      'https://api.example.com/data': [
        { statusLine: 'HTTP/1.1 302 Found', headerLines: ['Location: file:///etc/passwd'] },
      ],
    });

    const output = await curlRequest({
      requestId: 'req_redirect_blocked_test',
      req: baseReq({ url: 'https://api.example.com/data', headers: secretHeaders }),
      finalUrl: 'https://api.example.com/data',
      settings: baseSettings(),
      certificates: [],
      caCertficatePath: null,
    });

    expect(output.patch.url).toBe('https://api.example.com/data');
    expect(output.patch.error || '').toContain('only http and https');
  });
});
