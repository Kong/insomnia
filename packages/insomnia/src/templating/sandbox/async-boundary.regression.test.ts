import { describe, expect, it } from 'vitest';

import { createMapBridge, type HostBridge, TEMPLATE_TAG_BASELINE_CAPABILITIES } from './host-bridge';
import type { ContextEnvelope } from './marshal';
import { runTagInSandbox } from './plugin-tag-sandbox';

const envelope = (args: unknown[]): ContextEnvelope => ({
  args,
  context: {},
  meta: {},
  renderPurpose: 'preview',
  appInfo: { version: '0.0.0', platform: 'linux', arch: 'arm64' },
  pluginName: 'test-plugin',
  renderDepth: 0,
  grantedModules: [],
  grantedCapabilities: [...TEMPLATE_TAG_BASELINE_CAPABILITIES],
});

const noBridge: HostBridge = async path => {
  throw new Error(`unexpected bridge call: ${path}`);
};

const nodeOSTag =
  "module.exports.templateTags = [{ name: 'g', run: async function (context) { return await context.util.nodeOS(); } }];";
const nodeOSArchTag =
  "module.exports.templateTags = [{ name: 'g', run: async function (context) { return (await context.util.nodeOS()).arch; } }];";

/** Observes process-level unhandled rejections for the duration of one test, without letting them escape. */
const captureUnhandledRejections = () => {
  const seen: unknown[] = [];
  const onUnhandledRejection = (reason: unknown) => {
    seen.push(reason);
  };
  process.on('unhandledRejection', onUnhandledRejection);
  return { seen, stop: () => process.off('unhandledRejection', onUnhandledRejection) };
};

describe('disposing a context with an unsettled bridge call still pending', () => {
  // runTagInSandbox's `finally` runs whenever drivePromiseToString gives up — including on its own
  // timeout — regardless of whether a __hostBridge call the guest is still awaiting has settled.
  // Before the fix, disposing a context with a live bridge call left a promise/continuation
  // referenced inside the runtime, and freeing that runtime crashed the QuickJS engine outright
  // ("Aborted(Assertion failed: list_empty(&rt->gc_obj_list) ... JS_FreeRuntime)") instead of raising
  // the intended timeout error. drivePromiseToString now force-settles any outstanding bridge calls
  // (forceSettlePendingBridgeCalls) before giving up, so this reproduces as a clean, catchable error.
  it('a bridge call that never resolves produces a clean timeout error, not an engine crash', async () => {
    const capture = captureUnhandledRejections();
    try {
      const neverSettles: HostBridge = () => new Promise(() => {});
      await expect(
        runTagInSandbox({
          pluginSource: nodeOSTag,
          tagName: 'g',
          envelope: envelope([]),
          bridge: neverSettles,
          timeoutMs: 50,
        }),
      ).rejects.toThrow('Template tag sandbox timed out');
      expect(capture.seen).toHaveLength(0);
    } finally {
      capture.stop();
    }
  });

  it('does not corrupt the shared WASM module for a later, unrelated render', async () => {
    const neverSettles: HostBridge = () => new Promise(() => {});
    await runTagInSandbox({
      pluginSource: nodeOSTag,
      tagName: 'g',
      envelope: envelope([]),
      bridge: neverSettles,
      timeoutMs: 50,
    }).catch(() => {});

    const source = 'module.exports.templateTags = [{ name: "ok", run: function () { return "still-fine"; } }];';
    const actual = await runTagInSandbox({ pluginSource: source, tagName: 'ok', envelope: envelope([]), bridge: noBridge });
    expect(actual).toBe('still-fine');
  });

  it('a bridge call resolving after the sandbox already gave up on it does not crash or leak an unhandled rejection', async () => {
    const capture = captureUnhandledRejections();
    try {
      const bridge = createMapBridge({
        nodeOS: () => new Promise(resolve => setTimeout(() => resolve({ arch: 'x64' }), 300)),
      });
      await expect(
        runTagInSandbox({ pluginSource: nodeOSTag, tagName: 'g', envelope: envelope([]), bridge, timeoutMs: 50 }),
      ).rejects.toThrow('Template tag sandbox timed out');
      // The mocked handler above resolves ~250ms after runTagInSandbox already gave up and disposed
      // its context. settleBridgeResult (plugin-tag-sandbox.ts) no-ops once ctx is no longer alive, so
      // that late resolution must not surface as anything — give it time to actually land first.
      await new Promise(resolve => setTimeout(resolve, 400));
      expect(capture.seen).toHaveLength(0);
    } finally {
      capture.stop();
    }
  });

  it('a bridge handler returning a non-JSON-serializable value surfaces as a normal tag error, not an unhandled rejection', async () => {
    const capture = captureUnhandledRejections();
    try {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      const bridge = createMapBridge({ nodeOS: async () => circular });
      // encodeBridgeSuccess(value) (marshal.ts) throwing on a circular value is now caught by
      // settleBridgeResult and turned into an ordinary bridge failure instead of an unhandled
      // rejection — the render fails fast with a catchable error, no timeout needed.
      await expect(
        runTagInSandbox({ pluginSource: nodeOSTag, tagName: 'g', envelope: envelope([]), bridge, timeoutMs: 2000 }),
      ).rejects.toThrow(/circular/i);
      expect(capture.seen).toHaveLength(0);
    } finally {
      capture.stop();
    }
  });
});

