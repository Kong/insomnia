import format from 'date-fns/format';

import { database } from '../../common/database';
import * as models from '../../models';
import { Project, RemoteProject } from '../../models/project';
import { Workspace } from '../../models/workspace';
import { getOrCreateByParentId } from '../../models/workspace-meta';
import { initializeLocalBackendProjectAndMarkForSync, pushSnapshotOnInitialize } from './initialize-backend-project';
import { VCS } from './vcs';

// Migration:
// Team ~= Project > Workspaces
// In the previous API: { _id: 'proj_team_123', remoteId: 'team_123', parentId: null }

// Organization > TeamProject > Workspaces
// In the new API: { _id: 'proj_team_123', remoteId: 'proj_team_123', parentId: 'team_123' }

// the remote id field previously tracked "team_id"
// (remote concept for matching 1:1 with this project) which is now org_id
// the _id field previously tracked the "proj_team_id"
// which was a wrapper for the team_id prefixing proj_to the above id,
// which is now the remoteId for tracking the projects within an org

type RemoteOrganizationId = string;
type RemoteFileId = string; // project id
type RemoteProjectId = string; // team project id
type LocalWorkspaceToLocalProjectMap = Record<RemoteFileId, RemoteProjectId>;
interface OwernshipSnapshot {
  ownedByMe: boolean;
  isPersonal: boolean;
  fileIdMap: LocalWorkspaceToLocalProjectMap;
  projectIds: RemoteProjectId[];
}

type RemoteFileSnapshot = Record<RemoteOrganizationId, OwernshipSnapshot>;
interface QueueForMigration {
  projects: Set<string>;
  filesByProject: Set<string>;
  filesNoProject: Set<string>;
}
export const scanForMigration = async (): Promise<QueueForMigration> => {
  const queueLocalProjects = new Set<string>();
  const queueLocalFilesByProject = new Set<string>();
  const queueLocalFilesNoProject = new Set<string>();

  console.log('[migration] querying legacy remote projects');
  const legacyRemoteProjects = await database.find<RemoteProject>(models.project.type, {
    remoteId: { $ne: null },
    parentId: null,
  });

  for (const project of legacyRemoteProjects) {
    console.log('[migration] found legacy remote project', project);
    queueLocalProjects.add(project._id);

    console.log('[migration] querying files under the legacy remote projects', project._id);
    const files = await database.find<Workspace>(models.workspace.type, { parentId: project._id });
    for (const file of files) {
      console.log('[migration] found the legacy remote project %d - %v', project._id, file._id);
      queueLocalFilesByProject.add(file._id);
    }
  }

  console.log('[migration] querying local projects');
  const localProjects = await database.find<Project>(models.project.type, {
    remoteId: null,
    parentId: null,
    _id: { $ne: models.project.SCRATCHPAD_PROJECT_ID },
  });

  for (const project of localProjects) {
    console.log('[migration] found local project', project._id);
    queueLocalProjects.add(project._id);

    console.log('[migration] querying files under the local projects', project._id);
    const files = await database.find<Workspace>(models.workspace.type, { parentId: project._id });
    for (const file of files) {
      console.log('[migration] found the legacy remote project %d - %v', project._id, file._id);
      queueLocalFilesByProject.add(file._id);
    }
  }

  console.log('[migration] querying untracked files with no parents');
  const untrackedFiles = await database.find<Workspace>(models.workspace.type, {
    parentId: null,
  });

  for (const file of untrackedFiles) {
    console.log('[migration] found an untracked file with no parents', file._id);
    queueLocalFilesNoProject.add(file._id);
  }

  // queues to iterate for migration
  return {
    projects: queueLocalProjects,
    filesByProject: queueLocalFilesByProject,
    filesNoProject: queueLocalFilesNoProject,
  };
};

