import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sentToasts: any[] = [];
vi.mock('electron', () => ({
  app: { getVersion: () => '1.0.0' },
  clipboard: {},
  dialog: {},
  shell: {},
  BrowserWindow: {
    getAllWindows: () => [
      { webContents: { send: (channel: string, payload: any) => sentToasts.push({ channel, payload }) } },
    ],
  },
}));
vi.mock('insomnia-data', () => ({
  services: {
    request: { getById: vi.fn() },
    cloudCredential: { getById: vi.fn(), update: vi.fn() },
    workspace: { getById: vi.fn() },
    oAuth2Token: { getByParentId: vi.fn() },
    cookieJar: { getOrCreateForParentId: vi.fn() },
    response: { getLatestForRequestId: vi.fn(), getById: vi.fn(), getByBodyPath: vi.fn() },
    helpers: { getResponseBodyBuffer: vi.fn() },
    pluginData: { getByKey: vi.fn(), upsertByKey: vi.fn(), removeByKey: vi.fn() },
    settings: { get: vi.fn() },
  },
  models: {},
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

import { services } from 'insomnia-data';

import { jarFromCookies } from '~/common/cookies';
import { parsePluginPermissions } from '~/common/plugins/permissions';

import { requestPromptFromRenderer } from '../prompt-bridge';
import {
  _testOnlyResetMigrationWarnings,
  getPluginEntrySource,
  maybeWarnMissingManifest,
  readPluginModuleMap,
  resolveDbByKey,
  runPluginTagInSandbox,
} from '../templating-worker-database';
import { getOrCreateTemplatingDbAuthToken, TEMPLATING_DB_AUTH_HEADER } from '../templating-worker-database-auth';

describe('readPluginModuleMap (M4 multi-file plugin reader)', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-plugin-map-'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reads the plugin dir into a relative-keyed module map (entry + siblings + nested)', () => {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ main: 'index.js' }));
    fs.writeFileSync(path.join(dir, 'index.js'), "require('./util');");
    fs.writeFileSync(path.join(dir, 'util.js'), 'module.exports = {};');
    fs.mkdirSync(path.join(dir, 'nested'));
    fs.writeFileSync(path.join(dir, 'nested', 'helper.js'), 'module.exports = {};');
    const { moduleFiles, entryModuleKey } = readPluginModuleMap({ directory: dir, name: 'p' });
    expect(entryModuleKey).toBe('index.js');
    expect(Object.keys(moduleFiles).sort()).toEqual(['index.js', 'nested/helper.js', 'util.js']);
  });

  it("never reads the plugin's own node_modules (the poison guarantee)", () => {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ main: 'index.js' }));
    fs.writeFileSync(path.join(dir, 'index.js'), "require('uuid');");
    fs.mkdirSync(path.join(dir, 'node_modules', 'uuid'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'node_modules', 'uuid', 'index.js'), "module.exports.v4 = () => 'evil';");
    const { moduleFiles } = readPluginModuleMap({ directory: dir, name: 'p' });
    expect(Object.keys(moduleFiles)).toEqual(['index.js']);
    expect(Object.keys(moduleFiles).some(k => k.includes('node_modules'))).toBe(false);
  });

  it('honors a custom package.json "main" as the entry key', () => {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ main: 'src/entry.js' }));
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src', 'entry.js'), 'module.exports = {};');
    const { entryModuleKey, moduleFiles } = readPluginModuleMap({ directory: dir, name: 'p' });
    expect(entryModuleKey).toBe('src/entry.js');
    expect(moduleFiles['src/entry.js']).toBeDefined();
  });

  it('rejects an entry that escapes the plugin directory', () => {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ main: '../../../../etc/passwd' }));
    expect(() => readPluginModuleMap({ directory: dir, name: 'p' })).toThrow(/escapes plugin directory/);
  });

  it('rejects a plugin with more than MAX_PLUGIN_MODULE_FILES source files', () => {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ main: 'index.js' }));
    fs.writeFileSync(path.join(dir, 'index.js'), 'module.exports = {};');
    for (let i = 0; i < 500; i++) {
      fs.writeFileSync(path.join(dir, `f${i}.js`), 'module.exports = {};');
    }
    expect(() => readPluginModuleMap({ directory: dir, name: 'p' })).toThrow(/too many source files/);
  });

  it('reads a custom "main" whose name shadows an Object.prototype member', () => {
    // An extensionless "main" like "toString" collides with Object.prototype.toString: an `in`
    // check against a plain {} object would see it as already present and skip reading the real
    // file, silently dropping the plugin's entry content instead of loading it.
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ main: 'toString' }));
    fs.writeFileSync(path.join(dir, 'toString'), 'module.exports = { real: true };');
    const { moduleFiles, entryModuleKey } = readPluginModuleMap({ directory: dir, name: 'p' });
    expect(entryModuleKey).toBe('toString');
    expect(Object.prototype.hasOwnProperty.call(moduleFiles, 'toString')).toBe(true);
    expect(moduleFiles['toString']).toBe('module.exports = { real: true };');
  });
});

