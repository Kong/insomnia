import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Verifies every path in `resolveDbByKey`'s `pluginToMainAPI` map requires a valid auth token,
// resolves plugin directories from the trusted registry rather than the request body, and
// strips dangerous keys from sandbox output consistently. Iterates the live map so a future
// path is covered automatically.

vi.mock('electron', () => ({
  app: { getVersion: () => '1.0.0', getPath: () => '/fake/userData' },
  clipboard: { readText: vi.fn(), writeText: vi.fn(), clear: vi.fn() },
  dialog: { showMessageBox: vi.fn() },
  shell: { openExternal: vi.fn() },
  BrowserWindow: { getAllWindows: () => [] },
}));
vi.mock('insomnia-data', () => ({
  services: {
    request: { getById: vi.fn() },
    workspace: { getById: vi.fn() },
    oAuth2Token: { getByParentId: vi.fn() },
    cookieJar: { getOrCreateForParentId: vi.fn() },
    response: { getLatestForRequestId: vi.fn() },
    helpers: { getResponseBodyBuffer: vi.fn() },
    pluginData: { getByKey: vi.fn(), upsertByKey: vi.fn(), removeByKey: vi.fn(), removeAll: vi.fn(), all: vi.fn() },
    cloudCredential: { getById: vi.fn(), update: vi.fn() },
    settings: { get: vi.fn().mockResolvedValue({}) },
  },
}));
vi.mock('~/plugins', () => ({
  getPluginCommonContext: vi.fn(),
  getTemplateTags: vi.fn().mockResolvedValue([]),
  getPlugins: vi.fn().mockResolvedValue([]),
}));
vi.mock('~/common/cookies', () => ({ jarFromCookies: vi.fn() }));
vi.mock('../common/database', () => ({ database: {} }));
vi.mock('../network/network', () => ({
  fetchRequestData: vi.fn(),
  sendCurlAndWriteTimeline: vi.fn(),
  tryToInterpolateRequest: vi.fn(),
}));
vi.mock('../network/libcurl-promise', () => ({ curlRequest: vi.fn() }));
vi.mock('../prompt-bridge', () => ({ requestPromptFromRenderer: vi.fn() }));
vi.mock('../secure-read-file', () => ({ secureReadFile: vi.fn() }));

import {
  _testOnlyResetTemplatingDbAuthToken,
  getOrCreateTemplatingDbAuthToken,
  TEMPLATING_DB_AUTH_HEADER,
} from '../templating-worker-database-auth';

describe('resolveDbByKey requires a valid protocol auth token', () => {
  beforeEach(() => {
    _testOnlyResetTemplatingDbAuthToken();
  });

  it('every registered path rejects a request with no auth token at all', async () => {
    const { resolveDbByKey, pluginToMainAPI } = await import('../templating-worker-database');
    const paths = Object.keys(pluginToMainAPI);
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) {
      const req = new Request(`insomnia-templating-worker-database://${p.toLowerCase()}`, {
        method: 'POST',
        body: '{}',
      });
      const res = await resolveDbByKey(req);
      expect(res.status, `expected path "${p}" to reject a request with no auth token`).toBe(401);
    }
  });

  it('every registered path rejects a forged/invalid auth token', async () => {
    getOrCreateTemplatingDbAuthToken();
    const { resolveDbByKey, pluginToMainAPI } = await import('../templating-worker-database');
    for (const p of Object.keys(pluginToMainAPI)) {
      const req = new Request(`insomnia-templating-worker-database://${p.toLowerCase()}`, {
        method: 'POST',
        headers: { [TEMPLATING_DB_AUTH_HEADER]: 'deadbeef-not-the-real-token' },
        body: '{}',
      });
      const res = await resolveDbByKey(req);
      expect(res.status, `expected path "${p}" to reject a forged auth token`).toBe(401);
    }
  });

  it('every registered path is dispatched (not rejected as unauthorized) given the real token', async () => {
    const token = getOrCreateTemplatingDbAuthToken();
    const { resolveDbByKey, pluginToMainAPI } = await import('../templating-worker-database');
    for (const p of Object.keys(pluginToMainAPI)) {
      const req = new Request(`insomnia-templating-worker-database://${p.toLowerCase()}`, {
        method: 'POST',
        headers: { [TEMPLATING_DB_AUTH_HEADER]: token },
        body: '{}',
      });
      const res = await resolveDbByKey(req);
      expect(res.status, `expected path "${p}" not to be rejected as unauthorized with a valid token`).not.toBe(401);
    }
  });

  it('plugin.runUserRequestHook rejects a forged, tokenless call before any hook runs', async () => {
    const { resolveDbByKey } = await import('../templating-worker-database');
    const req = new Request('insomnia-templating-worker-database://plugin.runuserrequesthook', {
      method: 'POST',
      body: JSON.stringify({
        plugin: { directory: '/tmp/anything', name: 'insomnia-plugin-forged' },
        hookIndex: 0,
        renderedRequest: { url: 'https://example.com', headers: [] },
        renderContext: {},
      }),
    });
    const res = await resolveDbByKey(req);
    expect(res.status).toBe(401);
  });
});

