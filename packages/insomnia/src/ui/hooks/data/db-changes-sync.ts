import type { QueryClient } from '@tanstack/react-query';
import { models } from 'insomnia-data';

import type { ChangeBufferEvent } from '~/common/database';

import { projectKeys } from './projects';
import {
  type CollectionWorkspaceChildren,
  findWorkspaceIdsForChangedCollectionChildDoc,
  updateCollectionChildrenWithUpdatedDoc,
  workspaceChildrenKeys,
} from './workspace-children';
import { workspaceKeys } from './workspaces';

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

export const MONITOR_DOC_TYPES = [
  models.project.type,
  models.workspace.type,
  ...COLLECTION_CHILDREN_DOC_TYPES,
  // mock-server scope
  models.mockServer.type,
  // design scope
  models.apiSpec.type,
  // mcp scope
  models.mcpRequest.type,
  // environment scope
  models.environment.type,
];

// Bridge local NeDB change events to the TanStack cache: patch in place for plain field updates,
export const subscribeQueryClientToDbChanges = (queryClient: QueryClient): (() => void) => {
  const unsubscribe = window.main.on('db.changes', (_, changes: ChangeBufferEvent[]) => {
    const organizationIdsToRevalidate: string[] = [];
    const projectIdsToRevalidate: string[] = [];
    const workspaceIdsToRevalidate: string[] = [];

    for (const [event, doc] of changes) {
      if (!MONITOR_DOC_TYPES.includes(doc.type)) {
        continue;
      }
      if (doc.type === models.project.type) {
        // project changed: patch the owning organization’s cached project list in place when possible.
        organizationIdsToRevalidate.push(doc.parentId);
        continue;
      }

      if (doc.type === models.workspace.type) {
        const projectId = doc.parentId;
        // workspace changed: refresh the owning project’s cached workspace list + meta list
        projectIdsToRevalidate.push(projectId);
        continue;
      }

      if (COLLECTION_CHILDREN_DOC_TYPES.includes(doc.type)) {
        // request/requestGroup/meta changed: patch the owning workspace's cached collection in place when possible.
        for (const workspaceId of findWorkspaceIdsForChangedCollectionChildDoc(queryClient, doc)) {
          // Avoid full db refresh when it is an update event and we just need to update a single doc in the cache.
          if (event === 'update') {
            let updated = false;
            queryClient.setQueryData<CollectionWorkspaceChildren>(
              workspaceChildrenKeys.details(workspaceId),
              previous => {
                if (!previous) {
                  return previous;
                }
                const updatedData = updateCollectionChildrenWithUpdatedDoc(previous, doc);
                if (updatedData) {
                  updated = true;
                  return updatedData;
                }
                return previous;
              },
            );
            if (updated) {
              continue;
            }
          }
          // Add, remove or changed doc can be updated (like due to move), refresh the entire workspaceChildrenKeys in the workspace
          workspaceIdsToRevalidate.push(workspaceId);
        }
      } else {
        // non-collection child doc changed (apiSpec/mockServer/environment/mcpRequest): refresh the workspace's
        // children cache. The project dashboard reads apiSpec/mockServer from this same cache, so it updates too.
        if (models.workspace.isWorkspaceId(doc.parentId)) {
          workspaceIdsToRevalidate.push(doc.parentId);
        }
      }
    }

    organizationIdsToRevalidate.forEach(organizationId =>
      queryClient.invalidateQueries({ queryKey: projectKeys.details(organizationId) }),
    );
    projectIdsToRevalidate.forEach(projectId =>
      queryClient.invalidateQueries({ queryKey: workspaceKeys.details(projectId) }),
    );
    workspaceIdsToRevalidate.forEach(workspaceId =>
      queryClient.invalidateQueries({ queryKey: workspaceChildrenKeys.details(workspaceId) }),
    );
  });
  return unsubscribe;
};
