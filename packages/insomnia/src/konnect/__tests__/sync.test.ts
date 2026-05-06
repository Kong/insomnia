/**
 * Tests run against the in-memory NeDB initialized by setup-vitest.ts.
 * fetch is mocked per-test to return shaped Konnect API responses.
 * window.main is stubbed globally so trackSegmentEvent calls don't throw.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { initDatabase, models, type Request,services as insoservices } from '~/insomnia-data';

import { database as db } from '../../common/database';
import { mainDatabase } from '../../main/database.main';
import { resetV4Counter } from '../../models/__mocks__/uuid';
import type { KonnectControlPlane, KonnectRoute, KonnectService } from '../api';
import { syncKonnect } from '../sync';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ORG_ID = 'org_test';

/** Minimal valid control plane */
function makeCp(overrides: Partial<KonnectControlPlane> = {}): KonnectControlPlane {
  return {
    id: 'cp-1',
    name: 'My CP',
    description: '',
    config: {
      cluster_type: 'CLUSTER_TYPE_HYBRID',
      control_plane_endpoint: 'https://abc123.us.cp0.konghq.com',
    },
    proxy_urls: null,
    ...overrides,
  };
}

/** Minimal valid service */
function makeService(overrides: Partial<KonnectService> = {}): KonnectService {
  return {
    id: 'svc-1',
    name: 'User Service',
    protocol: 'http',
    host: 'upstream.example.com',
    port: 80,
    path: null,
    enabled: true,
    tags: null,
    ...overrides,
  };
}

/** Minimal valid route — HTTP GET with a path */
function makeRoute(overrides: Partial<KonnectRoute> = {}): KonnectRoute {
  return {
    id: 'route-1',
    name: null,
    methods: ['GET'],
    paths: ['/api/v1/users'],
    protocols: ['http', 'https'],
    hosts: null,
    headers: null,
    snis: null,
    expression: null,
    service: { id: 'svc-1' },
    ...overrides,
  };
}

/**
 * Builds a fetch mock that returns the given CPs, services, and routes.
 * - Control planes: page-number pagination (meta.page.total)
 * - Services / routes: cursor pagination (offset field)
 */
function mockFetch(
  cps: KonnectControlPlane[],
  services: KonnectService[],
  routes: KonnectRoute[],
) {
  const json = (data: unknown) =>
    new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });

  return vi.fn(async (url: string) => {
    // Must check most-specific patterns first to avoid ambiguous substring matches.
    if (url.includes('/routes')) {
      return json({ data: routes, offset: null });
    }
    if (url.includes('/services')) {
      return json({ data: services, offset: null });
    }
    if (url.includes('global.api.konghq.com/v2/control-planes')) {
      return json({ data: cps, meta: { page: { total: cps.length, size: 100, number: 1 } } });
    }
    return new Response('Not found', { status: 404 });
  });
}

/**
 * NeDB's `$ne: null` matches documents where the field is absent (legacy records).
 * Always post-filter to get only genuinely Konnect-managed records.
 */
const konnectRequests = (docs: any[]) => docs.filter((r: any) => r.konnectRouteKey != null);
const konnectWorkspaces = (docs: any[]) => docs.filter((w: any) => w.konnectServiceId != null);
const konnectProjects = (docs: any[]) => docs.filter((p: any) => p.konnectControlPlaneId != null);

const trackSegmentEvent = vi.fn();

