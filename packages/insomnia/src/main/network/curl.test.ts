// @ts-nocheck
import { Curl } from '@getinsomnia/node-libcurl';
import electron from 'electron';
import { services } from 'insomnia-data';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { registerCurlHandlers } from './curl';

// `openCurlConnection` isn't exported (it's only wired up via `ipcMainHandle`), so we
// register the real handlers once and pull the handler function out of the mocked
// `electron.ipcMain.handle` calls instead of exporting an internal for tests only.
let openCurlConnection: (event: unknown, options: unknown) => Promise<void>;

beforeAll(() => {
  registerCurlHandlers();
  const call = electron.ipcMain.handle.mock.calls.find(([channel]) => channel === 'curl.open');
  openCurlConnection = call[1];
});

const baseRenderedRequest = (overrides: Record<string, unknown> = {}) => ({
  _id: `req_curl_test_${Math.random().toString(36).slice(2)}`,
  parentId: 'wrk_curl_test',
  name: 'Test',
  method: 'GET',
  url: 'https://example.com',
  headers: [],
  body: {},
  authentication: { type: 'none' },
  parameters: [],
  pathParameters: [],
  settingSendCookies: false,
  settingStoreCookies: false,
  settingFollowRedirects: 'global',
  settingRebuildPath: true,
  cookies: [],
  cookieJar: { cookies: [] },
  suppressUserAgent: false,
  ...overrides,
});

describe('openCurlConnection', () => {
  let workspaceId: string;

  beforeEach(async () => {
    await services.settings.getOrCreate();
    const workspace = await services.workspace.create();
    workspaceId = workspace._id;
  });

  const setOptCallsFor = (spy: ReturnType<typeof vi.spyOn>, option: string) =>
    spy.mock.calls.filter(([name]) => name === option);

  it('sends exactly the headers on the rendered request, without re-reading a separate stored copy', async () => {
    const setOptSpy = vi.spyOn(Curl.prototype, 'setOpt');
    vi.spyOn(Curl.prototype, 'perform').mockImplementation(() => {});

    await openCurlConnection({}, {
      workspaceId,
      renderedRequest: baseRenderedRequest({
        headers: [{ name: 'Accept', value: 'text/event-stream' }],
      }),
    });

    const httpHeaderCalls = setOptCallsFor(setOptSpy, Curl.option.HTTPHEADER);
    expect(httpHeaderCalls).toHaveLength(1);
    const headers: string[] = httpHeaderCalls[0][1];
    expect(headers.filter(h => h.startsWith('Accept:'))).toEqual(['Accept: text/event-stream']);
  });

  it('signs the request using the authentication on the rendered request', async () => {
    const setOptSpy = vi.spyOn(Curl.prototype, 'setOpt');
    vi.spyOn(Curl.prototype, 'perform').mockImplementation(() => {});

    await openCurlConnection({}, {
      workspaceId,
      renderedRequest: baseRenderedRequest({
        authentication: { type: 'basic', username: 'render-user', password: 'render-pass' },
      }),
    });

    const headers: string[] = setOptCallsFor(setOptSpy, Curl.option.HTTPHEADER)[0][1];
    const expectedAuth = `Basic ${Buffer.from('render-user:render-pass').toString('base64')}`;
    expect(headers).toEqual(expect.arrayContaining([`Authorization: ${expectedAuth}`]));
  });

  it('sends the body text from the rendered request as POSTFIELDS', async () => {
    const setOptSpy = vi.spyOn(Curl.prototype, 'setOpt');
    vi.spyOn(Curl.prototype, 'perform').mockImplementation(() => {});

    await openCurlConnection({}, {
      workspaceId,
      renderedRequest: baseRenderedRequest({
        method: 'POST',
        body: { mimeType: 'application/json', text: '{"hello":"world"}' },
      }),
    });

    const postFieldsCalls = setOptCallsFor(setOptSpy, Curl.option.POSTFIELDS);
    expect(postFieldsCalls[0][1]).toBe('{"hello":"world"}');
  });

  it('keys the connection registry by the rendered request id, rejecting a second connect for the same id', async () => {
    const setOptSpy = vi.spyOn(Curl.prototype, 'setOpt');
    vi.spyOn(Curl.prototype, 'perform').mockImplementation(() => {});
    const renderedRequest = baseRenderedRequest();

    await openCurlConnection({}, { workspaceId, renderedRequest });
    await openCurlConnection({}, { workspaceId, renderedRequest });

    expect(setOptCallsFor(setOptSpy, Curl.option.HTTPHEADER)).toHaveLength(1);
  });
});
