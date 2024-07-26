import * as Sentry from '@sentry/electron/main';
import { app, BrowserWindow, type IpcRendererEvent, shell } from 'electron';
import fs from 'fs';

import { APP_START_TIME, LandingPage, SentryMetrics } from '../../common/sentry';
import type { HiddenBrowserWindowBridgeAPI } from '../../hidden-window';
import * as models from '../../models';
import { SegmentEvent, trackPageView, trackSegmentEvent } from '../analytics';
import { authorizeUserInWindow } from '../authorizeUserInWindow';
import { backup, restoreBackup } from '../backup';
import installPlugin from '../install-plugin';
import type { CurlBridgeAPI } from '../network/curl';
import { cancelCurlRequest, curlRequest } from '../network/libcurl-promise';
import { addExecutionStep, completeExecutionStep, getExecution, startExecution, type StepName, type TimingStep } from '../network/request-timing';
import type { WebSocketBridgeAPI } from '../network/websocket';
import { ipcMainHandle, ipcMainOn, ipcMainOnce, type RendererOnChannels } from './electron';
import type { gRPCBridgeAPI } from './grpc';

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
  setMenuBarVisibility: (visible: boolean) => void;
  installPlugin: typeof installPlugin;
  writeFile: (options: { path: string; content: string }) => Promise<string>;
  cancelCurlRequest: typeof cancelCurlRequest;
  curlRequest: typeof curlRequest;
  on: (channel: RendererOnChannels, listener: (event: IpcRendererEvent, ...args: any[]) => void) => () => void;
  webSocket: WebSocketBridgeAPI;
  grpc: gRPCBridgeAPI;
  curl: CurlBridgeAPI;
  trackSegmentEvent: (options: { event: string; properties?: Record<string, unknown> }) => void;
  trackPageView: (options: { name: string }) => void;
  showContextMenu: (options: { key: string }) => void;
  database: {
    caCertificate: {
      create: (options: { parentId: string; path: string }) => Promise<string>;
    };
  };
  hiddenBrowserWindow: HiddenBrowserWindowBridgeAPI;
  getExecution: (options: { requestId: string }) => Promise<TimingStep[]>;
  addExecutionStep: (options: { requestId: string; stepName: StepName }) => void;
  startExecution: (options: { requestId: string }) => void;
  completeExecutionStep: (options: { requestId: string }) => void;
  landingPageRendered: (landingPage: LandingPage, tags?: Record<string, string>) => void;
}
export function registerMainHandlers() {
  ipcMainOn('addExecutionStep', (_, options: { requestId: string; stepName: StepName }) => {
    addExecutionStep(options.requestId, options.stepName);
  });
  ipcMainOn('startExecution', (_, options: { requestId: string }) => {
    return startExecution(options.requestId);
  });
  ipcMainOn('completeExecutionStep', (_, options: { requestId: string }) => {
    return completeExecutionStep(options.requestId);
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

  ipcMainHandle('writeFile', async (_, options: { path: string; content: string }) => {
    try {
      await fs.promises.writeFile(options.path, options.content);
      return options.path;
    } catch (err) {
      throw new Error(err);
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

  ipcMainHandle('installPlugin', (_, lookupName: string) => {
    return installPlugin(lookupName);
  });

  ipcMainOn('restart', () => {
    app.relaunch();
    app.exit();
  });

  ipcMainOn('openInBrowser', (_, href: string) => {
    const { protocol } = new URL(href);
    if (protocol === 'http:' || protocol === 'https:') {
      // eslint-disable-next-line no-restricted-properties
      shell.openExternal(href);
    }
  });

  ipcMainOnce('landingPageRendered', (_, { landingPage, tags = {} }: { landingPage: LandingPage; tags?: Record<string, string> }) => {
    const duration = performance.now() - APP_START_TIME;
    Sentry.metrics.distribution(SentryMetrics.APP_START_DURATION, duration, {
      tags: {
        landingPage,
        ...tags,
      },
      unit: 'millisecond',
    });
  });
}
