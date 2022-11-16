import { IpcRendererEvent } from 'electron/renderer';
import { useEffect } from 'react';
import React from 'react';
import { useSelector } from 'react-redux';

import { isDevelopment } from '../../common/constants';
import { askToImportIntoProject, askToImportIntoWorkspace, askToSetWorkspaceScope, importUri } from '../../common/import';
import * as models from '../../models';
import { reloadPlugins } from '../../plugins';
import { createPlugin } from '../../plugins/create';
import { setTheme } from '../../plugins/misc';
import { exchangeCodeForToken } from '../../sync/git/github-oauth-provider';
import { exchangeCodeForGitLabToken } from '../../sync/git/gitlab-oauth-provider';
import { submitAuthCode } from '../auth-session-provider';
import { showError, showModal } from '../components/modals';
import { AlertModal } from '../components/modals/alert-modal';
import { AskModal } from '../components/modals/ask-modal';
import { LoginModal } from '../components/modals/login-modal';
import {
  SettingsModal,
  TAB_INDEX_PLUGINS,
  TAB_INDEX_THEMES,
} from '../components/modals/settings-modal';
import { selectActiveProject, selectActiveWorkspace, selectProjects, selectWorkspacesWithResolvedNameForActiveProject } from '../redux/selectors';

export const useAppCommands = () => {
  const activeWorkspace = useSelector(selectActiveWorkspace);
  const activeProject = useSelector(selectActiveProject);
  const activeProjectWorkspaces = useSelector(selectWorkspacesWithResolvedNameForActiveProject);
  const projects = useSelector(selectProjects);
  useEffect(() => {
    return window.main.on('shell:open', async (_: IpcRendererEvent, url: string) => {
      // Get the url without params
      let urlWithoutParams = url.substring(0, url.indexOf('?')) || url;
      const params = Object.fromEntries(new URL(url).searchParams);
      // Change protocol for dev redirects to match switch case
      if (isDevelopment()) {
        urlWithoutParams = urlWithoutParams.replace('insomniadev://', 'insomnia://');
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
          showModal(AlertModal, {
            title: 'Confirm Data Import',
            message: (
              <span>
                Do you really want to import {params.name && (<><code>{params.name}</code> from</>)} <code>{params.uri}</code>?
              </span>
            ),
            addCancel: true,
            onConfirm: async () => {
              const activeWorkspaceId = activeWorkspace?._id;
              importUri(params.uri, {
                getWorkspaceScope: askToSetWorkspaceScope(),
                getWorkspaceId: askToImportIntoWorkspace({ workspaceId: params.workspaceId || activeWorkspaceId, activeProjectWorkspaces }),
                // Currently, just return the active project instead of prompting for which project to import into
                getProjectId: askToImportIntoProject({ projects, activeProject }),
              });
            },
          });
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
                await createPlugin(`theme-${parsedTheme.name}`, '0.0.1', mainJsContent);
                const settings = await models.settings.getOrCreate();
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
          await exchangeCodeForToken({ code, state }).catch((error: Error) => {
            showError({
              error,
              title: 'Error authorizing GitHub',
              message: error.message,
            });
          });
          break;
        }

        case 'insomnia://oauth/gitlab/authenticate': {
          const { code, state } = params;
          await exchangeCodeForGitLabToken({ code, state }).catch((error: Error) => {
            showError({
              error,
              title: 'Error authorizing GitLab',
              message: error.message,
            });
          });
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
    });
  }, [activeProject, activeProjectWorkspaces, activeWorkspace?._id, projects]);
};
