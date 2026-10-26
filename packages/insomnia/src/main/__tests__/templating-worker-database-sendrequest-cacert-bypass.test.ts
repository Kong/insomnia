import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// insomnia.sendRequest()'s own doc comment (quickjs-script-engine.ts) says the QuickJS script
// sandbox's request bridge supports only { url, method, headers, body } -- "no auth, client
// certificates, cookies". That's enforced only by the guest-side JS wrapper (BOOTSTRAP), which
// hardcodes caCertficatePath to null before calling the real bridge global, __sendRequest.
// __sendRequest itself is a bare, unguarded globalThis function that takes a raw JSON string and
// forwards it, unvalidated, to network.sendRequestWithoutSideEffects's real dispatch path
// (resolveDbByKey -> pluginToMainAPI). That handler reads body.options.caCertficatePath with no
// ownership/allowlist check and hands it straight to curlRequest, which loads it via
// insecureReadFile -- the function secure-read-file.ts itself documents as being "for reading
// files selected by the user via a file dialog", not for a value chosen by a running script. A
// script can skip the wrapper entirely and call __sendRequest directly, exceeding the sandbox's
// documented capability.

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
    helpers: {
      getResponseBodyBuffer: vi.fn(),
      readCurlResponse: vi.fn().mockResolvedValue({ body: '{}' }),
    },
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

import type { RequestContext } from '../../../../insomnia-scripting-environment/src/objects/interfaces';
import { runScriptInQuickJs } from '../../scripting/quickjs-script-engine';
import {
  _testOnlyResetTemplatingDbAuthToken,
  getOrCreateTemplatingDbAuthToken,
} from '../templating-worker-database-auth';

const baseContext = (): RequestContext => ({
  request: { _id: 'req_1', name: 'Test request', url: 'https://example.com' } as any,
  timelinePath: '',
  environment: { id: 'env_1', name: 'Base Environment', data: {} },
  baseEnvironment: { id: 'env_1', name: 'Base Environment', data: {} },
  timeout: 30_000,
  settings: { timeout: 30_000 } as any,
  clientCertificates: [],
  cookieJar: { cookies: [] } as any,
  requestInfo: {} as any,
  execution: {} as any,
  logs: [],
  transientVariables: { name: 'transientVariables', data: {} },
  parentFolders: [],
});

describe('network.sendRequestWithoutSideEffects, reached via the QuickJS bridge\'s raw __sendRequest global, gates caCertficatePath', () => {
  let outsideCertPath: string;

  beforeEach(() => {
    _testOnlyResetTemplatingDbAuthToken();
    // Deliberately outside every directory secureReadFile's allowlist would ever grant
    // (os.tmpdir(), userData, or a configured data folder) -- standing in for a path a script
    // chose on its own, not one a user selected via a file dialog.
    outsideCertPath = path.join(os.homedir(), `insomnia-audit-not-a-real-cert-${process.pid}.pem`);
    fs.writeFileSync(outsideCertPath, 'not-a-real-certificate');
  });

  afterEach(() => {
    fs.rmSync(outsideCertPath, { force: true });
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  const stubFetchToRealHandler = () => {
    // Stands in for Electron's real `insomnia-templating-worker-database://` protocol handler,
    // which is registered via `protocol.handle(interface, resolveDbByKey)` in api.protocol.ts --
    // routes the bridge's fetch() straight into the real, unmocked dispatch function so this test
    // exercises the actual auth check + handler lookup + handler body, not a re-implementation of
    // them.
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      const { resolveDbByKey } = await import('../templating-worker-database');
      return resolveDbByKey(new Request(url, init));
    });
  };

  const mockCurlRequest = async () => {
    const { curlRequest } = await import('../network/libcurl-promise');
    const curlRequestMock = curlRequest as unknown as ReturnType<typeof vi.fn>;
    curlRequestMock.mockResolvedValue({
      headerResults: [{ code: 200, reason: 'OK', headers: [] }],
      patch: { elapsedTime: 1, bodyCompression: null },
      responseBodyPath: '/dev/null',
    });
    return curlRequestMock;
  };

  it('never forwards a caller-chosen caCertficatePath to curlRequest, even sent directly through the raw bridge global', async () => {
    const token = getOrCreateTemplatingDbAuthToken();
    const curlRequestMock = await mockCurlRequest();
    stubFetchToRealHandler();

    const requestBodyWithOutsideCertPath = JSON.stringify({
      options: {
        request: { url: 'https://example.com', method: 'GET', headers: [] },
        caCertficatePath: outsideCertPath,
      },
    });

    // Calls the raw bridge global directly instead of going through insomnia.sendRequest(),
    // which is the only place that hardcodes caCertficatePath to null -- the wrapper is guest-side
    // JS sugar the calling script is free to skip entirely, not an enforcement boundary.
    const result = await runScriptInQuickJs({
      script: `
        const raw = await __sendRequest(${JSON.stringify(requestBodyWithOutsideCertPath)});
        const envelope = JSON.parse(raw);
        insomnia.environment.set('ok', envelope.ok);
      `,
      context: baseContext(),
      authToken: token,
    });

    // The request itself still goes through (this endpoint's job) -- what must never happen is
    // the host handler honoring a caller-supplied caCertficatePath. secureReadFile enforces this
    // exact entitlement boundary elsewhere in this codebase; a path a running script picked for
    // itself is never one it was granted.
    expect((result.environment.data as Record<string, unknown>).ok).toBe(true);
    expect(curlRequestMock).toHaveBeenCalledTimes(1);
    expect(curlRequestMock.mock.calls[0][0]).toMatchObject({ caCertficatePath: null });
  });

  it('never lets a caller-supplied authentication object override the safe default, even sent directly through the raw bridge global', async () => {
    const token = getOrCreateTemplatingDbAuthToken();
    const curlRequestMock = await mockCurlRequest();
    stubFetchToRealHandler();

    const requestBodyWithInjectedAuth = JSON.stringify({
      options: {
        request: {
          url: 'https://example.com',
          method: 'GET',
          headers: [],
          authentication: { type: 'basic', username: 'chosen-by-script', password: 'chosen-by-script' },
        },
      },
    });

    const result = await runScriptInQuickJs({
      script: `
        const raw = await __sendRequest(${JSON.stringify(requestBodyWithInjectedAuth)});
        const envelope = JSON.parse(raw);
        insomnia.environment.set('ok', envelope.ok);
      `,
      context: baseContext(),
      authToken: token,
    });

    expect((result.environment.data as Record<string, unknown>).ok).toBe(true);
    expect(curlRequestMock).toHaveBeenCalledTimes(1);
    expect(curlRequestMock.mock.calls[0][0]).toMatchObject({
      req: expect.objectContaining({ authentication: { type: 'none' } }),
    });
  });
});
