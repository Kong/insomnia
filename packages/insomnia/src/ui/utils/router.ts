import type { GitProject, GitRepository } from 'insomnia-data';
import { database, models, services } from 'insomnia-data';
import { useCallback } from 'react';
import { href, matchPath, type PathMatch, useFetcher } from 'react-router';

import { CURRENT_MIGRATION_VERSION } from '~/sync/git/git-migration-version';

export const enum AsyncTask {
  MigrateProjects,
  SyncProjects,
}

const getMatchParams = (location: string) => {
  const workspaceMatch = matchPath(
    {
      path: '/organization/:organizationId/project/:projectId/workspace/:workspaceId',
      end: false,
    },
    location,
  );

  const projectMatch = matchPath(
    {
      path: '/organization/:organizationId/project/:projectId',
      end: false,
    },
    location,
  );

  return (workspaceMatch || projectMatch) as PathMatch<'organizationId' | 'projectId' | 'workspaceId'> | null;
};

export const getInitialRouteForOrganization = async ({
  organizationId,
  navigateToWorkspace = false,
}: {
  organizationId: string;
  navigateToWorkspace?: boolean;
}) => {
  // 1. assuming we have history, try to redirect to the last visited project
  const prevOrganizationLocation = localStorage.getItem(`locationHistoryEntry:${organizationId}`);
  // Check if the last visited project exists and redirect to it
  if (prevOrganizationLocation) {
    const match = getMatchParams(prevOrganizationLocation);

    if (match && match.params.organizationId && match.params.projectId) {
      const existingProject = await services.project.getById(match.params.projectId);

      if (existingProject) {
        console.log('Redirecting to last visited project', existingProject._id);

        if (match.params.workspaceId && navigateToWorkspace) {
          const existingWorkspace = await services.workspace.getById(match.params.workspaceId);
          if (existingWorkspace) {
            return `${href(`/organization/:organizationId/project/:projectId/workspace/:workspaceId`, {
              organizationId: match.params.organizationId,
              projectId: existingProject._id,
              workspaceId: existingWorkspace._id,
            })}/${models.workspace.scopeToActivity(existingWorkspace.scope)}`;
          }
        }

        return href(`/organization/:organizationId/project/:projectId`, {
          organizationId: match.params.organizationId,
          projectId: existingProject._id,
        });
      }
    }
  }
  // 2. if no history, redirect to the first project
  const firstProject = await services.project.get({ parentId: organizationId });

  if (firstProject?._id) {
    return href(`/organization/:organizationId/project/:projectId`, {
      organizationId,
      projectId: firstProject._id,
    });
  }
  // 3. if no project, redirect to the project route
  return href(`/organization/:organizationId/project`, {
    organizationId,
  });
};

export const getInitialEntry = async () => {
  const organizationId = models.organization.LOCAL_ORGANIZATION_ID;

  try {
    const allProjects = await services.project.list();
    const gitRepoIds = (
      allProjects.filter(
        (p): p is GitProject => models.project.isGitProject(p) && !models.project.isEmptyGitProject(p),
      ) as GitProject[]
    ).map(p => p.gitRepositoryId);

    if (gitRepoIds.length > 0) {
      const gitRepos = await database.find<GitRepository>(models.gitRepository.type, {
        _id: { $in: gitRepoIds },
      });

      const hasPendingMigrations = gitRepos.some(repo => (repo.repoMigrationVersion ?? 0) < CURRENT_MIGRATION_VERSION);
      if (hasPendingMigrations) {
        console.log('Redirecting to git migration');
        return href('/git-migration/*', { '*': '' });
      }
    }

    return await getInitialRouteForOrganization({ organizationId, navigateToWorkspace: true });
  } catch {
    return href('/organization/:organizationId', { organizationId });
  }
};

type Override<T, R> = Omit<T, keyof R> & R;

export const createFetcherSubmitHook =
  <T extends (fetcher: ReturnType<typeof useFetcher<A>>['submit']) => any, A extends (...args: any) => unknown>(
    fn: T,
    _actionType?: A, // Only used for type inference
  ) =>
  (...args: Parameters<typeof useFetcher>) => {
    const fetcher = useFetcher<A>(...args);

    const submit = useCallback(((...args: any[]) => fn(fetcher.submit)(...args)) as ReturnType<T>, [fetcher.submit]);

    return {
      ...fetcher,
      submit,
    } as Override<typeof fetcher, { submit: ReturnType<T> }>;
  };

export const createFetcherLoadHook =
  <T extends (fetcher: ReturnType<typeof useFetcher<A>>['load']) => any, A extends (...args: any) => unknown>(
    fn: T,
    _actionType?: A, // Only used for type inference
  ) =>
  (...args: Parameters<typeof useFetcher>) => {
    const fetcher = useFetcher<A>(...args);

    const load = useCallback(((...args: any[]) => fn(fetcher.load)(...args)) as ReturnType<T>, [fetcher.load]);

    return {
      ...fetcher,
      load,
    } as Override<typeof fetcher, { load: ReturnType<T> }>;
  };
