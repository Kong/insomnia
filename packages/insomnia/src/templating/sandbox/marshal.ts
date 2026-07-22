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
  /**
   * Request/response hook invocation (H1). When set, the sandbox runs the plugin's hook at
   * `hookIndex` in `requestHooks`/`responseHooks` (per `hookKind`) instead of a template tag,
   * rebuilding `context.request` (and `context.response`) over the copied-in `hookRequest`/
   * `hookResponse` data. The hook mutates that data in place; the sandbox marshals the mutated
   * object back out (see `HookResult`) and the host merges it onto the request/response it returns.
   */
  hookKind?: 'request' | 'response';
  /** Index of the hook within the plugin's `requestHooks`/`responseHooks` array. */
  hookIndex?: number;
  /** The `RenderedRequest` fields a hook may read/mutate (headers/url/method/params/auth/body/settings). */
  hookRequest?: Record<string, unknown>;
  /** The response patch a response hook may read (getters only; `setBody` bridges to the host). */
  hookResponse?: Record<string, unknown>;
}

/** What a hook invocation marshals back out of the sandbox: the mutated request/response data. */
export interface HookResult {
  request?: Record<string, unknown>;
  response?: Record<string, unknown>;
}

// The serializable RenderedRequest fields a request hook may read or mutate — the subset marshaled
// into and out of the sandbox (mirrors what plugins/context/request.ts touches on the request).
// Shared between the host side (`main/templating-worker-database.ts`, which marshals a request in
// and merges the mutation back for the main/CLI runtime) and the renderer side
// (`plugins/invoke-method.ts`, which does the same for the plugin-window runtime) so both merge
// call sites enforce the identical allowlist rather than duplicating (and risking drifting) it.
export const HOOK_REQUEST_FIELDS = [
  '_id',
  'name',
  'url',
  'method',
  'headers',
  'parameters',
  'authentication',
  'body',
  'cookies',
  'settingSendCookies',
  'settingStoreCookies',
  'settingEncodeUrl',
  'settingDisableRenderRequestBody',
  'settingFollowRedirects',
] as const;

// Property names that, if present as an *own* key on an object parsed from untrusted JSON, are a
// prototype-pollution primitive waiting for a future unsafe consumer ([[Set]]-based merge,
// `for...in` assignment, etc.) — see H1-HOOK-SANDBOX-SECURITY-REVIEW.md, finding 2. A hook can
// plant such a key on a nested value (e.g. `context.request.setBody(JSON.parse('{"__proto__":
// {...}}'))`) using computed-key construction, which survives a plain `JSON.parse` as a real own
// property rather than the accessor. Dropping it via a reviver (returning `undefined` deletes the
// key, per the JSON.parse spec) neutralizes it at every depth, at the exact boundary where
// untrusted sandbox output re-enters trusted host memory.
const DANGEROUS_JSON_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** `JSON.parse` reviver that drops `__proto__`/`constructor`/`prototype` own-keys at any depth. */
export const stripDangerousKeysReviver = (key: string, value: unknown): unknown =>
  DANGEROUS_JSON_KEYS.has(key) ? undefined : value;

/**
 * Merges a hook's mutated request fields back onto the live request the host is building, one
 * allowlisted field at a time — never a blanket `Object.assign`/spread of the parsed object,
 * which would trust whatever top-level keys happen to be present in `mutated` rather than only
 * the fields a hook is actually permitted to touch.
 */
export const mergeHookRequestMutation = (target: Record<string, any>, mutated: Record<string, any>): void => {
  for (const key of HOOK_REQUEST_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(mutated, key)) {
      target[key] = mutated[key];
    }
  }
};

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