beforeEach(async () => {
  // Re-init with fresh in-memory NeDB buckets — clean slate for every test.
  await initDatabase(mainDatabase, { inMemoryOnly: true }, true);
  resetV4Counter();
  vi.stubGlobal('window', { main: { trackSegmentEvent } });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ─── Feature: HTTP Route Sync ─────────────────────────────────────────────────

describe('Feature: HTTP Route Sync', () => {
  it('Scenario: Explicit methods, single path — both protocols', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()],
      [makeService()],
      [makeRoute({ id: 'route-uuid-1', methods: ['GET', 'POST'], paths: ['/explicit-methods'], protocols: ['http', 'https'] })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const requests = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    // 2 methods × 2 protocols = 4 requests
    expect(requests).toHaveLength(4);

    const httpGet = requests.find(r => r.method === 'GET' && r.konnectRouteKey?.endsWith(':http'));
    const httpsGet = requests.find(r => r.method === 'GET' && r.konnectRouteKey?.endsWith(':https'));
    const httpPost = requests.find(r => r.method === 'POST' && r.konnectRouteKey?.endsWith(':http'));
    const httpsPost = requests.find(r => r.method === 'POST' && r.konnectRouteKey?.endsWith(':https'));

    expect(httpGet).toMatchObject({ method: 'GET', url: 'http://{{ _.proxy_host }}/explicit-methods', name: '/explicit-methods', konnectRouteKey: 'route-uuid-1:GET:/explicit-methods:http' });
    expect(httpsGet).toMatchObject({ method: 'GET', url: 'https://{{ _.proxy_host }}/explicit-methods', name: '/explicit-methods', konnectRouteKey: 'route-uuid-1:GET:/explicit-methods:https' });
    expect(httpPost).toMatchObject({ method: 'POST', url: 'http://{{ _.proxy_host }}/explicit-methods', name: '/explicit-methods', konnectRouteKey: 'route-uuid-1:POST:/explicit-methods:http' });
    expect(httpsPost).toMatchObject({ method: 'POST', url: 'https://{{ _.proxy_host }}/explicit-methods', name: '/explicit-methods', konnectRouteKey: 'route-uuid-1:POST:/explicit-methods:https' });

    // Should be in sub-folders (multi-protocol → needsSubFolders)
    const folders = await db.find(models.requestGroup.type, { konnectRouteId: 'route-uuid-1' });
    expect(folders.length).toBeGreaterThanOrEqual(1);
  });

  it('Scenario: Single method, single path — http only', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()],
      [makeService()],
      [makeRoute({ id: 'route-uuid-1', methods: ['DELETE'], paths: ['/single-method'], protocols: ['http'] })],
    ));

    const result = await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const requests = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      method: 'DELETE',
      url: 'http://{{ _.proxy_host }}/single-method',
      name: '/single-method',
      konnectRouteKey: 'route-uuid-1:DELETE:/single-method:http',
    });
    expect(result.routes.created).toBe(1);
  });

  it('Scenario: Single method, single path — https only', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()],
      [makeService()],
      [makeRoute({ id: 'route-uuid-1', methods: ['GET'], paths: ['/https-only'], protocols: ['https'] })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const requests = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      method: 'GET',
      url: 'https://{{ _.proxy_host }}/https-only',
      konnectRouteKey: 'route-uuid-1:GET:/https-only:https',
    });
  });

  it('Scenario: methods null — defaults to GET/POST/PUT/DELETE/PATCH per protocol', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()],
      [makeService()],
      [makeRoute({ id: 'route-uuid-2', methods: null, paths: ['/methods-null'], protocols: ['http', 'https'] })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const requests = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    // 5 methods × 2 protocols = 10
    expect(requests).toHaveLength(10);
    const httpRequests = requests.filter(r => r.konnectRouteKey?.endsWith(':http'));
    const httpsRequests = requests.filter(r => r.konnectRouteKey?.endsWith(':https'));
    expect(httpRequests).toHaveLength(5);
    expect(httpsRequests).toHaveLength(5);
    const methods = httpRequests.map(r => r.method).sort();
    expect(methods).toEqual(['DELETE', 'GET', 'PATCH', 'POST', 'PUT']);
    for (const req of requests) {
      expect(req.name).toBe('/methods-null');
    }
  });

  it('Scenario: Multiple paths — route folder with path x protocol sub-folders', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()],
      [makeService()],
      [makeRoute({ id: 'route-uuid-mp', methods: ['GET', 'POST'], paths: ['/multi-path-v1', '/multi-path-v2'], protocols: ['http', 'https'] })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const requests = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    // 2 methods × 2 paths × 2 protocols = 8
    expect(requests).toHaveLength(8);
    const folders = await db.find(models.requestGroup.type, { konnectRouteId: 'route-uuid-mp' });
    expect(folders.length).toBeGreaterThanOrEqual(1);
  });

  it('Scenario: paths null, host-only matching — URL has no path suffix, host set as header', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()],
      [makeService()],
      [makeRoute({ id: 'route-1', methods: ['GET'], paths: null, hosts: ['host-only.example.com'], protocols: ['http', 'https'] })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const requests = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    // 1 method × 2 protocols = 2
    expect(requests).toHaveLength(2);
    const httpReq = requests.find(r => r.url.startsWith('http://'));
    const httpsReq = requests.find(r => r.url.startsWith('https://'));
    expect(httpReq).toMatchObject({ url: 'http://{{ _.proxy_host }}', name: 'Route route-1' });
    expect(httpsReq).toMatchObject({ url: 'https://{{ _.proxy_host }}', name: 'Route route-1' });
    for (const req of requests) {
      expect(req.headers).toEqual(expect.arrayContaining([{ name: 'host', value:'host-only.example.com' }]));
    }
  });

  it('Scenario: paths null, header-only matching — URL has no path suffix, matching headers set', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()],
      [makeService()],
      [makeRoute({ id: 'route-1', methods: ['GET'], paths: null, hosts: null, headers: { 'X-Service': ['header-only'] }, protocols: ['http'] })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const requests = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ url: 'http://{{ _.proxy_host }}', name: 'Route route-1' });
    expect(requests[0].headers).toEqual(expect.arrayContaining([{ name: 'x-service', value: 'header-only' }]));
  });

  it('Scenario: Route headers synced onto the request — first value only', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()],
      [makeService()],
      [makeRoute({
        methods: ['POST'],
        paths: ['/route-headers'],
        headers: { 'X-Api-Version': ['2', '3'], 'X-Region': ['us-east'] },
        protocols: ['http'],
      })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const requests = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    expect(requests[0].headers).toEqual(
      expect.arrayContaining([
        { name: 'x-api-version', value: '2' },
        { name: 'x-region', value: 'us-east' },
      ]),
    );
  });

  it('Scenario: Route hosts synced as Host header', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()],
      [makeService()],
      [makeRoute({ methods: ['POST'], paths: ['/route-hosts'], hosts: ['route-hosts.example.com'], protocols: ['http'] })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const requests = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    expect(requests[0].headers).toEqual(
      expect.arrayContaining([{ name: 'host', value:'route-hosts.example.com' }]),
    );
  });

  it('Scenario: Regex path with shorthand class — falls back to /:path with path parameter', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()],
      [makeService()],
      [makeRoute({ methods: ['GET'], paths: ['~/regex/\\d+'], protocols: ['http'] })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const requests = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    expect(requests[0]).toMatchObject({
      url: 'http://{{ _.proxy_host }}/:path',
      name: '~/regex/\\d+',
    });
    expect(requests[0].pathParameters).toEqual([{ name: 'path', value: '' }]);
  });

  it('Scenario: Regex path with named capture group — parsed to colon param in URL and pathParameters', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()],
      [makeService()],
      [makeRoute({ methods: ['GET'], paths: ['~/api/users/(?<userId>[0-9]+)'], protocols: ['http'] })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const requests = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    expect(requests[0]).toMatchObject({
      url: 'http://{{ _.proxy_host }}/api/users/:userid',
      name: '/api/users/:userid',
    });
    expect(requests[0].pathParameters).toEqual([{ name: 'userid', value: '' }]);
  });

  it('Scenario: strip_path and preserve_host — ignored (no effect on request URL)', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()],
      [makeService()],
      [makeRoute({ methods: ['GET'], paths: ['/strip-path'], protocols: ['http'] })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const requests = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    expect(requests[0].url).toBe('http://{{ _.proxy_host }}/strip-path');
  });

  it('Scenario: SNIs on a route — skipped', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()],
      [makeService()],
      [makeRoute({ protocols: ['https'], methods: ['GET'], paths: ['/sni-route'], snis: ['secure-users.example.com'] })],
    ));

    const result = await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const requests = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    expect(requests).toHaveLength(0);
    expect(result.routes.skipped).toBe(1);
  });
});

// ─── Feature: Request Naming ──────────────────────────────────────────────────

describe('Feature: Request Naming', () => {
  it('Scenario: Path exists — name is path (route name ignored)', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ methods: ['GET'], paths: ['/naming-path-wins'], name: 'list-users', protocols: ['http'] })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const [req] = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    expect(req.name).toBe('/naming-path-wins');
  });

  it('Scenario: No path, route name exists — name is route name', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ methods: ['GET'], paths: null, hosts: ['naming-route-name.example.com'], name: 'users-root', protocols: ['http'] })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const [req] = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    expect(req.name).toBe('users-root');
    expect(req.headers).toEqual(expect.arrayContaining([{ name: 'host', value:'naming-route-name.example.com' }]));
  });

  it('Scenario: No path, no name — name falls back to "Route {routeId}"', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        methods: ['GET'],
        paths: null,
        hosts: null,
        name: null,
        headers: { 'X-Service': ['naming-no-name'] },
        protocols: ['http'],
      })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const [req] = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    expect(req.name).toBe('Route a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    expect(req.headers).toEqual(expect.arrayContaining([{ name: 'x-service', value: 'naming-no-name' }]));
  });

  it('Scenario: methods null — all default methods use path in name', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ methods: null, paths: ['/naming-methods-null'], protocols: ['http'] })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const requests = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    expect(requests).toHaveLength(5);
    for (const req of requests) {
      expect(req.name).toBe('/naming-methods-null');
    }
  });
});

