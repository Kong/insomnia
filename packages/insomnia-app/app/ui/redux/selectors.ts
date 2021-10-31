import { createSelector } from 'reselect';
import { ValueOf } from 'type-fest';

import { isWorkspaceActivity } from '../../common/constants';
import * as models from '../../models';
import { BaseModel } from '../../models';
import { getStatusCandidates } from '../../models/helpers/get-status-candidates';
import { sortProjects } from '../../models/helpers/project';
import { DEFAULT_PROJECT_ID, isRemoteProject } from '../../models/project';
import { isRequest, Request } from '../../models/request';
import { isRequestGroup, RequestGroup } from '../../models/request-group';
import { UnitTestResult } from '../../models/unit-test-result';
import { isCollection } from '../../models/workspace';
import { RootState } from './modules';

type EntitiesLists = {
  [K in keyof RootState['entities']]: ValueOf<RootState['entities'][K]>[];
};

// ~~~~~~~~~ //
// Selectors //
// ~~~~~~~~~ //
export const selectEntities = createSelector(
  (state: RootState) => state.entities,
  entities => entities,
);

export const selectGlobal = createSelector(
  (state: RootState) => state.global,
  global => global,
);

export const selectEntitiesLists = createSelector(
  selectEntities,
  entities => {
    const entitiesLists = {};

    for (const k of Object.keys(entities)) {
      const entityMap = entities[k];
      entitiesLists[k] = Object.keys(entityMap).map(id => entityMap[id]);
    }

    return entitiesLists as EntitiesLists;
  },
);

export const selectEntitiesChildrenMap = createSelector(selectEntitiesLists, entities => {
  const parentLookupMap = {};

  for (const k of Object.keys(entities)) {
    for (const e of entities[k]) {
      if (!e.parentId) {
        continue;
      }

      if (parentLookupMap[e.parentId]) {
        parentLookupMap[e.parentId].push(e);
      } else {
        parentLookupMap[e.parentId] = [e];
      }
    }
  }

  return parentLookupMap;
});

export const selectSettings = createSelector(
  selectEntitiesLists,
  entities => entities.settings[0] || models.settings.init());

export const selectRequestMetas = createSelector(
  selectEntitiesLists,
  entities => entities.requestMetas,
);

export const selectProjects = createSelector(
  selectEntitiesLists,
  entities => sortProjects(entities.projects),
);

export const selectRemoteProjects = createSelector(
  selectProjects,
  projects => projects.filter(isRemoteProject),
);

export const selectActiveProject = createSelector(
  selectEntities,
  (state: RootState) => state.global.activeProjectId,
  (entities, activeProjectId) => {
    return entities.projects[activeProjectId] || entities.projects[DEFAULT_PROJECT_ID];
  },
);

export const selectDashboardSortOrder = createSelector(
  selectGlobal,
  global => global.dashboardSortOrder
);

export const selectAllWorkspaces = createSelector(
  selectEntitiesLists,
  entities => entities.workspaces,
);

export const selectWorkspacesForActiveProject = createSelector(
  selectAllWorkspaces,
  selectActiveProject,
  (workspaces, activeProject) => workspaces.filter(workspace => workspace.parentId === activeProject._id),
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
    return entities.workspaceMetas.find(m => m.parentId === id);
  },
);

export const selectAllApiSpecs = createSelector(
  selectEntitiesLists,
  entities => entities.apiSpecs,
);

export const selectActiveApiSpec = createSelector(
  selectAllApiSpecs,
  selectActiveWorkspace,
  (apiSpecs, activeWorkspace) => {
    if (!activeWorkspace) {
      // There should never be an active api spec without an active workspace
      return undefined;
    }
    const activeSpec = apiSpecs.find(apiSpec => apiSpec.parentId === activeWorkspace._id);

    if (!activeSpec) {
      // This case should never be reached; an api spec should always exist for a given workspace.
      throw new Error(`an api spec not found for the workspace ${activeWorkspace._id} (${activeWorkspace.name})`);
    }

    return activeSpec;
  }
);

export const selectActiveWorkspaceName = createSelector(
  selectActiveWorkspace,
  selectActiveApiSpec,
  (activeWorkspace, activeApiSpec) => {
    if (!activeWorkspace) {
      // see above, but since the selectActiveWorkspace selector really can return undefined, we need to handle it here.
      return undefined;
    }

    return isCollection(activeWorkspace) ? activeWorkspace.name : activeApiSpec?.fileName;
  }
);

