import path from 'node:path';

import { database } from 'insomnia/src/common/database';
import { insomniaFetch } from 'insomnia/src/common/insomniaFetch';
import * as models from 'insomnia/src/models';
import { invariant } from 'insomnia/src/utils/invariant';

import { localAppDir } from '../utils/app-data';

export interface CreateProjectOptions {
  projectName: string;
  type: 'remote';
  organizationId: string;
  workingDir?: string;
}

export const createProject = async ({ projectName, type, organizationId, workingDir }: CreateProjectOptions) => {
  invariant(projectName, 'Project name is required.');
  // Currently, only supporting creating remote projects
  invariant(type === 'remote', 'Type must be "remote".');
  invariant(organizationId, 'Organization ID is required.');

  // Set the environment variable for Insomnia data path, to ensure database initialization works correctly
  process.env.INSOMNIA_DATA_PATH = workingDir
    ? path.resolve(workingDir)
    : process.env.INSOMNIA_DATA_PATH || localAppDir;

  await database.init(models.types());

  const project = await createCloudProject({
    projectName,
    organizationId,
  });

  return project;
};

const createCloudProject = async ({
  projectName,
  organizationId,
}: Pick<CreateProjectOptions, 'projectName' | 'organizationId'>) => {
  const { id: sessionId } = await models.userSession.getOrCreate();
  invariant(sessionId, 'User session not found. Please log in by the Insomnia app.');

  // Create a new cloud project in the backend
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
      name: projectName,
    },
    sessionId,
  });

  invariant(newCloudProject, 'Failed to create cloud project.');

  if ('error' in newCloudProject) {
    throw new Error(newCloudProject.error);
  }

  // Link the new cloud project to the local Insomnia database
  const project = await models.project.create({
    _id: newCloudProject.id,
    name: newCloudProject.name,
    remoteId: newCloudProject.id,
    parentId: organizationId,
  });

  return project;
};
