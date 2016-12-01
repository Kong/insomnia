import {createSelector} from 'reselect';
import * as models from '../../models/index';

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
  }
);

export const selectActiveWorkspace = createSelector(
  state => selectEntitiesLists(state).workspaces,
  state => state.entities,
  state => state.global.activeWorkspaceId,
  (workspaces, entities, activeWorkspaceId) => {
    return entities.workspaces[activeWorkspaceId] || workspaces[0];
  }
);

export const selectRequestsAndRequestGroups = createSelector(
  selectEntitiesLists,
  entities => [...entities.requests, ...entities.requestGroups]
);

export const selectCollapsedRequestGroups = createSelector(
  selectEntitiesLists,
  entities => {
    const collapsed = {};
    for (const meta of entities.requestGroupMetas) {
      if (meta.collapsed) {
        collapsed[meta.parentId] = true;
      }
    }
    return collapsed;
  }
);

export const selectSidebarChildren = createSelector(
  selectCollapsedRequestGroups,
  selectRequestsAndRequestGroups,
  selectActiveWorkspace,
  (collapsed, requestsAndRequestGroups, activeWorkspace) => {
    function next (parentId) {
      const children = requestsAndRequestGroups
        .filter(e => e.parentId === parentId)
        .sort((a, b) => {
          // Always sort folders above
          if (a.type === models.requestGroup.type && b.type !== models.requestGroup.type) {
            return -1;
          }

          if (a.metaSortKey === b.metaSortKey) {
            return a._id > b._id ? -1 : 1;
          } else {
            return a.metaSortKey < b.metaSortKey ? -1 : 1;
          }
        });

      if (children.length > 0) {
        return children.map(c => ({
          doc: c,
          children: next(c._id,),
          collapsed: !!collapsed[c._id],
        }));
      } else {
        return children;
      }
    }

    return next(activeWorkspace._id, false);
  }
);

export const selectWorkspaceRequestsAndRequestGroups = createSelector(
  selectActiveWorkspace,
  selectEntitiesLists,
  (activeWorkspace, entities) => {
    function getChildren (doc) {
      const requests = entities.requests.filter(r => r.parentId === doc._id);
      const requestGroups = entities.requestGroups.filter(rg => rg.parentId === doc._id);
      const requestGroupChildren = [];

      for (const requestGroup of requestGroups) {
        for (const requestGroupChild of getChildren(requestGroup)) {
          requestGroupChildren.push(requestGroupChild);
        }
      }

      return [...requests, ...requestGroups, ...requestGroupChildren];
    }

    return getChildren(activeWorkspace);
  }
);

export const selectActiveWorkspaceMeta = createSelector(
  selectActiveWorkspace,
  selectEntitiesLists,
  (activeWorkspace, entities) => {
    const id = activeWorkspace ? activeWorkspace._id : 'n/a';
    return entities.workspaceMetas.find(m => m.parentId === id);
  }
);

export const selectActiveRequest = createSelector(
  state => state.entities,
  selectActiveWorkspaceMeta,
  (entities, workspaceMeta) => {
    const id = workspaceMeta ? workspaceMeta.activeRequestId : 'n/a';
    return entities.requests[id] || null;
  }
);

export const selectActiveRequestMeta = createSelector(
  selectActiveRequest,
  selectEntitiesLists,
  (activeRequest, entities) => {
    const id = activeRequest ? activeRequest._id : 'n/a';
    return entities.requestMetas.find(m => m.parentId === id);
  }
);
