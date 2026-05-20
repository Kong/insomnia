import { href, Outlet, redirect, useRouteLoaderData } from 'react-router';

import { models, services } from '~/insomnia-data';
import { GitFileIssuesProvider, useProjectGitFileIssues } from '~/ui/hooks/use-git-file-issues';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { organizationId, projectId } = params;
  invariant(projectId, 'Project ID is required');

  const project = await services.project.get(projectId);

  if (!project) {
    return redirect(href('/organization/:organizationId', { organizationId }));
  }

  return {
    activeProject: project,
  };
}

export function useProjectLoaderData() {
  return useRouteLoaderData<typeof clientLoader>('routes/organization.$organizationId.project.$projectId');
}

const Component = () => {
  const data = useProjectLoaderData();
  const gitRepositoryId =
    data && models.project.isConnectedGitProject(data.activeProject)
      ? models.project.getEffectiveRepoId(data.activeProject)
      : null;
  const gitFileIssues = useProjectGitFileIssues({
    projectId: data?.activeProject._id,
    gitRepositoryId,
  });

  return (
    <GitFileIssuesProvider value={gitFileIssues}>
      <Outlet />
    </GitFileIssuesProvider>
  );
};

export default Component;
