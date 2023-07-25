import { createSelector } from 'reselect';
import type { ValueOf } from 'type-fest';

import { isWorkspaceActivity, PREVIEW_MODE_SOURCE } from '../../common/constants';
import * as models from '../../models';
import { BaseModel } from '../../models';
import { GrpcRequest, isGrpcRequest } from '../../models/grpc-request';
import { getStatusCandidates } from '../../models/helpers/get-status-candidates';
import { sortProjects } from '../../models/helpers/project';
import { DEFAULT_PROJECT_ID, isRemoteProject } from '../../models/project';
import { isRequest, Request } from '../../models/request';
import { isRequestGroup, RequestGroup } from '../../models/request-group';
import { type Response } from '../../models/response';
import { isWebSocketRequest, WebSocketRequest } from '../../models/websocket-request';
import { type WebSocketResponse } from '../../models/websocket-response';
import { RootState } from './modules';

type EntitiesLists = {
  [K in keyof RootState['entities']]: ValueOf<RootState['entities'][K]>[];
};

// ~~~~~~~~~ //
// Selectors //
// ~~~~~~~~~ //
export const selectEntitiesLists = createSelector(
  (state: RootState) => state.entities,
  entities => {
    // transforms entities object from object keyed on id to array of entities containing id
    const entitiesLists = {};
    for (const [k, v] of Object.entries(entities)) {
      entitiesLists[k] = Object.keys(v).map(id => v[id]);
    }
    return entitiesLists as EntitiesLists;
  },
);