describe('maybeWarnMissingManifest (P1 migration warning)', () => {
  beforeEach(() => {
    sentToasts.length = 0;
    _testOnlyResetMigrationWarnings();
  });

  const denial = Object.assign(new Error("Module 'events' not permitted by manifest"), {
    code: 'SANDBOX_MODULE_NOT_PERMITTED',
    moduleName: 'events',
  });

  it('warns once per manifest-less plugin, naming the missing module', () => {
    const plugin = { name: 'insomnia-plugin-legacy', permissionsDeclared: false };
    maybeWarnMissingManifest(plugin, denial);
    maybeWarnMissingManifest(plugin, denial); // second render — must not re-toast
    expect(sentToasts).toHaveLength(1);
    expect(sentToasts[0].channel).toBe('show-toast');
    expect(sentToasts[0].payload.content.description).toContain('events');
    expect(sentToasts[0].payload.content.description).toContain('insomnia.permissions.modules');
  });

  it('does not warn a plugin that declared a permissions manifest', () => {
    maybeWarnMissingManifest({ name: 'insomnia-plugin-declared', permissionsDeclared: true }, denial);
    expect(sentToasts).toHaveLength(0);
  });

  it('warns separately for a second, distinct missing module on the same plugin', () => {
    // Dedup is keyed by (plugin, module) — a plugin denied two different grants in the same session
    // must still get a distinct, actionable toast for each one it actually hits, not just the first.
    const plugin = { name: 'insomnia-plugin-legacy', permissionsDeclared: false };
    const otherDenial = Object.assign(new Error("Module 'stream' not permitted by manifest"), {
      code: 'SANDBOX_MODULE_NOT_PERMITTED',
      moduleName: 'stream',
    });
    maybeWarnMissingManifest(plugin, denial);
    maybeWarnMissingManifest(plugin, otherDenial);
    expect(sentToasts).toHaveLength(2);
    expect(sentToasts[0].payload.content.description).toContain('events');
    expect(sentToasts[1].payload.content.description).toContain('stream');
  });

  it('does not warn on a non-denial error', () => {
    maybeWarnMissingManifest({ name: 'insomnia-plugin-legacy', permissionsDeclared: false }, new Error('kaboom'));
    expect(sentToasts).toHaveLength(0);
  });

  it('does not warn on a granted-but-unregistered module (not a manifest problem)', () => {
    const unavailable = Object.assign(new Error("Module 'left-pad' not available in sandbox"), {
      code: 'SANDBOX_MODULE_NOT_AVAILABLE',
      moduleName: 'left-pad',
    });
    maybeWarnMissingManifest({ name: 'insomnia-plugin-legacy', permissionsDeclared: false }, unavailable);
    expect(sentToasts).toHaveLength(0);
  });

  it('does not show the migration toast for a manifest with a malformed axis (own warning path instead)', () => {
    // parsePluginPermissions returns declared:true when the permissions object itself is present but
    // one axis is malformed (e.g. non-array modules) — that plugin already has a per-card warning in
    // Preferences → Plugins, so it must not also get the "add insomnia.permissions.modules" toast,
    // which would be actively misleading (it already has a permissions block).
    const parsed = parsePluginPermissions({ permissions: { modules: 'events' } });
    expect(parsed.declared).toBe(true);
    maybeWarnMissingManifest({ name: 'insomnia-plugin-malformed', permissionsDeclared: parsed.declared }, denial);
    expect(sentToasts).toHaveLength(0);
  });
});

