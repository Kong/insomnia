// Static detector for the protocol-dispatch/bridge layer (pluginToMainAPI), mirroring
// templating-worker-database-surface.ts's structured-entry + findX() + formatter pattern but scanning
// for a different bug class: a bare (unwrapped) id/parentId/key-shaped argument reaching a
// services.* call. NeDB (a MongoDB-style query engine) treats an object like `{ $ne: null }` passed
// in place of a plain string id as a query operator rather than a literal value, letting a crafted
// "id" match far more than the single record the caller claims to want. Wrapping the argument in
// `String(...)` closes this off cheaply, without needing the deeper ownership/ancestor-chain check
// tracked separately in CROSS-TENANT-DB-ACCESS-FINDINGS.md.

/** One protocol-dispatch handler, describing which identifier-shaped fields it passes to a services.* call without a String(...) wrapper. */
export interface CoercionSurfaceEntry {
  path: string;
  uncoercedFields: string[];
}

// Fields treated as identifier-shaped: a caller-supplied lookup key that a services.* call forwards
// straight into an NeDB query. New handlers that destructure one of these names from `body` and pass
// it to a services.* call are automatically covered here — no list to maintain by hand.
const ID_LIKE_FIELDS = ['id', 'parentId', 'key', 'requestId', 'environmentId'] as const;

const ID_LIKE_FIELD_PATTERN = new RegExp(`\\bbody\\.(${ID_LIKE_FIELDS.join('|')})\\b`);

/** True when the field access at `matchIndex` in `text` is wrapped as `String(body.field)`. */
const isCoercedAt = (text: string, matchIndex: number): boolean => {
  const preceding = text.slice(Math.max(0, matchIndex - 16), matchIndex);
  return /String\(\s*$/.test(preceding);
};

// Finds every `services.<...>(<args>)` call in `source` (balanced-paren aware, so a nested call like
// `String(body.value)` inside the argument list doesn't truncate the match early), returning each
// call's raw argument text.
const extractServicesCallArgs = (source: string): string[] => {
  const args: string[] = [];
  const callStart = /services(?:\.\w+)+\(/g;
  let m: RegExpExecArray | null;
  while ((m = callStart.exec(source))) {
    const openIdx = m.index + m[0].length - 1;
    let depth = 1;
    let i = openIdx + 1;
    for (; i < source.length && depth > 0; i++) {
      if (source[i] === '(') { depth++; } else if (source[i] === ')') { depth--; }
    }
    args.push(source.slice(openIdx + 1, i - 1));
    callStart.lastIndex = i;
  }
  return args;
};

/** Describes every handler in a pluginToMainAPI-shaped map by regexing its compiled source's services.* call sites. */
export const describeCoercionSurface = (handlers: Record<string, (...args: any[]) => any>): CoercionSurfaceEntry[] =>
  Object.entries(handlers).map(([path, handler]) => {
    const source = handler.toString();
    const uncoercedFields = new Set<string>();
    for (const argText of extractServicesCallArgs(source)) {
      const pattern = new RegExp(ID_LIKE_FIELD_PATTERN.source, 'g');
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(argText))) {
        if (!isCoercedAt(argText, match.index)) {
          uncoercedFields.add(match[1]);
        }
      }
    }
    return { path, uncoercedFields: [...uncoercedFields] };
  });

/** Flags handlers that pass a bare (unwrapped) id-like field straight into a services.* call. */
export const findHandlersMissingIdCoercion = (
  handlers: Record<string, (...args: any[]) => any>,
): { path: string; uncoercedFields: string[] }[] =>
  describeCoercionSurface(handlers).filter(e => e.uncoercedFields.length > 0);

/** Renders one CoercionSurfaceEntry back to readable text, for the diagnostic-print script only. */
export const formatCoercionSurfaceEntry = (e: CoercionSurfaceEntry): string =>
  e.uncoercedFields.length === 0 ? `${e.path}: coerced` : `${e.path}: MISSING String() on ${e.uncoercedFields.join(', ')}`;

export const formatCoercionSurfaceEntries = (entries: CoercionSurfaceEntry[]): string[] =>
  entries.map(formatCoercionSurfaceEntry);
