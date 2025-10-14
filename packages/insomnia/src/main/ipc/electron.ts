import { mkdirSync } from 'node:fs';

import type {
  IpcMainEvent,
  IpcMainInvokeEvent,
  MenuItemConstructorOptions,
  OpenDialogOptions,
  SaveDialogOptions,
} from 'electron';
import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, shell } from 'electron';
import { localTemplateTags } from 'insomnia/src/templating/local-template-tags';

import { fnOrString } from '../../common/misc';
import {
  type NunjucksParsedTagArg,
  type NunjucksTagContextMenuAction,
  type PluginTemplateTag,
} from '../../templating/types';
import type { extractNunjucksTagFromCoords } from '../../templating/utils';
import { invariant } from '../../utils/invariant';

export type HandleChannels =
  | 'authorizeUserInDefaultBrowser'
  | 'authorizeUserInWindow'
  | 'backup'
  | 'cancelAuthorizationInDefaultBrowser'
  | 'generateMockRouteDataFromSpec'
  | 'generateCommitsFromDiff'
  | 'curl.event.findMany'
  | 'curl.open'
  | 'curl.readyState'
  | 'curlRequest'
  | 'database.caCertificate.create'
  | 'extractJsonFileFromPostmanDataDumpArchive'
  | 'getExecution'
  | 'getLocalStorageDataFromFileOrigin'
  | 'git.canPushLoader'
  | 'git.checkoutGitBranch'
  | 'git.cloneGitRepo'
  | 'git.commitAndPushToGitRepo'
  | 'git.commitToGitRepo'
  | 'git.multipleCommitToGitRepo'
  | 'git.completeSignInToGitHub'
  | 'git.completeSignInToGitLab'
  | 'git.continueMerge'
  | 'git.createNewGitBranch'
  | 'git.deleteGitBranch'
  | 'git.diffFileLoader'
  | 'git.discardChanges'
  | 'git.abortMerge'
  | 'git.fetchGitRemoteBranches'
  | 'git.getGitBranches'
  | 'git.getGitHubRepositories'
  | 'git.getGitHubRepository'
  | 'git.getRepositoryDirectoryTree'
  | 'git.gitChangesLoader'
  | 'git.gitFetchAction'
  | 'git.gitLogLoader'
  | 'git.gitStatus'
  | 'git.diff'
  | 'git.initGitRepoClone'
  | 'git.initSignInToGitHub'
  | 'git.initSignInToGitLab'
  | 'git.loadGitRepository'
  | 'git.mergeGitBranch'
  | 'git.migrateLegacyInsomniaFolderToFile'
  | 'git.pullFromGitRemote'
  | 'git.pushToGitRemote'
  | 'git.resetGitRepo'
  | 'git.signOutOfGitHub'
  | 'git.signOutOfGitLab'
  | 'git.stageChanges'
  | 'git.unstageChanges'
  | 'git.updateGitRepo'
  | 'grpc.loadMethods'
  | 'grpc.loadMethodsFromReflection'
  | 'installPlugin'
  | 'lintSpec'
  | 'llm.getActiveBackend'
  | 'llm.setActiveBackend'
  | 'llm.clearActiveBackend'
  | 'llm.getBackendConfig'
  | 'llm.updateBackendConfig'
  | 'llm.getAllConfigurations'
  | 'llm.getCurrentConfig'
  | 'llm.getAIFeatureEnabled'
  | 'llm.setAIFeatureEnabled'
  | 'onDefaultBrowserOAuthRedirect'
  | 'open-channel-to-hidden-browser-window'
  | 'parseImport'
  | 'openPath'
  | 'readCurlResponse'
  | 'readOrCreateDataDir'
  | 'readDir'
  | 'insecureReadFile'
  | 'insecureReadFileWithEncoding'
  | 'secureReadFile'
  | 'restoreBackup'
  | 'secretStorage.decryptString'
  | 'secretStorage.deleteSecret'
  | 'secretStorage.encryptString'
  | 'secretStorage.getSecret'
  | 'secretStorage.setSecret'
  | 'showOpenDialog'
  | 'showSaveDialog'
  | 'socketIO.event.findMany'
  | 'socketIO.event.send'
  | 'socketIO.open'
  | 'socketIO.readyState'
  | 'webSocket.event.findMany'
  | 'webSocket.event.send'
  | 'webSocket.open'
  | 'webSocket.readyState'
  | 'writeFile';

