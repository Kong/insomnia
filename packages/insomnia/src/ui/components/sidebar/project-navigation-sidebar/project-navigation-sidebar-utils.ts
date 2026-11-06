import type {
  GrpcRequest,
  GrpcRequestMeta,
  Request,
  RequestGroup,
  RequestGroupMeta,
  RequestMeta,
  SocketIORequest,
  SocketIORequestMeta,
  WebSocketRequest,
  WebSocketRequestMeta,
} from 'insomnia-data';
import type { BaseModel } from 'insomnia-data';

import type { FlatItem } from '~/ui/components/sidebar/project-navigation-sidebar/types';

export interface SlimRequestDoc extends BaseModel {
  type: 'Request' | 'GrpcRequest' | 'WebSocketRequest' | 'SocketIORequest' | 'RequestGroup';
  metaSortKey: number;
  url: string;
  method?: string;
  description?: string;
}

type AllRequestDoc = Request | GrpcRequest | WebSocketRequest | SocketIORequest | RequestGroup;

export interface AllRequestsAndMetaInWorkspace {
  allRequests: AllRequestDoc[];
  allRequestMetas: (RequestMeta | GrpcRequestMeta | WebSocketRequestMeta | SocketIORequestMeta)[];
  requestGroupMetas: RequestGroupMeta[];
}

// TODO SLIM THE REQUEST DOCS TO ONLY WHAT WE NEED FOR THE SIDEBAR TO IMPROVE PERFORMANCE
// const toSlimDoc = (r: AllRequestDoc): SlimRequestDoc => ({
//   _id: r._id,
//   parentId: r.parentId,
//   type: r.type as SlimRequestDoc['type'],
//   isPrivate: r.isPrivate,
//   metaSortKey: r.metaSortKey,
//   name: r.name,
//   url: 'url' in r ? r.url : '',
//   method: 'method' in r ? r.method : undefined,
//   description: r.description,
//   modified: r.modified,
//   created: r.created,
// });
export const getSidebarGridListItemId = (item: FlatItem): string => {
  const { kind, doc } = item;
  const itemId = doc._id;
  switch (kind) {
    case 'pinnedRequest': {
      return `pinned-request-${itemId}`;
    }
    case 'unsyncedWorkspace': {
      return `project-${item.project._id}-unsynced-workspace-${itemId}`;
    }
    default: {
      return itemId;
    }
  }
};

export const getSidebarPinnedHeaderId = (workspaceId: string): string => `${workspaceId}-pinned-header`;

// The row id (see `getSidebarGridListItemId`) of the row this row is nested under, exposed as `data-parent-id` so tests can rebuild the tree.
// Returns `undefined` for top-level rows and for rows whose parent is not a sidebar row (e.g. a project's organization).
export const getSidebarItemParentId = (item: FlatItem): string | undefined => {
  switch (item.kind) {
    case 'workspace':
    case 'collectionChild': {
      return item.doc.parentId;
    }
    case 'pinnedHeader': {
      return item.workspaceId;
    }
    case 'pinnedRequest': {
      return getSidebarPinnedHeaderId(item.workspace._id);
    }
    case 'unsyncedWorkspace':
    case 'emptyProject': {
      return item.project._id;
    }
    case 'emptyCollection': {
      return item.workspace?._id;
    }
    case 'emptyFolder': {
      return item.requestGroup?._id;
    }
    default: {
      return undefined;
    }
  }
};
