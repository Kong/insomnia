import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CollectionWorkspaceChildren, OrganizationData, WorkspaceChildren } from 'insomnia-data';
import { services } from 'insomnia-data';
import { useEffect, useMemo, useState } from 'react';

import { organizationDataKeys, prefetchUncachedWorkspaceChildren, workspaceChildrenKeys } from '~/common/app-data';

export function useOrganizationData(organizationId: string): OrganizationData {
  const { data } = useQuery({
    queryKey: organizationDataKeys.byOrganizationId(organizationId),
    queryFn: () => services.appData.getOrganizationData(organizationId),
  });
  const emptyData: OrganizationData = {
    projects: [],
    workspaces: [],
    workspaceMetas: [],
  };

  return data ?? emptyData;
}

export function useWorkspaceChildrenData(workspaceId: string): WorkspaceChildren {
  const { data } = useQuery({
    queryKey: workspaceChildrenKeys.byWorkspaceId(workspaceId),
    queryFn: async () => (await services.appData.getWorkspaceChildren([workspaceId])).get(workspaceId),
  });
  const emptyData: WorkspaceChildren = {
    children: {},
    childrenMetas: {},
  };
  return data ?? emptyData;
}

export function useMultipleCollectionWorkspaceChildrenData(
  collectionWorkspaceIds: string[],
): Map<string, CollectionWorkspaceChildren> {
  const queryClient = useQueryClient();

  const collectionWorkspaceIdsKey = useMemo(
    () => [...collectionWorkspaceIds].sort().join(','),
    [collectionWorkspaceIds],
  );

  // Batch fetch uncached workspaces children in a single IPC call, then feed the results into the query cache for each workspace ID.
  const [prefetchedKey, setPrefetchedKey] = useState<string>();
  useEffect(() => {
    if (!collectionWorkspaceIdsKey) {
      return;
    }
    let cancelled = false;
    prefetchUncachedWorkspaceChildren(queryClient, collectionWorkspaceIdsKey.split(','), 'collection').then(() => {
      if (!cancelled) {
        setPrefetchedKey(collectionWorkspaceIdsKey);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [collectionWorkspaceIdsKey, queryClient]);

  const results = useQueries({
    queries: collectionWorkspaceIds.map(workspaceId => ({
      queryKey: workspaceChildrenKeys.byWorkspaceId(workspaceId),
      queryFn: async () => (await services.appData.getWorkspaceChildren([workspaceId], 'collection')).get(workspaceId),
      // Only enable the query once the prefetch has completed for this workspace ID.
      enabled: prefetchedKey === collectionWorkspaceIdsKey,
    })),
  });

  return useMemo(() => {
    const collectionChildrenById = new Map<string, CollectionWorkspaceChildren>();
    collectionWorkspaceIds.forEach((workspaceId, index) => {
      const data = results[index]?.data;
      if (data) {
        collectionChildrenById.set(workspaceId, data);
      }
    });
    return collectionChildrenById;
  }, [collectionWorkspaceIds, results]);
}
