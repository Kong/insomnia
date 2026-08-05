import fs from 'node:fs';
import path from 'node:path';

// Static detector for the protocol-dispatch/bridge layer (pluginToMainAPI), mirroring
// sandbox-surface.ts's structured-entry + findX() + formatter pattern but scanning handler source
// text instead of probing a live VM. Covers both writes (findUnguardedBodyPathWrites /
// findHandlersThatBypassBodyPathOwnership) and reads (findHandlersThatLeakArbitraryBodyPathReads).

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

// Trust checks must be named `resolveTrusted*` or `assert*Ownership`/`assert*Trust` to be recognized.
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

/** Flags handlers that write to a body-path-derived location with no inline trust check. */
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

// Dynamic counterpart to findUnguardedBodyPathWrites: exercises each handler for real with a
// synthetic body-path write it should refuse, and judges by whether the file actually changed —
// so a check that's present in source but not awaited (or ordered after the write) still gets caught.
export interface BodyPathOwnershipScenario {
  /** Path to a file that a response other than the caller's already owns. */
  otherBodyPath: string;
  /** The real owner's parentId, as `services.response.getByBodyPath` would report it. */
  otherParentId: string;
  /** The parentId the caller claims, distinct from otherParentId. */
  callerParentId: string;
}

/** Builds a bodyPath string that is textually different from the input yet resolves to the same absolute file via `path.resolve()`, to probe for an ownership check that compares strings exactly instead of resolving first. */
export const buildPathNormalizationVariant = (bodyPath: string): string => {
  const dir = path.dirname(bodyPath);
  const base = path.basename(bodyPath);
  return `${dir}${path.sep}__insomnia_probe_dir__${path.sep}..${path.sep}${base}`;
};

const bodyPathWriteProbePayloads = (scenario: BodyPathOwnershipScenario): Record<string, unknown>[] => {
  const normalizationVariant = buildPathNormalizationVariant(scenario.otherBodyPath);
  return [
    // Shape used by response.setBody.
    {
      bodyPath: scenario.otherBodyPath,
      parentId: scenario.callerParentId,
      bodyBase64: Buffer.from('dynamic-probe-overwrite', 'utf8').toString('base64'),
    },
    // Shape used by plugin.runUserResponseHook (bodyPath/parentId nested under `response`).
    {
      plugin: { name: '__dynamic-probe-plugin__' },
      hookIndex: 0,
      response: { bodyPath: scenario.otherBodyPath, parentId: scenario.callerParentId },
      renderedRequest: { url: 'https://example.com', headers: [] },
      renderContext: {},
    },
    // Path-normalization variant of each shape above: same absolute file, different raw string.
    {
      bodyPath: normalizationVariant,
      parentId: scenario.callerParentId,
      bodyBase64: Buffer.from('dynamic-probe-overwrite-variant', 'utf8').toString('base64'),
    },
    {
      plugin: { name: '__dynamic-probe-plugin__' },
      hookIndex: 0,
      response: { bodyPath: normalizationVariant, parentId: scenario.callerParentId },
      renderedRequest: { url: 'https://example.com', headers: [] },
      renderContext: {},
    },
  ];
};

/** Calls every handler with a payload that claims ownership of `scenario.otherBodyPath`; returns the path of every handler whose write actually changed that file's on-disk contents. */
export const findHandlersThatBypassBodyPathOwnership = async (
  handlers: Record<string, (...args: any[]) => any>,
  scenario: BodyPathOwnershipScenario,
): Promise<string[]> => {
  const violations: string[] = [];
  for (const [path, handler] of Object.entries(handlers)) {
    for (const payload of bodyPathWriteProbePayloads(scenario)) {
      const before = fs.readFileSync(scenario.otherBodyPath);
      try {
        await handler(payload);
      } catch {
        // Expected for handlers that reject the shape, or correctly enforce ownership.
      }
      const after = fs.readFileSync(scenario.otherBodyPath);
      if (!before.equals(after)) {
        violations.push(path);
        fs.writeFileSync(scenario.otherBodyPath, before);
      }
    }
  }
  return [...new Set(violations)];
};

// Read-side counterpart: judges each handler by whether its *return value* discloses the contents of a path the caller has no claim to, rather than by whether a file changed.
export interface BodyPathReadLeakScenario {
  /** Path to a file whose contents the caller has no ownership claim over. */
  outsidePath: string;
  /** The real contents of `outsidePath`, used to detect disclosure in a handler's return value. */
  outsideContents: string;
}

const bodyPathReadProbePayloads = (scenario: BodyPathReadLeakScenario): Record<string, unknown>[] => [
  // Shape used by response.getBodyBuffer.
  { response: { bodyPath: scenario.outsidePath } },
  // Flat shape, in case a future handler takes bodyPath directly on the body rather than nested.
  { bodyPath: scenario.outsidePath },
];

/** Best-effort stringify of a handler's return value (Buffer, Buffer-shaped JSON, or plain string) for a substring check. */
const stringifyHandlerResult = (result: unknown): string => {
  if (typeof result === 'string') {
    return result;
  }
  if (Buffer.isBuffer(result)) {
    return result.toString('utf8');
  }
  if (result && typeof result === 'object' && (result as { type?: string }).type === 'Buffer' && Array.isArray((result as { data?: unknown[] }).data)) {
    return Buffer.from((result as { data: number[] }).data).toString('utf8');
  }
  try {
    return JSON.stringify(result);
  } catch {
    return '';
  }
};

/** Calls every handler with a payload pointing at a path the caller has no claim over; returns the path of every handler whose return value discloses its contents. */
export const findHandlersThatLeakArbitraryBodyPathReads = async (
  handlers: Record<string, (...args: any[]) => any>,
  scenario: BodyPathReadLeakScenario,
): Promise<string[]> => {
  const violations: string[] = [];
  for (const [path, handler] of Object.entries(handlers)) {
    for (const payload of bodyPathReadProbePayloads(scenario)) {
      try {
        const result = await handler(payload);
        if (stringifyHandlerResult(result).includes(scenario.outsideContents)) {
          violations.push(path);
        }
      } catch {
        // Expected for handlers that reject the shape, or correctly refuse to read it.
      }
    }
  }
  return [...new Set(violations)];
};
