import { useRef, useState } from 'react';
import { useRevalidator } from 'react-router';

import type { SyncResult } from '../../konnect/sync';
import { syncKonnect, zeroCounts } from '../../konnect/sync';
import { AnalyticsEvent } from '../analytics';

const REVALIDATE_DEBOUNCE_MS = 500;

interface KonnectSyncState {
  syncing: boolean;
  progress: string;
}

export interface UseKonnectSyncResult {
  syncing: boolean;
  progress: string;
  startSync: (organizationId: string) => Promise<SyncResult>;
  cancelSync: () => void;
}

export function useKonnectSync(): UseKonnectSyncResult {
  const [state, setState] = useState<KonnectSyncState>({ syncing: false, progress: '' });
  const abortRef = useRef<AbortController | null>(null);
  const revalidateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { revalidate } = useRevalidator();

  const startSync = async (organizationId: string): Promise<SyncResult> => {
    if (abortRef.current) {
      return {
        success: false,
        error: 'Sync already in progress.',
        controlPlanes: zeroCounts(),
        services: zeroCounts(),
        routes: zeroCounts(),
        skippedRoutes: [],
        durationMs: 0,
      };
    }

    const controller = new AbortController();
    abortRef.current = controller;

    const pat = await window.main.secretStorage.getSecret('konnectPat');
    if (!pat) {
      abortRef.current = null;
      setState({ syncing: false, progress: '' });
      return {
        success: false,
        error: 'No Konnect PAT found.',
        controlPlanes: zeroCounts(),
        services: zeroCounts(),
        routes: zeroCounts(),
        skippedRoutes: [],
        durationMs: 0,
      };
    }
    setState({ syncing: true, progress: 'Starting sync...' });

    const result = await syncKonnect({
      pat,
      organizationId,
      signal: controller.signal,
      onProgress: message => {
        setState(s => ({ ...s, progress: message }));
        if (revalidateTimerRef.current) {
          clearTimeout(revalidateTimerRef.current);
        }
        revalidateTimerRef.current = setTimeout(revalidate, REVALIDATE_DEBOUNCE_MS);
      },
    });

    abortRef.current = null;
    if (revalidateTimerRef.current) {
      clearTimeout(revalidateTimerRef.current);
      revalidateTimerRef.current = null;
    }
    revalidate();

    const cancelled = controller.signal.aborted;
    setState({
      syncing: false,
      progress: '',
    });

    window.main.trackAnalyticsEvent({
      event: AnalyticsEvent.kongKonnectSyncCompleted,
      properties: {
        success: result.success,
        cancelled,
        control_planes_total: result.controlPlanes.total,
        control_planes_created: result.controlPlanes.created,
        control_planes_updated: result.controlPlanes.updated,
        control_planes_deleted: result.controlPlanes.deleted,
        services_total: result.services.total,
        services_created: result.services.created,
        services_updated: result.services.updated,
        services_deleted: result.services.deleted,
        routes_total: result.routes.total,
        routes_created: result.routes.created,
        routes_updated: result.routes.updated,
        routes_deleted: result.routes.deleted,
        routes_skipped: result.routes.skipped,
        duration_ms: result.durationMs,
        ...(!cancelled && result.error ? { error: result.error } : {}),
      },
    });

    if (cancelled) {
      result.error = 'Sync cancelled by user.';
    }

    return result;
  };

  const cancelSync = () => {
    abortRef.current?.abort();
  };

  return { syncing: state.syncing, progress: state.progress, startSync, cancelSync };
}
