import { type ActionFunctionArgs, redirect } from 'react-router';

import * as models from '../../models';
import type { OauthProviderName } from '../../models/git-repository';
import { invariant } from '../../utils/invariant';
import { SegmentEvent } from '../analytics';
import { insomniaFetch } from '../insomniaFetch';

export interface CreateProjectActionResult {
  id?: string;
  error?: string;
}

type CreateProjectData =
  | { name: string; storageType: 'local' | 'remote' }
  | {
      name: string;
      storageType: 'git';
      authorName: string;
      authorEmail: string;
      uri: string;
      username: string;
      password: string;
      token: string;
      oauth2format?: OauthProviderName;
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
      const { projectId, errors } = await window.main.git.cloneGitRepo({
        organizationId,
        ...newProjectData,
      });

      if (errors) {
        throw new Error(errors.join(', '));
      }

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

  const newProjectId = await createProjectImpl(organizationId, newProjectData);
  window.main.trackSegmentEvent({
    event: SegmentEvent.projectCreated,
    properties: {
      storage: newProjectData.storageType,
    },
  });

  return newProjectId;
};

export async function action({ request, params }: ActionFunctionArgs) {
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
