import { describe, expect, it } from 'vitest';

import type { KonnectPlugin } from '../api';
import { resolveKonnectSyncedRoute, selectApplicablePlugins } from '../plugin-scope';

const syncedRoute = { routeId: 'route-1', serviceId: 'service-1', protocol: 'http' };

function plugin(overrides: Partial<KonnectPlugin> & Pick<KonnectPlugin, 'id' | 'name'>): KonnectPlugin {
  return {
    instance_name: null,
    enabled: true,
    config: null,
    protocols: null,
    tags: null,
    condition: null,
    ordering: null,
    route: null,
    service: null,
    consumer: null,
    consumer_group: null,
    ...overrides,
  };
}

describe('resolveKonnectSyncedRoute', () => {
  it('extracts the route id from the composite route key', () => {
    expect(
      resolveKonnectSyncedRoute(
        { konnectRouteKey: 'route-1:GET:/flights:http' },
        { konnectServiceId: 'service-1' },
        { konnectControlPlaneId: 'cp-1', konnectRegion: 'us', name: 'Insomnia Airlines' },
      ),
    ).toEqual({
      controlPlaneId: 'cp-1',
      controlPlaneName: 'Insomnia Airlines',
      region: 'us',
      serviceId: 'service-1',
      routeId: 'route-1',
      protocol: 'http',
    });
  });

  it('reads the protocol from the last key segment when the path contains a colon', () => {
    expect(
      resolveKonnectSyncedRoute(
        { konnectRouteKey: 'route-1:GET:/api/:id:https' },
        { konnectServiceId: 'service-1' },
        { konnectControlPlaneId: 'cp-1', konnectRegion: 'us', name: 'CP' },
      ),
    ).toEqual(expect.objectContaining({ routeId: 'route-1', protocol: 'https' }));
  });

  it.each<
    [
      string,
      Parameters<typeof resolveKonnectSyncedRoute>[0],
      Parameters<typeof resolveKonnectSyncedRoute>[1],
      Parameters<typeof resolveKonnectSyncedRoute>[2],
    ]
  >([
    [
      'missing route key',
      {},
      { konnectServiceId: 'service-1' },
      { konnectControlPlaneId: 'cp-1', konnectRegion: 'us', name: 'CP' },
    ],
    [
      'missing service',
      { konnectRouteKey: 'route-1:GET:/flights:http' },
      {},
      { konnectControlPlaneId: 'cp-1', konnectRegion: 'us', name: 'CP' },
    ],
    [
      'missing control plane',
      { konnectRouteKey: 'route-1:GET:/flights:http' },
      { konnectServiceId: 'service-1' },
      { name: 'CP' },
    ],
    [
      'missing region',
      { konnectRouteKey: 'route-1:GET:/flights:http' },
      { konnectServiceId: 'service-1' },
      { konnectControlPlaneId: 'cp-1', name: 'CP' },
    ],
  ])('returns null for %s', (_label, request, workspace, project) => {
    expect(resolveKonnectSyncedRoute(request, workspace, project)).toBeNull();
  });
});

