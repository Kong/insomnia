import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { href, Outlet, redirect, useParams, useRouteLoaderData } from 'react-router';

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
import { DEFAULT_STORAGE_RULES } from '~/ui/organization-utils';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId';

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

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { organizationId, projectId } = params;
  invariant(projectId, 'Project ID is required');

  const project = await services.project.getById(projectId);

  if (!project) {
    return redirect(href('/organization/:organizationId', { organizationId }));
  }
  const organizationProjects = await getProjectsWithGitRepositories({ organizationId });
  const projects = sortProjects(organizationProjects);
  const projectsSyncStatusPromise = CheckAllProjectSyncStatus(projects);

  const activeProjectGitRepository =
    project && models.project.isGitProject(project)
      ? await services.gitRepository.getById(project.gitRepositoryId || '')
      : undefined;

  return {
    activeProject: project,
    projects,
    activeProjectGitRepository,
    projectsSyncStatusPromise,
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
  const storageRuleFetcher = useStorageRulesLoaderFetcher({ key: `storage-rule:${organizationId}` });
  const { storagePromise } = storageRuleFetcher.data || {};
  const [storageRules = DEFAULT_STORAGE_RULES] = useLoaderDeferData(storagePromise, organizationId);

  const { activeProject, activeProjectGitRepository } = loaderData;

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
            <ProjectNavigationSidebar storageRules={storageRules} />
            {isScratchPad && <ScratchPadTutorialPanel />}

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
        <PanelResizeHandle className="h-full w-px bg-(--hl-md)" hitAreaMargins={{ coarse: 15, fine: 5 }} />
        <Panel id="pane-one" className="pane-one theme--pane flex flex-col">
          <Outlet />
        </Panel>
      </PanelGroup>
    </>
  );
};
export default Component;
