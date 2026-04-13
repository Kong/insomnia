import { createTeamProject, isApiError } from 'insomnia-api';

import type { Project, Workspace } from '~/insomnia-data';
import { database as db, models } from '~/insomnia-data';

import {
  initializeLocalBackendProjectAndMarkForSync,
  pushSnapshotOnInitialize,
} from '../../../sync/vcs/initialize-backend-project';
import type { VCS } from '../../../sync/vcs/vcs';
import { invariant } from '../../../utils/invariant';
import * as workspaceMetaService from './workspace-meta';

const { type } = models.project;

export function create(patch: Partial<Project> = {}) {
  return db.docCreate<Project>(type, patch);
}

export function getById(_id: string) {
  return db.findOne<Project>(type, { _id });
}

export function getByRemoteId(remoteId: string) {
  return db.findOne<Project>(type, { remoteId });
}

export function getAllByGitRepositoryIds(gitRepositoryIds: string[]) {
  return db.find<Project>(type, {
    gitRepositoryId: { $in: gitRepositoryIds },
  });
}

export function remove(project: Project) {
  return db.remove(project);
}

export function update(project: Project, patch: Partial<Project>) {
  return db.docUpdate(project, patch);
}

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
    const updatedProject = await update(project, {
      name: newCloudProject.name,
      remoteId: newCloudProject.id,
    });

    const projectWorkspaces = await db.find<Workspace>(models.workspace.type, {
      parentId: updatedProject._id,
    });

    for (const workspace of projectWorkspaces) {
      const workspaceMeta = await workspaceMetaService.getOrCreateByParentId(workspace._id);

      try {
        if (!workspaceMeta.gitRepositoryId) {
          invariant(vcs, 'VCS must be initialized');

          await initializeLocalBackendProjectAndMarkForSync({ vcs, workspace });
          await pushSnapshotOnInitialize({ vcs, workspace, project: updatedProject });
        }
      } catch (error) {
        console.warn(
          'Failed to initialize sync on workspace. This will be retried when the workspace is opened on the app.',
          error,
        );
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

export async function all() {
  const projects = await db.find<Project>(type);
  return projects;
}