// ─── Feature: Re-sync ───────────────────────────────────────────────────────

describe('Feature: Re-sync', () => {
  it('Scenario: Re-sync preserves user customizations on matched requests', async () => {
    // First sync
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ id: 'route-uuid-1', methods: ['GET'], paths: ['/v1/users'], protocols: ['http'] })],
    ));
    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    // User adds a custom header and body
    const [created] = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    await insoservices.request.update(created, {
      headers: [...(created.headers ?? []), { name: 'X-Custom', value: 'my-token' }],
      body: { mimeType: 'application/json', text: '{"foo":"bar"}' },
    });

    // Second sync — same route, same path (no change)
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ id: 'route-uuid-1', methods: ['GET'], paths: ['/v1/users'], protocols: ['http'] })],
    ));
    const result = await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    expect(result.routes.updated).toBe(0);
    expect(result.routes.created).toBe(0);

    const [updated] = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    expect(updated.url).toBe('http://{{ _.proxy_host }}/v1/users');
    // User's custom header should still be present
    expect(updated.headers).toEqual(
      expect.arrayContaining([{ name: 'X-Custom', value: 'my-token' }]),
    );
    // User's body should still be there
    expect(updated.body?.text).toBe('{"foo":"bar"}');
  });

  it('Scenario: Re-sync creates new request when route path changes; old request deleted', async () => {
    // First sync
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ id: 'route-uuid-1', methods: ['GET'], paths: ['/v1/users'], protocols: ['http'] })],
    ));
    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });
    expect(konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }))).toHaveLength(1);

    // Second sync — path changes to /v2/users (new key, old key stale)
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ id: 'route-uuid-1', methods: ['GET'], paths: ['/v2/users'], protocols: ['http'] })],
    ));
    const result = await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    expect(result.routes.created).toBe(1);
    expect(result.routes.deleted).toBe(1);

    const requests = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe('http://{{ _.proxy_host }}/v2/users');
  });

  it('Scenario: Re-sync does not create duplicate requests', async () => {
    const route = makeRoute({ id: 'route-uuid-1', methods: ['GET'], paths: ['/api'], protocols: ['http'] });
    vi.stubGlobal('fetch', mockFetch([makeCp()], [makeService()], [route]));
    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    vi.stubGlobal('fetch', mockFetch([makeCp()], [makeService()], [route]));
    const result = await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    expect(result.routes.created).toBe(0);
    expect(result.routes.updated).toBe(0);
    expect(result.routes.deleted).toBe(0);
    expect(konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }))).toHaveLength(1);
  });

  it('Scenario: Re-sync deletes request when route is removed from Konnect', async () => {
    // First sync — create the request
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ id: 'route-uuid-1', methods: ['GET'], protocols: ['http'] })],
    ));
    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });
    expect(konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }))).toHaveLength(1);

    // Second sync — route gone
    vi.stubGlobal('fetch', mockFetch([makeCp()], [makeService()], []));
    const result = await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    expect(result.routes.deleted).toBe(1);
    expect(konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }))).toHaveLength(0);
  });

  it('Scenario: Re-sync deletes user-added requests', async () => {
    // First sync
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ id: 'route-uuid-1', methods: ['GET'], paths: ['/api'], protocols: ['http'] })],
    ));
    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    // Find the workspace and add a manual request
    const workspaces = konnectWorkspaces(await db.find(models.workspace.type, { konnectServiceId: { $ne: null } }));
    await insoservices.request.create({ parentId: workspaces[0]._id, name: 'Manual Request', url: 'http://example.com', method: 'GET' });

    // Re-sync — the user-added request should be deleted
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ id: 'route-uuid-1', methods: ['GET'], paths: ['/api'], protocols: ['http'] })],
    ));
    const result = await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    expect(result.routes.deleted).toBe(1); // the manual request
    const allRequests = await db.find(models.request.type, { parentId: { $in: [workspaces[0]._id] } });
    // Only the konnect-managed request should remain
    expect(allRequests.filter((r: any) => r.konnectRouteKey == null)).toHaveLength(0);
  });

  it('Scenario: Re-sync removes Konnect-managed Host header when hosts is cleared', async () => {
    // First sync — route has a hosts entry, produces a Host header
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ id: 'route-uuid-1', methods: ['GET'], paths: ['/api'], protocols: ['http'], hosts: ['api.example.com'] })],
    ));
    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const [after1] = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    expect(after1.headers).toEqual(expect.arrayContaining([{ name: 'host', value:'api.example.com' }]));
    expect(after1.konnectManagedHeaderNames).toContain('host');

    // Second sync — hosts cleared; Host header should be removed
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ id: 'route-uuid-1', methods: ['GET'], paths: ['/api'], protocols: ['http'], hosts: null })],
    ));
    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const [after2] = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    expect(after2.headers.map((h: any) => h.name)).not.toContain('host');
  });

  it('Scenario: Re-sync removes a Konnect-managed route header when it is dropped from the route', async () => {
    // First sync — route has X-Tenant header
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ id: 'route-uuid-1', methods: ['GET'], paths: ['/api'], protocols: ['http'], headers: { 'X-Tenant': ['acme'] } })],
    ));
    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const [after1] = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    expect(after1.headers).toEqual(expect.arrayContaining([{ name: 'x-tenant', value: 'acme' }]));

    // Second sync — X-Tenant removed from route
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ id: 'route-uuid-1', methods: ['GET'], paths: ['/api'], protocols: ['http'], headers: null })],
    ));
    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const [after2] = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    expect(after2.headers.map((h: any) => h.name)).not.toContain('x-tenant');
  });

  it('Scenario: Re-sync preserves user-added headers when Konnect-managed headers are removed', async () => {
    // First sync — route has Host header
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ id: 'route-uuid-1', methods: ['GET'], paths: ['/api'], protocols: ['http'], hosts: ['api.example.com'] })],
    ));
    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    // User adds their own header
    const [created] = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    await insoservices.request.update(created, {
      headers: [...(created.headers ?? []), { name: 'X-My-Token', value: 'secret' }],
    });

    // Second sync — hosts cleared; Host removed, user header preserved
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ id: 'route-uuid-1', methods: ['GET'], paths: ['/api'], protocols: ['http'], hosts: null })],
    ));
    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const [after2] = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    expect(after2.headers.map((h: any) => h.name)).not.toContain('host');
    expect(after2.headers).toEqual(expect.arrayContaining([{ name: 'X-My-Token', value: 'secret' }]));
  });

  it('Scenario: Re-sync removes empty sub-folders when route path changes', async () => {
    // First sync — multi-path route creates sub-folders
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ id: 'route-uuid-1', methods: ['GET'], paths: ['/v1/users', '/v2/users'], protocols: ['http'] })],
    ));
    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const folders1 = await db.find(models.requestGroup.type, { konnectRouteId: 'route-uuid-1' });
    // Route folder + 2 sub-folders
    expect(folders1.length).toBeGreaterThanOrEqual(2);

    // Second sync — path list changes; /v1/users gone, /v3/users added
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ id: 'route-uuid-1', methods: ['GET'], paths: ['/v2/users', '/v3/users'], protocols: ['http'] })],
    ));
    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const folders2 = await db.find(models.requestGroup.type, { konnectRouteId: 'route-uuid-1' });
    // The /v1/users sub-folder should have been removed (it has no children)
    const folderNames = folders2.map((f: any) => f.name);
    expect(folderNames).not.toContain('/v1/users');
  });

  it('Scenario: Re-sync resets method if the user changed it', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ id: 'route-uuid-1', methods: ['GET'], paths: ['/api'], protocols: ['http'] })],
    ));
    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    // User changes method to POST
    const [created] = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    await insoservices.request.update(created, { method: 'POST' });

    // Re-sync should reset method back to GET
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ id: 'route-uuid-1', methods: ['GET'], paths: ['/api'], protocols: ['http'] })],
    ));
    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const [updated] = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    expect(updated.method).toBe('GET');
  });

  it('Scenario: Re-sync preserves user-filled path param value when regex is unchanged', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ id: 'route-uuid-1', methods: ['GET'], paths: ['~/api/users/(?<userId>[0-9]+)'], protocols: ['http'] })],
    ));
    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    // User fills in the path param value
    const [created] = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    await insoservices.request.update(created, { pathParameters: [{ name: 'userid', value: '42' }] });

    // Re-sync — same regex, no change
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ id: 'route-uuid-1', methods: ['GET'], paths: ['~/api/users/(?<userId>[0-9]+)'], protocols: ['http'] })],
    ));
    const result = await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    expect(result.routes.updated).toBe(0);
    const [unchanged] = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    expect(unchanged.pathParameters).toEqual([{ name: 'userid', value: '42' }]);
  });

  it('Scenario: Re-sync when regex capture group is renamed — old value dropped, new empty param created', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ id: 'route-uuid-1', methods: ['GET'], paths: ['~/api/users/(?<userId>[0-9]+)'], protocols: ['http'] })],
    ));
    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    // User fills in the path param value
    const [created] = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    await insoservices.request.update(created, { pathParameters: [{ name: 'userid', value: '42' }] });

    // Re-sync — capture group renamed from userId to accountId.
    // The raw regex path is part of the route key, so a different capture group name
    // produces a different key -> the old request is deleted and a new one is created.
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ id: 'route-uuid-1', methods: ['GET'], paths: ['~/api/users/(?<accountId>[0-9]+)'], protocols: ['http'] })],
    ));
    const result = await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    expect(result.routes.created).toBe(1);
    expect(result.routes.deleted).toBe(1);
    const [updated] = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    expect(updated.url).toBe('http://{{ _.proxy_host }}/api/users/:accountid');
    // Old 'userid' value is gone; new 'accountid' param starts empty
    expect(updated.pathParameters).toEqual([{ name: 'accountid', value: '' }]);
  });
});

