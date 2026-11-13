import { type Query, type QueryClient, queryOptions } from '@tanstack/react-query';

import {
  createDebugSession,
  DebugApiError,
  type DebugErrorKind,
  type DebugSession,
  type DebugSessionApiContext,
  getDebugSession,
  getDebugTrace,
  listDebugSessions,
  listDebugTraces,
  listNodeIds,
  stopDebugSession,
} from './debug-session-api';
import { deriveSessionState, getDebugSessionEndsAt } from './debug-trace-helper';

export const POLL_INTERVAL_MS = 5000;
/** Poll cadence while the API is failing transiently (rate limit, network). */
export const ERROR_POLL_INTERVAL_MS = 10_000;
/** Pause before the single final traces fetch once a session has ended. */
const FINAL_FETCH_DELAY_MS = 500;
// Time for garbage collection of old debug sessions. 24 hours by default
const GC_TIME_MS = 24 * 60 * 60 * 1000;
const DISCOVERY_STALE_TIME_MS = 30_000;
const MAX_RETRIES = 2;

export const commonQueryOptions = {
  gcTime: GC_TIME_MS,
  retry: shouldRetry,
  retryDelay,
};

export const debugSessionKeys = {
  all: ['konnect-debug-session'],
  byControlPlane: (controlPlaneId: string) => ['konnect-debug-session', controlPlaneId],
  debugSessions: (controlPlaneId: string) => [...debugSessionKeys.byControlPlane(controlPlaneId), 'sessionList'],
  debugSession: (controlPlaneId: string, sessionId: string) => [
    ...debugSessionKeys.byControlPlane(controlPlaneId),
    'sessionDetail',
    sessionId,
  ],
  traces: (controlPlaneId: string, sessionId: string) => [
    ...debugSessionKeys.debugSession(controlPlaneId, sessionId),
    'traceList',
  ],
  trace: (controlPlaneId: string, sessionId: string, traceId: string) => [
    ...debugSessionKeys.debugSession(controlPlaneId, sessionId),
    'traceDetail',
    traceId,
  ],
};

const TERMINAL_ERRORS: ReadonlySet<DebugErrorKind> = new Set(['unauthorized', 'forbidden', 'not_found']);

export function asDebugError(error: unknown): DebugApiError | null {
  return error instanceof DebugApiError ? error : null;
}

export function isTerminalError(error: unknown): boolean {
  const debugError = asDebugError(error);
  return !!debugError && TERMINAL_ERRORS.has(debugError.kind);
}

export function shouldRetry(failureCount: number, error: unknown): boolean {
  return !isTerminalError(error) && failureCount < MAX_RETRIES;
}

export function retryDelay(attempt: number, error: unknown): number {
  return asDebugError(error)?.retryAfterMs ?? Math.min(1000 * 2 ** attempt, 10_000);
}

function errorInterval(error: unknown): number {
  return asDebugError(error)?.retryAfterMs ?? ERROR_POLL_INTERVAL_MS;
}

export function isSessionEnded(session: DebugSession | undefined): boolean {
  if (!session) {
    return true;
  }
  const sessionState = deriveSessionState(session);
  // Only consider the session ended if it is cancelled, completed.
  return ['cancelled', 'completed'].includes(sessionState);
}

export function getSessionRefetchInterval(args: { session: DebugSession | undefined; error: unknown }): number | false {
  const { session, error } = args;
  if (isTerminalError(error) || isSessionEnded(session)) {
    return false;
  }
  if (error) {
    return errorInterval(error);
  }
  return POLL_INTERVAL_MS;
}

// Check whether traces are final based on session end and last update timestamps.
export function areTracesFinal(args: {
  session: DebugSession | undefined;
  sessionUpdatedAt: number;
  tracesUpdatedAt: number;
}): boolean {
  const { session, sessionUpdatedAt, tracesUpdatedAt } = args;
  if (!session || !isSessionEnded(session) || tracesUpdatedAt === 0) {
    return false;
  }
  const endedByServer = !!(session.stoppedAt || session.completedAt || session.timedOut);
  // Determine the cutoff timestamp for considering traces as final.
  // If the session ended by the server, use the session's last update time; otherwise, use the expected end time.
  const cutoff = endedByServer ? sessionUpdatedAt : (getDebugSessionEndsAt(session) ?? sessionUpdatedAt);
  return tracesUpdatedAt > cutoff;
}

