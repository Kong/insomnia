import type { DebugSession, DebugSpan, DebugTraceDetail, DebugTraceSummary } from './debug-session-api';
export type DebugSessionState = 'active' | 'cancelled' | 'completed' | 'completing' | 'timed_out';

// Derive the state of a debug session from its response
export function deriveSessionState(session: DebugSession): DebugSessionState {
  if (session.stoppedAt) {
    return 'cancelled';
  }
  if (session.completedAt) {
    return 'completed';
  }
  if (session.startedAt) {
    const endsAt = new Date(session.startedAt).getTime() + session.durationSecs * 1000;
    if (Number.isFinite(endsAt) && Date.now() >= endsAt) {
      // The session has reached its expected end time but last status fetch has not been reached yet.
      return 'completing';
    }
  }
  if (session.timedOut) {
    return 'timed_out';
  }
  return 'active';
}

export function getDebugSessionEndsAt(session: DebugSession): number | null {
  if (!session.startedAt) {
    return null;
  }
  const endsAt = new Date(session.startedAt).getTime() + session.durationSecs * 1000;
  return Number.isFinite(endsAt) ? endsAt : null;
}

export function getDebugSessionStartedAt(session: DebugSession): number | null {
  if (!session.startedAt) {
    return null;
  }
  const startAt = new Date(session.startedAt).getTime();
  return Number.isFinite(startAt) ? startAt : null;
}

export interface SpanNode {
  span: DebugSpan;
  name: string;
  depth: number;
  /** Start relative to the earliest span in the trace; positions the waterfall bar. */
  startOffsetMs: number;
  durationMs: number;
  children: SpanNode[];
}

export interface SpanTree {
  roots: SpanNode[];
  totalMs: number;
}

const NANOS_PER_MS = 1_000_000n;