// ─── Feature: Idempotent Sync (Route Keying) ──────────────────────────────────

describe('Feature: Idempotent Sync (Route Keying)', () => {
  it('Scenario: Route keys for multi-method HTTP route — keyed as "routeId:method:path:protocol"', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ id: 'route-uuid-1', methods: ['GET', 'POST'], paths: ['/api/v1/users'], protocols: ['http'] })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const requests = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    const keys = requests.map(r => r.konnectRouteKey);
    expect(keys).toContain('route-uuid-1:GET:/api/v1/users:http');
    expect(keys).toContain('route-uuid-1:POST:/api/v1/users:http');
  });

  it('Scenario: Route key for methods null — keyed per default method', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ id: 'route-uuid-2', methods: null, paths: ['/api'], protocols: ['http'] })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const requests = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    expect(requests).toHaveLength(5);
    const keys = requests.map(r => r.konnectRouteKey).sort();
    expect(keys).toEqual([
      'route-uuid-2:DELETE:/api:http',
      'route-uuid-2:GET:/api:http',
      'route-uuid-2:PATCH:/api:http',
      'route-uuid-2:POST:/api:http',
      'route-uuid-2:PUT:/api:http',
    ]);
  });

  it('Scenario: Route key for gRPC route — keyed as "routeId:grpc:path:protocol"', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ id: 'route-uuid-3', protocols: ['grpc'], methods: null, paths: ['/mypackage.MyService'] })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const grpcRequests = konnectRequests(await db.find(models.grpcRequest.type, { konnectRouteKey: { $ne: null } }));
    expect(grpcRequests).toHaveLength(1);
    expect(grpcRequests[0].konnectRouteKey).toBe('route-uuid-3:grpc:/mypackage.MyService:grpc');
  });

  it('Scenario: Route key for WebSocket route — keyed as "routeId:ws:path:protocol"', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ id: 'route-uuid-4', protocols: ['ws'], methods: null, paths: ['/ws/chat'] })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const wsRequests = konnectRequests(await db.find(models.webSocketRequest.type, { konnectRouteKey: { $ne: null } }));
    expect(wsRequests).toHaveLength(1);
    expect(wsRequests[0].konnectRouteKey).toBe('route-uuid-4:ws:/ws/chat:ws');
  });
});

// ─── Feature: gRPC Route Sync ─────────────────────────────────────────────────

