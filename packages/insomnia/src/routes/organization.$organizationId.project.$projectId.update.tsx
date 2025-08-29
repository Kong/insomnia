import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import { database } from '~/common/database';
import { projectLock } from '~/common/project';
import * as models from '~/models';
import type { OauthProviderName } from '~/models/git-credentials';
import type { GitCredentials } from '~/models/git-repository';
import { EMPTY_GIT_PROJECT_ID } from '~/models/project';
import type { WorkspaceMeta } from '~/models/workspace-meta';
import { SegmentEvent } from '~/ui/analytics';
import { insomniaFetch } from '~/ui/insomniaFetch';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.update';

interface UpdateProjectInputData {
  name: string;
  storageType: 'local' | 'remote' | 'git';
  authorName?: string;
  authorEmail?: string;
  uri?: string;
  ref?: string;
  username?: string;
  password?: string;
  token?: string;
  oauth2format?: OauthProviderName;
  connectRepositoryLater?: boolean;
}

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { name, storageType, ...projectData } = (await request.json()) as UpdateProjectInputData;

  invariant(typeof name === 'string', 'Name is required');
  invariant(storageType === 'local' || storageType === 'remote' || storageType === 'git', 'Project type is required');

  const { organizationId, projectId } = params;

  const project = await models.project.getById(projectId);
  invariant(project, 'Project not found');

  const user = await models.userSession.getOrCreate();
  const sessionId = user.id;

  try {
    await projectLock.lock();
    // If its a cloud project, and we are renaming, then patch
    if (sessionId && project.remoteId && storageType === 'remote' && name !== project.name) {
      const response = await insomniaFetch<void | {
        error: string;
        message?: string;
      }>({
        path: `/v1/organizations/${project.parentId}/team-projects/${project.remoteId}`,
        method: 'PATCH',
        sessionId,
        data: {
          name,
        },
      });

      if (response && 'error' in response) {
        let error = 'An unexpected error occurred while updating your project. Please try again.';
        if (response.error === 'FORBIDDEN') {
          error = 'You do not have permission to create a cloud project in this organization.';
        }

        if (response.error === 'NEEDS_TO_UPGRADE') {
          error = 'Upgrade your account in order to create new Cloud Projects.';
        }

        if (response.error === 'PROJECT_STORAGE_RESTRICTION') {
          error = 'The owner of the organization allows only Local Vault project creation, please try again.';
        }

        return {
          error,
        };
      }

      await models.project.update(project, { name });
      return {
        success: true,
      };
    }

    // convert from cloud to local
    if (storageType === 'local' && project.remoteId) {
      const response = await insomniaFetch<void | {
        error: string;
        message?: string;
      }>({
        path: `/v1/organizations/${organizationId}/team-projects/${project.remoteId}`,
        method: 'DELETE',
        sessionId,
      });

      if (response && !response.error) {
        window.main.trackSegmentEvent({
          event: SegmentEvent.projectUpdated,
          properties: {
            storage: 'local',
          },
        });
      }

      if (response && 'error' in response) {
        let error = 'An unexpected error occurred while updating your project. Please try again.';

        if (response.error === 'FORBIDDEN') {
          error = 'You do not have permission to change this project.';
        }

        if (response.error === 'PROJECT_STORAGE_RESTRICTION') {
          error = 'The owner of the organization allows only Cloud Sync project creation, please try again.';
        }

        return {
          error,
        };
      }

      await models.project.update(project, { name, remoteId: null });
      return {
        success: true,
      };
    }
    // convert from local/git to cloud
    if (storageType === 'remote' && !project.remoteId) {
      const newCloudProject = await insomniaFetch<
        | {
            id: string;
            name: string;
          }
        | {
            error: string;
            message?: string;
          }
      >({
        path: `/v1/organizations/${organizationId}/team-projects`,
        method: 'POST',
        data: {
          name,
        },
        sessionId,
      });

      if (newCloudProject && !('error' in newCloudProject)) {
        window.main.trackSegmentEvent({
          event: SegmentEvent.projectUpdated,
          properties: {
            storage: 'remote',
          },
        });
      }

      if (!newCloudProject || 'error' in newCloudProject) {
        let error = 'An unexpected error occurred while updating your project. Please try again.';
        if (newCloudProject.error === 'FORBIDDEN') {
          error = newCloudProject.error;
        }

        if (newCloudProject.error === 'NEEDS_TO_UPGRADE') {
          error = 'Upgrade your account in order to create new Cloud Projects.';
        }

        if (newCloudProject.error === 'PROJECT_STORAGE_RESTRICTION') {
          error = 'The owner of the organization allows only Local Vault project creation, please try again.';
        }

        return {
          error,
        };
      }

      if (project.gitRepositoryId) {
        const gitRepository = await models.gitRepository.getById(project.gitRepositoryId);

        gitRepository && (await models.gitRepository.remove(gitRepository));
      }

      await models.project.update(project, { name, remoteId: newCloudProject.id, gitRepositoryId: null });
      return {
        success: true,
      };
    }

    // convert to git
    if (storageType === 'git' && !project.gitRepositoryId) {
      if (project.remoteId) {
        const response = await insomniaFetch<void | {
          error: string;
          message?: string;
        }>({
          path: `/v1/organizations/${organizationId}/team-projects/${project.remoteId}`,
          method: 'DELETE',
          sessionId,
        });

        if (response && !response.error) {
          window.main.trackSegmentEvent({
            event: SegmentEvent.projectUpdated,
            properties: {
              storage: 'git',
            },
          });
        }

        if (response && 'error' in response) {
          let error = 'An unexpected error occurred while updating your project. Please try again.';

          if (response.error === 'FORBIDDEN') {
            error = 'You do not have permission to change this project.';
          }

          if (response.error === 'PROJECT_STORAGE_RESTRICTION') {
            error = 'The owner of the organization allows only Cloud Sync project creation, please try again.';
          }

          return {
            error,
          };
        }
      }

      if (projectData.connectRepositoryLater) {
        await models.project.update(project, { name, gitRepositoryId: EMPTY_GIT_PROJECT_ID });
      } else {
        let credentials: GitCredentials | undefined = undefined;
        if (projectData.oauth2format) {
          credentials = {
            oauth2format: projectData.oauth2format,
            token: projectData.token ?? '',
            username: projectData.username ?? '',
          };
        } else if (projectData.username && projectData.password) {
          credentials = {
            username: projectData.username,
            password: projectData.password,
          };
        }

        const { errors } = await window.main.git.cloneGitRepo({
          organizationId,
          cloneIntoProjectId: project._id,
          author: {
            name: projectData.authorName ?? '',
            email: projectData.authorEmail ?? '',
          },
          uri: projectData.uri ?? '',
          credentials: credentials || {
            username: '',
            password: '',
          },
          ref: projectData.ref,
          name,
        });

        const projectWorkspaces = await models.workspace.findByParentId(project._id);
        const bufferId = await database.bufferChanges();
        const workspaceMetas = await database.find<WorkspaceMeta>(models.workspaceMeta.type, {
          parentId: { $in: projectWorkspaces.map(w => w._id) },
        });

        for (const workspaceMeta of workspaceMetas) {
          if (!workspaceMeta.gitFilePath) {
            await models.workspaceMeta.update(workspaceMeta, {
              gitFilePath: `insomnia.${workspaceMeta.parentId}.yaml`,
            });
          }
        }

        await database.flushChanges(bufferId);

        if (errors) {
          return {
            error: errors.join(', '),
          };
        }
      }

      return {
        success: true,
      };
    }

    // convert from git to local
    if (storageType === 'local' && project.gitRepositoryId) {
      const gitRepository = await models.gitRepository.getById(project.gitRepositoryId);

      gitRepository && (await models.gitRepository.remove(gitRepository));
      await models.project.update(project, { name, gitRepositoryId: null });

      return {
        success: true,
      };
    }

    // local project rename
    await models.project.update(project, { name });

    window.main.trackSegmentEvent({
      event: SegmentEvent.projectUpdated,
      properties: {
        storage: 'local',
      },
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

export function useProjectUpdateActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
    ({
      organizationId,
      projectId,
      projectData,
    }: {
      organizationId: string;
      projectId: string;
      projectData: UpdateProjectInputData;
    }) => {
      return fetcherSubmit(JSON.stringify(projectData), {
        method: 'POST',
        action: href('/organization/:organizationId/project/:projectId/update', {
          organizationId,
          projectId,
        }),
        encType: 'application/json',
      });
    },
    [fetcherSubmit],
  );

  return {
    ...fetcherRest,
    submit,
  };
}
