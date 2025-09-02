import { v4 as uuidv4 } from 'uuid';

import { CONTENT_TYPE_JSON } from '~/common/constants';
import { newDefaultRegistry } from '~/common/hotkeys';
import { HttpVersions, UpdateChannel } from '~/common/settings';

import appConfig from '../../config/config.json';
import { generateId } from '../common/misc';
import { typedKeys } from '../utils';

export interface BaseModel {
  _id: string;
  type: AllTypes;
  // TSCONVERSION -- parentId is always required for all models, except 4:
  //   - Stats, Settings, and Project, which never have a parentId
  //   - Workspace optionally has a parentId (which will be the id of a Project)
  parentId: string; // or null
  modified: number;
  created: number;
  isPrivate: boolean;
  name: string;
}

export function canSync(d: BaseModel) {
  if (d.isPrivate) {
    return false;
  }

  const m = getModel(d.type);

  if (!m) {
    return false;
  }

  return m.canSync || false;
}

export function getModel(type: string) {
  return Object.values(modelManifest).find(m => m.type === type) || null;
}

export function mustGetModel(type: string) {
  const model = getModel(type);

  if (!model) {
    throw new Error(`The model type ${type} must exist but could not be found.`);
  }

  return model;
}

export function canDuplicate(type: string) {
  const model = getModel(type);
  return model ? model.canDuplicate : false;
}

export async function initModel<T extends BaseModel>(type: string, ...sources: Record<string, any>[]): Promise<T> {
  const model = getModel(type);

  if (!model) {
    const choices = Object.values(modelManifest)
      .map(m => m.type)
      .join(', ');
    throw new Error(`Tried to init invalid model "${type}". Choices are ${choices}`);
  }

  // Define global default fields
  const objectDefaults = Object.assign(
    {},
    {
      _id: null,
      type: type,
      parentId: null,
      modified: Date.now(),
      created: Date.now(),
    },
    model.defaults,
  );
  const fullObject = Object.assign({}, objectDefaults, ...sources);

  // Generate an _id if there isn't one yet
  if (!fullObject._id) {
    fullObject._id = generateId(model.prefix);
  }

  // Migrate the model
  // NOTE: Do migration before pruning because we might need to look at those fields
  // TODO(jack): explain why a migration shouldnt need to be here for 6 years, the only case it caters for is preserving data we can do without
  // cookies should have ids
  // responses should not be in zip files
  // hotkeys should exist etc
  // const migratedDoc = model.migrate(fullObject);
  // optional keys do not generated in init method but should allow update.
  // If we put those keys in init method, all related models will show as modified in git sync.
  const modelOptionalKeys: string[] = 'optionalKeys' in model ? model.optionalKeys || [] : [];
  // Prune extra keys from doc
  for (const key of typedKeys(fullObject)) {
    if (!(key in objectDefaults) && !modelOptionalKeys.includes(key)) {
      delete fullObject[key];
    }
  }

  return fullObject as T;
}

