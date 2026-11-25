import { queryOptions } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useServerQuery } from '~/ui/hooks/use-query';

import { fetchAllPlugins, fetchAvailablePluginNames, type KonnectPlugin } from '../../konnect/api';
import type { KonnectSyncedRoute } from '../../konnect/plugin-scope';

export interface KonnectPluginsState {
  status: 'not-linked' | 'loading' | 'error' | 'ready';
  plugins: KonnectPlugin[];
  availableSuggestionNames: string[] | null;
  availabilityStatus: 'loading' | 'ready' | 'error';
  error: string | null;
  missingPat: boolean;
  isRefreshing: boolean;
  refresh: () => void;
}

export class MissingKonnectPatError extends Error {
  constructor() {
    super('No Kong Konnect personal access token is configured.');
    this.name = 'MissingKonnectPatError';
  }
}

const PLUGINS_STALE_TIME_MS = 60 * 1000;
const PLUGINS_GC_TIME_MS = 30 * 60 * 1000;
const AVAILABLE_PLUGINS_STALE_TIME_MS = 30 * 60 * 1000;
const AVAILABLE_PLUGINS_GC_TIME_MS = 60 * 60 * 1000;

/**
 * One plugin list per control plane, shared by every surface that needs it
 * (request Plugins tab, response-side plugins pane). Consumers mount at different
 * times, so TanStack Query is what keeps them from refetching the same list.
 */
export const konnectPluginsQueryOptions = (controlPlaneId: string | undefined, region: string | undefined) =>
  queryOptions({
    queryKey: ['konnect-plugins', 'v3', controlPlaneId, region],
    queryFn: async ({ signal }) => {
      const pat = await window.main.secretStorage.getSecret('konnectPat');
      if (!pat) {
        throw new MissingKonnectPatError();
      }
      return fetchAllPlugins(pat, controlPlaneId!, region!, signal);
    },
    enabled: Boolean(controlPlaneId && region),
    staleTime: PLUGINS_STALE_TIME_MS,
    gcTime: PLUGINS_GC_TIME_MS,
    retry: false,
  });

export function useKonnectPlugins(syncedRoute: KonnectSyncedRoute | null): KonnectPluginsState {
  const controlPlaneId = syncedRoute?.controlPlaneId;
  const region = syncedRoute?.region;

  const pluginsQuery = useServerQuery(konnectPluginsQueryOptions(controlPlaneId, region));

  const availabilityQuery = useServerQuery({
    queryKey: ['konnect-available-plugins', 'v1', controlPlaneId, region],
    queryFn: async ({ signal }) => {
      const pat = await window.main.secretStorage.getSecret('konnectPat');
      if (!pat) {
        throw new MissingKonnectPatError();
      }
      try {
        return await fetchAvailablePluginNames(pat, controlPlaneId!, region!, signal);
      } catch (error) {
        console.warn(`[konnect] Failed to check available plugins for control plane ${controlPlaneId}`, error);
        throw error;
      }
    },
    enabled: Boolean(controlPlaneId && region),
    staleTime: AVAILABLE_PLUGINS_STALE_TIME_MS,
    gcTime: AVAILABLE_PLUGINS_GC_TIME_MS,
    retry: false,
  });

  const status: KonnectPluginsState['status'] = !syncedRoute
    ? 'not-linked'
    : pluginsQuery.isPending
      ? 'loading'
      : pluginsQuery.isError && pluginsQuery.data === undefined
        ? 'error'
        : 'ready';

  const refetchPlugins = pluginsQuery.refetch;
  const refetchAvailability = availabilityQuery.refetch;
  const refresh = useCallback(() => {
    void refetchPlugins();
    void refetchAvailability();
  }, [refetchPlugins, refetchAvailability]);

  return {
    status,
    plugins: pluginsQuery.data ?? [],
    availableSuggestionNames: availabilityQuery.data ?? null,
    availabilityStatus: availabilityQuery.isPending ? 'loading' : availabilityQuery.isError ? 'error' : 'ready',
    error: pluginsQuery.error instanceof Error ? pluginsQuery.error.message : null,
    missingPat: pluginsQuery.error instanceof MissingKonnectPatError,
    isRefreshing: pluginsQuery.isFetching || availabilityQuery.isFetching,
    refresh,
  };
}
