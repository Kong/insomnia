import '../css/styles.css';

import type { IpcRendererEvent } from 'electron';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-aria-components';
import {
  LoaderFunction,
  NavLink,
  Outlet,
  useLoaderData,
  useParams,
  useRevalidator,
  useRouteLoaderData,
} from 'react-router-dom';

import { isLoggedIn, onLoginLogout } from '../../account/session';
import { isDevelopment } from '../../common/constants';
import { database } from '../../common/database';
import * as models from '../../models';
import {
  defaultOrganization,
  isDefaultOrganization,
  Organization } from '../../models/organization';
import { isRemoteProject } from '../../models/project';
import { Settings } from '../../models/settings';
import { reloadPlugins } from '../../plugins';
import { createPlugin } from '../../plugins/create';
import { setTheme } from '../../plugins/misc';
import { exchangeCodeForToken } from '../../sync/git/github-oauth-provider';
import { exchangeCodeForGitLabToken } from '../../sync/git/gitlab-oauth-provider';
import { initializeProjectFromTeam } from '../../sync/vcs/initialize-model-from';
import { getVCS } from '../../sync/vcs/vcs';
import { submitAuthCode } from '../auth-session-provider';
import { AccountToolbar } from '../components/account-toolbar';
import { AppHeader } from '../components/app-header';
import { SettingsButton } from '../components/buttons/settings-button';
import { Icon } from '../components/icon';
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
import { Toast } from '../components/toast';
import { WorkspaceHeader } from '../components/workspace-header';
import { AppHooks } from '../containers/app-hooks';
import { AIProvider } from '../context/app/ai-context';
import withDragDropContext from '../context/app/drag-drop-context';
import { NunjucksEnabledProvider } from '../context/nunjucks/nunjucks-enabled-context';
import { useSettingsPatcher } from '../hooks/use-request';
import Modals from './modals';
import { WorkspaceLoaderData } from './workspace';

export interface RootLoaderData {
  organizations: Organization[];
  settings: Settings;
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

  const remoteOrgs = allProjects
    .filter(isRemoteProject)
    .map(({ _id, name }) => ({
      _id,
      name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    organizations: [defaultOrganization, ...remoteOrgs],
    settings: await models.settings.getOrCreate(),
  };
};

const getNameInitials = (name: string) => {
  // Split on whitespace and take first letter of each word
  const words = name.toUpperCase().split(' ');
  const firstWord = words[0];
  const lastWord = words[words.length - 1];

  // If there is only one word, just take the first letter
  if (words.length === 1) {
    return firstWord.charAt(0);
  }

  // If the first word is an emoji or an icon then just use that
  const iconMatch = firstWord.match(/\p{Extended_Pictographic}/u);
  if (iconMatch) {
    return iconMatch[0];
  }

  return `${firstWord.charAt(0)}${lastWord ? lastWord.charAt(0) : ''}`;
};

const Root = () => {
  const { revalidate } = useRevalidator();
  const { organizations } = useLoaderData() as RootLoaderData;
  const workspaceData = useRouteLoaderData(
    ':workspaceId'
  ) as WorkspaceLoaderData | null;
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
    <AIProvider>
      <NunjucksEnabledProvider>
        <AppHooks />
        <div className="app">
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
          <div className="w-full h-full divide-x divide-solid divide-y divide-[--hl-md] grid-template-app-layout grid relative bg-[--color-bg]">
            <AppHeader
              gridCenter={
                workspaceData ? <WorkspaceHeader {...workspaceData} /> : null
              }
              gridRight={<AccountToolbar />}
            />
            <div className="[grid-area:Navbar]">
              <nav className="flex flex-col items-center gap-[--padding-md] w-full h-full overflow-y-auto py-[--padding-md]">
                {organizations.map(organization => (
                  <NavLink
                    className={({ isActive }) =>
                      `select-none text-[--color-font-surprise] hover:no-underline transition-all duration-150 bg-gradient-to-br box-border from-[#4000BF] to-[#154B62] p-[--padding-sm] font-bold outline-[3px] rounded-md w-[28px] h-[28px] flex items-center justify-center active:outline overflow-hidden outline-offset-[3px] outline ${
                        isActive
                          ? 'outline-[--color-font]'
                          : 'outline-transparent focus:outline-[--hl-md] hover:outline-[--hl-md]'
                      }`
                    }
                    key={organization._id}
                    to={`/organization/${organization._id}`}
                  >
                    {isDefaultOrganization(organization) ? (
                      <Icon icon="home" />
                    ) : (
                      getNameInitials(organization.name)
                    )}
                  </NavLink>
                ))}
              </nav>
            </div>
            <Outlet />
            <div className="relative [grid-area:Statusbar] flex items-center justify-between overflow-hidden">
              <SettingsButton />
              <Link>
                <a
                  className="flex gap-1 items-center text-xs text-[--color-font] px-[--padding-md]"
                  href="https://konghq.com/"
                >
                  Made with
                  <Icon className="text-[--color-surprise]" icon="heart" /> by
                  Kong
                </a>
              </Link>
            </div>
          </div>

          <Toast />
        </div>
      </NunjucksEnabledProvider>
    </AIProvider>
  );
};

export default withDragDropContext(Root);
