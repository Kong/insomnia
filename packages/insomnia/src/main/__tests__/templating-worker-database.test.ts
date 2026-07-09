import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { getVersion: () => '1.0.0' }, clipboard: {}, dialog: {}, shell: {} }));
vi.mock('insomnia-data', () => ({
  services: {
    request: { getById: vi.fn() },
    cloudCredential: { getById: vi.fn(), update: vi.fn() },
    workspace: { getById: vi.fn() },
    oAuth2Token: { getByParentId: vi.fn() },
    cookieJar: { getOrCreateForParentId: vi.fn() },
    response: { getLatestForRequestId: vi.fn(), getById: vi.fn() },
    helpers: { getResponseBodyBuffer: vi.fn() },
    settings: { get: vi.fn() },
  },
  models: {},
}));
vi.mock('~/plugins', () => ({ getPluginCommonContext: vi.fn(), getTemplateTags: vi.fn().mockResolvedValue([]) }));
vi.mock('~/common/cookies', () => ({ jarFromCookies: vi.fn() }));
vi.mock('../common/database', () => ({ database: {} }));
vi.mock('../network/network', () => ({ fetchRequestData: vi.fn(), sendCurlAndWriteTimeline: vi.fn(), tryToInterpolateRequest: vi.fn() }));
vi.mock('../network/libcurl-promise', () => ({ curlRequest: vi.fn() }));
vi.mock('../prompt-bridge', () => ({ requestPromptFromRenderer: vi.fn() }));
vi.mock('../secure-read-file', () => ({ secureReadFile: vi.fn() }));

import { services } from 'insomnia-data';

import { getPluginEntrySource, runPluginTagInSandbox } from '../templating-worker-database';

// Run a one-tag plugin whose `run` body is `body`, through the real pluginToMainAPI bridge (services
// mocked above). Returns the rendered string. `caps` overrides granted capabilities.
const runTag = (runBody: string, caps?: string[]) =>
  runPluginTagInSandbox(
    `module.exports.templateTags = [{ name: 't', run: async function (context) { ${runBody} } }];`,
    { args: [], pluginName: 'p', tagName: 't', context: { meta: {}, renderPurpose: 'send' as const, context: {} as any } },
    undefined,
    caps,
  );

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

describe('cloudCredential.update cannot forge type/_id to write another collection', () => {
  const CREDS = ['render', 'models.read', 'util', 'crypto', 'credentials'];

  it('rejects when the id does not resolve to an existing cloud credential', async () => {
    (services.cloudCredential.getById as any).mockResolvedValue(null);
    (services.cloudCredential.update as any).mockClear();
    await expect(
      runTag(
        "return await context.util.models.cloudCredential.update({ type: 'Settings', _id: 'settings-id', dataFolders: ['/'] }, {});",
        CREDS,
      ),
    ).rejects.toThrow(/not found/);
    expect(services.cloudCredential.update).not.toHaveBeenCalled();
  });

  it('updates the re-loaded credential and drops identity fields from the patch', async () => {
    const existing = { _id: 'cred1', type: 'CloudProviderCredential', name: 'orig' };
    (services.cloudCredential.getById as any).mockResolvedValue(existing);
    (services.cloudCredential.update as any).mockResolvedValue(existing);
    await runTag(
      "return await context.util.models.cloudCredential.update({ _id: 'cred1' }, { name: 'new', type: 'Settings', _id: 'evil' });",
      CREDS,
    );
    const [docArg, patchArg] = (services.cloudCredential.update as any).mock.calls[0];
    expect(docArg).toBe(existing); // authoritative reloaded doc, not the caller's object
    expect(patchArg).toEqual({ name: 'new' }); // type/_id stripped
  });
});

describe('id arguments are string-coerced before reaching the query layer', () => {
  it('coerces an object id to a string so it cannot become a Mongo-style operator query', async () => {
    (services.request.getById as any).mockResolvedValue(null);
    await runTag('return String(await context.util.models.request.getById({ $ne: null }));');
    // The handler must pass a primitive string, not the { $ne: null } object, to the query layer.
    expect(services.request.getById).toHaveBeenCalledWith('[object Object]');
  });

  it('coerces oAuth2Token parentId likewise', async () => {
    (services.oAuth2Token.getByParentId as any).mockResolvedValue(null);
    await runTag('return String(await context.util.models.oAuth2Token.getByRequestId({ $exists: true }));');
    expect(services.oAuth2Token.getByParentId).toHaveBeenCalledWith('[object Object]');
  });
});

describe('response.getBodyBuffer reads only the server-loaded response body', () => {
  it('reads the server-loaded response bodyPath, ignoring a plugin-supplied path', async () => {
    (services.response.getById as any).mockResolvedValue({ _id: 'r1', bodyPath: '/app/owned/body', bodyCompression: null });
    (services.helpers.getResponseBodyBuffer as any).mockImplementation(async (resp: any) => `read:${resp?.bodyPath}`);
    // The plugin fabricates bodyPath: '/etc/passwd'; the handler must re-load by _id and read only
    // the server-owned path.
    const result = await runTag(
      "return await context.util.models.response.getBodyBuffer({ _id: 'r1', bodyPath: '/etc/passwd' });",
    );
    expect(services.response.getById).toHaveBeenCalledWith('r1');
    expect(result).toBe('read:/app/owned/body');
  });

  it('returns the read-failure value (never touches disk) when the response id is unknown', async () => {
    (services.response.getById as any).mockResolvedValue(null);
    (services.helpers.getResponseBodyBuffer as any).mockClear();
    const result = await runTag(
      "return await context.util.models.response.getBodyBuffer({ bodyPath: '/etc/passwd' }, 'FAIL');",
    );
    expect(result).toBe('FAIL');
    expect(services.helpers.getResponseBodyBuffer).not.toHaveBeenCalled();
  });
});
