import '../css/styles.css';

import type { IpcRendererEvent } from 'electron';
import React, { useEffect, useState } from 'react';
import {
  LoaderFunction,
  Outlet,
  useParams,
  useRevalidator,
  useRouteLoaderData,
} from 'react-router-dom';
import styled from 'styled-components';

import { getCurrentSessionId, isLoggedIn, onLoginLogout } from '../../account/session';
import { isDevelopment } from '../../common/constants';
import * as models from '../../models';
import { defaultOrganization, Organization } from '../../models/organization';
import { Settings } from '../../models/settings';
import { reloadPlugins } from '../../plugins';
import { createPlugin } from '../../plugins/create';
import { setTheme } from '../../plugins/misc';
import { exchangeCodeForToken } from '../../sync/git/github-oauth-provider';
import { exchangeCodeForGitLabToken } from '../../sync/git/gitlab-oauth-provider';
import FileSystemDriver from '../../sync/store/drivers/file-system-driver';
import { MergeConflict, Team } from '../../sync/types';
import { getVCS, initVCS } from '../../sync/vcs/vcs';
import { submitAuthCode } from '../auth-session-provider';
import { AccountToolbar } from '../components/account-toolbar';
import { AppHeader } from '../components/app-header';
import { ErrorBoundary } from '../components/error-boundary';
import { showError, showModal } from '../components/modals';
import { AlertModal } from '../components/modals/alert-modal';
import { AskModal } from '../components/modals/ask-modal';
import { ImportModal } from '../components/modals/import-modal';
import { LoginModal } from '../components/modals/login-modal';
import {
  SettingsModal,
  TAB_INDEX_PLUGINS,
  TAB_INDEX_THEMES,
} from '../components/modals/settings-modal';
import { SyncMergeModal } from '../components/modals/sync-merge-modal';
import { OrganizationsNav } from '../components/organizations-navbar';
import { StatusBar } from '../components/statusbar';
import { Toast } from '../components/toast';
import { WorkspaceHeader } from '../components/workspace-header';
import { AppHooks } from '../containers/app-hooks';
import { AIProvider } from '../context/app/ai-context';
import withDragDropContext from '../context/app/drag-drop-context';
import { PresenceProvider } from '../context/app/presence-context';
import { NunjucksEnabledProvider } from '../context/nunjucks/nunjucks-enabled-context';
import { useSettingsPatcher } from '../hooks/use-request';
import Modals from './modals';
import { WorkspaceLoaderData } from './workspace';

export interface RootLoaderData {
  organizations: Organization[];
  settings: Settings;
  user: {
    name: string;
    picture: string;
  };
}

