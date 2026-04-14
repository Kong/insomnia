import type { KonnectProxyUrl } from './api';

// ─── Region extraction ────────────────────────────────────────────────────────

/**
 * Derives the Konnect region string from a control plane endpoint URL.
 * e.g. "https://abc123.us.cp0.konghq.com" → "us"
 * Falls back to "us" for unrecognised or malformed values.
 */
export function extractRegionFromEndpoint(endpoint: string): string {
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

// ─── Proxy environment variables ─────────────────────────────────────────────

/**
 * Names of the proxy environment variables Konnect sync manages.
 * On first sync, values are auto-filled from the control plane's `proxy_urls`
 * when available; otherwise created as empty strings for manual entry.
 *
 * - `proxy_host`: host (with port when non-standard), used in http/https/ws/wss URLs.
 * - `grpc_proxy_host`: host:port, used in grpc:// URLs.
 * - `grpcs_proxy_host`: host:port, used in grpcs:// URLs.
 */
export const KONNECT_PROXY_VAR_NAMES = ['proxy_host', 'grpc_proxy_host', 'grpcs_proxy_host'] as const;

const HTTP_LIKE_PROTOCOLS = new Set(['http', 'https', 'ws', 'wss']);
const GRPC_PROTOCOL = 'grpc';
const GRPCS_PROTOCOL = 'grpcs';

/** Default ports per protocol — used to suppress redundant port numbers in the output. */
const DEFAULT_PORTS: Record<string, number> = { http: 80, ws: 80, https: 443, wss: 443 };

/** Returns `host` for standard ports, `host:port` for non-standard ones. */
function formatHttpLikeHost(host: string, port: number, protocol: string): string {
  const defaultPort = DEFAULT_PORTS[protocol];
  return defaultPort !== undefined && port === defaultPort ? host : `${host}:${port}`;
}

/**
 * Derives default values for the proxy environment variables from a control
 * plane's `proxy_urls` array. Returns a partial map of var-name → value;
 * omitted keys mean no matching entry was found.
 *
 * - `proxy_host`       ← first http/https/ws/wss entry → host[:port] (port omitted if standard)
 * - `grpc_proxy_host`  ← first grpc entry → host:port
 * - `grpcs_proxy_host` ← first grpcs entry → host:port
 */
export function deriveProxyVarDefaults(
  proxyUrls: KonnectProxyUrl[] | null | undefined,
): Partial<Record<(typeof KONNECT_PROXY_VAR_NAMES)[number], string>> {
  const defaults: Partial<Record<(typeof KONNECT_PROXY_VAR_NAMES)[number], string>> = {};
  if (!proxyUrls?.length) {
    return defaults;
  }

  for (const entry of proxyUrls) {
    if (!entry.host) {
      continue;
    }
    const proto = entry.protocol.toLowerCase();
    if (!defaults.proxy_host && HTTP_LIKE_PROTOCOLS.has(proto)) {
      defaults.proxy_host = formatHttpLikeHost(entry.host, entry.port, proto);
    } else if (!defaults.grpc_proxy_host && proto === GRPC_PROTOCOL) {
      defaults.grpc_proxy_host = `${entry.host}:${entry.port}`;
    } else if (!defaults.grpcs_proxy_host && proto === GRPCS_PROTOCOL) {
      defaults.grpcs_proxy_host = `${entry.host}:${entry.port}`;
    }
  }

  return defaults;
}

// ─── Path handling ────────────────────────────────────────────────────────────

export interface ResolvedPath {
  /** URL path with colon-style path parameters, e.g. `/api/users/:userid`. */
  path: string;
  /** Insomnia path parameters to store on the request (values pre-filled as empty). */
  pathParameters: { name: string; value: string }[];
}

/**
 * Converts a Kong regex path string (tilde prefix already stripped) into:
 *   - a URL path using Insomnia's colon syntax (`:paramname`), and
 *   - a `pathParameters` array the user fills in via the Path Parameters tab.
 *
 * Named capture groups → `:name` (lowercased).
 * Unnamed groups and stray character classes → `:param_1`, `:param_2`, … (shared counter).
 * If the regex is too complex to parse cleanly, falls back to `/:path` (replace) or the raw
 * regex string with no path parameters (keep).
 */
export function generatePathPlaceholder(
  regexString: string,
  fallbackMode: 'keep' | 'replace' = 'replace',
): ResolvedPath {
  const paramNames: string[] = [];

  // Strip starting and ending anchors
  let path = regexString.replace(/^\^|\$$/g, '');

  // Un-escape standard path characters
  path = path.replace(/\\\//g, '/');
  path = path.replace(/\\\./g, '.');
  path = path.replace(/\/\?$/, '/'); // Optional trailing slash

  // Passes must run in this order:
  //   1. Named groups  — pattern `(?<name>...)` starts with `(?<`, so it's consumed before pass 2.
  //   2. Unnamed groups — matches remaining `(...)` after named groups are gone.
  //   3. Stray character classes — matches `[...]` that weren't inside a group.
  // Reordering would cause pass 2 to match the inner `(` of a named group before pass 1 can handle it.

  // Pass 1 — Named groups: (?<userId>\d+) → :userid
  path = path.replace(/\(\?<([a-zA-Z0-9_]+)>[^)]+\)/g, (_, groupName: string) => {
    const name = groupName.toLowerCase();
    paramNames.push(name);
    return `:${name}`;
  });

  // Passes 2 & 3 share a single param_N counter so the user sees one contiguous sequence
  // (:param_1, :param_2, …) rather than two separate ones.
  let paramCounter = 1;
  // Pass 2 — Unnamed groups: ([0-9]+) → :param_N
  path = path.replace(/\([^)]+\)/g, () => {
    const name = `param_${paramCounter++}`;
    paramNames.push(name);
    return `:${name}`;
  });
  // Pass 3 — Stray character classes: [a-z]+ → :param_N
  path = path.replace(/\[[^\]]+\][+*?]?/g, () => {
    const name = `param_${paramCounter++}`;
    paramNames.push(name);
    return `:${name}`;
  });

  // Validation: Check for leftover regex syntax
  const hasLeftoverRegex = /[()[\]*+?\\]/.test(path);
  if (hasLeftoverRegex) {
    if (fallbackMode === 'keep') { return { path: regexString, pathParameters: [] }; }
    return { path: '/:path', pathParameters: [{ name: 'path', value: '' }] };
  }

  // Ensure it starts with a slash
  if (!path.startsWith('/')) {
    path = '/' + path;
  }

  return {
    path,
    pathParameters: paramNames.map(name => ({ name, value: '' })),
  };
}

