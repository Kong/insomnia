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
  Workspace,
} from 'insomnia-data';
import type { BaseModel } from 'insomnia-data';
import { models } from 'insomnia-data';

import { database } from '~/common/database';
import { fuzzyMatchAll } from '~/common/misc';
import { sortMethodMap } from '~/common/sorting';
import type { Child } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';

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

export async function getWorkspacesByProjectIds(projectIds: string[]) {
  const workspaces = await database.find<Workspace>(models.workspace.type, {
    parentId: { $in: projectIds },
  });
  const workspacesByProjectId = new Map<string, Workspace[]>();
  projectIds.forEach(projectId => {
    workspacesByProjectId.set(projectId, workspaces.filter(w => w.parentId === projectId) || []);
  });
  return workspacesByProjectId;
}

export async function getAllRequestsAndMetaByWorkspace(workspaceIds: string[]) {
  const allRequestsAndMetaByWorkspaceId = new Map<string, AllRequestsAndMetaInWorkspace>();
  let requestGroupIdQueue = [...workspaceIds];
  const allRequestGroups: RequestGroup[] = [];
  // Map to track which workspace each request group belongs to
  const requestGroupToWorkspaceId = new Map<string, string>();
  const requestToWorkspaceId = new Map<string, string>();
  const grpcRequestToWorkspaceId = new Map<string, string>();
  const wsRequestToWorkspaceId = new Map<string, string>();
  const socketIORequestToWorkspaceId = new Map<string, string>();
  // Initialize the map with workspace IDs
  workspaceIds.forEach(workspaceId => {
    requestGroupToWorkspaceId.set(workspaceId, workspaceId);
    requestToWorkspaceId.set(workspaceId, workspaceId);
    grpcRequestToWorkspaceId.set(workspaceId, workspaceId);
    wsRequestToWorkspaceId.set(workspaceId, workspaceId);
    socketIORequestToWorkspaceId.set(workspaceId, workspaceId);
    allRequestsAndMetaByWorkspaceId.set(workspaceId, { allRequests: [], allRequestMetas: [], requestGroupMetas: [] });
  });

  while (requestGroupIdQueue.length) {
    const requestGroups = await database.find<RequestGroup>(models.requestGroup.type, {
      parentId: { $in: requestGroupIdQueue },
    });

    if (requestGroups.length === 0) {
      break;
    }

    requestGroups.forEach(requestGroup => {
      const workspaceId = requestGroupToWorkspaceId.get(requestGroup.parentId);
      if (workspaceId) {
        requestGroupToWorkspaceId.set(requestGroup._id, workspaceId);
      }
    });

    allRequestGroups.push(...requestGroups);
    requestGroupIdQueue = requestGroups.map(rg => rg._id);
  }

  const listOfParentIds = [...workspaceIds, ...allRequestGroups.map(requestGroup => requestGroup._id)];

  const [reqs, grpcReqs, wsReqs, socketIOReqs] = await Promise.all([
    database.find(models.request.type, { parentId: { $in: listOfParentIds } }),
    database.find<GrpcRequest>(models.grpcRequest.type, { parentId: { $in: listOfParentIds } }),
    database.find(models.webSocketRequest.type, { parentId: { $in: listOfParentIds } }),
    database.find(models.socketIORequest.type, { parentId: { $in: listOfParentIds } }),
  ]);

  const allRequests = [...reqs, ...allRequestGroups, ...grpcReqs, ...wsReqs, ...socketIOReqs] as AllRequestDoc[];

  const [requestMetas, grpcRequestMetas, requestGroupMetas, wsRequestMetas, socketIORequestMetas] = await Promise.all([
    database.find<RequestMeta>(models.requestMeta.type, { parentId: { $in: reqs.map(r => r._id) } }),
    database.find<GrpcRequestMeta>(models.grpcRequestMeta.type, {
      parentId: { $in: grpcReqs.map(r => r._id) },
    }),
    database.find<RequestGroupMeta>(models.requestGroupMeta.type, {
      parentId: { $in: allRequestGroups.map(requestGroup => requestGroup._id) },
    }),
    database.find<WebSocketRequestMeta>(models.webSocketRequestMeta.type, {
      parentId: { $in: wsReqs.map(r => r._id) },
    }),
    database.find<SocketIORequestMeta>(models.socketIORequestMeta.type, {
      parentId: { $in: socketIOReqs.map(r => r._id) },
    }),
  ]);

  const allRequestMetas = [...requestMetas, ...grpcRequestMetas, ...wsRequestMetas, ...socketIORequestMetas];
  // Associate requests with their workspace IDs and group request metas by workspace ID
  allRequests.forEach(request => {
    const { parentId, _id: requestId } = request;
    const workspaceId = requestGroupToWorkspaceId.get(parentId);
    if (workspaceId) {
      // Track which workspace this request belongs to
      if (models.grpcRequest.isGrpcRequest(request)) {
        grpcRequestToWorkspaceId.set(requestId, workspaceId);
      } else if (models.request.isRequest(request)) {
        requestToWorkspaceId.set(requestId, workspaceId);
      } else if (models.webSocketRequest.isWebSocketRequest(request)) {
        wsRequestToWorkspaceId.set(requestId, workspaceId);
      } else if (models.socketIORequest.isSocketIORequest(request)) {
        socketIORequestToWorkspaceId.set(requestId, workspaceId);
      }
      const workspaceData = allRequestsAndMetaByWorkspaceId.get(workspaceId);
      if (workspaceData) {
        workspaceData.allRequests.push(request);
      }
    }
  });
  // Build map of requestGroupMetas by workspace ID
  requestGroupMetas.forEach(requestGroupMeta => {
    const workspaceId = requestGroupToWorkspaceId.get(requestGroupMeta.parentId);
    if (workspaceId) {
      const workspaceData = allRequestsAndMetaByWorkspaceId.get(workspaceId);
      if (workspaceData) {
        workspaceData.requestGroupMetas.push(requestGroupMeta);
      }
    }
  });
  allRequestMetas.forEach(requestMeta => {
    const requestOrGrpcRequestId = requestMeta.parentId;
    let workspaceId: string | undefined;
    if (models.request.isRequestId(requestOrGrpcRequestId)) {
      workspaceId = requestToWorkspaceId.get(requestOrGrpcRequestId);
    } else if (models.grpcRequest.isGrpcRequestId(requestOrGrpcRequestId)) {
      workspaceId = grpcRequestToWorkspaceId.get(requestOrGrpcRequestId);
    } else if (models.webSocketRequest.isWebSocketRequestId(requestOrGrpcRequestId)) {
      workspaceId = wsRequestToWorkspaceId.get(requestOrGrpcRequestId);
    } else if (models.socketIORequest.isSocketIORequestId(requestOrGrpcRequestId)) {
      workspaceId = socketIORequestToWorkspaceId.get(requestOrGrpcRequestId);
    }
    if (workspaceId) {
      const workspaceData = allRequestsAndMetaByWorkspaceId.get(workspaceId);
      if (workspaceData) {
        workspaceData.allRequestMetas.push(requestMeta);
      }
    }
  });

  return allRequestsAndMetaByWorkspaceId;
}

