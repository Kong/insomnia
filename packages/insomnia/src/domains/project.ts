import { deleteTeamProject, isApiError, updateGitProjectCount } from 'insomnia-api';
import { redirect } from 'react-router';

import { isNotNullOrUndefined } from '~/common/misc';
import { projectLock } from '~/common/project';
import { database, models, type Project, services } from '~/insomnia-data';
import { invariant } from '~/utils/invariant';
import { getInitialRouteForOrganization } from '~/utils/router';

import { createDomain } from './base';

async function remove({ organizationId, projectId }: { organizationId: string; projectId: string }) {
  invariant(organizationId, 'Organization ID is required');
  invariant(projectId, 'Project ID is required');
  const project = await services.project.getById(projectId);
  invariant(project, 'Project not found');

  const user = await services.userSession.getOrCreate();
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

    if (project.gitRepositoryId) {
      const gitRepository = await services.gitRepository.getById(project.gitRepositoryId);
      gitRepository && (await services.gitRepository.remove(gitRepository));
    }

    await services.stats.incrementDeletedRequestsForDescendents(project);
    await services.project.remove(project);

    await database.flushChanges(bufferId);

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

async function move({ organizationId, projectId }: { organizationId: string; projectId: string }) {
  invariant(typeof organizationId === 'string', 'Organization ID is required');

  const project = await services.project.getById(projectId);
  invariant(project, 'Project not found');

  await services.project.update(project, {
    parentId: organizationId,
    // We move a project to another organization as local no matter what it was before
    remoteId: null,
  });

  return null;
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

const actions = {
  remove,
  move,
};

const [createProjectActionHandler, useProjectAction] = createDomain(actions);

export { createProjectActionHandler, useProjectAction };