// Span timestamps are unix nanoseconds as strings: too large for a JS number to hold exactly.
function toBigInt(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

function nanosToMs(nanos: bigint): number {
  // keep sub-millisecond precision: bigint division would truncate
  return Number(nanos) / Number(NANOS_PER_MS);
}

// Builds the span tree for one trace, children sorted by start time.
export function buildSpanTree(detail: DebugTraceDetail): SpanTree {
  if (detail.spans.length === 0) {
    return { roots: [], totalMs: 0 };
  }
  // Use bigint to find the earliest start time accurately without overflow
  let base = toBigInt(detail.spans[0].startTimeUnixNano);
  for (const span of detail.spans) {
    const start = toBigInt(span.startTimeUnixNano);
    if (start < base) {
      base = start;
    }
  }

  const spanById = new Map<string, SpanNode>();
  for (const span of detail.spans) {
    const start = toBigInt(span.startTimeUnixNano);
    const end = toBigInt(span.endTimeUnixNano);
    spanById.set(span.spanId, {
      span,
      name: span.name,
      depth: 0,
      startOffsetMs: nanosToMs(start - base),
      durationMs: Math.max(0, nanosToMs(end - start)),
      children: [],
    });
  }

  const roots: SpanNode[] = [];
  for (const node of spanById.values()) {
    const parent = node.span.parentSpanId ? spanById.get(node.span.parentSpanId) : undefined;
    if (parent && parent !== node) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Depth, owner and self time depend on the parent, so fill them in top-down once the tree is linked.
  const finalize = (node: SpanNode, depth: number) => {
    node.depth = depth;
    node.children.sort((a, b) => a.startOffsetMs - b.startOffsetMs);
    node.children.forEach(child => finalize(child, depth + 1));
  };
  roots.sort((a, b) => a.startOffsetMs - b.startOffsetMs);
  roots.forEach(root => finalize(root, 0));

  const totalMs = roots.reduce((max, root) => Math.max(max, root.startOffsetMs + root.durationMs), 0);
  return { roots, totalMs };
}

/** Depth-first rows for the waterfall, skipping the children of collapsed spans. */
export function flattenVisible(roots: SpanNode[], collapsed: ReadonlySet<string>): SpanNode[] {
  const result: SpanNode[] = [];
  const visit = (node: SpanNode) => {
    result.push(node);
    if (!collapsed.has(node.span.spanId)) {
      node.children.forEach(visit);
    }
  };
  roots.forEach(visit);
  return result;
}

export interface TraceSummaryBreakdown {
  totalMs: number;
  kongMs: number;
  upstreamMs: number;
  clientMs: number;
  thirdPartyMs: number;
  kongPct: number;
  upstreamPct: number;
  clientPct: number;
  thirdPartyPct: number;
}

// Latency breakdown (ms) as attributes on the root `kong` span.
const LATENCY_ATTRIBUTES = {
  total: 'proxy.kong.latency.total',
  internal: 'proxy.kong.latency.internal',
  upstream: 'proxy.kong.latency.upstream',
  client: 'proxy.kong.latency.client',
  thirdParty: 'proxy.kong.latency.3p.total_io',
};

// Some numeric attributes come back as strings (e.g. `proxy.kong.http.response.body.size`).
function readMs(attributes: Record<string, unknown>, key: string): number | null {
  const value = attributes[key];
  const ms = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(ms) ? ms : null;
}

function findLatencySpan(roots: SpanNode[]): DebugSpan | null {
  for (const node of roots) {
    if (LATENCY_ATTRIBUTES.total in node.span.attributes) {
      return node.span;
    }
    const nested = findLatencySpan(node.children);
    if (nested) {
      return nested;
    }
  }
  return null;
}

// Time per component (Kong, upstream, client, 3rd-party) for the summary bar
export function summarizeTrace(tree: SpanTree): TraceSummaryBreakdown | null {
  const span = findLatencySpan(tree.roots);
  if (!span) {
    return null;
  }
  const kongMs = readMs(span.attributes, LATENCY_ATTRIBUTES.internal) ?? 0;
  const upstreamMs = readMs(span.attributes, LATENCY_ATTRIBUTES.upstream) ?? 0;
  const clientMs = readMs(span.attributes, LATENCY_ATTRIBUTES.client) ?? 0;
  const thirdPartyMs = readMs(span.attributes, LATENCY_ATTRIBUTES.thirdParty) ?? 0;
  const sum = kongMs + upstreamMs + clientMs + thirdPartyMs;
  const pct = (value: number) => (sum > 0 ? (value / sum) * 100 : 0);
  return {
    totalMs: readMs(span.attributes, LATENCY_ATTRIBUTES.total) ?? tree.totalMs,
    kongMs,
    upstreamMs,
    clientMs,
    thirdPartyMs,
    kongPct: pct(kongMs),
    upstreamPct: pct(upstreamMs),
    clientPct: pct(clientMs),
    thirdPartyPct: pct(thirdPartyMs),
  };
}

// Ignores trailing slashes
function normalizePath(path: string) {
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

/** The path a trace was served on: from its URL, or the matched route pattern when no URL was captured. */
export function getTracePath(trace: Pick<DebugTraceSummary, 'url' | 'route'>): string | null {
  if (trace.url) {
    try {
      return normalizePath(new URL(trace.url).pathname);
    } catch {
      return normalizePath(trace.url.split(/[?#]/)[0]);
    }
  }
  return trace.route ? normalizePath(trace.route) : null;
}

const ROUTE_ID_ATTRIBUTE = 'proxy.kong.route.id';

// konnectRouteKey is `${route.id}:${method}:${pathSegment}:${protocol}`
export function getRouteIdFromKonnectRouteKey(konnectRouteKey: string | null | undefined): string | null {
  if (!konnectRouteKey) {
    return null;
  }
  const routeId = konnectRouteKey.split(':')[0];
  return routeId;
}

/** Ids of the traces having a span served by the Kong route `routeId`. */
export function findTraceIdsByRouteId(details: Map<string, DebugTraceDetail>, routeId: string | null): Set<string> {
  const matching = new Set<string>();
  if (!routeId) {
    return matching;
  }
  for (const [traceId, detail] of details) {
    if (detail.spans.some(span => span.attributes[ROUTE_ID_ATTRIBUTE] === routeId)) {
      matching.add(traceId);
    }
  }
  return matching;
}