export const selectEntitiesChildrenMap = createSelector(selectEntitiesLists, entities => {
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

export const selectStats = createSelector(
  selectEntitiesLists,
  entities => entities.stats[0] || models.stats.init());

export const selectSettings = createSelector(
  selectEntitiesLists,
  entities => entities.settings[0] || models.settings.init());

export const selectRequestMetas = createSelector(
  selectEntitiesLists,
  entities => entities.requestMetas,
);

export const selectGrpcRequestMetas = createSelector(
  selectEntitiesLists,
  entities => entities.grpcRequestMetas,
);

export const selectProjects = createSelector(
  selectEntitiesLists,
  entities => sortProjects(entities.projects),
);

export const selectRemoteProjects = createSelector(
  selectProjects,
  projects => projects.filter(isRemoteProject),
);

export const selectWorkspaces = createSelector(
  selectEntitiesLists,
  entities => entities.workspaces,
);

export const selectWorkspacesForActiveProject = createSelector(
  selectEntitiesLists,
  (state: RootState) => state.global.activeProjectId,
  (entities, activeProjectId) => entities.workspaces.filter(workspace => workspace.parentId === (activeProjectId || DEFAULT_PROJECT_ID)),
);

export const selectActiveWorkspace = createSelector(
  selectWorkspacesForActiveProject,
  (state: RootState) => state.global.activeWorkspaceId,
  (state: RootState) => state.global.activeActivity,
  (workspaces, activeWorkspaceId, activeActivity) => {
    // Only return an active workspace if we're in an activity
    if (activeActivity && isWorkspaceActivity(activeActivity)) {
      const workspace = workspaces.find(workspace => workspace._id === activeWorkspaceId);
      return workspace;
    }

    return undefined;
  },
);

export const selectActiveWorkspaceMeta = createSelector(
  selectActiveWorkspace,
  selectEntitiesLists,
  (activeWorkspace, entities) => {
    const id = activeWorkspace ? activeWorkspace._id : 'n/a';
    return entities.workspaceMetas.find(workspaceMeta => workspaceMeta.parentId === id);
  },
);

export const selectApiSpecs = createSelector(
  selectEntitiesLists,
  entities => entities.apiSpecs,
);

export const selectGitRepositories = createSelector(
  selectEntitiesLists,
  entities => entities.gitRepositories,
);

export const selectRequestGroups = createSelector(
  selectEntitiesLists,
  entities => entities.requestGroups,
);

export const selectRequestVersions = createSelector(
  selectEntitiesLists,
  entities => entities.requestVersions,
);

export const selectRequests = createSelector(
  selectEntitiesLists,
  entities => entities.requests,
);

export const selectActiveEnvironment = createSelector(
  selectActiveWorkspaceMeta,
  selectEntitiesLists,
  (meta, entities) => {
    if (!meta) {
      return null;
    }

    return entities.environments.find(environment => environment._id === meta.activeEnvironmentId) || null;
  },
);

export const selectActiveGitRepository = createSelector(
  selectEntitiesLists,
  selectActiveWorkspaceMeta,
  (entities, activeWorkspaceMeta) => {
    if (!activeWorkspaceMeta) {
      return null;
    }

    const id = activeWorkspaceMeta ? activeWorkspaceMeta.gitRepositoryId : 'n/a';
    const repo = entities.gitRepositories.find(r => r._id === id);
    return repo || null;
  },
);

export const selectCollapsedRequestGroups = createSelector(
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

export const selectActiveWorkspaceEntities = createSelector(
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

export const selectPinnedRequests = createSelector(selectEntitiesLists, entities => {
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

export const selectWorkspaceRequestsAndRequestGroups = createSelector(
  selectActiveWorkspaceEntities,
  entities => {
    return entities.filter(
      entity => isRequest(entity) || isWebSocketRequest(entity) || isGrpcRequest(entity) || isRequestGroup(entity),
    ) as (Request | WebSocketRequest | GrpcRequest | RequestGroup)[];
  },
);

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

export const selectActiveRequestMeta = createSelector(
  selectActiveRequest,
  selectEntitiesLists,
  (activeRequest, entities) => {
    const id = activeRequest?._id || 'n/a';
    return entities.requestMetas.find(m => m.parentId === id);
  },
);

export const selectResponsePreviewMode = createSelector(
  selectActiveRequestMeta,
  requestMeta => requestMeta?.previewMode || PREVIEW_MODE_SOURCE,
);

export const selectResponseFilter = createSelector(
  selectActiveRequestMeta,
  requestMeta => requestMeta?.responseFilter || '',
);

export const selectResponseFilterHistory = createSelector(
  selectActiveRequestMeta,
  requestMeta => requestMeta?.responseFilterHistory || [],
);

export const selectResponseDownloadPath = createSelector(
  selectActiveRequestMeta,
  requestMeta => requestMeta?.downloadPath || null,
);

export const selectHotKeyRegistry = createSelector(
  selectSettings,
  settings => settings.hotKeyRegistry,
);

export const selectActiveRequestResponses = createSelector(
  selectActiveRequest,
  selectEntitiesLists,
  selectActiveEnvironment,
  selectSettings,
  (activeRequest, entities, activeEnvironment, settings) => {
    const requestId = activeRequest ? activeRequest._id : 'n/a';

    const responses: (Response | WebSocketResponse)[] = (activeRequest && isWebSocketRequest(activeRequest)) ? entities.webSocketResponses : entities.responses;

    // Filter responses down if the setting is enabled
    return responses.filter(response => {
      const requestMatches = requestId === response.parentId;

      if (settings.filterResponsesByEnv) {
        const activeEnvironmentId = activeEnvironment ? activeEnvironment._id : null;
        const environmentMatches = response.environmentId === activeEnvironmentId;
        return requestMatches && environmentMatches;
      } else {
        return requestMatches;
      }
    })
      .sort((a, b) => (a.created > b.created ? -1 : 1));
  },
);

export const selectActiveResponse = createSelector(
  selectActiveRequestMeta,
  selectActiveRequestResponses,
  (activeRequestMeta, responses) => {
    const activeResponseId = activeRequestMeta ? activeRequestMeta.activeResponseId : 'n/a';

    const activeResponse = responses.find(response => response._id === activeResponseId);

    if (activeResponse) {
      return activeResponse;
    }

    return responses[0] || null;
  },
);

export const selectSyncItems = createSelector(
  selectActiveWorkspaceEntities,
  getStatusCandidates,
);

export const selectActiveActivity = createSelector(
  (state: RootState) => state.global,
  global => global.activeActivity,
);
