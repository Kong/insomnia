import { getKonnectApiBaseURL } from '../common/constants';

function getGlobalApi(): string {
  return getKonnectApiBaseURL();
}

const PAGE_SIZE = 100;
// Maximum number of retry attempts after the first 429 response (5 retries = 6 total attempts).
const MAX_RETRY_ATTEMPTS = 5;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;

export interface KonnectProxyUrl {
  host: string;
  port: number;
  protocol: string;
}

export interface KonnectControlPlane {
  id: string;
  name: string;
  description: string;
  config: {
    cluster_type: string;
    control_plane_endpoint: string;
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

// Boundary normalizers — coerce any missing nullable field to `null` so the
// declared `T | null` types are honest. Defending against `undefined` once
// here lets every downstream consumer use strict `=== null` checks and skip
// the `?? null` / `arr == null` defensive plumbing that otherwise leaks
// through sanitizeRoute, sync.ts, expression-parser, etc.
function normalizeControlPlane(cp: KonnectControlPlane): KonnectControlPlane {
  return { ...cp, proxy_urls: cp.proxy_urls ?? null };
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
      signal,
    });

    if (response.status !== 429 || attempt >= MAX_RETRY_ATTEMPTS) {
      return response;
    }

    const parsed = response.headers.get('Retry-After') ? Number.parseInt(response.headers.get('Retry-After')!, 10) : Number.NaN;
    const delay = Number.isFinite(parsed) && parsed > 0
      ? parsed * 1000
      : Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);

    console.log(`[konnect] Rate limited. Retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS})`);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, delay);
      signal?.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
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
    const response = await fetch(`${getGlobalApi()}/v2/control-planes?page[size]=1`, {
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

export async function* fetchAllControlPlanes(
  pat: string,
  signal?: AbortSignal,
): AsyncGenerator<KonnectControlPlane[]> {
  let page = 1;
  let totalPages = 1;

  do {
    const url = `${getGlobalApi()}/v2/control-planes?page[size]=${PAGE_SIZE}&page[number]=${page}`;
    const response = await fetchWithRetry(url, pat, signal);

    if (!response.ok) {
      throw new Error(`Konnect API error ${response.status} fetching control planes`);
    }

    const body = await response.json();
    const total: number = body?.meta?.page?.total ?? 0;
    totalPages = Math.ceil(total / PAGE_SIZE) || 1;

    yield (body.data as KonnectControlPlane[]).map(normalizeControlPlane);
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
    `${regionalApiBase(region)}/v2/control-planes/${cpId}/core-entities/services`,
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
    `${regionalApiBase(region)}/v2/control-planes/${cpId}/core-entities/services/${serviceId}/routes`,
    pat,
    `fetching routes for service ${serviceId}`,
    signal,
  );
  return routes.map(normalizeRoute);
}

function regionalApiBase(region: string): string {
  const url = new URL(getGlobalApi());
  url.hostname = url.hostname.replace('global', region);
  return url.origin;
}
