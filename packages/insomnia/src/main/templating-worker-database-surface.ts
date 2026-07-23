// Static detector for the protocol-dispatch/bridge layer (pluginToMainAPI), mirroring
// sandbox-surface.ts's structured-entry + findX() + formatter pattern but scanning handler source
// text instead of probing a live VM. Scoped to writes only — response.getBodyBuffer's unguarded
// read is a separate, already-tracked issue (CROSS-TENANT-DB-ACCESS-FINDINGS.md Finding 1).

/** One protocol-dispatch handler, describing whether it writes to a body-path-derived location without an inline trust check. */
export interface HandlerSurfaceEntry {
  path: string;
  hasFileWriteCall: boolean;
  hasBodyPathReference: boolean;
  hasTrustCheckCall: boolean;
}

// Matched on method name alone: build/test transforms rewrite `fs.writeFileSync` call sites to an
// aliased import (e.g. `__vite_ssr_import_N__.default.writeFileSync`), so a literal `fs.` prefix
// would silently stop matching under this detector's own test tooling.
const FILE_WRITE_CALL_PATTERN =
  /\.(writeFileSync|appendFileSync|unlinkSync|rmSync|renameSync|copyFileSync|writeFile|unlink|rm|rename|copyFile)\s*\(/;

const BODY_PATH_REFERENCE_PATTERN = /body\.(bodyPath|path|filePath|directory|targetPath)\b/;

// Naming convention (also recorded in SKILL.md): trust checks must be named `resolveTrusted*` or
// `assert*Ownership`/`assert*Trust` so this detector can recognize them by name.
const TRUST_CHECK_CALL_PATTERN = /\b(resolveTrusted\w*|assert\w*(?:Ownership|Trust)\w*)\s*\(/;

/** Describes every handler in a pluginToMainAPI-shaped map by regexing its compiled source. */
export const describeHandlerSurface = (handlers: Record<string, (...args: any[]) => any>): HandlerSurfaceEntry[] =>
  Object.entries(handlers).map(([path, handler]) => {
    const source = handler.toString();
    return {
      path,
      hasFileWriteCall: FILE_WRITE_CALL_PATTERN.test(source),
      hasBodyPathReference: BODY_PATH_REFERENCE_PATTERN.test(source),
      hasTrustCheckCall: TRUST_CHECK_CALL_PATTERN.test(source),
    };
  });

/** Flags handlers that write to a body-path-derived location with no inline trust check (the PR #10286 bug class). */
export const findUnguardedBodyPathWrites = (
  handlers: Record<string, (...args: any[]) => any>,
): { path: string; reason: string }[] =>
  describeHandlerSurface(handlers)
    .filter(e => e.hasFileWriteCall && e.hasBodyPathReference && !e.hasTrustCheckCall)
    .map(e => ({
      path: e.path,
      reason: `writes to a body-path-derived location with no resolveTrusted*/assert*Ownership/assert*Trust call in its own source`,
    }));

/** Renders one HandlerSurfaceEntry back to readable text, for the diagnostic-print script only. */
export const formatHandlerSurfaceEntry = (e: HandlerSurfaceEntry): string =>
  `${e.path}: write=${e.hasFileWriteCall} bodyPathRef=${e.hasBodyPathReference} trustCheck=${e.hasTrustCheckCall}`;

export const formatHandlerSurfaceEntries = (entries: HandlerSurfaceEntry[]): string[] =>
  entries.map(formatHandlerSurfaceEntry);
