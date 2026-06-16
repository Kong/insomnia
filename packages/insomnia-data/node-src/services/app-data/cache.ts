import { QueryClient } from '@tanstack/query-core';
import type {
  BaseModel,
  ChangeBufferEvent,
  CollectionWorkspaceChildren,
  IDatabase,
  OrganizationData,
  WorkspaceChildren,
  WorkspaceChildrenForScope,
  WorkspaceMeta,
  WorkspaceScope,
} from 'insomnia-data';
import { models } from 'insomnia-data';
import { organizationDataKeys, workspaceChildrenKeys } from 'insomnia-data/common';

import type * as organizationDataModule from './organization-data';
import type * as workspaceDataModule from './workspace-data';

export type AppDataService = typeof organizationDataModule & typeof workspaceDataModule;

const COLLECTION_REQUEST_DOC_TYPES: string[] = [
  models.request.type,
  models.grpcRequest.type,
  models.webSocketRequest.type,
  models.socketIORequest.type,
  models.requestGroup.type,
];

const COLLECTION_REQUEST_META_DOC_TYPES: string[] = [
  models.requestMeta.type,
  models.grpcRequestMeta.type,
  models.webSocketRequestMeta.type,
  models.socketIORequestMeta.type,
];

const COLLECTION_CHILDREN_DOC_TYPES: string[] = [
  ...COLLECTION_REQUEST_DOC_TYPES,
  ...COLLECTION_REQUEST_META_DOC_TYPES,
  models.requestGroupMeta.type,
];

const WORKSPACE_CHILD_DOC_TYPES: string[] = [
  ...COLLECTION_CHILDREN_DOC_TYPES,
  models.mockServer.type,
  models.apiSpec.type,
  models.mcpRequest.type,
  models.environment.type,
];

const MONITOR_DOC_TYPES: string[] = [
  models.project.type,
  models.workspace.type,
  models.gitRepository.type,
  models.workspaceMeta.type,
  ...WORKSPACE_CHILD_DOC_TYPES,
];

type AppDataCacheUpdateListener = (queryKey: string[], data: unknown) => void;