export function getTracesRefetchInterval(args: {
  session: DebugSession | undefined;
  sessionUpdatedAt: number;
  tracesUpdatedAt: number;
  error: unknown;
}): number | false {
  const { session, error } = args;
  if (!session || isTerminalError(error) || areTracesFinal(args)) {
    return false;
  }
  if (error) {
    return errorInterval(error);
  }
  // Get trace list more frequent then debug session state
  const defaultInterval = POLL_INTERVAL_MS / 2;
  return isSessionEnded(session) ? FINAL_FETCH_DELAY_MS : defaultInterval;
}

export function pickLatestSession(sessions: DebugSession[]): DebugSession | undefined {
  const startedAt = (session: DebugSession) => new Date(session.startedAt ?? 0).getTime();
  return [...sessions].sort((a, b) => startedAt(b) - startedAt(a))[0];
}

export function debugSessionQueryOptions(ctx: DebugSessionApiContext, sessionId: string) {
  return queryOptions({
    queryKey: debugSessionKeys.debugSession(ctx.controlPlaneId, sessionId),
    queryFn: () => getDebugSession(ctx, sessionId),
    refetchInterval: (query: Query<DebugSession>) =>
      getSessionRefetchInterval({ session: query.state.data, error: query.state.error }),
    // An ended session never changes again, so revisiting it makes no network call.
    staleTime: (query: Query<DebugSession>) => (isSessionEnded(query.state.data) ? Infinity : 0),
    ...commonQueryOptions,
  });
}

export function debugTracesQueryOptions(client: QueryClient, ctx: DebugSessionApiContext, sessionId: string) {
  const sessionKey = debugSessionKeys.debugSession(ctx.controlPlaneId, sessionId);
  const readSession = () => ({
    session: client.getQueryData<DebugSession>(sessionKey),
    sessionUpdatedAt: client.getQueryState(sessionKey)?.dataUpdatedAt ?? 0,
  });
  return queryOptions({
    queryKey: debugSessionKeys.traces(ctx.controlPlaneId, sessionId),
    queryFn: () => listDebugTraces(ctx, sessionId),
    refetchInterval: query =>
      getTracesRefetchInterval({
        ...readSession(),
        tracesUpdatedAt: query.state.dataUpdatedAt,
        error: query.state.error,
      }),
    staleTime: query =>
      areTracesFinal({ ...readSession(), tracesUpdatedAt: query.state.dataUpdatedAt }) ? Infinity : 0,
    ...commonQueryOptions,
  });
}

export function debugTraceQueryOptions(ctx: DebugSessionApiContext, sessionId: string, traceId: string) {
  return queryOptions({
    queryKey: debugSessionKeys.trace(ctx.controlPlaneId, sessionId, traceId),
    queryFn: () => getDebugTrace(ctx, sessionId, traceId),
    staleTime: Infinity,
    ...commonQueryOptions,
  });
}

/** Used to find a session started elsewhere (another project on the same control plane, or Konnect itself). */
export function debugSessionsQueryOptions(ctx: DebugSessionApiContext) {
  return queryOptions({
    queryKey: debugSessionKeys.debugSessions(ctx.controlPlaneId),
    queryFn: () => listDebugSessions(ctx),
    staleTime: DISCOVERY_STALE_TIME_MS,
    gcTime: GC_TIME_MS,
    retry: shouldRetry,
    retryDelay,
  });
}

export async function startOrAdoptDebugSession(
  ctx: DebugSessionApiContext,
  durationSecs: number,
): Promise<DebugSession> {
  const nodeIds = await listNodeIds(ctx);
  if (nodeIds.length === 0) {
    throw new DebugApiError('unknown', 'No data plane nodes are connected to this control plane.');
  }
  return createDebugSession(ctx, durationSecs, nodeIds);
}

export async function stopSessionById(ctx: DebugSessionApiContext, sessionId: string) {
  try {
    await stopDebugSession(ctx, sessionId);
  } catch (error) {
    // Already gone: nothing left to stop.
    if (asDebugError(error)?.kind !== 'not_found') {
      throw error;
    }
  }
}
