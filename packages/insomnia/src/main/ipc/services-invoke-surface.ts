import fs from 'node:fs';
import path from 'node:path';

// Static detector for the services.invoke generic RPC gateway migration, mirroring
// templating-worker-database-coercion-surface.ts's structured-entry + findX() + formatter pattern,
// but scanning real files on disk rather than introspecting a single in-memory handler map — this
// gateway has no equivalent single object, since its call sites are the ~190 (serviceName, methodName)
// pairs scattered across renderer-reachable source that reach `services.<x>.<y>(...)` through the
// `services` proxy re-exported by `insomnia-data` (see `ui/renderer-services-proxy.ts`).
//
// A pair counts as migrated only once an `ipcMainHandle('services.<serviceName>.<methodName>', ...)`
// registration exists under `main/ipc/` — the literal dotted pair as the channel name, by convention,
// so this detector (and the renderer proxy switchover it's meant to support) never has to guess. An
// incidental `services.<x>.<y>(...)` call elsewhere under `main/` (in-process, for that module's own
// purposes) does not count: it proves nothing about whether the generic gateway is still the only way
// the renderer reaches that pair.

/** One (serviceName, methodName) pair reachable from renderer-side code via the `services` proxy. */
export interface ServicesInvokePairEntry {
  pair: string;
  serviceName: string;
  methodName: string;
  callSiteFiles: string[];
  hasNamedHandler: boolean;
}

