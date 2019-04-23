import { createSelector } from 'reselect';
import { fuzzyMatchAll } from '../../common/misc';
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

export const selectEntitiesChildrenMap = createSelector(
  selectEntitiesLists,
  entities => {
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
  },
);

export const selectActiveWorkspace = createSelector(
  state => selectEntitiesLists(state).workspaces,
  state => state.entities,
  state => state.global.activeWorkspaceId,
  (workspaces, entities, activeWorkspaceId) => {
    return entities.workspaces[activeWorkspaceId] || workspaces[0];
  },
);

export const selectActiveWorkspaceClientCertificates = createSelector(
  selectEntitiesLists,
  selectActiveWorkspace,
  (entities, activeWorkspace) => {
    return entities.clientCertificates.filter(c => c.parentId === activeWorkspace._id);
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

export const selectCollapsedRequestGroups = createSelector(
  selectEntitiesLists,
  entities => {
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
  },
);

export const selectActiveWorkspaceEntities = createSelector(
  selectActiveWorkspace,
  selectEntitiesChildrenMap,
  (activeWorkspace, childrenMap) => {
    const descendants = [activeWorkspace];
    const addChildrenOf = parent => {
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

export const selectSidebarChildren = createSelector(
  selectCollapsedRequestGroups,
  selectActiveWorkspace,
  selectActiveWorkspaceMeta,
  selectEntitiesChildrenMap,
  (collapsed, activeWorkspace, activeWorkspaceMeta, childrenMap) => {
    const sidebarFilter = activeWorkspaceMeta ? activeWorkspaceMeta.sidebarFilter : '';

    function next(parentId) {
      const children = (childrenMap[parentId] || [])
        .filter(doc => {
          return doc.type === models.request.type || doc.type === models.requestGroup.type;
        })
        .sort((a, b) => {
          if (a.metaSortKey === b.metaSortKey) {
            return a._id > b._id ? -1 : 1;
          } else {
            return a.metaSortKey < b.metaSortKey ? -1 : 1;
          }
        });

      if (children.length > 0) {
        return children.map(c => ({
          doc: c,
          hidden: false,
          collapsed: !!collapsed[c._id],

          // Don't add children of requests
          children: c.type === models.request.type ? [] : next(c._id),
        }));
      } else {
        return children;
      }
    }

    function matchChildren(children, parentNames = []) {
      // Bail early if no filter defined
      if (!sidebarFilter) {
        return children;
      }

      for (const child of children) {
        // Gather all parents so we can match them too
        matchChildren(child.children, [...parentNames, child.doc.name]);

        const hasMatchedChildren = child.children.find(c => c.hidden === false);

        // Try to match request attributes
        const { name, method } = child.doc;
        const match = fuzzyMatchAll(sidebarFilter, [name, method, ...parentNames], {
          splitSpace: true,
        });

        // Update hidden state depending on whether it matched
        const matched = hasMatchedChildren || match;
        child.hidden = !matched;
      }

      return children;
    }

    const childrenTree = next(activeWorkspace._id, false);
    return matchChildren(childrenTree);
  },
);

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
    return entities.requests[id] || null;
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

export const selectUnseenWorkspaces = createSelector(
  selectEntitiesLists,
  entities => {
    const { workspaces, workspaceMetas } = entities;
    return workspaces.filter(workspace => {
      const meta = workspaceMetas.find(m => m.parentId === workspace._id);
      return !!(meta && !meta.hasSeen);
    });
  },
);

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
  (activeRequest, entities) => {
    const requestId = activeRequest ? activeRequest._id : 'n/a';
    return entities.responses
      .filter(response => requestId === response.parentId)
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
  workspaceEntities =>
    workspaceEntities.filter(models.canSync).map(doc => ({
      key: doc._id,
      name: doc.name || '',
      document: doc,
    })),
);
