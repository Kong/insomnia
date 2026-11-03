import { useMutation } from '@tanstack/react-query';
import { services } from 'insomnia-data';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { type DebugSession, type DebugSessionApiContext, type DebugTraceDetail } from '~/konnect/debug-session-api';
import {
  asDebugError,
  debugSessionKeys,
  debugSessionQueryOptions,
  debugTraceQueryOptions,
  debugTracesQueryOptions,
  startOrAdoptDebugSession,
  stopSessionById,
} from '~/konnect/debug-session-query';
import { type DebugSessionState, deriveSessionState, getDebugSessionStartedAt } from '~/konnect/debug-trace-helper';
import { useServerDataQueryClient } from '~/ui/context/app/server-data-context';
import uiEventBus, { KONNECT_PAT_CHANGE } from '~/ui/event-bus';
import { useServerQueries, useServerQuery } from '~/ui/hooks/use-query';

const AUTH_KINDS = new Set(['unauthorized', 'forbidden']);

export function useKonnectDebuggerSession({
  konnectControlPlaneId,
  konnectRegion,
  konnectDebugSessionId,
  projectId,
}: {
  konnectControlPlaneId: string;
  konnectRegion: string;
  konnectDebugSessionId: string;
  projectId: string;
}) {
  const queryClient = useServerDataQueryClient();
  // Null means the pat has not been loaded yet from secret storage.
  const [pat, setPat] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    window.main.secretStorage.getSecret('konnectPat').then(secret => {
      if (!cancelled) {
        setPat(secret || '');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Subscribe to Konnect PAT changes and update accordingly
  useEffect(() => {
    return uiEventBus.on(KONNECT_PAT_CHANGE, (newPat: string) => {
      setPat(newPat);
    });
  }, []);

  const isPatLoaded = pat !== null;

  const ctx: DebugSessionApiContext = useMemo(
    () => ({
      pat: pat || '',
      region: konnectRegion,
      controlPlaneId: konnectControlPlaneId,
    }),
    [pat, konnectRegion, konnectControlPlaneId],
  );

  const [sessionId, setSessionId] = useState<string | null>(konnectDebugSessionId || null);
  // const [isDebugSessionMissing, setDebugSessionMissing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Adopt a debug session by updating the query cache, local state, and project data.
  const adoptSession = (debugSession: DebugSession) => {
    const debugSessionId = debugSession.id;
    queryClient.setQueryData(debugSessionKeys.debugSession(konnectControlPlaneId, debugSessionId), debugSession);
    setSessionId(debugSessionId);
    services.project.update(projectId, { konnectDebugSessionId: debugSessionId });
  };

  // fetch the debug session from the server
  const {
    data: debugSession,
    error: debugSessionOriginError,
    refetch: refetchDebugSession,
    isLoading: isLoadingDebugSession,
    isFetching: isFetchingDebugSession,
  } = useServerQuery({
    ...debugSessionQueryOptions(ctx, sessionId || ''),
    enabled: isPatLoaded && !!sessionId,
  });
  const debugSessionError = asDebugError(debugSessionOriginError);
  // The debug session is considered missing(deleted) if the server returns a 'not_found' error.
  const isDebugSessionMissingFromServer = debugSessionError && debugSessionError?.kind === 'not_found';

  // fetch the debug session trace list from the server
  const {
    data: debugSessionTraces,
    error: tracesOriginError,
    refetch: refetchTraces,
    isFetching: isFetchingTraces,
  } = useServerQuery({
    ...debugTracesQueryOptions(queryClient, ctx, sessionId || ''),
    enabled: isPatLoaded && !!sessionId && !!debugSession,
  });
  const tracesError = asDebugError(tracesOriginError);

  // Automatically fetch the detail of trace from trace list.
  // The list always contains every trace id, so only fetch details that are not cached yet.
  const traceDetails = useServerQueries({
    queries: (debugSessionTraces || []).map(trace => {
      const options = debugTraceQueryOptions(ctx, sessionId || '', trace.traceId);
      return {
        ...options,
        enabled: isPatLoaded && !!sessionId && queryClient.getQueryData(options.queryKey) === undefined,
      };
    }),
    combine: results => {
      const details = new Map<string, DebugTraceDetail>();
      for (const result of results) {
        if (result.data) {
          details.set(result.data.traceId, result.data);
        }
      }
      return details;
    },
  });

  useEffect(() => {
    if (isDebugSessionMissingFromServer) {
      // setDebugSessionMissing(true);
      setSessionId(null);
      services.project.update(projectId, { konnectDebugSessionId: null });
    }
  }, [isDebugSessionMissingFromServer, projectId]);

  const debugSessionState: DebugSessionState | null = debugSession ? deriveSessionState(debugSession) : null;
  const isDebugSessionActive = debugSessionState === 'active';
  // Update the current time every second while the debug session is active.
  useEffect(() => {
    if (!isDebugSessionActive) {
      return;
    }
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isDebugSessionActive]);
  const debugSessionStartedAt = debugSession ? getDebugSessionStartedAt(debugSession) : null;
  const capturedSecs =
    debugSessionState === 'active' && debugSessionStartedAt
      ? Math.max(0, Math.ceil((now - debugSessionStartedAt) / 1000))
      : 0;

  const startMutation = useMutation(
    {
      mutationFn: (args: { durationSecs: number }) => startOrAdoptDebugSession(ctx, args.durationSecs),
      onSuccess: newSession => {
        adoptSession(newSession);
        queryClient.invalidateQueries({ queryKey: debugSessionKeys.debugSessions(konnectControlPlaneId) });
      },
    },
    queryClient,
  );
  const stopMutation = useMutation(
    {
      mutationFn: () => stopSessionById(ctx, sessionId || ''),
      onSettled: () =>
        queryClient.invalidateQueries({
          queryKey: debugSessionKeys.debugSession(konnectControlPlaneId, sessionId || ''),
        }),
    },
    queryClient,
  );

  const { mutateAsync: startAsync, reset: resetStart } = startMutation;
  const { mutateAsync: stopAsync, reset: resetStop } = stopMutation;

  const startDebugSession = useCallback(
    async (durationSecs: number) => {
      if (!ctx) {
        return;
      }
      resetStop();
      await startAsync({ durationSecs }).catch(() => {});
    },
    [ctx, startAsync, resetStop],
  );

  const stopDebugSession = useCallback(async () => {
    if (!ctx || !sessionId) {
      return;
    }
    resetStart();
    await stopAsync().catch(() => {});
  }, [ctx, sessionId, stopAsync, resetStart]);

  const retryDebugSession = useCallback(() => {
    resetStart();
    resetStop();
    if (sessionId) {
      refetchDebugSession();
      refetchTraces();
    }
  }, [resetStart, resetStop, sessionId, refetchDebugSession, refetchTraces]);

  // Errors from queries are stale while re-fetch, so hide them while loading.
  const errors = [
    isFetchingDebugSession ? null : debugSessionError,
    isFetchingTraces ? null : tracesError,
    asDebugError(startMutation.error),
    asDebugError(stopMutation.error),
  ];
  const authError = errors.find(error => error && AUTH_KINDS.has(error.kind)) ?? null;
  const mutationError = asDebugError(startMutation.error) || asDebugError(stopMutation.error);

  return {
    ctx,
    sessionId,
    debugSession,
    debugSessionState,
    capturedSecs,
    traces: debugSessionTraces || [],
    traceDetails,
    isLoading: !!sessionId && isLoadingDebugSession,
    debugSessionAction: startMutation.isPending ? 'starting' : stopMutation.isPending ? 'stopping' : 'idle',
    authError,
    mutationError: mutationError && !AUTH_KINDS.has(mutationError.kind) ? mutationError : null,
    sessionDeleted: isDebugSessionMissingFromServer,
    hasKonnectPat: !isPatLoaded || !!pat,
    startDebugSession,
    stopDebugSession,
    retryDebugSession,
  };
}

// Hook to fetch a detailed trace for a specific session.
export function useKonnectDebuggerSessionTrace(ctx: DebugSessionApiContext, sessionId: string, traceId: string) {
  const query = useServerQuery(debugTraceQueryOptions(ctx, sessionId, traceId));
  return {
    detail: query.data,
    isLoading: query.isPending,
    errorKind: asDebugError(query.error)?.kind ?? (query.error ? ('unknown' as const) : undefined),
    refetch: query.refetch,
  };
}