interface RemoteBackground {
  myWorkspaceId: string;
  remoteFileSnapshot: RemoteFileSnapshot;
  byRemoteProjectId: Map<RemoteProjectId, RemoteOrganizationId>;
  byRemoteFileId: Map<RemoteFileId, {
    remoteOrgId: RemoteOrganizationId;
    remoteProjectId: RemoteProjectId;
  }>;
}
const remoteBackgroundCheck = async (sessionId: string): Promise<RemoteBackground | null> => {
  const response = await window.main.insomniaFetch<RemoteFileSnapshot | { error: string; message: string }>({
    method: 'GET',
    path: '/v1/user/file-snapshot',
    sessionId,
  });

  if (!response) {
    console.log('[migration] network failed to run remote background check for file snapshot per organizations');
    return null;
  }

  if ('error' in response) {
    console.log('[migration] network error', response.message);
    return null;
  }

  const remotePersonalWorkspaceId = Object.keys(response).find(remoteOrgId => response![remoteOrgId].isPersonal && response![remoteOrgId].ownedByMe);
  if (!remotePersonalWorkspaceId) {
    return null;
  }

  const byRemoteProjectId: Map<RemoteProjectId, RemoteOrganizationId> = new Map();
  const byRemoteFileId: Map<RemoteFileId, {
    remoteOrgId: RemoteOrganizationId;
    remoteProjectId: RemoteProjectId;
  }> = new Map();

  const remoteOrgIds = Object.keys(response);
  for (const remoteOrgId of remoteOrgIds) {
    const orgSnapshot = response[remoteOrgId];
    const orgFileIdMap = Object.entries(orgSnapshot.fileIdMap);

    for (const [remoteFileId, remoteProjectId] of orgFileIdMap) {
      if (byRemoteFileId.has(remoteFileId)) {
        // map the conflict into the log if it ever happens
        console.log('[migration] CONFLICT: file id %a from remote project %b already exists in %c', remoteFileId, remoteProjectId, byRemoteFileId.get(remoteFileId));
        continue;
      }

      byRemoteFileId.set(remoteFileId, { remoteProjectId, remoteOrgId });

      if (byRemoteProjectId.has(remoteProjectId)) {
        // map the conflict into the log if it ever happens
        console.log('[migration] CONFLICT: remote project id - %a from org - %b already exists in %c', remoteProjectId, remoteOrgId, byRemoteProjectId.get(remoteProjectId));
        continue;
      }

      byRemoteProjectId.set(remoteProjectId, remoteOrgId);
    }
  }

  return {
    myWorkspaceId: remotePersonalWorkspaceId,
    remoteFileSnapshot: response,
    byRemoteProjectId,
    byRemoteFileId,
  };
};

interface RecordsForMigration {
  projects: Map<string, string>;
  files: Map<string, string>;
};
const _migrateToLocalVault = async (queue: QueueForMigration, remoteBackground: RemoteBackground): Promise<RecordsForMigration> => {
  const recordsForProjectMigration = new Map<string, string>();
  const recordsForFileMigration = new Map<string, string>();

  for (const localProjectId of queue.projects.keys()) {
    const docs = await database.find<Project>(models.project.type, { _id: localProjectId });
    if (!docs.length) {
      console.log('[migration] you are one of the rare lucky user. magic happened your project is gone after queued for migration');
      continue;
    }

    const localProject = docs[0];
    const { _id: oldProjectId, remoteId, parentId, ...props } = localProject;

    const newProject = await database.docCreate<Project>(models.project.type, {
      ...props,
      parentId: remoteBackground.myWorkspaceId,
      remoteId: null,
    });

    recordsForProjectMigration.set(oldProjectId, newProject._id);

    const files = await database.find<Workspace>(models.workspace.type, { parentId: localProjectId });
    for (const oldFile of files) {
      const newFile = await database.duplicate<Workspace>(oldFile, { parentId: newProject._id });
      recordsForFileMigration.set(oldFile._id, newFile._id);
    }
  }

  if (!queue.filesNoProject.size) {
    return {
      projects: recordsForProjectMigration,
      files: recordsForFileMigration,
    };
  }

  const timestamp = format(Date.now(), 'MM-dd');
  const vaultName = `Local Vault ${timestamp}`;
  const newLocalVault = await database.docCreate<Project>(models.project.type, {
    name: vaultName,
    parentId: remoteBackground.myWorkspaceId,
    remoteId: null,
  });

  console.log('[migration] new local vault is created for untracked files without a project');
  for (const fileId of queue.filesNoProject.keys()) {
    const docs = await database.find<Workspace>(models.workspace.type, { _id: fileId });
    if (!docs.length) {
      continue;
    }

    const oldFile = docs[0];
    const newFile = await database.duplicate<Workspace>(oldFile, { parentId: newLocalVault._id });
    recordsForFileMigration.set(oldFile._id, newFile._id);
  }
  return {
    projects: recordsForProjectMigration,
    files: recordsForFileMigration,
  };
};

