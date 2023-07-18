import React from 'react';
import { LoaderFunction, Outlet, redirect, useRouteLoaderData } from 'react-router-dom';
import styled from 'styled-components';

import { getCurrentSessionId, isLoggedIn } from '../../account/session';
import { AccountToolbar } from '../components/account-toolbar';
import { AppHeader } from '../components/app-header';
import { OrganizationsNav } from '../components/organizations-navbar';
import { StatusBar } from '../components/statusbar';
import { WorkspaceHeader } from '../components/workspace-header';
import { WorkspaceLoaderData } from './workspace';

export const indexLoader: LoaderFunction = async () => {
  const sessionId = getCurrentSessionId();
  if (!sessionId) {
    throw redirect('/auth/login');
  }

  const teams = await window.main.insomniaFetch<{
    created: string;
    id: string;
    ownerAccountId: string;
    name: string;
    isPersonal: boolean;
    accounts: {
      firstName: string;
      lastName: string;
      email: string;
      id: string;
      isAdmin: boolean;
      dateAccepted: string;
    }[];
  }[]>({
    method: 'GET',
    path: '/api/teams',
    sessionId,
  });

  const personalTeam = teams.find(team => team.isPersonal);

  if (personalTeam) {
    return redirect(`/organization/${personalTeam.id}`);
  }

  return null;
};

export const loader: LoaderFunction = () => {
  if (!isLoggedIn()) {
    throw redirect('/auth/login');
  }

  return null;
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

const Organization = () => {
  const workspaceData = useRouteLoaderData(
    ':workspaceId'
  ) as WorkspaceLoaderData | null;

  const sessionId = getCurrentSessionId();
  if (!sessionId) {
    return null;
  }

  return (
    <Layout>
      <OrganizationsNav />
      <AppHeader
        gridCenter={
          workspaceData ? <WorkspaceHeader {...workspaceData} /> : null
        }
        gridRight={<AccountToolbar />}
      />
      <Outlet />
      <StatusBar />
    </Layout>
  );
};

export default Organization;
