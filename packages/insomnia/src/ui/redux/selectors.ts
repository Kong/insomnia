import { createSelector } from 'reselect';
import type { ValueOf } from 'type-fest';

import { fuzzyMatchAll } from '../../common/misc';
import { BaseModel } from '../../models';
import { GrpcRequest, isGrpcRequest } from '../../models/grpc-request';
import { getStatusCandidates } from '../../models/helpers/get-status-candidates';
import { sortProjects } from '../../models/helpers/project';
import { DEFAULT_PROJECT_ID, isRemoteProject } from '../../models/project';
import { isRequest, Request } from '../../models/request';
import { isRequestGroup, RequestGroup } from '../../models/request-group';
import { isWebSocketRequest } from '../../models/websocket-request';
import { RootState } from './modules';

type EntitiesLists = {
  [K in keyof RootState['entities']]: ValueOf<RootState['entities'][K]>[];
};

const selectEntitiesLists = createSelector(
  (state: RootState) => state.entities,
  entities => {
    // transforms entities object from object keyed on id to array of entities containing id
    const entitiesLists: any = {};
    for (const [k, v] of Object.entries(entities)) {
      entitiesLists[k] = Object.keys(v).map(id => v[id]);
    }
    return entitiesLists as EntitiesLists;
  },
);

// request switcher
export const selectRequestMetas = createSelector(
  selectEntitiesLists,
  entities => entities.requestMetas,
);
// request switcher
export const selectGrpcRequestMetas = createSelector(
  selectEntitiesLists,
  entities => entities.grpcRequestMetas,
);
// sync dropdown
export const selectRemoteProjects = createSelector(
  selectEntitiesLists,
  entities => sortProjects(entities.projects).filter(isRemoteProject),
);

// list workspaces for move/copy switcher, and export
export const selectWorkspacesForActiveProject = createSelector(
  selectEntitiesLists,
  (state: RootState) => state.global.activeProjectId,
  (entities, activeProjectId) => entities.workspaces.filter(workspace => workspace.parentId === (activeProjectId || DEFAULT_PROJECT_ID)),
);

const selectActiveWorkspace = createSelector(
  selectEntitiesLists,
  (state: RootState) => state.global.activeWorkspaceId,
  (state: RootState) => state.global.activeProjectId,
  (entities, activeWorkspaceId, activeProjectId) => {
    return entities.workspaces.filter(workspace => workspace.parentId === (activeProjectId || DEFAULT_PROJECT_ID))
      .find(workspace => workspace._id === activeWorkspaceId);
  },
);

const selectEntitiesChildrenMap = createSelector(selectEntitiesLists, entities => {
  const parentLookupMap: any = {};
  // group entities by parent
  for (const value of Object.values(entities)) {
    for (const entity of value) {
      if (entity.parentId) {
        if (parentLookupMap[entity.parentId]) {
          parentLookupMap[entity.parentId].push(entity);
        } else {
          parentLookupMap[entity.parentId] = [entity];
        }
      }
    }
  }

  return parentLookupMap;
});
const selectActiveWorkspaceEntities = createSelector(
  selectActiveWorkspace,
  selectEntitiesChildrenMap,
  (activeWorkspace, childrenMap) => {
    if (!activeWorkspace) {
      return [];
    }

    const descendants: BaseModel[] = [activeWorkspace];

    const addChildrenOf = (parent: any) => {
      // Don't add children of requests (eg. auth requests)
      if (isRequest(parent)) {
        return;
      }

      const children = childrenMap[parent._id] || [];

      for (const child of children) {
        descendants.push(child);
        addChildrenOf(child);
      }
    };

    // Kick off the recursion
    addChildrenOf(activeWorkspace);
    return descendants;
  },
);

