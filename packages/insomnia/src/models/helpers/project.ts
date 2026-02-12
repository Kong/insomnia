import { createTeamProject, isApiError } from 'insomnia-api';

import { database } from '../../common/database';
import {
  initializeLocalBackendProjectAndMarkForSync,
  pushSnapshotOnInitialize,
} from '../../sync/vcs/initialize-backend-project';
import type { VCS } from '../../sync/vcs/vcs';
import { invariant } from '../../utils/invariant';
import { isDefaultOrganizationProject, type Project, update as updateProject } from '../project';
import { type Workspace } from '../workspace';
import { getOrCreateByParentId as getOrCreateWorkspaceMeta } from '../workspace-meta';
export const sortProjects = (projects: Project[]) => [
  ...projects.filter(p => isDefaultOrganizationProject(p)).sort((a, b) => a.name.localeCompare(b.name)),
  ...projects.filter(p => !isDefaultOrganizationProject(p)).sort((a, b) => a.name.localeCompare(b.name)),
];

export async function updateLocalProjectToRemote({
  project,
  vcs,
  sessionId,
  organizationId,
}: {
  project: Project;
  vcs: VCS;
  sessionId: string;
  organizationId: string;
}) {
  try {
    const newCloudProject = await createTeamProject({
      sessionId,
      organizationId,
      name: project.name,
    });
    const updatedProject = await updateProject(project, { name: newCloudProject.name, remoteId: newCloudProject.id });

    // For each workspace in the local project
    const projectWorkspaces = await database.find<Workspace>('Workspace', {
      parentId: updatedProject._id,
    });

    for (const workspace of projectWorkspaces) {
      const workspaceMeta = await getOrCreateWorkspaceMeta(workspace._id);

      // Initialize Sync on the workspace if it's not using Git sync
      try {
        if (!workspaceMeta.gitRepositoryId) {
          invariant(vcs, 'VCS must be initialized');

          await initializeLocalBackendProjectAndMarkForSync({ vcs, workspace });
          await pushSnapshotOnInitialize({ vcs, workspace, project: updatedProject });
        }
      } catch (e) {
        console.warn(
          'Failed to initialize sync on workspace. This will be retried when the workspace is opened on the app.',
          e,
        );
        // TODO: here we should show the try again dialog
      }
    }
  } catch (error: unknown) {
    if (isApiError(error)) {
      let errorMessage = 'An unexpected error occurred while connecting the project. Please try again.';
      if (error.name === 'FORBIDDEN' || error.name === 'NEEDS_TO_UPGRADE') {
        errorMessage = error.message;
      }
      return {
        error: errorMessage,
      };
    }
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }

  return {
    error: null,
  };
}
