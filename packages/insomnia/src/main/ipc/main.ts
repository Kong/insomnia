import type { ISpectralDiagnostic } from '@stoplight/spectral-core';
import type { RulesetDefinition } from '@stoplight/spectral-core';
import { Spectral } from '@stoplight/spectral-core';
// @ts-expect-error - This is a bundled file not sure why it's not found
import { bundleAndLoadRuleset } from '@stoplight/spectral-ruleset-bundler/with-loader';
import { oas } from '@stoplight/spectral-rulesets';
import { app, ipcMain, IpcRendererEvent } from 'electron';
import fs from 'fs';

import { axiosRequest } from '../../network/axios-request';
import { authorizeUserInWindow } from '../../network/o-auth-2/misc';
import installPlugin from '../install-plugin';
import { cancelCurlRequest, curlRequest } from '../network/libcurl-promise';
import { WebSocketBridgeAPI } from '../network/websocket';
import { gRPCBridgeAPI } from './grpc';

export interface MainBridgeAPI {
  restart: () => void;
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
}
export function registerMainHandlers() {
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

  ipcMain.handle('installPlugin', (_, lookupName: string) => {
    return installPlugin(lookupName);
  });
  ipcMain.on('restart', () => {
    app.relaunch();
    app.exit();
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