// Create app data cache that overrides the default service method to get organization and workspace children data.
// It will listen to database changes and invalidate the cache when necessary.
export function createCachedAppDataService(
  appData: AppDataService,
  db: IDatabase,
  onUpdate?: AppDataCacheUpdateListener,
): AppDataService {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        //  Infinity means cached data never expires or gets garbage-collected
        staleTime: Infinity,
        gcTime: Infinity,
        retry: false,
      },
    },
  });

  if (onUpdate) {
    queryClient.getQueryCache().subscribe(event => {
      if (event.type === 'updated' && event.action.type === 'success' && event.query.state.data !== undefined) {
        onUpdate(event.query.queryKey, event.query.state.data);
      }
    });
  }

  /**
   * Fetches organization data for the given organization ID.
   *
   * Returns an OrganizationData object with the following structure:
   * ```
   * {
   *   projects: Project[];
   *   workspaces: Workspace[];
   *   workspaceMetas: WorkspaceMeta[];
   * }
   * ```
   *
   * @param organizationId - The ID of the organization to fetch
   * @returns Promise resolving to the organization data
   */
  const getOrganizationData = (organizationId: string): Promise<OrganizationData> =>
    queryClient.fetchQuery({
      queryKey: organizationDataKeys.byOrganizationId(organizationId),
      queryFn: () => appData.getOrganizationData(organizationId),
    });

  /**
   * Fetches children data for the given workspace IDs.
   *
   * Currently used for collection workspaces. Returns a map of workspace IDs to their children data with the following structure:
   * The children data has been flattened to include both requests and request groups in a single array.
   * ```
   * {
   *   children: {
   *     requestsAndGroups: (
   *       Request | GrpcRequest | WebSocketRequest | SocketIORequest | RequestGroup
   *     )[];
   *   };
   *   childrenMetas: {
   *     allRequestMetas: (
   *       RequestMeta | GrpcRequestMeta | WebSocketRequestMeta | SocketIORequestMeta
   *     )[];
   *     requestGroupMetas: RequestGroupMeta[];
   *   };
   * }
   * ```
   *
   * @param workspaceIds - Array of workspace IDs to fetch children
   * @param scope - Optional scope to filter children ('collection', 'design', 'mock-server', 'environment' or 'mcp')
   * @returns Promise resolving to a map of workspace IDs to their children data
   */
  const getWorkspaceChildren = async <S extends WorkspaceScope | undefined = undefined>(
    workspaceIds: string[],
    scope?: S,
  ): Promise<Map<string, WorkspaceChildrenForScope<S>>> => {
    const result = new Map<string, WorkspaceChildrenForScope<S>>();

    const workspaceChildrenQueryFn = (workspaceId: string) => async () => {
      const fetched = await appData.getWorkspaceChildren([workspaceId], scope);
      return fetched.get(workspaceId);
    };

    const uncachedWorkspaceIds = workspaceIds.filter(
      workspaceId => queryClient.getQueryData(workspaceChildrenKeys.byWorkspaceId(workspaceId)) === undefined,
    );
    if (uncachedWorkspaceIds.length > 0) {
      const fetched = await appData.getWorkspaceChildren(uncachedWorkspaceIds, scope);
      const queryCache = queryClient.getQueryCache();
      uncachedWorkspaceIds.forEach(workspaceId => {
        const data = fetched.get(workspaceId);
        if (data === undefined) {
          return;
        }
        // Update the cache for those uncached workspace, and manually set the data to avoid triggering a refetch since we query the data in one batch.
        queryCache
          .build(queryClient, {
            queryKey: workspaceChildrenKeys.byWorkspaceId(workspaceId),
            queryFn: workspaceChildrenQueryFn(workspaceId),
          })
          .setData(data, { manual: true });
      });
    }

    await Promise.all(
      workspaceIds.map(async workspaceId => {
        const data = await queryClient.fetchQuery({
          queryKey: workspaceChildrenKeys.byWorkspaceId(workspaceId),
          queryFn: async () => {
            const fetched = await appData.getWorkspaceChildren([workspaceId], scope);
            return fetched.get(workspaceId);
          },
        });
        if (data) {
          result.set(workspaceId, data as WorkspaceChildrenForScope<S>);
        }
      }),
    );
    return result;
  };

  // Register a listener to invalidate the cache when target doc is changed in the database.
  db.onChange(changes => invalidateCacheData(queryClient, changes));

  return {
    ...appData,
    getOrganizationData,
    getWorkspaceChildren,
  };
}

function findOrganizationAndProjectIdForWorkspace(
  queryClient: QueryClient,
  doc: BaseModel,
): { organizationId: string; projectId: string } | undefined {
  const cached = queryClient.getQueriesData<OrganizationData>({ queryKey: organizationDataKeys.all });
  const { parentId } = doc;
  for (const [queryKey, data] of cached) {
    const project = data?.projects.find(p => p._id === parentId);
    if (project) {
      return { organizationId: queryKey[1] as string, projectId: project._id };
    }
  }
  return undefined;
}

function findOrganizationFromWorkspaceId(queryClient: QueryClient, workspaceId: string): string | undefined {
  const cached = queryClient.getQueriesData<OrganizationData>({ queryKey: organizationDataKeys.all });
  for (const [queryKey, data] of cached) {
    if (data?.workspaces.some(w => w._id === workspaceId)) {
      return queryKey[1] as string;
    }
  }
  return undefined;
}

// If the organization query has no data yet，invalidate instead. Once any in-flight fetch resolves, the query is marked stale so the next read will re-fetch
function invalidateIfOrganizationDataUncached(queryClient: QueryClient, organizationId: string): boolean {
  const queryKey = organizationDataKeys.byOrganizationId(organizationId);
  if (queryClient.getQueryData<OrganizationData>(queryKey) === undefined) {
    queryClient.invalidateQueries({ queryKey, refetchType: 'all' });
    return true;
  }
  return false;
}

function updateOrganizationDataWorkspaceMeta(
  queryClient: QueryClient,
  organizationId: string,
  workspaceMeta: BaseModel,
) {
  if (invalidateIfOrganizationDataUncached(queryClient, organizationId)) {
    return;
  }
  queryClient.setQueryData<OrganizationData>(organizationDataKeys.byOrganizationId(organizationId), previous => {
    if (previous) {
      const clonedWorkspaceMetas = [...previous.workspaceMetas];
      const workspaceMetaIdx = clonedWorkspaceMetas.findIndex(wm => wm._id === workspaceMeta._id);
      if (workspaceMetaIdx !== -1) {
        clonedWorkspaceMetas[workspaceMetaIdx] = workspaceMeta as WorkspaceMeta;
        return { ...previous, workspaceMetas: clonedWorkspaceMetas };
      }
    }
    return previous;
  });
}

