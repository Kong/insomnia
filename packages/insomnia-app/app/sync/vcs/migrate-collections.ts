import { isLoggedIn } from '../../account/session';
import { asyncFilter } from '../../common/async-array-helpers';
import { database } from '../../common/database';
import * as models from '../../models';
import { isRemoteProject, RemoteProject } from '../../models/project';
import {  isCollection, Workspace } from '../../models/workspace';
import { Team } from '../types';
import { initializeProjectFromTeam } from './initialize-model-from';
import { VCS } from './vcs';

export const logCollectionMovedToProject = (collection: Workspace, remoteProject: RemoteProject) => {
  console.log('[sync] collection has been moved to the remote project to which it belongs', {
    collection: {
      id : collection._id,
      name: collection.name,
    },
    project: {
      id: remoteProject._id,
      name: remoteProject.name,
    },
  });
};

export const migrateCollectionsIntoRemoteProject = async (vcs: VCS) => {
  console.log('[sync] checking for collections which need to be moved into a remote project');

  // If not logged in, exit
  if (!isLoggedIn()) {
    return;
  }

  const collections = (await models.workspace.all()).filter(isCollection);
  const remoteProjects = (await models.project.all()).filter(isRemoteProject);

  // Are there any collections that have sync setup but are not in a remote project?
  const isNotInRemoteProject = (collection: Workspace) => !Boolean(remoteProjects.find(project => project._id === collection.parentId));
  const hasLocalProject = (collection: Workspace) => vcs.hasBackendProjectForRootDocument(collection._id);

  const needsMigration = await asyncFilter(collections, async coll => await hasLocalProject(coll) && isNotInRemoteProject(coll));

  // If nothing to migrate, exit
  if (!needsMigration.length) {
    return;
  }

  const remoteBackendProjectsInAnyTeam = await vcs.remoteBackendProjectsInAnyTeam();
  const findRemoteBackendProject = (collection: Workspace) => remoteBackendProjectsInAnyTeam.find(project => project.rootDocumentId === collection._id);
  const findRemoteProjectByTeam = (team: Team) => remoteProjects.find(project => project.remoteId === team.id);

  const upsert: (Workspace | RemoteProject)[] = [];

  for (const collection of needsMigration) {
    const remoteBackendProject = findRemoteBackendProject(collection);

    if (!remoteBackendProject) {
      continue;
    }

    let remoteProject = findRemoteProjectByTeam(remoteBackendProject.team);

    if (!remoteProject) {
      remoteProject = await initializeProjectFromTeam(remoteBackendProject.team);
      upsert.push(remoteProject);
    }

    collection.parentId = remoteProject._id;
    upsert.push(collection);
    logCollectionMovedToProject(collection, remoteProject);
  }

  if (upsert.length) {
    await database.batchModifyDocs({ upsert });
  }
};
