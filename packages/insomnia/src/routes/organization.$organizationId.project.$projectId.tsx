import { getLearningFeature } from 'insomnia-api';
import { models, services } from 'insomnia-data';
import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from 'react';
import { Button, Heading } from 'react-aria-components';
import { type ImperativePanelHandle, Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { href, Outlet, redirect, useOutletContext, useParams, useRouteLoaderData, useSearchParams } from 'react-router';
import * as reactUse from 'react-use';

import { Icon } from '~/basic-components/icon';
import { DEFAULT_SIDEBAR_SIZE } from '~/common/constants';
import { checkAllProjectSyncStatus, getProjectsWithGitRepositories } from '~/common/project';
import { invariant } from '~/common/utils/invariant';
import { useStorageRulesLoaderFetcher } from '~/routes/organization.$organizationId.storage-rules';
import { logout } from '~/ui/account/session';
import { ProjectModal } from '~/ui/components/modals/project-modal';
import { ScratchPadTutorialPanel } from '~/ui/components/panes/scratchpad-tutorial-pane';
import {
  ProjectNavigationSidebar,
  type ProjectNavigationSidebarHandle,
  type ProjectNavigationSidebarTabId,
} from '~/ui/components/sidebar/project-navigation-sidebar/project-navigation-sidebar';
import { SyncBar } from '~/ui/components/sidebar/sync-bar';
import { useSidebarContext } from '~/ui/context/app/insomnia-sidebar-context';
import { GitFileIssuesProvider, useProjectGitFileIssues } from '~/ui/hooks/use-git-file-issues';
import { useLoaderDeferData } from '~/ui/hooks/use-loader-defer-data';
import { useOrganizationPermissions } from '~/ui/hooks/use-organization-features';
import { DEFAULT_STORAGE_RULES } from '~/ui/organization-utils';

import type { Route } from './+types/organization.$organizationId.project.$projectId';

interface LearningFeature {
  active: boolean;
  title: string;
  message: string;
  cta: string;
  url: string;
}

const getInsomniaLearningFeature = async (fallbackLearningFeature: LearningFeature) => {
  let learningFeature = fallbackLearningFeature;
  const lastFetchedString = window.localStorage.getItem('learning-feature-last-fetch');
  const lastFetched = lastFetchedString ? Number.parseInt(lastFetchedString, 10) : 0;
  const oneDay = 86_400_000;
  const hasOneDayPassedSinceLastFetch = Date.now() - lastFetched > oneDay;
  const wasDismissed = window.localStorage.getItem('learning-feature-dismissed');
  const wasNotDismissedAndOneDayHasPassed = !wasDismissed && hasOneDayPassedSinceLastFetch;
  if (wasNotDismissedAndOneDayHasPassed) {
    try {
      learningFeature = await getLearningFeature();
      window.localStorage.setItem('learning-feature-last-fetch', Date.now().toString());
    } catch {
      console.log('[project] Could not fetch learning feature data.');
    }
  }
  return learningFeature;
};

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

  const project = await services.project.get(projectId);

  if (!project) {
    // When a project is not found (e.g., after deletion), check if user was on Konnect tab
    // and try to redirect to another Konnect project to avoid switching tabs
    const storedTab = localStorage.getItem(`${organizationId}:sidebar-tab`);
    if (storedTab) {
      try {
        const parsedTab = JSON.parse(storedTab);
        if (parsedTab === 'konnect') {
          const allProjects = await services.project.list({ organizationId });
          const konnectProjects = models.project.sortProjects(allProjects.filter(p => p.konnectControlPlaneId != null));
          if (konnectProjects.length > 0) {
            return redirect(
              href('/organization/:organizationId/project/:projectId', {
                organizationId,
                projectId: konnectProjects[0]._id,
              }),
            );
          }
        }
      } catch {
        // ignore parse errors
      }
    }
    return redirect(href('/organization/:organizationId', { organizationId }));
  }

  try {
    const organization = await services.organization.get(organizationId);

    if (accountId && organization && models.organization.isPersonalOrganization(organization)) {
      const firstPersonalOrgLandingKey = `firstPersonalOrgLandingHandled:${accountId}`;

      if (!window.localStorage.getItem(firstPersonalOrgLandingKey)) {
        window.localStorage.setItem(firstPersonalOrgLandingKey, 'true');
      }
    }
  } catch (error) {
    console.log('[organizations] Failed to load Organizations', error);
  }

  const fallbackLearningFeature = {
    active: false,
    title: '',
    message: '',
    cta: '',
    url: '',
  };

  const organizationProjects = await getProjectsWithGitRepositories({ organizationId });

  const projects = models.project.sortProjects(organizationProjects);

  const learningFeaturePromise = getInsomniaLearningFeature(fallbackLearningFeature);

  const projectsSyncStatusPromise = checkAllProjectSyncStatus(projects);

  const activeProjectGitRepository =
    project && models.project.isGitProject(project)
      ? await services.gitRepository.getById(models.project.getEffectiveRepoId(project) || '')
      : undefined;

  return {
    projects,
    activeProject: project,
    activeProjectGitRepository,
    projectsSyncStatusPromise,
    learningFeaturePromise,
  };
}

