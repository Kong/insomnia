import { readFileSync } from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

// `plugin-window.ts`'s IPC dispatchers (`plugins.applyRequestHooks` and siblings) used to
// accept a request from any sender (H1-HOOK-SANDBOX-SECURITY-REVIEW.md, finding 1). The fix
// routes every `ipcMain.handle`/`.on` registration through one of three sender-checked
// wrappers (`handleFromMainWindow`, `onFromPluginWindow`, `handleFromPluginWindow`). Two
// guardrails enforce this: a static source check that no bare `ipcMain` call exists outside
// those wrappers, and a dynamic check that iterates every channel actually registered at
// runtime (not a hardcoded name list), so a future channel is covered automatically.

const registeredHandlers = new Map<string, (...args: any[]) => any>();
const registeredListeners = new Map<string, (...args: any[]) => any>();

const fakePluginWebContents = {
  send: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
  off: vi.fn(),
};

const fakePluginWindow = {
  isDestroyed: () => false,
  webContents: fakePluginWebContents,
  on: vi.fn(),
  loadFile: vi.fn(),
};

const fakeMainWebContents = { send: vi.fn() };
const fakeMainWindow = { webContents: fakeMainWebContents };

// A sender that is neither the real plugin window nor the real main window.
const forgedSender = { id: 'forged-sender' };

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/fake/userData') },
  BrowserWindow: vi.fn(() => fakePluginWindow),
  ipcMain: {
    handle: vi.fn((channel: string, fn: (...args: any[]) => any) => registeredHandlers.set(channel, fn)),
    on: vi.fn((channel: string, fn: (...args: any[]) => any) => registeredListeners.set(channel, fn)),
  },
}));

vi.mock('../window-utils', () => ({
  getMainWindow: vi.fn(() => fakeMainWindow),
}));

vi.mock('../prompt-bridge', () => ({
  requestPromptFromRenderer: vi.fn(),
}));

describe('plugin-window.ts IPC dispatch: sender authorization', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    registeredHandlers.clear();
    registeredListeners.clear();
    fakePluginWebContents.send.mockClear();
    fakeMainWebContents.send.mockClear();
  });

  // Fails the build if a channel is ever registered outside the three wrapper bodies.
  it('every ipcMain.handle/.on call is confined to the three sender-checked wrappers', () => {
    const source = readFileSync(path.join(__dirname, '..', 'plugin-window.ts'), 'utf8');

    const wrapperNames = ['handleFromMainWindow', 'onFromPluginWindow', 'handleFromPluginWindow'];
    let withoutWrapperBodies = source;
    for (const name of wrapperNames) {
      const start = source.indexOf(`function ${name}`);
      expect(start, `expected to find the ${name} wrapper definition`).toBeGreaterThan(-1);
      // Matches the closing brace by depth rather than a fixed line count.
      let depth = 0;
      let end = -1;
      for (let i = source.indexOf('{', start); i < source.length; i++) {
        if (source[i] === '{') depth++;
        if (source[i] === '}') {
          depth--;
          if (depth === 0) {
            end = i + 1;
            break;
          }
        }
      }
      expect(end, `expected to find the end of the ${name} wrapper body`).toBeGreaterThan(start);
      withoutWrapperBodies = withoutWrapperBodies.replace(source.slice(start, end), '');
    }

    expect(withoutWrapperBodies).not.toMatch(/\bipcMain\.handle\(/);
    expect(withoutWrapperBodies).not.toMatch(/\bipcMain\.on\(/);
  });

  // Reads the live registration map, not a hardcoded channel list.
  it('every channel registered by registerPluginIpcHandlers() rejects a forged sender', async () => {
    const { registerPluginIpcHandlers } = await import('../plugin-window');
    registerPluginIpcHandlers();

    expect(registeredHandlers.size).toBeGreaterThan(0);
    for (const [channel, handler] of registeredHandlers) {
      expect(
        () => handler({ sender: forgedSender }, {}),
        `expected plugins channel "${channel}" to reject a forged sender`,
      ).toThrow(/sender is not the main app window/);
    }
  });

  it('every channel registered by registerPluginIpcHandlers() accepts the real main window', async () => {
    const { registerPluginIpcHandlers } = await import('../plugin-window');
    registerPluginIpcHandlers();

    for (const [channel, handler] of registeredHandlers) {
      expect(
        () => handler({ sender: fakeMainWebContents }, {}),
        `expected plugins channel "${channel}" to accept the real main window sender`,
      ).not.toThrow();
    }
  });

  // Regression check for finding 1: a forged sender is rejected before it ever reaches the plugin window.
  it('plugins.applyRequestHooks rejects a forged sender', async () => {
    const { registerPluginIpcHandlers } = await import('../plugin-window');
    registerPluginIpcHandlers();

    const applyRequestHooksHandler = registeredHandlers.get('plugins.applyRequestHooks');
    expect(applyRequestHooksHandler).toBeTypeOf('function');

    const forgedArgs = {
      renderedRequest: { _id: 'req_forged', url: 'https://example.com/resource', headers: [] },
      projectId: 'proj_not_mine',
      environment: { BASE_URL: 'https://example.com' },
    };

    expect(() => applyRequestHooksHandler!({ sender: forgedSender }, forgedArgs)).toThrow(
      /sender is not the main app window/,
    );
    expect(fakePluginWebContents.send).not.toHaveBeenCalled();
  });

  // The reverse-direction (plugin-window -> host) callbacks enforce sender checks too.
  it('plugins.uiAlert still ignores a forged sender', async () => {
    const { registerPluginIpcHandlers, createPluginWindow } = await import('../plugin-window');
    registerPluginIpcHandlers();
    createPluginWindow();

    const uiAlertListener = registeredListeners.get('plugins.uiAlert');
    expect(uiAlertListener).toBeTypeOf('function');

    uiAlertListener!({ sender: forgedSender }, { message: 'hi' });

    expect(fakeMainWebContents.send).not.toHaveBeenCalled();
  });

  // Sanity check the fix doesn't break the legitimate dispatch path.
  it('a legitimate main-window call to plugins.applyRequestHooks still dispatches to the plugin window', async () => {
    const { registerPluginIpcHandlers } = await import('../plugin-window');
    registerPluginIpcHandlers();

    const applyRequestHooksHandler = registeredHandlers.get('plugins.applyRequestHooks')!;
    const legitimateArgs = {
      renderedRequest: { _id: 'req_1', url: 'https://example.com', headers: [] },
      projectId: 'proj_1',
      environment: {},
    };

    const invokePromise = applyRequestHooksHandler({ sender: fakeMainWebContents }, legitimateArgs);

    await vi.advanceTimersByTimeAsync(0);
    const windowReadyListener = registeredListeners.get('plugins.windowReady');
    windowReadyListener!({ sender: fakePluginWebContents });
    await vi.advanceTimersByTimeAsync(100);

    expect(fakePluginWebContents.send).toHaveBeenCalledWith(
      'plugins.invoke',
      expect.objectContaining({ method: 'applyRequestHooks', args: legitimateArgs }),
    );

    const [, { id }] = fakePluginWebContents.send.mock.calls[0];
    const invokeResultListener = registeredListeners.get('plugins.invokeResult');
    invokeResultListener!({ sender: fakePluginWebContents }, { id, result: {} });
    await expect(invokePromise).resolves.toEqual({});
  });
});
