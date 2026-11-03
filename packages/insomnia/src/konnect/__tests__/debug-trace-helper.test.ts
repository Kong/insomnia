import { describe, expect, it } from 'vitest';

import type { DebugTraceDetail } from '../debug-session-api';
import { getRouteIdFromKonnectRouteKey, getRouteIdsFromTraceDetail } from '../debug-trace-helper';

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

describe('getRouteIdsFromTraceDetail', () => {
  it('collects the distinct proxy.kong.route.id values of the spans', () => {
    const traceDetail = detail('t1', [
      { 'http.route': '/a' },
      { 'proxy.kong.route.id': 'route-1' },
      { 'proxy.kong.route.id': 'route-1' },
      { 'proxy.kong.route.id': 'route-2' },
    ]);
    expect([...getRouteIdsFromTraceDetail(traceDetail)]).toEqual(['route-1', 'route-2']);
  });

  it('returns an empty set when no span has a route id', () => {
    expect(getRouteIdsFromTraceDetail(detail('t2', [{}])).size).toBe(0);
  });
});
