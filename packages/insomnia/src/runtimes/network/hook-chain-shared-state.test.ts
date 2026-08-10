// Regression coverage for whether one plugin's hook can observe or alter another plugin's data
// within the same request/response hook chain. `applyRequestHooks`/`applyResponseHooks` thread one
// shared `newRenderedRequest`/`newResponse` object through every plugin's hook in sequence, and a
// sandboxed hook's mutation is merged back onto it via a plain assignment
// (`mergeHookRequestMutation`/`Object.assign`) — the same shape of operation this codebase has
// already had to guard elsewhere, when the assignment target is a caller-controlled object with a
// planted property trap. Kept as a permanent guard: if a future context-API change ever hands a hook's code
// a live reference to the top-level `newRenderedRequest`/`newResponse` object (not just a nested
// field), this file should start failing rather than the gap going unnoticed.
//
// `plugins/context/request.ts` and `context/response.ts` are intentionally left real (unmocked) —
// they're exactly what's under test: whether their getters leak an object identity a hook could
// plant a trap on.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../plugins/context/app', () => ({ init: vi.fn().mockReturnValue({}) }));
vi.mock('../../plugins/context/data', () => ({ init: vi.fn().mockReturnValue({}) }));
vi.mock('../../plugins/context/network', () => ({ init: vi.fn().mockReturnValue({}) }));
vi.mock('../../plugins/context/store', () => ({ init: vi.fn().mockReturnValue({}) }));
vi.mock('insomnia-data', () => ({
  services: { settings: { get: vi.fn() } },
}));

const runRequestHookInSandbox = vi.fn();
const runResponseHookInSandbox = vi.fn();
vi.mock('../../main/templating-worker-database', () => ({
  runRequestHookInSandbox: (...args: unknown[]) => runRequestHookInSandbox(...args),
  runResponseHookInSandbox: (...args: unknown[]) => runResponseHookInSandbox(...args),
}));

import { services } from 'insomnia-data';

import { _testOnlySetPlugins } from '../../plugins/index';
import { applyRequestHooks, applyResponseHooks } from './network-adapter.node';

const makePlugin = (overrides: Record<string, any> = {}) => ({
  name: 'plugin',
  description: '',
  version: '1.0.0',
  directory: '/plugins/plugin',
  config: { disabled: false },
  permissions: { modules: [], capabilities: [] },
  permissionWarnings: [],
  permissionsDeclared: false,
  module: {},
  ...overrides,
});

const originalProcessType = process.type;

beforeEach(() => {
  (process as any).type = 'browser';
  (services.settings.get as any).mockResolvedValue({ pluginSandboxEnabled: true });
});

afterEach(() => {
  (process as any).type = originalProcessType;
  _testOnlySetPlugins(null);
  vi.clearAllMocks();
});

describe('per-hook context isolation', () => {
  it('does not let two different plugins share one context object by reference', async () => {
    // Both hooks must actually run in-process (not routed to the sandboxed-mock branch) so their
    // closures execute and the identity check below is meaningful.
    (services.settings.get as any).mockResolvedValue({ pluginSandboxEnabled: false });

    const seenByFirst: any[] = [];
    const seenBySecond: any[] = [];

    const firstHook = vi.fn(async (context: any) => {
      context.__probe = 'first';
      context.store.__probe = 'first-store';
      seenByFirst.push(context);
    });
    const secondHook = vi.fn(async (context: any) => {
      seenBySecond.push(context.__probe, context.store.__probe);
    });

    _testOnlySetPlugins([
      makePlugin({ name: 'first', directory: '/plugins/first', module: { requestHooks: [firstHook] } }),
      makePlugin({ name: 'second', directory: '/plugins/second', module: { requestHooks: [secondHook] } }),
    ]);

    const renderedRequest = { headers: [], body: {}, authentication: {} } as any;
    const renderedContext = { getProjectId: () => 'proj_x', DEFAULT_HEADERS: undefined };

    await applyRequestHooks(renderedRequest, renderedContext);

    expect(seenBySecond).toEqual([undefined, undefined]);
    expect(seenByFirst[0]).not.toBe(undefined);
  });
});

