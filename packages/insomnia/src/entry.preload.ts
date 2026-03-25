import { contextBridge, ipcRenderer, webUtils as webUtilities } from 'electron';

import type { Services } from '~/insomnia-data';
import type { LLMBackend, LLMConfig, LLMConfigServiceAPI } from '~/main/llm-config-service';
import type { GenerateMcpSamplingResponseFunction } from '~/plugins/types';

import type { GitServiceAPI } from './main/git-service';
import type { gRPCBridgeAPI } from './main/ipc/grpc';
import type { secretStorageBridgeAPI } from './main/ipc/secret-storage';
import type { AIFeatureNames } from './main/llm-config-service';
import type { CurlBridgeAPI } from './main/network/curl';
import type { McpBridgeAPI } from './main/network/mcp';
import type { SocketIOBridgeAPI } from './main/network/socket-io';
import type { WebSocketBridgeAPI } from './main/network/websocket';
import { invariant } from './utils/invariant';
const ports = new Map<'hiddenWindowPort', MessagePort>();

const webSocket: WebSocketBridgeAPI = {
  open: options => ipcRenderer.invoke('webSocket.open', options),
  close: options => ipcRenderer.send('webSocket.close', options),
  closeAll: () => ipcRenderer.send('webSocket.closeAll'),
  readyState: {
    getCurrent: options => ipcRenderer.invoke('webSocket.readyState', options),
  },
  event: {
    findMany: options => ipcRenderer.invoke('webSocket.event.findMany', options),
    send: options => ipcRenderer.invoke('webSocket.event.send', options),
  },
};
const curl: CurlBridgeAPI = {
  open: options => ipcRenderer.invoke('curl.open', options),
  close: options => ipcRenderer.send('curl.close', options),
  closeAll: () => ipcRenderer.send('curl.closeAll'),
  readyState: {
    getCurrent: options => ipcRenderer.invoke('curl.readyState', options),
  },
  event: {
    findMany: options => ipcRenderer.invoke('curl.event.findMany', options),
  },
};

const socketIO: SocketIOBridgeAPI = {
  open: options => ipcRenderer.invoke('socketIO.open', options),
  readyState: {
    getCurrent: options => ipcRenderer.invoke('socketIO.readyState', options),
  },
  close: options => ipcRenderer.send('socketIO.close', options),
  closeAll: () => ipcRenderer.send('socketIO.closeAll'),
  event: {
    findMany: options => ipcRenderer.invoke('socketIO.event.findMany', options),
    send: options => ipcRenderer.invoke('socketIO.event.send', options),
    on: options => ipcRenderer.send('socketIO.event.on', options),
    off: options => ipcRenderer.send('socketIO.event.off', options),
  },
};

const mcp: McpBridgeAPI = {
  connect: options => ipcRenderer.invoke('mcp.connect', options),
  close: options => ipcRenderer.invoke('mcp.close', options),
  closeAll: () => ipcRenderer.send('mcp.closeAll'),
  authConfirmation: confirmed => ipcRenderer.send('mcp.authConfirmed', confirmed),
  primitive: {
    listTools: options => ipcRenderer.invoke('mcp.primitive.listTools', options),
    callTool: options => ipcRenderer.invoke('mcp.primitive.callTool', options),
    listResources: options => ipcRenderer.invoke('mcp.primitive.listResources', options),
    listResourceTemplates: options => ipcRenderer.invoke('mcp.primitive.listResourceTemplates', options),
    readResource: options => ipcRenderer.invoke('mcp.primitive.readResource', options),
    subscribeResource: options => ipcRenderer.invoke('mcp.primitive.subscribeResource', options),
    unsubscribeResource: options => ipcRenderer.invoke('mcp.primitive.unsubscribeResource', options),
    listPrompts: options => ipcRenderer.invoke('mcp.primitive.listPrompts', options),
    getPrompt: options => ipcRenderer.invoke('mcp.primitive.getPrompt', options),
  },
  notification: {
    rootListChange: options => ipcRenderer.invoke('mcp.notification.rootListChange', options),
  },
  readyState: {
    getCurrent: options => ipcRenderer.invoke('mcp.readyState', options),
  },
  client: {
    responseElicitationRequest: options => ipcRenderer.send('mcp.client.responseElicitationRequest', options),
    responseSamplingRequest: options => ipcRenderer.send('mcp.client.responseSamplingRequest', options),
    hasRequestResponded: options => ipcRenderer.invoke('mcp.client.hasRequestResponded', options),
    cancelRequest: options => ipcRenderer.invoke('mcp.client.cancelRequest', options),
  },
  event: {
    findMany: options => ipcRenderer.invoke('mcp.event.findMany', options),
    findNotifications: options => ipcRenderer.invoke('mcp.event.findNotifications', options),
    findPendingEvents: options => ipcRenderer.invoke('mcp.event.findPendingEvents', options),
  },
};