const selectActiveWorkspaceMeta = createSelector(
  selectActiveWorkspace,
  selectEntitiesLists,
  (activeWorkspace, entities) => {
    return entities.workspaceMetas.find(workspaceMeta => workspaceMeta.parentId === activeWorkspace?._id);
  },
);
// response history list
export const selectActiveRequest = createSelector(
  (state: RootState) => state.entities,
  selectActiveWorkspaceMeta,
  (entities, workspaceMeta) => {
    const id = workspaceMeta?.activeRequestId || 'n/a';

    if (id in entities.requests) {
      return entities.requests[id];
    }

    if (id in entities.grpcRequests) {
      return entities.grpcRequests[id];
    }

    if (id in entities.webSocketRequests) {
      return entities.webSocketRequests[id];
    }

    return null;
  },
);

// sync dropdown, branches, history and staging
export const selectSyncItems = createSelector(
  selectActiveWorkspaceEntities,
  getStatusCandidates,
);

type SidebarModel = Request | GrpcRequest | RequestGroup;

interface Child {
  doc: SidebarModel;
  hidden: boolean;
  collapsed: boolean;
  pinned: boolean;
  children: Child[];
}

export interface SidebarChildren {
  all: Child[];
  pinned: Child[];
}
const selectSidebarFilter = createSelector(
  selectActiveWorkspaceMeta,
  activeWorkspaceMeta => activeWorkspaceMeta ? activeWorkspaceMeta.sidebarFilter : '',
);
const selectPinnedRequests = createSelector(selectEntitiesLists, entities => {
  const pinned: Record<string, boolean> = {};
  const requests = [...entities.requests, ...entities.grpcRequests, ...entities.webSocketRequests];
  const requestMetas = [...entities.requestMetas, ...entities.grpcRequestMetas];

  // Default all to unpinned
  for (const request of requests) {
    pinned[request._id] = false;
  }

  // Update those that have metadata (not all do)
  for (const meta of requestMetas) {
    pinned[meta.parentId] = meta.pinned;
  }

  return pinned;
});
const selectCollapsedRequestGroups = createSelector(
  selectEntitiesLists,
  entities => {
    const collapsed: Record<string, boolean> = {};

    // Default all to collapsed
    for (const requestGroup of entities.requestGroups) {
      collapsed[requestGroup._id] = true;
    }

    // Update those that have metadata (not all do)
    for (const meta of entities.requestGroupMetas) {
      collapsed[meta.parentId] = meta.collapsed;
    }

    return collapsed;
  });
// sidebar and export requests
export const selectSidebarChildren = createSelector(
  selectCollapsedRequestGroups,
  selectPinnedRequests,
  selectActiveWorkspace,
  selectEntitiesChildrenMap,
  selectSidebarFilter,
  (collapsed, pinned, activeWorkspace, childrenMap, sidebarFilter): SidebarChildren => {
    if (!activeWorkspace) {
      return { all: [], pinned: [] };
    }

    function next(parentId: string): Child[] {
      return (childrenMap[parentId] || []).filter((model: BaseModel) => isRequest(model) || isWebSocketRequest(model) || isGrpcRequest(model) || isRequestGroup(model))
        .sort((a: SidebarModel, b: SidebarModel): number => {
          if (a.metaSortKey === b.metaSortKey) {
            return a._id > b._id ? -1 : 1; // ascending
          } else {
            return a.metaSortKey < b.metaSortKey ? -1 : 1; // descending
          }
        }).map((c: SidebarModel) => ({
            doc: c,
            hidden: false,
            collapsed: !!collapsed[c._id],
            pinned: !!pinned[c._id],
          children: isRequestGroup(c) ? next(c._id) : [],
        }));
    }

    function matchChildren(children: Child[], parentNames: string[] = []) {
      if (sidebarFilter) {
        for (const child of children) {
          // Gather all parents so we can match them too
          matchChildren(child.children, [...parentNames, child.doc.name]);
          // Update hidden state depending on whether it matched
          child.hidden = !(child.children.find(c => c.hidden === false) || fuzzyMatchAll(sidebarFilter, [child.doc.name, isGrpcRequest(child.doc) ? 'gRPC' : isRequest(child.doc) ? child.doc.method : '', ...parentNames], { splitSpace: true }));
        }
      }
      return children;
    }
    const kids = next(activeWorkspace._id);
    return {
      pinned: kids.filter(k => k.pinned),
      all: matchChildren(kids),
    };
  },
);
