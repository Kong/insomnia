import { afterEach, describe, expect, it, vi } from 'vitest';

import { setFetchImplementation } from '../../common/insomnia-fetch';
import {
  createDebugSession,
  type DebugSessionApiContext,
  getDebugTrace,
  listDebugSessions,
  listDebugTraces,
  listNodeIds,
  stopDebugSession,
} from '../debug-session-api';

const ctx: DebugSessionApiContext = { pat: 'kpat_secret', region: 'us', controlPlaneId: 'cp-1' };

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

const mockFetch = (response: Response) => {
  const impl = vi.fn().mockResolvedValue(response);
  setFetchImplementation(impl);
  return impl;
};

afterEach(() => {
  setFetchImplementation((input, init) => globalThis.fetch(input, init));
});

describe('debug-api', () => {
  it('sends the PAT as a bearer token to the regional origin', async () => {
    const impl = mockFetch(json({ data: [] }));
    await listDebugSessions(ctx);
    const [url, init] = impl.mock.calls[0];
    expect(url).toMatch(/^https:\/\/us\..+\/v1\/control-planes\/cp-1\/o11y\/debug-sessions\?/);
    expect(init.headers.Authorization).toBe(`Bearer ${ctx.pat}`);
    expect(init.headers['X-Session-Id']).toBeUndefined();
  });

  it('creates a session with duration, targets and trace capture', async () => {
    const impl = mockFetch(json({ id: 's1', duration_secs: 30, started_at: '2026-01-01T00:00:00Z', targets: ['n1'] }));
    const session = await createDebugSession(ctx, 30, ['n1']);
    const [url, init] = impl.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(url).toContain('/v1/control-planes/cp-1/o11y/debug-sessions');
    expect(JSON.parse(init.body)).toMatchObject({ duration_secs: 30, targets: ['n1'], capture_traces: true });
    expect(session).toMatchObject({ id: 's1', durationSecs: 30, stoppedAt: null, timedOut: false });
  });

  it('posts to the stop endpoint', async () => {
    const impl = mockFetch(json({}));
    await stopDebugSession(ctx, 's1');
    const [url, init] = impl.mock.calls[0];
    expect(url).toContain('/debug-sessions/s1/stop');
    expect(init.method).toBe('POST');
  });

  it('requests span-scoped fields and reads the unprefixed attributes from the response', async () => {
    mockFetch(
      json({
        traces: [
          {
            trace_id: 't1',
            root_trace_name: 'kong',
            start_time_unix_nano: '10',
            duration_ms: 5,
            span_sets: [
              { spans: [{ attributes: { 'url.full': 'http://x/airports', 'http.request.method': 'GET' } }] },
              { spans: [{ attributes: { 'http.response.status_code': 200, 'http.route': '/airports' } }] },
            ],
          },
        ],
      }),
    );
    const [trace] = await listDebugTraces(ctx, 's1');
    expect(trace).toMatchObject({
      traceId: 't1',
      method: 'GET',
      url: 'http://x/airports',
      route: '/airports',
      statusCode: 200,
    });
  });

  it('flattens trace detail spans', async () => {
    mockFetch(
      json({
        resource_spans: [
          {
            scope_spans: [
              { spans: [{ span_id: 'a', name: 'kong', start_time_unix_nano: '1', end_time_unix_nano: '2' }] },
              { spans: [{ span_id: 'b', parent_span_id: 'a', name: 'rewrite', start_time_unix_nano: '1' }] },
            ],
          },
        ],
      }),
    );
    const detail = await getDebugTrace(ctx, 's1', 't1');
    expect(detail.spans.map(s => [s.spanId, s.parentSpanId])).toEqual([
      ['a', null],
      ['b', 'a'],
    ]);
  });

  it('reads node ids from either items or data', async () => {
    mockFetch(json({ items: [{ id: 'n1' }, { id: 'n2' }] }));
    expect(await listNodeIds(ctx)).toEqual(['n1', 'n2']);
  });

  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [500, 'unknown'],
  ])('maps HTTP %s to %s', async (status, kind) => {
    mockFetch(json({ title: 'x' }, status));
    await expect(listDebugSessions(ctx)).rejects.toMatchObject({ kind });
  });

  it('maps 429 to rate_limited and keeps Retry-After', async () => {
    mockFetch(json({}, 429, { 'Retry-After': '7' }));
    await expect(listDebugSessions(ctx)).rejects.toMatchObject({ kind: 'rate_limited', retryAfterMs: 7000 });
  });

  it('maps thrown fetch errors to network', async () => {
    setFetchImplementation(vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(listDebugSessions(ctx)).rejects.toMatchObject({ kind: 'network' });
  });
});
