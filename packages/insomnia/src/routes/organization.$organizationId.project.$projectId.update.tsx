import path from 'node:path';

import { createTeamProject, deleteTeamProject, isApiError, updateTeamProject } from 'insomnia-api';
import { href } from 'react-router';

import { database } from '~/common/database';
import { getInsomniaV5DataExport } from '~/common/insomnia-v5';
import { projectLock } from '~/common/project';
import { services } from '~/insomnia-data';
import * as models from '~/models';
import { EMPTY_GIT_PROJECT_ID, isDirectoryProject, type ProjectStorageType } from '~/models/project';
import type { WorkspaceMeta } from '~/models/workspace-meta';
import { reportGitProjectCount } from '~/routes/organization.$organizationId.project.new';
import { SegmentEvent } from '~/ui/analytics';
import { showToast } from '~/ui/components/toast-notification';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.update';

interface UpdateProjectInputData {
  name: string;
  storageType: ProjectStorageType;
  directoryPath?: string;
  credentialsId?: string | null;
  uri?: string;
  ref?: string;
  connectRepositoryLater?: boolean;
  selectedAuthorEmail?: string | null;
}

const getProjectWorkspaceData = async (projectId: string) => {
  const workspaces = await models.workspace.findByParentId(projectId);
  const workspaceMetas = await database.find<WorkspaceMeta>(models.workspaceMeta.type, {
    parentId: {
      $in: workspaces.map(workspace => workspace._id),
    },
  });

  return {
    workspaces,
    workspaceMetas: new Map(workspaceMetas.map(workspaceMeta => [workspaceMeta.parentId, workspaceMeta])),
  };
};

const exportProjectToDirectory = async (projectId: string, directoryPath: string) => {
  const { workspaces, workspaceMetas } = await getProjectWorkspaceData(projectId);

  for (const workspace of workspaces) {
    const workspaceMeta =
      workspaceMetas.get(workspace._id) || (await models.workspaceMeta.getOrCreateByParentId(workspace._id));
    const fileName = path.basename(workspaceMeta.gitFilePath || `insomnia.${workspace._id}.yaml`);
    const filePath = path.join(directoryPath, fileName);
    const content = await getInsomniaV5DataExport({
      workspaceId: workspace._id,
      includePrivateEnvironments: true,
    });

    await window.main.writeFile({
      path: filePath,
      content,
    });

    await models.workspaceMeta.update(workspaceMeta, {
      gitFilePath: filePath,
    });
  }
};

const clearProjectWorkspaceFilePaths = async (projectId: string) => {
  const { workspaceMetas } = await getProjectWorkspaceData(projectId);

  for (const workspaceMeta of workspaceMetas.values()) {
    if (!workspaceMeta.gitFilePath) {
      continue;
    }

    await models.workspaceMeta.update(workspaceMeta, {
      gitFilePath: null,
    });
  }
};

