import { describe, expect, it, vi } from 'vitest';

import { BRIDGE_PATH_CAPABILITIES } from '../../templating/sandbox/host-bridge';
import { HANDLER_INVENTORY, NON_DB_BRIDGE_PATHS } from '../templating-worker-database-inventory';
import { findUnguardedBodyPathWrites } from '../templating-worker-database-surface';

// Same mock surface as templating-worker-database-surface.test.ts: importing pluginToMainAPI pulls in
// electron + insomnia-data, which aren't available under vitest.
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

const loadHandlerKeys = async (): Promise<string[]> => {
  const { pluginToMainAPI } = await import('../templating-worker-database');
  return Object.keys(pluginToMainAPI);
};

describe('S1: bridge-handler scoping inventory', () => {
  it('G1 — covers exactly the live pluginToMainAPI handler set (no drift)', async () => {
    const liveKeys = (await loadHandlerKeys()).sort();
    const inventoryKeys = HANDLER_INVENTORY.map(e => e.path).sort();
    // A new handler with no inventory row, or a stale row for a removed handler, fails here.
    expect(inventoryKeys).toEqual(liveKeys);
  });

  it('G1b — has no duplicate rows', () => {
    const keys = HANDLER_INVENTORY.map(e => e.path);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('G2 — each row’s capability matches BRIDGE_PATH_CAPABILITIES exactly (null iff host-only)', () => {
    for (const e of HANDLER_INVENTORY) {
      const mapped = BRIDGE_PATH_CAPABILITIES[e.path] ?? null;
      expect(e.capability, `capability mismatch for ${e.path}`).toBe(mapped);
    }
  });

  it('G3 — no blanks: every row has ≥1 guard and a blast radius', () => {
    for (const e of HANDLER_INVENTORY) {
      expect(e.guards.length, `${e.path} has no guard`).toBeGreaterThan(0);
      expect(e.blastRadius.trim().length, `${e.path} has no blast radius`).toBeGreaterThan(0);
    }
  });

  it('G3b — plugin-facing rows are capability-gated; host-only rows never rely on the (bypassable) capability', () => {
    for (const e of HANDLER_INVENTORY) {
      if (e.capability !== null) {
        // Reachable from inside the sandbox → must be bridge-gated.
        expect(e.guards, `plugin-facing ${e.path} must list 'capability'`).toContain('capability');
      } else {
        // Directly dispatchable, not capability-gated: kwburns' #10286 lesson — the bridge capability
        // is NOT a defense here, so a host-only handler must name a real inline guard instead.
        expect(e.guards, `host-only ${e.path} must not claim 'capability' as a guard`).not.toContain('capability');
        expect(
          e.guards.some(g => g !== 'none'),
          `host-only ${e.path} must name a real guard`,
        ).toBe(true);
      }
    }
  });

  it('G4 — every capability path maps to a live handler (or a known non-DB bridge path)', async () => {
    const liveKeys = new Set(await loadHandlerKeys());
    for (const path of Object.keys(BRIDGE_PATH_CAPABILITIES)) {
      const known = liveKeys.has(path) || NON_DB_BRIDGE_PATHS.includes(path);
      expect(known, `capability path '${path}' has no handler and is not an allowlisted non-DB bridge path`).toBe(true);
    }
  });

  it('G5 — no file-write handler reaches its write with an unguarded caller bodyPath', async () => {
    const { pluginToMainAPI } = await import('../templating-worker-database');
    // Cross-check the static write detector against the rows we classified as fs-write.
    expect(findUnguardedBodyPathWrites(pluginToMainAPI)).toEqual([]);
    for (const e of HANDLER_INVENTORY.filter(e => e.sideEffect === 'fs-write')) {
      expect(e.guards, `${e.path} writes files but has no ownership guard`).toContain('body-path-ownership');
    }
  });
});
