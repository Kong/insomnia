import { href, Outlet, redirect, useRouteLoaderData } from 'react-router';

import { services } from '~/insomnia-data';
import * as models from '~/models';
import { GitFileIssuesProvider, useProjectGitFileIssues } from '~/ui/hooks/use-git-file-issues';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { organizationId, projectId } = params;
  invariant(projectId, 'Project ID is required');

  const project = await services.project.getById(projectId);

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
    data && models.project.isGitProject(data.activeProject) && !models.project.isEmptyGitProject(data.activeProject)
      ? data.activeProject.gitRepositoryId
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