function deleteOrganizationDataWorkspaceMeta(
  queryClient: QueryClient,
  organizationId: string,
  workspaceMeta: BaseModel,
) {
  if (invalidateIfOrganizationDataUncached(queryClient, organizationId)) {
    return;
  }
  queryClient.setQueryData<OrganizationData>(organizationDataKeys.byOrganizationId(organizationId), previous => {
    if (previous) {
      return { ...previous, workspaceMetas: previous.workspaceMetas.filter(wm => wm._id !== workspaceMeta._id) };
    }
    return previous;
  });
}

function addOrganizationDataWorkspaceMeta(queryClient: QueryClient, organizationId: string, workspaceMeta: BaseModel) {
  if (invalidateIfOrganizationDataUncached(queryClient, organizationId)) {
    return;
  }
  queryClient.setQueryData<OrganizationData>(organizationDataKeys.byOrganizationId(organizationId), previous => {
    if (previous) {
      return { ...previous, workspaceMetas: [...previous.workspaceMetas, workspaceMeta as WorkspaceMeta] };
    }
    return previous;
  });
}

function findWorkspaceIdForDoc(queryClient: QueryClient, doc: BaseModel): string | undefined {
  const cachedWorkspaces = queryClient.getQueriesData<WorkspaceChildren>({ queryKey: workspaceChildrenKeys.all });
  for (const [queryKey, data] of cachedWorkspaces) {
    const workspaceId = queryKey[1] as string;
    if (!data || !data.children || !('requestsAndGroups' in data.children)) {
      continue;
    }
    if (
      doc.parentId === workspaceId ||
      data.children.requestsAndGroups.some(r => r._id === doc._id || r._id === doc.parentId)
    ) {
      return workspaceId;
    }
  }
  return undefined;
}

function replaceById<T extends BaseModel>(list: T[], doc: BaseModel): T[] | null {
  const index = list.findIndex(item => item._id === doc._id);
  if (index === -1) {
    return null;
  }
  // Doc parent id has changed, so it is no longer a child of the same parent. Return null to indicate that the cache should be invalidated instead of updated in place.
  if (list[index].parentId !== doc.parentId) {
    return null;
  }
  const next = list.slice();
  next[index] = doc as unknown as T;
  return next;
}

function updateCollectionChildrenWithUpdatedDoc(
  collectionChildren: CollectionWorkspaceChildren,
  doc: BaseModel,
): CollectionWorkspaceChildren | null {
  if (COLLECTION_REQUEST_DOC_TYPES.includes(doc.type)) {
    const requestsAndGroups = replaceById(collectionChildren.children.requestsAndGroups, doc);
    return requestsAndGroups ? { ...collectionChildren, children: { requestsAndGroups } } : null;
  }
  if (COLLECTION_REQUEST_META_DOC_TYPES.includes(doc.type)) {
    const allRequestMetas = replaceById(collectionChildren.childrenMetas.allRequestMetas, doc);
    return allRequestMetas
      ? { ...collectionChildren, childrenMetas: { ...collectionChildren.childrenMetas, allRequestMetas } }
      : null;
  }
  if (doc.type === models.requestGroupMeta.type) {
    const requestGroupMetas = replaceById(collectionChildren.childrenMetas.requestGroupMetas, doc);
    return requestGroupMetas
      ? { ...collectionChildren, childrenMetas: { ...collectionChildren.childrenMetas, requestGroupMetas } }
      : null;
  }
  return null;
}

