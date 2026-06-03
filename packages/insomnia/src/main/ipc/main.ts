import fs, { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import zlib from 'node:zlib';

import type { ISpectralDiagnostic } from '@stoplight/spectral-core';
import chardet from 'chardet';
import type { MarkerRange } from 'codemirror';
import {
  app,
  BrowserWindow,
  type IpcRendererEvent,
  type MenuItemConstructorOptions,
  shell,
  utilityProcess,
} from 'electron';
import type { UtilityProcess } from 'electron/main';
import { availableTargets, HTTPSnippet } from 'httpsnippet';
import iconv from 'iconv-lite';
import type { AuthTypeOAuth2, OAuth2Token, RequestHeader, Services, TestResults } from 'insomnia-data';
import { services } from 'insomnia-data';
import { runTests } from 'insomnia-testing/src/run/run';

import { bundleSpectralRuleset } from '~/common/bundle-spectral-ruleset';
import { AI_PLUGIN_NAME } from '~/common/constants';
import { cannotAccessPathError } from '~/common/misc';
import { initializeWorkspaceBackendProject, syncNewWorkspaceIfNeeded } from '~/main/cloud-sync/initialization';
import type { SyncBridgeAPI } from '~/main/cloud-sync/ipc';
import {
  exportHarCurrentRequest,
  exportHarRequest,
  exportHarWithRequest,
  exportRequestsHAR,
  exportWorkspacesHAR,
} from '~/main/har';
import { convert } from '~/main/importers/convert';
import { getCurrentConfig, type LLMConfigServiceAPI } from '~/main/llm-config-service';
import { multipartBufferToArray, type Part } from '~/main/multipart-buffer-to-array';
import { insecureReadFile, insecureReadFileWithEncoding, isPathAllowed, secureReadFile } from '~/main/secure-read-file';
import {
  deleteCompiledRuleset,
  invalidateCompiledRulesetCache,
  writeCompiledRuleset,
} from '~/main/spectral-ruleset-cache';
import { getSendRequestCallback } from '~/network/unit-test-feature';
import type {
  GenerateCommitsFromDiffFunction,
  GenerateMcpSamplingResponseFunction,
  MockRouteData,
  ModelConfig,
} from '~/plugins/types';

import * as crypt from '../../account/crypt';
import type { HiddenBrowserWindowBridgeAPI } from '../../entry.hidden-window';
import type { PluginsBridgeAPI } from '../../plugins/bridge-types';
import type { RenderedRequest } from '../../templating/types';
import { decryptSecretValue, encryptSecretValue } from '../../utils/crypt-adapter';
import { keyPair as sealedboxKeyPair, open as sealedboxOpen } from '../../utils/sealedbox';
import type { AnalyticsEvent } from '../analytics';
import { setCurrentOrganizationId, trackAnalyticsEvent, trackPageView } from '../analytics';
import {
  authorizeUserInDefaultBrowser,
  cancelAuthorizationInDefaultBrowser,
  onDefaultBrowserOAuthRedirect,
} from '../authorize-user-in-default-browser';
import { authorizeUserInWindow } from '../authorize-user-in-window';
import { backup, restoreBackup } from '../backup';
import { createPlugin } from '../create-plugin';
import type { GitServiceAPI } from '../git-service';
import installPlugin from '../install-plugin';
import type { CurlBridgeAPI } from '../network/curl';
import { getAuthHeader as getAuthHeaderInMain } from '../network/get-auth-header';
import { cancelCurlRequest, curlRequest } from '../network/libcurl-promise';
import type { McpBridgeAPI } from '../network/mcp';
import { getOAuth2Token as getOAuth2TokenInMain } from '../network/o-auth-2/get-token';
import {
  addExecutionStep,
  completeExecutionStep,
  getExecution,
  startExecution,
  type TimingStep,
  updateLatestStepName,
} from '../network/request-timing';
import type { SocketIOBridgeAPI } from '../network/socket-io';
import type { WebSocketBridgeAPI } from '../network/websocket';
import { registerPluginIpcHandlers } from '../plugin-window';
import type { CookiesBridgeAPI } from './cookies';
import { ipcMainHandle, ipcMainOn, type RendererOnChannels } from './electron';
import type { electronStorageBridgeAPI } from './electron-storage';
import extractPostmanDataDumpHandler from './extract-postman-data-dump';
import type { gRPCBridgeAPI } from './grpc';
import type { secretStorageBridgeAPI } from './secret-storage';

let lintProcess: Electron.UtilityProcess | null = null;

export const openInBrowser = (href: string) => {
  const { protocol } = new URL(href);
  if (protocol === 'http:' || protocol === 'https:') {
    shell.openExternal(href);
  }
};

const readDir = async (_: unknown, options: { path: string }) => {
  try {
    const files = await fs.promises.readdir(options.path);
    return files
      .map(file => {
        const filePath = path.join(options.path, file);
        return {
          type: fs.statSync(filePath).isDirectory() ? 'directory' : fs.statSync(filePath).isFile() ? 'file' : 'other',
          name: file,
          path: filePath,
        };
      })
      .filter(file => file.type !== 'other');
  } catch (err) {
    throw new Error(`Failed to read directory: ${err}`);
  }
};

const writeResponseBodyToFile = async (
  _: unknown,
  options: { sourcePath: string; destinationPath: string; bodyCompression?: 'zip' | null },
) => {
  // Validate sourcePath is within the expected responses directory to prevent a
  // compromised renderer from using this handler to read arbitrary files on disk.
  const userdataDirectory = process.env.INSOMNIA_DATA_PATH || app.getPath('userData');
  const allowedResponsesDir = path.join(userdataDirectory, 'responses');
  const resolvedSource = path.resolve(options.sourcePath);
  if (!resolvedSource.startsWith(allowedResponsesDir + path.sep) || !resolvedSource.endsWith('.response')) {
    throw new Error(
      'writeResponseBodyToFile: sourcePath is outside the allowed responses directory or does not end in .response',
    );
  }

  try {
    const dir = path.dirname(options.destinationPath);
    await fs.promises.mkdir(dir, { recursive: true });

    await (options.bodyCompression === 'zip'
      ? pipeline(
          fs.createReadStream(options.sourcePath),
          zlib.createGunzip(),
          fs.createWriteStream(options.destinationPath),
        )
      : fs.promises.copyFile(options.sourcePath, options.destinationPath));

    return options.destinationPath;
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }

    throw new Error(String(err));
  }
};

