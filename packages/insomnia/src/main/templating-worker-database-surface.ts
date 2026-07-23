import fs from 'node:fs';
import path from 'node:path';

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

// Dynamic counterpart to findUnguardedBodyPathWrites above. The static scan can only see whether a
// resolveTrusted*/assert*Ownership/assert*Trust call is textually present in a handler's source —
// it can't see whether that call is actually awaited, or ordered before the write it's meant to
// gate. A handler that calls a correctly-named trust check but fires the write before/without
// waiting on it reads as "guarded" to the regex scan while providing zero real protection. This
// probe instead exercises each handler for real, with a synthetic body-path write it should refuse,
// and looks at whether the on-disk file actually changed — so it can't be fooled by source shape.
export interface BodyPathOwnershipScenario {
  /** Path to a file that a legitimate response, other than the caller's, already owns. */
  victimBodyPath: string;
  /** The real owner's parentId, as `services.response.getByBodyPath` would report it. */
  victimParentId: string;
  /** The parentId an attacker claims, distinct from victimParentId. */
  attackerParentId: string;
}

/**
 * Builds a bodyPath string that is textually different from the input yet resolves to the exact
 * same absolute file via `path.resolve()` — which normalizes `.`/`..`/redundant-separator segments
 * purely lexically, with no filesystem access, so this needs no real directory to exist. Probes for
 * an ownership check that compares the caller-supplied bodyPath by exact string equality (e.g. an
 * NeDB `findOne({ bodyPath })` lookup) instead of resolving it first, the same way the path actually
 * used to perform the write is resolved (PR #10294's `response.setBody` bug class).
 */
export const buildPathNormalizationVariant = (bodyPath: string): string => {
  const dir = path.dirname(bodyPath);
  const base = path.basename(bodyPath);
  return `${dir}${path.sep}__insomnia_probe_dir__${path.sep}..${path.sep}${base}`;
};

const bodyPathWriteProbePayloads = (scenario: BodyPathOwnershipScenario): Record<string, unknown>[] => {
  const normalizationVariant = buildPathNormalizationVariant(scenario.victimBodyPath);
  return [
    // Shape used by response.setBody.
    {
      bodyPath: scenario.victimBodyPath,
      parentId: scenario.attackerParentId,
      bodyBase64: Buffer.from('dynamic-probe-overwrite', 'utf8').toString('base64'),
    },
    // Shape used by plugin.runUserResponseHook (bodyPath/parentId nested under `response`).
    {
      plugin: { name: '__dynamic-probe-plugin__' },
      hookIndex: 0,
      response: { bodyPath: scenario.victimBodyPath, parentId: scenario.attackerParentId },
      renderedRequest: { url: 'https://example.com', headers: [] },
      renderContext: {},
    },
    // Path-normalization variant of each shape above: same absolute file, different raw string —
    // probes for an ownership check whose exact-string lookup misses while the write's own
    // path.resolve() still lands on the victim file.
    {
      bodyPath: normalizationVariant,
      parentId: scenario.attackerParentId,
      bodyBase64: Buffer.from('dynamic-probe-overwrite-variant', 'utf8').toString('base64'),
    },
    {
      plugin: { name: '__dynamic-probe-plugin__' },
      hookIndex: 0,
      response: { bodyPath: normalizationVariant, parentId: scenario.attackerParentId },
      renderedRequest: { url: 'https://example.com', headers: [] },
      renderContext: {},
    },
  ];
};

/**
 * Calls every handler in a pluginToMainAPI-shaped map with a payload that claims ownership of
 * `scenario.victimBodyPath` under `scenario.attackerParentId`, then checks whether that file's
 * on-disk contents actually changed. Returns the path of every handler that let the write through.
 * Handlers that don't recognize the payload shape are expected to throw or no-op — only an actual
 * change to the victim file counts as a violation, so this needs no knowledge of any given
 * handler's internals or naming.
 */
export const findHandlersThatBypassBodyPathOwnership = async (
  handlers: Record<string, (...args: any[]) => any>,
  scenario: BodyPathOwnershipScenario,
): Promise<string[]> => {
  const violations: string[] = [];
  for (const [path, handler] of Object.entries(handlers)) {
    for (const payload of bodyPathWriteProbePayloads(scenario)) {
      const before = fs.readFileSync(scenario.victimBodyPath);
      try {
        await handler(payload);
      } catch {
        // Expected for handlers that reject the shape, or correctly enforce ownership.
      }
      const after = fs.readFileSync(scenario.victimBodyPath);
      if (!before.equals(after)) {
        violations.push(path);
        fs.writeFileSync(scenario.victimBodyPath, before);
      }
    }
  }
  return [...new Set(violations)];
};
