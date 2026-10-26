import { getLearningFeature } from 'insomnia-api';
import { models } from 'insomnia-data';
import { useEffect, useRef, useState } from 'react';
import { Button, Heading } from 'react-aria-components';
import { type ImperativePanelHandle, Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Outlet, useParams, useSearchParams } from 'react-router';
import * as reactUse from 'react-use';

import { Icon } from '~/basic-components/icon';
import { DEFAULT_SIDEBAR_SIZE } from '~/common/constants';
import { ProjectModal } from '~/ui/components/modals/project-modal';
import { ScratchPadTutorialPanel } from '~/ui/components/panes/scratchpad-tutorial-pane';
import {
  ProjectNavigationSidebar,
  type ProjectNavigationSidebarHandle,
} from '~/ui/components/sidebar/project-navigation-sidebar/project-navigation-sidebar';
import { SyncBar } from '~/ui/components/sidebar/sync-bar';
import { useSidebarContext } from '~/ui/context/app/insomnia-sidebar-context';
import { useOrganizationStorageRule } from '~/ui/hooks/use-organization-storage-rule';
import { useServerQuery } from '~/ui/hooks/use-query';
import { useRemoteBackendProjectsInvalidation } from '~/ui/hooks/use-remote-files';

/**
 * Shared layout for everything under `/organization/:organizationId/project` — both the index
 * (no project selected, which is what an organization with zero projects lands on) and a
 * selected project.
 *
 * The two child routes used to render a copy of this shell each, so gaining or losing the last
 * project swapped one route module for the other and remounted the whole sidebar. Anything the
 * sidebar owned was silently dropped mid-flight — most visibly an in-progress Konnect sync's
 * AbortController, which left the sync running with nothing able to cancel it. Owning the shell
 * here means only the `<Outlet />` content changes across that boundary.
 *
 * Deliberately has no loader: everything it needs comes from the URL, so it never re-runs (and
 * never suspends the sidebar) when a child revalidates.
 */
const Component = () => {
  const { organizationId, projectId } = useParams() as {
    organizationId: string;
    projectId?: string;
  };

  const [searchParams] = useSearchParams();

  const [isLearningFeatureDismissed, setIsLearningFeatureDismissed] = reactUse.useLocalStorage(
    'learning-feature-dismissed',
    '',
  );
  const storageRules = useOrganizationStorageRule(organizationId);
  const { data: learningFeature } = useServerQuery({
    queryKey: ['learning-feature'],
    queryFn: getLearningFeature,
    enabled: !isLearningFeatureDismissed,
    staleTime: 1000 * 60 * 60 * 24, // 1 day
    refetchOnWindowFocus: true,
  });
  const sidebarPanelRef = useRef<ImperativePanelHandle>(null);
  const { isSidebarCollapsed } = useSidebarContext();

  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);

  useEffect(() => {
    if (isSidebarCollapsed) {
      sidebarPanelRef.current?.collapse();
    } else {
      sidebarPanelRef.current?.expand();
    }
  }, [isSidebarCollapsed]);

  // Only the id is needed here, so this stays correct without waiting on the project loader.
  const isScratchPad = projectId ? models.project.isScratchpadProject({ _id: projectId }) : false;

  const navigationSidebarRef = useRef<ProjectNavigationSidebarHandle>(null);

  useEffect(() => {
    const isExpanded = searchParams.get('isExpanded') === 'true';
    if (navigationSidebarRef.current && isExpanded && projectId) {
      navigationSidebarRef.current.expandProject(projectId);
    }
  }, [searchParams, projectId]);

  useRemoteBackendProjectsInvalidation(organizationId);

  return (
    <>
      <PanelGroup
        autoSaveId="insomnia-global-sidebar"
        id="wrapper"
        className="new-sidebar h-full w-full text-(--color-font)"
        direction="horizontal"
      >
        <Panel
          ref={sidebarPanelRef}
          id="insomnia-global-navigation-sidebar"
          className="sidebar theme--sidebar"
          defaultSize={DEFAULT_SIDEBAR_SIZE}
          maxSize={40}
          minSize={10}
          collapsible
        >
          <div className="flex flex-1 flex-col divide-y divide-solid divide-(--hl-md) overflow-hidden">
            <ProjectNavigationSidebar
              storageRules={storageRules}
              onCreateProject={() => setIsNewProjectModalOpen(true)}
              ref={navigationSidebarRef}
            />
            {isScratchPad && <ScratchPadTutorialPanel />}
            {!isLearningFeatureDismissed && learningFeature?.active && (
              <div className="flex shrink-0 flex-col gap-2 p-(--padding-sm)">
                <div className="flex items-center justify-between gap-2">
                  <Heading className="text-base">
                    <Icon icon="graduation-cap" />
                    <span className="ml-2">{learningFeature.title}</span>
                  </Heading>
                  <Button
                    onPress={() => {
                      setIsLearningFeatureDismissed('true');
                    }}
                  >
                    <Icon icon="close" />
                  </Button>
                </div>
                <p className="text-sm text-(--hl)">{learningFeature.message}</p>
                <a href={learningFeature.url} className="flex items-center gap-2 text-sm underline">
                  {learningFeature.cta}
                  <Icon icon="arrow-up-right-from-square" />
                </a>
              </div>
            )}
            <SyncBar />
          </div>
        </Panel>
        <PanelResizeHandle className="relative z-10 h-full w-px bg-(--hl-md)" />
        <Panel id="pane-one" className="pane-one theme--pane flex flex-col">
          <Outlet />
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
  );
};

export default Component;
