import { isLoggedIn } from '../../account/session';
import { asyncFilter } from '../../common/async-array-helpers';
import { database } from '../../common/database';
import * as models from '../../models';
import { isRemoteSpace, RemoteSpace } from '../../models/space';
import {  isCollection, Workspace } from '../../models/workspace';
import { Team } from '../types';
import { initializeSpaceFromTeam } from './initialize-model-from';
import { VCS } from './vcs';

export const logCollectionMovedToSpace = (collection: Workspace, remoteSpace: RemoteSpace) => {
  console.log('[sync] collection has been moved to the remote space to which it belongs', {
    collection: {
      id : collection._id,
      name: collection.name,
    },
    space: {
      id: remoteSpace._id,
      name: remoteSpace.name,
    },
  });
};

export const migrateCollectionsIntoRemoteSpace = async (vcs: VCS) => {
  console.log('[sync] checking for collections which need to be moved into a remote space');

  // If not logged in, exit
  if (!isLoggedIn()) {
    return;
  }

  const collections = (await models.workspace.all()).filter(isCollection);
  const remoteSpaces = (await models.space.all()).filter(isRemoteSpace);

  // Are there any collections that have sync setup but are not in a remote space?
  const isNotInRemoteSpace = (collection: Workspace) => !Boolean(remoteSpaces.find(space => space._id === collection.parentId));
  const hasLocalProject = (collection: Workspace) => vcs.hasProjectForRootDocument(collection._id);

  const needsMigration = await asyncFilter(collections, async coll => await hasLocalProject(coll) && isNotInRemoteSpace(coll));

  // If nothing to migrate, exit
  if (!needsMigration.length) {
    return;
  }

  const remoteProjectsInAnyTeam = await vcs.remoteProjectsInAnyTeam();
  const findRemoteProject = (collection: Workspace) => remoteProjectsInAnyTeam.find(project => project.rootDocumentId === collection._id);
  const findRemoteSpaceByTeam = (team: Team) => remoteSpaces.find(space => space.remoteId === team.id);

  const upsert: (Workspace | RemoteSpace)[] = [];

  for (const collection of needsMigration) {
    const remoteProject = findRemoteProject(collection);

    if (!remoteProject) {
      return;
    }

    let remoteSpace = findRemoteSpaceByTeam(remoteProject.team);

    if (!remoteSpace) {
      remoteSpace = await initializeSpaceFromTeam(remoteProject.team);
      upsert.push(remoteSpace);
    }

    collection.parentId = remoteSpace._id;
    upsert.push(collection);
    logCollectionMovedToSpace(collection, remoteSpace);
  }

  if (upsert.length) {
    await database.batchModifyDocs({ upsert });
  }
};
