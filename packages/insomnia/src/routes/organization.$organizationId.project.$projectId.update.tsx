import { createTeamProject, deleteTeamProject, isApiError, updateTeamProject } from 'insomnia-api';
import { models, services, type Workspace } from 'insomnia-data';
import { href } from 'react-router';

import { database } from '~/common/database';
import { projectLock, regenerateProjectDocIds } from '~/common/project';
import { invariant } from '~/common/utils/invariant';
import { reportGitProjectCount } from '~/routes/organization.$organizationId.project.new';
import { initializeLocalBackendProjectAndMarkForSync, pushSnapshotOnInitialize } from '~/sync/vcs/initialize-backend-project';
import { AnalyticsEvent } from '~/ui/analytics';
import { showToast } from '~/ui/components/toast-notification';
import { syncVCSLikeForWorkspace } from '~/ui/sync-utils';
import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.update';

interface UpdateProjectInputData {
  name: string;
  storageType: 'local' | 'remote' | 'git';
  credentialsId?: string | null;
  uri?: string;
  ref?: string;
  connectRepositoryLater?: boolean;
  selectedAuthorEmail?: string | null;
}

/**
 * Clear stale workspace-level git state (legacy workspace git sync wrote
 * gitRepositoryId; project-scoped git wrote gitFilePath) after a project leaves
 * git storage, so cards stop showing git status and cloud sync initialization
 * is not skipped. Returns the project's workspaces for further processing.
 */
