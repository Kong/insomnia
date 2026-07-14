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

import {
  _testOnlyResetMigrationWarnings,
  getPluginEntrySource,
  maybeWarnMissingManifest,
  runPluginTagInSandbox,
} from '../templating-worker-database';

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
