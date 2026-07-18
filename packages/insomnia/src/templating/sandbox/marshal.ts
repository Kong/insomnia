import type { RenderPurpose } from '../../common/templating/types';

/**
 * The bulk-copied, JSON-serialisable state handed to the sandbox up front. Everything here is
 * plain data — no functions cross the boundary (per PR #10072: copy state in, rebuild the API
 * in pure JS inside the sandbox, bridge only async work). Mirrors the fields the worker context
 * in `liquid-extension-worker.ts` derives host-side before invoking a tag's `run()`.
 */
export interface ContextEnvelope {
  /** Parsed + decoded positional args for the tag's `run(context, ...args)`. */
  args: unknown[];
  /** The LiquidJS render scope (`ctx.getAll()`), used as `context.context`. */
  context: Record<string, unknown>;
  /** Result of the host-side `getMeta()` call. */
  meta?: { requestId?: string; workspaceId?: string };
  /** Result of the host-side `getPurpose()` call. */
  renderPurpose?: RenderPurpose;
  /** `app.getInfo()` is synchronous, so its value is copied in rather than bridged. */
  appInfo: { version: string; platform: string; arch: string };
  /** Owning plugin name — needed to scope `store.*` (pluginData) bridge calls. */
  pluginName: string;
  /** Unused: recursion via util.render is now prevented by rejecting {% tag %} syntax there, not by depth-limiting. */
  renderDepth: number;
  /**
   * Canonical registry-module names the plugin may `require()` (default-deny; see
   * `module-registry.ts`). Until the manifest loader (C3) lands, callers pass the
   * `TEMPLATE_TAG_BASELINE_MODULES` baseline.
   */
  grantedModules: string[];
  /**
   * Capability groups the plugin may reach through the host bridge (axis 2, default-deny; see
   * `host-bridge.ts`). The bridge is gated host-side (C1); C2 reads this to omit ungranted branches
   * from the rebuilt `context`.
   */
  grantedCapabilities: string[];
  /**
   * The plugin's own source files (M4), keyed by POSIX path relative to the plugin directory —
   * read host-side within the plugin dir only (never `node_modules`). The in-sandbox loader resolves
   * relative `require()`s against this map; bare specifiers still go through the grant-gated registry.
   * `runTagInSandbox` fills these in from a single-file `pluginSource` when not provided, so
   * single-module callers/tests need not construct a map.
   */
  moduleFiles?: Record<string, string>;
  /** Key into `moduleFiles` for the plugin's entry module (from package.json `main`). */
  entryModuleKey?: string;
}

/**
 * The contract every host-bridge call resolves to. We resolve (never reject) the VM promise with
 * this so the sandbox side can rethrow a real Error without us juggling VM error handles. The
 * sandbox `__bridge` helper in the bootstrap unwraps it.
 */
export interface BridgeResult {
  ok: boolean;
  value?: unknown;
  error?: { message: string };
}

export const encodeBridgeSuccess = (value: unknown): string =>
  JSON.stringify({ ok: true, value: value ?? null } satisfies BridgeResult);

export const encodeBridgeFailure = (err: unknown): string => {
  const message = err instanceof Error ? err.message : String(err);
  return JSON.stringify({ ok: false, error: { message } } satisfies BridgeResult);
};
