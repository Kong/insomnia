import { useEffect, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import type { LoaderFunctionArgs } from 'react-router';
import { href, redirect, useLoaderData, useNavigate, useParams } from 'react-router';

import { logout } from '~/account/session';
import { DEFAULT_SIDEBAR_SIZE, isKonnectSyncEnabled } from '~/common/constants';
import type { GitRepository, Project } from '~/insomnia-data';
import { services } from '~/insomnia-data';
import { sortProjects } from '~/models/helpers/project';
import { isScratchpadOrganizationId } from '~/models/organization';
import { useRootLoaderData } from '~/root';
import { useOrganizationLoaderData } from '~/routes/organization';
import { getProjectsWithGitRepositories } from '~/routes/organization.$organizationId.project.$projectId._index';
import { useStorageRulesLoaderFetcher } from '~/routes/organization.$organizationId.storage-rules';
import { ErrorBoundary } from '~/ui/components/error-boundary';
import { ProjectModal } from '~/ui/components/modals/project-modal';
import { NoProjectView } from '~/ui/components/panes/no-project-view';
import { NoSelectedProjectView } from '~/ui/components/panes/no-selected-project-view';
import { OrganizationSelect } from '~/ui/components/project/organization-select';
import { ProjectListSidebar } from '~/ui/components/project/project-list-sidebar';
import { OrganizationTabList } from '~/ui/components/tabs/tab-list';
import { useInsomniaEventStreamContext } from '~/ui/context/app/insomnia-event-stream-context';
import { useLoaderDeferData } from '~/ui/hooks/use-loader-defer-data';
import { useOrganizationPermissions } from '~/ui/hooks/use-organization-features';
import { DEFAULT_STORAGE_RULES } from '~/ui/organization-utils';
import { invariant } from '~/utils/invariant';

export interface ProjectIndexLoaderData {
  projectsCount: number;
  projects: (Project & { gitRepository?: GitRepository })[];
}

export async function clientLoader({ params }: LoaderFunctionArgs) {
  const { organizationId } = params;
  invariant(organizationId, 'Organization ID is required');

  const { id: sessionId } = await services.userSession.getOrCreate();

  if (!sessionId) {
    await logout();
    throw redirect(href('/auth/login'));
  }

  const organizationProjects = await getProjectsWithGitRepositories({ organizationId });
  const projects = sortProjects(organizationProjects);

  return {
    projects,
    projectsCount: organizationProjects.length,
  };
}

const Component = () => {
  const { projects } = useLoaderData() as ProjectIndexLoaderData;

  const { organizationId } = useParams() as {
    organizationId: string;
  };

  const { userSession } = useRootLoaderData()!;
  const organizationData = useOrganizationLoaderData();
  const { presence } = useInsomniaEventStreamContext();
  const storageRuleFetcher = useStorageRulesLoaderFetcher({ key: `storage-rule:${organizationId}` });
  const { features } = useOrganizationPermissions();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isScratchpadOrganizationId(organizationId)) {
      const load = storageRuleFetcher.load;
      load({ organizationId });
    }
  }, [organizationId, storageRuleFetcher.load]);

  const { storagePromise } = storageRuleFetcher.data || {};
  const [storageRules = DEFAULT_STORAGE_RULES] = useLoaderDeferData(storagePromise, organizationId);

  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);

  const projectsWithPresence = projects.map(project => {
    const projectPresence = presence
      .filter(p => p.project === project.remoteId)
      .filter(p => p.acct !== userSession.accountId)
      .map(user => {
        return {
          key: user.acct,
          alt: user.firstName || user.lastName ? `${user.firstName} ${user.lastName}` : user.acct,
          src: user.avatar,
        };
      });
    return {
      ...project,
      presence: projectPresence,
    };
  });

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
              <OrganizationSelect
                organizationId={organizationId}
                organizations={organizationData?.organizations || []}
                onSelect={id => navigate(`/organization/${id}`)}
              />
              <ProjectListSidebar
                organizationId={organizationId}
                projects={projectsWithPresence}
                storageRules={storageRules}
                onCreateProject={() => setIsNewProjectModalOpen(true)}
                konnectSyncEnabled={isKonnectSyncEnabled() && features.konnectSync.enabled}
              />
            </div>
          </Panel>
          <PanelResizeHandle className="h-full w-px bg-(--hl-md)" />
          <Panel id="pane-one" className="pane-one theme--pane flex flex-col">
            <OrganizationTabList showActiveStatus={false} />
            {projects.length > 0 ? <NoSelectedProjectView /> : <NoProjectView storageRules={storageRules} />}
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
