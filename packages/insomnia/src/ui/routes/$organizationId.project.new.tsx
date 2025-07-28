import { type ActionFunctionArgs, redirect } from 'react-router';

import * as models from '../../models';
import type { OauthProviderName } from '../../models/git-repository';
import { invariant } from '../../utils/invariant';
import { SegmentEvent } from '../analytics';
import { insomniaFetch } from '../insomniaFetch';

export async function action({ request, params }: ActionFunctionArgs) {
  const { organizationId } = params;

  invariant(organizationId, 'Organization ID is required');
  const newProjectData = (await request.json()) as {
    name: string;
    storageType: 'local' | 'remote' | 'git';
    authorName: string;
    authorEmail: string;
    uri: string;
    username: string;
    password: string;
    token: string;
    oauth2format: OauthProviderName;
  };

  const user = await models.userSession.getOrCreate();
  const sessionId = user.id;
  invariant(sessionId, 'User must be logged in to create a project');

  if (newProjectData.storageType === 'local') {
    const project = await models.project.create({
      name: newProjectData.name,
      parentId: organizationId,
    });

    window.main.trackSegmentEvent({
      event: SegmentEvent.projectCreated,
      properties: {
        storage: 'local',
      },
    });

    return redirect(`/organization/${organizationId}/project/${project._id}`);
  }

  if (newProjectData.storageType === 'git') {
    const { projectId, errors } = await window.main.git.cloneGitRepo({
      organizationId,
      ...newProjectData,
    });

    if (errors) {
      return {
        error: errors.join(', '),
      };
    }

    window.main.trackSegmentEvent({
      event: SegmentEvent.projectCreated,
      properties: {
        storage: 'git',
      },
    });

    return redirect(`/organization/${organizationId}/project/${projectId}`);
  }

  try {
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

    if (newCloudProject && !('error' in newCloudProject)) {
      window.main.trackSegmentEvent({
        event: SegmentEvent.projectCreated,
        properties: {
          storage: 'remote',
        },
      });
    }

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

      return {
        error,
      };
    }

    const project = await models.project.create({
      _id: newCloudProject.id,
      name: newCloudProject.name,
      remoteId: newCloudProject.id,
      parentId: organizationId,
    });

    return redirect(`/organization/${organizationId}/project/${project._id}`);
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