describe('Feature: gRPC Route Sync', () => {
  it('Scenario: grpc protocol, path present — path becomes protoMethodName and name', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ id: 'route-uuid-3', protocols: ['grpc'], methods: null, paths: ['/hello.HelloService/SayHello'] })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const grpcRequests = konnectRequests(await db.find(models.grpcRequest.type, { konnectRouteKey: { $ne: null } }));
    expect(grpcRequests).toHaveLength(1);
    expect(grpcRequests[0]).toMatchObject({
      url: 'grpc://{{ _.grpc_proxy_host }}',
      name: '/hello.HelloService/SayHello',
      protoMethodName: '/hello.HelloService/SayHello',
      konnectRouteKey: 'route-uuid-3:grpc:/hello.HelloService/SayHello:grpc',
    });
    expect(konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }))).toHaveLength(0);
  });

  it('Scenario: grpcs protocol — creates a single gRPC request', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ id: 'route-uuid-3', protocols: ['grpcs'], methods: null, paths: ['/grpcbin.GRPCBin/Empty'] })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const grpcRequests = konnectRequests(await db.find(models.grpcRequest.type, { konnectRouteKey: { $ne: null } }));
    expect(grpcRequests).toHaveLength(1);
    expect(grpcRequests[0]).toMatchObject({
      url: 'grpcs://{{ _.grpcs_proxy_host }}',
      konnectRouteKey: 'route-uuid-3:grpc:/grpcbin.GRPCBin/Empty:grpcs',
    });
  });

  it('Scenario: grpc + grpcs mixed — creates two gRPC requests', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ id: 'route-uuid-3', protocols: ['grpc', 'grpcs'], methods: null, paths: ['/addsvc.Add/Sum'] })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const grpcRequests = konnectRequests(await db.find(models.grpcRequest.type, { konnectRouteKey: { $ne: null } }));
    expect(grpcRequests).toHaveLength(2);
    const keys = grpcRequests.map(r => r.konnectRouteKey).sort();
    expect(keys).toContain('route-uuid-3:grpc:/addsvc.Add/Sum:grpc');
    expect(keys).toContain('route-uuid-3:grpc:/addsvc.Add/Sum:grpcs');
    const grpcReq = grpcRequests.find(r => r.konnectRouteKey?.endsWith(':grpc'));
    const grpcsReq = grpcRequests.find(r => r.konnectRouteKey?.endsWith(':grpcs'));
    expect(grpcReq!.url).toBe('grpc://{{ _.grpc_proxy_host }}');
    expect(grpcsReq!.url).toBe('grpcs://{{ _.grpcs_proxy_host }}');
  });

  it('Scenario: paths null, route name present — name falls back to route name, protoMethodName empty', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ protocols: ['grpc'], methods: null, paths: null, hosts: ['grpc-name.example.com'], name: 'my-grpc-service' })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const [grpcReq] = konnectRequests(await db.find(models.grpcRequest.type, { konnectRouteKey: { $ne: null } }));
    expect(grpcReq.name).toBe('my-grpc-service');
    expect(grpcReq.protoMethodName).toBe('');
    expect(grpcReq.url).toBe('grpc://{{ _.grpc_proxy_host }}');
  });

  it('Scenario: paths null, no route name — name falls back to "Route {routeId}"', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', protocols: ['grpc'], methods: null, paths: null, hosts: ['grpc-no-name.example.com'], name: null })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const [grpcReq] = konnectRequests(await db.find(models.grpcRequest.type, { konnectRouteKey: { $ne: null } }));
    expect(grpcReq.name).toBe('Route a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    expect(grpcReq.protoMethodName).toBe('');
  });

  it('Scenario: Multiple paths — one request per path', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ protocols: ['grpc'], methods: null, paths: ['/hello.HelloService/LotsOfGreetings', '/hello.HelloService/LotsOfReplies'] })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const grpcRequests = konnectRequests(await db.find(models.grpcRequest.type, { konnectRouteKey: { $ne: null } }));
    expect(grpcRequests).toHaveLength(2);
    const names = grpcRequests.map(r => r.name).sort();
    expect(names).toEqual(['/hello.HelloService/LotsOfGreetings', '/hello.HelloService/LotsOfReplies']);
  });

  it('Scenario: hosts present — host not set as metadata', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ protocols: ['grpc'], methods: null, paths: ['/grpcbin.GRPCBin/DummyUnary'], hosts: ['grpc-hosts.example.com'] })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const [grpcReq] = konnectRequests(await db.find(models.grpcRequest.type, { konnectRouteKey: { $ne: null } }));
    expect(grpcReq.metadata?.map((m: any) => m.name)).not.toContain('host');
  });

  it('Scenario: grpcs with snis — skipped', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ protocols: ['grpcs'], methods: null, paths: ['/grpcbin.GRPCBin/Index'], snis: ['grpc.secure.example.com'] })],
    ));

    const result = await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const grpcRequests = konnectRequests(await db.find(models.grpcRequest.type, { konnectRouteKey: { $ne: null } }));
    expect(grpcRequests).toHaveLength(0);
    expect(result.routes.skipped).toBe(1);
  });

  it('Scenario: headers present — synced as gRPC metadata (first value only)', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ protocols: ['grpc'], methods: null, paths: ['/grpcbin.GRPCBin/HeadersUnary'], headers: { 'X-Api-Version': ['2'], 'X-Tenant': ['acme'] } })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const [grpcReq] = konnectRequests(await db.find(models.grpcRequest.type, { konnectRouteKey: { $ne: null } }));
    expect(grpcReq.metadata).toEqual(expect.arrayContaining([
      { name: 'x-api-version', value: '2' },
      { name: 'x-tenant', value: 'acme' },
    ]));
  });
});

// ─── Feature: WebSocket Route Sync ───────────────────────────────────────────

