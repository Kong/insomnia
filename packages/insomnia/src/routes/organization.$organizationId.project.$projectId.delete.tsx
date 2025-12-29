import { href, redirect } from 'react-router';

import { database } from '~/common/database';
import { projectLock } from '~/common/project';
import * as models from '~/models';
import { reportGitProjectCount } from '~/routes/organization.$organizationId.project.new';
import { insomniaFetch } from '~/ui/insomnia-fetch';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook, getInitialRouteForOrganization } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.delete';

export async function clientAction({ params }: Route.ClientActionArgs) {
  const { organizationId, projectId } = params;
  invariant(organizationId, 'Organization ID is required');
  invariant(projectId, 'Project ID is required');
  const project = await models.project.getById(projectId);
  invariant(project, 'Project not found');

  const user = await models.userSession.getOrCreate();
  const sessionId = user.id;
  invariant(sessionId, 'User must be logged in to delete a project');

  try {
    await projectLock.lock();
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

    project.gitRepositoryId && reportGitProjectCount(organizationId, sessionId);

    // When redirect to `/organizations/:organizationId`, it sometimes doesn't reload the index loader, so manually redirect to the initial route for the organization
    const initialOrganizationRoute = await getInitialRouteForOrganization({ organizationId });
    return redirect(initialOrganizationRoute);
  } catch (err) {
    console.log(err);
    return {
      error:
        err instanceof Error
          ? err.message
          : `An unexpected error occurred while deleting the project. Please try again. ${err}`,
    };
  } finally {
    await projectLock.unlock();
  }
}

export const useProjectDeleteActionFetcher = createFetcherSubmitHook(
  submit =>
    ({ organizationId, projectId }: { organizationId: string; projectId: string }) => {
      const url = href('/organization/:organizationId/project/:projectId/delete', {
        organizationId,
        projectId,
      });

      return submit(
        {},
        {
          action: url,
          method: 'POST',
        },
      );
    },
  clientAction,
);