describe('request hook chain shared object (cross-trust-boundary)', () => {
  it('does not let an earlier, in-process hook trap a later sandboxed hook\'s merged mutation', async () => {
    const captured: Record<string, unknown> = {};
    let trappedBody: any;
    let trappedAuth: any;

    const earlierHook = vi.fn(async (context: any) => {
      trappedBody = context.request.getBody();
      Object.defineProperty(trappedBody, 'text', {
        set(v) {
          captured.bodyText = v;
        },
        configurable: true,
      });
      trappedAuth = context.request.getAuthentication();
      Object.defineProperty(trappedAuth, 'token', {
        set(v) {
          captured.authToken = v;
        },
        configurable: true,
      });
    });

    runRequestHookInSandbox.mockResolvedValue({
      body: { mimeType: 'text/plain', text: 'SANDBOXED-HOOK-BODY' },
      authentication: { type: 'bearer', token: 'SANDBOXED-HOOK-TOKEN' },
    });
    const laterHook = vi.fn();

    _testOnlySetPlugins([
      makePlugin({
        name: 'earlier',
        directory: '/plugins/earlier',
        config: { disabled: false, elevated: true },
        module: { requestHooks: [earlierHook] },
      }),
      makePlugin({
        name: 'later',
        directory: '/plugins/later',
        config: { disabled: false },
        module: { requestHooks: [laterHook] },
      }),
    ]);

    const renderedRequest = {
      headers: [],
      body: { mimeType: 'text/plain', text: 'original' },
      authentication: { type: 'none' },
    } as any;
    const renderedContext = { getProjectId: () => 'proj_x', DEFAULT_HEADERS: undefined };

    const result = await applyRequestHooks(renderedRequest, renderedContext);

    // The trap never fires — the merge replaces `body`/`authentication` wholesale rather than
    // writing through the old sub-object's own properties.
    expect(captured.bodyText).toBeUndefined();
    expect(captured.authToken).toBeUndefined();
    // The later hook's real data reaches the final result untouched.
    expect(result.body.text).toBe('SANDBOXED-HOOK-BODY');
    expect((result.authentication as any).token).toBe('SANDBOXED-HOOK-TOKEN');
    // The field was replaced, not mutated through the trapped reference.
    expect(result.body).not.toBe(trappedBody);
    expect(result.authentication).not.toBe(trappedAuth);
    // The later hook's own function is never actually invoked in-process — it's routed to the mock.
    expect(laterHook).not.toHaveBeenCalled();
  });
});

describe('response hook chain shared object (cross-trust-boundary)', () => {
  it('does not let an earlier, in-process hook trap a later sandboxed hook\'s merged mutation', async () => {
    const captured: Record<string, unknown> = {};
    let trappedHeaders: any;

    const earlierHook = vi.fn(async (context: any) => {
      trappedHeaders = context.response.getHeaders();
      Object.defineProperty(trappedHeaders, 'push', {
        value: (...args: unknown[]) => {
          captured.pushed = args;
          return trappedHeaders.length;
        },
        configurable: true,
      });
    });

    runResponseHookInSandbox.mockResolvedValue({
      headers: [{ name: 'X-Sandboxed-Hook', value: 'SANDBOXED-HOOK-HEADER' }],
      bytesContent: 999,
    });
    const laterHook = vi.fn();

    _testOnlySetPlugins([
      makePlugin({
        name: 'earlier',
        directory: '/plugins/earlier',
        config: { disabled: false, elevated: true },
        module: { responseHooks: [earlierHook] },
      }),
      makePlugin({
        name: 'later',
        directory: '/plugins/later',
        config: { disabled: false },
        module: { responseHooks: [laterHook] },
      }),
    ]);

    const response = { headers: [{ name: 'X-Original', value: 'x' }], bytesContent: 0 } as any;
    const renderedRequest = { headers: [], body: {}, authentication: {} } as any;
    const renderedContext = { getProjectId: () => 'proj_x', DEFAULT_HEADERS: undefined };

    const result = await applyResponseHooks(response, renderedRequest, renderedContext);

    expect(captured.pushed).toBeUndefined();
    expect(result.headers).toEqual([{ name: 'X-Sandboxed-Hook', value: 'SANDBOXED-HOOK-HEADER' }]);
    expect(result.bytesContent).toBe(999);
    expect(result.headers).not.toBe(trappedHeaders);
    expect(laterHook).not.toHaveBeenCalled();
  });
});
