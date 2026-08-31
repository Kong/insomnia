import { createTeamProject, isApiError, type Organization } from 'insomnia-api';
import type { Project } from 'insomnia-data';
import { services } from 'insomnia-data';

import { invariant } from '~/common/utils/invariant';

// TODO: move vcs into services so we can remove this file.
import {
  initializeLocalBackendProjectAndMarkForSync,
  pushSnapshotOnInitialize,
  type SyncVCSLike,
} from '../sync/vcs/initialize-backend-project';
import {
  migrateProjectsIntoOrganization,
  shouldMigrateProjectUnderOrganization,
} from '../sync/vcs/migrate-projects-into-organization';

export async function updateLocalProjectToRemote({
  project,
  vcs,
  sessionId,
  organizationId,
}: {
  project: Project;
  vcs: SyncVCSLike;
  sessionId: string;
  organizationId: string;
}) {
  try {
    const newCloudProject = await createTeamProject({
      sessionId,
      organizationId,
      name: project.name,
    });
    const updatedProject = await services.project.update(project, {
      name: newCloudProject.name,
      remoteId: newCloudProject.id,
    });

    // For each workspace in the local project
    const projectWorkspaces = await services.workspace.listByParentId(updatedProject._id);

    for (const workspace of projectWorkspaces) {
      const workspaceMeta = await services.workspaceMeta.getOrCreateByParentId(workspace._id);

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

/**
 * Picks the space that orphaned legacy local projects (no parentId / no remoteId) should be
 * re-parented into: the user's solo space — an owned space with no other members. If none
 * qualifies (every owned space has collaborators), falls back to the first cached space so the
 * migration still runs.
 */
export function findMigrationTargetSpaceId(organizations: Organization[]): string {
  const soloSpace = organizations.find(o => o.is_owner && o.total_members === 1);
  return soloSpace?.id ?? organizations[0].id;
}

export async function migrateProjectsUnderOrganization(personalOrganizationId: string, sessionId: string) {
  if (await shouldMigrateProjectUnderOrganization()) {
    await migrateProjectsIntoOrganization({
      personalOrganizationId,
    });

    const preferredProjectType = localStorage.getItem('prefers-project-type');
    if (preferredProjectType === 'remote') {
      const localProjects = await services.project.list({
        parentId: personalOrganizationId,
        remoteId: null,
      });

      // If any of those fail projects will still be under the organization as local projects
      for (const project of localProjects) {
        updateLocalProjectToRemote({
          project,
          organizationId: personalOrganizationId,
          sessionId,
          vcs: window.main.sync,
        });
      }
    }
  }
}