function invalidateCacheData(queryClient: QueryClient, changes: ChangeBufferEvent[]) {
  const organizationIdsToRevalidate = new Set<string>();
  const workspaceIdsToRevalidate = new Set<string>();

  for (const [event, doc] of changes) {
    // We do not use the patches here because some db operations do not contain patches like git repo file watcher
    if (!MONITOR_DOC_TYPES.includes(doc.type)) {
      continue;
    }

    if (doc.type === models.project.type) {
      organizationIdsToRevalidate.add(doc.parentId);
      continue;
    }

    if (doc.type === models.workspace.type) {
      const { organizationId } = findOrganizationAndProjectIdForWorkspace(queryClient, doc) || {};
      if (organizationId) {
        organizationIdsToRevalidate.add(organizationId);
      }
      continue;
    }

    if (doc.type === models.gitRepository.type) {
      for (const [queryKey, data] of queryClient.getQueriesData<OrganizationData>({
        queryKey: organizationDataKeys.all,
      })) {
        if (data?.projects.some(p => p.gitRepository?._id === doc._id)) {
          organizationIdsToRevalidate.add(queryKey[1] as string);
        }
      }
      continue;
    }

    if (doc.type === models.workspaceMeta.type) {
      // Meta changes very frequently, so patch the cache in place instead of invalidating it.
      const organizationId = findOrganizationFromWorkspaceId(queryClient, doc.parentId);
      if (organizationId) {
        if (event === 'insert') {
          addOrganizationDataWorkspaceMeta(queryClient, organizationId, doc);
        } else if (event === 'update') {
          updateOrganizationDataWorkspaceMeta(queryClient, organizationId, doc);
        } else if (event === 'remove') {
          deleteOrganizationDataWorkspaceMeta(queryClient, organizationId, doc);
        }
      }
      continue;
    }

    if (COLLECTION_CHILDREN_DOC_TYPES.includes(doc.type)) {
      if (event === 'update') {
        const docWorkspaceId = findWorkspaceIdForDoc(queryClient, doc);
        // update the cached collection children if the doc is already cached, otherwise invalidate the cache for the workspace
        let isUpdated = false;
        if (docWorkspaceId) {
          queryClient.setQueryData<CollectionWorkspaceChildren>(
            workspaceChildrenKeys.byWorkspaceId(docWorkspaceId),
            previous => {
              if (previous) {
                const updated = updateCollectionChildrenWithUpdatedDoc(previous, doc);
                if (updated) {
                  isUpdated = true;
                  return updated;
                }
              }
              return previous;
            },
          );
        }
        if (isUpdated) {
          continue;
        }

        // Handle either the doc isn't cached yet, or it moved to a different parent
        const docId = doc._id;
        const docNewParentId = doc.parentId;
        let originDocWorkspaceId: string | undefined;
        let newDocWorkspaceId: string | undefined;

        for (const [queryKey, data] of queryClient.getQueriesData<WorkspaceChildren>({
          queryKey: workspaceChildrenKeys.all,
        })) {
          const workspaceId = queryKey[1] as string;
          if (docNewParentId === workspaceId) {
            newDocWorkspaceId = workspaceId;
          }
          if (!data || !data.children || !('requestsAndGroups' in data.children)) {
            continue;
          }
          if (data.children.requestsAndGroups.some(r => r._id === docId)) {
            // find origin workspace id for doc by _id, since the parentId may have changed
            originDocWorkspaceId = workspaceId;
          }
          if (data.children.requestsAndGroups.some(r => r._id === docNewParentId)) {
            // find the new workspace id for doc by parentId
            newDocWorkspaceId = workspaceId;
          }
        }
        if (originDocWorkspaceId) {
          workspaceIdsToRevalidate.add(originDocWorkspaceId);
        }
        if (newDocWorkspaceId && newDocWorkspaceId !== originDocWorkspaceId) {
          workspaceIdsToRevalidate.add(newDocWorkspaceId);
        }
      } else {
        // add or remove requests, refresh the collection children
        const docWorkspaceId = findWorkspaceIdForDoc(queryClient, doc);
        docWorkspaceId && workspaceIdsToRevalidate.add(docWorkspaceId);
      }
    } else {
      // Other workspace child types (mock servers, api specs, mcp requests, environments), invalidate and refetch the workspace children
      const parentId = doc.parentId;
      if (models.workspace.isWorkspaceId(parentId)) {
        workspaceIdsToRevalidate.add(parentId);
      }
    }
  }

  // Must use refreshType: 'all' to trigger observers
  workspaceIdsToRevalidate.forEach(workspaceId =>
    queryClient.invalidateQueries({ queryKey: workspaceChildrenKeys.byWorkspaceId(workspaceId), refetchType: 'all' }),
  );
  organizationIdsToRevalidate.forEach(organizationId =>
    queryClient.invalidateQueries({
      queryKey: organizationDataKeys.byOrganizationId(organizationId),
      refetchType: 'all',
    }),
  );
}
