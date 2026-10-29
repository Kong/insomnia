import type { Project } from 'insomnia-data';
import { models } from 'insomnia-data';
import { useEffect } from 'react';
import { href, Outlet, useOutletContext, useParams } from 'react-router';

import { organizationDataQuery } from '~/common/app-data';
import { invariant } from '~/common/utils/invariant';
import { MissingEntityRedirect } from '~/ui/components/missing-entity-redirect';
import { dbQueryClient } from '~/ui/context/app/insomnia-app-data-context';
import { useActiveProject } from '~/ui/hooks/use-active-project';
import { GitFileIssuesProvider, useProjectGitFileIssues } from '~/ui/hooks/use-git-file-issues';
import { useRootLoaderData } from '~/ui/hooks/use-root-loader-data';

import type { Route } from './+types/organization.$organizationId.project.$projectId';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { organizationId, projectId } = params;
  invariant(projectId, 'Project ID is required');
  invariant(organizationId, 'Organization ID is required');

  // Prefetch only. The component reads the project from the cache and handles a missing one.
  await dbQueryClient.ensureQueryData(organizationDataQuery(organizationId));
  return null;
}

// Where to go when the project in the URL does not exist (anymore): stay inside the current
// organization rather than bouncing the user out. `sortedProjects` comes from organization data,
// which is already sorted.
const getProjectFallbackRoute = (organizationId: string, sortedProjects: Project[]) => {
  const [fallbackProject] = sortedProjects;
  return fallbackProject
    ? href('/organization/:organizationId/project/:projectId', { organizationId, projectId: fallbackProject._id })
    : href('/organization/:organizationId', { organizationId });
};

export interface ProjectRouteContextValue {
  isKonnectOrganization: boolean;
}

export function useProjectRouteContext() {
  return useOutletContext<ProjectRouteContextValue>();
}

/**
 * The shell around this route (sidebar, panels, project modal) lives in the parent
 * `organization.$organizationId.project` layout so it survives the transition between having and
 * not having a selected project. This route only contributes the parts that need the active
 * project itself.
 */
const Component = () => {
  const { organizationId } = useParams() as {
    organizationId: string;
    projectId: string;
  };

  const { activeProject } = useActiveProject() ?? {};
  const { userSession } = useRootLoaderData()!;

  const isKonnectOrganization = models.organization.isKonnectOrganizationId(organizationId);

  const gitRepositoryId =
    activeProject && models.project.isConnectedGitProject(activeProject)
      ? models.project.getEffectiveRepoId(activeProject)
      : null;
  const gitFileIssues = useProjectGitFileIssues({
    projectId: activeProject?._id,
    gitRepositoryId,
  });

  const hasActiveProject = Boolean(activeProject);
  const { accountId } = userSession;
  useEffect(() => {
    if (!hasActiveProject || !accountId) {
      return;
    }
    try {
      const firstAccountLandingKey = `firstAccountLandingHandled:${accountId}`;
      if (!window.localStorage.getItem(firstAccountLandingKey)) {
        window.localStorage.setItem(firstAccountLandingKey, 'true');
      }
    } catch (error) {
      console.log('[organizations] Failed to set first account landing flag', error);
    }
  }, [hasActiveProject, accountId]);

  // Not in the organization data: the data is not loaded (the loader prefetches it, so only if the
  // cache was cleared in between), the project was just created and is not cached yet, removed
  // while open (e.g. by a Konnect sync or disconnect), or the URL points at a project that doesn't
  // exist / belongs to another organization.
  if (!activeProject) {
    return (
      <MissingEntityRedirect
        queryOptions={organizationDataQuery(organizationId)}
        getRedirectTo={({ projects }) => getProjectFallbackRoute(organizationId, projects)}
      />
    );
  }

  return (
    <GitFileIssuesProvider value={gitFileIssues}>
      <Outlet
        context={{
          isKonnectOrganization,
        }}
      />
    </GitFileIssuesProvider>
  );
};
export default Component;
