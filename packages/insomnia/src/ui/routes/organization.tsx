import React, { Fragment } from 'react';
import { Link, LoaderFunction, Outlet, redirect, useNavigate, useRouteLoaderData } from 'react-router-dom';

import { getCurrentSessionId, isLoggedIn } from '../../account/session';
import * as models from '../../models';
import { Settings } from '../../models/settings';
import { isScratchpad } from '../../models/workspace';
import FileSystemDriver from '../../sync/store/drivers/file-system-driver';
import { MergeConflict } from '../../sync/types';
import { getVCS, initVCS } from '../../sync/vcs/vcs';
import { AccountToolbar } from '../components/account-toolbar';
import { AppHeader } from '../components/app-header';
import { ErrorBoundary } from '../components/error-boundary';
import { showModal } from '../components/modals';
import { SyncMergeModal } from '../components/modals/sync-merge-modal';
import { OrganizationsNav } from '../components/organizations-navbar';
import { StatusBar } from '../components/statusbar';
import { Button } from '../components/themed-button';
import { Toast } from '../components/toast';
import { WorkspaceHeader } from '../components/workspace-header';
import { AppHooks } from '../containers/app-hooks';
import { AIProvider } from '../context/app/ai-context';
import { PresenceProvider } from '../context/app/presence-context';
import { NunjucksEnabledProvider } from '../context/nunjucks/nunjucks-enabled-context';
import { WorkspaceLoaderData } from './workspace';

interface OrganizationsResponse {
  start: number;
  limit: number;
  length: number;
  total: number;
  next: string;
  organizations: Organization[];
}

interface Organization {
  id: string;
  name: string;
  display_name: string;
  branding: Branding;
  metadata: Metadata;
}

interface Branding {
  logo_url: string;
}

export interface Metadata {
  organizationType: string;
}

export const isPersonalOrganization = (organization: Organization) => organization.metadata.organizationType === 'personal';

export const indexLoader: LoaderFunction = async () => {
  const sessionId = getCurrentSessionId();
  if (sessionId) {
    try {
      const { organizations } = await window.main.insomniaFetch<OrganizationsResponse>({
        method: 'GET',
        path: '/v1/organizations',
        sessionId,
      });

      const personalOrganization = organizations.find(isPersonalOrganization);

      if (personalOrganization) {
        return redirect(`/organization/${personalOrganization.id}`);
      }
    } catch (error) {
      console.log('Failed to load Teams', error);
      return null;
    }
  }

  return null;
};

export interface OrganizationLoaderData {
  organizations: Organization[];
  user: {
    name: string;
    picture: string;
  };
  settings: Settings;
}

export const loader: LoaderFunction = async () => {
  const sessionId = getCurrentSessionId();

  if (sessionId) {
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

      const { organizations } = await window.main.insomniaFetch<OrganizationsResponse>({
        method: 'GET',
        path: '/v1/organizations',
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
        settings: await models.settings.getOrCreate(),
        organizations: organizations.sort((a, b) => a.name.localeCompare(b.name)).sort((a, b) => {
          if (isPersonalOrganization(a) && !isPersonalOrganization(b)) {
            return -1;
          } else if (!isPersonalOrganization(a) && isPersonalOrganization(b)) {
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
        settings: await models.settings.getOrCreate(),
        organizations: [],
      };
    }
  }

  return {
    user: {
      name: '',
      picture: '',
    },
    settings: await models.settings.getOrCreate(),
    organizations: [],
  };
};

const OrganizationRoute = () => {
  const workspaceData = useRouteLoaderData(
    ':workspaceId'
  ) as WorkspaceLoaderData | null;

  const navigate = useNavigate();

  const isScratchpadWorkspace = workspaceData?.activeWorkspace && isScratchpad(workspaceData.activeWorkspace);

  return (
    <PresenceProvider>
      <AIProvider>
        <NunjucksEnabledProvider>
          <AppHooks />
          <div className="app">
            <ErrorBoundary showAlert>
              <div className={`relative h-full w-full grid ${isScratchpadWorkspace ? 'app-grid-template-with-banner' : 'app-grid-template'}`}>
                <OrganizationsNav />
                <AppHeader
                  gridCenter={
                    isLoggedIn() && workspaceData ? <WorkspaceHeader {...workspaceData} /> : null
                  }
                  gridRight={isLoggedIn() ? <AccountToolbar /> : (
                    <Fragment>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={
                          () => navigate('/auth/login')
                        }
                      >
                        Log in
                      </Button>
                      <Button
                        onClick={() => navigate('/auth/login')}
                        size="small"
                        variant="contained"
                      >
                        Sign Up
                      </Button>
                    </Fragment>
                  )
                  }
                />
                {isScratchpadWorkspace ? (
                  <div className='flex items-center [grid-area:Banner] text-white bg-gradient-to-r from-[#7400e1] to-[#4000bf]'>
                    <div className='flex basis-[50px] h-full'>
                      <div
                        className='border-solid border-r-[--hl-xl] border-r border-l border-l-[--hl-xl] box-border flex items-center justify-center w-full h-full'
                      >
                        <i className="fa fa-edit" />
                      </div>
                    </div>
                    <div className='flex items-center px-[--padding-md] gap-[--padding-xs]'>
                      Welcome to the Scratch Pad. To get the most out of Insomnia
                      <Link
                        to="/auth/login"
                        className="font-bold text-white"
                      >
                        go to your projects →
                      </Link>
                    </div>
                  </div>
                ) : null}
                <Outlet />
                <StatusBar />
              </div>
            </ErrorBoundary>

            <ErrorBoundary showAlert>
              <Toast />
            </ErrorBoundary>
          </div>
        </NunjucksEnabledProvider>
      </AIProvider>
    </PresenceProvider>
  );
};

export default OrganizationRoute;
