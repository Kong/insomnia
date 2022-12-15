import React, { useEffect } from 'react';
import { LoaderFunction, Outlet, useRevalidator, useRouteLoaderData } from 'react-router-dom';
import styled from 'styled-components';

import { isLoggedIn, onLoginLogout } from '../../account/session';
import { database } from '../../common/database';
import * as models from '../../models';
import { defaultOrganization, Organization } from '../../models/organization';
import { isRemoteProject } from '../../models/project';
import { initializeProjectFromTeam } from '../../sync/vcs/initialize-model-from';
import { getVCS } from '../../sync/vcs/vcs';
import { AccountToolbar } from '../components/account-toolbar';
import { AppHeader } from '../components/app-header';
import { ErrorBoundary } from '../components/error-boundary';
import { OrganizationsNav } from '../components/organizations-navbar';
import { StatusBar } from '../components/statusbar';
import { Toast } from '../components/toast';
import { WorkspaceHeader } from '../components/workspace-header';
import { AppHooks } from '../containers/app-hooks';
import withDragDropContext from '../context/app/drag-drop-context';
import { NunjucksEnabledProvider } from '../context/nunjucks/nunjucks-enabled-context';
import Modals from './modals';
import { WorkspaceLoaderData } from './workspace';

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
    'Statusbar Statusbar' 30px [row-end]
    / 50px 1fr;
  `,
});

const Root = () => {
  const { revalidate } = useRevalidator();
  const workspaceData = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData | null;
  console.log({
    workspaceData,
  });
  useEffect(() => {
    onLoginLogout(() => {
      revalidate();
    });
  }, [revalidate]);

  return (
    <NunjucksEnabledProvider>
      <AppHooks />
      <div className="app">
        <ErrorBoundary showAlert>
          <Modals />
          <Layout>
            <OrganizationsNav />
            <AppHeader
              gridCenter={workspaceData ? <WorkspaceHeader {...workspaceData} /> : null}
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
  );
};

export default withDragDropContext(Root);