describe('Feature: WebSocket Route Sync', () => {
  it('Scenario: ws protocol, path present', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ id: 'route-uuid-4', protocols: ['ws'], methods: null, paths: ['/ws/plain'] })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const wsRequests = konnectRequests(await db.find(models.webSocketRequest.type, { konnectRouteKey: { $ne: null } }));
    expect(wsRequests).toHaveLength(1);
    expect(wsRequests[0]).toMatchObject({
      url: 'ws://{{ _.proxy_host }}/ws/plain',
      konnectRouteKey: 'route-uuid-4:ws:/ws/plain:ws',
    });
    expect(konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }))).toHaveLength(0);
  });

  it('Scenario: wss protocol — creates a single WebSocket request with wss', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ id: 'route-uuid-4', protocols: ['wss'], methods: null, paths: ['/ws/secure'] })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const wsRequests = konnectRequests(await db.find(models.webSocketRequest.type, { konnectRouteKey: { $ne: null } }));
    expect(wsRequests).toHaveLength(1);
    expect(wsRequests[0]).toMatchObject({
      url: 'wss://{{ _.proxy_host }}/ws/secure',
      konnectRouteKey: 'route-uuid-4:ws:/ws/secure:wss',
    });
  });

  it('Scenario: ws + wss mixed — creates two WebSocket requests', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ id: 'route-uuid-4', protocols: ['ws', 'wss'], methods: null, paths: ['/ws/mixed'] })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const wsRequests = konnectRequests(await db.find(models.webSocketRequest.type, { konnectRouteKey: { $ne: null } }));
    expect(wsRequests).toHaveLength(2);
    const keys = wsRequests.map(r => r.konnectRouteKey).sort();
    expect(keys).toContain('route-uuid-4:ws:/ws/mixed:ws');
    expect(keys).toContain('route-uuid-4:ws:/ws/mixed:wss');
    const wsReq = wsRequests.find(r => r.konnectRouteKey?.endsWith(':ws'));
    const wssReq = wsRequests.find(r => r.konnectRouteKey?.endsWith(':wss'));
    expect(wsReq!.url).toBe('ws://{{ _.proxy_host }}/ws/mixed');
    expect(wssReq!.url).toBe('wss://{{ _.proxy_host }}/ws/mixed');
  });

  it('Scenario: paths null, route name present — name falls back to route name', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ protocols: ['wss'], methods: null, paths: null, hosts: ['ws-name.example.com'], name: 'ws-chat-service' })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const [wsReq] = konnectRequests(await db.find(models.webSocketRequest.type, { konnectRouteKey: { $ne: null } }));
    expect(wsReq.name).toBe('ws-chat-service');
    expect(wsReq.url).toBe('wss://{{ _.proxy_host }}');
    expect(wsReq.headers).toEqual(expect.arrayContaining([{ name: 'host', value:'ws-name.example.com' }]));
  });

  it('Scenario: paths null, no route name — name falls back to "Route {routeId}"', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ id: 'ws-uuid-no-name', protocols: ['wss'], methods: null, paths: null, hosts: ['ws-no-name.example.com'], name: null })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const [wsReq] = konnectRequests(await db.find(models.webSocketRequest.type, { konnectRouteKey: { $ne: null } }));
    expect(wsReq.name).toBe('Route ws-uuid-no-name');
    expect(wsReq.headers).toEqual(expect.arrayContaining([{ name: 'host', value:'ws-no-name.example.com' }]));
  });

  it('Scenario: Multiple paths — one request per path', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ protocols: ['ws'], methods: null, paths: ['/ws/multi-v1', '/ws/multi-v2'] })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const wsRequests = konnectRequests(await db.find(models.webSocketRequest.type, { konnectRouteKey: { $ne: null } }));
    expect(wsRequests).toHaveLength(2);
    const urls = wsRequests.map(r => r.url).sort();
    expect(urls).toEqual(['ws://{{ _.proxy_host }}/ws/multi-v1', 'ws://{{ _.proxy_host }}/ws/multi-v2']);
  });

  it('Scenario: headers present — synced onto the request', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ protocols: ['ws'], methods: null, paths: ['/ws/headers'], headers: { 'X-Tenant': ['acme'] } })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const [wsReq] = konnectRequests(await db.find(models.webSocketRequest.type, { konnectRouteKey: { $ne: null } }));
    expect(wsReq.headers).toEqual(expect.arrayContaining([{ name: 'x-tenant', value: 'acme' }]));
  });

  it('Scenario: hosts present — synced as Host header', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ protocols: ['ws'], methods: null, paths: ['/ws/hosts'], hosts: ['ws-hosts.example.com'] })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const [wsReq] = konnectRequests(await db.find(models.webSocketRequest.type, { konnectRouteKey: { $ne: null } }));
    expect(wsReq.headers).toEqual(expect.arrayContaining([{ name: 'host', value:'ws-hosts.example.com' }]));
  });

  it('Scenario: wss with snis — skipped', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ protocols: ['wss'], methods: null, paths: ['/ws/sni'], snis: ['ws.secure.example.com'] })],
    ));

    const result = await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    expect(konnectRequests(await db.find(models.webSocketRequest.type, { konnectRouteKey: { $ne: null } }))).toHaveLength(0);
    expect(result.routes.skipped).toBe(1);
  });
});

// ─── Feature: L4 (Stream) Routes — Skipped ───────────────────────────────────

describe('Feature: L4 Stream Routes — Skipped', () => {
  it.each([
    ['tcp', ['tcp']],
    ['tls', ['tls']],
    ['udp', ['udp']],
    ['tls_passthrough', ['tls_passthrough']],
  ])('Scenario: %s route creates no request and increments skipped count', async (_label, protocols) => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ protocols: protocols as string[], methods: null })],
    ));

    const result = await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    expect(konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }))).toHaveLength(0);
    expect(konnectRequests(await db.find(models.webSocketRequest.type, { konnectRouteKey: { $ne: null } }))).toHaveLength(0);
    expect(konnectRequests(await db.find(models.grpcRequest.type, { konnectRouteKey: { $ne: null } }))).toHaveLength(0);
    expect(result.routes.skipped).toBe(1);
    expect(result.routes.total).toBe(0);
  });
});

// ─── Feature: SNI-Only Routes ────────────────────────────────────────────────

describe('Feature: SNI-Only Routes', () => {
  it('Scenario: HTTPS route matched only by SNI — skipped', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({
        protocols: ['https'],
        snis: ['api.secure.example.com'],
        paths: null,
        methods: null,
        hosts: null,
        headers: null,
      })],
    ));

    const result = await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    expect(konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }))).toHaveLength(0);
    expect(result.routes.skipped).toBe(1);
  });
});

// ─── Feature: Collection (Workspace) Naming ─────────────────────────────────

describe('Feature: Collection Naming', () => {
  it('Scenario: Service with a name — collection named after service', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()],
      [makeService({ id: 'svc-uuid-1', name: 'User Service' })],
      [],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const workspaces = konnectWorkspaces(await db.find(models.workspace.type, { konnectServiceId: { $ne: null } }));
    expect(workspaces).toHaveLength(1);
    expect(workspaces[0].name).toBe('User Service');
  });

  it('Scenario: Service with no name — collection named "Gateway Service {id}"', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()],
      [makeService({ id: 'svc-uuid-2', name: null })],
      [],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const [ws] = konnectWorkspaces(await db.find(models.workspace.type, { konnectServiceId: { $ne: null } }));
    expect(ws.name).toBe('Gateway Service svc-uuid-2');
  });

  it('Scenario: Re-sync renames collection when service name changes', async () => {
    vi.stubGlobal('fetch', mockFetch([makeCp()], [makeService({ id: 'svc-uuid-1', name: 'User Service' })], []));
    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    vi.stubGlobal('fetch', mockFetch([makeCp()], [makeService({ id: 'svc-uuid-1', name: 'Users API' })], []));
    const result = await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const [ws] = konnectWorkspaces(await db.find(models.workspace.type, { konnectServiceId: { $ne: null } }));
    expect(ws.name).toBe('Users API');
    expect(result.services.updated).toBe(1);
  });

  it('Scenario: Re-sync deletes collection when service is removed from Konnect', async () => {
    vi.stubGlobal('fetch', mockFetch([makeCp()], [makeService({ id: 'svc-uuid-1' })], []));
    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });
    expect(konnectWorkspaces(await db.find(models.workspace.type, { konnectServiceId: { $ne: null } }))).toHaveLength(1);

    // Service gone from Konnect
    vi.stubGlobal('fetch', mockFetch([makeCp()], [], []));
    const result = await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    expect(result.services.deleted).toBe(1);
    expect(konnectWorkspaces(await db.find(models.workspace.type, { konnectServiceId: { $ne: null } }))).toHaveLength(0);
  });
});

// ─── Feature: Environment Variable Mapping ────────────────────────────────────