describe('protocol-dispatch handlers resolve `directory` from the trusted registry, not the request body', () => {
  let legitDir: string;
  let foreignDir: string;

  beforeEach(async () => {
    _testOnlyResetTemplatingDbAuthToken();
    legitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-plugin-legit-'));
    fs.writeFileSync(path.join(legitDir, 'package.json'), JSON.stringify({ main: 'index.js' }));
    fs.writeFileSync(
      path.join(legitDir, 'index.js'),
      'module.exports.templateTags = [{ name: "legit_tag", displayName: "legit", run: function () {} }];',
    );

    foreignDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-plugin-foreign-'));
    fs.writeFileSync(path.join(foreignDir, 'package.json'), JSON.stringify({ main: 'index.js' }));
    fs.writeFileSync(
      path.join(foreignDir, 'index.js'),
      'module.exports.templateTags = [{ name: "forged_tag", displayName: "forged", run: function () {} }];',
    );

    const { getPlugins } = await import('~/plugins');
    (getPlugins as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { name: 'insomnia-plugin-legit', directory: legitDir, permissions: {} },
    ]);
  });

  afterEach(() => {
    fs.rmSync(legitDir, { recursive: true, force: true });
    fs.rmSync(foreignDir, { recursive: true, force: true });
  });

  it('a forged directory in the request body is ignored in favor of the registry-resolved one', async () => {
    const token = getOrCreateTemplatingDbAuthToken();
    const { resolveDbByKey } = await import('../templating-worker-database');
    const req = new Request('insomnia-templating-worker-database://plugin.discoveruserpluginexports', {
      method: 'POST',
      headers: { [TEMPLATING_DB_AUTH_HEADER]: token },
      body: JSON.stringify({ directory: foreignDir, name: 'insomnia-plugin-legit' }),
    });
    const res = await resolveDbByKey(req);
    expect(res.status).toBe(200);
    const manifest = await res.json();
    const tagNames = manifest.templateTags.map((t: { name: string }) => t.name);
    expect(tagNames).toContain('legit_tag');
    expect(tagNames).not.toContain('forged_tag');
  });

  it('rejects a plugin name that is not in the trusted registry, regardless of directory', async () => {
    const token = getOrCreateTemplatingDbAuthToken();
    const { resolveDbByKey } = await import('../templating-worker-database');
    const req = new Request('insomnia-templating-worker-database://plugin.discoveruserpluginexports', {
      method: 'POST',
      headers: { [TEMPLATING_DB_AUTH_HEADER]: token },
      body: JSON.stringify({ directory: foreignDir, name: 'insomnia-plugin-unregistered' }),
    });
    const res = await resolveDbByKey(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/Unknown plugin/);
  });
});

describe('discoverPluginExportsInSandbox strips dangerous JSON keys, symmetric with the hook path', () => {
  it('a plugin export that plants a __proto__ own-key does not survive into the manifest', async () => {
    const { discoverPluginExportsInSandbox } = await import('../templating-worker-database');
    // `themeDesc` passes `theme: t.theme` through verbatim, a nested object that needs the same
    // dangerous-key stripping as the hook-result path.
    const source = `
      var evilTheme = JSON.parse('{"__proto__": {"polluted": true}, "safe": 1}');
      module.exports.themes = [{ name: "t", displayName: "T", theme: evilTheme }];
    `;
    const manifest = await discoverPluginExportsInSandbox(source, {
      pluginName: 'p',
      grantedModules: [],
      grantedCapabilities: [],
    });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    const theme = manifest.themes[0]?.theme as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(theme, '__proto__')).toBe(false);
    expect(theme.safe).toBe(1);
  });
});
