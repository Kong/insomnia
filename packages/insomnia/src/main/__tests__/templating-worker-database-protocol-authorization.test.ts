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
    response: { getLatestForRequestId: vi.fn(), getByBodyPath: vi.fn() },
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
      `module.exports.templateTags = [{ name: "legit_tag", displayName: "legit", run: function () {} }];
       module.exports.requestHooks = [function (context) {
         context.request.setHeader('X-Plugin-Source', 'legit');
       }];`,
    );

    foreignDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-plugin-foreign-'));
    fs.writeFileSync(path.join(foreignDir, 'package.json'), JSON.stringify({ main: 'index.js' }));
    fs.writeFileSync(
      path.join(foreignDir, 'index.js'),
      `module.exports.templateTags = [{ name: "forged_tag", displayName: "forged", run: function () {} }];
       module.exports.requestHooks = [function (context) {
         context.request.setHeader('X-Plugin-Source', 'foreign');
       }];`,
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

  // Mirrors the discoverUserPluginExports case above on the request-hook path — before this branch,
  // `plugin.discoverUserPluginExports` and `plugin.runUserRequestHook` each trusted their own copy of
  // `body.(plugin.)directory` independently, so a guard proven on one handler didn't imply the other
  // was covered (this is exactly how the `permissions` gap in the describe block below went
  // unnoticed alongside the `directory` fix). Test both handlers explicitly rather than one.
  it('a forged directory in plugin.runUserRequestHook\'s request body is ignored in favor of the registry-resolved one', async () => {
    const token = getOrCreateTemplatingDbAuthToken();
    const { resolveDbByKey } = await import('../templating-worker-database');
    const req = new Request('insomnia-templating-worker-database://plugin.runuserrequesthook', {
      method: 'POST',
      headers: { [TEMPLATING_DB_AUTH_HEADER]: token },
      body: JSON.stringify({
        plugin: { name: 'insomnia-plugin-legit', directory: foreignDir },
        hookIndex: 0,
        renderedRequest: { _id: 'req_1', url: 'https://example.com', headers: [], body: {} },
        renderContext: {},
      }),
    });
    const res = await resolveDbByKey(req);
    expect(res.status).toBe(200);
    const mutated = await res.json();
    const source = mutated.headers.find((h: { name: string }) => h.name === 'X-Plugin-Source')?.value;
    expect(source).toBe('legit');
  });
});

// H1-followup finding (fixed): F2' resolved `directory` server-side from the trusted registry
// (getPlugins()), but originally left `permissions` as a caller-supplied field on the request body
// for both `plugin.runUserRequestHook` and `plugin.discoverUserPluginExports`. Now both handlers
// resolve `permissions` from the trusted registry the same way they resolve `directory`, so a
// forged `permissions` in the request body no longer grants a broader capability set than the
// plugin's own registered manifest declares.
describe('protocol-dispatch handlers resolve `permissions` from the trusted registry, not the request body', () => {
  let pluginDir: string;

  beforeEach(async () => {
    _testOnlyResetTemplatingDbAuthToken();
    pluginDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-plugin-restricted-'));
    fs.writeFileSync(path.join(pluginDir, 'package.json'), JSON.stringify({ main: 'index.js' }));
    fs.writeFileSync(
      path.join(pluginDir, 'index.js'),
      // Reports whether the `network` capability made it into the hook's context — deleted from
      // `context` entirely unless granted (in-sandbox-bootstrap.ts `__hasCap`).
      `module.exports.requestHooks = [function (context) {
        context.request.setBody({ text: JSON.stringify({ hasNetwork: typeof context.network !== 'undefined' }) });
      }];`,
    );

    // The registry's source of truth for this plugin declares NO capabilities (no manifest) —
    // real callers (the plugin loader, invoke-method.ts) would only ever send this plugin's hook
    // with baseline capabilities, which do not include `network`.
    const { getPlugins } = await import('~/plugins');
    (getPlugins as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { name: 'insomnia-plugin-restricted', directory: pluginDir, permissions: {} },
    ]);
  });

  afterEach(() => {
    fs.rmSync(pluginDir, { recursive: true, force: true });
  });

  const runHook = async (permissions?: { capabilities?: string[] }) => {
    const token = getOrCreateTemplatingDbAuthToken();
    const { resolveDbByKey } = await import('../templating-worker-database');
    const req = new Request('insomnia-templating-worker-database://plugin.runuserrequesthook', {
      method: 'POST',
      headers: { [TEMPLATING_DB_AUTH_HEADER]: token },
      body: JSON.stringify({
        plugin: { name: 'insomnia-plugin-restricted', permissions },
        hookIndex: 0,
        renderedRequest: { _id: 'req_1', url: 'https://example.com', headers: [], body: {} },
        renderContext: {},
      }),
    });
    const res = await resolveDbByKey(req);
    expect(res.status).toBe(200);
    const mutated = await res.json();
    return JSON.parse(mutated.body.text) as { hasNetwork: boolean };
  };

  it('baseline: a request that omits permissions gets the registry-appropriate (no-network) grant', async () => {
    const { hasNetwork } = await runHook();
    expect(hasNetwork).toBe(false);
  });

  // The plugin's *registered* manifest (mocked above) declares no capabilities. A forged
  // `permissions.capabilities: ['network']` in the request body must not grant `network` — the
  // handler resolves `permissions` from `getPlugins()` by name, the same trusted-registry pattern
  // F2' applies to `directory`, rather than trusting the request body.
  it('a forged `permissions.capabilities` in the request body is ignored; the registry still denies network', async () => {
    const { hasNetwork } = await runHook({ capabilities: ['network'] });
    expect(hasNetwork).toBe(false);
  });
});

