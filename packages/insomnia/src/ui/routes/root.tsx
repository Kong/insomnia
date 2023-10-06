import '../css/styles.css';

import { IpcRendererEvent } from 'electron';
import React, { useEffect, useState } from 'react';
import { LoaderFunction, Outlet, useFetcher, useParams, useRouteLoaderData } from 'react-router-dom';

import { isDevelopment } from '../../common/constants';
import * as models from '../../models';
import { Settings } from '../../models/settings';
import { reloadPlugins } from '../../plugins';
import { createPlugin } from '../../plugins/create';
import { setTheme } from '../../plugins/misc';
import { exchangeCodeForToken } from '../../sync/git/github-oauth-provider';
import { exchangeCodeForGitLabToken } from '../../sync/git/gitlab-oauth-provider';
import { ErrorBoundary } from '../components/error-boundary';
import { showError, showModal } from '../components/modals';
import { AlertModal } from '../components/modals/alert-modal';
import { AskModal } from '../components/modals/ask-modal';
import { ImportModal } from '../components/modals/import-modal';
import {
  SettingsModal,
  TAB_INDEX_PLUGINS,
  TAB_INDEX_THEMES,
} from '../components/modals/settings-modal';
import { AppHooks } from '../containers/app-hooks';
import { AIProvider } from '../context/app/ai-context';
import { NunjucksEnabledProvider } from '../context/nunjucks/nunjucks-enabled-context';
import Modals from './modals';

export interface RootLoaderData {
  settings: Settings;
  workspaceCount: number;
}

export const useRootLoaderData = () => {
  return useRouteLoaderData('root') as RootLoaderData;
};

export const loader: LoaderFunction = async (): Promise<RootLoaderData> => {
  const settings = await models.settings.get();
  const workspaceCount = await models.workspace.count();
  return {
    settings,
    workspaceCount,
  };
};

const Root = () => {
  const { organizationId, projectId } = useParams() as {
    organizationId: string;
    projectId: string;
  };

  const [importUri, setImportUri] = useState('');
  const actionFetcher = useFetcher();

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
            'insomnia://',
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
            actionFetcher.submit(
              {},
              {
                action: '/auth/logout',
                method: 'POST',
              },
            );
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
                    2,
                  )}];`;
                  await createPlugin(
                    `theme-${parsedTheme.name}`,
                    '0.0.1',
                    mainJsContent,
                  );
                  const settings = await models.settings.get();
                  await models.settings.update(settings, {
                    theme: parsedTheme.name,
                  });
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
              },
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
              },
            );
            break;
          }

          case 'insomnia://app/auth/finish': {
            actionFetcher.submit(
              {
                code: params.box,
              },
              {
                action: '/auth/authorize',
                method: 'POST',
                encType: 'application/json',
              },
            );
            break;
          }

          default: {
            console.log(`Unknown deep link: ${url}`);
          }
        }
      },
    );
  }, [actionFetcher]);

  return (
    <AIProvider>
      <NunjucksEnabledProvider>
        <ErrorBoundary>
          <div className="app">
            <Outlet />
          </div>
          <Modals />
          <AppHooks />
          {/* triggered by insomnia://app/import */}
          {importUri && (
            <ImportModal
              onHide={() => setImportUri('')}
              projectName="Insomnia"
              defaultProjectId={projectId}
              organizationId={organizationId}
              from={{ type: 'uri', defaultValue: importUri }}
            />
          )}
        </ErrorBoundary>
      </NunjucksEnabledProvider>
    </AIProvider>
  );
};

export default Root;
