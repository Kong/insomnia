import { describe, expect, it, vi } from 'vitest';

import { describeCoercionSurface, findHandlersMissingIdCoercion } from '../templating-worker-database-coercion-surface';

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
    response: { getLatestForRequestId: vi.fn(), getByBodyPath: vi.fn(), getById: vi.fn() },
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

describe('findHandlersMissingIdCoercion', () => {
  // Enforced gate: the real handler map must never regress to passing a bare id/parentId/key
  // argument straight into a services.* call — see CROSS-TENANT-DB-ACCESS-FINDINGS.md Finding 6.
  it('flags nothing in the real pluginToMainAPI handler map', async () => {
    const { pluginToMainAPI } = await import('../templating-worker-database');
    expect(findHandlersMissingIdCoercion(pluginToMainAPI)).toEqual([]);
  });

  // Positive control: a fake handler passing a bare id straight to a services.* call must be flagged.
  it('flags a fake handler that passes a bare id to a services.* call', () => {
    const fakeHandlers = {
      'fake.uncoercedId': (body: { id: string }) => Promise.resolve(services.request.getById(body.id)),
    };
    const flagged = findHandlersMissingIdCoercion(fakeHandlers);
    expect(flagged).toEqual([{ path: 'fake.uncoercedId', uncoercedFields: ['id'] }]);
  });

  // Negative control: a handler that wraps the same field in String(...) must not be flagged.
  it('does not flag a fake handler that coerces the id before the services.* call', () => {
    const fakeHandlers = {
      'fake.coercedId': (body: { id: string }) => Promise.resolve(services.request.getById(String(body.id))),
    };
    expect(findHandlersMissingIdCoercion(fakeHandlers)).toEqual([]);
  });

  // Multi-argument calls: every id-like argument in the same call must be checked independently.
  it('flags only the uncoerced argument when a call mixes a coerced and an uncoerced field', () => {
    const fakeHandlers = {
      'fake.mixed': (body: { requestId: string; environmentId: string }) =>
        Promise.resolve(services.response.getLatestForRequestId(String(body.requestId), body.environmentId)),
    };
    expect(findHandlersMissingIdCoercion(fakeHandlers)).toEqual([
      { path: 'fake.mixed', uncoercedFields: ['environmentId'] },
    ]);
  });

  // A nested call in a later argument (mirroring pluginData.setItem's String(body.value)) must not
  // cause the balanced-paren argument extraction to mis-scope an earlier, still-uncoerced field.
  it('correctly scopes argument text across a call with a nested function-call argument', () => {
    const fakeHandlers = {
      'fake.nestedCallArg': (body: { key: string; value: string }) =>
        Promise.resolve(services.pluginData.upsertByKey('plugin', body.key, String(body.value))),
    };
    expect(findHandlersMissingIdCoercion(fakeHandlers)).toEqual([
      { path: 'fake.nestedCallArg', uncoercedFields: ['key'] },
    ]);
  });

  // Negative control: an id-like field referenced outside any services.* call (e.g. compared
  // locally, or passed to a non-services helper) must not be flagged — coercion is only required at
  // the actual query boundary.
  it('does not flag an id-like field that never reaches a services.* call', () => {
    const fakeHandlers = {
      'fake.localOnly': (body: { parentId: string }) => {
        if (body.parentId !== 'expected') {
          throw new Error('mismatch');
        }
        return Promise.resolve(null);
      },
    };
    expect(findHandlersMissingIdCoercion(fakeHandlers)).toEqual([]);
  });
});

describe('describeCoercionSurface', () => {
  it('reports every handler, coerced or not', () => {
    const fakeHandlers = {
      'fake.coerced': (body: { id: string }) => Promise.resolve(services.request.getById(String(body.id))),
      'fake.uncoerced': (body: { id: string }) => Promise.resolve(services.request.getById(body.id)),
    };
    const entries = describeCoercionSurface(fakeHandlers);
    expect(entries).toEqual([
      { path: 'fake.coerced', uncoercedFields: [] },
      { path: 'fake.uncoerced', uncoercedFields: ['id'] },
    ]);
  });
});

// Minimal stand-in so the fake handlers above have something call-shaped named `services.*` to
// invoke — the detector only ever reads `.toString()` of the handler function, it never actually
// calls this.
const services = {
  request: { getById: (_: unknown) => null },
  response: { getLatestForRequestId: (_a: unknown, _b: unknown) => null },
  pluginData: { upsertByKey: (_a: unknown, _b: unknown, _c: unknown) => null },
};
