import type { QueryClient } from '@tanstack/react-query';
import type { CollectionWorkspaceChildren, OrganizationData, WorkspaceChildren } from 'insomnia-data';
import { models } from 'insomnia-data';

import type { ChangeBufferEvent } from '~/common/database';

import {
  addOrganizationDataWorkspaceMeta,
  deleteOrganizationDataWorkspaceMeta,
  findOrgAndProjectForWorkspace,
  findOrgForWorkspaceId,
  organizationDataKeys,
  updateOrganizationDataWorkspaceMeta,
} from './use-organization-data';
import {
  findWorkspaceIdForDoc,
  updateCollectionChildrenWithUpdatedDoc,
  workspaceChildrenKeys,
} from './use-workspace-children';

const COLLECTION_CHILDREN_DOC_TYPES = [
  // collection scope
  models.request.type,
  models.grpcRequest.type,
  models.webSocketRequest.type,
  models.socketIORequest.type,
  models.requestGroup.type,
  models.requestMeta.type,
  models.grpcRequestMeta.type,
  models.webSocketRequestMeta.type,
  models.socketIORequestMeta.type,
  models.requestGroupMeta.type,
];

// Types whose changes require only a workspace-children cache refresh.
const WORKSPACE_CHILD_DOC_TYPES = [
  ...COLLECTION_CHILDREN_DOC_TYPES,
  models.mockServer.type,
  models.apiSpec.type,
  models.mcpRequest.type,
  models.environment.type,
];

const WORKSPACE_META_DOC_TYPES = [models.workspaceMeta.type];

export const MONITOR_DOC_TYPES = [
  models.project.type,
  models.workspace.type,
  ...WORKSPACE_CHILD_DOC_TYPES,
  ...WORKSPACE_META_DOC_TYPES,
];

// Bridge local NeDB change events to the TanStack cache: patch in place for plain field updates,
export const subscribeQueryClientToDbChanges = (queryClient: QueryClient): (() => void) => {
  const unsubscribe = window.main.on('db.changes', (_, changes: ChangeBufferEvent[]) => {
    const organizationIdsToRevalidate = new Set<string>();
    const workspaceIdsToRevalidate: string[] = [];
    for (const [event, doc, patches] of changes) {
      if (!MONITOR_DOC_TYPES.includes(doc.type)) {
        continue;
      }

      if (doc.type === models.project.type) {
        const organizationId = doc.parentId;
        organizationIdsToRevalidate.add(organizationId);
        continue;
      }

      if (doc.type === models.workspace.type) {
        const { organizationId } = findOrgAndProjectForWorkspace(queryClient, doc) || {};
        if (organizationId) {
          organizationIdsToRevalidate.add(organizationId);
        }
        continue;
      }

      if (doc.type === models.workspaceMeta.type) {
        // Meta is changed very frequently, so we just update the cache instead of invalidating it to avoid unnecessary re-renders.
        const organizationId = findOrgForWorkspaceId(queryClient, doc.parentId);
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

      // request/requestGroup/meta changed: update the owning workspace children cache.
      if (COLLECTION_CHILDREN_DOC_TYPES.includes(doc.type)) {
        if (event === 'update') {
          const isUpdateParent = 'parentId' in patches;
          if (!isUpdateParent) {
            const docWorkspaceId = findWorkspaceIdForDoc(queryClient, doc);
            if (docWorkspaceId) {
              // update that doesn't change the parentId, we can patch the existing workspace children cache instead of invalidating it.
              queryClient.setQueryData<CollectionWorkspaceChildren>(
                workspaceChildrenKeys.byWorkspaceId(docWorkspaceId),
                previous => {
                  if (previous) {
                    const updatedData = updateCollectionChildrenWithUpdatedDoc(previous, doc);
                    if (updatedData) {
                      return updatedData;
                    }
                  }
                  return previous;
                },
              );
            }
            continue;
          } else {
            // update that changes the parentId, we need to invalidate both the old and new workspace children cache.
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
                // Workspace contains the doc before
                originDocWorkspaceId = workspaceId;
              }
              if (data.children.requestsAndGroups.some(r => r._id === docNewParentId)) {
                // Workspace contains the doc after
                newDocWorkspaceId = workspaceId;
              }
            }
            if (originDocWorkspaceId) {
              workspaceIdsToRevalidate.push(originDocWorkspaceId);
            }
            if (newDocWorkspaceId && newDocWorkspaceId !== originDocWorkspaceId) {
              workspaceIdsToRevalidate.push(newDocWorkspaceId);
            }
          }
        } else {
          // For add or remove event, just invalidate the workspace children cache.
          const docWorkspaceId = findWorkspaceIdForDoc(queryClient, doc);
          docWorkspaceId && workspaceIdsToRevalidate.push(docWorkspaceId);
        }
      } else {
        // All other workspace-child types: refresh that workspace's children cache.
        const parentId = doc.parentId;
        if (models.workspace.isWorkspaceId(parentId)) {
          workspaceIdsToRevalidate.push(parentId);
        }
      }
    }

    if (workspaceIdsToRevalidate.length > 0) {
      workspaceIdsToRevalidate.forEach(workspaceId =>
        queryClient.invalidateQueries({ queryKey: workspaceChildrenKeys.byWorkspaceId(workspaceId) }),
      );
    }

    if (organizationIdsToRevalidate.size > 0) {
      organizationIdsToRevalidate.forEach(organizationId =>
        queryClient.invalidateQueries({ queryKey: organizationDataKeys.byOrganizationId(organizationId) }),
      );
    }
  });
  return unsubscribe;
};
