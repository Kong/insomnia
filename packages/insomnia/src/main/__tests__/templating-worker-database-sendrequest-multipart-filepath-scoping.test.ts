import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// network.sendRequestWithoutSideEffects's cacert/authentication fields are hardcoded regardless of
// caller input (see templating-worker-database-sendrequest-cacert-bypass.test.ts), but its `body`
// field was forwarded straight through unvalidated. A multipart/form-data body's file parts
// (`body.params[].fileName`) reach `buildMultipart` (packages/insomnia/src/main/network/multipart.ts),
// which reads each part's `fileName` off disk with no ownership/allowlist check at all -- unlike
// every other local-file read reachable from a request definition, which is checked against
// `settings.dataFolders`. A script can reach this by calling the raw `__sendRequest` bridge global
// directly (bypassing insomnia.sendRequest()'s BOOTSTRAP wrapper, which only ever builds
// `{ mimeType: 'text/plain', text }` bodies) with a multipart body naming an arbitrary local path,
// then reading the response from a URL it also controls.
//
// The fix lives entirely in the QuickJS bridge (quickjs-script-engine.ts's
// assertSupportedSendRequestBody, run before the bridge's fetch() is ever dispatched) rather than
// in this shared handler, which the legacy hidden-window sandbox and the template-tag sandbox also
// use with their own, already-privileged execution models -- see
// plugins/context/network-sendrequest-multipart-allowed.test.ts for confirmation that the legacy
// path is unaffected by this fix.

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

describe('insomnia.sendRequest(), reached via the QuickJS bridge\'s raw __sendRequest global, denies multipart file parts', () => {
  let outsideAllowedFoldersPath: string;

  beforeEach(() => {
    _testOnlyResetTemplatingDbAuthToken();
    // Deliberately outside every directory a `dataFolders`-scoped read would ever be granted --
    // standing in for a path a script chose for itself, not one the user selected or allow-listed.
    outsideAllowedFoldersPath = path.join(os.homedir(), `insomnia-audit-not-a-real-file-${process.pid}.txt`);
    fs.writeFileSync(outsideAllowedFoldersPath, 'not-a-real-secret');
  });

  afterEach(() => {
    fs.rmSync(outsideAllowedFoldersPath, { force: true });
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  const stubFetchToRealHandler = () => {
    // Stands in for Electron's real `insomnia-templating-worker-database://` protocol handler --
    // routes the bridge's fetch() straight into the real, unmocked dispatch function so this test
    // would exercise the actual auth check + handler lookup + handler body if the fix under test
    // ever let the bridge get that far.
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

  it('rejects a multipart file part before the bridge ever dispatches its fetch, even sent directly through the raw bridge global', async () => {
    const token = getOrCreateTemplatingDbAuthToken();
    const curlRequestMock = await mockCurlRequest();
    stubFetchToRealHandler();

    const requestBodyWithOutsideFilePart = JSON.stringify({
      options: {
        request: {
          url: 'https://example.com',
          method: 'POST',
          headers: [],
          body: {
            mimeType: 'multipart/form-data',
            params: [{ name: 'f', type: 'file', fileName: outsideAllowedFoldersPath }],
          },
        },
      },
    });

    // Calls the raw bridge global directly instead of going through insomnia.sendRequest(), which
    // only ever builds a `text/plain` body -- the wrapper is guest-side JS sugar the calling script
    // is free to skip entirely, not an enforcement boundary. The QuickJS-specific host-side guard
    // must reject this regardless.
    const result = await runScriptInQuickJs({
      script: `
        const raw = await __sendRequest(${JSON.stringify(requestBodyWithOutsideFilePart)});
        const envelope = JSON.parse(raw);
        insomnia.environment.set('ok', envelope.ok);
        insomnia.environment.set('error', envelope.error);
      `,
      context: baseContext(),
      authToken: token,
    });

    const env = result.environment.data as Record<string, unknown>;
    expect(env.ok).toBe(false);
    expect(env.error).toMatch(/plain-text request body/i);
    // The rejection must happen before the bridge's fetch() is ever dispatched -- the shared
    // handler (and curlRequest below it) never even sees this request.
    expect(curlRequestMock).not.toHaveBeenCalled();
  });
});