const _validateProjectsWithRemote = async (queue: QueueForMigration, remoteBackground: RemoteBackground) => {
  console.log('[migration] validating projects against the remote');
  const { myWorkspaceId } = remoteBackground;
  const myWorkspace = remoteBackground.remoteFileSnapshot[myWorkspaceId];

  const validProjectIds = new Set<string>();
  const validProjects = [];

  for (const remoteProjectId of myWorkspace.projectIds) {
    // scan all the project entities with the remote project id that belongs to my workspace
    const docs = await database.find<Project>(models.project.type, { remoteId: remoteProjectId });
    if (!docs.length) {
      // remote project has not been created in the local yet => create one
      const newProject = await database.docCreate<Project>(models.project.type, {
        name: 'Cloud Sync ' + remoteProjectId, // name should matter here?
        parentId: remoteBackground.myWorkspaceId,
        remoteId: remoteProjectId,
      });

      validProjectIds.add(newProject._id);
      validProjects.push(newProject);
      continue;
    }

    if (docs.length > 1) {
      // this is messed up case for whatever reason.
      // let's reconcile this.
      // ideally we should compare the project parent id (organization id) and see if the user belongs to the organization,
      // but this will be a very rare case. It may be more valuable to prioritize data linking recovery

      const defaultProjectWithSameRemoteId = docs[0];
      validProjectIds.add(defaultProjectWithSameRemoteId._id);
      validProjects.push(defaultProjectWithSameRemoteId);

      // two different projects with the same remote id
      for (const doc of docs) {
        // let's still iterate through all the sub files
        // first let's check,
        // this case should be already filtered by scanning, but let's correct
        if (doc._id !== defaultProjectWithSameRemoteId._id) {
          // repair
          console.log('[migration] repairing file-project linking');
          const projectFiles = await database.find<Workspace>(models.workspace.type, {
            parentId: doc._id,
          });

          // move the file linking to the selected project with the same remote id
          for (const projectFile of projectFiles) {
            await database.docUpdate(projectFile, { parentId: defaultProjectWithSameRemoteId._id });
            queue.filesByProject.delete(projectFile._id);
          }
        }
      }

      continue;
    }

    const doc = docs[0];
    validProjectIds.add(doc._id);
    validProjects.push(doc);
  }

  return {
    validProjectIds,
    validProjects,
  };
};