describe('Feature: Environment Variable Mapping', () => {
  it('Scenario: Sync writes empty proxy placeholder vars for manual entry', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()],
      [], [],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const envWorkspace = (await db.find(models.workspace.type, { scope: 'environment' }))[0];
    const env = await insoservices.environment.getOrCreateForParentId(envWorkspace._id);
    const kvNames = (env.kvPairData ?? []).map((kv: any) => kv.name);
    expect(kvNames).toContain('proxy_host');
    expect(kvNames).toContain('grpc_proxy_host');
    expect(kvNames).toContain('grpcs_proxy_host');
    // All values should be empty strings
    for (const name of ['proxy_host', 'grpc_proxy_host', 'grpcs_proxy_host']) {
      const kv = (env.kvPairData ?? []).find((kv: any) => kv.name === name);
      expect(kv?.value).toBe('');
    }
  });

  it('Scenario: Re-sync preserves user-entered proxy values and user-added variables', async () => {
    vi.stubGlobal('fetch', mockFetch([makeCp()], [], []));
    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    // User fills in proxy_host and adds their own variable
    const envWorkspace = (await db.find(models.workspace.type, { scope: 'environment' }))[0];
    const env = await insoservices.environment.getOrCreateForParentId(envWorkspace._id);
    const updatedKvPairs = (env.kvPairData ?? []).map((kv: any) =>
      kv.name === 'proxy_host' ? { ...kv, value: 'myproxy.example.com' } : kv,
    );
    updatedKvPairs.push({ id: 'env_api_key', name: 'api_key', value: 'secret-123', type: 'string', enabled: true });
    await insoservices.environment.update(env, { kvPairData: updatedKvPairs });

    // Re-sync
    vi.stubGlobal('fetch', mockFetch([makeCp()], [], []));
    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const updated = await insoservices.environment.getOrCreateForParentId(envWorkspace._id);
    const proxyHost = (updated.kvPairData ?? []).find((kv: any) => kv.name === 'proxy_host');
    const apiKey = (updated.kvPairData ?? []).find((kv: any) => kv.name === 'api_key');
    expect(proxyHost?.value).toBe('myproxy.example.com');
    expect(apiKey?.value).toBe('secret-123');
  });

  it('Scenario: Sync auto-fills proxy vars from control plane proxy_urls', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp({
        proxy_urls: [
          { host: 'proxy.example.com', port: 8443, protocol: 'https' },
          { host: 'grpc.example.com', port: 9090, protocol: 'grpc' },
          { host: 'grpcs.example.com', port: 443, protocol: 'grpcs' },
        ],
      })],
      [], [],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const envWorkspace = (await db.find(models.workspace.type, { scope: 'environment' }))[0];
    const env = await insoservices.environment.getOrCreateForParentId(envWorkspace._id);
    const proxyHost = (env.kvPairData ?? []).find((kv: any) => kv.name === 'proxy_host');
    const grpcProxyHost = (env.kvPairData ?? []).find((kv: any) => kv.name === 'grpc_proxy_host');
    const grpcsProxyHost = (env.kvPairData ?? []).find((kv: any) => kv.name === 'grpcs_proxy_host');
    expect(proxyHost?.value).toBe('proxy.example.com:8443');
    expect(grpcProxyHost?.value).toBe('grpc.example.com:9090');
    expect(grpcsProxyHost?.value).toBe('grpcs.example.com:443');
  });

  it('Scenario: Sync does not overwrite user-entered proxy values with proxy_urls', async () => {
    // First sync without proxy_urls → empty vars
    vi.stubGlobal('fetch', mockFetch([makeCp()], [], []));
    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    // User fills in proxy_host manually
    const envWorkspace = (await db.find(models.workspace.type, { scope: 'environment' }))[0];
    const env = await insoservices.environment.getOrCreateForParentId(envWorkspace._id);
    const updatedKvPairs = (env.kvPairData ?? []).map((kv: any) =>
      kv.name === 'proxy_host' ? { ...kv, value: 'user-chosen.example.com' } : kv,
    );
    await insoservices.environment.update(env, { kvPairData: updatedKvPairs });

    // Re-sync with proxy_urls that would provide a different value
    vi.stubGlobal('fetch', mockFetch(
      [makeCp({
        proxy_urls: [
          { host: 'api-provided.example.com', port: 80, protocol: 'http' },
        ],
      })],
      [], [],
    ));
    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const updated = await insoservices.environment.getOrCreateForParentId(envWorkspace._id);
    const proxyHost = (updated.kvPairData ?? []).find((kv: any) => kv.name === 'proxy_host');
    expect(proxyHost?.value).toBe('user-chosen.example.com');
  });

  it('Scenario: Re-sync fills empty proxy vars when proxy_urls become available', async () => {
    // First sync without proxy_urls → empty vars
    vi.stubGlobal('fetch', mockFetch([makeCp()], [], []));
    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const envWorkspace = (await db.find(models.workspace.type, { scope: 'environment' }))[0];
    const env = await insoservices.environment.getOrCreateForParentId(envWorkspace._id);
    const proxyHost = (env.kvPairData ?? []).find((kv: any) => kv.name === 'proxy_host');
    expect(proxyHost?.value).toBe('');

    // Re-sync with proxy_urls now available
    vi.stubGlobal('fetch', mockFetch(
      [makeCp({
        proxy_urls: [
          { host: 'newly-available.example.com', port: 443, protocol: 'https' },
        ],
      })],
      [], [],
    ));
    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const updated = await insoservices.environment.getOrCreateForParentId(envWorkspace._id);
    const updatedProxyHost = (updated.kvPairData ?? []).find((kv: any) => kv.name === 'proxy_host');
    expect(updatedProxyHost?.value).toBe('newly-available.example.com');
  });
});

// ─── Feature: Control Plane (Project) Naming ────────────────────────────────

describe('Feature: Control Plane Naming', () => {
  it('Scenario: New control plane creates a project', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp({ id: 'cp-uuid-1', name: 'Production' })],
      [], [],
    ));

    const result = await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const projects = konnectProjects(await db.find(models.project.type, { konnectControlPlaneId: { $ne: null } }));
    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({ name: 'Production', konnectControlPlaneId: 'cp-uuid-1' });
    expect(result.controlPlanes.created).toBe(1);
  });

  it('Scenario: Re-sync renames project when CP name changes', async () => {
    vi.stubGlobal('fetch', mockFetch([makeCp({ id: 'cp-uuid-1', name: 'Prod' })], [], []));
    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    vi.stubGlobal('fetch', mockFetch([makeCp({ id: 'cp-uuid-1', name: 'Production' })], [], []));
    const result = await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const [project] = konnectProjects(await db.find(models.project.type, { konnectControlPlaneId: { $ne: null } }));
    expect(project.name).toBe('Production');
    expect(result.controlPlanes.updated).toBe(1);
  });

  it('Scenario: Re-sync is a no-op when CP name is unchanged', async () => {
    vi.stubGlobal('fetch', mockFetch([makeCp({ id: 'cp-uuid-1', name: 'Prod' })], [], []));
    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    vi.stubGlobal('fetch', mockFetch([makeCp({ id: 'cp-uuid-1', name: 'Prod' })], [], []));
    const result = await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    expect(result.controlPlanes.updated).toBe(0);
    expect(result.controlPlanes.created).toBe(0);
  });

  it('Scenario: Re-sync deletes project when CP is removed from Konnect', async () => {
    vi.stubGlobal('fetch', mockFetch([makeCp({ id: 'cp-uuid-1' })], [], []));
    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });
    expect(konnectProjects(await db.find(models.project.type, { konnectControlPlaneId: { $ne: null } }))).toHaveLength(1);

    vi.stubGlobal('fetch', mockFetch([], [], []));
    const result = await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    expect(result.controlPlanes.deleted).toBe(1);
    expect(konnectProjects(await db.find(models.project.type, { konnectControlPlaneId: { $ne: null } }))).toHaveLength(0);
  });
});