export function flattenCollectionChildren(
  workspaceId: string,
  parentIsCollapsed: boolean,
  { allRequests, allRequestMetas, requestGroupMetas }: AllRequestsAndMetaInWorkspace,
  sortOrder: keyof typeof sortMethodMap = 'type-manual',
): Child[] {
  const { isRequestGroup } = models.requestGroup;
  const collection: Child[] = [];

  // map of parentId to its direct children requests and request groups
  const requestsByParentId = new Map<string, AllRequestDoc[]>();
  for (const req of allRequests) {
    const allRequestsByParentId = requestsByParentId.get(req.parentId);
    if (allRequestsByParentId) {
      allRequestsByParentId.push(req);
    } else {
      requestsByParentId.set(req.parentId, [req]);
    }
  }
  const sortFunction = sortMethodMap[sortOrder];
  const rootRequests = (requestsByParentId.get(workspaceId) || []).sort(sortFunction);
  const stack: { doc: AllRequestDoc; level: number; parentIsCollapsed: boolean; ancestors: string[] }[] = [
    ...rootRequests,
  ]
    .reverse()
    .map(doc => ({
      level: 0,
      parentIsCollapsed: parentIsCollapsed,
      ancestors: [],
      doc: doc,
    }));

  while (stack.length) {
    const { doc, level, parentIsCollapsed, ancestors } = stack.pop()!;
    const hidden = parentIsCollapsed;
    const pinned = (!isRequestGroup(doc) && allRequestMetas.find(m => m.parentId === doc._id)?.pinned) || false;
    const collapsed =
      parentIsCollapsed ||
      (isRequestGroup(doc) && (requestGroupMetas.find(m => m.parentId === doc._id)?.collapsed ?? false)) ||
      false;

    collection.push({ doc, pinned, collapsed, hidden, level, ancestors, children: [] });

    // if it's a request group, add its children to the stack
    if (isRequestGroup(doc)) {
      const childDocs = (requestsByParentId.get(doc._id) || []).sort(sortFunction);
      const childAncestors = [...ancestors, doc._id];
      for (let i = childDocs.length - 1; i >= 0; i--) {
        stack.push({ doc: childDocs[i], level: level + 1, parentIsCollapsed: collapsed, ancestors: childAncestors });
      }
    }
  }

  // Assign children for request groups
  const nodeByDocId = new Map(collection.map(n => [n.doc._id, n]));
  for (const node of collection) {
    if (isRequestGroup(node.doc)) {
      node.children = (requestsByParentId.get(node.doc._id) || [])
        .map(doc => nodeByDocId.get(doc._id))
        .filter((n): n is Child => !!n);
    }
  }

  return collection;
}