export const ipcMainHandle = (
  channel: HandleChannels,
  listener: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<void> | any,
) => ipcMain.handle(channel, listener);
export type MainOnChannels =
  | 'addExecutionStep'
  | 'cancelCurlRequest'
  | 'clear'
  | 'completeExecutionStep'
  | 'curl.close'
  | 'curl.closeAll'
  | 'getAppPath'
  | 'getPath'
  | 'grpc.cancel'
  | 'grpc.closeAll'
  | 'grpc.commit'
  | 'grpc.sendMessage'
  | 'grpc.start'
  | 'loginStateChange'
  | 'manualUpdateCheck'
  | 'openDeepLink'
  | 'openInBrowser'
  | 'readText'
  | 'restart'
  | 'set-hidden-window-busy-status'
  | 'setMenuBarVisibility'
  | 'show-nunjucks-context-menu'
  | 'showContextMenu'
  | 'showItemInFolder'
  | 'showOpenDialog'
  | 'showSaveDialog'
  | 'socketIO.close'
  | 'socketIO.closeAll'
  | 'socketIO.event.off'
  | 'socketIO.event.on'
  | 'startExecution'
  | 'trackPageView'
  | 'trackSegmentEvent'
  | 'updateLatestStepName'
  | 'webSocket.close'
  | 'webSocket.closeAll'
  | 'writeText';

export type RendererOnChannels =
  | 'contextMenuCommand'
  | 'db.changes'
  | 'grpc.data'
  | 'grpc.end'
  | 'grpc.error'
  | 'grpc.start'
  | 'grpc.status'
  | 'loggedIn'
  | 'mainWindowFocusChange'
  | 'nunjucks-context-menu-command'
  | 'nunjucks-context-menu-command'
  | 'reload-plugins'
  | 'shell:open'
  | 'show-notification'
  | 'show-toast'
  | 'toggle-preferences-shortcuts'
  | 'toggle-preferences'
  | 'toggle-sidebar';

export const ipcMainOn = (
  channel: MainOnChannels,
  listener: (event: IpcMainEvent, ...args: any[]) => Promise<void> | any,
) => ipcMain.on(channel, listener);
export type OnceChannels = 'halfSecondAfterAppStart';
export const ipcMainOnce = (
  channel: OnceChannels,
  listener: (event: IpcMainEvent, ...args: any[]) => Promise<void> | any,
) => ipcMain.once(channel, listener);

