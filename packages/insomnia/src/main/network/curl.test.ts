// @ts-nocheck
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Curl } from '@getinsomnia/node-libcurl';
import electron from 'electron';
import { services } from 'insomnia-data';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { registerCurlHandlers } from './curl';

// `openCurlConnection` isn't exported (it's only wired up via `ipcMainHandle`), so we
// register the real handlers once and pull the handler function out of the mocked
// `electron.ipcMain.handle` calls instead of exporting an internal for tests only.
let openCurlConnection: (event: unknown, options: unknown) => Promise<void>;
let findCurlEvents: (event: unknown, options: { responseId: string }) => Promise<unknown[]>;

beforeAll(() => {
  registerCurlHandlers();
  const call = electron.ipcMain.handle.mock.calls.find(([channel]) => channel === 'curl.open');
  openCurlConnection = call[1];
  const findManyCall = electron.ipcMain.handle.mock.calls.find(([channel]) => channel === 'curl.event.findMany');
  findCurlEvents = findManyCall[1];
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

describe('curl.event.findMany', () => {
  // The streaming connection writes its NDJSON event log to the response's `bodyPath`, exactly where
  // the plain HTTP send path stores a raw body, so the content is what tells the two apart.
  const createResponseWithBody = async (body: string) => {
    const bodyPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-curl-events-')), 'body.response');
    fs.writeFileSync(bodyPath, body);
    const response = await services.response.create({ parentId: 'req_find_many_test', bodyPath }, 20);
    return response._id;
  };

  const messageEvent = (id: string, data: string) => ({
    _id: id,
    requestId: 'req_find_many_test',
    type: 'message',
    timestamp: 1,
    data,
    direction: 'INCOMING',
  });

  it('returns the events written by the streaming connection', async () => {
    const first = messageEvent('evt_1', 'hello');
    const second = messageEvent('evt_2', 'world');
    const responseId = await createResponseWithBody(`${JSON.stringify(first)}\n${JSON.stringify(second)}\n`);

    // Newest first.
    await expect(findCurlEvents({}, { responseId })).resolves.toEqual([second, first]);
  });

  it('never reads a plain HTTP response body as events', async () => {
    // Regression: flipping the request to `Accept: text/event-stream` while an HTTP response is
    // active used to hand that JSON body to the event log table, which then threw
    // "Could not determine key for item" and blanked the whole response pane.
    const responseId = await createResponseWithBody(JSON.stringify({ id: '1' }));

    await expect(findCurlEvents({}, { responseId })).resolves.toEqual([]);
  });

  it('skips lines that are not events', async () => {
    // Pretty printed bodies, a line being appended while the stream is still open, and any other
    // junk must be dropped rather than parsed into keyless "events".
    const event = messageEvent('evt_1', 'hello');
    const responseId = await createResponseWithBody(
      `{\n  "id": "1"\n}\n${JSON.stringify(event)}\n{"_id":"evt_2","requestId":"req_find_many_test","ty`,
    );

    await expect(findCurlEvents({}, { responseId })).resolves.toEqual([event]);
  });
});