export function useProjectLoaderData() {
  return useRouteLoaderData<typeof clientLoader>('routes/organization.$organizationId.project.$projectId');
}

export interface ProjectRouteContextValue {
  activeSidebarTab: ProjectNavigationSidebarTabId;
  setActiveSidebarTab: Dispatch<SetStateAction<ProjectNavigationSidebarTabId | undefined>>;
}

export function useProjectRouteContext() {
  return useOutletContext<ProjectRouteContextValue>();
}

const Component = ({ loaderData }: Route.ComponentProps) => {
  const { organizationId } = useParams() as {
    organizationId: string;
    projectId: string;
  };

  const [searchParams] = useSearchParams();
  const { activeProject, learningFeaturePromise } = loaderData;

  const storageRuleFetcher = useStorageRulesLoaderFetcher({ key: `storage-rule:${organizationId}` });
  const [isLearningFeatureDismissed, setIsLearningFeatureDismissed] = reactUse.useLocalStorage(
    'learning-feature-dismissed',
    '',
  );
  const { storagePromise } = storageRuleFetcher.data || {};
  const [storageRules = DEFAULT_STORAGE_RULES] = useLoaderDeferData(storagePromise, organizationId);
  const [learningFeature] = useLoaderDeferData<LearningFeature>(learningFeaturePromise);
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

  const { features } = useOrganizationPermissions();
  const [storedSidebarTab, setActiveSidebarTab] = reactUse.useLocalStorage<ProjectNavigationSidebarTabId>(
    `${organizationId}:sidebar-tab`,
    'projects',
  );
  const activeSidebarTab = !features.konnectSync.enabled ? 'projects' : (storedSidebarTab ?? 'projects');

  const isScratchPad = models.project.isScratchpadProject(activeProject);
  const gitRepositoryId =
    activeProject && models.project.isConnectedGitProject(activeProject)
      ? models.project.getEffectiveRepoId(activeProject)
      : null;
  const gitFileIssues = useProjectGitFileIssues({
    projectId: activeProject?._id,
    gitRepositoryId,
  });

  const navigationSidebarRef = useRef<ProjectNavigationSidebarHandle>(null);

  useEffect(() => {
    const isExpanded = searchParams.get('isExpanded') === 'true';
    if (navigationSidebarRef.current && isExpanded && activeProject) {
      navigationSidebarRef.current.expandProject(activeProject._id);
    }
  }, [searchParams, activeProject]);

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
              activeTab={activeSidebarTab}
              storageRules={storageRules}
              konnectSyncEnabled={features.konnectSync.enabled}
              onCreateProject={() => setIsNewProjectModalOpen(true)}
              setActiveTab={setActiveSidebarTab}
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
        <PanelResizeHandle
          className="relative z-10 h-full w-px bg-(--hl-md)"
          hitAreaMargins={{ coarse: 15, fine: 15 }}
        />
        <Panel id="pane-one" className="pane-one theme--pane flex flex-col">
          <GitFileIssuesProvider value={gitFileIssues}>
            <Outlet
              context={{
                activeSidebarTab,
                setActiveSidebarTab,
              }}
            />
          </GitFileIssuesProvider>
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