const getResponsesDir = () => path.join(process.env.INSOMNIA_DATA_PATH || app.getPath('userData'), 'responses');

const responsesDirCreated = new Set<string>();

const getTimelinePath = (_: unknown, responseId: string) => {
  const base = path.resolve(getResponsesDir());
  const target = path.resolve(base, responseId + '.timeline');
  const relative = path.relative(base, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Invalid response ID');
  }
  return target;
};

const appendToTimeline = async (_: unknown, options: { timelinePath: string; data: string }) => {
  const allowedResponsesDir = getResponsesDir();
  const resolvedPath = path.resolve(options.timelinePath);
  if (!resolvedPath.startsWith(path.resolve(allowedResponsesDir) + path.sep) || !resolvedPath.endsWith('.timeline')) {
    throw new Error(
      'appendToTimeline: timelinePath is outside the allowed responses directory or does not end in .timeline',
    );
  }
  const dir = path.dirname(resolvedPath);
  if (!responsesDirCreated.has(dir)) {
    await fs.promises.mkdir(dir, { recursive: true });
    responsesDirCreated.add(dir);
  }
  await fs.promises.appendFile(resolvedPath, options.data);
};

export interface RendererToMainBridgeAPI {
  runTests: (src: string) => Promise<TestResults>;
  loginStateChange: (isLoggedIn: boolean) => void;
  openInBrowser: (url: string) => void;
  restart: () => void;
  halfSecondAfterAppStart: () => void;
  openDeepLink: (url: string) => void;
  manualUpdateCheck: () => void;
  backup: () => Promise<void>;
  restoreBackup: (version: string) => Promise<void>;
  authorizeUserInWindow: typeof authorizeUserInWindow;
  authorizeUserInDefaultBrowser: typeof authorizeUserInDefaultBrowser;
  onDefaultBrowserOAuthRedirect: typeof onDefaultBrowserOAuthRedirect;
  cancelAuthorizationInDefaultBrowser: typeof cancelAuthorizationInDefaultBrowser;
  setMenuBarVisibility: (visible: boolean) => void;
  installPlugin: typeof installPlugin;
  initializeWorkspaceBackendProject: typeof initializeWorkspaceBackendProject;
  parseImport: typeof convert;
  multipartBufferToArray: (options: { bodyBuffer: Buffer; contentType: string }) => Promise<Part[]>;
  writeFile: (options: { path: string; content: string | Buffer }) => Promise<string>;
  deleteCompiledRuleset: (options: { projectId: string }) => Promise<void>;
  refreshCompiledRuleset: (options: { projectId: string; rulesetContent: string }) => Promise<{ compiledPath: string }>;
  writeResponseBodyToFile: (options: {
    sourcePath: string;
    destinationPath: string;
    bodyCompression?: 'zip' | null;
  }) => Promise<string>;
  getAuthHeader: (renderedRequest: RenderedRequest, url: string) => Promise<RequestHeader | undefined>;
  getOAuth2Token: (
    requestId: string,
    authentication: AuthTypeOAuth2,
    forceRefresh?: boolean,
  ) => Promise<OAuth2Token | undefined>;
  secureReadFile: (options: { path: string }) => Promise<string>;
  insecureReadFile: (options: { path: string }) => Promise<string>;
  insecureReadFileWithEncoding: (options: {
    path: string;
    encoding?: string;
  }) => Promise<{ content: string; encoding: string; error: string | undefined }>;
  readDir: (options: { path: string }) => Promise<{ type: 'file' | 'directory'; name: string; path: string }[]>;
  readOrCreateDataDir: (options: {
    folder: string;
  }) => Promise<{ type: 'file' | 'directory'; name: string; path: string }[]>;
  cancelCurlRequest: typeof cancelCurlRequest;
  curlRequest: typeof curlRequest;
  on: (channel: RendererOnChannels, listener: (event: IpcRendererEvent, ...args: any[]) => void) => () => void;
  cookies: CookiesBridgeAPI;
  webSocket: WebSocketBridgeAPI;
  socketIO: SocketIOBridgeAPI;
  mcp: McpBridgeAPI;
  grpc: gRPCBridgeAPI;
  curl: CurlBridgeAPI;
  git: GitServiceAPI;
  llm: LLMConfigServiceAPI;
  secretStorage: secretStorageBridgeAPI;
  electronStorage: electronStorageBridgeAPI;
  sync: SyncBridgeAPI;
  trackAnalyticsEvent: (options: { event: string; properties?: Record<string, unknown> }) => void;
  trackPageView: (options: { name: string }) => void;
  setCurrentOrganizationId: (organizationId: string | undefined) => void;
  showNunjucksContextMenu: (options: {
    key: string;
    nunjucksTag?: { template: string; range: MarkerRange };
    pluginTemplateTags?: { templateTag: Record<string, unknown> }[];
  }) => void;
  showContextMenu: (options: {
    key: string;
    menuItems: MenuItemConstructorOptions[];
    extra?: Record<string, any>;
  }) => void;
  lintSpec: (options: {
    documentContent: string;
    projectId: string;
    rulesetContent: string;
  }) => Promise<{ diagnostics?: ISpectralDiagnostic[]; error?: string; cancelled?: boolean }>;
  bundleSpectralRuleset: (options: { sourcePath: string }) => Promise<{ content?: string; error?: string }>;
  createPlugin: (options: { pluginName: string; mainJs: string }) => Promise<void>;
  database: {
    caCertificate: {
      create: (options: { parentId: string; path: string }) => Promise<string>;
    };
  };
  hiddenBrowserWindow: HiddenBrowserWindowBridgeAPI;
  getExecution: (options: { requestId: string }) => Promise<TimingStep[]>;
  addExecutionStep: (options: { requestId: string; stepName: string }) => void;
  startExecution: (options: { requestId: string }) => void;
  completeExecutionStep: (options: { requestId: string }) => void;
  updateLatestStepName: (options: { requestId: string; stepName: string }) => void;
  extractJsonFileFromPostmanDataDumpArchive: (archivePath: string) => Promise<any>;
  getLocalStorageDataFromFileOrigin: () => Promise<Record<string, any>>;
  generateMockRouteDataFromSpec: (
    openApiSpec: string | undefined,
    specUrl: string | undefined,
    specText: string | undefined,
    modelConfig: any,
    useDynamicMockResponses: boolean,
    mockServerAdditionalFiles: string[],
  ) => Promise<{ error: string; routes: MockRouteData[] }>;
  generateCodeSnippet: (options: { har: object; target: string; client: string }) => Promise<string>;
  getCodeSnippetTargets: () => Promise<{ key: string; title: string; clients: { key: string; title: string }[] }[]>;
  exportHarWithRequest: (options: {
    requestId: string;
    environmentId?: string;
    addContentLength?: boolean;
  }) => Promise<any>;
  exportHarRequest: (options: {
    requestId: string;
    environmentOrWorkspaceId: string;
    addContentLength?: boolean;
  }) => Promise<any>;
  exportHarCurrentRequest: (options: { requestId: string; responseId: string }) => Promise<any>;
  exportRequestsHAR: (options: { requests: any[]; includePrivateDocs?: boolean }) => Promise<string>;
  exportWorkspacesHAR: (options: { workspaces: any[]; includePrivateDocs?: boolean }) => Promise<string>;
  generateCommitsFromDiff: (
    input: Parameters<GenerateCommitsFromDiffFunction>[0],
  ) => Promise<
    | { commits: Awaited<ReturnType<GenerateCommitsFromDiffFunction>>; error: undefined }
    | { commits: undefined; error: string }
  >;
  generateMcpSamplingResponse: (
    input: Parameters<GenerateMcpSamplingResponseFunction>[0],
  ) => Promise<
    | { response: Awaited<ReturnType<GenerateMcpSamplingResponseFunction>>; error: undefined }
    | { response: undefined; error: string }
  >;
  syncNewWorkspaceIfNeeded: typeof syncNewWorkspaceIfNeeded;
  plugins: PluginsBridgeAPI;
  notifyPluginPromptResult: (id: string, value: string | null) => void;
  vault: {
    encryptSecretValue: (rawValue: string, symmetricKey: JsonWebKey) => Promise<string>;
    decryptSecretValue: (encryptedValue: string, symmetricKey: JsonWebKey) => Promise<string>;
  };
  crypt: {
    encryptRSAWithJWK: (publicKeyJWK: JsonWebKey, plaintext: string) => Promise<string>;
    decryptRSAWithJWK: (privateJWK: JsonWebKey, encryptedBlob: string) => Promise<string>;
    encryptAESBuffer: (
      jwkOrKey: string | JsonWebKey,
      buff: number[],
      additionalData?: string,
    ) => Promise<crypt.AESMessage>;
    encryptAES: (
      jwkOrKey: string | JsonWebKey,
      plaintext: string,
      additionalData?: string,
    ) => Promise<crypt.AESMessage>;
    decryptAES: (jwkOrKey: string | JsonWebKey, encryptedResult: crypt.AESMessage) => Promise<string>;
    decryptAESToBuffer: (jwkOrKey: string | JsonWebKey, encryptedResult: crypt.AESMessage) => Promise<number[]>;
    generateAES256Key: () => Promise<JsonWebKey>;
  };
  sealedBox: {
    keyPair: () => Promise<{ publicKey: Uint8Array; secretKey: Uint8Array }>;
    open: (sealedbox: Uint8Array, pk: Uint8Array, sk: Uint8Array) => Promise<Uint8Array | null>;
  };
  timeline: {
    getPath: (responseId: string) => Promise<string>;
    appendToFile: (options: { timelinePath: string; data: string }) => Promise<void>;
  };
}