export function filterCollection(collection: Child[], filter: string): Child[] {
  if (!filter) return collection;
  const filtered = collection.map(node => ({
    ...node,
    hidden: !fuzzyMatchAll(
      filter,
      [
        node.doc.name,
        (node.doc as { description?: string }).description ?? '',
        ...(!models.requestGroup.isRequestGroup(node.doc) ? [(node.doc as { url?: string }).url ?? ''] : []),
      ],
      { splitSpace: false, loose: true },
    )?.indexes,
    collapsed: false,
  }));
  const nodeById = new Map(filtered.map(item => [item.doc._id, item]));

  filtered.forEach(node => {
    if (!node.hidden) {
      (node.ancestors || []).forEach(ancestorId => {
        const ancestor = nodeById.get(ancestorId);
        if (ancestor) {
          ancestor.hidden = false;
        }
      });
    }
  });
  return filtered;
}

// Common tailwind classes
export const ROW_CLASS =
  'relative flex h-(--line-height-xs) w-full items-center gap-1 overflow-hidden text-[rgba(var(--color-font-rgb),0.8)] outline-hidden transition-colors select-none group-hover:bg-(--hl-xs) group-focus:bg-(--hl-sm) group-aria-selected:text-(--color-font) pr-4';

export const ACTIVE_BORDER_CLASS =
  'absolute top-0 left-0 h-full w-0.5 bg-transparent transition-colors group-aria-selected:bg-(--color-surprise)';
export const GUIDE_LINE_CSS = 'absolute inset-y-0 w-px bg-transparent transition-colors';

// for toggle button
export const TOGGLE_BTN_CLASS =
  'flex shrink-0 items-center justify-center text-base text-[rgba(var(--color-font-rgb),0.8)] hover:text-(--color-font) focus:outline-none w-4 h-4';
export const ICON_CLASS = 'h-3 w-3 shrink-0';

export const INDENT_PX = 16;
