import { contextBridge, ipcRenderer, webUtils as webUtilities } from 'electron';
import type { AuthTypeOAuth2, OAuth2Token, RequestHeader } from 'insomnia-data';

import type {
  ApplyRequestHooksArgs,
  ApplyResponseHooksArgs,
  ExecutePluginActionArgs,
  ExecutePluginMainActionArgs,
  PluginsBridgeAPI,
  RunTemplateTagActionArgs,
} from '~/common/plugins/bridge-types';
import type { GenerateMcpSamplingResponseFunction } from '~/common/plugins/types';
import type { RenderedRequest } from '~/common/templating/types';
import { invariant } from '~/common/utils/invariant';
import { invokeWithNormalizedError } from '~/main/ipc/invoke';
import type { LLMBackend, LLMConfig, LLMConfigServiceAPI } from '~/main/llm-config-service';
import type { PluginInvokeMethod } from '~/plugins/invoke-method';
import { isUserAbortResolveMergeConflictError, UserAbortResolveMergeConflictError } from '~/sync/vcs/errors';
import { servicesProxy } from '~/ui/renderer-services-proxy';

import type { SyncBridgeAPI } from './main/cloud-sync/ipc';
import type { GitServiceAPI } from './main/git-service';
import type { CookiesBridgeAPI } from './main/ipc/cookies';
import type { electronStorageBridgeAPI } from './main/ipc/electron-storage';
import type { gRPCBridgeAPI } from './main/ipc/grpc';
import type { secretStorageBridgeAPI } from './main/ipc/secret-storage';
import type { AIFeatureNames } from './main/llm-config-service';
import type { CurlBridgeAPI } from './main/network/curl';
import type { McpBridgeAPI } from './main/network/mcp';
import type { SocketIOBridgeAPI } from './main/network/socket-io';
import type { WebSocketBridgeAPI } from './main/network/websocket';
const ports = new Map<'hiddenWindowPort', MessagePort>();

type PluginMethodResult<T extends PluginInvokeMethod> = T extends keyof PluginsBridgeAPI
  ? Awaited<ReturnType<PluginsBridgeAPI[T]>>
  : never;

const invokePluginBridgeMethod = <T extends PluginInvokeMethod>(
  method: T,
  args?: unknown,
): Promise<PluginMethodResult<T>> => {
  return invokeWithNormalizedError(`plugins.${method}`, args) as Promise<PluginMethodResult<T>>;
};

const webSocket: WebSocketBridgeAPI = {
  open: options => invokeWithNormalizedError('webSocket.open', options),
  close: options => ipcRenderer.send('webSocket.close', options),
  closeAll: () => ipcRenderer.send('webSocket.closeAll'),
  readyState: {
    getCurrent: options => invokeWithNormalizedError('webSocket.readyState', options),
  },
  event: {
    findMany: options => invokeWithNormalizedError('webSocket.event.findMany', options),
    send: options => invokeWithNormalizedError('webSocket.event.send', options),
  },
};
const curl: CurlBridgeAPI = {
  open: options => invokeWithNormalizedError('curl.open', options),
  close: options => ipcRenderer.send('curl.close', options),
  closeAll: () => ipcRenderer.send('curl.closeAll'),
  readyState: {
    getCurrent: options => invokeWithNormalizedError('curl.readyState', options),
  },
  event: {
    findMany: options => invokeWithNormalizedError('curl.event.findMany', options),
  },
};

const socketIO: SocketIOBridgeAPI = {
  open: options => invokeWithNormalizedError('socketIO.open', options),
  readyState: {
    getCurrent: options => invokeWithNormalizedError('socketIO.readyState', options),
  },
  close: options => ipcRenderer.send('socketIO.close', options),
  closeAll: () => ipcRenderer.send('socketIO.closeAll'),
  event: {
    findMany: options => invokeWithNormalizedError('socketIO.event.findMany', options),
    send: options => invokeWithNormalizedError('socketIO.event.send', options),
    on: options => ipcRenderer.send('socketIO.event.on', options),
    off: options => ipcRenderer.send('socketIO.event.off', options),
  },
};

