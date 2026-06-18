import type { RenderPurpose } from '../types';

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
  appInfo: { version: string; platform: string };
  /** Owning plugin name — needed to scope `store.*` (pluginData) bridge calls. */
  pluginName: string;
  /** Guards `util.render` recursion across the boundary against the existing renderLimit. */
  renderDepth: number;
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

/**
 * Redact host filesystem paths from an error message before it crosses back into the sandbox. Host
 * errors (e.g. a `readFile` ENOENT) embed absolute paths that disclose host layout; we strip those
 * while keeping the rest of the message (error codes, network failures, validation text) intact so
 * legitimate plugin error handling still works.
 *  - Windows: `C:\Users\...`
 *  - POSIX: `/Users/...` (≥2 segments), but not the path part of a `scheme://host/...` URL.
 */
const PATH_PATTERN = /[A-Za-z]:\\[^\s'"]+|(?<![:/\w])(?:\/[\w.\-@ ]+){2,}\/?/g;

export const sanitizeErrorMessage = (message: string): string =>
  message.replace(PATH_PATTERN, '<redacted-path>');

export const encodeBridgeFailure = (err: unknown): string => {
  const message = sanitizeErrorMessage(err instanceof Error ? err.message : String(err));
  return JSON.stringify({ ok: false, error: { message } } satisfies BridgeResult);
};
