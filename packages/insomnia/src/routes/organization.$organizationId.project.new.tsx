import { href, redirect } from 'react-router';

import { database } from '~/common/database';
import { isNotNullOrUndefined } from '~/common/misc';
import { projectLock } from '~/common/project';
import * as models from '~/models';
import type { GitCredentials, OauthProviderName } from '~/models/git-repository';
import { EMPTY_GIT_PROJECT_ID, type Project } from '~/models/project';
import { SegmentEvent } from '~/ui/analytics';
import { insomniaFetch } from '~/ui/insomnia-fetch';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.new';

export interface CreateProjectActionResult {
  id?: string;
  error?: string;
}

export interface CreateProjectData {
  name: string;
  storageType: 'local' | 'remote' | 'git';
  authorName?: string;
  authorEmail?: string;
  uri?: string;
  username?: string;
  password?: string;
  token?: string;
  oauth2format?: OauthProviderName;
  connectRepositoryLater?: boolean;
  ref?: string;
}

export const reportGitProjectCount = async (organizationId: string, sessionId: string, maxRetries = 3) => {
  const projects = await database.find<Project>(models.project.type, {
    parentId: organizationId,
  });
  const gitRepositoryIds = projects.map(p => p.gitRepositoryId).filter(isNotNullOrUndefined);
  const gitProjectsCount = gitRepositoryIds.length;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await insomniaFetch({
        method: 'PATCH',
        path: `/v1/organizations/${organizationId}/git-projects`,
        sessionId,
        onlyResolveOnSuccess: true,
        data: {
          count: gitProjectsCount,
        },
      });
      return;
    } catch {
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  console.warn('Report git project count failed');
};

export const createProject = async (organizationId: string, newProjectData: CreateProjectData) => {
  const createProjectImpl = async (organizationId: string, newProjectData: CreateProjectData) => {
    const user = await models.userSession.getOrCreate();
    const sessionId = user.id;
    invariant(sessionId, 'User must be logged in to create a project');

    if (newProjectData.storageType === 'local') {
      const project = await models.project.create({
        name: newProjectData.name,
        parentId: organizationId,
      });

      return project._id;
    }

    if (newProjectData.storageType === 'git') {
      if (newProjectData.connectRepositoryLater) {
        const project = await models.project.create({
          name: newProjectData.name,
          parentId: organizationId,
          gitRepositoryId: EMPTY_GIT_PROJECT_ID,
        });
        reportGitProjectCount(organizationId, sessionId);

        return project._id;
      }

      let credentials: GitCredentials | undefined;
      if (newProjectData.oauth2format === 'custom') {
        credentials = {
          username: newProjectData.username || '',
          password: newProjectData.token || '',
        };
      } else if (newProjectData.oauth2format) {
        credentials = {
          oauth2format: newProjectData.oauth2format,
          token: newProjectData.token || '',
          username: newProjectData.username || '',
        };
      } else if (newProjectData.username && newProjectData.password) {
        credentials = {
          username: newProjectData.username,
          password: newProjectData.password,
        };
      }

      const { projectId, errors } = await window.main.git.cloneGitRepo({
        organizationId,
        uri: newProjectData.uri || '',
        author: {
          name: newProjectData.authorName || '',
          email: newProjectData.authorEmail || '',
        },
        name: newProjectData.name,
        credentials: credentials || {
          username: '',
          password: '',
        },
        ref: newProjectData.ref || '',
      });

      if (errors) {
        throw new Error(errors.join(', '));
      }
      reportGitProjectCount(organizationId, sessionId);

      return projectId;
    }

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
        name: newProjectData.name,
      },
      sessionId,
    });

    if (!newCloudProject || 'error' in newCloudProject) {
      let error = 'An unexpected error occurred while creating the project. Please try again.';
      if (newCloudProject.error === 'FORBIDDEN') {
        error = 'You do not have permission to create a cloud project in this organization.';
      }

      if (newCloudProject.error === 'NEEDS_TO_UPGRADE') {
        error = 'Upgrade your account in order to create new Cloud Projects.';
      }

      if (newCloudProject.error === 'PROJECT_STORAGE_RESTRICTION') {
        error = newCloudProject.message ?? 'The owner of the organization allows only Local Vault project creation.';
      }

      throw new Error(error);
    }

    const project = await models.project.create({
      _id: newCloudProject.id,
      name: newCloudProject.name,
      remoteId: newCloudProject.id,
      parentId: organizationId,
    });

    return project._id;
  };

  const newProjectId = await projectLock.wrapWithLock(createProjectImpl)(organizationId, newProjectData);
  window.main.trackSegmentEvent({
    event: SegmentEvent.projectCreated,
    properties: {
      storage: newProjectData.storageType,
    },
  });

  return newProjectId;
};

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { organizationId } = params;

  invariant(organizationId, 'Organization ID is required');
  const newProjectData = (await request.json()) as CreateProjectData;

  try {
    const newProjectId = await createProject(organizationId, newProjectData);
    return redirect(`/organization/${organizationId}/project/${newProjectId}`);
  } catch (err) {
    console.log(err);

    return {
      error:
        err instanceof Error
          ? err.message
          : `An unexpected error occurred while creating the project. Please try again. ${err}`,
    };
  }
}

export const useProjectNewActionFetcher = createFetcherSubmitHook(
  submit =>
    ({ organizationId, projectData }: { organizationId: string; projectData: CreateProjectData }) => {
      return submit(JSON.stringify(projectData), {
        method: 'POST',
        action: href('/organization/:organizationId/project/new', {
          organizationId,
        }),
        encType: 'application/json',
      });
    },
  clientAction,
);
