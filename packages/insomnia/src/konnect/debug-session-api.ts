import { isApiError } from 'insomnia-api';

import { insomniaFetch } from '../common/insomnia-fetch';
import { regionalApiBase } from './api';

const POLL_TIMEOUT_MS = 10_000;

export interface DebugSessionApiContext {
  pat: string;
  region: string;
  controlPlaneId: string;
}

export interface DebugSession {
  id: string;
  name?: string;
  durationSecs: number;
  startedAt: string | null;
  stoppedAt: string | null;
  completedAt: string | null;
  timedOut: boolean;
  targets: string[];
}

export interface DebugTraceSummary {
  traceId: string;
  rootTraceName: string | null;
  startTimeUnixNano: string;
  durationMs: number;
  method: string | null;
  url: string | null;
  route: string | null;
  statusCode: number | null;
}

export interface DebugSpan {
  spanId: string;
  parentSpanId: string | null;
  name: string;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: Record<string, any>;
}

export interface DebugTraceDetail {
  traceId: string;
  spans: DebugSpan[];
}

export type DebugErrorKind = 'unauthorized' | 'forbidden' | 'not_found' | 'rate_limited' | 'network' | 'unknown';

export class DebugApiError extends Error {
  kind: DebugErrorKind;
  retryAfterMs?: number;
  constructor(kind: DebugErrorKind, message: string, retryAfterMs?: number) {
    super(message);
    this.name = 'DebugApiError';
    this.kind = kind;
    this.retryAfterMs = retryAfterMs;
  }
}

export function toDebugApiError(err: unknown): DebugApiError {
  if (err instanceof DebugApiError) {
    return err;
  }
  if (isApiError(err)) {
    const status = err.response.status;
    if (status === 401) {
      return new DebugApiError('unauthorized', 'Personal access token is invalid or expired.');
    }
    if (status === 403) {
      return new DebugApiError('forbidden', 'Personal access token lacks permission for the debugger.');
    }
    if (status === 404) {
      return new DebugApiError('not_found', 'Not found.');
    }
    if (status === 429) {
      const retryAfter = Number.parseInt(err.response.headers.get('Retry-After') ?? '', 10);
      return new DebugApiError(
        'rate_limited',
        'Konnect rate limit reached.',
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined,
      );
    }
    return new DebugApiError('unknown', `Konnect returned ${status}.`);
  }
  const message = err instanceof Error ? err.message : 'Could not reach Konnect.';
  return new DebugApiError('network', message);
}

async function request<T>(
  ctx: DebugSessionApiContext,
  method: 'GET' | 'POST',
  path: string,
  options: { data?: unknown; timeout?: number } = {},
): Promise<T> {
  try {
    return await insomniaFetch<T>({
      method,
      path,
      data: options.data,
      timeout: options.timeout,
      sessionId: null,
      origin: regionalApiBase(ctx.region),
      headers: { Authorization: `Bearer ${ctx.pat}` },
    });
  } catch (err) {
    throw toDebugApiError(err);
  }
}

const sessionsPath = (ctx: DebugSessionApiContext) => `/v1/control-planes/${ctx.controlPlaneId}/o11y/debug-sessions`;

type Raw = Record<string, any>;

function normalizeSession(raw: Raw): DebugSession {
  return {
    id: String(raw.id),
    name: raw.name ?? undefined,
    durationSecs: Number(raw.duration_secs ?? 0),
    startedAt: raw.started_at ?? null,
    stoppedAt: raw.stopped_at ?? null,
    completedAt: raw.completed_at ?? null,
    timedOut: raw.timed_out === true,
    targets: Array.isArray(raw.targets) ? raw.targets : [],
  };
}

// Attribute names used in debug traces
const attributeNames = {
  HTTP_REQUEST_METHOD: 'http.request.method',
  URL_FULL: 'url.full',
  HTTP_ROUTE: 'http.route',
  HTTP_RESPONSE_STATUS_CODE: 'http.response.status_code',
};