// ─── Feature: Wildcard and Edge-Case Hosts ────────────────────────────────────

describe('Feature: Wildcard and Edge-Case Hosts', () => {
  it('Scenario: Wildcard host — set as Host header, not in URL', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({ methods: ['GET'], paths: ['/api'], hosts: ['*.example.com'], protocols: ['http'] })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const [req] = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    expect(req.url).toBe('http://{{ _.proxy_host }}/api');
    expect(req.headers).toEqual(expect.arrayContaining([{ name: 'host', value:'*.example.com' }]));
  });

  it('Scenario: Fully invalid route (no matching fields) — creates requests with "Route {uuid}" name', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({
        id: 'a1b2c3d4-0000-0000-0000-000000000001',
        protocols: ['http'],
        methods: null,
        paths: null,
        hosts: null,
        headers: null,
        snis: null,
        name: null,
      })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const requests = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    expect(requests).toHaveLength(5);
    for (const req of requests) {
      expect(req.url).toBe('http://{{ _.proxy_host }}');
      expect(req.name).toBe('Route a1b2c3d4-0000-0000-0000-000000000001');
    }
  });
});

// ─── Feature: Expression-Based Routes ──────────────────────────────────────

describe('Feature: Expression-Based Routes', () => {
  it('Scenario: Simple method+path expression — creates 1 targeted request', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({
        protocols: ['http'],
        expression: 'http.method == "GET" && http.path == "/foo"',
        paths: null,
        methods: null,
        name: 'Foo Route',
      })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const requests = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ method: 'GET', name: '/foo' });
    expect(requests[0].url).toContain('/foo');
    expect(requests[0].name).toBe('/foo');
  });

  it('Scenario: Path-only expression — defaults to all 5 methods', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({
        protocols: ['http'],
        expression: 'http.path == "/api/users"',
        paths: null,
        methods: null,
      })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const requests = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    expect(requests).toHaveLength(5);
    for (const req of requests) {
      expect(req.url).toContain('/api/users');
    }
  });

  it('Scenario: Multiple methods via OR expression', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({
        protocols: ['http'],
        expression: 'http.method == "GET" || http.method == "POST"',
        paths: null,
        methods: null,
      })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const requests = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    expect(requests).toHaveLength(2);
    const methods = requests.map(r => r.method).sort();
    expect(methods).toEqual(['GET', 'POST']);
  });

  it('Scenario: Host expression — sets Host header on request', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({
        protocols: ['http'],
        expression: 'http.host == "api.example.com" && http.method == "GET"',
        paths: null,
        methods: null,
      })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const requests = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    expect(requests).toHaveLength(1);
    expect(requests[0].headers).toEqual(expect.arrayContaining([{ name: 'host', value: 'api.example.com' }]));
  });

  it('Scenario: Header expression — sets extracted header on request', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({
        protocols: ['http'],
        expression: 'http.headers.x_tenant == "acme" && http.method == "GET" && http.path == "/api"',
        paths: null,
        methods: null,
      })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const requests = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    expect(requests).toHaveLength(1);
    expect(requests[0].headers).toEqual(expect.arrayContaining([{ name: 'x-tenant', value: 'acme' }]));
  });

  it('Scenario: Unparseable expression — skipped (no requests created)', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({
        protocols: ['http'],
        expression: 'net.src.ip in 10.0.0.0/8',
        paths: null,
        methods: null,
      })],
    ));

    const result = await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    expect(konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }))).toHaveLength(0);
    expect(result.routes.skipped).toBe(1);
  });

  it('Scenario: Partial expression (method extractable, rest unparseable) — creates request', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({
        protocols: ['http'],
        expression: 'http.method == "GET" && net.src.ip in 10.0.0.0/8',
        paths: null,
        methods: null,
      })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const requests = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe('GET');
  });

  it('Scenario: Both protocols — creates requests for each', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({
        protocols: ['http', 'https'],
        expression: 'http.method == "GET" && http.path == "/foo"',
        paths: null,
        methods: null,
      })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const requests = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    expect(requests).toHaveLength(2);
    const protocols = requests.map(r => r.konnectRouteKey?.split(':').pop()).sort();
    expect(protocols).toEqual(['http', 'https']);
  });

  it('Scenario: Stream protocol — skipped', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({
        protocols: ['tcp'],
        expression: 'net.dst.port == 5432',
        paths: null,
        methods: null,
      })],
    ));

    const result = await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    expect(konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }))).toHaveLength(0);
    expect(result.routes.skipped).toBe(1);
  });

  it('Scenario: Prefix path expression — creates requests at that path', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({
        protocols: ['http'],
        expression: 'http.path ^= "/api/v1"',
        paths: null,
        methods: null,
      })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    const requests = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    expect(requests).toHaveLength(5);
    for (const req of requests) {
      expect(req.url).toContain('/api/v1');
    }
  });

  it('Scenario: Repeated predicates in OR expansion — deduplicates methods/paths/hosts', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({
        protocols: ['http'],
        // Each branch repeats the same method and path — a common pattern when
        // parenthesised OR expansions duplicate shared predicates.
        expression:
          '(http.method == "GET" && http.path == "/api" && http.host == "a.example.com") || ' +
          '(http.method == "GET" && http.path == "/api" && http.host == "a.example.com")',
        paths: null,
        methods: null,
      })],
    ));

    await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    // After dedup: 1 method × 1 path × 1 protocol = 1 request (not 4)
    const requests = konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }));
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ method: 'GET', url: 'http://{{ _.proxy_host }}/api' });
  });

  it('Scenario: tls.sni expression — skipped', async () => {
    vi.stubGlobal('fetch', mockFetch(
      [makeCp()], [makeService()],
      [makeRoute({
        protocols: ['https'],
        expression: 'tls.sni == "secure.example.com" && http.method == "GET"',
        paths: null,
        methods: null,
      })],
    ));

    const result = await syncKonnect({ pat: 'kpat_test', organizationId: ORG_ID });

    expect(konnectRequests(await db.find(models.request.type, { konnectRouteKey: { $ne: null } }))).toHaveLength(0);
    expect(result.routes.skipped).toBe(1);
  });
});
