import { getKonnectApiRegions, getKonnectApiUrl } from '../common/constants';

export type KonnectRegion = string;

const PAGE_SIZE = 100;
// Maximum number of retry attempts after the first 429 response (5 retries = 6 total attempts).
const MAX_RETRY_ATTEMPTS = 5;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;
const REQUEST_TIMEOUT_MS = 30_000;

export interface KonnectProxyUrl {
  host: string;
  port: number;
  protocol: string;
}

export interface KonnectControlPlane {
  id: string;
  name: string;
  description: string;
  region: KonnectRegion;
  config: {
    cluster_type: string;
    control_plane_endpoint: string;
    cloud_gateway: boolean;
  };
  proxy_urls: KonnectProxyUrl[] | null;
}

export interface KonnectService {
  id: string;
  name: string | null;
  protocol: string;
  host: string;
  port: number;
  path: string | null;
  enabled: boolean;
  tags: string[] | null;
}

export interface KonnectRoute {
  id: string;
  name: string | null;
  methods: string[] | null;
  paths: string[] | null;
  protocols: string[];
  hosts: string[] | null;
  headers: Record<string, string[]> | null;
  snis: string[] | null;
  expression: string | null;
  service: { id: string } | null;
}

export interface KonnectPluginOrdering {
  before?: { access?: string[] } | null;
  after?: { access?: string[] } | null;
}

export interface KonnectPlugin {
  id: string;
  name: string;
  instance_name: string | null;
  enabled: boolean;
  config: Record<string, unknown> | null;
  protocols: string[] | null;
  tags: string[] | null;
  condition: string | null;
  ordering: KonnectPluginOrdering | null;
  route: { id: string } | null;
  service: { id: string } | null;
  consumer: { id: string } | null;
  consumer_group: { id: string } | null;
}

export const getActiveRegions = getKonnectApiRegions;

// Boundary normalizers — coerce any missing nullable field to `null` so the
// declared `T | null` types are honest. Defending against `undefined` once
// here lets every downstream consumer use strict `=== null` checks and skip
// the `?? null` / `arr == null` defensive plumbing that otherwise leaks
// through sanitizeRoute, sync.ts, expression-parser, etc.
function normalizeControlPlane(cp: KonnectControlPlane, region: KonnectRegion): KonnectControlPlane {
  return { ...cp, region, proxy_urls: cp.proxy_urls ?? null };
}

function normalizeService(s: KonnectService): KonnectService {
  return { ...s, name: s.name ?? null, path: s.path ?? null, tags: s.tags ?? null };
}

function normalizeRoute(r: KonnectRoute): KonnectRoute {
  return {
    ...r,
    name: r.name ?? null,
    methods: r.methods ?? null,
    paths: r.paths ?? null,
    hosts: r.hosts ?? null,
    headers: r.headers ?? null,
    snis: r.snis ?? null,
    expression: r.expression ?? null,
    service: r.service ?? null,
  };
}

