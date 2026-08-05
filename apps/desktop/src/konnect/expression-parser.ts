import type { KonnectRoute } from './api';

export interface ExtractedRouteFields {
  methods: string[] | null;
  paths: string[] | null;
  hosts: string[] | null;
  headers: Record<string, string[]> | null;
}

export type ApplyExpressionResult =
  | { syncable: true; route: KonnectRoute }
  | { syncable: false; routeName: string; reason: string };

/**
 * Extracts traditional route fields from a Kong expressions router DSL string.
 *
 * Handles flat AND/OR combinations of simple equality comparisons:
 *   http.method == "GET"
 *   http.path == "/foo"
 *   http.path ^= "/api"  (prefix match — treated as exact path for URL construction)
 *   http.host == "api.example.com"
 *   http.headers.<name> == "<value>"
 *
 * `tls.sni` presence is detected separately by `applyExpressionFields` — routes that
 * match on SNI are skipped, since Insomnia cannot set a TLS SNI override.
 *
 * Unsupported predicates (!=, ~, in, any(), net.*, etc.) are silently ignored;
 * their corresponding fields remain null so the caller can apply defaults.
 *
 * Known limitation: cross-field AND-within-OR expressions are over-approximated.
 * e.g. `(http.method == "GET" && http.path == "/v1") || (http.method == "POST" && http.path == "/v2")`
 * yields methods: ["GET","POST"], paths: ["/v1","/v2"] → 4 requests instead of 2.
 * In practice it seems more likely that this would be two separate routes.
 */
export function extractFieldsFromExpression(expression: string): ExtractedRouteFields {
  const methodMatches = [...new Set([...expression.matchAll(/http\.method\s*==\s*"([A-Z]+)"/g)].map(m => m[1]))];
  const pathExact = [...expression.matchAll(/http\.path\s*==\s*"([^"]+)"/g)].map(m => m[1]);
  const pathPrefix = [...expression.matchAll(/http\.path\s*\^=\s*"([^"]+)"/g)].map(m => m[1]);
  const hostMatches = [...new Set([...expression.matchAll(/http\.host\s*==\s*"([^"]+)"/g)].map(m => m[1]))];
  const headerMatches = [...expression.matchAll(/http\.headers\.(\w+)\s*==\s*"([^"]+)"/g)];

  const allPaths = [...new Set([...pathExact, ...pathPrefix])];

  let headers: Record<string, string[]> | null = null;
  if (headerMatches.length > 0) {
    headers = {};
    for (const match of headerMatches) {
      const name = match[1].replace(/_/g, '-').toLowerCase();
      if (!headers[name]) {
        headers[name] = [];
      }
      headers[name].push(match[2]);
    }
  }

  return {
    methods: methodMatches.length > 0 ? methodMatches : null,
    paths: allPaths.length > 0 ? allPaths : null,
    hosts: hostMatches.length > 0 ? hostMatches : null,
    headers,
  };
}

/**
 * If the route has an expression, extracts fields from it and returns the merged route.
 * Returns `syncable: false` when:
 * - The expression contains `tls.sni` — Insomnia cannot set a TLS SNI override.
 * - The expression yields no usable fields — creating fallback requests would be misleading.
 */
export function applyExpressionFields(route: KonnectRoute): ApplyExpressionResult {
  if (!route.expression) {
    return { syncable: true, route };
  }

  if (/\btls\.sni\b/.test(route.expression)) {
    return {
      syncable: false,
      routeName: route.name ?? `Route ${route.id}`,
      reason: 'Expression route uses tls.sni matching — unsupported in Insomnia',
    };
  }

  const extracted = extractFieldsFromExpression(route.expression);

  if (!extracted.methods && !extracted.paths && !extracted.hosts && !extracted.headers) {
    return {
      syncable: false,
      routeName: route.name ?? `Route ${route.id}`,
      reason: 'Expression route — no extractable fields (method/path/host/header)',
    };
  }

  return {
    syncable: true,
    route: {
      ...route,
      methods: extracted.methods,
      paths: extracted.paths,
      hosts: extracted.hosts,
      headers: extracted.headers,
    },
  };
}
