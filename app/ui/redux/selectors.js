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

export const selectSidebarChildren = createSelector(
  state => state.requestGroupMeta.collapsed,
  selectRequestsAndRequestGroups,
  selectActiveWorkspace,
  (collapsed, docs, activeWorkspace) => {
    function next (parentId) {
      const children = docs
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
