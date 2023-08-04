import { createSelector } from 'reselect';
import type { ValueOf } from 'type-fest';

import { BaseModel, canSync } from '../../models';
import { DEFAULT_PROJECT_ID } from '../../models/project';
import { isRequest } from '../../models/request';
import { StatusCandidate } from '../../sync/types';
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

// sync dropdown, branches, history and staging
export const selectSyncItems = createSelector(
  selectActiveWorkspaceEntities,
  (docs: BaseModel[]) => docs.filter(canSync).map((doc: BaseModel): StatusCandidate => ({
    key: doc._id,
    name: doc.name || '',
    document: doc,
  })),
);
