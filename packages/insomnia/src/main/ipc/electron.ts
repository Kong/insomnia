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
import { type NunjucksParsedTagArg, type NunjucksTagContextMenuAction } from '../../templating/types';
import type { extractNunjucksTagFromCoords } from '../../templating/utils';
import { invariant } from '../../utils/invariant';

export type HandleChannels =
  | 'authorizeUserInDefaultBrowser'
  | 'authorizeUserInWindow'
  | 'backup'
  | 'cancelAuthorizationInDefaultBrowser'
  | 'generateCodeSnippet'
  | 'getCodeSnippetTargets'
  | 'generateMockRouteDataFromSpec'
  | 'generateCommitsFromDiff'
  | 'generateMcpSamplingResponse'
  | 'curl.event.findMany'
  | 'curl.open'
  | 'curl.readyState'
  | 'createPlugin'
  | 'curlRequest'
  | 'database.caCertificate.create'
  | 'services.invoke'
  | 'extractJsonFileFromPostmanDataDumpArchive'
  | 'generateCommitsFromDiff'
  | 'generateMockRouteDataFromSpec'
  | 'getAuthHeader'
  | 'getOAuth2Token'
  | 'getExecution'
  | 'getLocalStorageDataFromFileOrigin'
  | 'git.abortMerge'
  | 'git.canPushLoader'
  | 'git.checkoutGitBranch'
  | 'git.cloneGitRepo'
  | 'git.commitAndPushToGitRepo'
  | 'git.commitToGitRepo'
  | 'git.continueMerge'
  | 'git.createNewGitBranch'
  | 'git.deleteGitBranch'
  | 'git.diff'
  | 'git.diffFileLoader'
  | 'git.discardChanges'
  | 'git.fetchGitRemoteBranches'
  | 'git.getProjectGitFileIssues'
  | 'git.validateGitRepositoryCredentials'
  | 'git.validateGitCredentialById'
  | 'git.getGitBranches'
  | 'git.getRepositoryDirectoryTree'
  | 'git.gitChangesLoader'
  | 'git.gitFetchAction'
  | 'git.gitLogLoader'
  | 'git.gitStatus'
  | 'git.initGitRepoClone'
  | 'git.loadGitRepository'
  | 'git.mergeGitBranch'
  | 'git.migrateLegacyInsomniaFolderToFile'
  | 'git.multipleCommitToGitRepo'
  | 'git.pullFromGitRemote'
  | 'git.pushToGitRemote'
  | 'git.resetGitRepo'
  | 'git.runAllGitRepoMigrations'
  | 'git.getCurrentBranchByRepositoryId'
  | 'git.getBranchRemoteInfo'
  | 'git.stageChanges'
  | 'git.unstageChanges'
  | 'git.updateGitRepo'
  | 'git.listGitProviders'
  | 'git.initSignInToGitProvider'
  | 'git.completeSignInToGitProvider'
  | 'git.getGitProviderRepositories'
  | 'git.getGitProviderEmails'
  | 'grpc.loadMethods'
  | 'grpc.loadMethodsFromReflection'
  | 'grpc.writeProtoFile'
  | 'initializeWorkspaceBackendProject'
  | 'insecureReadFile'
  | 'insecureReadFileWithEncoding'
  | 'installPlugin'
  | 'lintSpec'
  | 'bundleSpectralRuleset'
  | 'llm.clearActiveBackend'
  | 'llm.getActiveBackend'
  | 'llm.getAIFeatureEnabled'
  | 'llm.getAllConfigurations'
  | 'llm.getBackendConfig'
  | 'llm.getCurrentConfig'
  | 'llm.setActiveBackend'
  | 'llm.setAIFeatureEnabled'
  | 'llm.updateBackendConfig'
  | 'mcp.client.cancelRequest'
  | 'mcp.client.hasRequestResponded'
  | 'mcp.close'
  | 'mcp.connect'
  | 'mcp.event.findMany'
  | 'mcp.event.findNotifications'
  | 'mcp.event.findPendingEvents'
  | 'mcp.notification.rootListChange'
  | 'mcp.notification.rootListChange'
  | 'mcp.primitive.callTool'
  | 'mcp.primitive.getPrompt'
  | 'mcp.primitive.listPrompts'
  | 'mcp.primitive.listResources'
  | 'mcp.primitive.listResourceTemplates'
  | 'mcp.primitive.listTools'
  | 'mcp.primitive.readResource'
  | 'mcp.primitive.subscribeResource'
  | 'mcp.primitive.unsubscribeResource'
  | 'mcp.readyState'
  | 'multipartBufferToArray'
  | 'onDefaultBrowserOAuthRedirect'
  | 'open-channel-to-hidden-browser-window'
  | 'plugins.applyRequestHooks'
  | 'plugins.applyResponseHooks'
  | 'plugins.executeAction'
  | 'plugins.executePluginMainAction'
  | 'plugins.getActivePlugins'
  | 'plugins.getBridgeMetrics'
  | 'plugins.getBundlePlugins'
  | 'plugins.getDocumentActions'
  | 'plugins.getPlugins'
  | 'plugins.getRequestActions'
  | 'plugins.getRequestGroupActions'
  | 'plugins.getTemplateTags'
  | 'plugins.getThemes'
  | 'plugins.getWorkspaceActions'
  | 'plugins.hasRequestHooks'
  | 'plugins.hasResponseHooks'
  | 'plugins.reloadPlugins'
  | 'plugins.runTemplateTagAction'
  | 'plugins.uiPrompt'
  | 'openPath'
  | 'parseImport'
  | 'readCurlResponse'
  | 'readDir'
  | 'readOrCreateDataDir'
  | 'restoreBackup'
  | 'electronStorage.getItem'
  | 'electronStorage.setItem'
  | 'secretStorage.decryptString'
  | 'secretStorage.deleteSecret'
  | 'secretStorage.encryptString'
  | 'secretStorage.getSecret'
  | 'secretStorage.setSecret'
  | 'secureReadFile'
  | 'showOpenDialog'
  | 'showSaveDialog'
  | 'socketIO.event.findMany'
  | 'socketIO.event.send'
  | 'syncNewWorkspaceIfNeeded'
  | 'sync.invoke'
  | 'sync.pullRemoteBackendProject'
  | 'socketIO.open'
  | 'socketIO.readyState'
  | 'webSocket.event.findMany'
  | 'webSocket.event.send'
  | 'webSocket.open'
  | 'webSocket.readyState'
  | 'timeline.appendToFile'
  | 'timeline.getPath'
  | 'writeFile'
  | 'deleteRulesetFile'
  | 'writeResponseBodyToFile'
  | 'vault.encryptSecretValue'
  | 'vault.decryptSecretValue';