describe('getPluginEntrySource', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-plugin-entry-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reads the entry file declared in package.json', () => {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ main: 'index.js' }));
    fs.writeFileSync(path.join(dir, 'index.js'), 'module.exports = {};');
    expect(getPluginEntrySource({ directory: dir, name: 'p' })).toBe('module.exports = {};');
  });

  it('rejects a "main" that traverses outside the plugin directory', () => {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ main: '../../../../etc/passwd' }));
    expect(() => getPluginEntrySource({ directory: dir, name: 'p' })).toThrow(/escapes plugin directory/);
  });

  it('rejects a symlinked entry file whose real target is outside the plugin directory', () => {
    const secret = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-plugin-secret-'));
    const secretFile = path.join(secret, 'secret.js');
    fs.writeFileSync(secretFile, 'module.exports.templateTags = [{ name: "steal", run: () => "leaked" }];');
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ main: 'index.js' }));
    fs.symlinkSync(secretFile, path.join(dir, 'index.js'));
    try {
      expect(() => getPluginEntrySource({ directory: dir, name: 'p' })).toThrow(/escapes plugin directory/);
    } finally {
      fs.rmSync(secret, { recursive: true, force: true });
    }
  });
});

describe('runPluginTagInSandbox — util.render escape', () => {
  const body = {
    args: [],
    pluginName: 'p',
    tagName: 'escape',
    context: { meta: {}, renderPurpose: 'send' as const, context: {} as any },
  };

  it('does not let a sandboxed tag invoke another tag through util.render', async () => {
    const source = `module.exports.templateTags = [{ name: "escape", run: async function (context) {
      return await context.util.render("{% hash 'md5', 'hex', 'x' %}");
    } }];`;
    await expect(runPluginTagInSandbox(source, body)).rejects.toThrow();
  });

  it('still resolves plain variable interpolation through util.render', async () => {
    const source = `module.exports.templateTags = [{ name: "escape", run: async function (context) {
      return await context.util.render("hello {{ name }}");
    } }];`;
    await expect(
      runPluginTagInSandbox(source, {
        ...body,
        context: { meta: {}, renderPurpose: 'send' as const, context: { name: 'kyle' } as any },
      }),
    ).resolves.toBe('hello kyle');
  });
});

describe('response.getBodyBuffer reads only the id-resolved response body when an id is supplied', () => {
  const runTag = (runBody: string) =>
    runPluginTagInSandbox(
      `module.exports.templateTags = [{ name: 't', run: async function (context) { ${runBody} } }];`,
      {
        args: [],
        pluginName: 'p',
        tagName: 't',
        context: { meta: {}, renderPurpose: 'send' as const, context: {} as any },
      },
    );

  beforeEach(() => {
    (services.helpers.getResponseBodyBuffer as any).mockImplementation(async (resp: any) => `read:${resp?.bodyPath}`);
  });

  it('ignores a bodyPath belonging to a different response once an id is supplied', async () => {
    (services.response.getById as any).mockResolvedValue({ _id: 'r1', bodyPath: '/app/r1/body', bodyCompression: null });
    (services.response.getByBodyPath as any).mockResolvedValue({ _id: 'r2', parentId: 'req2', bodyPath: '/app/r2/body' });
    const result = await runTag(
      "return await context.util.models.response.getBodyBuffer({ _id: 'r1', bodyPath: '/app/r2/body' });",
    );
    expect(services.response.getById).toHaveBeenCalledWith('r1');
    expect(result).toBe('read:/app/r1/body');
  });

  it('returns the read-failure value (never touches disk) when the supplied id is unknown', async () => {
    (services.response.getById as any).mockResolvedValue(null);
    (services.helpers.getResponseBodyBuffer as any).mockClear();
    const result = await runTag(
      "return await context.util.models.response.getBodyBuffer({ _id: 'unknown', bodyPath: '/app/r2/body' }, 'FAIL');",
    );
    expect(result).toBe('FAIL');
    expect(services.helpers.getResponseBodyBuffer).not.toHaveBeenCalled();
  });

  it('falls back to bodyPath-ownership verification when no id is supplied (e.g. the pre-persistence hook path)', async () => {
    (services.response.getByBodyPath as any).mockResolvedValue({ _id: 'r2', parentId: 'req2', bodyPath: '/app/r2/body' });
    const result = await runTag(
      "return await context.util.models.response.getBodyBuffer({ bodyPath: '/app/r2/body' });",
    );
    expect(result).toBe('read:/app/r2/body');
  });

  it('rejects a bodyPath that belongs to no known response when no id is supplied', async () => {
    (services.response.getByBodyPath as any).mockResolvedValue(null);
    await expect(
      runTag("return await context.util.models.response.getBodyBuffer({ bodyPath: '/outside/body' });"),
    ).rejects.toThrow(/does not belong to any known response/);
  });
});

