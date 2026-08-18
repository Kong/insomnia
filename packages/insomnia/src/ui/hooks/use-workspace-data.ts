import type { WorkspaceChildren, WorkspaceChildrenForScope, WorkspaceScope } from 'insomnia-data';
import { services } from 'insomnia-data';
import { useEffect, useMemo, useState } from 'react';

import { prefetchUncachedWorkspaceChildren, workspaceChildrenKeys } from '~/common/app-data';
import { useDBQueryClient } from '~/ui/context/app/insomnia-app-data-context';
import { useDBQueries, useDBQuery } from '~/ui/hooks/use-query';

// Renderer hooks that mapping to the @insomnia-data/node-src/services/app-data/workspace-data functions.
// The hooks is used to fetch data from the main process and cache it in the renderer process for future use.
export function useWorkspaceData(workspaceId: string): WorkspaceChildren {
  const { data } = useDBQuery({
    queryKey: workspaceChildrenKeys.byWorkspaceId(workspaceId),
    queryFn: async () => (await services.appData.getWorkspaceChildren([workspaceId])).get(workspaceId),
  });
  const emptyData: WorkspaceChildren = {
    data: {},
    dataMetas: {},
  };
  return data ?? emptyData;
}

export interface MultipleWorkspacesData<S extends WorkspaceScope | undefined = undefined> {
  dataByWorkspaceId: Map<string, WorkspaceChildrenForScope<S>>;
  // Workspace IDs whose query has not resolved yet (still fetching, or waiting on the batch
  // prefetch gate below). Distinguishes "not loaded yet" from "loaded and genuinely empty".
  pendingWorkspaceIds: Set<string>;
}

// Fetch multiple workspaces data in a single IPC call, then feed the results into the query cache for each workspace ID.
export function useMultipleWorkspacesData<S extends WorkspaceScope | undefined = undefined>(
  workspaceIds: string[],
  scope?: S,
): MultipleWorkspacesData<S> {
  const queryClient = useDBQueryClient();

  const workspaceIdKeys = useMemo(() => [...workspaceIds].sort().join(','), [workspaceIds]);

  // Batch fetch uncached workspaces children in a single IPC call, then feed the results into the query cache for each workspace ID.
  const [prefetchedKey, setPrefetchedKey] = useState<string>();
  useEffect(() => {
    if (!workspaceIdKeys) {
      return;
    }
    let cancelled = false;
    prefetchUncachedWorkspaceChildren(queryClient, workspaceIdKeys.split(','), scope)
      .catch(() => {
        console.warn('Failed to prefetch uncached workspace children for collection workspaces');
      })
      .finally(() => {
        if (!cancelled) {
          setPrefetchedKey(workspaceIdKeys);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceIdKeys, queryClient, scope]);

  const results = useDBQueries({
    queries: workspaceIds.map(workspaceId => ({
      queryKey: workspaceChildrenKeys.byWorkspaceId(workspaceId),
      queryFn: async () => (await services.appData.getWorkspaceChildren([workspaceId], scope)).get(workspaceId),
      // Only enable the query once the prefetch has completed for this workspace ID.
      enabled: prefetchedKey === workspaceIdKeys,
    })),
  });

  return useMemo(() => {
    const dataByWorkspaceId = new Map<string, WorkspaceChildrenForScope<S>>();
    const pendingWorkspaceIds = new Set<string>();
    workspaceIds.forEach((workspaceId, index) => {
      const result = results[index];
      if (result?.data) {
        dataByWorkspaceId.set(workspaceId, result.data);
      } else if (result?.isPending) {
        // The query is still pending (waiting for the prefetch to complete or the query to resolve) — mark this workspace ID as pending.
        pendingWorkspaceIds.add(workspaceId);
      }
    });
    return { dataByWorkspaceId, pendingWorkspaceIds };
  }, [workspaceIds, results]);
}
