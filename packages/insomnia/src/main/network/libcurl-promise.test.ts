// @ts-nocheck
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Curl } from '@getinsomnia/node-libcurl';
import { afterEach, describe, expect, it } from 'vitest';

import { createConfiguredCurlInstance, parseRequestBodyPath } from './libcurl-promise';

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

describe('parseRequestBodyPath', () => {
  // buildMultipart reads multipart file parts straight off disk, so their paths must pass the
  // dataFolders allowlist here -- they can be steered by scripts, templates, and plugin hooks.

  // Scratch fixtures must not live in os.tmpdir(), which is itself an unconditionally allowed root.
  const TEST_ROOT = path.join(__dirname, '.tmp-libcurl-promise');
  const scratchDirs: string[] = [];
  const multipartBody = params => ({ mimeType: 'multipart/form-data', params });
  const fileParams = fileName => [{ name: 'f', type: 'file', value: '', fileName }];

  afterEach(() => {
    for (const dir of scratchDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  const mkScratchDir = (prefix: string) => {
    fs.mkdirSync(TEST_ROOT, { recursive: true });
    const dir = fs.mkdtempSync(path.join(TEST_ROOT, `insomnia-multipart-${prefix}-`));
    scratchDirs.push(dir);
    return dir;
  };

  it('rejects a multipart file part outside the allowlist before any file is read', async () => {
    // The path does not exist: an access error (not ENOENT) proves the guard fired before buildMultipart.
    await expect(
      parseRequestBodyPath(multipartBody(fileParams('/definitely-not-allowed/secret.txt')), baseSettings()),
    ).rejects.toThrow(/cannot access/);
  });

  it('rejects an encoded traversal path that resolves outside the allowlist', async () => {
    await expect(
      parseRequestBodyPath(multipartBody(fileParams(encodeURIComponent('/allowed/../secret.txt'))), baseSettings()),
    ).rejects.toThrow(/cannot access/);
  });

  it('rejects a symlink inside an allowed folder that resolves outside every allowed root', async () => {
    const allowedDir = mkScratchDir('allowed');
    const outsideDir = mkScratchDir('outside');
    const outsideFile = path.join(outsideDir, 'secret.txt');
    fs.writeFileSync(outsideFile, 'outside-secret');
    const innocuousLink = path.join(allowedDir, 'innocuous.txt');
    fs.symlinkSync(outsideFile, innocuousLink);

    await expect(
      parseRequestBodyPath(multipartBody(fileParams(innocuousLink)), baseSettings({ dataFolders: [allowedDir] })),
    ).rejects.toThrow(/cannot access/);
  });

  it('allows a multipart file part inside a dataFolders entry and builds the body from it', async () => {
    const allowedDir = mkScratchDir('allowed');
    const file = path.join(allowedDir, 'data.txt');
    fs.writeFileSync(file, 'file-part-content');
    const bodyPath = await parseRequestBodyPath(
      multipartBody(fileParams(file)),
      baseSettings({ dataFolders: [allowedDir] }),
    );
    try {
      expect(fs.readFileSync(bodyPath, 'utf8')).toContain('file-part-content');
    } finally {
      fs.rmSync(bodyPath, { force: true });
    }
  });

  it('treats a malformed percent sequence as a literal filename, not a URIError', async () => {
    const file = path.join(os.tmpdir(), 'insomnia-multipart-literal-100%.txt');
    fs.writeFileSync(file, 'literal-percent-content');
    const bodyPath = await parseRequestBodyPath(multipartBody(fileParams(file)), baseSettings());
    try {
      expect(fs.readFileSync(bodyPath, 'utf8')).toContain('literal-percent-content');
    } finally {
      fs.rmSync(bodyPath, { force: true });
      fs.rmSync(file, { force: true });
    }
  });
});
