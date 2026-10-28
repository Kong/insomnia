import type { GitRepository, Project } from 'insomnia-data';
import { models, services } from 'insomnia-data';
import { useEffect, useMemo } from 'react';
import { href, Outlet, redirect, useOutletContext, useParams } from 'react-router';

import { organizationDataQuery } from '~/common/app-data';
import { invariant } from '~/common/utils/invariant';
import { useRootLoaderData } from '~/root';
import { logout } from '~/ui/account/session';
import { MissingEntityRedirect } from '~/ui/components/missing-entity-redirect';
import { dbQueryClient } from '~/ui/context/app/insomnia-app-data-context';
import { GitFileIssuesProvider, useProjectGitFileIssues } from '~/ui/hooks/use-git-file-issues';
import { useDBQuery } from '~/ui/hooks/use-query';

import type { Route } from './+types/organization.$organizationId.project.$projectId';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { organizationId, projectId } = params;
  invariant(projectId, 'Project ID is required');
  invariant(organizationId, 'Organization ID is required');

  const { id: sessionId } = await services.userSession.get();

  if (!models.project.isScratchpadProject({ _id: projectId }) && !sessionId) {
    await logout();
    throw redirect(href('/auth/login'));
  }

  // Prefetch only. The component reads the project from the cache and handles a missing one.
  await dbQueryClient.ensureQueryData(organizationDataQuery(organizationId));
  return null;
}

/**
 * The active project, derived from the organization data query (prefetched by the loader above), so
 * it follows `db.changes` — e.g. a project renamed or turned local by the startup sync — without the
 * loader having to re-run. Returns undefined outside a project route, like the loader data used to.
 * Inside the project's content `activeProject` is always set: the route renders the content only
 * while the project exists.
 */
export function useProjectLoaderData():
  | { activeProject: Project | undefined; activeProjectGitRepository: GitRepository | undefined }
  | undefined {
  const { organizationId = '', projectId } = useParams();
  const { data } = useDBQuery({ ...organizationDataQuery(organizationId), enabled: Boolean(organizationId && projectId) });
  const projectWithGitRepository = projectId ? data?.projects.find(p => p._id === projectId) : undefined;

  return useMemo(() => {
    if (!projectId) {
      return;
    }
    if (!projectWithGitRepository) {
      return { activeProject: undefined, activeProjectGitRepository: undefined };
    }
    // Strip the joined repository: consumers pass the project to `services.project.update`, which
    // would otherwise persist it onto the project doc.
    const { gitRepository, ...activeProject } = projectWithGitRepository;
    return { activeProject: activeProject as Project, activeProjectGitRepository: gitRepository };
  }, [projectId, projectWithGitRepository]);
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

  const { activeProject } = useProjectLoaderData() ?? {};
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
