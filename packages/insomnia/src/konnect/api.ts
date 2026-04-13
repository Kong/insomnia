import { getKonnectApiBaseURL } from '../common/constants';

function getGlobalApi(): string {
  return getKonnectApiBaseURL();
}

const PAGE_SIZE = 100;
// Maximum number of retry attempts after the first 429 response (5 retries = 6 total attempts).
const MAX_RETRY_ATTEMPTS = 5;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;

export interface KonnectControlPlane {
  id: string;
  name: string;
  description: string;
  config: {
    cluster_type: string;
    control_plane_endpoint: string;
  };
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

export function extractRegionFromEndpoint(endpoint: string): string {
  // e.g. "https://abc123.us.cp0.konghq.com" → "us"
  try {
    const hostname = new URL(endpoint).hostname;
    const parts = hostname.split('.');
    // Pattern: <id>.<region>.cp0.konghq.com
    if (parts.length >= 4 && parts[parts.length - 2] === 'konghq' && parts[parts.length - 1] === 'com') {
      if (parts[parts.length - 3] === 'cp0') {
        return parts[parts.length - 4];
      }
      console.warn(`[konnect] Unexpected endpoint hostname format, defaulting region to "us": ${hostname}`);
    }
  } catch {
    console.warn(`[konnect] Malformed control_plane_endpoint, defaulting region to "us": ${endpoint}`);
  }
  return 'us';
}

/**
 * Names of the proxy environment variables Konnect sync manages.
 * All are created as empty strings on first sync — the user must fill them in manually.
 *
 * - `proxy_host`: hostname only (no port), used in http/https/ws/wss URLs.
 * - `grpc_proxy_host`: host:port, used in grpc:// URLs.
 * - `grpcs_proxy_host`: host:port, used in grpcs:// URLs.
 */
export const KONNECT_PROXY_VAR_NAMES = ['proxy_host', 'grpc_proxy_host', 'grpcs_proxy_host'] as const;

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

    yield body.data as KonnectControlPlane[];
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
  return fetchAllOffsetPaginated<KonnectService>(
    `${regionalApiBase(region)}/v2/control-planes/${cpId}/core-entities/services`,
    pat,
    `fetching services for CP ${cpId}`,
    signal,
  );
}

export async function fetchRoutesForService(
  pat: string,
  cpId: string,
  serviceId: string,
  region: string,
  signal?: AbortSignal,
): Promise<KonnectRoute[]> {
  return fetchAllOffsetPaginated<KonnectRoute>(
    `${regionalApiBase(region)}/v2/control-planes/${cpId}/core-entities/services/${serviceId}/routes`,
    pat,
    `fetching routes for service ${serviceId}`,
    signal,
  );
}

function regionalApiBase(region: string): string {
  const url = new URL(getGlobalApi());
  url.hostname = url.hostname.replace('global', region);
  return url.origin;
}
