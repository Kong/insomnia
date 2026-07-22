import { readFileSync } from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

// PR #10279 (H1) makes user-plugin request hooks capability-gated *inside* the QuickJS
// sandbox, but the sandbox is only ever reached via IPC dispatchers in `plugin-window.ts`
// (`plugins.applyRequestHooks` and its siblings). Those dispatchers used to accept a request
// from *any* sender — no capability gating inside the sandbox matters if the dispatch that
// reaches it never checks who's asking, with what data. See
// `templating/sandbox/H1-HOOK-SANDBOX-SECURITY-REVIEW.md`, finding 1.
//
// The fix routes every `ipcMain.handle`/`ipcMain.on` registration in `plugin-window.ts`
// through one of three sender-checked wrapper functions (`handleFromMainWindow`,
// `onFromPluginWindow`, `handleFromPluginWindow`). This file has two guardrails, not one:
//
//   1. A STATIC test that the source of `plugin-window.ts` contains no bare `ipcMain.handle(`/
//      `ipcMain.on(` call outside those three wrapper bodies — so a future engineer literally
//      cannot add a new unauthenticated channel to this file without the wrapper (protected
//      automatically) or the build failing (bypassed the wrapper).
//   2. A DYNAMIC/behavioral test that iterates over every channel *actually registered* by
//      `registerPluginIpcHandlers()` at runtime — not a hardcoded list of channel names — and
//      proves each one rejects a forged sender. Because the loop reads the live registration
//      map, a newly added `plugins.*` channel is exercised automatically the next time this
//      suite runs, with no per-channel test to remember to add.
//
// Do not "fix" a failing test here by loosening an assertion or adding a name to an allowlist
// without a one-line justification — that defeats the point of both guardrails.

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

// A sender that is neither the real plugin window nor the real main window — the forged
// caller identity an attacker (or an unrelated compromised/renderer context) would present.
const forgedSender = { id: 'attacker-controlled-webcontents' };

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

  it('[static guardrail] every ipcMain.handle/.on call is confined to the three sender-checked wrappers', () => {
    const source = readFileSync(path.join(__dirname, '..', 'plugin-window.ts'), 'utf8');

    // Isolate the three wrapper *definitions* (the only place a raw `ipcMain.` call may
    // appear) from the rest of the file.
    const wrapperNames = ['handleFromMainWindow', 'onFromPluginWindow', 'handleFromPluginWindow'];
    let withoutWrapperBodies = source;
    for (const name of wrapperNames) {
      const start = source.indexOf(`function ${name}`);
      expect(start, `expected to find the ${name} wrapper definition`).toBeGreaterThan(-1);
      // Each wrapper is a small, single-purpose function; its closing brace is the first
      // top-level "}\n" after the opening one. Locating the matching brace by depth avoids
      // assuming a fixed line count that would silently stop covering the real body if the
      // wrapper grows.
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

  it('[dynamic] every channel registered by registerPluginIpcHandlers() rejects a forged sender', async () => {
    const { registerPluginIpcHandlers } = await import('../plugin-window');
    registerPluginIpcHandlers();

    // Read whatever is *actually* registered at runtime, not a hardcoded name list — a new
    // `plugins.*` channel added to `registerPluginIpcHandlers()` in the future is covered by
    // this loop automatically.
    expect(registeredHandlers.size).toBeGreaterThan(0);
    for (const [channel, handler] of registeredHandlers) {
      expect(
        () => handler({ sender: forgedSender }, {}),
        `expected plugins channel "${channel}" to reject a forged sender`,
      ).toThrow(/sender is not the main app window/);
    }
  });

  it('[dynamic] every channel registered by registerPluginIpcHandlers() accepts the real main window', async () => {
    const { registerPluginIpcHandlers } = await import('../plugin-window');
    registerPluginIpcHandlers();

    for (const [channel, handler] of registeredHandlers) {
      expect(
        () => handler({ sender: fakeMainWebContents }, {}),
        `expected plugins channel "${channel}" to accept the real main window sender`,
      ).not.toThrow();
    }
  });

  it('demonstrates the original vulnerability is fixed: plugins.applyRequestHooks now rejects a forged sender carrying attacker data', async () => {
    const { registerPluginIpcHandlers } = await import('../plugin-window');
    registerPluginIpcHandlers();

    const applyRequestHooksHandler = registeredHandlers.get('plugins.applyRequestHooks');
    expect(applyRequestHooksHandler).toBeTypeOf('function');

    const forgedArgs = {
      renderedRequest: { _id: 'req_forged', url: 'https://internal.example/secret', headers: [] },
      projectId: 'proj_not_mine',
      environment: { BASE_URL: 'https://attacker.example' },
    };

    expect(() => applyRequestHooksHandler!({ sender: forgedSender }, forgedArgs)).toThrow(
      /sender is not the main app window/,
    );
    // The forged payload never reached the plugin window at all.
    expect(fakePluginWebContents.send).not.toHaveBeenCalled();
  });

  it('plugins.uiAlert (a plugin-window -> host callback) still ignores a forged sender', async () => {
    const { registerPluginIpcHandlers, createPluginWindow } = await import('../plugin-window');
    registerPluginIpcHandlers();
    // `ensureIpcListeners()` (which registers `plugins.uiAlert`) only runs inside
    // `createPluginWindow()`.
    createPluginWindow();

    const uiAlertListener = registeredListeners.get('plugins.uiAlert');
    expect(uiAlertListener).toBeTypeOf('function');

    uiAlertListener!({ sender: forgedSender }, { message: 'hi' });

    expect(fakeMainWebContents.send).not.toHaveBeenCalled();
  });

  it('end-to-end: a legitimate main-window call to plugins.applyRequestHooks still dispatches to the plugin window', async () => {
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