async function fetchWithRetry(url: string, pat: string, signal?: AbortSignal): Promise<Response> {
  let attempt = 0;
  while (true) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${pat}` },
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
        : AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.status !== 429 || attempt >= MAX_RETRY_ATTEMPTS) {
      return response;
    }

    const parsed = response.headers.get('Retry-After')
      ? Number.parseInt(response.headers.get('Retry-After')!, 10)
      : Number.NaN;
    const delay =
      Number.isFinite(parsed) && parsed > 0 ? parsed * 1000 : Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);

    console.log(`[konnect] Rate limited. Retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS})`);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, delay);
      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(signal.reason);
        },
        { once: true },
      );
    });
    attempt++;
  }
}

export interface PatValidationResult {
  valid: boolean;
  error?: string;
}

export async function validatePat(pat: string): Promise<PatValidationResult> {
  try {
    const response = await fetch(`${getKonnectRegionalApiBase('us')}/v2/control-planes?page[size]=1`, {
      headers: { Authorization: `Bearer ${pat}` },
    });
    if (response.ok) {
      return { valid: true };
    }
    if (response.status === 401) {
      return { valid: false, error: 'Invalid token (401 Unauthorized).' };
    }
    if (response.status === 403) {
      return { valid: false, error: 'Token lacks permission to list control planes (403 Forbidden).' };
    }
    return { valid: false, error: `Konnect returned ${response.status}.` };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : 'Could not reach Konnect.' };
  }
}

export async function fetchKonnectOrganizationId(pat: string, signal?: AbortSignal): Promise<string | undefined> {
  try {
    const response = await fetchWithRetry(`${getKonnectRegionalApiBase('us')}/v3/organizations/me`, pat, signal);
    if (!response.ok) {
      return undefined;
    }
    const data = (await response.json()) as { id?: string };
    return data.id;
  } catch {
    return undefined;
  }
}

export async function* fetchAllControlPlanes(
  pat: string,
  region: KonnectRegion,
  signal?: AbortSignal,
): AsyncGenerator<KonnectControlPlane[]> {
  let page = 1;
  let totalPages = 1;

  do {
    const url = `${getKonnectRegionalApiBase(region)}/v2/control-planes?page[size]=${PAGE_SIZE}&page[number]=${page}`;
    const response = await fetchWithRetry(url, pat, signal);

    if (!response.ok) {
      throw new Error(`Konnect API error ${response.status} fetching control planes`);
    }

    const body = await response.json();
    const total: number = body?.meta?.page?.total ?? 0;
    totalPages = Math.ceil(total / PAGE_SIZE) || 1;

    yield (body.data as KonnectControlPlane[]).map(cp => normalizeControlPlane(cp, region));
    page++;
  } while (page <= totalPages);
}

async function fetchAllOffsetPaginated<T>(
  baseUrl: string,
  pat: string,
  errorContext: string,
  signal?: AbortSignal,
): Promise<T[]> {
  const results: T[] = [];
  let offset: string | null = null;

  do {
    const url = offset ? `${baseUrl}?size=${PAGE_SIZE}&offset=${offset}` : `${baseUrl}?size=${PAGE_SIZE}`;
    const response = await fetchWithRetry(url, pat, signal);

    if (!response.ok) {
      throw new Error(`Konnect API error ${response.status} ${errorContext}`);
    }

    const body = await response.json();
    results.push(...(body.data as T[]));
    offset = body.offset ?? null;
  } while (offset !== null);

  return results;
}

export async function fetchAllServices(
  pat: string,
  cpId: string,
  region: string,
  signal?: AbortSignal,
): Promise<KonnectService[]> {
  const services = await fetchAllOffsetPaginated<KonnectService>(
    `${getKonnectRegionalApiBase(region)}/v2/control-planes/${cpId}/core-entities/services`,
    pat,
    `fetching services for CP ${cpId}`,
    signal,
  );
  return services.map(normalizeService);
}

export async function fetchRoutesForService(
  pat: string,
  cpId: string,
  serviceId: string,
  region: string,
  signal?: AbortSignal,
): Promise<KonnectRoute[]> {
  const routes = await fetchAllOffsetPaginated<KonnectRoute>(
    `${getKonnectRegionalApiBase(region)}/v2/control-planes/${cpId}/core-entities/services/${serviceId}/routes`,
    pat,
    `fetching routes for service ${serviceId}`,
    signal,
  );
  return routes.map(normalizeRoute);
}

export async function fetchAllPlugins(
  pat: string,
  cpId: string,
  region: string,
  signal?: AbortSignal,
): Promise<KonnectPlugin[]> {
  const plugins = await fetchAllOffsetPaginated<KonnectPlugin>(
    `${getKonnectRegionalApiBase(region)}/v2/control-planes/${cpId}/core-entities/plugins`,
    pat,
    `fetching plugins for CP ${cpId}`,
    signal,
  );
  return plugins.map(normalizePlugin);
}

export async function fetchAvailablePluginNames(
  pat: string,
  cpId: string,
  region: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const response = await fetchWithRetry(
    `${getKonnectRegionalApiBase(region)}/v2/control-planes/${cpId}/core-entities/v1/available-plugins`,
    pat,
    signal,
  );
  if (!response.ok) {
    throw new Error(`Konnect API error ${response.status} fetching available plugins`);
  }
  const body: unknown = await response.json();
  const names = body && typeof body === 'object' && 'names' in body ? body.names : undefined;
  if (!Array.isArray(names)) {
    throw new TypeError('Unexpected Konnect available-plugins response shape');
  }
  if (!names.every((name): name is string => typeof name === 'string')) {
    throw new TypeError('Unexpected Konnect available-plugins item shape');
  }
  return names;
}

function normalizePlugin(plugin: KonnectPlugin): KonnectPlugin {
  return {
    ...plugin,
    instance_name: plugin.instance_name ?? null,
    enabled: plugin.enabled ?? true,
    config: plugin.config ?? null,
    protocols: plugin.protocols ?? null,
    tags: plugin.tags ?? null,
    condition: plugin.condition ?? null,
    ordering: plugin.ordering ?? null,
    route: plugin.route ?? null,
    service: plugin.service ?? null,
    consumer: plugin.consumer ?? null,
    consumer_group: plugin.consumer_group ?? null,
  };
}

/**
 * Resolves the Konnect API base for a region. `KONNECT_API_URL` can be a
 * regional hostname (the default) or a full URL (used by tests/proxies).
 */
export function getKonnectRegionalApiBase(region: string): string {
  const url = getKonnectApiUrl();
  // If KONNECT_API_URL is already a full URL (e.g. http://localhost:4010 in tests),
  // use it as-is without prepending a region subdomain or https scheme.
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url.replace(/\/$/, '');
  }
  return `https://${region}.${url.replace(/\/$/, '')}`;
}
