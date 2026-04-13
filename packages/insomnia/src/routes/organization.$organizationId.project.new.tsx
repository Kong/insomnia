import { createTeamProject, isApiError, updateGitProjectCount } from 'insomnia-api';
import { href, redirect } from 'react-router';

import { database } from '~/common/database';
import { isNotNullOrUndefined } from '~/common/misc';
import { projectLock } from '~/common/project';
import type { Project } from '~/insomnia-data';
import { models, services } from '~/insomnia-data';
import { SegmentEvent } from '~/ui/analytics';
import { showToast } from '~/ui/components/toast-notification';
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
  uri?: string;
  credentialsId?: string | null;
  connectRepositoryLater?: boolean;
  ref?: string;
  selectedAuthorEmail?: string | null;
}

export const reportGitProjectCount = async (organizationId: string, sessionId: string, maxRetries = 3) => {
  const projects = await database.find<Project>(models.project.type, {
    parentId: organizationId,
  });
  const gitRepositoryIds = projects.map(p => p.gitRepositoryId).filter(isNotNullOrUndefined);
  const gitProjectsCount = gitRepositoryIds.length;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await updateGitProjectCount({
        organizationId,
        sessionId,
        gitProjectsCount,
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

const createProjectImpl = async (organizationId: string, newProjectData: CreateProjectData) => {
  const user = await services.userSession.getOrCreate();
  const sessionId = user.id;
  invariant(sessionId, 'User must be logged in to create a project');

  if (newProjectData.storageType === 'local') {
    const project = await services.project.create({
      name: newProjectData.name,
      parentId: organizationId,
    });

    return project._id;
  }

  if (newProjectData.storageType === 'git') {
    if (newProjectData.connectRepositoryLater) {
      const project = await services.project.create({
        name: newProjectData.name,
        parentId: organizationId,
        gitRepositoryId: models.project.EMPTY_GIT_PROJECT_ID,
      });
      reportGitProjectCount(organizationId, sessionId);

      return project._id;
    }

    invariant(newProjectData.credentialsId, 'Credentials ID is required for Git project creation');
    const { projectId, errors } = await window.main.git.cloneGitRepo({
      organizationId,
      uri: newProjectData.uri || '',
      credentialsId: newProjectData.credentialsId,
      name: newProjectData.name,
      ref: newProjectData.ref || '',
      selectedAuthorEmail: newProjectData.selectedAuthorEmail,
    });

    if (errors) {
      throw new Error(errors.join(', '));
    }
    reportGitProjectCount(organizationId, sessionId);

    return projectId;
  }

  try {
    const newCloudProject = await createTeamProject({
      sessionId,
      organizationId,
      name: newProjectData.name,
    });

    const project = await services.project.create({
      _id: newCloudProject.id,
      name: newCloudProject.name,
      remoteId: newCloudProject.id,
      parentId: organizationId,
    });

    return project._id;
  } catch (error: unknown) {
    if (isApiError(error)) {
      let errMessage = 'An unexpected error occurred while creating the project. Please try again.';

      if (error.name === 'FORBIDDEN') {
        errMessage = 'You do not have permission to create a cloud project in this organization.';
      } else if (error.name === 'NEEDS_TO_UPGRADE') {
        errMessage = 'Upgrade your account in order to create new Cloud Projects.';
      } else if (error.name === 'PROJECT_STORAGE_RESTRICTION') {
        errMessage = error.message ?? 'The owner of the organization allows only Local Vault project creation.';
      }
      throw new Error(errMessage);
    }

    throw error;
  }
};

export const createProject = async (organizationId: string, newProjectData: CreateProjectData) => {
  const newProjectId = await projectLock.wrapWithLock(createProjectImpl)(organizationId, newProjectData);

  let git_provider = 'none';

  if (newProjectData.credentialsId) {
    const credentials = await services.gitCredentials.getById(newProjectData.credentialsId);
    if (credentials) {
      git_provider = credentials.provider;
    }
  }

  window.main.trackSegmentEvent({
    event: SegmentEvent.projectCreated,
    properties: {
      storage: newProjectData.storageType,
      git_provider,
    },
  });

  showToast({
    title: 'Project created',
    status: 'success',
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
