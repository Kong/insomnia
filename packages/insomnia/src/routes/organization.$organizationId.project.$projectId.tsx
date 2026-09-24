import { models, services } from 'insomnia-data';
import { href, Outlet, redirect, useOutletContext, useParams, useRouteLoaderData } from 'react-router';

import { invariant } from '~/common/utils/invariant';
import { logout } from '~/ui/account/session';
import { GitFileIssuesProvider, useProjectGitFileIssues } from '~/ui/hooks/use-git-file-issues';

import type { Route } from './+types/organization.$organizationId.project.$projectId';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { organizationId, projectId } = params;
  invariant(projectId, 'Project ID is required');
  invariant(organizationId, 'Organization ID is required');

  const userSession = await services.userSession.get();
  const { id: sessionId, accountId } = userSession;

  if (!models.project.isScratchpadProject({ _id: projectId }) && !sessionId) {
    await logout();
    throw redirect(href('/auth/login'));
  }

  const project = await services.project.getById(projectId);

  if (!project) {
    // The project was deleted; stay inside the current organization rather than bouncing the user out.
    const allProjects = await services.project.listByOrganizationIds(organizationId);
    const [fallbackProject] = models.project.sortProjects(allProjects);
    if (fallbackProject) {
      return redirect(
        href('/organization/:organizationId/project/:projectId', {
          organizationId,
          projectId: fallbackProject._id,
        }),
      );
    }
    return redirect(href('/organization/:organizationId', { organizationId }));
  }

  try {
    if (accountId) {
      const firstAccountLandingKey = `firstAccountLandingHandled:${accountId}`;

      if (!window.localStorage.getItem(firstAccountLandingKey)) {
        window.localStorage.setItem(firstAccountLandingKey, 'true');
      }
    }
  } catch (error) {
    console.log('[organizations] Failed to set first account landing flag', error);
  }

  const activeProjectGitRepository =
    project && models.project.isGitProject(project)
      ? await services.gitRepository.getById(models.project.getEffectiveRepoId(project) || '')
      : undefined;

  return {
    activeProject: project,
    activeProjectGitRepository,
  };
}

export function useProjectLoaderData() {
  return useRouteLoaderData<typeof clientLoader>('routes/organization.$organizationId.project.$projectId');
}

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
const Component = ({ loaderData }: Route.ComponentProps) => {
  const { organizationId } = useParams() as {
    organizationId: string;
    projectId: string;
  };

  const { activeProject } = loaderData;

  const isKonnectOrganization = models.organization.isKonnectOrganizationId(organizationId);

  const gitRepositoryId =
    activeProject && models.project.isConnectedGitProject(activeProject)
      ? models.project.getEffectiveRepoId(activeProject)
      : null;
  const gitFileIssues = useProjectGitFileIssues({
    projectId: activeProject?._id,
    gitRepositoryId,
  });

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