describe('cloudCredential.update reloads by id and strips identity fields from the patch', () => {
  const CREDS = ['render', 'models.read', 'util', 'crypto', 'credentials'];
  const BASELINE = ['render', 'models.read', 'util', 'crypto'];
  const runTag = (runBody: string, capabilities: string[] = CREDS) =>
    runPluginTagInSandbox(
      `module.exports.templateTags = [{ name: 't', run: async function (context) { ${runBody} } }];`,
      {
        args: [],
        pluginName: 'p',
        tagName: 't',
        context: { meta: {}, renderPurpose: 'send' as const, context: {} as any },
      },
      undefined,
      capabilities,
    );

  it('has no cloudCredential branch at all without the credentials capability granted', async () => {
    const result = await runTag(
      "return typeof (context.util.models && context.util.models.cloudCredential);",
      BASELINE,
    );
    expect(result).toBe('undefined');
  });

  it('rejects when the supplied id does not resolve to an existing cloud credential', async () => {
    (services.cloudCredential.getById as any).mockResolvedValue(null);
    (services.cloudCredential.update as any).mockClear();
    await expect(
      runTag(
        "return await context.util.models.cloudCredential.update({ _id: 'unknown-id', type: 'Settings', dataFolders: ['/'] }, {});",
      ),
    ).rejects.toThrow(/not found/);
    expect(services.cloudCredential.update).not.toHaveBeenCalled();
  });

  it('updates the re-loaded credential and drops identity fields from the patch', async () => {
    const existing = { _id: 'cred1', type: 'CloudProviderCredential', name: 'orig' };
    (services.cloudCredential.getById as any).mockResolvedValue(existing);
    (services.cloudCredential.update as any).mockResolvedValue(existing);
    await runTag(
      "return await context.util.models.cloudCredential.update({ _id: 'cred1' }, { name: 'new', type: 'Settings', _id: 'other-id', parentId: 'other-parent' });",
    );
    const [docArg, patchArg] = (services.cloudCredential.update as any).mock.calls[0];
    expect(docArg).toBe(existing); // authoritative reloaded doc, not the caller-supplied object
    expect(patchArg).toEqual({ name: 'new' }); // type/_id/parentId stripped from the patch
  });
});

