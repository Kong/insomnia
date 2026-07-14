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
    response: { getLatestForRequestId: vi.fn() },
    helpers: { getResponseBodyBuffer: vi.fn() },
    settings: { get: vi.fn() },
  },
  models: {},
}));
vi.mock('~/plugins', () => ({ getPluginCommonContext: vi.fn(), getTemplateTags: vi.fn().mockResolvedValue([]) }));
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

import { parsePluginPermissions } from '~/common/plugins/permissions';

import {
  _testOnlyResetMigrationWarnings,
  getPluginEntrySource,
  maybeWarnMissingManifest,
  readPluginModuleMap,
  runPluginTagInSandbox,
} from '../templating-worker-database';

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
