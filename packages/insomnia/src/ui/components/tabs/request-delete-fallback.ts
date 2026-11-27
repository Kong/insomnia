import { models } from 'insomnia-data';

import type { BaseTab } from '../../context/app/insomnia-tab-context';

// A doc type is considered "request-like" for tab-close fallback purposes if
// it's one of the request flavors that can live directly under a workspace
// or inside a folder.
export const isRequestLikeDocType = (docType: string) =>
  docType === models.request.type ||
  docType === models.grpcRequest.type ||
  docType === models.webSocketRequest.type ||
  docType === models.socketIORequest.type;

// An example's parent is a request, so a deleted example falls back to that
// request's editor. Passing this URL keeps `closeTabById` from sending the user
// to the project dashboard when the example was the only open tab.
//
// Deleting the parent request deletes its examples in the same batch, and then
// the parent request's editor is gone too: fall back where the request's own tab
// falls back (its folder or the collection root), not to a dead request URL.
export const getExampleDeleteFallbackUrl = ({
  parentId,
  removedParentRequestParentId,
  closingTab,
  organizationId,
  projectId,
}: {
  parentId?: string | null;
  // `parentId` of the parent request, when that request is deleted in the same
  // batch. Undefined keeps the normal parent-request fallback.
  removedParentRequestParentId?: string | null;
  closingTab?: BaseTab;
  organizationId?: string;
  projectId?: string;
}): string | undefined => {
  if (!closingTab || !parentId) {
    return undefined;
  }
  if (removedParentRequestParentId !== undefined) {
    return getRequestDeleteFallbackUrl({
      parentId: removedParentRequestParentId,
      closingTab,
      organizationId,
      projectId,
    });
  }
  return `/organization/${organizationId}/project/${projectId}/workspace/${closingTab.workspaceId}/debug/request/${parentId}`;
};

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
