import fs from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { findUnguardedBodyPathWrites } from '../templating-worker-database-surface';

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

describe('findUnguardedBodyPathWrites', () => {
  // Enforced gate: the real handler map must never regress to the bug class found in PR #10286
  // (a write choke point on a body-path-derived location with no inline trust check).
  it('flags nothing in the real pluginToMainAPI handler map', async () => {
    const { pluginToMainAPI } = await import('../templating-worker-database');
    expect(findUnguardedBodyPathWrites(pluginToMainAPI)).toEqual([]);
  });

  // Positive control: proves the detector isn't vacuously passing by constructing a small,
  // intentionally-vulnerable fake handler map and asserting it IS flagged.
  it('flags a fake handler that writes to a body-path-derived location with no trust check', () => {
    const fakeHandlers = {
      'fake.vulnerableWrite': (body: { bodyPath: string; data: string }) => {
        fs.writeFileSync(body.bodyPath, body.data);
        return Promise.resolve(null);
      },
      'fake.guardedWrite': (body: { bodyPath: string; data: string }) => {
        assertFakeOwnership(body);
        fs.writeFileSync(body.bodyPath, body.data);
        return Promise.resolve(null);
      },
      'fake.readOnly': (body: { bodyPath: string }) => {
        return Promise.resolve(fs.readFileSync(body.bodyPath));
      },
    };
    const flagged = findUnguardedBodyPathWrites(fakeHandlers);
    expect(flagged.map(f => f.path)).toEqual(['fake.vulnerableWrite']);
  });
});

function assertFakeOwnership(body: { bodyPath: string }) {
  if (!body.bodyPath) {
    throw new Error('missing bodyPath');
  }
}