const getTemplateValue = (arg: NunjucksParsedTagArg) => {
  if (arg.defaultValue === undefined) {
    return "''";
  }
  if (typeof arg.defaultValue === 'string') {
    return `'${arg.defaultValue}'`;
  }
  return arg.defaultValue;
};
export function registerElectronHandlers() {
  ipcMainOn(
    'show-nunjucks-context-menu',
    (
      event,
      options: {
        key: string;
        nunjucksTag: ReturnType<typeof extractNunjucksTagFromCoords>;
        pluginTemplateTags?: { templateTag: PluginTemplateTag }[];
      },
    ) => {
      const { key, nunjucksTag, pluginTemplateTags = [] } = options;
      const sendNunjuckTagContextMsg = (type: NunjucksTagContextMenuAction) => {
        event.sender.send('nunjucks-context-menu-command', { key, nunjucksTag: { ...nunjucksTag, type } });
      };
      try {
        const baseTemplate: MenuItemConstructorOptions[] = nunjucksTag
          ? [
              {
                label: 'Edit',
                click: () => sendNunjuckTagContextMsg('edit'),
              },
              {
                label: 'Copy',
                click: () => {
                  clipboard.writeText(nunjucksTag.template);
                },
              },
              {
                label: 'Cut',
                click: () => {
                  clipboard.writeText(nunjucksTag.template);
                  sendNunjuckTagContextMsg('delete');
                },
              },
              {
                label: 'Delete',
                click: () => sendNunjuckTagContextMsg('delete'),
              },
              { type: 'separator' },
            ]
          : [
              {
                role: 'cut',
              },
              {
                role: 'copy',
              },
              {
                role: 'paste',
              },
              { type: 'separator' },
            ];
        const localTemplate: MenuItemConstructorOptions[] = [...localTemplateTags, ...pluginTemplateTags]
          // sort alphabetically
          .sort((a, b) => fnOrString(a.templateTag.displayName).localeCompare(fnOrString(b.templateTag.displayName)))
          .map(l => {
            const actions = l.templateTag.args?.[0];
            const needsEnterprisePlan = l.templateTag.needsEnterprisePlan || false;
            const additionalArgs = l.templateTag.args?.slice(1);
            const hasSubmenu = actions?.options?.length;
            return {
              label: fnOrString(l.templateTag.displayName),
              ...(!hasSubmenu
                ? {
                    click: () => {
                      const tag = `{% ${l.templateTag.name} ${l.templateTag.args?.map(getTemplateValue).join(', ')} %}`;
                      const displayName = l.templateTag.displayName;
                      event.sender.send('nunjucks-context-menu-command', {
                        key,
                        tag,
                        needsEnterprisePlan,
                        displayName,
                      });
                    },
                  }
                : {
                    submenu: actions?.options?.map(action => ({
                      label: fnOrString(action.displayName),
                      click: () => {
                        const additionalTagFields = additionalArgs.length
                          ? ', ' + additionalArgs.map(getTemplateValue).join(', ')
                          : '';
                        const displayName = action.displayName;
                        const tag = `{% ${l.templateTag.name} '${action.value}'${additionalTagFields} %}`;
                        event.sender.send('nunjucks-context-menu-command', {
                          key,
                          tag,
                          needsEnterprisePlan,
                          displayName,
                        });
                      },
                    })),
                  }),
            };
          });
        const menu = Menu.buildFromTemplate([...baseTemplate, ...localTemplate]);
        const win = BrowserWindow.fromWebContents(event.sender);
        invariant(win, 'expected window');
        menu.popup({ window: win });
      } catch (e) {
        console.error(e);
      }
    },
  );
  ipcMainOn('setMenuBarVisibility', (_, visible: boolean) => {
    BrowserWindow.getAllWindows().forEach(window => {
      // the `setMenuBarVisibility` signature uses `visible` semantics
      window.setMenuBarVisibility(visible);
      // the `setAutoHideMenu` signature uses `hide` semantics
      const hide = !visible;
      window.setAutoHideMenuBar(hide);
    });
  });
  ipcMainHandle('showOpenDialog', async (_, options: OpenDialogOptions) => {
    const { filePaths, canceled } = await dialog.showOpenDialog(options);
    return { filePaths, canceled };
  });

  ipcMainHandle('showSaveDialog', async (_, options: SaveDialogOptions) => {
    const { filePath, canceled } = await dialog.showSaveDialog(options);
    return { filePath, canceled };
  });

  ipcMainOn('showItemInFolder', (_, name: string) => {
    shell.showItemInFolder(name);
  });

  ipcMainHandle('openPath', async (_, name: string) => {
    mkdirSync(name, { recursive: true });
    return shell.openPath(name);
  });

  ipcMainOn('readText', event => {
    event.returnValue = clipboard.readText();
  });

  ipcMainOn('writeText', (_, text: string) => {
    clipboard.writeText(text);
  });

  ipcMainOn('clear', () => {
    clipboard.clear();
  });

  ipcMainOn('getPath', (event, name: Parameters<(typeof Electron.app)['getPath']>[0]) => {
    event.returnValue = app.getPath(name);
  });

  ipcMainOn('getAppPath', event => {
    event.returnValue = app.getAppPath();
  });

  ipcMainOn(
    'showContextMenu',
    (event, options: { key: string; menuItems: MenuItemConstructorOptions[]; extra?: Record<string, any> }) => {
      const menuItems = options.menuItems.map(item => {
        return {
          ...item,
          click: () => {
            event.sender.send('contextMenuCommand', { key: options.key, label: item.label, extra: options.extra });
          },
        };
      });
      const menu = Menu.buildFromTemplate(menuItems);
      menu.popup();
    },
  );
}
