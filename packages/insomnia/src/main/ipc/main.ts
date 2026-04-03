import fs, { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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
import iconv from 'iconv-lite';

import { AI_PLUGIN_NAME } from '~/common/constants';
import { type Services, services } from '~/insomnia-data';
import { convert } from '~/main/importers/convert';
import { getCurrentConfig, type LLMConfigServiceAPI } from '~/main/llm-config-service';
import { multipartBufferToArray, type Part } from '~/main/multipart-buffer-to-array';
import { insecureReadFile, insecureReadFileWithEncoding, secureReadFile } from '~/main/secure-read-file';
import type {
  GenerateCommitsFromDiffFunction,
  GenerateMcpSamplingResponseFunction,
  MockRouteData,
  ModelConfig,
} from '~/plugins/types';

import type { HiddenBrowserWindowBridgeAPI } from '../../entry.hidden-window';
import type { PluginTemplateTag } from '../../templating/types';
import type { SegmentEvent } from '../analytics';
import { setCurrentOrganizationId, trackPageView, trackSegmentEvent } from '../analytics';
import {
  authorizeUserInDefaultBrowser,
  cancelAuthorizationInDefaultBrowser,
  onDefaultBrowserOAuthRedirect,
} from '../authorize-user-in-default-browser';
import { authorizeUserInWindow } from '../authorize-user-in-window';
import { backup, restoreBackup } from '../backup';
import type { GitServiceAPI } from '../git-service';
import installPlugin from '../install-plugin';
import type { CurlBridgeAPI } from '../network/curl';
import { cancelCurlRequest, curlRequest } from '../network/libcurl-promise';
import type { McpBridgeAPI } from '../network/mcp';
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
import { ipcMainHandle, ipcMainOn, type RendererOnChannels } from './electron';
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

export interface RendererToMainBridgeAPI {
  loginStateChange: () => void;
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
  parseImport: typeof convert;
  multipartBufferToArray: (options: { bodyBuffer: Buffer; contentType: string }) => Promise<Part[]>;
  writeFile: (options: { path: string; content: string | Buffer }) => Promise<string>;
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
  webSocket: WebSocketBridgeAPI;
  socketIO: SocketIOBridgeAPI;
  mcp: McpBridgeAPI;
  grpc: gRPCBridgeAPI;
  curl: CurlBridgeAPI;
  git: GitServiceAPI;
  llm: LLMConfigServiceAPI;
  secretStorage: secretStorageBridgeAPI;
  trackSegmentEvent: (options: { event: string; properties?: Record<string, unknown> }) => void;
  trackPageView: (options: { name: string }) => void;
  setCurrentOrganizationId: (organizationId: string | undefined) => void;
  showNunjucksContextMenu: (options: {
    key: string;
    nunjucksTag?: { template: string; range: MarkerRange };
    pluginTemplateTags?: { templateTag: PluginTemplateTag }[];
  }) => void;
  showContextMenu: (options: {
    key: string;
    menuItems: MenuItemConstructorOptions[];
    extra?: Record<string, any>;
  }) => void;
  lintSpec: (options: {
    documentContent: string;
    rulesetPath: string;
  }) => Promise<{ diagnostics?: ISpectralDiagnostic[]; error?: string; cancelled?: boolean }>;
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
  ipcMainHandle('services.invoke', async (_, serviceName: string, methodName: string, ...args: unknown[]) => {
    const service = services[serviceName as keyof Services];
    if (!service) {
      throw new TypeError(`Unknown service: ${serviceName}`);
    }
    const fn = service[methodName as keyof typeof service];
    if (typeof fn !== 'function') {
      throw new TypeError(`Unknown service method: ${serviceName}.${methodName}`);
    }
    return (fn as (...args: unknown[]) => unknown).call(service, ...args);
  });
  ipcMainHandle('multipartBufferToArray', async (_, options) => {
    return multipartBufferToArray(options);
  });
  ipcMainOn('loginStateChange', async () => {
    BrowserWindow.getAllWindows().forEach(w => {
      w.webContents.send('loggedIn');
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

  ipcMainHandle('lintSpec', async (_, options: { documentContent: string; rulesetPath: string }) => {
    const { documentContent, rulesetPath } = options;
    return new Promise((resolve, reject) => {
      // Use a filescoped variable to store and terminate the last open
      // This ensures we use a last in first out type of process management
      // We only care about the most recent lint request
      if (lintProcess) {
        lintProcess.kill();
      }

      lintProcess = utilityProcess.fork(path.join(__dirname, 'main/lint-process.mjs'));

      let process: UtilityProcess | null = lintProcess!;

      process.on('exit', code => {
        console.log('[lint-process] exited with code:', code);
        resolve({ cancelled: true });
      });

      process.on('message', msg => {
        resolve(msg);
        process?.kill();
        process = null;
      });

      process.on('error', err => {
        console.error('[lint-process] error:', err);
        reject({ error: err.toString() });
      });

      process.postMessage({ documentContent, rulesetPath });
    });
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
    const dataPath = app.getPath('userData');
    const folderPath = path.join(dataPath, options.folder);
    mkdirSync(folderPath, { recursive: true });
    return readDir(_, { path: folderPath });
  });

  ipcMainHandle('curlRequest', (_, options: Parameters<typeof curlRequest>[0]) => {
    return curlRequest(options);
  });

  ipcMainOn('cancelCurlRequest', (_, requestId: string): void => {
    cancelCurlRequest(requestId);
  });

  ipcMainOn('trackSegmentEvent', (_, options: { event: SegmentEvent; properties?: Record<string, unknown> }): void => {
    trackSegmentEvent(options.event, options.properties);
  });
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

      process.postMessage({
        messages,
        systemPrompt,
        modelConfig: {
          ...modelConfig,
          ...modelConfigFromSamplingRequest,
        },
        aiPluginName: AI_PLUGIN_NAME,
      });
    });
  });
}
