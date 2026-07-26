import { mkdirSync } from 'node:fs';

declare global {
  var __PLAYWRIGHT_OPEN_DIALOG_QUEUE__: { filePaths: string[]; canceled: boolean }[] | undefined;
}

import type {
  IpcMainEvent,
  IpcMainInvokeEvent,
  MenuItemConstructorOptions,
  OpenDialogOptions,
  SaveDialogOptions,
} from 'electron';
import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, shell } from 'electron';
import { localTemplateTags } from 'insomnia/src/common/templating/local-template-tags';

import { type NunjucksParsedTagArg, type NunjucksTagContextMenuAction } from '~/common/templating/types';
import type { extractNunjucksTagFromCoords } from '~/common/templating/utils';
import { invariant } from '~/common/utils/invariant';

import { fnOrString } from '../../common/misc';

export type HandleChannels =
  | 'run-tests'
  | 'authorizeUserInDefaultBrowser'
  | 'authorizeUserInWindow'
  | 'backup'
  | 'cancelAuthorizationInDefaultBrowser'
  | 'generateCodeSnippet'
  | 'getCodeSnippetTargets'
  | 'exportHarWithRequest'
  | 'exportHarRequest'
  | 'exportHarCurrentRequest'
  | 'exportRequestsHAR'
  | 'exportWorkspacesHAR'
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
  | 'services.caCertificate.create'
  | 'services.caCertificate.getById'
  | 'services.caCertificate.getByParentId'
  | 'services.caCertificate.removeWhere'
  | 'services.caCertificate.update'
  | 'services.clientCertificate.create'
  | 'services.clientCertificate.findByParentId'
  | 'services.clientCertificate.getById'
  | 'services.clientCertificate.remove'
  | 'services.clientCertificate.update'
  | 'services.cloudCredential.all'
  | 'services.cloudCredential.create'
  | 'services.cloudCredential.getById'
  | 'services.cloudCredential.getByName'
  | 'services.cloudCredential.remove'
  | 'services.cloudCredential.update'
  | 'services.settings.get'
  | 'services.settings.getOrCreate'
  | 'services.settings.patch'
  | 'services.settings.update'
  | 'services.gitCredentials.all'
  | 'services.gitCredentials.create'
  | 'services.gitCredentials.getById'
  | 'services.gitCredentials.remove'
  | 'services.gitCredentials.removeAll'
  | 'services.gitCredentials.update'
  | 'services.userSession.get'
  | 'services.userSession.remove'
  | 'services.userSession.update'
  | 'services.environment.create'
  | 'services.environment.update'
  | 'services.environment.list'
  | 'services.environment.listByParentId'
  | 'services.environment.getOrCreateForParentId'
  | 'services.environment.getById'
  | 'services.environment.getByParentId'
  | 'services.environment.duplicate'
  | 'services.environment.remove'
  | 'services.environment.removeAllSecrets'
  | 'services.apiSpec.getByParentId'
  | 'services.apiSpec.getOrCreateForParentId'
  | 'services.apiSpec.update'
  | 'services.apiSpec.updateOrCreateForParentId'
  | 'services.cookieJar.getById'
  | 'services.cookieJar.getOrCreateForParentId'
  | 'services.cookieJar.update'
  | 'services.gitRepository.all'
  | 'services.gitRepository.getAllByCredentialId'
  | 'services.gitRepository.getById'
  | 'services.gitRepository.remove'
  | 'services.gitRepository.update'
  | 'services.grpcRequest.create'
  | 'services.grpcRequest.findByProtoFileId'
  | 'services.grpcRequestMeta.getByParentId'
  | 'services.grpcRequestMeta.updateOrCreateByParentId'
  | 'services.helpers.abortCommandSearch'
  | 'services.helpers.commandSearch'
  | 'services.helpers.duplicateRequest'
  | 'services.helpers.findRequestByParentId'
  | 'services.helpers.getRequestById'
  | 'services.helpers.getResponseBodyBuffer'
  | 'services.helpers.getResponseTimeline'
  | 'services.helpers.queryAllWorkspaceUrls'
  | 'services.helpers.readCurlResponse'
  | 'services.helpers.removeRequest'
  | 'services.helpers.removeResponse'
  | 'services.helpers.removeResponsesForRequest'
  | 'services.helpers.updateRequest'
  | 'services.mcpPayload.getByParentIdAndUrl'
  | 'services.mcpPayload.updateOrCreateByParentIdAndUrl'
  | 'services.mcpRequest.create'
  | 'services.mcpRequest.getById'
  | 'services.mcpRequest.getByParentId'
  | 'services.mcpResponse.getById'
  | 'services.mcpResponse.getLatestForRequestId'
  | 'services.mockRoute.create'
  | 'services.mockRoute.findByParentId'
  | 'services.mockRoute.getById'
  | 'services.mockRoute.remove'
  | 'services.mockRoute.update'
  | 'services.mockServer.findByProjectId'
  | 'services.mockServer.getById'
  | 'services.mockServer.getByParentId'
  | 'services.mockServer.getOrCreateForParentId'
  | 'services.mockServer.update'
  | 'services.organization.list'
  | 'services.pluginData.all'
  | 'services.pluginData.getByKey'
  | 'services.pluginData.removeAll'
  | 'services.pluginData.removeByKey'
  | 'services.pluginData.upsertByKey'
  | 'services.project.count'
  | 'services.project.create'
  | 'services.project.get'
  | 'services.project.getById'
  | 'services.project.list'
  | 'services.project.listByGitRepositoryIds'
  | 'services.project.listByOrganizationIds'
  | 'services.project.remove'
  | 'services.project.update'
  | 'services.projectLintRuleset.getByParentId'
  | 'services.projectLintRuleset.remove'
  | 'services.projectLintRuleset.upsert'
  | 'services.protoDirectory.all'
  | 'services.protoDirectory.create'
  | 'services.protoDirectory.findByParentId'
  | 'services.protoDirectory.remove'
  | 'services.protoFile.all'
  | 'services.protoFile.create'
  | 'services.protoFile.findByParentId'
  | 'services.protoFile.remove'
  | 'services.protoFile.update'
  | 'services.request.create'
  | 'services.request.findByParentId'
  | 'services.request.getById'
  | 'services.request.getByParentId'
  | 'services.request.update'
  | 'services.requestGroup.create'
  | 'services.requestGroup.duplicate'
  | 'services.requestGroup.findByParentId'
  | 'services.requestGroup.getById'
  | 'services.requestGroup.remove'
  | 'services.requestGroup.update'
  | 'services.requestGroupMeta.create'
  | 'services.requestGroupMeta.getByParentId'
  | 'services.requestGroupMeta.update'
  | 'services.requestGroupMeta.updateOrCreateForParentId'
  | 'services.requestMeta.getByParentId'
  | 'services.requestMeta.getOrCreateByParentId'
  | 'services.requestMeta.update'
  | 'services.requestMeta.updateOrCreateByParentId'
  | 'services.requestVersion.findByParentId'
  | 'services.requestVersion.restore'
  | 'services.response.create'
  | 'services.response.getByBodyPath'
  | 'services.response.getById'
  | 'services.response.getLatestForRequestId'
  | 'services.runnerTestResult.create'
  | 'services.runnerTestResult.findByParentId'
  | 'services.runnerTestResult.getById'
  | 'services.runnerTestResult.remove'
  | 'services.socketIOPayload.getOrCreateByParentId'
  | 'services.socketIOPayload.updateOrCreateByParentId'
  | 'services.socketIORequest.create'
  | 'services.socketIORequestMeta.updateOrCreateByParentId'
  | 'services.stats.get'
  | 'services.stats.incrementCreatedRequests'
  | 'services.stats.incrementCreatedRequestsForDescendents'
  | 'services.stats.incrementDeletedRequests'
  | 'services.stats.incrementDeletedRequestsForDescendents'
  | 'services.stats.incrementExecutedRequests'
  | 'services.stats.update'
  | 'services.unitTest.create'
  | 'services.unitTest.remove'
  | 'services.unitTest.update'
  | 'services.unitTestResult.create'
  | 'services.unitTestSuite.create'
  | 'services.unitTestSuite.findByParentId'
  | 'services.unitTestSuite.getById'
  | 'services.unitTestSuite.remove'
  | 'services.unitTestSuite.update'
  | 'services.webSocketPayload.create'
  | 'services.webSocketPayload.getByParentId'
  | 'services.webSocketPayload.update'
  | 'services.webSocketRequest.create'
  | 'services.webSocketRequestMeta.updateOrCreateByParentId'
  | 'services.workspace.count'
  | 'services.workspace.create'
  | 'services.workspace.getById'
  | 'services.workspace.list'
  | 'services.workspace.listByParentId'
  | 'services.workspace.remove'
  | 'services.workspace.update'
  | 'services.workspaceMeta.create'
  | 'services.workspaceMeta.getByParentId'
  | 'services.workspaceMeta.getOrCreateByParentId'
  | 'services.workspaceMeta.list'
  | 'services.workspaceMeta.update'
  | 'services.workspaceMeta.updateByParentId'
  | 'services.oAuth2Token.create'
  | 'services.oAuth2Token.getByParentId'
  | 'services.oAuth2Token.remove'
  | 'services.oAuth2Token.update'
  | 'extractJsonFileFromPostmanDataDumpArchive'
  | 'generateCommitsFromDiff'
  | 'generateMockRouteDataFromSpec'
  | 'getAuthHeader'
  | 'getOAuth2Token'
  | 'getExecution'
  | 'getLocalStorageDataFromFileOrigin'
  | 'git.abortMerge'
  | 'git.cleanupGitRepoStorage'
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
  | 'git.getProjectRulesetImportIssue'
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
  | 'git.openGitRepo'
  | 'git.checkGitRepoDirectory'
  | 'git.pullFromGitRemote'
  | 'git.relocateGitRepo'
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
  | 'grpc.validateProtoFile'
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
  | 'templatingDb.getAuthToken'
  | 'socketIO.open'
  | 'socketIO.readyState'
  | 'webSocket.event.findMany'
  | 'webSocket.event.send'
  | 'webSocket.open'
  | 'webSocket.readyState'
  | 'timeline.appendToFile'
  | 'timeline.getPath'
  | 'writeFile'
  | 'deleteCompiledRuleset'
  | 'refreshCompiledRuleset'
  | 'writeResponseBodyToFile'
  | 'vault.encryptSecretValue'
  | 'vault.decryptSecretValue'
  | 'crypt.encryptRSAWithJWK'
  | 'crypt.decryptRSAWithJWK'
  | 'crypt.encryptAESBuffer'
  | 'crypt.encryptAES'
  | 'crypt.decryptAES'
  | 'crypt.decryptAESToBuffer'
  | 'crypt.generateAES256Key'
  | 'sealedbox.keyPair'
  | 'sealedbox.open'
  | 'cookies.fromJSON'
  | 'cookies.parse'
  | 'cookies.toString'
  | 'cookies.getCookiesForUrl'
  | 'cookies.addSetCookies'
  | 'cookies.getResponseCookiesFromHeaders';