type RecordsForCloudMigration = RecordsForMigration & {
  filesForSync: Workspace[];
};
const _migrateToCloudSync = async (
  queue: QueueForMigration,
  remoteBackground: RemoteBackground,
): Promise<RecordsForCloudMigration> => {
  const filesForSync: Workspace[] = [];
  const recordsForProjectMigration = new Map<string, string>();
  const recordsForFileMigration = new Map<string, string>();

  // first ensure all the remote team project in my workspace exists and only link to them
  const { myWorkspaceId } = remoteBackground;
  // const myWorkspace = remoteBackground.remoteFileSnapshot[myWorkspaceId];

  // this is important as the number of team project in the cloud is limited by the plan tier
  // if we link files to local project entities with parent ids that don't exist in the cloud, then they will see no files => data loss experience

  const { validProjectIds, validProjects } = await _validateProjectsWithRemote(queue, remoteBackground);
  if (!validProjects.length) {
    console.log('[migration] there are no valid projects in the cloud. most likely, data issue. fallback to the local valut instead');
    const fallbackResult = await _migrateToLocalVault(queue, remoteBackground);
    return { ...fallbackResult, filesForSync };
  }

  // now we can safely proceed migration
  // 1. ensure these projects are correctly linked to my workspace (if not ideally we should hault)
  for (const validProject of validProjects) {
    if (validProject.parentId !== myWorkspaceId) {
      console.log('[migration] repairing team-project to organization linking for local database');
      await database.docUpdate<Project>(validProject, {
        parentId: myWorkspaceId,
      });
    }

    // if the valid project id exists in the queue, delete them.
    queue.projects.delete(validProject._id);
  }

  // due to the constraint - free user can have only 1 team project with collaborators
  const defaultRemoteProject = validProjects[0]; // <=== link all the cloud sync files here, so users can see their files
  for (const fileId of queue.filesByProject.keys()) {
    const docs = await database.find<Workspace>(models.workspace.type, { _id: fileId });
    if (!docs.length) {
      continue;
    }

    const file = docs[0];
    const remoteFileRecord = remoteBackground.byRemoteFileId.get(file._id);
    if (!remoteFileRecord) {
      // No file record in the remote => just create new file and move on
      const newFile = await database.duplicate<Workspace>(file, { parentId: defaultRemoteProject._id });
      filesForSync.push(newFile);
      recordsForFileMigration.set(file._id, newFile._id);
      continue;
    }

    if (remoteFileRecord.remoteOrgId !== myWorkspaceId) {
      // There is a conflicting record in the remote but not in my workspace => create new file and continue;
      // we should revisit this to tighten the ownership
      const newFile = await database.duplicate<Workspace>(file, { parentId: defaultRemoteProject._id });
      filesForSync.push(newFile);
      recordsForFileMigration.set(file._id, newFile._id);
      continue;
    }

    if (!validProjectIds.has(file.parentId)) {
      // remote file record exists under the same workspace but local file record is not in the valid linking
      // => create new file and continue;
      const newFile = await database.duplicate<Workspace>(file, { parentId: defaultRemoteProject._id });
      filesForSync.push(newFile);
      recordsForFileMigration.set(file._id, newFile._id);
      continue;
    }

    // this is correctly linked both locally and remotely
    // we should remove this from the queue and prevent modification or deletion
    queue.filesByProject.delete(file._id);
  }

  // these are simpler cases. Just create new files and move on
  for (const fileId of queue.filesNoProject.keys()) {
    const docs = await database.find<Workspace>(models.workspace.type, { _id: fileId });
    if (!docs.length) {
      continue;
    }

    const file = docs[0];
    const newFile = await database.duplicate<Workspace>(file, { parentId: defaultRemoteProject._id });
    filesForSync.push(newFile);
    recordsForFileMigration.set(file._id, newFile._id);
  }

  for (const projectId of queue.projects.keys()) {
    // we are updating the existing one wit the default remote project id to run clean up
    // queue only has applicable projects as others were removed when matched with the remote ids before
    recordsForProjectMigration.set(projectId, defaultRemoteProject._id);
  }

  return {
    projects: recordsForProjectMigration,
    files: recordsForFileMigration,
    filesForSync,
  };
};

