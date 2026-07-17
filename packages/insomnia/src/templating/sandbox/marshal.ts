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

/** A discovered template-tag's serializable metadata (no `run`, no other function members). */
export interface TemplateTagDescriptor {
  name?: string;
  displayName?: string;
  description?: string;
  args?: unknown[];
}

/** A discovered action's serializable metadata (no `action`/`run`). */
export interface ActionDescriptor {
  label?: string;
  icon?: string;
}

/** A discovered theme (plain data). */
export interface ThemeDescriptor {
  name?: string;
  displayName?: string;
  theme?: unknown;
}

/**
 * What the sandbox returns for a plugin at load time (L1): the shapes of its exports, discovered by
 * evaluating the entry inside the sandbox instead of `nodeRequire`-ing it on the host. Only data
 * crosses back — hook/action function bodies never leave the sandbox (hooks are reported as a count;
 * their execution is routed in a later PR).
 */
export interface PluginExportManifest {
  templateTags: TemplateTagDescriptor[];
  requestHooks: number;
  responseHooks: number;
  requestActions: ActionDescriptor[];
  requestGroupActions: ActionDescriptor[];
  workspaceActions: ActionDescriptor[];
  documentActions: ActionDescriptor[];
  themes: ThemeDescriptor[];
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
