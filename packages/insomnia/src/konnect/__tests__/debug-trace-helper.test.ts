import { describe, expect, it } from 'vitest';

import type { DebugTraceDetail } from '../debug-session-api';
import { getRouteIdFromKonnectRouteKey, type SpanTree, summarizeTrace } from '../debug-trace-helper';

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
