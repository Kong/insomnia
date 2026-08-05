import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildPathNormalizationVariant, findHandlersThatBypassBodyPathOwnership, findHandlersThatLeakArbitraryBodyPathReads, findUnguardedBodyPathWrites } from '../templating-worker-database-surface';

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
  // Enforced gate: the real handler map must never regress to an unguarded write choke point.
  it('flags nothing in the real pluginToMainAPI handler map', async () => {
    const { pluginToMainAPI } = await import('../templating-worker-database');
    expect(findUnguardedBodyPathWrites(pluginToMainAPI)).toEqual([]);
  });

  // Positive control: an unguarded fake handler must be flagged.
  it('flags a fake handler that writes to a body-path-derived location with no trust check', () => {
    const fakeHandlers = {
      'fake.unguardedWrite': (body: { bodyPath: string; data: string }) => {
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
    expect(flagged.map(f => f.path)).toEqual(['fake.unguardedWrite']);
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
  let otherBodyPath: string;
  let previousDataPath: string | undefined;

  beforeEach(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-data-'));
    const responsesDir = path.join(dataDir, 'responses');
    fs.mkdirSync(responsesDir);
    otherBodyPath = path.join(responsesDir, 'other-response-body.txt');
    fs.writeFileSync(otherBodyPath, 'other-original-body');

    previousDataPath = process.env['INSOMNIA_DATA_PATH'];
    process.env['INSOMNIA_DATA_PATH'] = dataDir;

    const { services } = await import('insomnia-data');
    (services.response.getByBodyPath as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (bodyPath: string) =>
        bodyPath === otherBodyPath ? { _id: 'res_other', parentId: 'req_other', bodyPath: otherBodyPath } : null,
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
      otherBodyPath,
      otherParentId: 'req_other',
      callerParentId: 'req_caller',
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
      otherBodyPath,
      otherParentId: 'req_other',
      callerParentId: 'req_caller',
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
      otherBodyPath,
      otherParentId: 'req_other',
      callerParentId: 'req_caller',
    });
    expect(violations).toEqual([]);
  });

  // An ownership check that exact-matches bodyPath (mirroring an NeDB `findOne({ bodyPath })`
  // lookup) while the write itself resolves it first misses a textually different, same-file path.
  it('detects a fake handler whose ownership check exact-matches bodyPath but writes to the resolved path', async () => {
    const fakeHandlers = {
      'fake.checkRawThenWriteResolved': async (body: { bodyPath: string; parentId: string; bodyBase64?: string }) => {
        const existing = body.bodyPath === otherBodyPath ? { parentId: 'req_other' } : null;
        if (existing && existing.parentId !== body.parentId) {
          throw new Error('body.bodyPath belongs to a different response than the one being processed');
        }
        fs.writeFileSync(path.resolve(body.bodyPath), Buffer.from(body.bodyBase64 || '', 'base64'));
        return null;
      },
    };
    const violations = await findHandlersThatBypassBodyPathOwnership(fakeHandlers, {
      otherBodyPath,
      otherParentId: 'req_other',
      callerParentId: 'req_caller',
    });
    expect(violations).toEqual(['fake.checkRawThenWriteResolved']);
  });

  // Negative control mirroring the fix: resolving the bodyPath before the ownership lookup (so the
  // check and the write agree on which file they mean) closes the gap above.
  it('does not flag a fake handler that resolves the bodyPath before checking ownership', async () => {
    const fakeHandlers = {
      'fake.resolveThenCheck': async (body: { bodyPath: string; parentId: string; bodyBase64?: string }) => {
        const resolved = path.resolve(body.bodyPath);
        const existing = resolved === otherBodyPath ? { parentId: 'req_other' } : null;
        if (existing && existing.parentId !== body.parentId) {
          throw new Error('body.bodyPath belongs to a different response than the one being processed');
        }
        fs.writeFileSync(resolved, Buffer.from(body.bodyBase64 || '', 'base64'));
        return null;
      },
    };
    const violations = await findHandlersThatBypassBodyPathOwnership(fakeHandlers, {
      otherBodyPath,
      otherParentId: 'req_other',
      callerParentId: 'req_caller',
    });
    expect(violations).toEqual([]);
  });

  it('buildPathNormalizationVariant produces a distinct string that resolves to the same absolute path', () => {
    const variant = buildPathNormalizationVariant(otherBodyPath);
    expect(variant).not.toBe(otherBodyPath);
    expect(path.resolve(variant)).toBe(path.resolve(otherBodyPath));
  });
});

