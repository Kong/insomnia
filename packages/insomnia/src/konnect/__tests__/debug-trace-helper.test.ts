import { describe, expect, it } from 'vitest';

import type { DebugTraceDetail } from '../debug-session-api';
import { findTraceIdsByRouteId, getRouteIdFromKonnectRouteKey } from '../debug-trace-helper';

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

describe('findTraceIdsByRouteId', () => {
  const details = new Map([
    ['t1', detail('t1', [{ 'http.route': '/a' }, { 'proxy.kong.route.id': 'route-1' }])],
    ['t2', detail('t2', [{ 'proxy.kong.route.id': 'route-2' }])],
    ['t3', detail('t3', [{}])],
  ]);

  it('matches traces having a span with the same proxy.kong.route.id', () => {
    expect([...findTraceIdsByRouteId(details, 'route-1')]).toEqual(['t1']);
  });

  it('matches nothing without a route id', () => {
    expect(findTraceIdsByRouteId(details, null).size).toBe(0);
  });
});
