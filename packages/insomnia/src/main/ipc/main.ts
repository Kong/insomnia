import type { ISpectralDiagnostic } from '@stoplight/spectral-core';
import type { RulesetDefinition } from '@stoplight/spectral-core';
import { Spectral } from '@stoplight/spectral-core';
// @ts-expect-error - This is a bundled file not sure why it's not found
import { bundleAndLoadRuleset } from '@stoplight/spectral-ruleset-bundler/with-loader';
import { oas } from '@stoplight/spectral-rulesets';
import { app, BrowserWindow, ipcMain, IpcRendererEvent, shell } from 'electron';
import fs from 'fs';

import { SegmentEvent, trackPageView, trackSegmentEvent } from '../analytics';
import { authorizeUserInWindow } from '../authorizeUserInWindow';
import { backup, restoreBackup } from '../backup';
import { insomniaFetch } from '../insomniaFetch';
import installPlugin from '../install-plugin';
import { axiosRequest } from '../network/axios-request';
import { CurlBridgeAPI } from '../network/curl';
import { cancelCurlRequest, curlRequest } from '../network/libcurl-promise';
import { WebSocketBridgeAPI } from '../network/websocket';
import { gRPCBridgeAPI } from './grpc';

export interface MainBridgeAPI {
  loginStateChange: () => void;
  openInBrowser: (url: string) => void;
  restart: () => void;
  halfSecondAfterAppStart: () => void;
  manualUpdateCheck: () => void;
  backup: () => Promise<void>;
  restoreBackup: (version: string) => Promise<void>;
  spectralRun: (options: { contents: string; rulesetPath: string }) => Promise<ISpectralDiagnostic[]>;
  authorizeUserInWindow: typeof authorizeUserInWindow;
  setMenuBarVisibility: (visible: boolean) => void;
  installPlugin: typeof installPlugin;
  writeFile: (options: { path: string; content: string }) => Promise<string>;
  cancelCurlRequest: typeof cancelCurlRequest;
  curlRequest: typeof curlRequest;
  on: (channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void) => () => void;
  webSocket: WebSocketBridgeAPI;
  grpc: gRPCBridgeAPI;
  curl: CurlBridgeAPI;
  trackSegmentEvent: (options: { event: string; properties?: Record<string, unknown> }) => void;
  trackPageView: (options: { name: string }) => void;
  axiosRequest: typeof axiosRequest;
  insomniaFetch: typeof insomniaFetch;
  showContextMenu: (options: { key: string }) => void;
}
export function registerMainHandlers() {
  ipcMain.handle('insomniaFetch', async (_, options: Parameters<typeof insomniaFetch>[0]) => {
    return insomniaFetch(options);
  });
  ipcMain.handle('axiosRequest', async (_, options: Parameters<typeof axiosRequest>[0]) => {
    return axiosRequest(options);
  });
  ipcMain.on('loginStateChange', async () => {
    BrowserWindow.getAllWindows().forEach(w => {
      w.webContents.send('loggedIn');
    });
  });
  ipcMain.handle('backup', async () => {
    return backup();
  });
  ipcMain.handle('restoreBackup', async (_, options: string) => {
    return restoreBackup(options);
  });
  ipcMain.handle('authorizeUserInWindow', (_, options: Parameters<typeof authorizeUserInWindow>[0]) => {
    const { url, urlSuccessRegex, urlFailureRegex, sessionId } = options;
    return authorizeUserInWindow({ url, urlSuccessRegex, urlFailureRegex, sessionId });
  });

  ipcMain.handle('writeFile', async (_, options: { path: string; content: string }) => {
    try {
      await fs.promises.writeFile(options.path, options.content);
      return options.path;
    } catch (err) {
      throw new Error(err);
    }
  });

  ipcMain.handle('curlRequest', (_, options: Parameters<typeof curlRequest>[0]) => {
    return curlRequest(options);
  });

  ipcMain.on('cancelCurlRequest', (_, requestId: string): void => {
    cancelCurlRequest(requestId);
  });

  ipcMain.on('trackSegmentEvent', (_, options: { event: SegmentEvent; properties?: Record<string, unknown> }): void => {
    trackSegmentEvent(options.event, options.properties);
  });
  ipcMain.on('trackPageView', (_, options: { name: string }): void => {
    trackPageView(options.name);
  });

  ipcMain.handle('installPlugin', (_, lookupName: string) => {
    return installPlugin(lookupName);
  });

  ipcMain.on('restart', () => {
    app.relaunch();
    app.exit();
  });

  ipcMain.on('openInBrowser', (_, href: string) => {
    const { protocol } = new URL(href);
    if (protocol === 'http:' || protocol === 'https:') {
      // eslint-disable-next-line no-restricted-properties
      shell.openExternal(href);
    }
  });

  ipcMain.handle('spectralRun', async (_, { contents, rulesetPath }: {
    contents: string;
    rulesetPath?: string;
  }) => {
    const spectral = new Spectral();

    if (rulesetPath) {
      try {
        const ruleset = await bundleAndLoadRuleset(rulesetPath, {
          fs,
          fetch: (url: string) => {
            return axiosRequest({ url, method: 'GET' });
          },
        });

        spectral.setRuleset(ruleset);
      } catch (err) {
        console.log('Error while parsing ruleset:', err);
        spectral.setRuleset(oas as RulesetDefinition);
      }
    } else {
      spectral.setRuleset(oas as RulesetDefinition);
    }

    const diagnostics = await spectral.run(contents);

    return diagnostics;
  });
}