export const loader: LoaderFunction = async (): Promise<RootLoaderData> => {
  // Load all projects if the user is logged in
  if (isLoggedIn()) {
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

      const sessionId = getCurrentSessionId();

      // Teams are now organizations
      const response = await window.main.insomniaFetch<{
        data: {
          teams: Team[];
        };
        errors?: {
          message: string;
        }[];
      }>({
        method: 'POST',
        path: '/graphql',
        sessionId,
        data: {
          query: `
          query {
            teams {
              id
              name
            }
          }
        `,
          variables: {},
        },
      });

      const teams = response.data.teams as Team[];

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
        organizations: [defaultOrganization, ...teams.map(team => ({
          _id: team.id,
          name: team.name,
        })).sort((a, b) => a.name.localeCompare(b.name))],
        settings: await models.settings.getOrCreate(),
      };
    } catch (err) {
      console.log('Failed to load Teams', err);
      return {
        user: {
          name: '',
          picture: '',
        },
        organizations: [defaultOrganization],
        settings: await models.settings.getOrCreate(),
      };
    }
  }

  return {
    user: {
      name: '',
      picture: '',
    },
    organizations: [defaultOrganization],
    settings: await models.settings.getOrCreate(),
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
  const [importUri, setImportUri] = useState('');
  const patchSettings = useSettingsPatcher();

  useEffect(() => {
    onLoginLogout(() => {
      revalidate();
    });
  }, [revalidate]);

  useEffect(() => {
    return window.main.on(
      'shell:open',
      async (_: IpcRendererEvent, url: string) => {
        // Get the url without params
        let parsedUrl;
        try {
          parsedUrl = new URL(url);
        } catch (err) {
          console.log('Invalid args, expected insomnia://x/y/z', url);
          return;
        }
        let urlWithoutParams = url.substring(0, url.indexOf('?')) || url;
        const params = Object.fromEntries(parsedUrl.searchParams);
        // Change protocol for dev redirects to match switch case
        if (isDevelopment()) {
          urlWithoutParams = urlWithoutParams.replace(
            'insomniadev://',
            'insomnia://'
          );
        }
        switch (urlWithoutParams) {
          case 'insomnia://app/alert':
            showModal(AlertModal, {
              title: params.title,
              message: params.message,
            });
            break;

          case 'insomnia://app/auth/login':
            showModal(LoginModal, {
              title: params.title,
              message: params.message,
              reauth: true,
            });
            break;

          case 'insomnia://app/import':
            setImportUri(params.uri);
            break;

          case 'insomnia://plugins/install':
            showModal(AskModal, {
              title: 'Plugin Install',
              message: (
                <>
                  Do you want to install <code>{params.name}</code>?
                </>
              ),
              yesText: 'Install',
              noText: 'Cancel',
              onDone: async (isYes: boolean) => {
                if (isYes) {
                  try {
                    await window.main.installPlugin(params.name);
                    showModal(SettingsModal, { tab: TAB_INDEX_PLUGINS });
                  } catch (err) {
                    showError({
                      title: 'Plugin Install',
                      message: 'Failed to install plugin',
                      error: err.message,
                    });
                  }
                }
              },
            });
            break;

          case 'insomnia://plugins/theme':
            const parsedTheme = JSON.parse(decodeURIComponent(params.theme));
            showModal(AskModal, {
              title: 'Install Theme',
              message: (
                <>
                  Do you want to install <code>{parsedTheme.displayName}</code>?
                </>
              ),
              yesText: 'Install',
              noText: 'Cancel',
              onDone: async (isYes: boolean) => {
                if (isYes) {
                  const mainJsContent = `module.exports.themes = [${JSON.stringify(
                    parsedTheme,
                    null,
                    2
                  )}];`;
                  await createPlugin(
                    `theme-${parsedTheme.name}`,
                    '0.0.1',
                    mainJsContent
                  );
                  patchSettings({ theme: parsedTheme.name });
                  await reloadPlugins();
                  await setTheme(parsedTheme.name);
                  showModal(SettingsModal, { tab: TAB_INDEX_THEMES });
                }
              },
            });
            break;

          case 'insomnia://oauth/github/authenticate': {
            const { code, state } = params;
            await exchangeCodeForToken({ code, state }).catch(
              (error: Error) => {
                showError({
                  error,
                  title: 'Error authorizing GitHub',
                  message: error.message,
                });
              }
            );
            break;
          }

          case 'insomnia://oauth/gitlab/authenticate': {
            const { code, state } = params;
            await exchangeCodeForGitLabToken({ code, state }).catch(
              (error: Error) => {
                showError({
                  error,
                  title: 'Error authorizing GitLab',
                  message: error.message,
                });
              }
            );
            break;
          }

          case 'insomnia://app/auth/finish': {
            submitAuthCode(params.box);
            break;
          }

          default: {
            console.log(`Unknown deep link: ${url}`);
          }
        }
      }
    );
  }, [patchSettings]);

  const { organizationId } = useParams() as {
    organizationId: string;
  };

  return (
    <PresenceProvider>
      <AIProvider>
        <NunjucksEnabledProvider>
          <AppHooks />
          <div className="app">
            <ErrorBoundary showAlert>
              <Modals />
              {/* triggered by insomnia://app/import */}
              {importUri && (
                <ImportModal
                  onHide={() => setImportUri('')}
                  projectName="Insomnia"
                  organizationId={organizationId}
                  from={{ type: 'uri', defaultValue: importUri }}
                />
              )}
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

export default withDragDropContext(Root);
