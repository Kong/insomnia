import { database } from '../../common/database';
import * as models from '../../models';
import { Project } from '../../models/project';
import { Workspace } from '../../models/workspace';
import { VCS } from './vcs';

type RemoteOrganizationId = string;
type RemoteFileId = string; // project id
type RemoteProjectId = string; // team project id
type LocalWorkspaceToLocalProjectMap = Record<RemoteFileId, RemoteProjectId>;

interface OwnershipSnapshot {
  ownedByMe: boolean;
  isPersonal: boolean;
  fileIdMap: LocalWorkspaceToLocalProjectMap;
  projectIds: RemoteProjectId[];
}

type RemoteFileSnapshot = Record<RemoteOrganizationId, OwnershipSnapshot>;

async function getUserFileSnapshots(): Promise<RemoteFileSnapshot> {
  return {};
}

export async function migrateUntrackedWorkspaces(vcs: VCS) {
  const untrackedWorkspaces = await database.find<Workspace>(models.workspace.type, {
    parentId: null,
  });

  if (!untrackedWorkspaces?.length) {
    return null;
  }

  const backendProjects = await vcs._allBackendProjects();

  const workspacesWithBackendProject = untrackedWorkspaces.filter(workspace => {
    const backendProject = backendProjects.find(p => p.rootDocumentId === workspace._id);
    return Boolean(backendProject);
  });

  if (workspacesWithBackendProject.length > 0) {
    const remoteFileSnapshots = await getUserFileSnapshots();

    if (!remoteFileSnapshots || Object.keys(remoteFileSnapshots).length === 0) {
      console.warn('No remote file snapshots found for user');
      return null;
    }

    // Map of file id to project id
    const fileToProjectMap = Object.entries(remoteFileSnapshots)
      .map(([, snapshot]) => {
        return snapshot.fileIdMap;
      })
      .flat()
      .reduce((acc, fileIdMap) => {
        return {
          ...acc,
          ...fileIdMap,
        };
      }, {});

    for (const workspace of workspacesWithBackendProject) {
      const projectRemoteId = fileToProjectMap[workspace._id];

      if (projectRemoteId) {
        const project = await database.getWhere<Project>(models.project.type, {
          remoteId: projectRemoteId,
        });

        if (project) {
          await models.workspace.update(workspace, {
            parentId: project._id,
          });
        }
      }
    }
  }

  return 'Success';
};
