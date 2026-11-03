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
