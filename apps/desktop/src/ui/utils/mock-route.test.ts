import type { MockRoute } from 'insomnia-data';
import { describe, expect, it } from 'vitest';

import { findConflictingMockRoute, isSameMockRouteTarget } from './mock-route';

const buildRoute = (overrides: Partial<MockRoute> = {}): MockRoute =>
  ({
    _id: 'mock-route',
    type: 'MockRoute',
    parentId: 'mock-server_pokedex',
    modified: 0,
    created: 0,
    isPrivate: false,
    name: '/pokedex/134',
    method: 'GET',
    body: '',
    headers: [],
    statusCode: 200,
    statusText: '',
    mimeType: 'application/json',
    ...overrides,
  }) as MockRoute;

describe('isSameMockRouteTarget', () => {
  it('matches identical method and path', () => {
    expect(isSameMockRouteTarget({ name: '/pokedex/134', method: 'GET' }, { name: '/pokedex/134', method: 'GET' })).toBe(true);
  });

  it('treats method comparison as case-insensitive', () => {
    expect(isSameMockRouteTarget({ name: '/pokedex/134', method: 'get' }, { name: '/pokedex/134', method: 'GET' })).toBe(true);
  });

  it('does not match when the method differs', () => {
    expect(isSameMockRouteTarget({ name: '/pokedex/134', method: 'GET' }, { name: '/pokedex/134', method: 'POST' })).toBe(false);
  });

  it('does not match when the path differs', () => {
    expect(isSameMockRouteTarget({ name: '/pokedex/134', method: 'GET' }, { name: '/pokedex/133', method: 'GET' })).toBe(false);
  });
});

describe('findConflictingMockRoute', () => {
  it('rejects same path with same method (uniqueness on the method+path pair)', () => {
    const existingRoutes = [buildRoute({ _id: 'a', name: '/pokedex/134', method: 'GET' })];

    const conflict = findConflictingMockRoute({ existingRoutes, name: '/pokedex/134', method: 'GET' });

    expect(conflict?._id).toBe('a');
  });

  it('allows same path with a different method (GET /member and POST /member)', () => {
    const existingRoutes = [buildRoute({ _id: 'a', name: '/pokedex/134', method: 'GET' })];

    const conflict = findConflictingMockRoute({ existingRoutes, name: '/pokedex/134', method: 'POST' });

    expect(conflict).toBeUndefined();
  });

  it('allows a different path with the same method', () => {
    const existingRoutes = [buildRoute({ _id: 'a', name: '/pokedex/134', method: 'GET' })];

    const conflict = findConflictingMockRoute({ existingRoutes, name: '/pokedex/133', method: 'GET' });

    expect(conflict).toBeUndefined();
  });

  it('ignores method casing when detecting a conflict', () => {
    const existingRoutes = [buildRoute({ _id: 'a', name: '/pokedex/134', method: 'GET' })];

    const conflict = findConflictingMockRoute({ existingRoutes, name: '/pokedex/134', method: 'get' });

    expect(conflict?._id).toBe('a');
  });

  it('excludes the route currently being edited so it does not conflict with itself', () => {
    const existingRoutes = [buildRoute({ _id: 'a', name: '/pokedex/134', method: 'GET' })];

    const conflict = findConflictingMockRoute({
      existingRoutes,
      name: '/pokedex/134',
      method: 'GET',
      excludeId: 'a',
    });

    expect(conflict).toBeUndefined();
  });

  it('still detects a conflict with a sibling route when editing', () => {
    const existingRoutes = [
      buildRoute({ _id: 'a', name: '/pokedex/134', method: 'GET' }),
      buildRoute({ _id: 'b', name: '/pokedex/135', method: 'POST' }),
    ];

    // Editing route "b" to collide with route "a".
    const conflict = findConflictingMockRoute({
      existingRoutes,
      name: '/pokedex/134',
      method: 'GET',
      excludeId: 'b',
    });

    expect(conflict?._id).toBe('a');
  });

  it('returns undefined when there are no existing routes', () => {
    const conflict = findConflictingMockRoute({ existingRoutes: [], name: '/pokedex/134', method: 'GET' });

    expect(conflict).toBeUndefined();
  });
});
