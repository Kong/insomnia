import { createSelector } from 'reselect';
import * as models from '../../models';
import { BaseModel } from '../../models';
import { isRequest } from '../../models/request';
import { isRequestGroup } from '../../models/request-group';
import { Space } from '../../models/space';
import { UnitTestResult } from '../../models/unit-test-result';
import { Workspace } from '../../models/workspace';
import { StatusCandidate } from '../../sync/types';

// ~~~~~~~~~ //
// Selectors //
// ~~~~~~~~~ //
export const selectEntitiesLists = createSelector(
  // @ts-expect-error -- TSCONVERSION
  state => state.entities,
  entities => {
    const entitiesLists = {};

    for (const k of Object.keys(entities)) {
      const entityMap = entities[k];
      entitiesLists[k] = Object.keys(entityMap).map(id => entityMap[id]);
    }

    return entitiesLists;
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

export const selectSettings = createSelector(selectEntitiesLists, entities => {
  // @ts-expect-error -- TSCONVERSION
  return entities.settings[0] || models.settings.init();
});

export const selectSpaces = createSelector(
  // @ts-expect-error -- TSCONVERSION
  state => selectEntitiesLists(state).spaces as Space[],
  (spaces) => {
    return spaces;
  },
);

export const selectActiveSpace = createSelector<any, {}, string, Space | undefined>(
  state => state.entities,
  state => state.global.activeSpaceId,
  (entities, activeSpaceId) => {
    // @ts-expect-error -- TSCONVERSION
    return entities.spaces[activeSpaceId];
  },
);

export const selectWorkspacesForActiveSpace = createSelector(
  // @ts-expect-error -- TSCONVERSION
  state => selectEntitiesLists(state).workspaces as Workspace[],
  selectActiveSpace,
  (workspaces, activeSpace) => {
    const parentId = activeSpace?._id || null;
    return workspaces.filter(w => w.parentId === parentId);
  },
);

export const selectActiveWorkspace = createSelector(
  // @ts-expect-error -- TSCONVERSION
  state => selectEntitiesLists(state).workspaces as Workspace[],
  selectWorkspacesForActiveSpace,
  state => state.global.activeWorkspaceId,
  (allWorkspaces, workspaces, activeWorkspaceId) => {
    const activeWorkspace = workspaces.find(w => w._id === activeWorkspaceId) || workspaces[0];
    // This fallback is needed because while a space may not have any workspaces
    // The app still _needs_ an active workspace.
    return activeWorkspace || allWorkspaces[0];
  },
);

export const selectActiveWorkspaceMeta = createSelector(
  selectActiveWorkspace,
  selectEntitiesLists,
  (activeWorkspace, entities) => {
    const id = activeWorkspace ? activeWorkspace._id : 'n/a';
    // @ts-expect-error -- TSCONVERSION
    return entities.workspaceMetas.find(m => m.parentId === id);
  },
);
export const selectActiveEnvironment = createSelector(
  selectActiveWorkspaceMeta,
  selectEntitiesLists,
  (meta, entities) => {
    if (!meta) {
      return null;
    }

    // @ts-expect-error -- TSCONVERSION
    return entities.environments.find(e => e._id === meta.activeEnvironmentId) || null;
  },
);
export const selectActiveWorkspaceClientCertificates = createSelector(
  selectEntitiesLists,
  selectActiveWorkspace,
  (entities, activeWorkspace) => {
    // @ts-expect-error -- TSCONVERSION
    return entities.clientCertificates.filter(c => c.parentId === activeWorkspace._id);
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
    // @ts-expect-error -- TSCONVERSION
    const repo = entities.gitRepositories.find(r => r._id === id);
    return repo || null;
  },
);
export const selectCollapsedRequestGroups = createSelector(selectEntitiesLists, entities => {
  const collapsed = {};

  // Default all to collapsed
  // @ts-expect-error -- TSCONVERSION
  for (const requestGroup of entities.requestGroups) {
    collapsed[requestGroup._id] = true;
  }

  // Update those that have metadata (not all do)
  // @ts-expect-error -- TSCONVERSION
  for (const meta of entities.requestGroupMetas) {
    collapsed[meta.parentId] = meta.collapsed;
  }

  return collapsed;
});
export const selectActiveWorkspaceEntities = createSelector(
  selectActiveWorkspace,
  selectEntitiesChildrenMap,
  (activeWorkspace, childrenMap) => {
    const descendants: BaseModel[] = [activeWorkspace];

    // @ts-expect-error -- TSCONVERSION
    const addChildrenOf = parent => {
      // Don't add children of requests (eg. auth requests)
      if (isRequest(parent)) {
        return [];
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
  const pinned = {};
  // @ts-expect-error -- TSCONVERSION
  const requests = [...entities.requests, ...entities.grpcRequests];
  // @ts-expect-error -- TSCONVERSION
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
    );
  },
);
export const selectActiveRequest = createSelector(
  // @ts-expect-error -- TSCONVERSION
  state => state.entities,
  selectActiveWorkspaceMeta,
  (entities, workspaceMeta) => {
    const id = workspaceMeta ? workspaceMeta.activeRequestId : 'n/a';
    return entities.requests[id] || entities.grpcRequests[id] || null;
  },
);
export const selectActiveCookieJar = createSelector(
  selectEntitiesLists,
  selectActiveWorkspace,
  (entities, workspace) => {
    // @ts-expect-error -- TSCONVERSION
    const cookieJar = entities.cookieJars.find(cj => cj.parentId === workspace._id);
    return cookieJar || null;
  },
);
export const selectActiveOAuth2Token = createSelector(
  selectEntitiesLists,
  selectActiveWorkspaceMeta,
  (entities, workspaceMeta) => {
    const id = workspaceMeta ? workspaceMeta.activeRequestId : 'n/a';
    // @ts-expect-error -- TSCONVERSION
    return entities.oAuth2Tokens.find(t => t.parentId === id);
  },
);

export const selectAllWorkspaces = createSelector<any, {}, Workspace[]>(
  selectEntitiesLists,
  entities => {
  // @ts-expect-error -- TSCONVERSION
    const { workspaces } = entities;
    return workspaces;
  });

export const selectUnseenWorkspaces = createSelector(selectEntitiesLists, entities => {
  // @ts-expect-error -- TSCONVERSION
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
    const id = activeRequest ? activeRequest._id : 'n/a';
    // @ts-expect-error -- TSCONVERSION
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
    // @ts-expect-error -- TSCONVERSION
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
    let recentResult: UnitTestResult | null = null;

    // @ts-expect-error -- TSCONVERSION
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
    // @ts-expect-error -- TSCONVERSION
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

    // @ts-expect-error -- TSCONVERSION
    return entities.unitTests.filter(s => s.parentId === activeUnitTestSuite._id);
  },
);

export const selectActiveSpaceName = createSelector(
  selectActiveSpace,
  activeSpace => activeSpace?.name,
);

export const selectActiveUnitTestSuites = createSelector(
  selectEntitiesLists,
  selectActiveWorkspace,
  (entities, activeWorkspace) => {
    // @ts-expect-error -- TSCONVERSION
    return entities.unitTestSuites.filter(s => s.parentId === activeWorkspace._id);
  },
);

export const selectSyncItems = createSelector(
  selectActiveWorkspaceEntities,
  workspaceEntities =>
    workspaceEntities
      .filter(models.canSync)
      .map<StatusCandidate>(doc => ({
        key: doc._id,
        name: doc.name || '',
        document: doc,
      })),
);
