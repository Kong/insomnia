import { describe, expect, it } from 'vitest';

import type { KonnectPlugin } from '../api';
import { getPluginScopes, resolveKonnectSyncedRoute, selectApplicablePlugins } from '../plugin-scope';

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

  it('resolves a gRPC route key', () => {
    expect(
      resolveKonnectSyncedRoute(
        { konnectRouteKey: 'route-1:grpc:/hello.HelloService/SayHello:grpc' },
        { konnectServiceId: 'service-1' },
        { konnectControlPlaneId: 'cp-1', konnectRegion: 'us', name: 'CP' },
      ),
    ).toEqual(expect.objectContaining({ routeId: 'route-1', protocol: 'grpc' }));
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

describe('getPluginScopes', () => {
  it('returns every configured scope', () => {
    const scopedPlugin = plugin({
      id: 'p-scoped',
      name: 'key-auth',
      route: { id: 'route-1' },
      service: { id: 'service-1' },
      consumer: { id: 'consumer-1' },
      consumer_group: { id: 'group-1' },
    });

    expect(getPluginScopes(scopedPlugin)).toEqual(['route', 'service', 'consumer', 'consumer-group']);
  });

  it('falls back to the control plane scope', () => {
    expect(getPluginScopes(plugin({ id: 'p-global', name: 'cors' }))).toEqual(['global']);
  });
});

describe('selectApplicablePlugins', () => {
  it('returns applicable plugins in API order', () => {
    const result = selectApplicablePlugins(
      [
        plugin({ id: 'p-route', name: 'key-auth', route: { id: 'route-1' } }),
        plugin({ id: 'p-service', name: 'rate-limiting', service: { id: 'service-1' } }),
        plugin({ id: 'p-global', name: 'cors' }),
      ],
      syncedRoute,
    );

    expect(result.plugins.map(plugin => plugin.id)).toEqual(['p-route', 'p-service', 'p-global']);
  });

  it('excludes plugins scoped to another route or another service', () => {
    const result = selectApplicablePlugins(
      [
        plugin({ id: 'p-other-route', name: 'key-auth', route: { id: 'route-2' } }),
        plugin({ id: 'p-other-service', name: 'cors', service: { id: 'service-2' } }),
      ],
      syncedRoute,
    );

    expect(result.plugins).toEqual([]);
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

    expect(result.plugins.map(plugin => plugin.id)).toEqual(['p-global', 'p-route']);
    expect(result.appliedNames).toEqual(['rate-limiting']);
  });

  it.each([
    ['consumer', { consumer: { id: 'consumer-1' } }],
    ['consumer group', { consumer_group: { id: 'group-1' } }],
    ['condition', { condition: 'http.path == "/flights"' }],
  ])('keeps %s scoped plugins', (_label, overrides) => {
    const scopedPlugin = plugin({ id: 'p-scoped', name: 'key-auth', route: { id: 'route-1' }, ...overrides });
    const result = selectApplicablePlugins([scopedPlugin], syncedRoute);

    expect(result.plugins).toEqual([scopedPlugin]);
    expect(result.appliedNames).toEqual(['key-auth']);
  });

  it('keeps disabled plugins visible', () => {
    const result = selectApplicablePlugins(
      [plugin({ id: 'p-disabled', name: 'cors', enabled: false })],
      syncedRoute,
    );

    expect(result.plugins).toEqual([expect.objectContaining({ id: 'p-disabled', enabled: false })]);
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

  it('keeps plugins that support gRPC', () => {
    const result = selectApplicablePlugins(
      [
        plugin({ id: 'p-grpc', name: 'key-auth', protocols: ['grpc'] }),
        plugin({ id: 'p-http', name: 'cors', protocols: ['http'] }),
      ],
      { ...syncedRoute, protocol: 'grpc' },
    );

    expect(result.plugins.map(plugin => plugin.id)).toEqual(['p-grpc']);
    expect(result.appliedNames).toEqual(['key-auth']);
  });
});
