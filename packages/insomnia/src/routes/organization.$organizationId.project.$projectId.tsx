import { getLearningFeature } from 'insomnia-api';
import { Button, Heading } from 'react-aria-components';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { href, Outlet, redirect, useParams, useRouteLoaderData } from 'react-router';
import * as reactUse from 'react-use';

import { Icon } from '~/basic-components/icon';
import { DEFAULT_SIDEBAR_SIZE } from '~/common/constants';
import { database } from '~/common/database';
import { models, type Project, services, type WorkspaceMeta } from '~/insomnia-data';
import { sortProjects } from '~/models/helpers/project';
import { getProjectsWithGitRepositories } from '~/routes/organization.$organizationId.project.$projectId._index';
import { useStorageRulesLoaderFetcher } from '~/routes/organization.$organizationId.storage-rules';
import { CloudSyncProjectBar } from '~/ui/components/dropdowns/cloud-sync-project-bar';
import { GitProjectSyncDropdown } from '~/ui/components/dropdowns/git-project-sync-dropdown';
import { LocalProjectBar } from '~/ui/components/dropdowns/local-project-bar';
import { ScratchPadTutorialPanel } from '~/ui/components/panes/scratchpad-tutorial-pane';
import { ProjectNavigationSidebar } from '~/ui/components/sidebar/project-navigation-sidebar/project-navigation-sidebar';
import { useLoaderDeferData } from '~/ui/hooks/use-loader-defer-data';
import { useOrganizationPermissions } from '~/ui/hooks/use-organization-features';
import { DEFAULT_STORAGE_RULES } from '~/ui/organization-utils';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId';

interface LearningFeature {
  active: boolean;
  title: string;
  message: string;
  cta: string;
  url: string;
}

const checkSingleProjectSyncStatus = async (projectId: string) => {
  const projectWorkspaces = await services.workspace.findByParentId(projectId);
  const workspaceMetas = await database.find<WorkspaceMeta>(models.workspaceMeta.type, {
    parentId: {
      $in: projectWorkspaces.map(w => w._id),
    },
  });
  return workspaceMetas.some(item => item.hasUncommittedChanges || item.hasUnpushedChanges);
};

const CheckAllProjectSyncStatus = async (projects: Project[]) => {
  const taskList = projects.map(project => checkSingleProjectSyncStatus(project._id));
  const res = await Promise.all(taskList);
  const obj: Record<string, boolean> = {};
  projects.forEach((project, index) => {
    obj[project._id] = res[index];
  });
  return obj;
};

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

  const project = await services.project.getById(projectId);
  const fallbackLearningFeature = {
    active: false,
    title: '',
    message: '',
    cta: '',
    url: '',
  };

  if (!project) {
    return redirect(href('/organization/:organizationId', { organizationId }));
  }
  const organizationProjects = await getProjectsWithGitRepositories({ organizationId });
  const projects = sortProjects(organizationProjects);
  const projectsSyncStatusPromise = CheckAllProjectSyncStatus(projects);
  const learningFeaturePromise = getInsomniaLearningFeature(fallbackLearningFeature);

  const activeProjectGitRepository =
    project && models.project.isGitProject(project)
      ? await services.gitRepository.getById(project.gitRepositoryId || '')
      : undefined;

  return {
    activeProject: project,
    projects,
    activeProjectGitRepository,
    projectsSyncStatusPromise,
    learningFeaturePromise,
  };
}

export function useProjectLoaderData() {
  return useRouteLoaderData<typeof clientLoader>('routes/organization.$organizationId.project.$projectId');
}

const Component = ({ loaderData }: Route.ComponentProps) => {
  const { organizationId } = useParams() as {
    organizationId: string;
    projectId: string;
  };
  const { activeProject, activeProjectGitRepository, learningFeaturePromise } = loaderData;

  const storageRuleFetcher = useStorageRulesLoaderFetcher({ key: `storage-rule:${organizationId}` });
  const [isLearningFeatureDismissed, setIsLearningFeatureDismissed] = reactUse.useLocalStorage(
    'learning-feature-dismissed',
    '',
  );
  const { storagePromise } = storageRuleFetcher.data || {};
  const [storageRules = DEFAULT_STORAGE_RULES] = useLoaderDeferData(storagePromise, organizationId);
  const [learningFeature] = useLoaderDeferData<LearningFeature>(learningFeaturePromise);
  const { features } = useOrganizationPermissions();

  const isScratchPad = models.project.isScratchpadProject(activeProject);

  return (
    <>
      <PanelGroup
        autoSaveId="insomnia-global-sidebar"
        id="wrapper"
        className="new-sidebar h-full w-full text-(--color-font)"
        direction="horizontal"
      >
        <Panel
          id="insomnia-global-navigation-sidebar"
          className="sidebar theme--sidebar"
          defaultSize={DEFAULT_SIDEBAR_SIZE}
          maxSize={40}
          minSize={10}
          collapsible
        >
          <div className="flex flex-1 flex-col divide-y divide-solid divide-(--hl-md) overflow-hidden">
            <ProjectNavigationSidebar storageRules={storageRules} konnectSyncEnabled={features.konnectSync.enabled} />
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
            {activeProject && models.project.isGitProject(activeProject) && (
              <GitProjectSyncDropdown
                key={activeProjectGitRepository?._id}
                gitRepository={activeProjectGitRepository}
                activeProject={activeProject}
              />
            )}
            {activeProject &&
              models.project.isLocalProject(activeProject) &&
              !models.project.isGitProject(activeProject) && <LocalProjectBar />}
            {activeProject && models.project.isRemoteProject(activeProject) && <CloudSyncProjectBar />}
          </div>
        </Panel>
        <PanelResizeHandle className="relative z-10 h-full w-px bg-(--hl-md)" hitAreaMargins={{ coarse: 20, fine: 20 }} />
        <Panel id="pane-one" className="pane-one theme--pane flex flex-col">
          <Outlet />
        </Panel>
      </PanelGroup>
    </>
  );
};
export default Component;