const SERVICE_CALL_PATTERN = /\bservices\.([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\(/;
const NAMED_HANDLER_PATTERN = /ipcMainHandle\(\s*['"]services\.([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)['"]/;

// Fixture/test scaffolding, generated mocks, and vendored third-party sources aren't real
// renderer-reachable call sites — scanning them would misreport the surface.
const SKIP_DIR_NAMES = new Set(['node_modules', '__tests__', '__mocks__', '__snapshots__', 'vendored']);

const isScannableSourceFile = (name: string): boolean =>
  (name.endsWith('.ts') || name.endsWith('.tsx')) && !name.endsWith('.d.ts') && !/\.test\.tsx?$/.test(name);

const walkFiles = (dir: string, skipAbsoluteDirs: ReadonlySet<string> = new Set()): string[] => {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIR_NAMES.has(entry.name)) {
      continue;
    }
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (skipAbsoluteDirs.has(abs)) {
        continue;
      }
      results.push(...walkFiles(abs, skipAbsoluteDirs));
      continue;
    }
    if (entry.isFile() && isScannableSourceFile(entry.name)) {
      results.push(abs);
    }
  }
  return results;
};

/** Every `(serviceName, methodName)` match of `pattern` (a single-match-shaped regex, applied globally) found in `source`. */
const extractPairs = (source: string, pattern: RegExp): { serviceName: string; methodName: string }[] => {
  const matches: { serviceName: string; methodName: string }[] = [];
  const re = new RegExp(pattern.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    matches.push({ serviceName: m[1], methodName: m[2] });
  }
  return matches;
};

export interface ServicesInvokeSurfaceOptions {
  /** Root to scan for renderer-reachable `services.<x>.<y>(` call sites. A `main` subdirectory directly under this root is excluded, matching this plan's enumeration methodology. */
  rendererRoot?: string;
  /** Directory to scan for `ipcMainHandle('services.<x>.<y>', ...)` registrations. */
  mainIpcDir?: string;
}

const DEFAULT_RENDERER_ROOT = path.resolve(__dirname, '../..');
const DEFAULT_MAIN_IPC_DIR = __dirname;

// Real call sites this detector's `services.<x>.<y>(` regex structurally cannot see: a helper
// (`getResponseOperations` / the inline `responseModel` switch, both in the two route files below)
// returns `services.<serviceName>` itself, and the caller invokes `.methodName(...)` on the resulting
// variable — so the pair never appears as a literal `services.<x>.<y>(` token anywhere. Found via a
// Phase 3 tripwire hit (`services.invoke` throwing for `("response", "findByParentId")` live in the
// Playwright smoke suite), not by this scanner. Hand-maintained for the same reason
// MIGRATED_SERVICES_INVOKE_PAIRS is hand-maintained: a fully general data-flow scan of "does this
// variable trace back to a services.<x> reference" is out of scope for this detector. Only applied
// when scanning the real repo (default rendererRoot) — never against the fixture trees this file's
// other tests build, so those stay exact.
const DYNAMIC_DISPATCH_REAL_REPO_CALL_SITES: { pair: string; callSiteFiles: string[] }[] = [
  {
    pair: 'response.findByParentId',
    callSiteFiles: ['routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.tsx'],
  },
  {
    pair: 'webSocketResponse.getById',
    callSiteFiles: [
      'routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.response.delete.tsx',
      'routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.tsx',
    ],
  },
  {
    pair: 'webSocketResponse.findByParentId',
    callSiteFiles: ['routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.tsx'],
  },
  {
    pair: 'webSocketResponse.getLatestForRequestId',
    callSiteFiles: [
      'routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.response.delete.tsx',
      'routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.tsx',
    ],
  },
  {
    pair: 'socketIOResponse.getById',
    callSiteFiles: [
      'routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.response.delete.tsx',
      'routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.tsx',
    ],
  },
  {
    pair: 'socketIOResponse.findByParentId',
    callSiteFiles: ['routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.tsx'],
  },
  {
    pair: 'socketIOResponse.getLatestForRequestId',
    callSiteFiles: [
      'routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.response.delete.tsx',
      'routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.tsx',
    ],
  },
];

/** Describes every renderer-reachable `services.<x>.<y>` pair: its call sites, and whether it has migrated off the generic gateway onto a named handler. */
export const describeServicesInvokeSurface = (
  options: ServicesInvokeSurfaceOptions = {},
): ServicesInvokePairEntry[] => {
  const rendererRoot = options.rendererRoot ?? DEFAULT_RENDERER_ROOT;
  const mainIpcDir = options.mainIpcDir ?? DEFAULT_MAIN_IPC_DIR;
  const mainDir = path.resolve(rendererRoot, 'main');

  const callSitesByPair = new Map<string, Set<string>>();
  for (const file of walkFiles(rendererRoot, new Set([mainDir]))) {
    const source = fs.readFileSync(file, 'utf8');
    for (const { serviceName, methodName } of extractPairs(source, SERVICE_CALL_PATTERN)) {
      const pair = `${serviceName}.${methodName}`;
      const files = callSitesByPair.get(pair) ?? new Set<string>();
      files.add(path.relative(rendererRoot, file).split(path.sep).join('/'));
      callSitesByPair.set(pair, files);
    }
  }
  if (options.rendererRoot === undefined) {
    for (const { pair, callSiteFiles } of DYNAMIC_DISPATCH_REAL_REPO_CALL_SITES) {
      const files = callSitesByPair.get(pair) ?? new Set<string>();
      callSiteFiles.forEach(f => files.add(f));
      callSitesByPair.set(pair, files);
    }
  }

  const migratedPairs = new Set<string>();
  for (const file of walkFiles(mainIpcDir)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const { serviceName, methodName } of extractPairs(source, NAMED_HANDLER_PATTERN)) {
      migratedPairs.add(`${serviceName}.${methodName}`);
    }
  }

  return [...callSitesByPair.entries()]
    .map(([pair, files]) => {
      const [serviceName, methodName] = pair.split('.');
      return {
        pair,
        serviceName,
        methodName,
        callSiteFiles: [...files].sort(),
        hasNamedHandler: migratedPairs.has(pair),
      };
    })
    .sort((a, b) => a.pair.localeCompare(b.pair));
};

/** Flags every pair still reachable only through the generic `services.invoke` gateway. */
export const findPairsMissingNamedHandler = (
  options: ServicesInvokeSurfaceOptions = {},
): ServicesInvokePairEntry[] => describeServicesInvokeSurface(options).filter(e => !e.hasNamedHandler);

/** Renders one ServicesInvokePairEntry back to readable text, for the diagnostic-print script only. */
export const formatServicesInvokeSurfaceEntry = (e: ServicesInvokePairEntry): string =>
  `${e.pair}: ${e.hasNamedHandler ? 'named handler' : 'services.invoke'} ` +
  `(${e.callSiteFiles.length} call site${e.callSiteFiles.length === 1 ? '' : 's'})`;

export const formatServicesInvokeSurfaceEntries = (entries: ServicesInvokePairEntry[]): string[] =>
  entries.map(formatServicesInvokeSurfaceEntry);
