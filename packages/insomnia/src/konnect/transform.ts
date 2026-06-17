import type { KonnectDeploymentType } from 'insomnia-data';

import type { KonnectControlPlane, KonnectProxyUrl, KonnectRoute } from './api';

// ─── Template injection sanitisation ─────────────────────────────────────────

/**
 * Strips Liquid template syntax (`{{ }}`, `{% %}`) from a string
 * sourced from external API data, preventing template injection when the value
 * is later rendered by Insomnia's Liquid engine.
 */
function stripTemplateSyntax(value: string): string {
  let prev = '';
  let result = value;
  while (result !== prev) {
    prev = result;
    result = result.replace(/\{\{[\s\S]*?\}\}/g, '').replace(/\{%[\s\S]*?%\}/g, '');
  }
  return result;
}

/** Strips template syntax from each item, filters empties, and returns null if nothing remains. */
function sanitizeStringArray(arr: string[] | null): string[] | null {
  if (arr === null) {
    return null;
  }
  const result = arr.map(stripTemplateSyntax).filter(s => s.trim() !== '');
  return result.length > 0 ? result : null;
}

/**
 * Returns a copy of the route with Liquid template syntax stripped from all
 * string fields that flow into rendered request content. Array fields that
 * become entirely empty after stripping are set to null so existing fallbacks
 * (e.g. default HTTP methods) apply correctly.
 */
export function sanitizeRoute(route: KonnectRoute): KonnectRoute {
  return {
    ...route,
    name: route.name !== null ? stripTemplateSyntax(route.name) : null,
    methods: sanitizeStringArray(route.methods),
    paths: sanitizeStringArray(route.paths),
    hosts: sanitizeStringArray(route.hosts),
    headers: route.headers
      ? Object.fromEntries(
          Object.entries(route.headers)
            .map(([k, vs]): [string, string[]] => [stripTemplateSyntax(k), sanitizeStringArray(vs) ?? []])
            .filter(([k, vs]) => k.trim() !== '' && vs.length > 0),
        )
      : null,
    expression: route.expression !== null ? stripTemplateSyntax(route.expression) : null,
  };
}

// ─── Region extraction ────────────────────────────────────────────────────────

/**
 * Derives the Konnect region string from a control plane endpoint URL.
 * e.g. "https://abc123.us.cp0.konghq.com" → "us"
 * e.g. "https://abc123.eu.cp.konghq.com" → "eu"
 * e.g. "https://abc123.sg.cp.konghq.com" → "sg"
 * Falls back to "us" for unrecognised or malformed values.
 */
