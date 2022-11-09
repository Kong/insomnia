import React, { FC, Fragment, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { LoaderFunction, Outlet, useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';

import { isLoggedIn } from '../../account/session';
import { database, database as db } from '../../common/database';
import * as models from '../../models';
import { defaultOrganization, Organization } from '../../models/organization';
import { isRemoteProject } from '../../models/project';
import { isCollection, isDesign } from '../../models/workspace';
import { initializeProjectFromTeam } from '../../sync/vcs/initialize-model-from';
import { getVCS } from '../../sync/vcs/vcs';
import { AccountToolbar } from '../components/account-toolbar';
import { ActivityToggle } from '../components/activity-toggle';
import { AppHeader } from '../components/app-header';
import { Breadcrumb } from '../components/breadcrumb';
import { GitSyncDropdown } from '../components/dropdowns/git-sync-dropdown';
import { SyncDropdown } from '../components/dropdowns/sync-dropdown';
import { WorkspaceDropdown } from '../components/dropdowns/workspace-dropdown';
import { ErrorBoundary } from '../components/error-boundary';
import { OrganizationsNav } from '../components/organizations-navbar';
import { StatusBar } from '../components/statusbar';
import { Toast } from '../components/toast';
import { AppHooks } from '../containers/app-hooks';
import withDragDropContext from '../context/app/drag-drop-context';
import { GrpcProvider } from '../context/grpc';
import { NunjucksEnabledProvider } from '../context/nunjucks/nunjucks-enabled-context';
import { useGitVCS } from '../hooks/use-git-vcs';
import { useVCS } from '../hooks/use-vcs';
import {
  selectActiveApiSpec,
  selectActiveCookieJar,
  selectActiveGitRepository,
  selectActiveProject,
  selectActiveWorkspace,
  selectActiveWorkspaceMeta,
  selectEnvironments,
  selectIsFinishedBooting,
  selectIsLoggedIn,
} from '../redux/selectors';
import Modals from './modals';

export interface RootLoaderData {
  organizations: Organization[];
}

export const loader: LoaderFunction = async (): Promise<RootLoaderData> => {
  // Load all projects
  try {
    const vcs = getVCS();
    if (vcs && isLoggedIn()) {
      const teams = await vcs.teams();
      const projects = await Promise.all(teams.map(initializeProjectFromTeam));
      await database.batchModifyDocs({ upsert: projects });
    }
  } catch {
    console.log('Failed to load projects');
  }
  const allProjects = await models.project.all();

  const remoteOrgs = allProjects.filter(isRemoteProject).map(({ _id, name }) => ({
    _id,
    name,
  }));

  return {
    organizations: [defaultOrganization, ...remoteOrgs],
  };
};

const Layout = styled.div({
  position: 'relative',
  height: '100%',
  width: '100%',
  display: 'grid',
  backgroundColor: 'var(--color-bg)',
  gridTemplate: `
    'Header Header' auto
    'Navbar Content' 1fr
    'Statusbar Statusbar' 20px [row-end]
    / 50px 1fr;
  `,
});

interface State {
  isMigratingChildren: boolean;
}

const WorkspaceNavigation: FC = () => {
  const { organizationId, projectId, workspaceId } = useParams<{ organizationId: string; projectId: string; workspaceId: string }>();
  const activeProject = useSelector(selectActiveProject);
  const activeWorkspace = useSelector(selectActiveWorkspace);
  const gitRepository = useSelector(selectActiveGitRepository);
  const gitVCS = useGitVCS({
    workspaceId,
    projectId,
    gitRepository,
  });

  const vcs = useVCS({
    workspaceId,
  });

  const navigate = useNavigate();

  if (!activeWorkspace || !organizationId) {
    return null;
  }

  const crumbs = [
    {
      onClick: () => navigate(`/organization/${organizationId}/project/${projectId}`),
      id: activeProject._id,
      label: activeProject.name,
      node: <span data-testId="project">{activeProject.name}</span>,
    },
    {
      id: activeWorkspace._id,
      label: activeWorkspace.name,
      node: <WorkspaceDropdown />,
    },
  ];

  return (
    <Fragment>
      <Breadcrumb crumbs={crumbs} />
      {isDesign(activeWorkspace) && <ActivityToggle />}
      {isDesign(activeWorkspace) && gitVCS && <GitSyncDropdown workspace={activeWorkspace} vcs={gitVCS} />}
      {isCollection(activeWorkspace) && vcs && <SyncDropdown workspace={activeWorkspace} project={activeProject} vcs={vcs} />}
    </Fragment>
  );
};

const Root = () => {
  const [state, setState] = useState<State>({
    isMigratingChildren: false,
  });

  const activeCookieJar = useSelector(selectActiveCookieJar);
  const activeApiSpec = useSelector(selectActiveApiSpec);
  const activeWorkspace = useSelector(selectActiveWorkspace);
  const activeWorkspaceMeta = useSelector(selectActiveWorkspaceMeta);
  const environments = useSelector(selectEnvironments);
  const isLoggedIn = useSelector(selectIsLoggedIn);
  const isFinishedBooting = useSelector(selectIsFinishedBooting);

  // Ensure Children: Make sure cookies, env, and meta models are created under this workspace
  useEffect(() => {
    if (!activeWorkspace) {
      return;
    }
    const baseEnvironments = environments.filter(environment => environment.parentId === activeWorkspace._id);
    const workspaceHasChildren = baseEnvironments.length && activeCookieJar && activeApiSpec && activeWorkspaceMeta;
    if (workspaceHasChildren) {
      return;
    }
    // We already started migrating. Let it finish.
    if (state.isMigratingChildren) {
      return;
    }
    // Prevent rendering of everything until we check the workspace has cookies, env, and meta
    setState(state => ({ ...state, isMigratingChildren: true }));
    async function update() {
      if (activeWorkspace) {
        const flushId = await db.bufferChanges();
        await models.workspace.ensureChildren(activeWorkspace);
        await db.flushChanges(flushId);
        setState(state => ({ ...state, isMigratingChildren: false }));
      }
    }
    update();
  }, [activeApiSpec, activeCookieJar, activeWorkspace, activeWorkspaceMeta, environments, state.isMigratingChildren]);

  if (state.isMigratingChildren) {
    console.log('[app] Waiting for migration to complete');
    return null;
  }

  if (!isFinishedBooting) {
    console.log('[app] Waiting to finish booting');
    return null;
  }

  const uniquenessKey = `${isLoggedIn}::${activeWorkspace?._id || 'n/a'}`;
  return (
    <GrpcProvider>
      <NunjucksEnabledProvider>
        <AppHooks />
        <div className="app" key={uniquenessKey}>
          <ErrorBoundary showAlert>
            <Modals />
            <Layout>
              <OrganizationsNav />
              <AppHeader
                gridCenter={<WorkspaceNavigation />}
                gridRight={<AccountToolbar />}
              />
              <Outlet />
              <StatusBar />
            </Layout>
          </ErrorBoundary>

          <ErrorBoundary showAlert>
            <Toast />
          </ErrorBoundary>
        </div>
      </NunjucksEnabledProvider>
    </GrpcProvider>
  );
};

export default withDragDropContext(Root);