// Symmetric coverage for the other handler that resolves `permissions`: the describe block above
// only exercises `plugin.runUserRequestHook`. `plugin.discoverUserPluginExports` takes the same
// `resolveTrustedPlugin(...).permissions` value but on the *module* grant, not the capability grant
// (discovery evaluates the plugin's top-level code, which can only reach gated `require(...)`, not
// hook-time `context.*`). Exercising both fields on both handlers is the point: the permissions gap
// this branch fixed existed specifically because the `directory` fix was verified per-handler but
// `permissions` wasn't checked on every handler that resolves it.
describe('plugin.discoverUserPluginExports resolves `permissions.modules` from the trusted registry, not the request body', () => {
  let pluginDir: string;

  beforeEach(async () => {
    _testOnlyResetTemplatingDbAuthToken();
    pluginDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-plugin-nomodules-'));
    fs.writeFileSync(path.join(pluginDir, 'package.json'), JSON.stringify({ main: 'index.js' }));
    fs.writeFileSync(
      path.join(pluginDir, 'index.js'),
      // `events` is not in the baseline module grant (`path`/`crypto` only), so a top-level require
      // of it only succeeds if `permissions.modules` grants it.
      "require('events'); module.exports.templateTags = [];",
    );

    // The registry declares no extra modules for this plugin — a real caller (the plugin loader)
    // would only ever discover this plugin's exports with the baseline module grant.
    const { getPlugins } = await import('~/plugins');
    (getPlugins as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { name: 'insomnia-plugin-nomodules', directory: pluginDir, permissions: {} },
    ]);
  });

  afterEach(() => {
    fs.rmSync(pluginDir, { recursive: true, force: true });
  });

  it('a forged `permissions.modules` in the request body is ignored; the registry still denies the module', async () => {
    const token = getOrCreateTemplatingDbAuthToken();
    const { resolveDbByKey } = await import('../templating-worker-database');
    const req = new Request('insomnia-templating-worker-database://plugin.discoveruserpluginexports', {
      method: 'POST',
      headers: { [TEMPLATING_DB_AUTH_HEADER]: token },
      body: JSON.stringify({
        name: 'insomnia-plugin-nomodules',
        permissions: { modules: ['events'] },
      }),
    });
    const res = await resolveDbByKey(req);
    // Discovery surfaces a denied top-level require as a rejection, not a 200 with an empty manifest.
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/not permitted by manifest/);
  });
});