const grpc: gRPCBridgeAPI = {
  start: options => ipcRenderer.send('grpc.start', options),
  sendMessage: options => ipcRenderer.send('grpc.sendMessage', options),
  commit: options => ipcRenderer.send('grpc.commit', options),
  cancel: options => ipcRenderer.send('grpc.cancel', options),
  closeAll: () => ipcRenderer.send('grpc.closeAll'),
  loadMethods: options => ipcRenderer.invoke('grpc.loadMethods', options),
  loadMethodsFromReflection: options => ipcRenderer.invoke('grpc.loadMethodsFromReflection', options),
};

const secretStorage: secretStorageBridgeAPI = {
  setSecret: (key, secret) => ipcRenderer.invoke('secretStorage.setSecret', key, secret),
  getSecret: key => ipcRenderer.invoke('secretStorage.getSecret', key),
  deleteSecret: key => ipcRenderer.invoke('secretStorage.deleteSecret', key),
  encryptString: raw => ipcRenderer.invoke('secretStorage.encryptString', raw),
  decryptString: cipherText => ipcRenderer.invoke('secretStorage.decryptString', cipherText),
};

const git: GitServiceAPI = {
  loadGitRepository: options => ipcRenderer.invoke('git.loadGitRepository', options),
  getGitBranches: options => ipcRenderer.invoke('git.getGitBranches', options),
  fetchGitRemoteBranches: options => ipcRenderer.invoke('git.fetchGitRemoteBranches', options),
  gitFetchAction: options => ipcRenderer.invoke('git.gitFetchAction', options),
  gitLogLoader: options => ipcRenderer.invoke('git.gitLogLoader', options),
  gitChangesLoader: options => ipcRenderer.invoke('git.gitChangesLoader', options),
  canPushLoader: options => ipcRenderer.invoke('git.canPushLoader', options),
  cloneGitRepo: options => ipcRenderer.invoke('git.cloneGitRepo', options),
  initGitRepoClone: options => ipcRenderer.invoke('git.initGitRepoClone', options),
  updateGitRepo: options => ipcRenderer.invoke('git.updateGitRepo', options),
  resetGitRepo: options => ipcRenderer.invoke('git.resetGitRepo', options),
  commitToGitRepo: options => ipcRenderer.invoke('git.commitToGitRepo', options),
  commitAndPushToGitRepo: options => ipcRenderer.invoke('git.commitAndPushToGitRepo', options),
  createNewGitBranch: options => ipcRenderer.invoke('git.createNewGitBranch', options),
  checkoutGitBranch: options => ipcRenderer.invoke('git.checkoutGitBranch', options),
  mergeGitBranch: options => ipcRenderer.invoke('git.mergeGitBranch', options),
  deleteGitBranch: options => ipcRenderer.invoke('git.deleteGitBranch', options),
  pushToGitRemote: options => ipcRenderer.invoke('git.pushToGitRemote', options),
  pullFromGitRemote: options => ipcRenderer.invoke('git.pullFromGitRemote', options),
  continueMerge: options => ipcRenderer.invoke('git.continueMerge', options),
  discardChanges: options => ipcRenderer.invoke('git.discardChanges', options),
  abortMerge: () => ipcRenderer.invoke('git.abortMerge'),
  gitStatus: options => ipcRenderer.invoke('git.gitStatus', options),
  diff: () => ipcRenderer.invoke('git.diff'),
  multipleCommitToGitRepo: options => ipcRenderer.invoke('git.multipleCommitToGitRepo', options),
  stageChanges: options => ipcRenderer.invoke('git.stageChanges', options),
  unstageChanges: options => ipcRenderer.invoke('git.unstageChanges', options),
  diffFileLoader: options => ipcRenderer.invoke('git.diffFileLoader', options),
  getRepositoryDirectoryTree: options => ipcRenderer.invoke('git.getRepositoryDirectoryTree', options),
  migrateLegacyInsomniaFolderToFile: options => ipcRenderer.invoke('git.migrateLegacyInsomniaFolderToFile', options),

  listGitProviders: () => ipcRenderer.invoke('git.listGitProviders'),
  initSignInToGitProvider: options => ipcRenderer.invoke('git.initSignInToGitProvider', options),
  completeSignInToGitProvider: options => ipcRenderer.invoke('git.completeSignInToGitProvider', options),
  updateSignInToGitProvider: options => ipcRenderer.invoke('git.updateSignInToGitProvider', options),
  getGitProviderRepositories: options => ipcRenderer.invoke('git.getGitProviderRepositories', options),
  getGitProviderEmails: options => ipcRenderer.invoke('git.getGitProviderEmails', options),
  getCurrentBranchByRepositoryId: options => ipcRenderer.invoke('git.getCurrentBranchByRepositoryId', options),
};

