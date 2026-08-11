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
  // runTagInSandbox's `finally { ctx.dispose(); }` runs whenever drivePromiseToString gives up —
  // including on its own timeout — with no regard for whether a __hostBridge call the guest is still
  // awaiting has settled. Confirmed (not timing-dependent): a bridge call that simply never resolves
  // reproduces this on every run, with no delay/race required.
  it('a bridge call that never resolves crashes the timeout path instead of producing a clean timeout error', async () => {
    const neverSettles: HostBridge = () => new Promise(() => {});
    const error = await runTagInSandbox({
      pluginSource: nodeOSTag,
      tagName: 'g',
      envelope: envelope([]),
      bridge: neverSettles,
      timeoutMs: 50,
    }).catch((e: unknown) => e);
    // Today this is QuickJS's own internal "Aborted(Assertion failed: list_empty(&rt->gc_obj_list) …
    // JS_FreeRuntime)" — an engine-level invariant violation raised while freeing a runtime that still
    // has a live (never-settled) promise/job in it — not the intended "Template tag sandbox timed
    // out" message. Update this assertion once the timeout path is made safe to call with a bridge
    // call still outstanding.
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/gc_obj_list|JS_FreeRuntime|Aborted/);
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

  it('a bridge handler returning a non-JSON-serializable value additionally raises a process-level unhandled rejection', async () => {
    const capture = captureUnhandledRejections();
    try {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      const bridge = createMapBridge({ nodeOS: async () => circular });
      // encodeBridgeSuccess(value) (marshal.ts) calls JSON.stringify(value) inside
      // installHostBridge's settle continuation, which has no .catch() and nothing awaits it — so a
      // circular value throws there and becomes an unhandled rejection, distinct from (and in addition
      // to) the deferred promise never settling, which separately trips the same timeout-path crash
      // as the previous tests once the sandbox's own timeout elapses.
      const pending = runTagInSandbox({
        pluginSource: nodeOSTag,
        tagName: 'g',
        envelope: envelope([]),
        bridge,
        timeoutMs: 100,
      });
      await new Promise(resolve => setTimeout(resolve, 30));
      expect(capture.seen).toHaveLength(1);
      expect(String((capture.seen[0] as Error)?.message ?? capture.seen[0])).toMatch(/circular/i);
      await expect(pending).rejects.toThrow(/gc_obj_list|JS_FreeRuntime|Aborted/);
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
