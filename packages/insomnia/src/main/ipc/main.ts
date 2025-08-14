import fs from 'node:fs';
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

import type { HiddenBrowserWindowBridgeAPI } from '../../entry.hidden-window';
import * as models from '../../models';
import type { PluginTemplateTag } from '../../templating/types';
import type { SegmentEvent } from '../analytics';
import { trackPageView, trackSegmentEvent } from '../analytics';
import {
  authorizeUserInDefaultBrowser,
  cancelAuthorizationInDefaultBrowser,
  onDefaultBrowserOAuthRedirect,
} from '../authorizeUserInDefaultBrowser';
import { authorizeUserInWindow } from '../authorizeUserInWindow';
import { backup, restoreBackup } from '../backup';
import type { GitServiceAPI } from '../git-service';
import installPlugin from '../install-plugin';
import type { CurlBridgeAPI } from '../network/curl';
import { cancelCurlRequest, curlRequest } from '../network/libcurl-promise';
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
import extractPostmanDataDumpHandler from './extractPostmanDataDump';
import type { gRPCBridgeAPI } from './grpc';
import type { secretStorageBridgeAPI } from './secret-storage';

let lintProcess: Electron.UtilityProcess | null = null;

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
  writeFile: (options: { path: string; content: string }) => Promise<string>;
  readFile: (options: { path: string; encoding?: string }) => Promise<{ content: string; encoding: string }>;
  readDir: (options: { path: string }) => Promise<{ type: 'file' | 'directory'; name: string; path: string }[]>;
  cancelCurlRequest: typeof cancelCurlRequest;
  curlRequest: typeof curlRequest;
  on: (channel: RendererOnChannels, listener: (event: IpcRendererEvent, ...args: any[]) => void) => () => void;
  webSocket: WebSocketBridgeAPI;
  socketIO: SocketIOBridgeAPI;
  grpc: gRPCBridgeAPI;
  curl: CurlBridgeAPI;
  git: GitServiceAPI;
  secretStorage: secretStorageBridgeAPI;
  trackSegmentEvent: (options: { event: string; properties?: Record<string, unknown> }) => void;
  trackPageView: (options: { name: string }) => void;
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
    return models.caCertificate.create(options);
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

  ipcMainHandle('writeFile', async (_, options: { path: string; content: string }) => {
    try {
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

  ipcMainHandle('readFile', async (_, options: { path: string; encoding?: string }) => {
    const defaultEncoding = 'utf8';
    const contentBuffer = await fs.promises.readFile(options.path);
    const { encoding } = options;
    if (encoding) {
      if (iconv.encodingExists(encoding)) {
        const content = iconv.decode(contentBuffer, encoding);
        return { content, encoding };
      }
      throw new Error(`Unsupported encoding: ${encoding} to read file`);
    }
    // using chardet to detect encoding
    const detecedEncoding = chardet.detect(contentBuffer);
    if (detecedEncoding) {
      if (iconv.encodingExists(detecedEncoding)) {
        const content = iconv.decode(contentBuffer, detecedEncoding);
        return { content, encoding: detecedEncoding };
      }
      throw new Error(`Unsupported encoding: ${detecedEncoding} to read file`);
    }
    // failed to detect encoding, use default utf-8 as fallback
    return {
      content: iconv.decode(contentBuffer, defaultEncoding),
      encoding: defaultEncoding,
    };
  });

  ipcMainHandle('readDir', async (_, options: { path: string }) => {
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

  ipcMainHandle('installPlugin', (_, lookupName: string, allowScopedPackageNames = false) => {
    return installPlugin(lookupName, allowScopedPackageNames);
  });

  ipcMainOn('restart', () => {
    app.relaunch();
    app.exit();
  });

  ipcMainOn('openInBrowser', (_, href: string) => {
    const { protocol } = new URL(href);
    if (protocol === 'http:' || protocol === 'https:') {
      shell.openExternal(href);
    }
  });

  ipcMainHandle('extractJsonFileFromPostmanDataDumpArchive', extractPostmanDataDumpHandler);
}
