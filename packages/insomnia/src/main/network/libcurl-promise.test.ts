// @ts-nocheck
import { Curl } from '@getinsomnia/node-libcurl';
import { describe, expect, it } from 'vitest';

import { createConfiguredCurlInstance } from './libcurl-promise';

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
});