export const selectActiveEnvironment = createSelector(
  selectActiveWorkspaceMeta,
  selectEntitiesLists,
  (meta, entities) => {
    if (!meta) {
      return null;
    }

    return entities.environments.find(e => e._id === meta.activeEnvironmentId) || null;
  },
);

export const selectActiveWorkspaceClientCertificates = createSelector(
  selectEntitiesLists,
  selectActiveWorkspace,
  (entities, activeWorkspace) => entities.clientCertificates.filter(c => c.parentId === activeWorkspace?._id),
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

    const addChildrenOf = parent => {
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
  const requests = [...entities.requests, ...entities.grpcRequests];
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
      e => isRequest(e) || isRequestGroup(e),
    ) as (Request | RequestGroup)[];
  },
);

export const selectActiveRequest = createSelector(
  selectEntities,
  selectActiveWorkspaceMeta,
  (entities, workspaceMeta) => {
    const id = workspaceMeta?.activeRequestId || 'n/a';
    if (id in entities.requests) {
      return entities.requests[id];
    } else if (id in entities.grpcRequests) {
      return entities.grpcRequests[id];
    } else {
      return null;
    }
  },
);

export const selectActiveCookieJar = createSelector(
  selectEntitiesLists,
  selectActiveWorkspace,
  (entities, workspace) => {
    const cookieJar = entities.cookieJars.find(cj => cj.parentId === workspace?._id);
    return cookieJar || null;
  },
);

export const selectActiveOAuth2Token = createSelector(
  selectEntitiesLists,
  selectActiveWorkspaceMeta,
  (entities, workspaceMeta) => {
    const id = workspaceMeta?.activeRequestId || 'n/a';
    return entities.oAuth2Tokens.find(t => t.parentId === id);
  },
);

export const selectUnseenWorkspaces = createSelector(
  selectEntitiesLists,
  entities => {
    const { workspaces, workspaceMetas } = entities;
    return workspaces.filter(workspace => {
      const meta = workspaceMetas.find(m => m.parentId === workspace._id);
      return !!(meta && !meta.hasSeen);
    });
  });

export const selectActiveRequestMeta = createSelector(
  selectActiveRequest,
  selectEntitiesLists,
  (activeRequest, entities) => {
    const id = activeRequest?._id || 'n/a';
    return entities.requestMetas.find(m => m.parentId === id);
  },
);

export const selectActiveRequestResponses = createSelector(
  selectActiveRequest,
  selectEntitiesLists,
  selectActiveEnvironment,
  selectSettings,
  (activeRequest, entities, activeEnvironment, settings) => {
    const requestId = activeRequest ? activeRequest._id : 'n/a';
    // Filter responses down if the setting is enabled
    return entities.responses
      .filter(response => {
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

export const selectActiveUnitTestResult = createSelector(
  selectEntitiesLists,
  selectActiveWorkspace,
  (entities, activeWorkspace) => {
    if (!activeWorkspace) {
      return null;
    }

    let recentResult: UnitTestResult | null = null;

    for (const r of entities.unitTestResults) {
      if (r.parentId !== activeWorkspace._id) {
        continue;
      }

      if (!recentResult) {
        recentResult = r;
        continue;
      }

      if (r.created > recentResult.created) {
        recentResult = r;
      }
    }

    return recentResult;
  },
);

export const selectActiveUnitTestSuite = createSelector(
  selectEntitiesLists,
  selectActiveWorkspaceMeta,
  (entities, activeWorkspaceMeta) => {
    if (!activeWorkspaceMeta) {
      return null;
    }

    const id = activeWorkspaceMeta.activeUnitTestSuiteId;
    return entities.unitTestSuites.find(s => s._id === id) || null;
  },
);

export const selectActiveUnitTests = createSelector(
  selectEntitiesLists,
  selectActiveUnitTestSuite,
  (entities, activeUnitTestSuite) => {
    if (!activeUnitTestSuite) {
      return [];
    }

    return entities.unitTests.filter(s => s.parentId === activeUnitTestSuite._id);
  },
);

export const selectActiveProjectName = createSelector(
  selectActiveProject,
  activeProject => activeProject.name,
);

export const selectActiveUnitTestSuites = createSelector(
  selectEntitiesLists,
  selectActiveWorkspace,
  (entities, activeWorkspace) => {
    return entities.unitTestSuites.filter(s => s.parentId === activeWorkspace?._id);
  },
);

export const selectSyncItems = createSelector(
  selectActiveWorkspaceEntities,
  getStatusCandidates,
);

export const selectIsLoggedIn = createSelector(
  selectGlobal,
  global => global.isLoggedIn,
);

export const selectActiveActivity = createSelector(
  selectGlobal,
  global => global.activeActivity,
);