function assertFakeOwnershipAsync(body: { parentId: string }) {
  return Promise.resolve().then(() => {
    if (body.parentId !== 'req_other') {
      throw new Error('body.bodyPath belongs to a different response than the one being processed');
    }
  });
}

// Read-side counterpart of findHandlersThatBypassBodyPathOwnership: judges each handler by whether its return value discloses a path's contents.
describe('findHandlersThatLeakArbitraryBodyPathReads (dynamic, non-regex)', () => {
  let outsideDir: string;
  let outsidePath: string;
  const outsideContents = 'unrelated-file-contents';

  beforeEach(async () => {
    outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-outside-responses-'));
    outsidePath = path.join(outsideDir, 'file.txt');
    fs.writeFileSync(outsidePath, outsideContents);

    const { services } = await import('insomnia-data');
    (services.helpers.getResponseBodyBuffer as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (response: { bodyPath?: string }) => (response?.bodyPath ? fs.promises.readFile(response.bodyPath) : Buffer.alloc(0)),
    );
  });

  afterEach(() => {
    fs.rmSync(outsideDir, { recursive: true, force: true });
  });

  // Enforced gate: real reads are restricted at runtime by assertResponseBodyPathReadOwnership.
  it('flags nothing in the real pluginToMainAPI handler map', async () => {
    const { pluginToMainAPI } = await import('../templating-worker-database');
    const violations = await findHandlersThatLeakArbitraryBodyPathReads(pluginToMainAPI, {
      outsidePath,
      outsideContents,
    });
    expect(violations).toEqual([]);
  });

  // Positive control: an unrestricted fake handler must be flagged.
  it('flags a fake handler that returns the raw contents of a caller-supplied bodyPath', async () => {
    const fakeHandlers = {
      'fake.unrestrictedRead': async (body: { response?: { bodyPath?: string } }) =>
        body.response?.bodyPath ? fs.promises.readFile(body.response.bodyPath) : Buffer.alloc(0),
    };
    const violations = await findHandlersThatLeakArbitraryBodyPathReads(fakeHandlers, { outsidePath, outsideContents });
    expect(violations).toEqual(['fake.unrestrictedRead']);
  });

  // Negative control: a handler that never touches the caller-supplied bodyPath must not be flagged.
  it('does not flag a fake handler that only reads a caller-independent, pre-resolved path', async () => {
    const fakeHandlers = {
      'fake.guardedRead': async () => Buffer.from('unrelated-owned-content'),
    };
    const violations = await findHandlersThatLeakArbitraryBodyPathReads(fakeHandlers, { outsidePath, outsideContents });
    expect(violations).toEqual([]);
  });

  // Negative control: a handler with its own containment check must not be flagged.
  it('does not flag a fake handler that enforces containment before reading', async () => {
    const fakeHandlers = {
      'fake.containedRead': async (body: { response?: { bodyPath?: string } }) => {
        const bodyPath = body.response?.bodyPath;
        const responsesDir = path.join(os.tmpdir(), 'insomnia-fake-responses');
        if (!bodyPath || !path.resolve(bodyPath).startsWith(path.resolve(responsesDir) + path.sep)) {
          throw new Error('bodyPath escapes the responses directory');
        }
        return fs.promises.readFile(bodyPath);
      },
    };
    const violations = await findHandlersThatLeakArbitraryBodyPathReads(fakeHandlers, { outsidePath, outsideContents });
    expect(violations).toEqual([]);
  });
});