async function clearWorkspaceGitState(projectId: string): Promise<Workspace[]> {
  const projectWorkspaces = await services.workspace.listByParentId(projectId);
  for (const workspace of projectWorkspaces) {
    const workspaceMeta = await services.workspaceMeta.getOrCreateByParentId(workspace._id);
    await services.workspaceMeta.update(workspaceMeta, {
      gitRepositoryId: null,
      gitFilePath: null,
      gitFileLastSyncTime: null,
      hasUncommittedChanges: false,
      hasUnpushedChanges: false,
    });
  }
  return projectWorkspaces;
}

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const {
    name,
    storageType,
    selectedAuthorEmail = null,
    ...projectData
  } = (await request.json()) as UpdateProjectInputData;

  invariant(typeof name === 'string', 'Name is required');
  invariant(storageType === 'local' || storageType === 'remote' || storageType === 'git', 'Project type is required');

  const { organizationId, projectId } = params;

  invariant(
    storageType === 'local' || !models.organization.isLocalOrganizationId(organizationId),
    'Projects in this organization can only be stored locally',
  );

  const project = await services.project.getById(projectId);
  invariant(project, 'Project not found');

  const effectiveRepoId = models.project.isGitProject(project) ? models.project.getEffectiveRepoId(project) : null;
  const gitRepository = effectiveRepoId ? await services.gitRepository.getById(effectiveRepoId) : null;

  const user = await services.userSession.get();
  const sessionId = user.id;

  try {
    await projectLock.lock();
    // If its a cloud project, and we are renaming, then patch
    if (sessionId && project.remoteId && storageType === 'remote' && name !== project.name) {
      try {
        await updateTeamProject({
          organizationId: project.parentId,
          projectRemoteId: project.remoteId,
          sessionId,
          name,
        });
      } catch (error: unknown) {
        if (isApiError(error)) {
          let errorMessage = 'An unexpected error occurred while updating your project. Please try again.';
          if (error.name === 'FORBIDDEN') {
            errorMessage = 'You do not have permission to create a cloud project in this organization.';
          }

          if (error.name === 'NEEDS_TO_UPGRADE') {
            errorMessage = 'Upgrade your account in order to create new Cloud Projects.';
          }

          if (error.name === 'PROJECT_STORAGE_RESTRICTION') {
            errorMessage = 'The owner of the organization allows only Local Vault project creation, please try again.';
          }

          showToast({
            title: 'Error updating project',
            description: errorMessage,
            icon: 'warning',
            status: 'error',
          });

          return {
            error: errorMessage,
          };
        }
        throw error;
      }

      await services.project.update(project, { name });

      showToast({
        title: 'Project updated',
        status: 'success',
      });

      return {
        success: true,
      };
    }

    // convert from cloud to local
    if (storageType === 'local' && project.remoteId) {
      try {
        await deleteTeamProject({
          organizationId,
          projectRemoteId: project.remoteId,
          sessionId,
        });

        window.main.trackAnalyticsEvent({
          event: AnalyticsEvent.projectUpdated,
          properties: {
            storage: 'local',
            project_id: project._id,
          },
        });
      } catch (error: unknown) {
        if (isApiError(error)) {
          let errorMessage = 'An unexpected error occurred while updating your project. Please try again.';

          if (error.name === 'FORBIDDEN') {
            errorMessage = 'You do not have permission to change this project.';
          }

          if (error.name === 'PROJECT_STORAGE_RESTRICTION') {
            errorMessage = 'The owner of the organization allows only Cloud Sync project creation, please try again.';
          }

          showToast({
            title: 'Error updating project',
            description: errorMessage,
            icon: 'warning',
            status: 'error',
          });

          return {
            error: errorMessage,
          };
        }
        throw error;
      }

      // Re-key docs so ids owned by the previous storage cannot be hijacked by a later re-import.
      await regenerateProjectDocIds(project);

      await services.project.update(project, { name, remoteId: null });

      showToast({
        title: 'Project updated',
        status: 'success',
      });

      return {
        success: true,
      };
    }
    // convert from local/git to cloud
    if (storageType === 'remote' && !project.remoteId) {
      try {
        const newCloudProject = await createTeamProject({
          sessionId,
          organizationId,
          name,
        });

        window.main.trackAnalyticsEvent({
          event: AnalyticsEvent.projectUpdated,
          properties: {
            storage: 'remote',
            project_id: project._id,
          },
        });

        if (models.project.isConnectedGitProject(project)) {
          const gitRepository = await services.gitRepository.getById(models.project.getEffectiveRepoId(project) || '');

          if (gitRepository) {
            // Stop the FS watcher and clean up the managed repo folder before touching
            // DB docs — an active watcher would flush the re-keyed docs back into the
            // repo files. User-chosen folders are left untouched.
            await window.main.git.cleanupGitRepoStorage({ gitRepositoryId: gitRepository._id });
            await services.gitRepository.remove(gitRepository);
          }
        }

        // Re-key docs so ids owned by the previous storage cannot be hijacked by a later re-import.
        await regenerateProjectDocIds(project);

        const updatedProject = await services.project.update(project, { name, remoteId: newCloudProject.id, gitRepositoryId: null });

        if (models.project.isGitProject(project)) {
          const projectWorkspaces = await clearWorkspaceGitState(project._id);

          for (const workspace of projectWorkspaces) {
            try {
              const vcs = syncVCSLikeForWorkspace(workspace._id);
              await initializeLocalBackendProjectAndMarkForSync({ vcs, workspace });
              await pushSnapshotOnInitialize({ vcs, workspace, project: updatedProject });
            } catch (e) {
              console.warn(
                'Failed to initialize sync on workspace. This will be retried when the workspace is opened on the app.',
                e,
              );
            }
          }
        }

        project.gitRepositoryId && reportGitProjectCount(organizationId, sessionId);

        showToast({
          title: 'Project updated',
          status: 'success',
        });

        return {
          success: true,
        };
      } catch (error: unknown) {
        if (isApiError(error)) {
          let errorMessage = 'An unexpected error occurred while updating your project. Please try again.';
          if (error.name === 'FORBIDDEN') {
            errorMessage = error.message;
          }

          if (error.name === 'NEEDS_TO_UPGRADE') {
            errorMessage = 'Upgrade your account in order to create new Cloud Projects.';
          }
          if (error.name === 'PROJECT_STORAGE_RESTRICTION') {
            errorMessage = 'The owner of the organization allows only Local Vault project creation, please try again.';
          }

          showToast({
            title: 'Error updating project',
            description: errorMessage,
            icon: 'warning',
            status: 'error',
          });

          return {
            error: errorMessage,
          };
        }
        throw error;
      }
    }

    // convert to git
    if (storageType === 'git' && !project.gitRepositoryId) {
      if (project.remoteId) {
        try {
          await deleteTeamProject({
            organizationId,
            projectRemoteId: project.remoteId,
            sessionId,
          });

          window.main.trackAnalyticsEvent({
            event: AnalyticsEvent.projectUpdated,
            properties: {
              storage: 'git',
              project_id: project._id,
            },
          });
        } catch (error: unknown) {
          if (isApiError(error)) {
            let errorMessage = 'An unexpected error occurred while updating your project. Please try again.';
            if (error.name === 'FORBIDDEN') {
              errorMessage = 'You do not have permission to change this project.';
            }

            if (error.name === 'PROJECT_STORAGE_RESTRICTION') {
              errorMessage = 'The owner of the organization allows only Cloud Sync project creation, please try again.';
            }

            showToast({
              title: 'Error updating project',
              description: errorMessage,
              icon: 'warning',
              status: 'error',
            });

            return {
              error: errorMessage,
            };
          }
          throw error;
        }
      }

      // Re-key docs so ids owned by the previous storage cannot be hijacked by a later re-import.
      await regenerateProjectDocIds(project);

      if (projectData.connectRepositoryLater) {
        await services.project.update(project, { name, gitRepositoryId: models.project.EMPTY_GIT_PROJECT_ID });
      } else {
        invariant(projectData.credentialsId, 'Credentials ID is required to clone git repository');
        const { errors } = await window.main.git.cloneGitRepo({
          organizationId,
          cloneIntoProjectId: project._id,
          uri: projectData.uri ?? '',
          credentialsId: projectData.credentialsId,
          ref: projectData.ref,
          name,
          selectedAuthorEmail,
        });

        const projectWorkspaces = await services.workspace.listByParentId(project._id);
        const bufferId = await database.bufferChanges();
        const workspaceMetas = await services.workspaceMeta.list({
          parentId: { $in: projectWorkspaces.map(w => w._id) },
        });

        for (const workspaceMeta of workspaceMetas) {
          if (!workspaceMeta.gitFilePath) {
            await services.workspaceMeta.update(workspaceMeta, {
              gitFilePath: `insomnia.${workspaceMeta.parentId}.yaml`,
            });
          }
        }

        await database.flushChanges(bufferId);

        if (errors) {
          showToast({
            title: 'Error updating project',
            description: errors.join(', '),
            icon: 'warning',
            status: 'error',
          });

          return {
            error: errors.join(', '),
          };
        }
      }

      reportGitProjectCount(organizationId, sessionId);

      showToast({
        title: 'Project updated',
        status: 'success',
      });

      return {
        success: true,
      };
    }

    // connect to git repo
    if (
      storageType === 'git' &&
      (project.gitRepositoryId === models.project.EMPTY_GIT_PROJECT_ID || !gitRepository?.credentialsId) &&
      !projectData.connectRepositoryLater
    ) {
      invariant(projectData.credentialsId, 'Credentials ID is required to clone git repository');
      await window.main.git.updateGitRepo({
        projectId: project._id,
        uri: projectData.uri ?? '',
        credentialsId: projectData.credentialsId,
        ref: projectData.ref,
        selectedAuthorEmail,
      });

      showToast({
        title: 'Project updated',
        status: 'success',
      });

      return {
        success: true,
      };
    }

    // convert from git to local
    if (storageType === 'local' && project.gitRepositoryId) {
      const effectiveId = models.project.isGitProject(project) ? models.project.getEffectiveRepoId(project) : null;
      const gitRepository = effectiveId ? await services.gitRepository.getById(effectiveId) : null;

      if (gitRepository) {
        // Stop the watcher and delete the folder only if Insomnia owns it; a
        // user-chosen folder stays on disk.
        await window.main.git.cleanupGitRepoStorage({ gitRepositoryId: gitRepository._id });
        await services.gitRepository.remove(gitRepository);
      }

      await regenerateProjectDocIds(project);
      await clearWorkspaceGitState(project._id);

      await services.project.update(project, { name, gitRepositoryId: null });

      reportGitProjectCount(organizationId, sessionId);

      showToast({
        title: 'Project updated',
        status: 'success',
      });

      return {
        success: true,
      };
    }

    // update existing git repository settings (author email override)
    if (storageType === 'git' && gitRepository?.credentialsId) {
      services.gitRepository.update(gitRepository, { selectedAuthorEmail });

      if (name !== project.name) {
        await services.project.update(project, { name });
      }

      showToast({
        title: 'Project updated',
        status: 'success',
      });

      return {
        success: true,
      };
    }

    // local project rename
    await services.project.update(project, { name });

    window.main.trackAnalyticsEvent({
      event: AnalyticsEvent.projectUpdated,
      properties: {
        storage: 'local',
        project_id: project._id,
      },
    });

    showToast({
      title: 'Project updated',
      status: 'success',
    });

    return {
      success: true,
    };
  } catch (err) {
    console.log(err);
    return {
      error:
        err instanceof Error
          ? err.message
          : `An unexpected error occurred while renaming the project. Please try again. ${err}`,
    };
  } finally {
    await projectLock.unlock();
  }
}

export const useProjectUpdateActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      projectData,
    }: {
      organizationId: string;
      projectId: string;
      projectData: UpdateProjectInputData;
    }) => {
      return submit(JSON.stringify(projectData), {
        method: 'POST',
        action: href('/organization/:organizationId/project/:projectId/update', {
          organizationId,
          projectId,
        }),
        encType: 'application/json',
      });
    },
  clientAction,
);
