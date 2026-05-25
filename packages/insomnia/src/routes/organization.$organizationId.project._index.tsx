import { useEffect } from 'react';
import type { LoaderFunctionArgs } from 'react-router';
import { href, redirect, useParams } from 'react-router';

import { logout } from '~/account/session';
import { getProjectsWithGitRepositories } from '~/common/project';
import type { GitRepository, Project } from '~/insomnia-data';
import { models, services } from '~/insomnia-data';
import { useStorageRulesLoaderFetcher } from '~/routes/organization.$organizationId.storage-rules';
import { ErrorBoundary } from '~/ui/components/error-boundary';
import { NoProjectView } from '~/ui/components/panes/no-project-view';
import { OrganizationTabList } from '~/ui/components/tabs/tab-list';
import { useLoaderDeferData } from '~/ui/hooks/use-loader-defer-data';
import { DEFAULT_STORAGE_RULES } from '~/ui/organization-utils';
import { invariant } from '~/utils/invariant';

export interface ProjectIndexLoaderData {
  projectsCount: number;
  projects: (Project & { gitRepository?: GitRepository })[];
}

export async function clientLoader({ params }: LoaderFunctionArgs) {
  const { organizationId } = params;
  invariant(organizationId, 'Organization ID is required');

  const { id: sessionId } = await services.userSession.get();

  if (!sessionId) {
    await logout();
    throw redirect(href('/auth/login'));
  }

  const organizationProjects = await getProjectsWithGitRepositories({ organizationId });
  const projects = models.project.sortProjects(organizationProjects);
  // If there are projects in the organization and no project is selected, redirect to the first project
  if (projects.length > 0) {
    return redirect(`/organization/${organizationId}/project/${projects[0]._id}`);
  }

  return {
    projects,
    projectsCount: organizationProjects.length,
  };
}

// Default page when there are no projects in the organization.
const Component = () => {
  const { organizationId } = useParams() as {
    organizationId: string;
  };

  const storageRuleFetcher = useStorageRulesLoaderFetcher({ key: `storage-rule:${organizationId}` });

  useEffect(() => {
    if (!models.organization.isScratchpadOrganizationId(organizationId)) {
      const load = storageRuleFetcher.load;
      load({ organizationId });
    }
  }, [organizationId, storageRuleFetcher.load]);

  const { storagePromise } = storageRuleFetcher.data || {};
  const [storageRules = DEFAULT_STORAGE_RULES] = useLoaderDeferData(storagePromise, organizationId);

  return (
    <ErrorBoundary>
      <>
        <OrganizationTabList showActiveStatus={false} />
        <NoProjectView storageRules={storageRules} />
      </>
    </ErrorBoundary>
  );
};

export default Component;
