import React, { FC, Fragment, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { LoaderFunction, Outlet, useNavigate, useParams, useRevalidator } from 'react-router-dom';
import styled from 'styled-components';

import { isLoggedIn, onLoginLogout } from '../../account/session';
import { database } from '../../common/database';
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
  selectActiveGitRepository,
  selectActiveProject,
  selectActiveWorkspace,
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
      node: <span data-testid="project">{activeProject.name}</span>,
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
      {isDesign(activeWorkspace) && gitVCS && <GitSyncDropdown key={workspaceId} workspace={activeWorkspace} vcs={gitVCS} />}
      {isCollection(activeWorkspace) && isRemoteProject(activeProject) && vcs && <SyncDropdown key={workspaceId} workspace={activeWorkspace} project={activeProject} vcs={vcs} />}
    </Fragment>
  );
};

const Root = () => {
  const { revalidate } = useRevalidator();

  useEffect(() => {
    onLoginLogout(() => {
      revalidate();
    });
  }, [revalidate]);

  return (
    <GrpcProvider>
      <NunjucksEnabledProvider>
        <AppHooks />
        <div className="app">
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
