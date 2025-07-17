import { type ActionFunctionArgs, redirect } from 'react-router';

import { database } from '../../common/database';
import * as models from '../../models';
import { invariant } from '../../utils/invariant';
import { insomniaFetch } from '../insomniaFetch';

export async function action({ params }: ActionFunctionArgs) {
  const { organizationId, projectId } = params;
  invariant(organizationId, 'Organization ID is required');
  invariant(projectId, 'Project ID is required');
  const project = await models.project.getById(projectId);
  invariant(project, 'Project not found');

  const user = await models.userSession.getOrCreate();
  const sessionId = user.id;
  invariant(sessionId, 'User must be logged in to delete a project');

  try {
    const bufferId = await database.bufferChanges();
    if (project.remoteId) {
      const response = await insomniaFetch<void | {
        error: string;
        message?: string;
      }>({
        path: `/v1/organizations/${organizationId}/team-projects/${project.remoteId}`,
        method: 'DELETE',
        sessionId,
      });

      if (response && 'error' in response) {
        return {
          error:
            response.error === 'FORBIDDEN'
              ? 'You do not have permission to delete this project.'
              : 'An unexpected error occurred while deleting the project. Please try again.',
        };
      }
    }

    if (project.gitRepositoryId) {
      const gitRepository = await models.gitRepository.getById(project.gitRepositoryId);
      gitRepository && (await models.gitRepository.remove(gitRepository));
    }

    await models.stats.incrementDeletedRequestsForDescendents(project);
    await models.project.remove(project);

    await database.flushChanges(bufferId);
    return redirect(`/organization/${organizationId}`);
  } catch (err) {
    console.log(err);
    return {
      error:
        err instanceof Error
          ? err.message
          : `An unexpected error occurred while deleting the project. Please try again. ${err}`,
    };
  }
}