export const shouldMigrate = (queue: QueueForMigration) => {
  const shouldContinue = queue.projects.size > 0 || queue.filesByProject.size > 0 || queue.filesNoProject.size > 0;
  return shouldContinue;
};
export const migrateIfNeeded = async (sessionId: string, local: boolean): Promise<Workspace[]> => {
  const queue = await scanForMigration();

  if (!shouldMigrate(queue)) {
    return [];
  }

  const remoteBackground = await remoteBackgroundCheck(sessionId);
  if (!remoteBackground) {
    throw new Error("Failed to check against user's remote snapshot");
  }

  if (local) {
    const records = await _migrateToLocalVault(queue, remoteBackground);
    const total = queue.filesByProject.size + queue.filesNoProject.size;
    if (total > records.files.size) {
      console.error(`[migration] failed as not all the queued files are migrated  - ${total - records.files.size} files`);
      // don't delete records
      return [];
    }

    if (queue.projects.size > records.projects.size) {
      console.error(`[migration] failed as not all the queued projects are migrated  - ${queue.projects.size - records.projects.size} projects`);
      // don't delete records
      return [];
    }

    // clean up the duplicated records now
    for (const oldFileId of records.files.keys()) {
      const docs = await database.find<Workspace>(models.workspace.type, { _id: oldFileId });
      const oldFile = docs[0];
      if (!oldFile) {
        console.error(`[migration] failed to clean up old file - ${oldFileId}`);
        // TODO: log this
        // TODO: handle the error communication to the UI
        continue;
      }

      await database.removeWhere<Workspace>(models.workspace.type, { _id: oldFileId });
      if (oldFile.parentId) {
        queue.filesByProject.delete(oldFileId);
      } else {
        queue.filesNoProject.delete(oldFileId);
      }
      console.log(`[migration] cleaned up old file - ${oldFileId}`);
    }

    for (const oldProjectId of records.projects.keys()) {
      const docs = await database.find<Project>(models.project.type, { _id: oldProjectId });
      const oldProject = docs[0];
      if (!oldProject) {
        console.error(`[migration] failed to clean up old project - ${oldProjectId}`);
        continue;
      }

      await database.removeWhere<Project>(models.project.type, { _id: oldProjectId });
      queue.projects.delete(oldProjectId);
      console.log(`[migration] cleaned up old project - ${oldProjectId}`);
    }

    console.log('[migration] incomplete migration project count: %a', queue.projects.size);
    console.log('[migration] incomplete migration files with project count: %a', queue.filesByProject.size);
    console.log('[migration] incomplete migration files without project count: %a', queue.filesNoProject.size);
    return [];
  }

  const records = await _migrateToCloudSync(queue, remoteBackground);
  const total = queue.filesByProject.size + queue.filesNoProject.size;
  if (total > records.files.size) {
    console.log(`[migration] INCOMPLETE: ${total - records.files.size} files are not migrated`);
  }

  if (queue.projects.size > records.projects.size) {
    console.log(`[migration] INCOMPLETE: ${queue.projects.size - records.projects.size} projects are not migrated`);
  }

  // clean up the duplicated records now
  for (const oldFileId of records.files.keys()) {
    const docs = await database.find<Workspace>(models.workspace.type, { _id: oldFileId });
    const oldFile = docs[0];
    if (!oldFile) {
      console.log('[migration] failed to clean up old file - %a', oldFileId);
      // TODO: log this
      // TODO: handle the error communication to the UI
      continue;
    }

    await database.removeWhere<Workspace>(models.workspace.type, { _id: oldFileId });
    if (oldFile.parentId) {
      queue.filesByProject.delete(oldFileId);
    } else {
      queue.filesNoProject.delete(oldFileId);
    }
    console.log('[migration] cleaned up old file - %a', oldFileId);
  }

  for (const oldProjectId of records.projects.keys()) {
    const docs = await database.find<Project>(models.project.type, { _id: oldProjectId });
    const oldProject = docs[0];
    if (!oldProject) {
      console.log('[migration] failed to clean up old project - %a', oldProjectId);
      continue;
    }

    await database.removeWhere<Project>(models.project.type, { _id: oldProjectId });
    queue.projects.delete(oldProjectId);
    console.log('[migration] cleaned up old project - %a', oldProjectId);
  }

  console.log('[migration] incomplete migration project count: %a', queue.projects.size);
  console.log('[migration] incomplete migration files with project count: %a', queue.filesByProject.size);
  console.log('[migration] incomplete migration files without project count: %a', queue.filesNoProject.size);
  return records.filesForSync;
};

export const autoSyncForMigration = async (files: Workspace[], vcs: VCS) => {
  for (const file of files) {
    const docs = await database.find<Project>(models.project.type, { _id: file.parentId });
    if (!docs.length) {
      // at this point, this shouldn't happen but just in case.
      console.log('[migration] you are one of the rare lucky user');
      continue;
    }

    const project = docs[0];
    const workspaceMeta = await getOrCreateByParentId(file._id);
    // Initialize Sync on the workspace if it's not using Git sync
    try {
      if (!workspaceMeta.gitRepositoryId) {
        console.log(`[migration] syncing a file - ${file._id}: ${file.name}`);
        await initializeLocalBackendProjectAndMarkForSync({ vcs, workspace: file });
        await pushSnapshotOnInitialize({ vcs, project, workspace: file });
      }
    } catch (e) {
      console.warn('Failed to initialize sync on workspace. This will be retried when the workspace is opened on the app.', e);
    }
  }
};