export const ipcMainHandle = (
  channel: HandleChannels,
  listener: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<void> | any,
) => ipcMain.handle(channel, listener);
export type MainOnChannels =
  | 'addExecutionStep'
  | 'analytics.setOrganizationId'
  | 'applyUpdateAndRestart'
  | 'cancelCurlRequest'
  | 'clear'
  | 'completeExecutionStep'
  | 'curl.close'
  | 'curl.closeAll'
  | 'getAppPath'
  | 'getPath'
  | 'getUpdateStatus'
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
  | 'ui.promptResult'
  | 'writeText';

export type RendererOnChannels =
  | 'contextMenuCommand'
  | 'db.changes'
  | 'edit:undo'
  | 'edit:redo'
  | 'plugins.uiAlert'
  | 'plugins.uiDialog'
  | 'ui.prompt'
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
  | 'update-status-changed'
  | 'show-oauth-authorization-modal'
  | 'hide-oauth-authorization-modal'
  | 'mcp-auth-confirmation'
  | 'git.db-synced'
  | 'git.file-problems-changed'
  | 'llm.changed';

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
    // Playwright test hook: consume queued responses set via `electronApp.evaluate`
    // instead of opening the native dialog. See packages/insomnia-smoke-test.
    if (process.env.PLAYWRIGHT === 'true') {
      const queue = globalThis.__PLAYWRIGHT_OPEN_DIALOG_QUEUE__;
      if (queue && queue.length > 0) {
        return queue.shift();
      }
    }
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