// Use function instead of object to avoid issues with circular dependencies
export const getAllDescendantMap = (): Partial<Record<AllTypes, AllTypes[]>> => {
  return {
    ['Workspace']: [
      'RequestGroup',
      'Request',
      'GrpcRequest',
      'WebSocketRequest',
      'SocketIORequest',
      'CookieJar',
      'Environment',
      'ApiSpec',
      'MockServer',
      'UnitTestSuite',
      'ProtoDirectory',
      'ProtoFile',
      'WorkspaceMeta',
      'RunnerTestResult',
      'CaCertificate',
      'ClientCertificate',
    ],
    ['RequestGroup']: [
      'RequestGroup',
      'Request',
      'GrpcRequest',
      'WebSocketRequest',
      'SocketIORequest',
      'RunnerTestResult',
      'RequestGroupMeta',
      'OAuth2Token',
    ],
    ['Request']: ['RequestMeta', 'Response', 'RequestVersion', 'OAuth2Token'],
    ['GrpcRequest']: ['GrpcRequestMeta'],
    ['WebSocketRequest']: ['WebSocketPayload', 'WebSocketResponse', 'RequestMeta'],
    ['SocketIORequest']: ['SocketIOPayload', 'SocketIOResponse', 'RequestMeta'],
    ['MockServer']: ['MockRoute'],
    ['Environment']: ['Environment'],
    ['UnitTestSuite']: ['UnitTest', 'UnitTestResult'],
    ['UnitTest']: ['UnitTestResult'],
    ['ProtoDirectory']: ['ProtoDirectory', 'ProtoFile'],
  };
};
export const modelManifest = {
  ApiSpec: {
    type: 'ApiSpec',
    name: 'ApiSpec',
    prefix: 'spc',
    canDuplicate: true,
    canSync: true,
    defaults: { fileName: 'New Document', contents: '', contentType: 'yaml' },
  },
  CaCertificate: {
    type: 'CaCertificate',
    name: 'CA Certificate',
    prefix: 'crt',
    canDuplicate: true,
    canSync: false,
    defaults: { parentId: '', disabled: false, path: null, isPrivate: false },
  },
  ClientCertificate: {
    type: 'ClientCertificate',
    name: 'Client Certificate',
    prefix: 'crt',
    canDuplicate: true,
    canSync: false,
    defaults: {
      parentId: '',
      host: '',
      passphrase: null,
      disabled: false,
      cert: null,
      key: null,
      pfx: null,
      isPrivate: false,
    },
  },
  CloudCredential: {
    type: 'CloudCredential',
    name: 'Cloud Credential',
    prefix: 'cloudCred',
    canDuplicate: false,
    canSync: false,
    defaults: { name: '', provider: undefined, credentials: undefined },
  },
  CookieJar: {
    type: 'CookieJar',
    name: 'Cookie Jar',
    prefix: 'jar',
    canDuplicate: true,
    canSync: false,
    defaults: { name: 'Default Jar', cookies: [] },
  },
  Environment: {
    type: 'Environment',
    name: 'Environment',
    prefix: 'env',
    canDuplicate: true,
    canSync: true,
    defaults: {
      name: 'New Environment',
      data: {},
      dataPropertyOrder: null,
      color: null,
      isPrivate: false,
      metaSortKey: 1756818285181,
    },
  },
  GitCredentials: {
    type: 'GitCredentials',
    name: 'Git Credentials',
    prefix: 'git_creds',
    canDuplicate: false,
    canSync: false,
    defaults: {
      token: '',
      refreshToken: '',
      provider: 'github',
      author: {
        email: '',
        name: '',
        avatarUrl: '',
      },
    },
  },
  GitRepository: {
    type: 'GitRepository',
    name: 'Git Repository',
    prefix: 'git',
    canDuplicate: false,
    canSync: false,
    defaults: {
      needsFullClone: false,
      uri: '',
      credentials: null,
      author: {
        email: '',
        name: '',
        avatarUrl: '',
      },
      cachedGitLastCommitTime: null,
      cachedGitRepositoryBranch: null,
      cachedGitLastAuthor: null,
      hasUncommittedChanges: false,
      hasUnpushedChanges: false,
      uriNeedsMigration: true,
    },
  },
  GrpcRequest: {
    type: 'GrpcRequest',
    name: 'gRPC Request',
    prefix: 'greq',
    canDuplicate: true,
    canSync: true,
    defaults: {
      url: '',
      name: 'New gRPC Request',
      description: '',
      protoFileId: '',
      protoMethodName: '',
      metadata: [],
      body: {
        text: '{}',
      },
      metaSortKey: -1756818285182,
      isPrivate: false,
      reflectionApi: {
        enabled: false,
        url: 'https://buf.build',
        apiKey: '',
        module: 'buf.build/connectrpc/eliza',
      },
    },
  },
  GrpcRequestMeta: {
    type: 'GrpcRequestMeta',
    name: 'gRPC Request Meta',
    prefix: 'greqm',
    canDuplicate: false,
    canSync: false,
    defaults: { pinned: false, lastActive: 0 },
  },
  MockRoute: {
    type: 'MockRoute',
    name: 'Mock Route',
    prefix: 'mock-route',
    canDuplicate: true,
    canSync: true,
    defaults: {
      body: '',
      headers: [],
      parentId: '',
      statusCode: 200,
      statusText: '',
      name: '/',
      mimeType: 'application/json',
      method: 'GET',
    },
  },
  MockServer: {
    type: 'MockServer',
    name: 'Mock Server',
    prefix: 'mock',
    canDuplicate: true,
    canSync: true,
    defaults: {
      parentId: '',
      name: 'New Mock',
      url: 'http://localhost:8080',
      useInsomniaCloud: true,
    },
  },
  OAuth2Token: {
    type: 'OAuth2Token',
    name: 'OAuth 2.0 Token',
    prefix: 'oa2',
    canDuplicate: false,
    canSync: false,
    defaults: {
      refreshToken: '',
      accessToken: '',
      identityToken: '',
      expiresAt: null,
      xResponseId: null,
      xError: null,
      error: '',
      errorDescription: '',
      errorUri: '',
    },
  },
  PluginData: {
    type: 'PluginData',
    name: 'PluginData',
    prefix: 'plg',
    canDuplicate: false,
    canSync: false,
    defaults: { plugin: '', key: '', value: '' },
  },
  Project: {
    type: 'Project',
    name: 'Project',
    prefix: 'proj',
    canDuplicate: false,
    canSync: false,
    defaults: { name: 'My Project', remoteId: null, gitRepositoryId: null },
  },
  ProtoDirectory: {
    type: 'ProtoDirectory',
    name: 'Proto Directory',
    prefix: 'pd',
    canDuplicate: true,
    canSync: true,
    defaults: { name: 'New Proto Directory' },
  },
  ProtoFile: {
    type: 'ProtoFile',
    name: 'Proto File',
    prefix: 'pf',
    canDuplicate: true,
    canSync: true,
    defaults: { name: 'New Proto File', protoText: '' },
  },
  Request: {
    type: 'Request',
    name: 'Request',
    prefix: 'req',
    canDuplicate: true,
    canSync: true,
    defaults: {
      url: '',
      name: 'New Request',
      description: '',
      method: 'GET',
      body: {},
      parameters: [],
      headers: [],
      authentication: {},
      preRequestScript: undefined,
      metaSortKey: -1756818285181,
      isPrivate: false,
      pathParameters: undefined,
      afterResponseScript: undefined,
      settingStoreCookies: true,
      settingSendCookies: true,
      settingDisableRenderRequestBody: false,
      settingEncodeUrl: true,
      settingRebuildPath: true,
      settingFollowRedirects: 'global',
    },
  },
  RequestGroup: {
    type: 'RequestGroup',
    name: 'Folder',
    prefix: 'fld',
    canDuplicate: true,
    canSync: true,
    defaults: {
      name: 'New Folder',
      description: '',
      environment: {},
      environmentPropertyOrder: null,
      metaSortKey: -1756818285181,
      preRequestScript: undefined,
      afterResponseScript: undefined,
      authentication: undefined,
      headers: undefined,
    },
  },
  RequestGroupMeta: {
    type: 'RequestGroupMeta',
    name: 'Folder Meta',
    prefix: 'fldm',
    canDuplicate: false,
    canSync: false,
    defaults: { parentId: null, collapsed: false },
  },
  RequestMeta: {
    type: 'RequestMeta',
    name: 'Request Meta',
    prefix: 'reqm',
    canDuplicate: false,
    canSync: false,
    defaults: {
      parentId: null,
      previewMode: 'friendly',
      responseFilter: '',
      responseFilterHistory: [],
      activeResponseId: null,
      savedRequestBody: {},
      pinned: false,
      lastActive: 0,
      downloadPath: null,
      expandedAccordionKeys: {},
    },
  },
  RequestVersion: {
    type: 'RequestVersion',
    name: 'Request Version',
    prefix: 'rvr',
    canDuplicate: false,
    canSync: false,
    defaults: { compressedRequest: null },
  },
  Response: {
    type: 'Response',
    name: 'Response',
    prefix: 'res',
    canDuplicate: false,
    canSync: false,
    defaults: {
      statusCode: 0,
      statusMessage: '',
      httpVersion: '',
      contentType: '',
      url: '',
      bytesRead: 0,
      bytesContent: -1,
      elapsedTime: 0,
      headers: [],
      timelinePath: '',
      bodyPath: '',
      bodyCompression: '__NEEDS_MIGRATION__',
      error: '',
      requestVersionId: null,
      settingStoreCookies: null,
      settingSendCookies: null,
      environmentId: '__LEGACY__',
      requestTestResults: [],
      globalEnvironmentId: null,
    },
  },
  RunnerTestResult: {
    type: 'RunnerTestResult',
    name: 'Runner Test Result',
    prefix: 'rtr',
    canDuplicate: false,
    canSync: false,
    defaults: {
      source: 'runner',
      iterations: 0,
      duration: 0,
      avgRespTime: 0,
      iterationResults: [],
      responsesInfo: [],
      version: '1',
    },
  },
  Settings: {
    type: 'Settings',
    name: 'Settings',
    prefix: 'set',
    canDuplicate: false,
    canSync: false,
    defaults: {
      autoDetectColorScheme: false,
      autoHideMenuBar: false,
      autocompleteDelay: 1200,
      clearOAuth2SessionOnRestart: true,
      darkTheme: appConfig.darkTheme,
      deviceId: null,
      disableHtmlPreviewJs: false,
      disableResponsePreviewLinks: false,
      disableAppVersionUserAgent: false,
      disableUpdateNotification: false,
      editorFontSize: 11,
      editorIndentSize: 2,
      editorIndentWithTabs: true,
      editorKeyMap: 'default',
      enableKeyMapForInlineTextEditors: false,
      editorLineWrapping: true,
      enableAnalytics: true,
      showVariableSourceAndValue: false,
      filterResponsesByEnv: false,
      followRedirects: true,
      fontInterface: null,
      fontMonospace: null,
      fontSize: 13,
      fontVariantLigatures: false,
      forceVerticalLayout: !!process.env.PLAYWRIGHT,
      hotKeyRegistry: newDefaultRegistry(),
      httpProxy: '',
      httpsProxy: '',
      lightTheme: appConfig.lightTheme,
      maxHistoryResponses: 20,
      maxRedirects: 10,
      maxTimelineDataSizeKB: 10,
      pluginNodeExtraCerts: '',
      pluginsAllowElevatedAccess: false,
      noProxy: '',
      nunjucksPowerUserMode: false,
      pluginConfig: {},
      pluginPath: '',
      preferredHttpVersion: HttpVersions.default,
      proxyEnabled: false,
      showPasswords: false,
      theme: appConfig.theme,
      // milliseconds
      timeout: 30_000,
      updateAutomatically: true,
      updateChannel: UpdateChannel.stable,
      useBulkHeaderEditor: false,
      useBulkParametersEditor: false,
      validateAuthSSL: true,
      validateSSL: true,
      saveVaultKeyLocally: true,
      enableVaultInScripts: false,
      saveVaultKeyToOSSecretManager: true,
      // The duration in mins for which the external vault secret is cached
      vaultSecretCacheDuration: 30,
      dataFolders: [],
    },
  },
  SocketIOPayload: {
    type: 'SocketIOPayload',
    name: 'SocketIO Payload',
    prefix: 'socket-io-payload',
    canDuplicate: true,
    canSync: true,
    defaults: { args: [{ id: uuidv4(), value: '', mode: CONTENT_TYPE_JSON }], eventName: '', ack: false },
  },
  SocketIORequest: {
    type: 'SocketIORequest',
    name: 'Socket.IO Request',
    prefix: 'socketio-req',
    canDuplicate: true,
    canSync: true,
    defaults: {
      name: 'New Socket.IO Request',
      url: '',
      metaSortKey: -1756818285182,
      headers: [],
      authentication: {},
      parameters: [],
      pathParameters: undefined,
      settingEncodeUrl: true,
      settingStoreCookies: true,
      settingSendCookies: true,
      description: '',
      eventListeners: [],
    },
  },
  SocketIOResponse: {
    type: 'SocketIOResponse',
    name: 'SocketIO Response',
    prefix: 'socketIO-res',
    canDuplicate: false,
    canSync: false,
    defaults: {
      timelinePath: '',
      eventLogPath: '',
      requestVersionId: null,
      environmentId: null,
      elapsedTime: 0,
      error: '',
      url: '',
    },
  },
  Stats: {
    type: 'Stats',
    name: 'Stats',
    prefix: 'sta',
    canDuplicate: false,
    canSync: false,
    defaults: {
      currentLaunch: null,
      lastLaunch: null,
      currentVersion: null,
      lastVersion: null,
      launches: 0,
      createdRequests: 0,
      deletedRequests: 0,
      executedRequests: 0,
    },
  },
  UnitTest: {
    type: 'UnitTest',
    name: 'Unit Test',
    prefix: 'ut',
    canDuplicate: true,
    canSync: true,
    defaults: {
      requestId: null,
      name: 'My Test',
      code: '',
      metaSortKey: -1756818285182,
    },
  },
  UnitTestResult: {
    type: 'UnitTestResult',
    name: 'Unit Test Result',
    prefix: 'utr',
    canDuplicate: false,
    canSync: false,
    defaults: { results: null },
  },
  UnitTestSuite: {
    type: 'UnitTestSuite',
    name: 'Unit Test Suite',
    prefix: 'uts',
    canDuplicate: true,
    canSync: true,
    defaults: { name: 'My Test', metaSortKey: -1756818285182 },
  },
  UserSession: {
    type: 'UserSession',
    name: 'UserSession',
    prefix: 'usr',
    canDuplicate: false,
    canSync: false,
    defaults: {
      accountId: '',
      id: '',
      email: '',
      firstName: '',
      lastName: '',
      symmetricKey: {},
      publicKey: {},
      encPrivateKey: {},
      vaultKey: '',
      vaultSalt: '',
    },
  },
  WebSocketPayload: {
    type: 'WebSocketPayload',
    name: 'WebSocket Payload',
    prefix: 'ws-payload',
    canDuplicate: true,
    canSync: true,
    defaults: { name: 'New Payload', value: '', mode: 'application/json' },
  },
  WebSocketRequest: {
    type: 'WebSocketRequest',
    name: 'WebSocket Request',
    prefix: 'ws-req',
    canDuplicate: true,
    canSync: true,
    defaults: {
      name: 'New WebSocket Request',
      url: '',
      metaSortKey: -1756818285182,
      headers: [],
      authentication: {},
      parameters: [],
      pathParameters: undefined,
      settingEncodeUrl: true,
      settingStoreCookies: true,
      settingSendCookies: true,
      settingFollowRedirects: 'global',
      description: '',
    },
  },
  WebSocketResponse: {
    type: 'WebSocketResponse',
    name: 'WebSocket Response',
    prefix: 'ws-res',
    canDuplicate: false,
    canSync: false,
    defaults: {
      statusCode: 0,
      statusMessage: '',
      httpVersion: '',
      contentType: '',
      url: '',
      elapsedTime: 0,
      headers: [],
      timelinePath: '',
      eventLogPath: '',
      error: '',
      requestVersionId: null,
      settingStoreCookies: null,
      settingSendCookies: null,
      environmentId: null,
    },
  },
  Workspace: {
    type: 'Workspace',
    name: 'Workspace',
    prefix: 'wrk',
    canDuplicate: true,
    canSync: true,
    defaults: { name: 'New Collection', description: '', scope: 'collection' },
  },
  WorkspaceMeta: {
    type: 'WorkspaceMeta',
    name: 'Workspace Meta',
    prefix: 'wrkm',
    canDuplicate: false,
    canSync: false,
    defaults: {
      activeActivity: null,
      activeEnvironmentId: null,
      activeGlobalEnvironmentId: null,
      activeRequestId: null,
      activeUnitTestSuiteId: null,
      gitRepositoryId: null,
      gitFilePath: null,
      parentId: null,
      pushSnapshotOnInitialize: false,
      hasUncommittedChanges: false,
      hasUnpushedChanges: false,
    },
  },
};

export const types = Object.values(modelManifest).map(model => model.type);

export type AllTypes = (typeof types)[number];
