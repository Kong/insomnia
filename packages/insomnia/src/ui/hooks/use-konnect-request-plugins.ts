import { useServerQuery } from '~/ui/hooks/use-query';

import type { KonnectPlugin } from '../../konnect/api';
import type { KonnectSyncedRoute } from '../../konnect/plugin-scope';
import { konnectPluginsQueryOptions, MissingKonnectPatError } from './use-konnect-plugins';

export interface KonnectRequestPluginsState {
  status: 'not-linked' | 'loading' | 'error' | 'ready';
  plugins: KonnectPlugin[];
  error: string | null;
  missingPat: boolean;
}

/**
 * The plugin list for one Konnect-linked request, shared with the request Plugins
 * tab through the same query key. Skips the available-plugins request that only
 * the tab's suggestions need.
 */
export function useKonnectRequestPlugins(syncedRoute: KonnectSyncedRoute | null): KonnectRequestPluginsState {
  const pluginsQuery = useServerQuery(
    konnectPluginsQueryOptions(syncedRoute?.controlPlaneId, syncedRoute?.region),
  );

  const status: KonnectRequestPluginsState['status'] = !syncedRoute
    ? 'not-linked'
    : pluginsQuery.isPending
      ? 'loading'
      : pluginsQuery.isError && pluginsQuery.data === undefined
        ? 'error'
        : 'ready';

  return {
    status,
    plugins: pluginsQuery.data ?? [],
    error: pluginsQuery.error instanceof Error ? pluginsQuery.error.message : null,
    missingPat: pluginsQuery.error instanceof MissingKonnectPatError,
  };
}
