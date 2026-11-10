import { models } from 'insomnia-data';

import type { BaseTab } from './tab';

// A doc type is considered "request-like" for tab-close fallback purposes if
// it's one of the request flavors that can live directly under a workspace
// or inside a folder.
export const isRequestLikeDocType = (docType: string) =>
  docType === models.request.type ||
  docType === models.grpcRequest.type ||
  docType === models.webSocketRequest.type ||
  docType === models.socketIORequest.type;

// When deleting a request that's the only open tab, land on its parent (the
// folder it was in, or the collection root) instead of bouncing all the way
// back to the project dashboard. Returns undefined when there isn't enough
// information to build a fallback (tab not found, or no parent).
export const getRequestDeleteFallbackUrl = ({
  parentId,
  closingTab,
  organizationId,
  projectId,
}: {
  parentId?: string | null;
  closingTab?: BaseTab;
  organizationId?: string;
  projectId?: string;
}): string | undefined => {
  if (!closingTab || !parentId) {
    return undefined;
  }
  return models.requestGroup.isRequestGroupId(parentId)
    ? `/organization/${organizationId}/project/${projectId}/workspace/${closingTab.workspaceId}/debug/request-group/${parentId}`
    : `/organization/${organizationId}/project/${projectId}/workspace/${closingTab.workspaceId}/debug`;
};
