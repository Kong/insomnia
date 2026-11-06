import { describe, expect, it } from 'vitest';

import type { KonnectPlugin } from '../api';
import { getRequestProtocol, resolveKonnectRouteLink, selectEffectivePlugins } from '../plugin-scope';

const link = { routeId: 'route-1', serviceId: 'service-1' };

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

describe('resolveKonnectRouteLink', () => {
  it('extracts the route id from the composite route key', () => {
    expect(
      resolveKonnectRouteLink(
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
    });
  });

  it.each<
    [
      string,
      Parameters<typeof resolveKonnectRouteLink>[0],
      Parameters<typeof resolveKonnectRouteLink>[1],
      Parameters<typeof resolveKonnectRouteLink>[2],
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
    expect(resolveKonnectRouteLink(request, workspace, project)).toBeNull();
  });
});

describe('getRequestProtocol', () => {
  it.each([
    ['http://{{ _.proxy_host }}/flights', 'http'],
    ['HTTPS://example.com', 'https'],
    ['grpc://localhost:9000', 'grpc'],
    ['{{ _.proxy_url }}/flights', null],
    ['/relative/path', null],
  ])('returns the protocol for %s', (url, expected) => {
    expect(getRequestProtocol(url)).toBe(expected);
  });
});

describe('selectEffectivePlugins', () => {
  it('groups plugins by route, service, and control plane scope', () => {
    const result = selectEffectivePlugins(
      [
        plugin({ id: 'p-route', name: 'key-auth', route: { id: 'route-1' } }),
        plugin({ id: 'p-service', name: 'rate-limiting', service: { id: 'service-1' } }),
        plugin({ id: 'p-global', name: 'cors' }),
      ],
      link,
      'http',
    );

    expect(result.groups).toEqual([
      { scope: 'route', plugins: [expect.objectContaining({ id: 'p-route' })] },
      { scope: 'service', plugins: [expect.objectContaining({ id: 'p-service' })] },
      { scope: 'global', plugins: [expect.objectContaining({ id: 'p-global' })] },
    ]);
  });

  it('keeps a route + service plugin in the route group', () => {
    const result = selectEffectivePlugins(
      [plugin({ id: 'p-both', name: 'key-auth', route: { id: 'route-1' }, service: { id: 'service-1' } })],
      link,
      'http',
    );

    expect(result.groups[0].plugins).toHaveLength(1);
    expect(result.groups[1].plugins).toHaveLength(0);
  });

  it('excludes plugins scoped to another route or another service', () => {
    const result = selectEffectivePlugins(
      [
        plugin({ id: 'p-other-route', name: 'key-auth', route: { id: 'route-2' } }),
        plugin({ id: 'p-other-service', name: 'cors', service: { id: 'service-2' } }),
      ],
      link,
      'http',
    );

    expect(result.groups.every(group => group.plugins.length === 0)).toBe(true);
    expect(result.appliedNames).toEqual([]);
  });

  it('shows every applicable instance of the same plugin name', () => {
    const result = selectEffectivePlugins(
      [
        plugin({ id: 'p-global', name: 'rate-limiting' }),
        plugin({ id: 'p-route', name: 'rate-limiting', route: { id: 'route-1' } }),
      ],
      link,
      'http',
    );

    expect(result.groups[0].plugins).toEqual([expect.objectContaining({ id: 'p-route' })]);
    expect(result.groups[2].plugins).toEqual([expect.objectContaining({ id: 'p-global' })]);
    expect(result.appliedNames).toEqual(['rate-limiting']);
  });

  it('shows service and global instances separately', () => {
    const result = selectEffectivePlugins(
      [
        plugin({ id: 'p-global', name: 'rate-limiting' }),
        plugin({ id: 'p-service', name: 'rate-limiting', service: { id: 'service-1' } }),
      ],
      link,
      'http',
    );

    expect(result.groups[1].plugins).toEqual([expect.objectContaining({ id: 'p-service' })]);
    expect(result.groups[2].plugins).toEqual([expect.objectContaining({ id: 'p-global' })]);
  });

  it.each([
    ['consumer', { consumer: { id: 'consumer-1' } }],
    ['consumer group', { consumer_group: { id: 'group-1' } }],
    ['condition', { condition: 'http.path == "/flights"' }],
  ])('reports %s scoped instances as conditional', (_label, overrides) => {
    const result = selectEffectivePlugins(
      [plugin({ id: 'p-conditional', name: 'key-auth', route: { id: 'route-1' }, ...overrides })],
      link,
      'http',
    );

    expect(result.conditional).toEqual([expect.objectContaining({ id: 'p-conditional' })]);
    expect(result.groups[0].plugins).toHaveLength(0);
    expect(result.appliedNames).toEqual(['key-auth']);
  });

  it('keeps disabled plugins visible and counts them as configured', () => {
    const result = selectEffectivePlugins([plugin({ id: 'p-disabled', name: 'cors', enabled: false })], link, 'http');

    expect(result.groups[2].plugins).toEqual([expect.objectContaining({ id: 'p-disabled', enabled: false })]);
    expect(result.appliedNames).toEqual(['cors']);
  });

  it('excludes plugins whose protocols do not match the request', () => {
    const result = selectEffectivePlugins(
      [
        plugin({ id: 'p-grpc', name: 'key-auth', protocols: ['grpc'] }),
        plugin({ id: 'p-http', name: 'cors', protocols: ['http', 'https'] }),
      ],
      link,
      'https',
    );

    expect(result.appliedNames).toEqual(['cors']);
  });

  it('does not filter by protocol when the request protocol is unknown', () => {
    const result = selectEffectivePlugins(
      [plugin({ id: 'p-grpc', name: 'key-auth', protocols: ['grpc'] })],
      link,
      null,
    );

    expect(result.appliedNames).toEqual(['key-auth']);
  });

  it('keeps every tied instance in API order', () => {
    const result = selectEffectivePlugins(
      [
        plugin({ id: 'p-first', name: 'zz-plugin', route: { id: 'route-1' } }),
        plugin({ id: 'p-second', name: 'aa-plugin', route: { id: 'route-1' } }),
      ],
      link,
      'http',
    );

    expect(result.groups[0].plugins).toEqual([
      expect.objectContaining({ id: 'p-first' }),
      expect.objectContaining({ id: 'p-second' }),
    ]);
  });
});
