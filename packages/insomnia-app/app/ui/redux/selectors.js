import { createSelector } from 'reselect';
import * as models from '../../models';

// ~~~~~~~~~ //
// Selectors //
// ~~~~~~~~~ //

export const selectEntitiesLists = createSelector(
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
  return entities.settings[0] || models.settings.init();
});

export const selectActiveWorkspace = createSelector(
  state => selectEntitiesLists(state).workspaces,
  state => state.entities,
  state => state.global.activeWorkspaceId,
  (workspaces, entities, activeWorkspaceId) => {
    return entities.workspaces[activeWorkspaceId] || workspaces[0];
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
  (entities, activeWorkspace) => {
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
    const repo = entities.gitRepositories.find(r => r._id === id);
    return repo || null;
  },
);

export const selectCollapsedRequestGroups = createSelector(selectEntitiesLists, entities => {
  const collapsed = {};

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
    const descendants = [activeWorkspace];
    const addChildrenOf = parent => {
      // Don't add children of requests (eg. auth requests)
      if (parent.type === models.request.type) {
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
      e => e.type === models.request.type || e.type === models.requestGroup.type,
    );
  },
);

export const selectActiveRequest = createSelector(
  state => state.entities,
  selectActiveWorkspaceMeta,
  (entities, workspaceMeta) => {
    const id = workspaceMeta ? workspaceMeta.activeRequestId : 'n/a';
    return entities.requests[id] || entities.grpcRequests[id] || null;
  },
);

export const selectActiveProtoFiles = createSelector(
  selectEntitiesLists,
  selectActiveWorkspace,
  (entities, workspace) => {
    return entities.protoFiles.filter(pf => pf.parentId === workspace._id);
  },
);

export const selectActiveCookieJar = createSelector(
  selectEntitiesLists,
  selectActiveWorkspace,
  (entities, workspace) => {
    const cookieJar = entities.cookieJars.find(cj => cj.parentId === workspace._id);
    return cookieJar || null;
  },
);

export const selectActiveOAuth2Token = createSelector(
  selectEntitiesLists,
  selectActiveWorkspaceMeta,
  (entities, workspaceMeta) => {
    const id = workspaceMeta ? workspaceMeta.activeRequestId : 'n/a';
    return entities.oAuth2Tokens.find(t => t.parentId === id);
  },
);

export const selectUnseenWorkspaces = createSelector(selectEntitiesLists, entities => {
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
    let recentResult = null;
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

export const selectActiveUnitTestSuites = createSelector(
  selectEntitiesLists,
  selectActiveWorkspace,
  (entities, activeWorkspace) => {
    return entities.unitTestSuites.filter(s => s.parentId === activeWorkspace._id);
  },
);

export const selectSyncItems = createSelector(selectActiveWorkspaceEntities, workspaceEntities =>
  workspaceEntities.filter(models.canSync).map(doc => ({
    key: doc._id,
    name: doc.name || '',
    document: doc,
  })),
);
