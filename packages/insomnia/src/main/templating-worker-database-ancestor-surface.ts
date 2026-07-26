// Static detector, mirroring templating-worker-database-coercion-surface.ts's pattern: flags any
// `models.read` handler that trusts a caller-supplied id/parentId/doc without first verifying the
// resolved record's Workspace ancestor matches the caller's own. Handlers are selected by capability
// rather than a hand-picked list, so a future `models.read` handler is covered automatically.

import { BRIDGE_PATH_CAPABILITIES } from '../templating/sandbox/host-bridge';

export interface AncestorSurfaceEntry {
  path: string;
  guarded: boolean;
}

// Excluded from the `models.read` sweep for reasons specific to each, not because they're ungated:
// response.getBodyBuffer and response.setBody already have their own id/bodyPath-based ownership
// checks (db-trust.ts), and settings.get returns global data with no record to check ancestry on.
const EXCLUDED_FROM_ANCESTOR_CHECK = new Set(['response.getBodyBuffer', 'response.setBody', 'settings.get']);

// Not anchored to a trailing "(" — under Vite's SSR module transform, a named import is rewritten to
// a live-binding call shape (`(0, ns.recordBelongsToCallerWorkspace)(...)`), so the identifier itself
// is not immediately followed by its own call parens. Presence of the identifier is enough here.
const GUARD_CALL_PATTERN = /\brecordBelongsToCallerWorkspace\b/;

/** Describes every capability-selected `models.read` handler by regexing its compiled source. */
export const describeAncestorSurface = (
  handlers: Record<string, (...args: any[]) => any>,
): AncestorSurfaceEntry[] =>
  Object.keys(handlers)
    .filter(path => BRIDGE_PATH_CAPABILITIES[path] === 'models.read' && !EXCLUDED_FROM_ANCESTOR_CHECK.has(path))
    .map(path => ({ path, guarded: GUARD_CALL_PATTERN.test(handlers[path].toString()) }));

/** Flags handlers in scope that don't call the ancestor-check helper. */
export const findHandlersMissingAncestorCheck = (
  handlers: Record<string, (...args: any[]) => any>,
): AncestorSurfaceEntry[] => describeAncestorSurface(handlers).filter(e => !e.guarded);

/** Renders one AncestorSurfaceEntry back to readable text, for the diagnostic-print script only. */
export const formatAncestorSurfaceEntry = (e: AncestorSurfaceEntry): string =>
  e.guarded ? `${e.path}: guarded` : `${e.path}: MISSING recordBelongsToCallerWorkspace check`;

export const formatAncestorSurfaceEntries = (entries: AncestorSurfaceEntry[]): string[] =>
  entries.map(formatAncestorSurfaceEntry);