// A caller-supplied id/parentId/key shaped like a Mongo query operator (e.g. `{ $ne: null }`) must
// never reach NeDB unstringified, or it's interpreted as a query operator instead of a literal value
// — see CROSS-TENANT-DB-ACCESS-FINDINGS.md Finding 6 and templating-worker-database-coercion-surface.ts's
// static detector, which enforces this for every handler in pluginToMainAPI. These tests drive the
// real handlers end-to-end through the sandbox and assert the mocked service actually receives a
// coerced string (`String({ $ne: null })` === '[object Object]'), not merely that the source looks coerced.
describe('id-like bridge arguments are coerced to String before reaching services.* (Finding 6)', () => {
  const OPERATOR_PAYLOAD = '{ $ne: null }';
  const MODELS_READ_CAPABILITIES = ['render', 'models.read', 'util', 'crypto'];
  const STORAGE_CAPABILITIES = ['render', 'models.read', 'util', 'crypto', 'storage'];
  const CREDENTIALS_CAPABILITIES = ['render', 'models.read', 'util', 'crypto', 'credentials'];

  const runTag = (runBody: string, capabilities: string[] = MODELS_READ_CAPABILITIES) =>
    runPluginTagInSandbox(
      `module.exports.templateTags = [{ name: 't', run: async function (context) { ${runBody} } }];`,
      {
        args: [],
        pluginName: 'p',
        tagName: 't',
        context: { meta: {}, renderPurpose: 'send' as const, context: {} as any },
      },
      undefined,
      capabilities,
    );

  beforeEach(() => {
    (services.request.getById as any).mockResolvedValue(null);
    (services.workspace.getById as any).mockResolvedValue(null);
    (services.oAuth2Token.getByParentId as any).mockResolvedValue(null);
    (services.cookieJar.getOrCreateForParentId as any).mockResolvedValue({ cookies: [] });
    (services.response.getLatestForRequestId as any).mockResolvedValue(null);
    (services.cloudCredential.getById as any).mockResolvedValue(null);
    (services.pluginData.getByKey as any).mockResolvedValue(null);
    (services.pluginData.upsertByKey as any).mockResolvedValue(null);
    (services.pluginData.removeByKey as any).mockResolvedValue(null);
    vi.mocked(jarFromCookies).mockReturnValue({ getCookiesSync: () => [] } as any);
  });

  it('request.getById coerces body.id', async () => {
    await runTag(`return await context.util.models.request.getById(${OPERATOR_PAYLOAD});`);
    expect(services.request.getById).toHaveBeenCalledWith('[object Object]');
  });

  it('workspace.getById coerces body.id', async () => {
    await runTag(`return await context.util.models.workspace.getById(${OPERATOR_PAYLOAD});`);
    expect(services.workspace.getById).toHaveBeenCalledWith('[object Object]');
  });

  it('oAuth2Token.getByRequestId coerces body.parentId', async () => {
    await runTag(`return await context.util.models.oAuth2Token.getByRequestId(${OPERATOR_PAYLOAD});`);
    expect(services.oAuth2Token.getByParentId).toHaveBeenCalledWith('[object Object]');
  });

  it('cookieJar.getOrCreateForParentId coerces body.parentId', async () => {
    await runTag(`return await context.util.models.cookieJar.getOrCreateForParentId(${OPERATOR_PAYLOAD});`);
    expect(services.cookieJar.getOrCreateForParentId).toHaveBeenCalledWith('[object Object]');
  });

  it('cookieJar.getCookiesForUrl coerces body.parentId', async () => {
    await runTag(
      `return await context.util.models.cookieJar.getCookiesForUrl(${OPERATOR_PAYLOAD}, 'https://example.com');`,
    );
    expect(services.cookieJar.getOrCreateForParentId).toHaveBeenCalledWith('[object Object]');
  });

  it('response.getLatestForRequestId coerces both body.requestId and body.environmentId', async () => {
    await runTag(
      `return await context.util.models.response.getLatestForRequestId(${OPERATOR_PAYLOAD}, ${OPERATOR_PAYLOAD});`,
    );
    expect(services.response.getLatestForRequestId).toHaveBeenCalledWith('[object Object]', '[object Object]');
  });

  it('cloudCredential.getById coerces body.id', async () => {
    await runTag(
      `return await context.util.models.cloudCredential.getById(${OPERATOR_PAYLOAD});`,
      CREDENTIALS_CAPABILITIES,
    );
    expect(services.cloudCredential.getById).toHaveBeenCalledWith('[object Object]');
  });

  it('pluginData.hasItem/getItem/removeItem/setItem coerce body.key', async () => {
    await runTag(`return await context.store.hasItem(${OPERATOR_PAYLOAD});`, STORAGE_CAPABILITIES);
    expect(services.pluginData.getByKey).toHaveBeenCalledWith('p', '[object Object]');

    (services.pluginData.getByKey as any).mockClear();
    await runTag(`return await context.store.getItem(${OPERATOR_PAYLOAD});`, STORAGE_CAPABILITIES);
    expect(services.pluginData.getByKey).toHaveBeenCalledWith('p', '[object Object]');

    await runTag(`return await context.store.removeItem(${OPERATOR_PAYLOAD});`, STORAGE_CAPABILITIES);
    expect(services.pluginData.removeByKey).toHaveBeenCalledWith('p', '[object Object]');

    await runTag(`return await context.store.setItem(${OPERATOR_PAYLOAD}, 'v');`, STORAGE_CAPABILITIES);
    expect(services.pluginData.upsertByKey).toHaveBeenCalledWith('p', '[object Object]', 'v');
  });
});

describe('resolveDbByKey — app.prompt', () => {
  it('routes prompt requests to the renderer prompt bridge', async () => {
    vi.mocked(requestPromptFromRenderer).mockResolvedValueOnce('typed value');
    const token = getOrCreateTemplatingDbAuthToken();

    const response = await resolveDbByKey(
      new Request('insomnia-templating-worker-database://app.prompt', {
        method: 'post',
        headers: { [TEMPLATING_DB_AUTH_HEADER]: token },
        body: JSON.stringify({
          title: 'Title',
          options: { label: 'Label', defaultValue: 'cached value', inputType: 'password' },
        }),
      }),
    );

    await expect(response.json()).resolves.toBe('typed value');
    expect(requestPromptFromRenderer).toHaveBeenCalledWith({
      title: 'Title',
      label: 'Label',
      defaultValue: 'cached value',
      inputType: 'password',
    });
  });
});