/**
 * Resolves a Kong route path for use in an Insomnia URL.
 * - null → `{ path: '', pathParameters: [] }`
 * - plain path → path unchanged, no pathParameters
 * - regex path (Kong `~` prefix) → parsed via generatePathPlaceholder
 */
export function resolvePath(rawPath: string | null): ResolvedPath {
  if (rawPath === null) { return { path: '', pathParameters: [] }; }
  if (rawPath.startsWith('~')) { return generatePathPlaceholder(rawPath.slice(1)); }
  return { path: rawPath, pathParameters: [] };
}

export function routeDisplayName(route: { name: string | null; id: string }): string {
  return route.name ?? `Route ${route.id}`;
}

export function buildRequestName(
  route: { name: string | null; paths: string[] | null; id: string },
): string {
  const rawPath = route.paths?.[0];
  if (rawPath === undefined) { return routeDisplayName(route); }
  const resolved = resolvePath(rawPath).path;
  // If the regex was too complex to parse (fell back to '/:path'), use the raw
  // Kong path (including the '~' prefix) — it's more informative than '/:path'.
  if (resolved === '/:path') { return rawPath; }
  return resolved || routeDisplayName(route);
}

// ─── Header / path-parameter merging ─────────────────────────────────────────

/**
 * Merges Konnect-managed headers into an existing header array.
 * Previously Konnect-managed headers that are no longer incoming are removed
 * using the persisted `prevManagedNames` set. User-added headers outside that
 * set are always preserved.
 */
export function mergeHeaders(
  existing: { name: string; value: string }[],
  konnect: { name: string; value: string }[],
  prevManagedNames: string[],
): { name: string; value: string }[] {
  const incomingNames = new Set(konnect.map(h => h.name));
  const prevManaged = new Set(prevManagedNames);
  const userHeaders = existing.filter(h => !incomingNames.has(h.name) && !prevManaged.has(h.name));
  return [...konnect, ...userHeaders];
}

/**
 * Merges Konnect-derived path parameters into the existing set.
 * User-filled values are preserved for any param name that still appears;
 * renamed or removed params are dropped; new params get an empty value.
 */
export function mergePathParameters(
  existing: { name: string; value: string }[],
  incoming: { name: string; value: string }[],
): { name: string; value: string }[] {
  const existingByName = new Map(existing.map(p => [p.name, p.value]));
  return incoming.map(p => ({ name: p.name, value: existingByName.get(p.name) ?? '' }));
}

/**
 * Returns true if the incoming path parameters differ from existing ones
 * (by name or count). User-filled values are not considered — only structure.
 */
export function pathParametersChanged(
  existing: { name: string; value: string }[],
  incoming: { name: string; value: string }[],
): boolean {
  if (existing.length !== incoming.length) { return true; }
  return existing.some((p, i) => p.name !== incoming[i].name);
}

/**
 * Returns true if the Konnect-managed portion of the existing headers differs
 * from the incoming ones. Uses `prevManagedNames` to detect the case where all
 * Konnect headers were removed from the route.
 */
export function konnectHeadersChanged(
  existing: { name: string; value: string }[],
  incoming: { name: string; value: string }[],
  prevManagedNames: string[],
): boolean {
  const prevManaged = new Set(prevManagedNames);
  if (incoming.length === 0) {
    return existing.some(h => prevManaged.has(h.name));
  }
  const incomingByName = new Map(incoming.map(h => [h.name, h.value]));
  let matched = 0;
  for (const h of existing) {
    const expected = incomingByName.get(h.name);
    if (expected !== undefined) {
      if (h.value !== expected) { return true; }
      matched++;
    }
  }
  return matched !== incoming.length;
}
