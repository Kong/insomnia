import { useRef, useState } from 'react';
import { useRevalidator } from 'react-router';

import type { SyncResult } from '../../konnect/sync';
import { syncKonnect } from '../../konnect/sync';
import { AnalyticsEvent } from '../analytics';

const REVALIDATE_DEBOUNCE_MS = 500;

interface KonnectSyncState {
  syncing: boolean;
  progress: string;
  error: string | null;
}

export interface UseKonnectSyncResult {
  syncing: boolean;
  progress: string;
  error: string | null;
  startSync: (organizationId: string) => Promise<SyncResult | null>;
  cancelSync: () => void;
}

export function useKonnectSync(): UseKonnectSyncResult {
  const [state, setState] = useState<KonnectSyncState>({ syncing: false, progress: '', error: null });
  const abortRef = useRef<AbortController | null>(null);
  const revalidateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { revalidate } = useRevalidator();

  const startSync = async (organizationId: string): Promise<SyncResult | null> => {
    if (abortRef.current) { return null; }

    const controller = new AbortController();
    abortRef.current = controller;

    const pat = await window.main.secretStorage.getSecret('konnectPat');
    if (!pat) {
      abortRef.current = null;
      setState({ syncing: false, progress: '', error: 'No PAT found. Go to Preferences → Konnect to add one.' });
      return null;
    }
    setState({ syncing: true, progress: 'Starting sync...', error: null });

    const result = await syncKonnect({
      pat,
      organizationId,
      signal: controller.signal,
      onProgress: message => {
        setState(s => ({ ...s, progress: message }));
        if (revalidateTimerRef.current) { clearTimeout(revalidateTimerRef.current); }
        revalidateTimerRef.current = setTimeout(revalidate, REVALIDATE_DEBOUNCE_MS);
      },
    });

    abortRef.current = null;
    if (revalidateTimerRef.current) { clearTimeout(revalidateTimerRef.current); revalidateTimerRef.current = null; }
    revalidate();

    const cancelled = controller.signal.aborted;
    setState({
      syncing: false,
      progress: '',
      error: !result.success && !cancelled ? (result.error ?? 'Sync failed') : null,
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

    return result;
  };

  const cancelSync = () => {
    abortRef.current?.abort();
  };

  return { syncing: state.syncing, progress: state.progress, error: state.error, startSync, cancelSync };
}
