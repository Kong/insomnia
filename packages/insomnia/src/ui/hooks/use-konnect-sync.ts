import { useRef, useState } from 'react';
import { useRevalidator } from 'react-router';

import type { SyncResult } from '../../konnect/sync';
import { syncKonnect } from '../../konnect/sync';
import { SegmentEvent } from '../analytics';

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
  const { revalidate } = useRevalidator();

  const startSync = async (organizationId: string): Promise<SyncResult | null> => {
    const pat = await window.main.secretStorage.getSecret('konnectPat');
    if (!pat) {
      setState({ syncing: false, progress: '', error: 'No PAT found. Go to Preferences → Konnect to add one.' });
      return null;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setState({ syncing: true, progress: 'Starting sync...', error: null });

    const result = await syncKonnect({
      pat,
      organizationId,
      signal: controller.signal,
      onProgress: message => {
        setState(s => ({ ...s, progress: message }));
        revalidate();
      },
    });

    abortRef.current = null;
    revalidate();

    const cancelled = controller.signal.aborted;
    setState({
      syncing: false,
      progress: '',
      error: !result.success && !cancelled ? (result.error ?? 'Sync failed') : null,
    });

    window.main.trackSegmentEvent({
      event: SegmentEvent.kongKonnectSyncCompleted,
      properties: {
        success: result.success,
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
        ...(result.error ? { error: result.error } : {}),
      },
    });

    return result;
  };

  const cancelSync = () => {
    abortRef.current?.abort();
  };

  return { syncing: state.syncing, progress: state.progress, error: state.error, startSync, cancelSync };
}
