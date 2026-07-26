import { describe, expect, it, vi } from 'vitest';

import { describeAncestorSurface, findHandlersMissingAncestorCheck } from '../templating-worker-database-ancestor-surface';

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
vi.mock('../../common/database', () => ({ database: { withAncestors: vi.fn() } }));
vi.mock('../network/network', () => ({
  fetchRequestData: vi.fn(),
  sendCurlAndWriteTimeline: vi.fn(),
  tryToInterpolateRequest: vi.fn(),
}));
vi.mock('../network/libcurl-promise', () => ({ curlRequest: vi.fn() }));
vi.mock('../prompt-bridge', () => ({ requestPromptFromRenderer: vi.fn() }));
vi.mock('../secure-read-file', () => ({ secureReadFile: vi.fn() }));

describe('findHandlersMissingAncestorCheck', () => {
  // Enforced gate: every models.read handler (minus the documented exceptions) must call
  // recordBelongsToCallerWorkspace before trusting the record it resolved.
  it('flags nothing in the real pluginToMainAPI handler map', async () => {
    const { pluginToMainAPI } = await import('../templating-worker-database');
    expect(findHandlersMissingAncestorCheck(pluginToMainAPI)).toEqual([]);
  });

  // Positive control: a fake models.read-shaped handler with no ancestor check must be flagged.
  it('flags a fake handler that never calls recordBelongsToCallerWorkspace', () => {
    const fakeHandlers = {
      'request.getById': (body: { id: string }) => Promise.resolve(services.request.getById(body.id)),
    };
    expect(findHandlersMissingAncestorCheck(fakeHandlers)).toEqual([
      { path: 'request.getById', guarded: false },
    ]);
  });

  // Negative control: a handler that calls the guard must not be flagged.
  it('does not flag a fake handler that calls recordBelongsToCallerWorkspace', () => {
    const fakeHandlers = {
      'request.getById': async (body: { id: string; callerWorkspaceId?: string }) => {
        const record = await services.request.getById(body.id);
        if (!(await recordBelongsToCallerWorkspace(record, body.callerWorkspaceId))) {
          return null;
        }
        return record;
      },
    };
    expect(findHandlersMissingAncestorCheck(fakeHandlers)).toEqual([]);
  });

  // response.getBodyBuffer, response.setBody, and settings.get are 'models.read' capability but
  // intentionally excluded — they must never appear in the surface at all (not even as "guarded: true").
  it('excludes response.getBodyBuffer, response.setBody, and settings.get from the surface entirely', () => {
    const fakeHandlers = {
      'response.getBodyBuffer': (_body: unknown) => Promise.resolve(null),
      'response.setBody': (_body: unknown) => Promise.resolve(null),
      'settings.get': () => Promise.resolve(services.settings.get()),
    };
    expect(describeAncestorSurface(fakeHandlers)).toEqual([]);
  });

  // A handler whose capability isn't 'models.read' at all (e.g. a storage or app path) must never
  // appear in the surface, guarded or not.
  it('ignores handlers outside the models.read capability', () => {
    const fakeHandlers = {
      'pluginData.setItem': (_body: unknown) => Promise.resolve(null),
    };
    expect(describeAncestorSurface(fakeHandlers)).toEqual([]);
  });
});

// Minimal stand-ins so the fake handlers above have something call-shaped to invoke — the detector
// only ever reads `.toString()` of the handler function, it never actually calls these.
const services = {
  request: { getById: (_: unknown) => null },
  settings: { get: () => null },
};
const recordBelongsToCallerWorkspace = (_record: unknown, _callerWorkspaceId: unknown) => Promise.resolve(true);