export function extractRegionFromEndpoint(endpoint: string): string {
  try {
    const hostname = new URL(endpoint).hostname;
    const parts = hostname.split('.');
    // Pattern: <id>.<region>.cp[N].konghq.com  (e.g. cp0, cp, cp1)
    if (parts.length >= 4 && parts[parts.length - 2] === 'konghq' && parts[parts.length - 1] === 'com') {
      if (/^cp\d*$/.test(parts[parts.length - 3])) {
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
 * when available.
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
    if (fallbackMode === 'keep') {
      return { path: regexString, pathParameters: [] };
    }
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
  if (rawPath === null) {
    return { path: '', pathParameters: [] };
  }
  if (rawPath.startsWith('~')) {
    return generatePathPlaceholder(rawPath.slice(1));
  }
  return { path: rawPath, pathParameters: [] };
}

export function routeDisplayName(route: { name: string | null; id: string }): string {
  return route.name ?? `Route ${route.id}`;
}

export function buildRequestName(route: { name: string | null; paths: string[] | null; id: string }): string {
  const rawPath = route.paths?.[0];
  if (rawPath === undefined) {
    return routeDisplayName(route);
  }
  const resolved = resolvePath(rawPath).path;
  // If the regex was too complex to parse (fell back to '/:path'), use the raw
  // Kong path (including the '~' prefix) — it's more informative than '/:path'.
  if (resolved === '/:path') {
    return rawPath;
  }
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
  if (existing.length !== incoming.length) {
    return true;
  }
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
      if (h.value !== expected) {
        return true;
      }
      matched++;
    }
  }
  return matched !== incoming.length;
}

export function getKonnectDeploymentType(controlPlane: KonnectControlPlane): KonnectDeploymentType | null {
  const controlPlaneType = controlPlaneConfigToControlPlaneType({
    cluster_type: controlPlane.config.cluster_type as keyof typeof CLUSTER_TYPE_TO_CP_TYPE_MAP,
    cloud_gateway: controlPlane.config.cloud_gateway,
  });

  switch (controlPlaneType) {
    case ControlPlaneType.K8SIngressController: {
      return 'k8sIngressController';
    }
    case ControlPlaneType.Cloud: {
      return 'dedicatedCloud';
    }
    case ControlPlaneType.Serverless: {
      return 'serverless';
    }
    case ControlPlaneType.GroupWithCloudDataPlanes:
    case ControlPlaneType.GroupWithOnPremDataPlanes: {
      return 'group';
    }
    case ControlPlaneType.ServerlessV1: {
      return 'serverless';
    }
    default: {
      return 'selfManaged';
    }
  }
}

enum ControlPlaneType {
  Hybrid = 'CONTROL_PLANE_TYPE_HYBRID', // self managed
  Cloud = 'CONTROL_PLANE_TYPE_CLOUD', // Dedicated cloud
  K8SIngressController = 'CONTROL_PLANE_TYPE_K8S_INGRESS_CONTROLLER', // KIC
  /**
   * Group of hybrid-type control planes, on-prem data planes can connect to this control plane group
   */
  GroupWithOnPremDataPlanes = 'CONTROL_PLANE_TYPE_GROUP_WITH_ON_PREM_DATA_PLANES',
  /**
   * Group of hybrid-type control planes, cloud data planes can be created and managed by this control plane group
   */
  GroupWithCloudDataPlanes = 'CONTROL_PLANE_TYPE_GROUP_WITH_CLOUD_DATA_PLANES',
  Serverless = 'CONTROL_PLANE_TYPE_SERVERLESS', // Serverless.v0 deployed on fly.io
  ServerlessV1 = 'CONTROL_PLANE_TYPE_SERVERLESS_V1', // Serverless.v1 (previously HVC)
  // NativeEventProxy = 'CONTROL_PLANE_TYPE_KAFKA_NATIVE_EVENT_PROXY', // KNEP is deprecated in GM, DO NOT add it back
}

const ControlPlaneClusterTypeEnum = {
  ControlPlane: 'CLUSTER_TYPE_CONTROL_PLANE',
  K8SIngressController: 'CLUSTER_TYPE_K8S_INGRESS_CONTROLLER',
  ControlPlaneGroup: 'CLUSTER_TYPE_CONTROL_PLANE_GROUP',
  Serverless: 'CLUSTER_TYPE_SERVERLESS',
  HttpGateway: 'CLUSTER_TYPE_HTTP_GATEWAY',
  EventGateway: 'CLUSTER_TYPE_EVENT_GATEWAY',
  KafkaNativeEventProxy: 'CLUSTER_TYPE_KAFKA_NATIVE_EVENT_PROXY',
  CloudApiGateway: 'CLUSTER_TYPE_CLOUD_API_GATEWAY',
  ServerlessV1: 'CLUSTER_TYPE_SERVERLESS_V1',
};

const CLUSTER_TYPE_TO_CP_TYPE_MAP = {
  [ControlPlaneClusterTypeEnum.ControlPlane]: { false: ControlPlaneType.Hybrid, true: ControlPlaneType.Cloud },
  [ControlPlaneClusterTypeEnum.K8SIngressController]: { false: ControlPlaneType.K8SIngressController },
  [ControlPlaneClusterTypeEnum.ControlPlaneGroup]: {
    false: ControlPlaneType.GroupWithOnPremDataPlanes,
    true: ControlPlaneType.GroupWithCloudDataPlanes,
  },
  [ControlPlaneClusterTypeEnum.Serverless]: { false: ControlPlaneType.Serverless },
  [ControlPlaneClusterTypeEnum.ServerlessV1]: { true: ControlPlaneType.ServerlessV1 },
  // Placeholders for other cluster types
  [ControlPlaneClusterTypeEnum.CloudApiGateway]: { true: ControlPlaneType.ServerlessV1 }, // TODO: remove this when CLUSTER_TYPE_SERVERLESS_V1 is accepted by the API (KHCP-19640)
  [ControlPlaneClusterTypeEnum.HttpGateway]: { false: null },
  [ControlPlaneClusterTypeEnum.EventGateway]: { false: null },
  [ControlPlaneClusterTypeEnum.KafkaNativeEventProxy]: { false: null }, // KNEP is deprecated, DO NOT map it to any CP type
} as const;

type ControlPlaneConfigToControlPlaneType<
  T extends keyof typeof CLUSTER_TYPE_TO_CP_TYPE_MAP,
  C extends boolean,
> = `${C}` extends keyof (typeof CLUSTER_TYPE_TO_CP_TYPE_MAP)[T]
  ? (typeof CLUSTER_TYPE_TO_CP_TYPE_MAP)[T][`${C}`]
  : never;

type NeverToNull<T> = T extends never ? null : T;

function controlPlaneConfigToControlPlaneType<
  T extends keyof typeof CLUSTER_TYPE_TO_CP_TYPE_MAP,
  C extends boolean,
>(config: { cluster_type: T; cloud_gateway: C }): NeverToNull<ControlPlaneConfigToControlPlaneType<T, C>> {
  type ReturnType = NeverToNull<ControlPlaneConfigToControlPlaneType<T, C>>;
  const { cluster_type: clusterType, cloud_gateway: isCloudGateway } = config;
  const subMap = CLUSTER_TYPE_TO_CP_TYPE_MAP[clusterType];
  if (subMap && Object.hasOwnProperty.call(subMap, `${isCloudGateway}`)) {
    return subMap[`${isCloudGateway}` as keyof typeof subMap] as ReturnType;
  }
  // this should never happen, but just in case
  console.error(
    `ControlPlaneConfigToControlPlaneType: invalid clusterType ${clusterType} or cloud_gateway ${isCloudGateway}`,
  );

  return null as ReturnType;
}
