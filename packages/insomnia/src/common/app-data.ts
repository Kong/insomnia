import type { QueryClient } from '@tanstack/react-query';
import type {
  BaseModel,
  ChangeBufferEvent,
  CollectionWorkspaceChildren,
  OrganizationData,
  WorkspaceChildren,
  WorkspaceChildrenForScope,
  WorkspaceMeta,
  WorkspaceScope,
} from 'insomnia-data';
import { models, services } from 'insomnia-data';

export const organizationDataKeys = {
  all: ['organization-data'],
  byOrganizationId: (organizationId: string) => [...organizationDataKeys.all, organizationId],
};

export const workspaceChildrenKeys = {
  all: ['workspaceChildrenAndMetas'],
  byWorkspaceId: (workspaceId: string) => [...workspaceChildrenKeys.all, workspaceId],
};

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

export async function prefetchUncachedWorkspaceChildren<S extends WorkspaceScope | undefined = undefined>(
  queryClient: QueryClient,
  workspaceIds: string[],
  scope?: S,
) {
  const uncachedWorkspaceIds = workspaceIds.filter(
    workspaceId => queryClient.getQueryData(workspaceChildrenKeys.byWorkspaceId(workspaceId)) === undefined,
  );
  if (uncachedWorkspaceIds.length === 0) {
    return;
  }

  const fetched = await services.appData.getWorkspaceChildren(uncachedWorkspaceIds, scope);
  const queryCache = queryClient.getQueryCache();
  uncachedWorkspaceIds.forEach(workspaceId => {
    const data = fetched.get(workspaceId) as WorkspaceChildrenForScope<S> | undefined;
    if (data === undefined) {
      return;
    }
    queryCache
      .build(queryClient, {
        queryKey: workspaceChildrenKeys.byWorkspaceId(workspaceId),
        queryFn: async () => (await services.appData.getWorkspaceChildren([workspaceId], scope)).get(workspaceId),
      })
      .setData(data, { manual: true });
  });

  // One time re-fetch to ensure that the cache is up to date with any concurrent DB changes.
  // This is a cheap operation since it only runs once per workspace per session.
  uncachedWorkspaceIds.forEach(workspaceId =>
    queryClient.invalidateQueries({
      queryKey: workspaceChildrenKeys.byWorkspaceId(workspaceId),
      refetchType: 'active',
    }),
  );
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
    return requestsAndGroups
      ? { ...collectionChildren, children: { ...collectionChildren.children, requestsAndGroups } }
      : null;
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

// Invalidate or patch the cache for any organization-data or workspace-children queries that are affected by the given database changes.
export function updateAppDataOnDbChanges(queryClient: QueryClient, changes: ChangeBufferEvent[]) {
  const organizationIdsToRevalidate = new Set<string>();
  const workspaceIdsToRevalidate = new Set<string>();

  // We do not use the patches here because some db operations do not contain patches like git repo file watcher
  for (const [event, doc] of changes) {
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