export const ipcMainHandle = (
  channel: HandleChannels,
  listener: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<void> | any,
) => ipcMain.handle(channel, listener);
export type MainOnChannels =
  | 'addExecutionStep'
  | 'analytics.setOrganizationId'
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
  | 'path.basename'
  | 'path.dirname'
  | 'path.join'
  | 'path.resolve'
  | 'readText'
  | 'restart'
  | 'plugins.invokeResult'
  | 'plugins.windowReady'
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
  | 'trackAnalyticsEvent'
  | 'updateLatestStepName'
  | 'webSocket.close'
  | 'webSocket.closeAll'
  | 'mcp.closeAll'
  | 'mcp.client.responseElicitationRequest'
  | 'mcp.client.responseSamplingRequest'
  | 'sync.cancelConflict'
  | 'sync.resolveConflict'
  | 'mcp.sendMCPRequest'
  | 'plugins.uiPromptResult'
  | 'writeText';

export type RendererOnChannels =
  | 'contextMenuCommand'
  | 'db.changes'
  | 'plugins.uiAlert'
  | 'plugins.uiDialog'
  | 'plugins.uiPrompt'
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
  | 'sync.merge-conflicts'
  | 'toggle-preferences-shortcuts'
  | 'toggle-preferences'
  | 'toggle-sidebar'
  | 'show-oauth-authorization-modal'
  | 'hide-oauth-authorization-modal'
  | 'mcp-auth-confirmation'
  | 'git.db-synced'
  | 'git.file-problems-changed';

export const ipcMainOn = (
  channel: MainOnChannels,
  listener: (event: IpcMainEvent, ...args: any[]) => Promise<void> | any,
) => ipcMain.on(channel, listener);
export type OnceChannels = 'halfSecondAfterAppStart';
export const ipcMainOnce = (
  channel: OnceChannels,
  listener: (event: IpcMainEvent, ...args: any[]) => Promise<void> | any,
) => ipcMain.once(channel, listener);

interface ContextMenuTag {
  templateTag: {
    name: string;
    displayName: string | (() => string);
    args?: NunjucksParsedTagArg[];
    needsEnterprisePlan?: boolean;
  };
}

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
        pluginTemplateTags?: { templateTag: Record<string, unknown> }[];
      },
    ) => {
      const { key, nunjucksTag, pluginTemplateTags = [] } = options;
      const sendLiquidTagContextMsg = (type: NunjucksTagContextMenuAction) => {
        event.sender.send('nunjucks-context-menu-command', { key, nunjucksTag: { ...nunjucksTag, type } });
      };
      try {
        const baseTemplate: MenuItemConstructorOptions[] = nunjucksTag
          ? [
              {
                label: 'Edit',
                click: () => sendLiquidTagContextMsg('edit'),
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
                  sendLiquidTagContextMsg('delete');
                },
              },
              {
                label: 'Delete',
                click: () => sendLiquidTagContextMsg('delete'),
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
        const localTemplate: MenuItemConstructorOptions[] = (
          [...localTemplateTags, ...pluginTemplateTags] as ContextMenuTag[]
        )
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
                        const additionalTagFields = additionalArgs?.length
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