function normalizeTraceSummary(raw: Raw): DebugTraceSummary {
  const spans: Raw[] = (raw.span_sets ?? []).flatMap((set: Raw) => set?.spans ?? []);
  const attributes: Raw = Object.assign({}, ...spans.map(span => span?.attributes ?? {}));
  const status = attributes[attributeNames.HTTP_RESPONSE_STATUS_CODE];
  return {
    traceId: String(raw.trace_id),
    rootTraceName: raw.root_trace_name ?? null,
    startTimeUnixNano: String(raw.start_time_unix_nano ?? '0'),
    durationMs: Number(raw.duration_ms ?? 0),
    method: attributes[attributeNames.HTTP_REQUEST_METHOD] ?? null,
    url: attributes[attributeNames.URL_FULL] ?? null,
    route: attributes[attributeNames.HTTP_ROUTE] ?? null,
    statusCode: status === undefined || status === null ? null : Number(status),
  };
}

function normalizeTraceDetail(traceId: string, raw: Raw): DebugTraceDetail {
  const spans: DebugSpan[] = [];
  for (const resourceSpan of raw.resource_spans ?? []) {
    for (const scopeSpan of resourceSpan?.scope_spans ?? []) {
      for (const span of scopeSpan?.spans ?? []) {
        spans.push({
          spanId: String(span.span_id),
          parentSpanId: span.parent_span_id || null,
          name: String(span.name || ''),
          startTimeUnixNano: String(span.start_time_unix_nano ?? '0'),
          endTimeUnixNano: String(span.end_time_unix_nano ?? span.start_time_unix_nano ?? '0'),
          attributes: span.attributes ?? {},
        });
      }
    }
  }
  return { traceId, spans };
}

export async function listNodeIds(ctx: DebugSessionApiContext): Promise<string[]> {
  const body = await request<Raw>(ctx, 'GET', `/v2/control-planes/${ctx.controlPlaneId}/nodes?size=100`);
  const nodes: Raw[] = Array.isArray(body?.items) ? body.items : Array.isArray(body?.data) ? body.data : [];
  return nodes.map(node => String(node.id)).filter(Boolean);
}

export async function listDebugSessions(ctx: DebugSessionApiContext): Promise<DebugSession[]> {
  const body = await request<Raw>(ctx, 'GET', `${sessionsPath(ctx)}?page[size]=50`, { timeout: POLL_TIMEOUT_MS });
  return (Array.isArray(body?.data) ? body.data : []).map(normalizeSession);
}

export async function createDebugSession(
  ctx: DebugSessionApiContext,
  durationSecs: number,
  targets: string[],
): Promise<DebugSession> {
  const body = await request<Raw>(ctx, 'POST', sessionsPath(ctx), {
    data: { name: 'Insomnia debugger', duration_secs: durationSecs, targets, capture_traces: true },
  });
  return normalizeSession(body);
}

export async function getDebugSession(ctx: DebugSessionApiContext, sessionId: string): Promise<DebugSession> {
  const body = await request<Raw>(ctx, 'GET', `${sessionsPath(ctx)}/${sessionId}`, { timeout: POLL_TIMEOUT_MS });
  return normalizeSession(body);
}

export async function stopDebugSession(ctx: DebugSessionApiContext, sessionId: string): Promise<void> {
  await request(ctx, 'POST', `${sessionsPath(ctx)}/${sessionId}/stop`);
}

export async function listDebugTraces(
  ctx: DebugSessionApiContext,
  sessionId: string,
  limit = 2000,
): Promise<DebugTraceSummary[]> {
  const body = await request<Raw>(ctx, 'GET', `${sessionsPath(ctx)}/${sessionId}/traces?limit=${limit}`, {
    timeout: POLL_TIMEOUT_MS,
  });
  return (Array.isArray(body?.traces) ? body.traces : []).map(normalizeTraceSummary);
}

export async function getDebugTrace(
  ctx: DebugSessionApiContext,
  sessionId: string,
  traceId: string,
): Promise<DebugTraceDetail> {
  const body = await request<Raw>(ctx, 'GET', `${sessionsPath(ctx)}/${sessionId}/traces/${traceId}`);
  return normalizeTraceDetail(traceId, body);
}
