import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildPathNormalizationVariant, findHandlersThatBypassBodyPathOwnership, findUnguardedBodyPathWrites } from '../templating-worker-database-surface';

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

// Dynamic counterpart: findUnguardedBodyPathWrites can only see whether a trust-check call is
// textually present in a handler's source, not whether it's actually awaited before the write it's
// meant to gate. These tests exercise the real handlers (and a deliberately tricky fake one) to
// prove the regex scan has a blind spot the dynamic probe doesn't.
describe('findHandlersThatBypassBodyPathOwnership (dynamic, non-regex)', () => {
  let dataDir: string;
  let victimBodyPath: string;
  let previousDataPath: string | undefined;

  beforeEach(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-data-'));
    const responsesDir = path.join(dataDir, 'responses');
    fs.mkdirSync(responsesDir);
    victimBodyPath = path.join(responsesDir, 'victim-response-body.txt');
    fs.writeFileSync(victimBodyPath, 'victim-original-body');

    previousDataPath = process.env['INSOMNIA_DATA_PATH'];
    process.env['INSOMNIA_DATA_PATH'] = dataDir;

    const { services } = await import('insomnia-data');
    (services.response.getByBodyPath as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (bodyPath: string) =>
        bodyPath === victimBodyPath ? { _id: 'res_victim', parentId: 'req_victim', bodyPath: victimBodyPath } : null,
    );
  });

  afterEach(() => {
    if (previousDataPath === undefined) {
      delete process.env['INSOMNIA_DATA_PATH'];
    } else {
      process.env['INSOMNIA_DATA_PATH'] = previousDataPath;
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  // Enforced gate: the real handler map's writes must actually be gated at runtime, not just look
  // gated to the static scan.
  it('flags nothing in the real pluginToMainAPI handler map', async () => {
    const { pluginToMainAPI } = await import('../templating-worker-database');
    const violations = await findHandlersThatBypassBodyPathOwnership(pluginToMainAPI, {
      victimBodyPath,
      victimParentId: 'req_victim',
      attackerParentId: 'req_attacker',
    });
    expect(violations).toEqual([]);
  });

  it('regex detector reads a write-before-check handler as guarded; the dynamic probe catches the real bypass', async () => {
    const fakeHandlers = {
      'fake.writeBeforeCheck': (body: { bodyPath: string; parentId: string; bodyBase64?: string }) => {
        fs.writeFileSync(body.bodyPath, Buffer.from(body.bodyBase64 || '', 'base64'));
        // A real-shaped, correctly-named ownership check -- but its rejection surfaces only after
        // the write already landed, so it provides no actual protection.
        return assertFakeOwnershipAsync(body).then(() => null);
      },
    };

    // The static scan sees a file write, a body.bodyPath reference, and a correctly-named
    // assert*Ownership call, so it reports this handler as safe.
    expect(findUnguardedBodyPathWrites(fakeHandlers)).toEqual([]);

    // The dynamic probe observes the actual write and is not fooled by call order.
    const violations = await findHandlersThatBypassBodyPathOwnership(fakeHandlers, {
      victimBodyPath,
      victimParentId: 'req_victim',
      attackerParentId: 'req_attacker',
    });
    expect(violations).toEqual(['fake.writeBeforeCheck']);
  });

  // Negative control: a handler that awaits its ownership check before writing must not be flagged.
  it('does not flag a fake handler whose ownership check is properly awaited before the write', async () => {
    const fakeHandlers = {
      'fake.properlyGuardedWrite': async (body: { bodyPath: string; parentId: string; bodyBase64?: string }) => {
        await assertFakeOwnershipAsync(body);
        fs.writeFileSync(body.bodyPath, Buffer.from(body.bodyBase64 || '', 'base64'));
        return null;
      },
    };
    const violations = await findHandlersThatBypassBodyPathOwnership(fakeHandlers, {
      victimBodyPath,
      victimParentId: 'req_victim',
      attackerParentId: 'req_attacker',
    });
    expect(violations).toEqual([]);
  });

  // PR #10294 bug class: an ownership check that looks up the caller-supplied bodyPath by exact
  // string equality (mirroring a real NeDB `findOne({ bodyPath })` lookup), while the write itself
  // targets `path.resolve(bodyPath)`. A textually different bodyPath that resolves to the identical
  // absolute file misses the exact-match lookup (no owner found -> no throw) while the write still
  // lands on the victim file. This is a distinct blind spot from the write-before-check case above:
  // the check here genuinely runs first and is awaited — it just checks the wrong string.
  it('detects a fake handler whose ownership check exact-matches bodyPath but writes to the resolved path', async () => {
    const fakeHandlers = {
      'fake.checkRawThenWriteResolved': async (body: { bodyPath: string; parentId: string; bodyBase64?: string }) => {
        const existing = body.bodyPath === victimBodyPath ? { parentId: 'req_victim' } : null;
        if (existing && existing.parentId !== body.parentId) {
          throw new Error('body.bodyPath belongs to a different response than the one being processed');
        }
        fs.writeFileSync(path.resolve(body.bodyPath), Buffer.from(body.bodyBase64 || '', 'base64'));
        return null;
      },
    };
    const violations = await findHandlersThatBypassBodyPathOwnership(fakeHandlers, {
      victimBodyPath,
      victimParentId: 'req_victim',
      attackerParentId: 'req_attacker',
    });
    expect(violations).toEqual(['fake.checkRawThenWriteResolved']);
  });

  // Negative control mirroring the fix: resolving the bodyPath before the ownership lookup (so the
  // check and the write agree on which file they mean) closes the gap above.
  it('does not flag a fake handler that resolves the bodyPath before checking ownership', async () => {
    const fakeHandlers = {
      'fake.resolveThenCheck': async (body: { bodyPath: string; parentId: string; bodyBase64?: string }) => {
        const resolved = path.resolve(body.bodyPath);
        const existing = resolved === victimBodyPath ? { parentId: 'req_victim' } : null;
        if (existing && existing.parentId !== body.parentId) {
          throw new Error('body.bodyPath belongs to a different response than the one being processed');
        }
        fs.writeFileSync(resolved, Buffer.from(body.bodyBase64 || '', 'base64'));
        return null;
      },
    };
    const violations = await findHandlersThatBypassBodyPathOwnership(fakeHandlers, {
      victimBodyPath,
      victimParentId: 'req_victim',
      attackerParentId: 'req_attacker',
    });
    expect(violations).toEqual([]);
  });

  it('buildPathNormalizationVariant produces a distinct string that resolves to the same absolute path', () => {
    const variant = buildPathNormalizationVariant(victimBodyPath);
    expect(variant).not.toBe(victimBodyPath);
    expect(path.resolve(variant)).toBe(path.resolve(victimBodyPath));
  });
});

function assertFakeOwnershipAsync(body: { parentId: string }) {
  return Promise.resolve().then(() => {
    if (body.parentId !== 'req_victim') {
      throw new Error('body.bodyPath belongs to a different response than the one being processed');
    }
  });
}