// Fixed finding (PR #10286): a response hook's `setBody()` writes to a caller-supplied `bodyPath`
// with no persisted `_id` to reload by, so `assertResponseBodyPathOwnership` instead rejects the call
// if that bodyPath already belongs to a different, already-persisted response's `parentId`. This
// doesn't close the narrower case of a caller who also knows the victim's real `parentId` — that's
// the deeper gap tracked in `CROSS-TENANT-DB-ACCESS-FINDINGS.md`.
describe('plugin.runUserResponseHook: setBody cannot redirect its write onto a different response', () => {
  let pluginDir: string;
  let responsesDir: string;
  let ownBodyPath: string;
  let victimBodyPath: string;
  let previousDataPath: string | undefined;

  beforeEach(async () => {
    _testOnlyResetTemplatingDbAuthToken();
    pluginDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-plugin-resphook-'));
    fs.writeFileSync(path.join(pluginDir, 'package.json'), JSON.stringify({ main: 'index.js' }));
    fs.writeFileSync(
      path.join(pluginDir, 'index.js'),
      `module.exports.responseHooks = [function (context) {
        context.response.setBody('attacker-controlled-body');
      }];`,
    );

    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-data-'));
    responsesDir = path.join(dataDir, 'responses');
    fs.mkdirSync(responsesDir);
    ownBodyPath = path.join(responsesDir, 'own-response-body.txt');
    victimBodyPath = path.join(responsesDir, 'victim-response-body.txt');
    fs.writeFileSync(ownBodyPath, 'own-original-body');
    fs.writeFileSync(victimBodyPath, 'victim-original-body');

    previousDataPath = process.env['INSOMNIA_DATA_PATH'];
    process.env['INSOMNIA_DATA_PATH'] = dataDir;

    // Default: neither bodyPath is owned yet; individual tests override to simulate a claimed one.
    const { services } = await import('insomnia-data');
    (services.response.getByBodyPath as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  afterEach(() => {
    if (previousDataPath === undefined) {
      delete process.env['INSOMNIA_DATA_PATH'];
    } else {
      process.env['INSOMNIA_DATA_PATH'] = previousDataPath;
    }
    fs.rmSync(pluginDir, { recursive: true, force: true });
    fs.rmSync(path.dirname(responsesDir), { recursive: true, force: true });
  });

  const runResponseHook = async (bodyPath: string, parentId = 'req_1') => {
    const token = getOrCreateTemplatingDbAuthToken();
    const { getPlugins } = await import('~/plugins');
    (getPlugins as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { name: 'insomnia-plugin-resphook', directory: pluginDir, permissions: {} },
    ]);
    const { resolveDbByKey } = await import('../templating-worker-database');
    const req = new Request('insomnia-templating-worker-database://plugin.runuserresponsehook', {
      method: 'POST',
      headers: { [TEMPLATING_DB_AUTH_HEADER]: token },
      body: JSON.stringify({
        plugin: { name: 'insomnia-plugin-resphook' },
        hookIndex: 0,
        response: { parentId, bodyPath },
        renderedRequest: { url: 'https://example.com', headers: [] },
        renderContext: {},
      }),
    });
    return resolveDbByKey(req);
  };

  it('baseline: setBody writes to a not-yet-persisted response\'s own bodyPath as intended', async () => {
    const res = await runResponseHook(ownBodyPath, 'req_1');
    expect(res.status).toBe(200);
    expect(fs.readFileSync(ownBodyPath, 'utf8')).toBe('attacker-controlled-body');
    expect(fs.readFileSync(victimBodyPath, 'utf8')).toBe('victim-original-body');
  });

  it('allows re-writing a bodyPath that legitimately already belongs to the same parentId', async () => {
    const { services } = await import('insomnia-data');
    (services.response.getByBodyPath as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      _id: 'res_own', parentId: 'req_1', bodyPath: ownBodyPath,
    });
    const res = await runResponseHook(ownBodyPath, 'req_1');
    expect(res.status).toBe(200);
    expect(fs.readFileSync(ownBodyPath, 'utf8')).toBe('attacker-controlled-body');
  });

  it('FIXED: rejects a forged `response.bodyPath` that belongs to a different response, before the hook runs', async () => {
    const { services } = await import('insomnia-data');
    (services.response.getByBodyPath as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      _id: 'res_victim', parentId: 'req_victim', bodyPath: victimBodyPath,
    });
    // The forged call's parentId ('req_1') doesn't match victimBodyPath's real owner ('req_victim').
    const res = await runResponseHook(victimBodyPath, 'req_1');
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/belongs to a different response/);
    expect(fs.readFileSync(victimBodyPath, 'utf8')).toBe('victim-original-body');
    expect(fs.readFileSync(ownBodyPath, 'utf8')).toBe('own-original-body');
  });

  it('still rejects a bodyPath that escapes the responses directory entirely', async () => {
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-outside-'));
    const outsidePath = path.join(outsideDir, 'not-a-response.txt');
    fs.writeFileSync(outsidePath, 'untouched');
    try {
      // The plugin hook doesn't await setBody()'s returned promise (fire-and-forget), so a rejected
      // bridge call never surfaces as a non-200 response here — but the containment check still runs
      // before any write, so the file outside `responses/` is provably never touched either way.
      await runResponseHook(outsidePath, 'req_1');
      expect(fs.readFileSync(outsidePath, 'utf8')).toBe('untouched');
    } finally {
      fs.rmSync(outsideDir, { recursive: true, force: true });
    }
  });

  // Regression: the ownership check was originally only in the plugin.runUserResponseHook wrapper,
  // not in response.setBody itself, which is directly dispatchable without going through it.
  it('rejects a forged bodyPath+parentId sent directly to response.setBody, bypassing the hook wrapper entirely', async () => {
    const { services } = await import('insomnia-data');
    (services.response.getByBodyPath as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      _id: 'res_victim', parentId: 'req_victim', bodyPath: victimBodyPath,
    });
    const token = getOrCreateTemplatingDbAuthToken();
    const { resolveDbByKey } = await import('../templating-worker-database');
    const req = new Request('insomnia-templating-worker-database://response.setbody', {
      method: 'POST',
      headers: { [TEMPLATING_DB_AUTH_HEADER]: token },
      body: JSON.stringify({
        bodyPath: victimBodyPath,
        bodyBase64: Buffer.from('attacker-controlled-body', 'utf8').toString('base64'),
        parentId: 'req_1',
      }),
    });
    const res = await resolveDbByKey(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/belongs to a different response/);
    expect(fs.readFileSync(victimBodyPath, 'utf8')).toBe('victim-original-body');
  });

  // FIXED: assertResponseBodyPathOwnership used to look up `services.response.getByBodyPath` using
  // the raw, unresolved caller-supplied bodyPath (an exact-string NeDB lookup), while the write
  // itself targeted `path.resolve(body.bodyPath)`. A bodyPath that was textually different from the
  // victim's stored bodyPath yet resolved to the exact same absolute file missed the exact-match
  // lookup entirely (no existing owner found -> no throw), even though the write landed on the
  // victim's real file — needing no knowledge of the victim's real parentId at all, unlike the
  // residual "same-parentId" gap tracked in CROSS-TENANT-DB-ACCESS-FINDINGS.md. Now the ownership
  // check resolves the bodyPath before querying, so it agrees with the write's own resolved target.
  it('FIXED: a path-normalization variant of a victim bodyPath no longer bypasses the ownership check via the hook wrapper', async () => {
    const { services } = await import('insomnia-data');
    // Real NeDB does exact-string field matching (`db.findOne(type, { bodyPath })`) -- mirror that
    // here with `mockImplementation` instead of the input-independent `mockResolvedValue` used by
    // the other tests in this block, so this test can't pass by accident regardless of what bodyPath
    // string the code under test actually queries with.
    (services.response.getByBodyPath as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (bodyPath: string) =>
        bodyPath === victimBodyPath ? { _id: 'res_victim', parentId: 'req_victim', bodyPath: victimBodyPath } : null,
    );
    const variantOfVictimBodyPath = `${responsesDir}${path.sep}zzz${path.sep}..${path.sep}victim-response-body.txt`;
    expect(variantOfVictimBodyPath).not.toBe(victimBodyPath);
    expect(path.resolve(variantOfVictimBodyPath)).toBe(path.resolve(victimBodyPath));

    const res = await runResponseHook(variantOfVictimBodyPath, 'req_attacker');

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/belongs to a different response/);
    expect(fs.readFileSync(victimBodyPath, 'utf8')).toBe('victim-original-body');
  });

  // Same bug, reached by sending the path-normalization variant straight to response.setBody,
  // bypassing the hook wrapper entirely (same actor as the already-fixed #10286 wrapper bypass).
  it('FIXED: a path-normalization variant sent directly to response.setBody no longer bypasses the check', async () => {
    const { services } = await import('insomnia-data');
    (services.response.getByBodyPath as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (bodyPath: string) =>
        bodyPath === victimBodyPath ? { _id: 'res_victim', parentId: 'req_victim', bodyPath: victimBodyPath } : null,
    );
    const variantOfVictimBodyPath = `${responsesDir}${path.sep}zzz${path.sep}..${path.sep}victim-response-body.txt`;
    const token = getOrCreateTemplatingDbAuthToken();
    const { resolveDbByKey } = await import('../templating-worker-database');
    const req = new Request('insomnia-templating-worker-database://response.setbody', {
      method: 'POST',
      headers: { [TEMPLATING_DB_AUTH_HEADER]: token },
      body: JSON.stringify({
        bodyPath: variantOfVictimBodyPath,
        bodyBase64: Buffer.from('attacker-controlled-body', 'utf8').toString('base64'),
        parentId: 'req_attacker',
      }),
    });
    const res = await resolveDbByKey(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/belongs to a different response/);
    expect(fs.readFileSync(victimBodyPath, 'utf8')).toBe('victim-original-body');
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
