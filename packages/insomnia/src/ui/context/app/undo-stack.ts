import { utf8ByteLength } from '~/common/utils/utf8-bytes';

/** The request-pane sub-tabs that an undo entry can bring back into view. */
export type RequestSubTab = 'params' | 'content-type' | 'auth' | 'headers' | 'scripts' | 'docs';

/**
 * Maximum number of entries kept on the undo stack. Surfaced to the user via the
 * keyboard-shortcut descriptions ("Undo (up to 50 steps)"). Bounded so whole-array
 * snapshots stay cheap.
 */
export const UNDO_STACK_MAX = 50;

/**
 * Edits whose snapshot is larger than this (mainly large request bodies) are not
 * recorded for undo. Deletions of items above this size warn "This cannot be undone".
 */
export const UNDO_MAX_SNAPSHOT_BYTES = 1_000_000;

/** Consecutive edits to the same field within this window coalesce into one undo step. */
export const COALESCE_MS = 700;

export interface UndoLocation {
  organizationId: string;
  projectId: string;
  workspaceId: string;
  requestId: string;
  subTab: RequestSubTab;
}

export interface PatchEntry {
  kind: 'patch';
  id: number;
  location: UndoLocation;
  before: Record<string, any>;
  after: Record<string, any>;
  keys: string[];
  /** Signature of the array fields, used to decide coalescing vs. a new atomic step. */
  shape: string;
  /** Structural changes (add/delete/reorder row) are sealed so later typing does not merge in. */
  sealed: boolean;
  createdAt: number;
}

export interface DeleteEntry {
  kind: 'delete-request';
  id: number;
  location: UndoLocation;
  requestDoc: Record<string, any>;
  metaDoc: Record<string, any> | null;
  sealed: true;
  createdAt: number;
}

export type UndoEntry = PatchEntry | DeleteEntry;

export const pick = (obj: Record<string, any>, keys: string[]) => {
  const out: Record<string, any> = {};
  for (const key of keys) {
    out[key] = obj?.[key];
  }
  return out;
};

/** A signature of the array-valued fields in a patch (ids in order), or "scalar" for non-arrays. */
export const shapeOf = (obj: Record<string, any>, keys: string[]) =>
  keys
    .map(key => {
      const value = obj?.[key];
      if (Array.isArray(value)) {
        return value.map(item => item?.id ?? item?.name ?? '').join(',');
      }
      return 'scalar';
    })
    .join('|');

export const snapshotBytes = (obj: Record<string, any>) => {
  try {
    return utf8ByteLength(JSON.stringify(obj));
  } catch {
    return 0;
  }
};

let nextEntryId = 1;
export const resetEntryIdForTests = () => {
  nextEntryId = 1;
};

export interface RecordEditInput {
  location: UndoLocation;
  before: Record<string, any>;
  after: Record<string, any>;
  now: number;
}

/**
 * Record a field edit onto the undo stack, coalescing consecutive edits to the same field
 * within {@link COALESCE_MS} into a single step. Structural changes (add/delete/reorder a row)
 * are detected via the array shape and recorded as their own atomic, sealed step. Mutates and
 * returns the same `stack` array for use with refs; returns `skipped: true` when the snapshot
 * exceeds {@link UNDO_MAX_SNAPSHOT_BYTES} (the edit is left un-undoable).
 */
export const recordEdit = (
  stack: UndoEntry[],
  input: RecordEditInput,
): { stack: UndoEntry[]; skipped: boolean; merged: boolean } => {
  const { location, before, after, now } = input;
  const keys = Object.keys(after);
  if (keys.length === 0) {
    return { stack, skipped: true, merged: false };
  }
  if (snapshotBytes(after) > UNDO_MAX_SNAPSHOT_BYTES || snapshotBytes(before) > UNDO_MAX_SNAPSHOT_BYTES) {
    finalizeTop(stack);
    return { stack, skipped: true, merged: false };
  }

  const beforeShape = shapeOf(before, keys);
  const afterShape = shapeOf(after, keys);
  const isStructural = beforeShape !== afterShape;

  const top = stack[stack.length - 1];
  const canMerge =
    top &&
    top.kind === 'patch' &&
    !top.sealed &&
    !isStructural &&
    top.location.requestId === location.requestId &&
    top.location.subTab === location.subTab &&
    top.keys.length === keys.length &&
    top.keys.every(k => keys.includes(k)) &&
    top.shape === afterShape &&
    now - top.createdAt < COALESCE_MS;

  if (canMerge && top.kind === 'patch') {
    // Keep the original `before`; advance `after` and slide the coalescing window.
    top.after = after;
    top.createdAt = now;
    return { stack, skipped: false, merged: true };
  }

  stack.push({
    kind: 'patch',
    id: nextEntryId++,
    location,
    before,
    after,
    keys,
    shape: afterShape,
    sealed: isStructural,
    createdAt: now,
  });
  enforceMax(stack);
  return { stack, skipped: false, merged: false };
};

export const recordDelete = (
  stack: UndoEntry[],
  params: { location: UndoLocation; requestDoc: Record<string, any>; metaDoc: Record<string, any> | null; now: number },
): UndoEntry[] => {
  stack.push({
    kind: 'delete-request',
    id: nextEntryId++,
    location: params.location,
    requestDoc: params.requestDoc,
    metaDoc: params.metaDoc,
    sealed: true,
    createdAt: params.now,
  });
  enforceMax(stack);
  return stack;
};

/** Ends the current coalescing group so the next edit starts a new step. */
export const finalizeTop = (stack: UndoEntry[]): UndoEntry[] => {
  const top = stack[stack.length - 1];
  if (top && top.kind === 'patch') {
    top.sealed = true;
  }
  return stack;
};

const enforceMax = (stack: UndoEntry[]) => {
  while (stack.length > UNDO_STACK_MAX) {
    stack.shift();
  }
};