describe('selectApplicablePlugins', () => {
  it('groups plugins by route, service, and control plane scope', () => {
    const result = selectApplicablePlugins(
      [
        plugin({ id: 'p-route', name: 'key-auth', route: { id: 'route-1' } }),
        plugin({ id: 'p-service', name: 'rate-limiting', service: { id: 'service-1' } }),
        plugin({ id: 'p-global', name: 'cors' }),
      ],
      syncedRoute,
    );

    expect(result.groups).toEqual([
      { scope: 'route', plugins: [expect.objectContaining({ id: 'p-route' })] },
      { scope: 'service', plugins: [expect.objectContaining({ id: 'p-service' })] },
      { scope: 'global', plugins: [expect.objectContaining({ id: 'p-global' })] },
    ]);
  });

  it('keeps a route + service plugin in the route group', () => {
    const result = selectApplicablePlugins(
      [plugin({ id: 'p-both', name: 'key-auth', route: { id: 'route-1' }, service: { id: 'service-1' } })],
      syncedRoute,
    );

    expect(result.groups[0].plugins).toHaveLength(1);
    expect(result.groups[1].plugins).toHaveLength(0);
  });

  it('excludes plugins scoped to another route or another service', () => {
    const result = selectApplicablePlugins(
      [
        plugin({ id: 'p-other-route', name: 'key-auth', route: { id: 'route-2' } }),
        plugin({ id: 'p-other-service', name: 'cors', service: { id: 'service-2' } }),
      ],
      syncedRoute,
    );

    expect(result.groups.every(group => group.plugins.length === 0)).toBe(true);
    expect(result.appliedNames).toEqual([]);
  });

  it('shows every applicable instance of the same plugin name', () => {
    const result = selectApplicablePlugins(
      [
        plugin({ id: 'p-global', name: 'rate-limiting' }),
        plugin({ id: 'p-route', name: 'rate-limiting', route: { id: 'route-1' } }),
      ],
      syncedRoute,
    );

    expect(result.groups[0].plugins).toEqual([expect.objectContaining({ id: 'p-route' })]);
    expect(result.groups[2].plugins).toEqual([expect.objectContaining({ id: 'p-global' })]);
    expect(result.appliedNames).toEqual(['rate-limiting']);
  });

  it('shows service and global instances separately', () => {
    const result = selectApplicablePlugins(
      [
        plugin({ id: 'p-global', name: 'rate-limiting' }),
        plugin({ id: 'p-service', name: 'rate-limiting', service: { id: 'service-1' } }),
      ],
      syncedRoute,
    );

    expect(result.groups[1].plugins).toEqual([expect.objectContaining({ id: 'p-service' })]);
    expect(result.groups[2].plugins).toEqual([expect.objectContaining({ id: 'p-global' })]);
  });

  it.each([
    ['consumer', { consumer: { id: 'consumer-1' } }],
    ['consumer group', { consumer_group: { id: 'group-1' } }],
    ['condition', { condition: 'http.path == "/flights"' }],
  ])('reports %s scoped instances as conditional', (_label, overrides) => {
    const result = selectApplicablePlugins(
      [plugin({ id: 'p-conditional', name: 'key-auth', route: { id: 'route-1' }, ...overrides })],
      syncedRoute,
    );

    expect(result.conditional).toEqual([expect.objectContaining({ id: 'p-conditional' })]);
    expect(result.groups[0].plugins).toHaveLength(0);
    expect(result.appliedNames).toEqual(['key-auth']);
  });

  it('keeps disabled plugins visible and counts them as configured', () => {
    const result = selectApplicablePlugins(
      [plugin({ id: 'p-disabled', name: 'cors', enabled: false })],
      syncedRoute,
    );

    expect(result.groups[2].plugins).toEqual([expect.objectContaining({ id: 'p-disabled', enabled: false })]);
    expect(result.appliedNames).toEqual(['cors']);
  });

  it('excludes plugins whose protocols do not match the request', () => {
    const result = selectApplicablePlugins(
      [
        plugin({ id: 'p-grpc', name: 'key-auth', protocols: ['grpc'] }),
        plugin({ id: 'p-http', name: 'cors', protocols: ['http', 'https'] }),
      ],
      { ...syncedRoute, protocol: 'https' },
    );

    expect(result.appliedNames).toEqual(['cors']);
  });

  it('keeps every tied instance in API order', () => {
    const result = selectApplicablePlugins(
      [
        plugin({ id: 'p-first', name: 'zz-plugin', route: { id: 'route-1' } }),
        plugin({ id: 'p-second', name: 'aa-plugin', route: { id: 'route-1' } }),
      ],
      syncedRoute,
    );

    expect(result.groups[0].plugins).toEqual([
      expect.objectContaining({ id: 'p-first' }),
      expect.objectContaining({ id: 'p-second' }),
    ]);
  });
});