const setProjectGitWorkspaceFilePaths = async (projectId: string) => {
  const { workspaceMetas } = await getProjectWorkspaceData(projectId);

  for (const workspaceMeta of workspaceMetas.values()) {
    await models.workspaceMeta.update(workspaceMeta, {
      gitFilePath: `insomnia.${workspaceMeta.parentId}.yaml`,
    });
  }
};

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const {
    name,
    storageType,
    selectedAuthorEmail = null,
    ...projectData
  } = (await request.json()) as UpdateProjectInputData;

  invariant(typeof name === 'string', 'Name is required');
  invariant(
    storageType === 'local' || storageType === 'directory' || storageType === 'remote' || storageType === 'git',
    'Project type is required',
  );

  const { organizationId, projectId } = params;

  const project = await models.project.getById(projectId);
  invariant(project, 'Project not found');

  const gitRepository = project.gitRepositoryId ? await services.gitRepository.getById(project.gitRepositoryId) : null;

  const user = await services.userSession.getOrCreate();
  const sessionId = user.id;

  try {
    await projectLock.lock();
    if (storageType === 'directory') {
      invariant(projectData.directoryPath, 'Directory path is required for Local Directory projects');

      if (project.remoteId) {
        try {
          await deleteTeamProject({
            organizationId,
            projectRemoteId: project.remoteId,
            sessionId,
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

      if (project.gitRepositoryId) {
        const existingGitRepository = await services.gitRepository.getById(project.gitRepositoryId);

        existingGitRepository && (await services.gitRepository.remove(existingGitRepository));
        reportGitProjectCount(organizationId, sessionId);
      }

      await models.project.update(project, {
        name,
        remoteId: null,
        gitRepositoryId: null,
        directoryPath: projectData.directoryPath,
      });

      await exportProjectToDirectory(project._id, projectData.directoryPath);

      window.main.trackSegmentEvent({
        event: SegmentEvent.projectUpdated,
        properties: {
          storage: 'directory',
        },
      });

      showToast({
        title: 'Project updated',
        status: 'success',
      });

      return {
        success: true,
      };
    }

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

      await models.project.update(project, { name, directoryPath: null });

      showToast({
        title: 'Project updated',
        status: 'success',
      });

      return {
        success: true,
      };
    }

    if (storageType === 'local' && isDirectoryProject(project)) {
      await models.project.update(project, {
        name,
        directoryPath: null,
      });
      await clearProjectWorkspaceFilePaths(project._id);

      window.main.trackSegmentEvent({
        event: SegmentEvent.projectUpdated,
        properties: {
          storage: 'local',
        },
      });

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

        window.main.trackSegmentEvent({
          event: SegmentEvent.projectUpdated,
          properties: {
            storage: 'local',
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

      await models.project.update(project, { name, remoteId: null, directoryPath: null });

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

        window.main.trackSegmentEvent({
          event: SegmentEvent.projectUpdated,
          properties: {
            storage: 'remote',
          },
        });

        if (project.gitRepositoryId) {
          const gitRepository = await services.gitRepository.getById(project.gitRepositoryId);

          gitRepository && (await services.gitRepository.remove(gitRepository));
        }

        await clearProjectWorkspaceFilePaths(project._id);

        await models.project.update(project, {
          name,
          remoteId: newCloudProject.id,
          gitRepositoryId: null,
          directoryPath: null,
        });

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

          window.main.trackSegmentEvent({
            event: SegmentEvent.projectUpdated,
            properties: {
              storage: 'git',
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

      if (projectData.connectRepositoryLater) {
        await models.project.update(project, {
          name,
          gitRepositoryId: EMPTY_GIT_PROJECT_ID,
          directoryPath: null,
        });
        await setProjectGitWorkspaceFilePaths(project._id);
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

        const projectWorkspaces = await models.workspace.findByParentId(project._id);
        const bufferId = await database.bufferChanges();
        const workspaceMetas = await database.find<WorkspaceMeta>(models.workspaceMeta.type, {
          parentId: { $in: projectWorkspaces.map(w => w._id) },
        });

        for (const workspaceMeta of workspaceMetas) {
          if (isDirectoryProject(project) || !workspaceMeta.gitFilePath) {
            await models.workspaceMeta.update(workspaceMeta, {
              gitFilePath: `insomnia.${workspaceMeta.parentId}.yaml`,
            });
          }
        }

        await models.project.update(project, { name, directoryPath: null });

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
      (project.gitRepositoryId === EMPTY_GIT_PROJECT_ID || !gitRepository?.credentialsId) &&
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
      const gitRepository = await services.gitRepository.getById(project.gitRepositoryId);

      gitRepository && (await services.gitRepository.remove(gitRepository));
      await models.project.update(project, { name, gitRepositoryId: null, directoryPath: null });

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
        await models.project.update(project, { name, directoryPath: null });
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
    await models.project.update(project, { name, directoryPath: null });

    window.main.trackSegmentEvent({
      event: SegmentEvent.projectUpdated,
      properties: {
        storage: 'local',
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
