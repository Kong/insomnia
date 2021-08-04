import { isLoggedIn } from '../../account/session';
import { database } from '../../common/database';
import * as models from '../../models';
import { isRemoteSpace, RemoteSpace } from '../../models/space';
import {  isCollection, Workspace } from '../../models/workspace';
import FileSystemDriver from '../store/drivers/file-system-driver';
import { Team } from '../types';
import { initializeSpaceFromTeam } from './initialize-model-from';
import { VCS } from './vcs';

export const logCollectionMovedToSpace = (remoteSpace: RemoteSpace) => {
  console.log('[sync] collection has been moved to the remote space to which it belongs', {
    id: remoteSpace._id,
    name: remoteSpace.name,
  });
};

export const migrateCollectionsIntoRemoteSpace = async (vcsDirectory: string) => {
  const driver = new FileSystemDriver({ directory: vcsDirectory });
  const vcs = new VCS(driver);
  
  const collections = (await models.workspace.all()).filter(isCollection);
  const remoteSpaces = (await models.space.all()).filter(isRemoteSpace);
    
  // Are there any collections that have sync setup but are not in a remote space?
  const isNotInRemoteSpace = (collection: Workspace) => !Boolean(remoteSpaces.find(space => space._id === collection.parentId));
  const hasLocalProject = (collection: Workspace) => vcs.hasLocalProjectForId(collection._id);
    
  const needsMigration = collections.filter(coll => hasLocalProject(coll) && isNotInRemoteSpace(coll));

  // If nothing to migrate, exit
  if (!needsMigration.length) {
    return;
  }

  // If not logged in, exit
  if (!isLoggedIn()) {
    return;
  }

  const remoteProjectsInAnyTeam = await vcs.remoteProjectsInAnyTeam();
  const findRemoteProject = (collection: Workspace) => remoteProjectsInAnyTeam.find(project => project.rootDocumentId === collection._id);
  const findRemoteSpaceByTeam = (team: Team) => remoteSpaces.find(space => space.remoteId === team.id);
  
  const upsert: (Workspace | RemoteSpace)[] = [];
  needsMigration.forEach(async collection => {
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
    logCollectionMovedToSpace(remoteSpace);
  });

  await database.batchModifyDocs({ upsert });
};