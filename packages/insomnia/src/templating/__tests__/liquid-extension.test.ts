import { services } from 'insomnia-data';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Plugin } from '~/common/plugins/types';
import { buildLiquidEngine } from '~/common/templating/liquid-engine';
import type { PluginTemplateTag, PluginTemplateTagContext } from '~/common/templating/types';

import { createLiquidTag } from '../liquid-extension';

vi.mock('insomnia-data', () => ({
  models: { requestGroup: { type: 'RequestGroup' }, workspace: { type: 'Workspace' } },
  services: {
    request: { getById: vi.fn() },
    workspace: { getById: vi.fn() },
    oAuth2Token: { getByParentId: vi.fn() },
    cookieJar: { getOrCreateForParentId: vi.fn().mockResolvedValue({ cookies: [] }) },
    response: { getLatestForRequestId: vi.fn(), getByBodyPath: vi.fn(), getById: vi.fn() },
    helpers: { getResponseBodyBuffer: vi.fn() },
    cloudCredential: { getById: vi.fn(), update: vi.fn() },
    settings: { get: vi.fn().mockResolvedValue({}) },
  },
}));

const fakePlugin = { name: 'liquid-extension-test-plugin', directory: '' } as unknown as Plugin;

// Drives the real createLiquidTag through a real Liquid engine + real render (never a
// reimplementation), running the supplied callback as the tag's own run() body.
let currentRun: (context: PluginTemplateTagContext) => Promise<any> = async () => '';
const testTag: PluginTemplateTag = {
  name: 'test_tag',
  displayName: 'test_tag',
  description: 'test-only',
  args: [],
  run: (context: PluginTemplateTagContext) => currentRun(context),
};
const { engine } = buildLiquidEngine({
  tagFactory: (ext, plugin) => createLiquidTag(ext, plugin),
  tags: [{ templateTag: testTag, plugin: fakePlugin }],
});
const runTag = (fn: (context: PluginTemplateTagContext) => Promise<any>) => {
  currentRun = fn;
  return engine.parseAndRender('{% test_tag %}', {});
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('id-like models.* arguments are coerced to String before reaching services.* (Finding 6 parity)', () => {
  it('coerces request.getById', async () => {
    await runTag(async ctx => ctx.util.models.request.getById({ $ne: null } as any));
    expect(services.request.getById).toHaveBeenCalledWith('[object Object]');
  });

  it('coerces workspace.getById', async () => {
    await runTag(async ctx => ctx.util.models.workspace.getById({ $ne: null } as any));
    expect(services.workspace.getById).toHaveBeenCalledWith('[object Object]');
  });

  it('coerces oAuth2Token.getByRequestId', async () => {
    await runTag(async ctx => ctx.util.models.oAuth2Token.getByRequestId({ $ne: null } as any));
    expect(services.oAuth2Token.getByParentId).toHaveBeenCalledWith('[object Object]');
  });

  it('coerces cloudCredential.getById', async () => {
    await runTag(async ctx => ctx.util.models.cloudCredential.getById({ $ne: null } as any));
    expect(services.cloudCredential.getById).toHaveBeenCalledWith('[object Object]');
  });

  it('coerces cookieJar.getOrCreateForParentId', async () => {
    await runTag(async ctx => ctx.util.models.cookieJar.getOrCreateForParentId({ $ne: null } as any));
    expect(services.cookieJar.getOrCreateForParentId).toHaveBeenCalledWith('[object Object]');
  });

  it('coerces cookieJar.getCookiesForUrl', async () => {
    await runTag(async ctx => ctx.util.models.cookieJar.getCookiesForUrl({ $ne: null } as any, 'http://example.com'));
    expect(services.cookieJar.getOrCreateForParentId).toHaveBeenCalledWith('[object Object]');
  });

  it('coerces response.getLatestForRequestId requestId and environmentId', async () => {
    await runTag(async ctx =>
      ctx.util.models.response.getLatestForRequestId({ $ne: null } as any, { $ne: null } as any),
    );
    expect(services.response.getLatestForRequestId).toHaveBeenCalledWith('[object Object]', '[object Object]');
  });

  it('passes environmentId through as null rather than the string "null"', async () => {
    await runTag(async ctx => ctx.util.models.response.getLatestForRequestId('req_1', null));
    expect(services.response.getLatestForRequestId).toHaveBeenCalledWith('req_1', null);
  });
});

describe('cloudCredential.update reloads by id and strips identity fields from the patch (Finding 4 parity)', () => {
  it('rejects an unknown id without calling services.cloudCredential.update', async () => {
    (services.cloudCredential.getById as any).mockResolvedValue(null);
    await expect(
      runTag(async ctx => ctx.util.models.cloudCredential.update({ _id: 'unknown' } as any, { type: 'Settings' } as any)),
    ).rejects.toBeDefined();
    expect(services.cloudCredential.update).not.toHaveBeenCalled();
  });

  it('reloads the real credential by id and strips _id/type/parentId from the caller-supplied patch', async () => {
    const existing = { _id: 'cred_real', type: 'CloudProviderCredential', parentId: 'proj_real', name: 'old' };
    (services.cloudCredential.getById as any).mockResolvedValue(existing);
    (services.cloudCredential.update as any).mockResolvedValue({ ...existing, name: 'new' });

    await runTag(async ctx =>
      ctx.util.models.cloudCredential.update({ _id: 'cred_real' } as any, {
        _id: 'forged',
        type: 'forged-type',
        parentId: 'forged-parent',
        name: 'new',
      } as any),
    );

    expect(services.cloudCredential.getById).toHaveBeenCalledWith('cred_real');
    expect(services.cloudCredential.update).toHaveBeenCalledWith(existing, { name: 'new' });
  });
});

describe('response.getBodyBuffer re-verifies against the id-resolved response, not the caller-supplied bodyPath (Item 1 parity)', () => {
  it('when an id is supplied, ignores a forged bodyPath and reads only the id-resolved response', async () => {
    const real = { _id: 'res_real', bodyPath: '/real/path', bodyCompression: null };
    (services.response.getById as any).mockResolvedValue(real);
    (services.helpers.getResponseBodyBuffer as any).mockResolvedValue('real-body');

    const result = await runTag(async ctx =>
      ctx.util.models.response.getBodyBuffer({ _id: 'res_real', bodyPath: '/forged/victim-path' } as any, ''),
    );

    expect(services.response.getById).toHaveBeenCalledWith('res_real');
    expect(services.helpers.getResponseBodyBuffer).toHaveBeenCalledWith(real, '');
    expect(result).toBe('real-body');
  });

  it('when no id is supplied, falls back to verifying the bodyPath belongs to a known response', async () => {
    (services.response.getByBodyPath as any).mockResolvedValue(null);

    await expect(
      runTag(async ctx => ctx.util.models.response.getBodyBuffer({ bodyPath: '/unowned/path' } as any, '')),
    ).rejects.toBeDefined();
    expect(services.helpers.getResponseBodyBuffer).not.toHaveBeenCalled();
  });
});