const mcp: McpBridgeAPI = {
  connect: options => invokeWithNormalizedError('mcp.connect', options),
  close: options => invokeWithNormalizedError('mcp.close', options),
  closeAll: () => ipcRenderer.send('mcp.closeAll'),
  authConfirmation: confirmed => ipcRenderer.send('mcp.authConfirmed', confirmed),
  primitive: {
    listTools: options => invokeWithNormalizedError('mcp.primitive.listTools', options),
    callTool: options => invokeWithNormalizedError('mcp.primitive.callTool', options),
    listResources: options => invokeWithNormalizedError('mcp.primitive.listResources', options),
    listResourceTemplates: options => invokeWithNormalizedError('mcp.primitive.listResourceTemplates', options),
    readResource: options => invokeWithNormalizedError('mcp.primitive.readResource', options),
    subscribeResource: options => invokeWithNormalizedError('mcp.primitive.subscribeResource', options),
    unsubscribeResource: options => invokeWithNormalizedError('mcp.primitive.unsubscribeResource', options),
    listPrompts: options => invokeWithNormalizedError('mcp.primitive.listPrompts', options),
    getPrompt: options => invokeWithNormalizedError('mcp.primitive.getPrompt', options),
  },
  notification: {
    rootListChange: options => invokeWithNormalizedError('mcp.notification.rootListChange', options),
  },
  readyState: {
    getCurrent: options => invokeWithNormalizedError('mcp.readyState', options),
  },
  client: {
    responseElicitationRequest: options => ipcRenderer.send('mcp.client.responseElicitationRequest', options),
    responseSamplingRequest: options => ipcRenderer.send('mcp.client.responseSamplingRequest', options),
    hasRequestResponded: options => invokeWithNormalizedError('mcp.client.hasRequestResponded', options),
    cancelRequest: options => invokeWithNormalizedError('mcp.client.cancelRequest', options),
  },
  event: {
    findMany: options => invokeWithNormalizedError('mcp.event.findMany', options),
    findNotifications: options => invokeWithNormalizedError('mcp.event.findNotifications', options),
    findPendingEvents: options => invokeWithNormalizedError('mcp.event.findPendingEvents', options),
  },
};

const cookies: CookiesBridgeAPI = {
  fromJSON: cookie => invokeWithNormalizedError('cookies.fromJSON', cookie),
  parse: cookie => invokeWithNormalizedError('cookies.parse', cookie),
  toString: cookie => invokeWithNormalizedError('cookies.toString', cookie),
  getCookiesForUrl: args => invokeWithNormalizedError('cookies.getCookiesForUrl', args),
  addSetCookies: args => invokeWithNormalizedError('cookies.addSetCookies', args),
  getResponseCookiesFromHeaders: headers => invokeWithNormalizedError('cookies.getResponseCookiesFromHeaders', headers),
};

const grpc: gRPCBridgeAPI = {
  start: options => ipcRenderer.send('grpc.start', options),
  sendMessage: options => ipcRenderer.send('grpc.sendMessage', options),
  commit: options => ipcRenderer.send('grpc.commit', options),
  cancel: options => ipcRenderer.send('grpc.cancel', options),
  closeAll: () => ipcRenderer.send('grpc.closeAll'),
  loadMethods: options => invokeWithNormalizedError('grpc.loadMethods', options),
  loadMethodsFromReflection: options => invokeWithNormalizedError('grpc.loadMethodsFromReflection', options),
  writeProtoFile: protoFileId => invokeWithNormalizedError('grpc.writeProtoFile', protoFileId),
  validateProtoFile: filePath => invokeWithNormalizedError('grpc.validateProtoFile', filePath),
};

const secretStorage: secretStorageBridgeAPI = {
  setSecret: (key, secret) => invokeWithNormalizedError('secretStorage.setSecret', key, secret),
  getSecret: key => invokeWithNormalizedError('secretStorage.getSecret', key),
  deleteSecret: key => invokeWithNormalizedError('secretStorage.deleteSecret', key),
  encryptString: raw => invokeWithNormalizedError('secretStorage.encryptString', raw),
  decryptString: cipherText => invokeWithNormalizedError('secretStorage.decryptString', cipherText),
};

const electronStorage: electronStorageBridgeAPI = {
  getItem: key => invokeWithNormalizedError('electronStorage.getItem', key),
  setItem: (key, value) => invokeWithNormalizedError('electronStorage.setItem', key, value),
};

