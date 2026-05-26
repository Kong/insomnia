import { useEffect, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import type { LoaderFunctionArgs } from 'react-router';
import { href, redirect, useParams } from 'react-router';

import { logout } from '~/account/session';
import { DEFAULT_SIDEBAR_SIZE } from '~/common/constants';
import { getProjectsWithGitRepositories } from '~/common/project';
import type { GitRepository, Project } from '~/insomnia-data';
import { models, services } from '~/insomnia-data';
import { useStorageRulesLoaderFetcher } from '~/routes/organization.$organizationId.storage-rules';
import { ErrorBoundary } from '~/ui/components/error-boundary';
import { ProjectModal } from '~/ui/components/modals/project-modal';
import { NoProjectView } from '~/ui/components/panes/no-project-view';
import { EmptyProjectNavigationSidebar } from '~/ui/components/sidebar/project-navigation-sidebar/project-navigation-sidebar';
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

  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);

  return (
    <ErrorBoundary>
      <>
        <PanelGroup
          autoSaveId="insomnia-sidebar"
          id="wrapper"
          className="new-sidebar h-full w-full text-(--color-font)"
          direction="horizontal"
        >
          <Panel
            id="sidebar"
            className="sidebar theme--sidebar"
            defaultSize={DEFAULT_SIDEBAR_SIZE}
            maxSize={40}
            minSize={10}
            collapsible
          >
            <div className="flex flex-1 flex-col divide-y divide-solid divide-(--hl-md) overflow-hidden">
              <EmptyProjectNavigationSidebar onCreateProject={() => setIsNewProjectModalOpen(true)} />
            </div>
          </Panel>
          <PanelResizeHandle className="h-full w-px bg-(--hl-md)" />
          <Panel id="pane-one" className="pane-one theme--pane flex flex-col">
            <NoProjectView storageRules={storageRules} />
          </Panel>
        </PanelGroup>
        {isNewProjectModalOpen && (
          <ProjectModal
            isOpen={isNewProjectModalOpen}
            onOpenChange={setIsNewProjectModalOpen}
            storageRules={storageRules}
          />
        )}
      </>
    </ErrorBoundary>
  );
};

export default Component;