describe('unhandled rejections created inside the guest VM', () => {
  // No JS_SetHostPromiseRejectionTracker-equivalent is wired up, so a rejection the guest never
  // observes (unrelated to the tag's own return value) has no host-side hook — confirm that just
  // means it's unobserved, not that it destabilizes the render.
  it('a fire-and-forget rejection unrelated to the tag result does not crash or hang the render', async () => {
    const capture = captureUnhandledRejections();
    try {
      const source = `module.exports.templateTags = [{ name: 'g', run: function () {
        Promise.reject(new Error('unrelated, never awaited'));
        return 'ok';
      } }];`;
      const actual = await runTagInSandbox({ pluginSource: source, tagName: 'g', envelope: envelope([]), bridge: noBridge });
      expect(actual).toBe('ok');
      // The rejection lives entirely inside the QuickJS VM's own promise machinery — it never becomes
      // a host-native (Node) promise, so it must not surface here either.
      expect(capture.seen).toHaveLength(0);
    } finally {
      capture.stop();
    }
  });
});

describe('concurrent renders do not share a job queue', () => {
  // runTagInSandbox calls QuickJS.newContext(), which allocates a fresh QuickJSRuntime per call (the
  // runtime is one of the context's ownedLifetimes, so ctx.dispose() tears it down too) — so one
  // render's executePendingJobs() can never drain another concurrent render's pending job.
  it('each concurrent render only ever observes its own bridge result', async () => {
    const makeBridge = (tag: string) =>
      createMapBridge({ nodeOS: () => new Promise(resolve => setTimeout(() => resolve({ arch: tag }), 10)) });
    const runs = Array.from({ length: 10 }, (_, i) => `render-${i}`);
    const results = await Promise.all(
      runs.map(tag =>
        runTagInSandbox({ pluginSource: nodeOSArchTag, tagName: 'g', envelope: envelope([]), bridge: makeBridge(tag) }),
      ),
    );
    expect(results).toEqual(runs);
  });
});

describe('what a bridge promise can hand back to the guest', () => {
  // __hostBridge's result always round-trips through JSON.stringify/JSON.parse (marshal.ts), so a
  // function on a bridge handler's return value can never reach the guest as a callable — confirm
  // it's silently dropped by JSON, not delivered as some other kind of live reference.
  it('drops function-valued properties instead of delivering them as callables', async () => {
    const bridge = createMapBridge({
      nodeOS: async () => ({ arch: 'x64', hostCallback: () => 'unsandboxed-call' }),
    });
    const source =
      "module.exports.templateTags = [{ name: 'g', run: async function (context) { var os = await context.util.nodeOS(); return typeof os.hostCallback; } }];";
    const actual = await runTagInSandbox({ pluginSource: source, tagName: 'g', envelope: envelope([]), bridge });
    expect(actual).toBe('undefined');
  });
});