const invokeSyncMethod = async <T>(methodName: string, ...args: unknown[]) => {
  try {
    return (await invokeWithNormalizedError('sync.invoke', methodName, ...args)) as T;
  } catch (error) {
    if (isUserAbortResolveMergeConflictError(error)) {
      throw new UserAbortResolveMergeConflictError(
        'message' in error && typeof error.message === 'string' ? error.message : undefined,
      );
    }

    throw error;
  }
};

const sync: SyncBridgeAPI = {
  archiveProject: () => invokeSyncMethod('archiveProject'),
  checkout: (...args) => invokeSyncMethod('checkout', ...args),
  compareRemoteBranch: () => invokeSyncMethod('compareRemoteBranch'),
  fork: (...args) => invokeSyncMethod('fork', ...args),
  getActiveBackendProject: () => invokeSyncMethod('getActiveBackendProject'),
  getBranchNames: () => invokeSyncMethod('getBranchNames'),
  getCurrentBranchName: () => invokeSyncMethod('getCurrentBranchName'),
  getHistory: (...args) => invokeSyncMethod('getHistory', ...args),
  getHistoryCount: () => invokeSyncMethod('getHistoryCount'),
  getRemoteBranchNames: () => invokeSyncMethod('getRemoteBranchNames'),
  getVersion: () => invokeSyncMethod('getVersion'),
  hasBackendProject: () => invokeSyncMethod('hasBackendProject'),
  localBackendProjects: () => invokeSyncMethod('localBackendProjects'),
  merge: (...args) => invokeSyncMethod('merge', ...args),
  pull: (...args) => invokeSyncMethod('pull', ...args),
  pullRemoteBackendProject: options => invokeWithNormalizedError('sync.pullRemoteBackendProject', options),
  push: (...args) => invokeSyncMethod('push', ...args),
  remoteBackendProjects: (...args) => invokeSyncMethod('remoteBackendProjects', ...args),
  remoteBackendProjectsOfTeam: (...args) => invokeSyncMethod('remoteBackendProjectsOfTeam', ...args),
  removeBackendProjectsForRoot: (...args) => invokeSyncMethod('removeBackendProjectsForRoot', ...args),
  removeBranch: (...args) => invokeSyncMethod('removeBranch', ...args),
  removeRemoteBranch: (...args) => invokeSyncMethod('removeRemoteBranch', ...args),
  rollback: (...args) => invokeSyncMethod('rollback', ...args),
  rollbackToLatest: (...args) => invokeSyncMethod('rollbackToLatest', ...args),
  resolveConflict: options => ipcRenderer.send('sync.resolveConflict', options),
  cancelConflict: options => ipcRenderer.send('sync.cancelConflict', options),
  stage: (...args) => invokeSyncMethod('stage', ...args),
  status: (...args) => invokeSyncMethod('status', ...args),
  switchAndCreateBackendProjectIfNotExist: (...args) =>
    invokeSyncMethod('switchAndCreateBackendProjectIfNotExist', ...args),
  takeSnapshot: (...args) => invokeSyncMethod('takeSnapshot', ...args),
  unstage: (...args) => invokeSyncMethod('unstage', ...args),
  on: (channel, listener) => {
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
};

const git: GitServiceAPI = {
  loadGitRepository: options => invokeWithNormalizedError('git.loadGitRepository', options),
  getGitBranches: options => invokeWithNormalizedError('git.getGitBranches', options),
  fetchGitRemoteBranches: options => invokeWithNormalizedError('git.fetchGitRemoteBranches', options),
  getProjectGitFileIssues: options => invokeWithNormalizedError('git.getProjectGitFileIssues', options),
  validateGitRepositoryCredentials: options =>
    invokeWithNormalizedError('git.validateGitRepositoryCredentials', options),
  validateGitCredentialById: options => invokeWithNormalizedError('git.validateGitCredentialById', options),
  gitFetchAction: options => invokeWithNormalizedError('git.gitFetchAction', options),
  gitLogLoader: options => invokeWithNormalizedError('git.gitLogLoader', options),
  gitChangesLoader: options => invokeWithNormalizedError('git.gitChangesLoader', options),
  canPushLoader: options => invokeWithNormalizedError('git.canPushLoader', options),
  cloneGitRepo: options => invokeWithNormalizedError('git.cloneGitRepo', options),
  initGitRepoClone: options => invokeWithNormalizedError('git.initGitRepoClone', options),
  updateGitRepo: options => invokeWithNormalizedError('git.updateGitRepo', options),
  resetGitRepo: options => invokeWithNormalizedError('git.resetGitRepo', options),
  commitToGitRepo: options => invokeWithNormalizedError('git.commitToGitRepo', options),
  commitAndPushToGitRepo: options => invokeWithNormalizedError('git.commitAndPushToGitRepo', options),
  createNewGitBranch: options => invokeWithNormalizedError('git.createNewGitBranch', options),
  checkoutGitBranch: options => invokeWithNormalizedError('git.checkoutGitBranch', options),
  mergeGitBranch: options => invokeWithNormalizedError('git.mergeGitBranch', options),
  deleteGitBranch: options => invokeWithNormalizedError('git.deleteGitBranch', options),
  pushToGitRemote: options => invokeWithNormalizedError('git.pushToGitRemote', options),
  pullFromGitRemote: options => invokeWithNormalizedError('git.pullFromGitRemote', options),
  continueMerge: options => invokeWithNormalizedError('git.continueMerge', options),
  discardChanges: options => invokeWithNormalizedError('git.discardChanges', options),
  abortMerge: options => invokeWithNormalizedError('git.abortMerge', options),
  gitStatus: options => invokeWithNormalizedError('git.gitStatus', options),
  diff: () => invokeWithNormalizedError('git.diff'),
  multipleCommitToGitRepo: options => invokeWithNormalizedError('git.multipleCommitToGitRepo', options),
  stageChanges: options => invokeWithNormalizedError('git.stageChanges', options),
  unstageChanges: options => invokeWithNormalizedError('git.unstageChanges', options),
  diffFileLoader: options => invokeWithNormalizedError('git.diffFileLoader', options),
  getRepositoryDirectoryTree: options => invokeWithNormalizedError('git.getRepositoryDirectoryTree', options),
  migrateLegacyInsomniaFolderToFile: options =>
    invokeWithNormalizedError('git.migrateLegacyInsomniaFolderToFile', options),

  listGitProviders: () => invokeWithNormalizedError('git.listGitProviders'),
  initSignInToGitProvider: options => invokeWithNormalizedError('git.initSignInToGitProvider', options),
  completeSignInToGitProvider: options => invokeWithNormalizedError('git.completeSignInToGitProvider', options),
  getGitProviderRepositories: options => invokeWithNormalizedError('git.getGitProviderRepositories', options),
  getGitProviderEmails: options => invokeWithNormalizedError('git.getGitProviderEmails', options),
  getCurrentBranchByRepositoryId: options => invokeWithNormalizedError('git.getCurrentBranchByRepositoryId', options),
  getBranchRemoteInfo: options => invokeWithNormalizedError('git.getBranchRemoteInfo', options),
  runAllGitRepoMigrations: () => invokeWithNormalizedError('git.runAllGitRepoMigrations'),
};

const llm: LLMConfigServiceAPI = {
  getActiveBackend: () => invokeWithNormalizedError('llm.getActiveBackend'),
  setActiveBackend: (backend: LLMBackend) => invokeWithNormalizedError('llm.setActiveBackend', backend),
  clearActiveBackend: () => invokeWithNormalizedError('llm.clearActiveBackend'),
  getBackendConfig: (backend: LLMBackend) => invokeWithNormalizedError('llm.getBackendConfig', backend),
  updateBackendConfig: (backend: LLMBackend, config: Partial<LLMConfig>) =>
    invokeWithNormalizedError('llm.updateBackendConfig', backend, config),
  getAllConfigurations: () => invokeWithNormalizedError('llm.getAllConfigurations'),
  getCurrentConfig: () => invokeWithNormalizedError('llm.getCurrentConfig'),
  getAIFeatureEnabled: (feature: AIFeatureNames) => invokeWithNormalizedError('llm.getAIFeatureEnabled', feature),
  setAIFeatureEnabled: (feature: AIFeatureNames, enabled: boolean) =>
    invokeWithNormalizedError('llm.setAIFeatureEnabled', feature, enabled),
};

const main: Window['main'] = {
  startExecution: options => ipcRenderer.send('startExecution', options),
  addExecutionStep: options => ipcRenderer.send('addExecutionStep', options),
  completeExecutionStep: options => ipcRenderer.send('completeExecutionStep', options),
  updateLatestStepName: options => ipcRenderer.send('updateLatestStepName', options),
  getExecution: options => invokeWithNormalizedError('getExecution', options),
  loginStateChange: options => ipcRenderer.send('loginStateChange', options),
  restart: () => ipcRenderer.send('restart'),
  openInBrowser: options => ipcRenderer.send('openInBrowser', options),
  openDeepLink: options => ipcRenderer.send('openDeepLink', options),
  halfSecondAfterAppStart: () => ipcRenderer.send('halfSecondAfterAppStart'),
  manualUpdateCheck: () => ipcRenderer.send('manualUpdateCheck'),
  backup: () => invokeWithNormalizedError('backup'),
  restoreBackup: options => invokeWithNormalizedError('restoreBackup', options),
  authorizeUserInWindow: options => invokeWithNormalizedError('authorizeUserInWindow', options),
  authorizeUserInDefaultBrowser: options => invokeWithNormalizedError('authorizeUserInDefaultBrowser', options),
  onDefaultBrowserOAuthRedirect: options => invokeWithNormalizedError('onDefaultBrowserOAuthRedirect', options),
  cancelAuthorizationInDefaultBrowser: options =>
    invokeWithNormalizedError('cancelAuthorizationInDefaultBrowser', options),
  setMenuBarVisibility: options => ipcRenderer.send('setMenuBarVisibility', options),
  multipartBufferToArray: options => invokeWithNormalizedError('multipartBufferToArray', options),
  installPlugin: (lookupName: string, allowScopedPackageNames = false) =>
    invokeWithNormalizedError('installPlugin', lookupName, allowScopedPackageNames),
  createPlugin: options => invokeWithNormalizedError('createPlugin', options),
  initializeWorkspaceBackendProject: options => invokeWithNormalizedError('initializeWorkspaceBackendProject', options),
  runTests: src => invokeWithNormalizedError('run-tests', src),
  curlRequest: options => invokeWithNormalizedError('curlRequest', options),
  cancelCurlRequest: options => ipcRenderer.send('cancelCurlRequest', options),
  writeFile: options => invokeWithNormalizedError('writeFile', options),
  deleteCompiledRuleset: options => invokeWithNormalizedError('deleteCompiledRuleset', options),
  refreshCompiledRuleset: options => invokeWithNormalizedError('refreshCompiledRuleset', options),
  writeResponseBodyToFile: options => invokeWithNormalizedError('writeResponseBodyToFile', options),
  getAuthHeader: (renderedRequest: RenderedRequest, url: string): Promise<RequestHeader | undefined> =>
    invokeWithNormalizedError('getAuthHeader', renderedRequest, url),
  getOAuth2Token: (
    requestId: string,
    authentication: AuthTypeOAuth2,
    forceRefresh?: boolean,
  ): Promise<OAuth2Token | undefined> =>
    invokeWithNormalizedError('getOAuth2Token', requestId, authentication, forceRefresh),
  insecureReadFile: options => invokeWithNormalizedError('insecureReadFile', options),
  insecureReadFileWithEncoding: options => invokeWithNormalizedError('insecureReadFileWithEncoding', options),
  secureReadFile: options => invokeWithNormalizedError('secureReadFile', options),
  parseImport: (...args) => invokeWithNormalizedError('parseImport', ...args),
  readDir: options => invokeWithNormalizedError('readDir', options),
  readOrCreateDataDir: options => invokeWithNormalizedError('readOrCreateDataDir', options),
  lintSpec: options => invokeWithNormalizedError('lintSpec', options),
  bundleSpectralRuleset: options => invokeWithNormalizedError('bundleSpectralRuleset', options),
  on: (channel, listener) => {
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  cookies,
  webSocket,
  socketIO,
  mcp,
  git,
  llm,
  grpc,
  curl,
  secretStorage,
  electronStorage,
  sync,
  trackAnalyticsEvent: options => ipcRenderer.send('trackAnalyticsEvent', options),
  trackPageView: options => ipcRenderer.send('trackPageView', options),
  setCurrentOrganizationId: organizationId => ipcRenderer.send('analytics.setOrganizationId', organizationId),
  showNunjucksContextMenu: options => ipcRenderer.send('show-nunjucks-context-menu', options),
  showContextMenu: options => ipcRenderer.send('showContextMenu', options),
  database: {
    caCertificate: {
      create: options => invokeWithNormalizedError('database.caCertificate.create', options),
    },
  },
  hiddenBrowserWindow: {
    runScript: options =>
      new Promise(async (resolve, reject) => {
        const isPortAlive = ports.get('hiddenWindowPort') !== undefined;
        await invokeWithNormalizedError('open-channel-to-hidden-browser-window', isPortAlive);

        const port = ports.get('hiddenWindowPort');
        invariant(port, 'hiddenWindowPort is undefined');

        port.onmessage = event => {
          console.log('[preload] received result:', event.data);
          if (event.data.error) {
            reject(new Error(event.data.error));
          }
          resolve(event.data);
        };

        port.postMessage({ ...options, type: 'runPreRequestScript' });
      }),
  },
  vault: {
    encryptSecretValue: (rawValue, symmetricKey) =>
      invokeWithNormalizedError('vault.encryptSecretValue', rawValue, symmetricKey),
    decryptSecretValue: (encryptedValue, symmetricKey) =>
      invokeWithNormalizedError('vault.decryptSecretValue', encryptedValue, symmetricKey),
  },
  crypt: {
    encryptRSAWithJWK: (publicKeyJWK: JsonWebKey, plaintext: string) =>
      invokeWithNormalizedError('crypt.encryptRSAWithJWK', publicKeyJWK, plaintext),
    decryptRSAWithJWK: (privateJWK: JsonWebKey, encryptedBlob: string) =>
      invokeWithNormalizedError('crypt.decryptRSAWithJWK', privateJWK, encryptedBlob),
    encryptAESBuffer: (jwkOrKey: string | JsonWebKey, buff: number[], additionalData?: string) =>
      invokeWithNormalizedError('crypt.encryptAESBuffer', jwkOrKey, buff, additionalData),
    encryptAES: (jwkOrKey: string | JsonWebKey, plaintext: string, additionalData?: string) =>
      invokeWithNormalizedError('crypt.encryptAES', jwkOrKey, plaintext, additionalData),
    decryptAES: (jwkOrKey: string | JsonWebKey, encryptedResult: object) =>
      invokeWithNormalizedError('crypt.decryptAES', jwkOrKey, encryptedResult),
    decryptAESToBuffer: (jwkOrKey: string | JsonWebKey, encryptedResult: object) =>
      invokeWithNormalizedError('crypt.decryptAESToBuffer', jwkOrKey, encryptedResult),
    generateAES256Key: () => invokeWithNormalizedError('crypt.generateAES256Key'),
  },
  sealedBox: {
    keyPair: () => invokeWithNormalizedError('sealedbox.keyPair'),
    open: (sealedbox: Uint8Array, pk: Uint8Array, sk: Uint8Array) =>
      invokeWithNormalizedError('sealedbox.open', sealedbox, pk, sk),
  },
  extractJsonFileFromPostmanDataDumpArchive: archivePath =>
    invokeWithNormalizedError('extractJsonFileFromPostmanDataDumpArchive', archivePath),
  syncNewWorkspaceIfNeeded: options => invokeWithNormalizedError('syncNewWorkspaceIfNeeded', options),
  getLocalStorageDataFromFileOrigin: () => invokeWithNormalizedError('getLocalStorageDataFromFileOrigin'),
  generateMockRouteDataFromSpec: (
    openApiSpec: string | undefined,
    specUrl: string | undefined,
    specText: string | undefined,
    modelConfig: any,
    useDynamicMockResponses: boolean,
    mockServerAdditionalFiles: string[],
  ) =>
    invokeWithNormalizedError(
      'generateMockRouteDataFromSpec',
      openApiSpec,
      specUrl,
      specText,
      modelConfig,
      useDynamicMockResponses,
      mockServerAdditionalFiles,
    ),
  generateCodeSnippet: (options: { har: object; target: string; client: string }) =>
    invokeWithNormalizedError('generateCodeSnippet', options),
  getCodeSnippetTargets: () => invokeWithNormalizedError('getCodeSnippetTargets'),
  exportHarWithRequest: (options: { requestId: string; environmentId?: string; addContentLength?: boolean }) =>
    invokeWithNormalizedError('exportHarWithRequest', options),
  exportHarRequest: (options: { requestId: string; environmentOrWorkspaceId: string; addContentLength?: boolean }) =>
    invokeWithNormalizedError('exportHarRequest', options),
  exportHarCurrentRequest: (options: { requestId: string; responseId: string }) =>
    invokeWithNormalizedError('exportHarCurrentRequest', options),
  exportRequestsHAR: (options: { requests: any[]; includePrivateDocs?: boolean }) =>
    invokeWithNormalizedError('exportRequestsHAR', options),
  exportWorkspacesHAR: (options: { workspaces: any[]; includePrivateDocs?: boolean }) =>
    invokeWithNormalizedError('exportWorkspacesHAR', options),
  generateCommitsFromDiff: (input: { diff: string; recent_commits: string }) =>
    invokeWithNormalizedError('generateCommitsFromDiff', input),
  generateMcpSamplingResponse: (parameters: Parameters<GenerateMcpSamplingResponseFunction>[0]) =>
    invokeWithNormalizedError('generateMcpSamplingResponse', parameters),
  plugins: {
    getThemes: () => invokePluginBridgeMethod('getThemes'),
    getPlugins: () => invokePluginBridgeMethod('getPlugins'),
    getActivePlugins: () => invokePluginBridgeMethod('getActivePlugins'),
    reloadPlugins: () => invokePluginBridgeMethod('reloadPlugins'),
    getRequestActions: () => invokePluginBridgeMethod('getRequestActions'),
    getRequestGroupActions: () => invokePluginBridgeMethod('getRequestGroupActions'),
    getWorkspaceActions: () => invokePluginBridgeMethod('getWorkspaceActions'),
    getDocumentActions: () => invokePluginBridgeMethod('getDocumentActions'),
    executeAction: (args: ExecutePluginActionArgs) => invokePluginBridgeMethod('executeAction', args),
    getTemplateTags: () => invokePluginBridgeMethod('getTemplateTags'),
    runTemplateTagAction: (args: RunTemplateTagActionArgs) => invokePluginBridgeMethod('runTemplateTagAction', args),
    getBundlePlugins: () => invokePluginBridgeMethod('getBundlePlugins'),
    executePluginMainAction: (args: ExecutePluginMainActionArgs) =>
      invokePluginBridgeMethod('executePluginMainAction', args),
    hasRequestHooks: () => invokePluginBridgeMethod('hasRequestHooks'),
    hasResponseHooks: () => invokePluginBridgeMethod('hasResponseHooks'),
    applyRequestHooks: (args: ApplyRequestHooksArgs) => invokePluginBridgeMethod('applyRequestHooks', args),
    applyResponseHooks: (args: ApplyResponseHooksArgs) => invokePluginBridgeMethod('applyResponseHooks', args),
    getBridgeMetrics: () => invokeWithNormalizedError('plugins.getBridgeMetrics'),
  },
  notifyPromptResult: (id: string, value: string | null) => ipcRenderer.send('ui.promptResult', { id, value }),
  timeline: {
    getPath: (responseId: string) => invokeWithNormalizedError('timeline.getPath', responseId) as Promise<string>,
    appendToFile: (options: { timelinePath: string; data: string }) =>
      invokeWithNormalizedError('timeline.appendToFile', options),
  },
};

ipcRenderer.on('hidden-browser-window-response-listener', event => {
  const [port] = event.ports;
  ports.set('hiddenWindowPort', port);
  invokeWithNormalizedError('main-window-script-port-ready');
});
const path: Window['path'] = {
  dirname: (p: string) => ipcRenderer.sendSync('path.dirname', p),
  basename: (p: string) => ipcRenderer.sendSync('path.basename', p),
  join: (...paths: string[]) => ipcRenderer.sendSync('path.join', ...paths),
  resolve: (...paths: string[]) => ipcRenderer.sendSync('path.resolve', ...paths),
};
const dialog: Window['dialog'] = {
  showOpenDialog: options => invokeWithNormalizedError('showOpenDialog', options),
  showSaveDialog: options => invokeWithNormalizedError('showSaveDialog', options),
};
const app: Window['app'] = {
  getPath: options => ipcRenderer.sendSync('getPath', options),
  getAppPath: () => ipcRenderer.sendSync('getAppPath'),
  process: {
    get platform() {
      return process.platform as NodeJS.Platform;
    },
  },
};
const shell: Window['shell'] = {
  showItemInFolder: options => ipcRenderer.send('showItemInFolder', options),
  openPath: options => invokeWithNormalizedError('openPath', options),
};
const clipboard: Window['clipboard'] = {
  readText: () => ipcRenderer.sendSync('readText'),
  writeText: options => ipcRenderer.send('writeText', options),
  clear: () => ipcRenderer.send('clear'),
};
const webUtils: Window['webUtils'] = {
  getPathForFile: (file: File) => webUtilities.getPathForFile(file),
};
const database: Window['database'] = {
  invoke: (fnName, ...args) => invokeWithNormalizedError('database.invoke', fnName, ...args),
};

const env: Window['env'] = {
  // GitLab OAuth — redirect URI, client ID, and API URL allow dev/enterprise overrides
  INSOMNIA_GITLAB_REDIRECT_URI: process.env.INSOMNIA_GITLAB_REDIRECT_URI,
  INSOMNIA_GITLAB_CLIENT_ID: process.env.INSOMNIA_GITLAB_CLIENT_ID,
  INSOMNIA_GITLAB_API_URL: process.env.INSOMNIA_GITLAB_API_URL,
  // E2E sentinel: switches analytics to dev keys and forces vertical layout in settings
  PLAYWRIGHT_TEST: process.env.PLAYWRIGHT_TEST,
  // E2E fixtures: pre-seed auth state so tests bypass login/key-derivation UI
  INSOMNIA_SKIP_ONBOARDING: process.env.INSOMNIA_SKIP_ONBOARDING,
  INSOMNIA_SESSION: process.env.INSOMNIA_SESSION,
  INSOMNIA_SECRET_KEY: process.env.INSOMNIA_SECRET_KEY,
  INSOMNIA_PUBLIC_KEY: process.env.INSOMNIA_PUBLIC_KEY,
  // E2E vault fixtures: pre-seed deterministic salt/key/SRP secret
  INSOMNIA_VAULT_SALT: process.env.INSOMNIA_VAULT_SALT,
  INSOMNIA_VAULT_KEY: process.env.INSOMNIA_VAULT_KEY,
  INSOMNIA_VAULT_SRP_SECRET: process.env.INSOMNIA_VAULT_SRP_SECRET,
  // App environment: gates dev features and selects analytics keys
  INSOMNIA_ENV: process.env.INSOMNIA_ENV,
  // Injected at build time; shown in the About screen
  BUILD_DATE: process.env.BUILD_DATE,
  // Windows portable binary sentinel: presence disables auto-updates
  PORTABLE_EXECUTABLE_DIR: process.env.PORTABLE_EXECUTABLE_DIR,
  // OAuth flow URL overrides for dev/staging environments
  OAUTH_REDIRECT_URL: process.env.OAUTH_REDIRECT_URL,
  OAUTH_RELAY_URL: process.env.OAUTH_RELAY_URL,
  // Service URL overrides: allow dev/CI to target local or staging backends
  INSOMNIA_API_URL: process.env.INSOMNIA_API_URL,
  INSOMNIA_MOCK_API_URL: process.env.INSOMNIA_MOCK_API_URL,
  INSOMNIA_AI_URL: process.env.INSOMNIA_AI_URL,
  KONNECT_API_URL: process.env.KONNECT_API_URL,
  INSOMNIA_APP_WEBSITE_URL: process.env.INSOMNIA_APP_WEBSITE_URL,
  // GitHub API URL overrides for GitHub Enterprise targets
  INSOMNIA_GITHUB_REST_API_URL: process.env.INSOMNIA_GITHUB_REST_API_URL,
  INSOMNIA_GITHUB_API_URL: process.env.INSOMNIA_GITHUB_API_URL,
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('main', main);
  contextBridge.exposeInMainWorld('dialog', dialog);
  contextBridge.exposeInMainWorld('app', app);
  contextBridge.exposeInMainWorld('shell', shell);
  contextBridge.exposeInMainWorld('clipboard', clipboard);
  contextBridge.exposeInMainWorld('webUtils', webUtils);
  contextBridge.exposeInMainWorld('path', path);
  contextBridge.exposeInMainWorld('database', database);
  contextBridge.exposeInMainWorld('_dataServices', servicesProxy);
  contextBridge.exposeInMainWorld('env', env);
} else {
  window.main = main;
  window.dialog = dialog;
  window.app = app;
  window.shell = shell;
  window.clipboard = clipboard;
  window.webUtils = webUtils;
  window.path = path;
  window.database = database;
  window._dataServices = servicesProxy;
  window.env = env;
}
