import React, { Fragment } from 'react';
import { LoaderFunction, Outlet, redirect, useRouteLoaderData } from 'react-router-dom';
import styled from 'styled-components';

import { getCurrentSessionId } from '../../account/session';
import { Organization } from '../../models/organization';
import FileSystemDriver from '../../sync/store/drivers/file-system-driver';
import { MergeConflict } from '../../sync/types';
import { getVCS, initVCS } from '../../sync/vcs/vcs';
import { AccountToolbar } from '../components/account-toolbar';
import { AppHeader } from '../components/app-header';
import { showModal } from '../components/modals';
import { SyncMergeModal } from '../components/modals/sync-merge-modal';
import { OrganizationsNav } from '../components/organizations-navbar';
import { StatusBar } from '../components/statusbar';
import { WorkspaceHeader } from '../components/workspace-header';
import Modals from './modals';
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

export interface OrganizationLoaderData {
  organizations: Organization[];
  user: {
    name: string;
    picture: string;
  };
}

export const loader: LoaderFunction = async () => {
  const sessionId = getCurrentSessionId();

  if (!sessionId) {
    throw redirect('/auth/login');
  }

  // await migrateLocalToCloudProjects();
  try {
    let vcs = getVCS();
    if (!vcs) {
      const driver = FileSystemDriver.create(process.env['INSOMNIA_DATA_PATH'] || window.app.getPath('userData'));

      console.log('Initializing VCS');
      vcs = await initVCS(driver, async conflicts => {
        return new Promise(resolve => {
          showModal(SyncMergeModal, {
            conflicts,
            handleDone: (conflicts?: MergeConflict[]) => resolve(conflicts || []),
          });
        });
      });
    }

    // Teams are now organizations
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

    const user = await window.main.insomniaFetch<{
        name: string;
        picture: string;
      }>({
        method: 'GET',
        path: '/v1/user/profile',
        sessionId,
      });

    return {
      user,
      organizations: teams.map(team => ({
        _id: team.id,
        name: team.name,
        isPersonal: team.isPersonal,
      })).sort((a, b) => a.name.localeCompare(b.name)).sort((a, b) => {
        if (a.isPersonal && !b.isPersonal) {
          return -1;
        } else if (!a.isPersonal && b.isPersonal) {
          return 1;
        } else {
          return 0;
        }
      }),
    };
  } catch (err) {
    console.log('Failed to load Teams', err);
    return {
      user: {
        name: '',
        picture: '',
      },
      organizations: [],
    };
  }

  return {
    user: {
      name: '',
      picture: '',
    },
    organizations: [],
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

const OrganizationRoute = () => {
  const workspaceData = useRouteLoaderData(
    ':workspaceId'
  ) as WorkspaceLoaderData | null;

  const sessionId = getCurrentSessionId();
  if (!sessionId) {
    return null;
  }

  return (
    <Fragment>
      <Modals />
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
    </Fragment>
  );
};

export default OrganizationRoute;
