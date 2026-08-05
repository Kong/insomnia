import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

// response.getBodyBuffer is response.setBody's read-side sibling; #10294 added an ownership check
// (assertResponseBodyPathOwnership) only to the write side. assertResponseBodyPathReadOwnership
// covers the read side: it restricts response.getBodyBuffer to bodyPaths that belong to an
// already-persisted response.

vi.mock('electron', () => ({
  app: { getVersion: () => '1.0.0', getPath: () => '/fake/userData' },
  clipboard: { readText: vi.fn(), writeText: vi.fn(), clear: vi.fn() },
  dialog: { showMessageBox: vi.fn() },
  shell: { openExternal: vi.fn() },
  BrowserWindow: { getAllWindows: () => [] },
}));
vi.mock('insomnia-data', async () => {
  // Delegate to the real implementation so this test exercises an actual file read, not a mock.
  const nodeReal = await vi.importActual<{ servicesNodeImpl: { helpers: { getResponseBodyBuffer: (...args: any[]) => any } } }>('insomnia-data/node');
  return {
    services: {
      request: { getById: vi.fn() },
      workspace: { getById: vi.fn() },
      oAuth2Token: { getByParentId: vi.fn() },
      cookieJar: { getOrCreateForParentId: vi.fn() },
      response: { getLatestForRequestId: vi.fn(), getByBodyPath: vi.fn() },
      helpers: { getResponseBodyBuffer: nodeReal.servicesNodeImpl.helpers.getResponseBodyBuffer },
      pluginData: { getByKey: vi.fn(), upsertByKey: vi.fn(), removeByKey: vi.fn(), removeAll: vi.fn(), all: vi.fn() },
      cloudCredential: { getById: vi.fn(), update: vi.fn() },
      settings: { get: vi.fn().mockResolvedValue({}) },
    },
  };
});
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

describe('response.getBodyBuffer restricts reads to bodyPaths owned by a known response', () => {
  let outsidePath: string;
  const OUTSIDE_CONTENTS = 'unrelated-file-contents';

  const writeOutsideFile = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-outside-responses-'));
    const file = path.join(dir, 'file.txt');
    fs.writeFileSync(file, OUTSIDE_CONTENTS);
    return file;
  };

  it('rejects a bodyPath that belongs to no known response', async () => {
    outsidePath = writeOutsideFile();
    const { pluginToMainAPI } = await import('../templating-worker-database');
    await expect(
      pluginToMainAPI['response.getBodyBuffer']({ response: { bodyPath: outsidePath } }),
    ).rejects.toThrow(/does not belong to any known response/);
  });

  it('allows reading the body of a response that owns its bodyPath', async () => {
    outsidePath = writeOutsideFile();
    const { services } = await import('insomnia-data');
    // mockResolvedValueOnce: must not leak into later tests, which rely on getByBodyPath's default
    // (unconfigured -> undefined) to prove the check rejects an unrecognized bodyPath.
    (services.response.getByBodyPath as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      _id: 'res_own', parentId: 'req_1', bodyPath: outsidePath,
    });
    const { pluginToMainAPI } = await import('../templating-worker-database');
    const result = await pluginToMainAPI['response.getBodyBuffer']({
      response: { bodyPath: outsidePath },
    });
    expect(result.toString('utf8')).toBe(OUTSIDE_CONTENTS);
  });

  it('restricts a template tag with only default (no-manifest) baseline capabilities from reading outside a known response, end to end through the real sandbox', async () => {
    outsidePath = writeOutsideFile();

    const { pluginToMainAPI } = await import('../templating-worker-database');
    const { createMapBridge, TEMPLATE_TAG_BASELINE_CAPABILITIES } = await import('../../templating/sandbox/host-bridge');
    const { TEMPLATE_TAG_BASELINE_MODULES } = await import('../../templating/sandbox/module-registry');
    const { runTagInSandbox } = await import('../../templating/sandbox/plugin-tag-sandbox');

    // The real production bridge, wired to the real production handler map — no reimplementation.
    const bridge = createMapBridge(pluginToMainAPI);

    // A plugin declaring no permissions; models.read (and so response.getBodyBuffer) is baseline.
    const pluginSource = `
      module.exports.templateTags = [{
        name: 'readPath',
        run: function (context, filePath) {
          return context.util.models.response.getBodyBuffer({ bodyPath: filePath }).then(function (raw) {
            var bytes = (raw && raw.data) || [];
            var out = '';
            for (var i = 0; i < bytes.length; i++) { out += String.fromCharCode(bytes[i]); }
            return out;
          });
        }
      }];`;

    await expect(
      runTagInSandbox({
        pluginSource,
        tagName: 'readPath',
        bridge,
        envelope: {
          args: [outsidePath],
          context: {},
          meta: {},
          renderPurpose: 'preview',
          appInfo: { version: '0.0.0', platform: 'linux', arch: 'arm64' },
          pluginName: 'no-manifest-plugin',
          renderDepth: 0,
          grantedModules: TEMPLATE_TAG_BASELINE_MODULES,
          grantedCapabilities: TEMPLATE_TAG_BASELINE_CAPABILITIES,
        },
      }),
    ).rejects.toThrow(/does not belong to any known response/);
  });
});
