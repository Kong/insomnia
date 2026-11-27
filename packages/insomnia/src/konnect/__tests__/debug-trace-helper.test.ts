import { describe, expect, it } from 'vitest';

import type { DebugSession, DebugTraceDetail } from '../debug-session-api';
import {
  COMPLETING_TIMEOUT_MS,
  deriveSessionState,
  getRouteIdFromKonnectRouteKey,
  type SpanTree,
  summarizeTrace,
} from '../debug-trace-helper';

const detail = (traceId: string, attributes: Record<string, any>[]): DebugTraceDetail => ({
  traceId,
  spans: attributes.map((attrs, i) => ({
    spanId: `${traceId}-${i}`,
    parentSpanId: null,
    name: 'span',
    startTimeUnixNano: '0',
    endTimeUnixNano: '0',
    attributes: attrs,
  })),
});

describe('getRouteIdFromKonnectRouteKey', () => {
  it('extracts the route id from the key', () => {
    expect(getRouteIdFromKonnectRouteKey('route-uuid-1:GET:/explicit-methods:https')).toBe('route-uuid-1');
  });

  it('is not confused by colons in the path segment', () => {
    expect(getRouteIdFromKonnectRouteKey('route-uuid-1:GET:/users/:id:http')).toBe('route-uuid-1');
  });

  it('returns null for missing keys', () => {
    expect(getRouteIdFromKonnectRouteKey(null)).toBeNull();
    expect(getRouteIdFromKonnectRouteKey('')).toBeNull();
  });
});

describe('summarizeTrace', () => {
  const treeWith = (attributes: Record<string, any>): SpanTree => ({
    roots: [
      {
        span: { ...detail('t1', [attributes]).spans[0] },
        name: 'span',
        depth: 0,
        startOffsetMs: 0,
        durationMs: 1,
        children: [],
      },
    ],
    totalMs: 1,
  });

  it('reads the route id, method, protocol and url scheme from the latency span', () => {
    const summary = summarizeTrace(
      treeWith({
        'proxy.kong.latency.total': 10,
        'proxy.kong.route.id': 'route-1',
        'http.request.method': 'GET',
        'network.protocol.name': 'http',
        'url.scheme': 'https',
      }),
    );
    expect(summary).toMatchObject({ routeId: 'route-1', method: 'GET', protocol: 'http', urlScheme: 'https' });
  });

  it('defaults the route fields to empty strings when absent', () => {
    const summary = summarizeTrace(treeWith({ 'proxy.kong.latency.total': 10 }));
    expect(summary).toMatchObject({ routeId: '', method: '', protocol: '', urlScheme: '' });
  });
});

describe('deriveSessionState', () => {
  const startedAt = '2026-11-01T00:00:00.000Z';
  const endsAt = new Date(startedAt).getTime() + 30 * 1000;
  const session = (overrides: Partial<DebugSession> = {}) =>
    ({
      startedAt,
      durationSecs: 30,
      timedOut: false,
      stoppedAt: null,
      completedAt: null,
      ...overrides,
    }) as DebugSession;

  it('is active before the expected end time', () => {
    expect(deriveSessionState(session({ timedOut: true }), endsAt - 1)).toBe('active');
  });

  it('is completing after the end time within the completing timeout', () => {
    expect(deriveSessionState(session(), endsAt + COMPLETING_TIMEOUT_MS - 1)).toBe('completing');
    expect(deriveSessionState(session({ timedOut: true }), endsAt + COMPLETING_TIMEOUT_MS - 1)).toBe('completing');
  });

  it('is timed_out when completing exceeds the timeout and the server reports timedOut', () => {
    expect(deriveSessionState(session({ timedOut: true }), endsAt + COMPLETING_TIMEOUT_MS)).toBe('timed_out');
  });

  it('is polling_timed_out when completing exceeds the timeout and the server never reports timedOut', () => {
    expect(deriveSessionState(session(), endsAt + COMPLETING_TIMEOUT_MS)).toBe('polling_timed_out');
  });

  it('prefers cancelled and completed over timed_out', () => {
    const now = endsAt + COMPLETING_TIMEOUT_MS * 2;
    expect(deriveSessionState(session({ timedOut: true, stoppedAt: startedAt }), now)).toBe('cancelled');
    expect(deriveSessionState(session({ timedOut: true, completedAt: startedAt }), now)).toBe('completed');
  });
});