export function registerMainHandlers() {
  ipcMainOn('addExecutionStep', (_, options: { requestId: string; stepName: string }) => {
    addExecutionStep(options.requestId, options.stepName);
  });
  ipcMainOn('startExecution', (_, options: { requestId: string }) => {
    return startExecution(options.requestId);
  });
  ipcMainOn('completeExecutionStep', (_, options: { requestId: string }) => {
    return completeExecutionStep(options.requestId);
  });
  ipcMainOn('updateLatestStepName', (_, options: { requestId: string; stepName: string }) => {
    updateLatestStepName(options.requestId, options.stepName);
  });
  ipcMainHandle('getExecution', (_, options: { requestId: string }) => {
    return getExecution(options.requestId);
  });
  ipcMainHandle('database.caCertificate.create', async (_, options: { parentId: string; path: string }) => {
    return services.caCertificate.create(options);
  });
  ipcMainHandle('createPlugin', async (_, options: { pluginName: string; mainJs: string }) => {
    return createPlugin(options.pluginName, options.mainJs);
  });
  ipcMainHandle('services.invoke', async (_, serviceName: string, methodName: string, ...args: unknown[]) => {
    const service = services[serviceName as keyof Services];
    if (!service) {
      throw new TypeError(`Unknown service: ${serviceName}`);
    }
    const fn = service[methodName as keyof typeof service];
    if (typeof fn !== 'function') {
      throw new TypeError(`Unknown service method: ${serviceName}.${methodName}`);
    }
    const result = await (fn as (...args: unknown[]) => unknown).call(service, ...args);
    // Tag Buffer results before contextBridge serializes them as plain Uint8Array,
    // so the preload can distinguish them from intentional Uint8Array returns.
    if (Buffer.isBuffer(result)) {
      return { __type: 'Buffer', data: Array.from(result as Buffer) };
    }
    return result;
  });
  ipcMainHandle('multipartBufferToArray', async (_, options) => {
    return multipartBufferToArray(options);
  });
  ipcMainOn('loginStateChange', async (event, isLoggedIn: boolean) => {
    BrowserWindow.getAllWindows().forEach(w => {
      if (w.webContents !== event.sender) {
        w.webContents.send('loggedIn', isLoggedIn);
      }
    });
  });
  ipcMainHandle('backup', async () => {
    return backup();
  });
  ipcMainHandle('restoreBackup', async (_, options: string) => {
    return restoreBackup(options);
  });
  ipcMainHandle('authorizeUserInWindow', (_, options: Parameters<typeof authorizeUserInWindow>[0]) => {
    const { url, urlSuccessRegex, urlFailureRegex, sessionId } = options;
    return authorizeUserInWindow({ url, urlSuccessRegex, urlFailureRegex, sessionId });
  });

  ipcMainHandle('authorizeUserInDefaultBrowser', (_, options: Parameters<typeof authorizeUserInDefaultBrowser>[0]) => {
    return authorizeUserInDefaultBrowser(options);
  });
  ipcMainHandle('onDefaultBrowserOAuthRedirect', (_, options: Parameters<typeof onDefaultBrowserOAuthRedirect>[0]) => {
    return onDefaultBrowserOAuthRedirect(options);
  });
  ipcMainHandle(
    'cancelAuthorizationInDefaultBrowser',
    (_, options: Parameters<typeof cancelAuthorizationInDefaultBrowser>[0]) => {
      return cancelAuthorizationInDefaultBrowser(options);
    },
  );
  ipcMainHandle('parseImport', async (_, ...args: Parameters<typeof convert>) => {
    return convert(...args);
  });
  ipcMainHandle(
    'initializeWorkspaceBackendProject',
    async (_, options: Parameters<typeof initializeWorkspaceBackendProject>[0]) => {
      return initializeWorkspaceBackendProject(options);
    },
  );
  ipcMainHandle('writeFile', async (_, options: { path: string; content: string | Buffer }) => {
    try {
      const dir = path.dirname(options.path);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(options.path, options.content);
      return options.path;
    } catch (err) {
      throw new Error(err);
    }
  });
  ipcMainHandle('deleteCompiledRuleset', async (_, options: { projectId: string }) => {
    await deleteCompiledRuleset(options.projectId);
  });
  ipcMainHandle('refreshCompiledRuleset', async (_, options: { projectId: string; rulesetContent: string }) => {
    invalidateCompiledRulesetCache(options.projectId);
    return writeCompiledRuleset(options.projectId, options.rulesetContent);
  });
  ipcMainHandle('writeResponseBodyToFile', writeResponseBodyToFile);
  ipcMainHandle('getAuthHeader', (_, renderedRequest: RenderedRequest, url: string) => {
    return getAuthHeaderInMain(renderedRequest, url);
  });
  ipcMainHandle('getOAuth2Token', (_, requestId: string, authentication: AuthTypeOAuth2, forceRefresh?: boolean) => {
    return getOAuth2TokenInMain(requestId, authentication, forceRefresh);
  });
  ipcMainHandle('bundleSpectralRuleset', async (_, options: { sourcePath: string }) => {
    try {
      const content = await bundleSpectralRuleset(options.sourcePath);
      return { content };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });
  ipcMainHandle(
    'lintSpec',
    async (_, options: { documentContent: string; projectId: string; rulesetContent: string }) => {
      const { documentContent, projectId, rulesetContent } = options;
      let rulesetPath = '';
      if (rulesetContent) {
        try {
          // Compile the ruleset (flattens local extends, fetches + validates + fully inlines remote
          // extends, blocking SSRF and disallowed keys such as "functions") into a URL-free object
          // written to a cache path under userData. The worker is pointed at that compiled object so
          // it has nothing left to fetch — closing the validate-then-use race.
          const { compiledPath } = await writeCompiledRuleset(projectId, rulesetContent);
          rulesetPath = compiledPath;
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      }

      return new Promise((resolve, reject) => {
        // Use a filescoped variable to store and terminate the last open
        // This ensures we use a last in first out type of process management
        // We only care about the most recent lint request
        if (lintProcess) {
          lintProcess.kill();
        }

        lintProcess = utilityProcess.fork(path.join(__dirname, 'main/lint-process.mjs'));

        let process: UtilityProcess | null = lintProcess!;

        // defends against ReDoS via pattern function regex. We terminate the lintProcess worker if it exceeds a reasonable time limit (30s) so it does not pin a CPU core indefinitely.
        const LINT_WORKER_TIMEOUT_MS = 30_000;
        const timeoutHandle = setTimeout(() => {
          if (process) {
            console.warn(`[lint-process] exceeded ${LINT_WORKER_TIMEOUT_MS / 1000}s limit; terminating.`);
            process.kill();
            process = null;
            resolve({
              error: `Linting exceeded the ${LINT_WORKER_TIMEOUT_MS / 1000}s time limit and was terminated. The ruleset or specification may contain a deeply nested schema.`,
            });
          }
        }, LINT_WORKER_TIMEOUT_MS);

        process.on('exit', code => {
          console.log('[lint-process] exited with code:', code);
          clearTimeout(timeoutHandle);
          resolve({ cancelled: true });
        });

        process.on('message', msg => {
          clearTimeout(timeoutHandle);
          resolve(msg);
          process?.kill();
          process = null;
        });

        process.on('error', err => {
          console.error('[lint-process] error:', err);
          clearTimeout(timeoutHandle);
          reject({ error: err.toString() });
        });

        process.postMessage({ documentContent, rulesetPath });
      });
    },
  );

  ipcMainHandle('generateCodeSnippet', async (_, options: { har: object; target: string; client: string }) => {
    const snippet = new HTTPSnippet(options.har as any);
    return snippet.convert(options.target, options.client) || '';
  });

  ipcMainHandle('getCodeSnippetTargets', async () => {
    return availableTargets();
  });

  ipcMainHandle(
    'exportHarWithRequest',
    async (_, options: { requestId: string; environmentId?: string; addContentLength?: boolean }) => {
      const request = await services.request.getById(options.requestId);
      if (!request) {
        throw new Error(`Request ${options.requestId} not found`);
      }
      return exportHarWithRequest(request, options.environmentId, options.addContentLength);
    },
  );

  ipcMainHandle(
    'exportHarRequest',
    async (_, options: { requestId: string; environmentOrWorkspaceId: string; addContentLength?: boolean }) => {
      return exportHarRequest(options.requestId, options.environmentOrWorkspaceId, options.addContentLength);
    },
  );

  ipcMainHandle('exportHarCurrentRequest', async (_, options: { requestId: string; responseId: string }) => {
    const request = await services.request.getById(options.requestId);
    const response = await services.response.getById(options.responseId);
    if (!request || !response) {
      throw new Error('Request or response not found');
    }
    return exportHarCurrentRequest(request, response);
  });

  ipcMainHandle('exportRequestsHAR', async (_, options: { requests: any[]; includePrivateDocs?: boolean }) => {
    return exportRequestsHAR(options.requests, options.includePrivateDocs);
  });

  ipcMainHandle('exportWorkspacesHAR', async (_, options: { workspaces: any[]; includePrivateDocs?: boolean }) => {
    return exportWorkspacesHAR(options.workspaces, options.includePrivateDocs);
  });

  ipcMainHandle('insecureReadFile', async (_, options: { path: string }) => {
    return insecureReadFile(options.path);
  });
  ipcMainHandle('secureReadFile', async (_, options: { path: string; encoding?: string }) => {
    return secureReadFile(options.path);
  });
  ipcMainHandle('insecureReadFileWithEncoding', async (_, options: { path: string; encoding: string }) => {
    try {
      const contentBuffer = await insecureReadFileWithEncoding(options.path);
      if (typeof contentBuffer === 'string') {
        return { content: contentBuffer, encoding: 'utf8' };
      }

      const encoding = options.encoding || (await chardet.detectFile(options.path));

      if (encoding) {
        if (iconv.encodingExists(encoding)) {
          const content = iconv.decode(contentBuffer, encoding);
          return { content, encoding };
        }
        throw new Error(`Unsupported encoding: ${encoding} to read file`);
      }
      return {
        content: iconv.decode(contentBuffer, 'utf8'),
        encoding: 'utf8',
      };
    } catch (err) {
      return { content: '', encoding: '', error: err };
    }
  });

  ipcMainHandle('readDir', readDir);

  ipcMainHandle('readOrCreateDataDir', async (_, options: { folder: string }) => {
    const folderPath = path.join(app.getPath('userData'), options.folder);
    mkdirSync(folderPath, { recursive: true });
    try {
      return await readDir(_, { path: folderPath });
    } catch {
      return [];
    }
  });

  ipcMainHandle('curlRequest', (_, options: Parameters<typeof curlRequest>[0]) => {
    return curlRequest(options);
  });

  ipcMainOn('cancelCurlRequest', (_, requestId: string): void => {
    cancelCurlRequest(requestId);
  });

  ipcMainOn(
    'trackAnalyticsEvent',
    (_, options: { event: AnalyticsEvent; properties?: Record<string, unknown> }): void => {
      trackAnalyticsEvent(options.event, options.properties);
    },
  );
  ipcMainOn('trackPageView', (_, options: { name: string }): void => {
    trackPageView(options.name);
  });
  ipcMainOn('analytics.setOrganizationId', (_, organizationId: string | undefined): void => {
    setCurrentOrganizationId(organizationId);
  });

  ipcMainHandle('installPlugin', (_, lookupName: string, allowScopedPackageNames = false) => {
    return installPlugin(lookupName, allowScopedPackageNames);
  });

  ipcMainOn('restart', () => {
    app.relaunch();
    app.exit();
  });

  ipcMainOn('openInBrowser', async (_, href: string) => {
    return openInBrowser(href);
  });

  ipcMainHandle('extractJsonFileFromPostmanDataDumpArchive', extractPostmanDataDumpHandler);
  ipcMainHandle('syncNewWorkspaceIfNeeded', async (_, options: Parameters<typeof syncNewWorkspaceIfNeeded>[0]) => {
    return syncNewWorkspaceIfNeeded(options);
  });

  ipcMainHandle('getLocalStorageDataFromFileOrigin', async () => {
    const tmpDir = app.getPath('userData');
    const tmpHTMLFile = path.join(tmpDir, 'file.html');
    // Create a temporary HTML file to load the file:// origin
    await fs.promises.writeFile(tmpHTMLFile, '<html><body></body></html>', { encoding: 'utf8' });

    // Create a hidden BrowserWindow to load the file:// origin
    // This is necessary to access the localStorage of the file:// origin
    // and retrieve the data.
    const fileOriginWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });

    fileOriginWindow.loadURL(`file:${tmpHTMLFile}`);

    return new Promise<Record<string, any>>((resolve, reject) => {
      fileOriginWindow.webContents.on('did-finish-load', async () => {
        const localStorageData = await fileOriginWindow.webContents.executeJavaScript(
          'JSON.stringify(localStorage)',
          true,
        );

        // Clear the localStorage of the file:// origin
        await fileOriginWindow.webContents.executeJavaScript('localStorage.clear();', true);
        // Close the hidden window after retrieving localStorage data
        fileOriginWindow.close();
        // Clean up the temporary file
        fs.unlinkSync(tmpHTMLFile);
        resolve(JSON.parse(localStorageData));
      });
      fileOriginWindow.webContents.on('did-fail-load', () => {
        // Close the hidden window and clean up the temporary file on failure
        fileOriginWindow.close();
        tmpHTMLFile && fs.unlinkSync(tmpHTMLFile);
        reject(new Error('Failed to load file:// origin to get localStorage data'));
      });
    });
  });

  ipcMainHandle(
    'generateMockRouteDataFromSpec',
    async (
      _,
      openApiSpec: string | undefined,
      specUrl: string | undefined,
      specText: string | undefined,
      modelConfig: any,
      useDynamicMockResponses: boolean,
      mockServerAdditionalFiles: string[],
    ) => {
      const settings = await services.settings.getOrCreate();

      for (const filePath of mockServerAdditionalFiles) {
        const { isAllowed, securedPath } = isPathAllowed(filePath, settings.dataFolders);
        if (!isAllowed) {
          return { error: cannotAccessPathError(securedPath), routes: [] };
        }
      }

      return new Promise((resolve, reject) => {
        const process = utilityProcess.fork(path.join(__dirname, 'main/mock-generation-process.mjs'));

        process.on('exit', code => {
          console.log('[mock-generation-process] exited with code:', code);
          let errorMessage: string;

          const signals = os.constants.signals;
          if (code === 0) {
            errorMessage = 'Mock generation process exited with code 0.';
          } else if (code === signals.SIGSEGV) {
            errorMessage = `Mock generation process crashed with a segmentation fault (SIGSEGV). This may be due to system compatibility when running a GGUF model.`;
          } else if (code === signals.SIGKILL) {
            errorMessage = `Mock generation process was killed (SIGKILL). This may be due to memory limits or system resources.`;
          } else if (code === signals.SIGTERM) {
            errorMessage = `Mock generation process was terminated (SIGTERM).`;
          } else if (code === signals.SIGABRT) {
            errorMessage = `Mock generation process aborted (SIGABRT). This usually indicates an internal error.`;
          } else {
            errorMessage = `Mock generation process exited unexpectedly with code ${code}.`;
          }

          resolve({ error: errorMessage, routes: [] });
        });

        process.on('message', msg => {
          console.log('[mock-generation-process] received message');
          resolve(msg);
          process.kill();
        });

        process.on('error', err => {
          console.error('[mock-generation-process] error:', err);
          reject({ error: err.toString() });
        });

        process.postMessage({
          openApiSpec,
          specUrl,
          specText,
          modelConfig,
          useDynamicMockResponses,
          mockServerAdditionalFiles,
          aiPluginName: AI_PLUGIN_NAME,
        });
      });
    },
  );

  ipcMainHandle('generateCommitsFromDiff', async (_, input) => {
    return new Promise(async (resolve, reject) => {
      const modelConfig = (await getCurrentConfig()) as ModelConfig | null;
      if (!modelConfig) {
        reject(new Error('No LLM model configured'));
      }
      const process = utilityProcess.fork(path.join(__dirname, 'main/git-commit-generation-process.mjs'));

      process.on('exit', code => {
        console.log('[git-commit-generation-process] exited with code:', code);
        let errorMessage: string;

        const signals = os.constants.signals;
        if (code === 0) {
          errorMessage = 'Git commit generation process exited with code 0.';
        } else if (code === signals.SIGSEGV) {
          errorMessage = `Git commit generation process crashed with a segmentation fault (SIGSEGV). This may be due to system compatibility when running a GGUF model.`;
        } else if (code === signals.SIGKILL) {
          errorMessage = `Git commit generation process was killed (SIGKILL). This may be due to memory limits or system resources.`;
        } else if (code === signals.SIGTERM) {
          errorMessage = `Git commit generation process was terminated (SIGTERM).`;
        } else if (code === signals.SIGABRT) {
          errorMessage = `Git commit generation process aborted (SIGABRT). This usually indicates an internal error.`;
        } else {
          errorMessage = `Git commit generation process exited unexpectedly with code ${code}.`;
        }

        resolve({ error: errorMessage });
      });

      process.on('message', msg => {
        console.log('[git-commit-generation-process] received message');
        resolve(msg);
        process.kill();
      });

      process.on('error', err => {
        console.error('[git-commit-generation-process] error:', err);
        reject({ error: err.toString() });
      });

      process.postMessage({
        input,
        modelConfig,
        aiPluginName: AI_PLUGIN_NAME,
      });
    });
  });

  ipcMainHandle('generateMcpSamplingResponse', async (_, input: Parameters<GenerateMcpSamplingResponseFunction>[0]) => {
    return new Promise(async (resolve, reject) => {
      const modelConfig = (await getCurrentConfig()) as ModelConfig | null;
      if (!modelConfig) {
        reject(new Error('No LLM model configured'));
      }
      const process = utilityProcess.fork(path.join(__dirname, 'main/mcp-generate-sampling-response.mjs'));

      process.on('exit', code => {
        console.log('[mcp-generate-sampling-response-process] exited with code:', code);
        let errorMessage: string;

        const signals = os.constants.signals;
        if (code === 0) {
          errorMessage = 'MCP sampling response generation process exited with code 0.';
        } else if (code === signals.SIGSEGV) {
          errorMessage = `MCP sampling response generation process crashed with a segmentation fault (SIGSEGV). This may be due to system compatibility when running a GGUF model.`;
        } else if (code === signals.SIGKILL) {
          errorMessage = `MCP sampling response generation process was killed (SIGKILL). This may be due to memory limits or system resources.`;
        } else if (code === signals.SIGTERM) {
          errorMessage = `MCP sampling response generation process was terminated (SIGTERM).`;
        } else if (code === signals.SIGABRT) {
          errorMessage = `MCP sampling response generation process aborted (SIGABRT). This usually indicates an internal error.`;
        } else {
          errorMessage = `MCP sampling response generation process exited unexpectedly with code ${code}.`;
        }

        resolve({ error: errorMessage });
      });

      process.on('message', msg => {
        console.log('[mcp-generate-sampling-response-process] received message');
        resolve({
          response: {
            content: msg,
            modelConfig,
          },
        });
        process.kill();
      });

      process.on('error', err => {
        console.error('[mcp-generate-sampling-response-process] error:', err);
        reject({ error: err.toString() });
      });
      const { systemPrompt, messages, modelConfig: modelConfigFromSamplingRequest } = input;
      const mergedModelConfig = !modelConfig
        ? modelConfigFromSamplingRequest
        : {
            ...modelConfig,
            ...modelConfigFromSamplingRequest,
          };

      process.postMessage({
        messages,
        systemPrompt,
        modelConfig: mergedModelConfig,
        aiPluginName: AI_PLUGIN_NAME,
      });
    });
  });

  ipcMainHandle('timeline.getPath', getTimelinePath);
  ipcMainHandle('timeline.appendToFile', appendToTimeline);

  ipcMainHandle('vault.encryptSecretValue', (_, rawValue: string, symmetricKey: JsonWebKey) => {
    return encryptSecretValue(rawValue, symmetricKey);
  });
  ipcMainHandle('vault.decryptSecretValue', (_, encryptedValue: string, symmetricKey: JsonWebKey) => {
    return decryptSecretValue(encryptedValue, symmetricKey);
  });

  ipcMainHandle('crypt.encryptRSAWithJWK', (_, publicKeyJWK: JsonWebKey, plaintext: string) => {
    return crypt.encryptRSAWithJWK(publicKeyJWK, plaintext);
  });
  ipcMainHandle('crypt.decryptRSAWithJWK', (_, privateJWK: JsonWebKey, encryptedBlob: string) => {
    return crypt.decryptRSAWithJWK(privateJWK, encryptedBlob);
  });
  ipcMainHandle(
    'crypt.encryptAESBuffer',
    (_, jwkOrKey: string | JsonWebKey, buff: number[], additionalData?: string) => {
      return crypt.encryptAESBuffer(jwkOrKey, Buffer.from(buff), additionalData);
    },
  );
  ipcMainHandle('crypt.encryptAES', (_, jwkOrKey: string | JsonWebKey, plaintext: string, additionalData?: string) => {
    return crypt.encryptAES(jwkOrKey, plaintext, additionalData);
  });
  ipcMainHandle('crypt.decryptAES', (_, jwkOrKey: string | JsonWebKey, encryptedResult: crypt.AESMessage) => {
    return crypt.decryptAES(jwkOrKey, encryptedResult);
  });
  ipcMainHandle('crypt.decryptAESToBuffer', (_, jwkOrKey: string | JsonWebKey, encryptedResult: crypt.AESMessage) => {
    return Array.from(crypt.decryptAESToBuffer(jwkOrKey, encryptedResult));
  });
  ipcMainHandle('crypt.generateAES256Key', _ => {
    return crypt.generateAES256Key();
  });

  ipcMainHandle('sealedbox.keyPair', _ => {
    return sealedboxKeyPair();
  });
  ipcMainHandle('sealedbox.open', (_, sealedbox: Uint8Array, pk: Uint8Array, sk: Uint8Array) => {
    return sealedboxOpen(sealedbox, pk, sk);
  });

  ipcMainHandle('run-tests', async (_, src: string) => {
    const sendRequest = getSendRequestCallback();
    return runTests(src, { sendRequest });
  });

  registerPluginIpcHandlers();
}
