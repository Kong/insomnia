import { models, services } from 'insomnia-data';
import { href, redirect } from 'react-router';

import { projectLock } from '~/common/project';
import { invariant } from '~/common/utils/invariant';
import { showToast } from '~/ui/components/toast-notification';
import { createFetcherSubmitHook } from '~/ui/utils/router';

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
  /** Optional absolute path to a user-chosen folder to clone the repo into. */
  directory?: string | null;
  /**
   * When set, adopt this existing local folder as a Git project instead of
   * cloning from a URL.
   */
  openExistingDirectory?: string;
}

const createProjectImpl = async (organizationId: string, newProjectData: CreateProjectData) => {

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

      return project._id;
    }

    // Adopt an existing local folder rather than cloning from a URL.
    if (newProjectData.openExistingDirectory) {
      const { projectId, errors } = await window.main.git.openGitRepo({
        organizationId,
        name: newProjectData.name,
        directory: newProjectData.openExistingDirectory,
        credentialsId: newProjectData.credentialsId,
      });

      if (errors) {
        throw new Error(errors.join(', '));
      }

      return projectId;
    }

    invariant(newProjectData.credentialsId, 'Credentials ID is required for Git project creation');
    const { projectId, errors } = await window.main.git.cloneGitRepo({
      organizationId,
      uri: newProjectData.uri || '',
      credentialsId: newProjectData.credentialsId,
      name: newProjectData.name,
      ref: newProjectData.ref || '',
      selectedAuthorEmail: newProjectData.selectedAuthorEmail,
      directory: newProjectData.directory,
    });

    if (errors) {
      throw new Error(errors.join(', '));
    }

    return projectId;
  }

  throw new Error('Unsupported project type');
};

export const createProject = async (organizationId: string, newProjectData: CreateProjectData) => {
  const newProjectId = await projectLock.wrapWithLock(createProjectImpl)(organizationId, newProjectData);

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
