import { deleteTeamProject, isApiError } from 'insomnia-api';
import { models, services } from 'insomnia-data';
import { href, redirect } from 'react-router';

import { database } from '~/common/database';
import { projectLock } from '~/common/project';
import { reportGitProjectCount } from '~/routes/organization.$organizationId.project.new';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook, getInitialRouteForOrganization } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.delete';

export async function clientAction({ params }: Route.ClientActionArgs) {
  const { organizationId, projectId } = params;
  invariant(organizationId, 'Organization ID is required');
  invariant(projectId, 'Project ID is required');
  const project = await services.project.get(projectId);
  invariant(project, 'Project not found');

  const user = await services.userSession.get();
  const sessionId = user.id;
  invariant(sessionId, 'User must be logged in to delete a project');

  try {
    await projectLock.lock();
    const bufferId = await database.bufferChanges();
    if (project.remoteId) {
      await deleteTeamProject({
        organizationId,
        projectRemoteId: project.remoteId,
        sessionId,
      });
    }

    if (models.project.isConnectedGitProject(project)) {
      const effectiveRepoId = models.project.isGitProject(project) ? models.project.getEffectiveRepoId(project) : null;
      const gitRepository = effectiveRepoId ? await services.gitRepository.getById(effectiveRepoId) : null;
      gitRepository && (await services.gitRepository.remove(gitRepository));
    }

    await services.stats.incrementDeletedRequestsForDescendents(project);
    await services.projectLintRuleset.remove(projectId);
    await services.project.remove(project);

    await database.flushChanges(bufferId);

    await window.main.deleteCompiledRuleset({ projectId });

    project.gitRepositoryId && reportGitProjectCount(organizationId, sessionId);

    // When redirect to `/organizations/:organizationId`, it sometimes doesn't reload the index loader, so manually redirect to the initial route for the organization
    const initialOrganizationRoute = await getInitialRouteForOrganization({ organizationId });
    return redirect(initialOrganizationRoute);
  } catch (err: unknown) {
    console.log(err);
    if (isApiError(err)) {
      return {
        error:
          err.name === 'FORBIDDEN'
            ? 'You do not have permission to delete this project.'
            : 'An unexpected error occurred while deleting the project. Please try again.',
      };
    }
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