const llm: LLMConfigServiceAPI = {
  getActiveBackend: () => ipcRenderer.invoke('llm.getActiveBackend'),
  setActiveBackend: (backend: LLMBackend) => ipcRenderer.invoke('llm.setActiveBackend', backend),
  clearActiveBackend: () => ipcRenderer.invoke('llm.clearActiveBackend'),
  getBackendConfig: (backend: LLMBackend) => ipcRenderer.invoke('llm.getBackendConfig', backend),
  updateBackendConfig: (backend: LLMBackend, config: Partial<LLMConfig>) =>
    ipcRenderer.invoke('llm.updateBackendConfig', backend, config),
  getAllConfigurations: () => ipcRenderer.invoke('llm.getAllConfigurations'),
  getCurrentConfig: () => ipcRenderer.invoke('llm.getCurrentConfig'),
  getAIFeatureEnabled: (feature: AIFeatureNames) => ipcRenderer.invoke('llm.getAIFeatureEnabled', feature),
  setAIFeatureEnabled: (feature: AIFeatureNames, enabled: boolean) =>
    ipcRenderer.invoke('llm.setAIFeatureEnabled', feature, enabled),
};

const main: Window['main'] = {
  startExecution: options => ipcRenderer.send('startExecution', options),
  addExecutionStep: options => ipcRenderer.send('addExecutionStep', options),
  completeExecutionStep: options => ipcRenderer.send('completeExecutionStep', options),
  updateLatestStepName: options => ipcRenderer.send('updateLatestStepName', options),
  getExecution: options => ipcRenderer.invoke('getExecution', options),
  loginStateChange: () => ipcRenderer.send('loginStateChange'),
  restart: () => ipcRenderer.send('restart'),
  openInBrowser: options => ipcRenderer.send('openInBrowser', options),
  openDeepLink: options => ipcRenderer.send('openDeepLink', options),
  halfSecondAfterAppStart: () => ipcRenderer.send('halfSecondAfterAppStart'),
  manualUpdateCheck: () => ipcRenderer.send('manualUpdateCheck'),
  backup: () => ipcRenderer.invoke('backup'),
  restoreBackup: options => ipcRenderer.invoke('restoreBackup', options),
  authorizeUserInWindow: options => ipcRenderer.invoke('authorizeUserInWindow', options),
  authorizeUserInDefaultBrowser: options => ipcRenderer.invoke('authorizeUserInDefaultBrowser', options),
  onDefaultBrowserOAuthRedirect: options => ipcRenderer.invoke('onDefaultBrowserOAuthRedirect', options),
  cancelAuthorizationInDefaultBrowser: options => ipcRenderer.invoke('cancelAuthorizationInDefaultBrowser', options),
  setMenuBarVisibility: options => ipcRenderer.send('setMenuBarVisibility', options),
  multipartBufferToArray: options => ipcRenderer.invoke('multipartBufferToArray', options),
  installPlugin: (lookupName: string, allowScopedPackageNames = false) =>
    ipcRenderer.invoke('installPlugin', lookupName, allowScopedPackageNames),
  curlRequest: options => ipcRenderer.invoke('curlRequest', options),
  cancelCurlRequest: options => ipcRenderer.send('cancelCurlRequest', options),
  writeFile: options => ipcRenderer.invoke('writeFile', options),
  insecureReadFile: options => ipcRenderer.invoke('insecureReadFile', options),
  insecureReadFileWithEncoding: options => ipcRenderer.invoke('insecureReadFileWithEncoding', options),
  secureReadFile: options => ipcRenderer.invoke('secureReadFile', options),
  parseImport: (...args) => ipcRenderer.invoke('parseImport', ...args),
  readDir: options => ipcRenderer.invoke('readDir', options),
  readOrCreateDataDir: options => ipcRenderer.invoke('readOrCreateDataDir', options),
  lintSpec: options => ipcRenderer.invoke('lintSpec', options),
  on: (channel, listener) => {
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  webSocket,
  socketIO,
  mcp,
  git,
  llm,
  grpc,
  curl,
  secretStorage,
  trackSegmentEvent: options => ipcRenderer.send('trackSegmentEvent', options),
  trackPageView: options => ipcRenderer.send('trackPageView', options),
  setCurrentOrganizationId: organizationId => ipcRenderer.send('analytics.setOrganizationId', organizationId),
  showNunjucksContextMenu: options => ipcRenderer.send('show-nunjucks-context-menu', options),
  showContextMenu: options => ipcRenderer.send('showContextMenu', options),
  database: {
    caCertificate: {
      create: options => ipcRenderer.invoke('database.caCertificate.create', options),
    },
  },
  hiddenBrowserWindow: {
    runScript: options =>
      new Promise(async (resolve, reject) => {
        const isPortAlive = ports.get('hiddenWindowPort') !== undefined;
        await ipcRenderer.invoke('open-channel-to-hidden-browser-window', isPortAlive);

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
  extractJsonFileFromPostmanDataDumpArchive: archivePath =>
    ipcRenderer.invoke('extractJsonFileFromPostmanDataDumpArchive', archivePath),
  getLocalStorageDataFromFileOrigin: () => ipcRenderer.invoke('getLocalStorageDataFromFileOrigin'),
  generateMockRouteDataFromSpec: (
    openApiSpec: string | undefined,
    specUrl: string | undefined,
    specText: string | undefined,
    modelConfig: any,
    useDynamicMockResponses: boolean,
    mockServerAdditionalFiles: string[],
  ) =>
    ipcRenderer.invoke(
      'generateMockRouteDataFromSpec',
      openApiSpec,
      specUrl,
      specText,
      modelConfig,
      useDynamicMockResponses,
      mockServerAdditionalFiles,
    ),
  generateCommitsFromDiff: (input: { diff: string; recent_commits: string }) =>
    ipcRenderer.invoke('generateCommitsFromDiff', input),
  generateMcpSamplingResponse: (parameters: Parameters<GenerateMcpSamplingResponseFunction>[0]) =>
    ipcRenderer.invoke('generateMcpSamplingResponse', parameters),
};

ipcRenderer.on('hidden-browser-window-response-listener', event => {
  const [port] = event.ports;
  ports.set('hiddenWindowPort', port);
  ipcRenderer.invoke('main-window-script-port-ready');
});
const path: Window['path'] = {
  dirname: (p: string) => ipcRenderer.sendSync('path.dirname', p),
  basename: (p: string) => ipcRenderer.sendSync('path.basename', p),
  join: (...paths: string[]) => ipcRenderer.sendSync('path.join', ...paths),
  resolve: (...paths: string[]) => ipcRenderer.sendSync('path.resolve', ...paths),
};
const dialog: Window['dialog'] = {
  showOpenDialog: options => ipcRenderer.invoke('showOpenDialog', options),
  showSaveDialog: options => ipcRenderer.invoke('showSaveDialog', options),
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
  openPath: options => ipcRenderer.invoke('openPath', options),
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
  invoke: (fnName, ...args) => ipcRenderer.invoke('database.invoke', fnName, ...args),
};

const servicesProxy = new Proxy({} as Services, {
  get(_target, serviceName: string) {
    return new Proxy(
      {},
      {
        get(_target, methodName: string) {
          return (...args: unknown[]) => ipcRenderer.invoke('services.invoke', serviceName, methodName, ...args);
        },
      },
    );
  },
});

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
}
