import type { UndoableOperation } from 'insomnia-data';

/** The request-pane sub-tabs an undo stack can belong to. The URL bar shares the active sub-tab's stack. */
export type RequestSubTab = 'params' | 'content-type' | 'auth' | 'headers' | 'scripts' | 'docs';

/** Maximum entries kept per form stack. Bounded so the in-memory history stays small. */
export const UNDO_STACK_MAX = 50;

/** Consecutive edits to the same field(s) within this window coalesce into a single undo step. */
export const COALESCE_MS = 700;

export interface UndoEntry {
  /** `apply` re-performs the edit (redo); `invert` reverses it (undo). */
  operation: UndoableOperation;
  /** The field names this edit changed, used to decide coalescing. */
  keys: string[];
  /** Signature of the array-valued changed fields; a change to it seals the entry (structural edit). */
  shape: string;
  /** Sealed entries never coalesce further (e.g. add/remove/reorder a row is its own atomic step). */
  sealed: boolean;
  createdAt: number;
}

export interface FormStacks {
  undo: UndoEntry[];
  redo: UndoEntry[];
}

export const emptyStacks = (): FormStacks => ({ undo: [], redo: [] });

/** A signature of the array-valued changed fields (ids/names in order), or "scalar" for non-arrays. */
export const shapeOf = (doc: Record<string, any> | undefined, keys: string[]): string =>
  keys
    .map(key => {
      const value = doc?.[key];
      if (Array.isArray(value)) {
        return value.map(item => item?.id ?? item?.name ?? '').join(',');
      }
      return 'scalar';
    })
    .join('|');

/**
 * Record an operation onto a form's undo stack, coalescing consecutive edits to the same field(s)
 * within {@link COALESCE_MS} into one step. Structural edits (where the array shape changes, e.g.
 * adding/removing a row) are sealed so later typing does not merge into them. Mutates `undo` in place
 * and reports whether it merged into the current step.
 */
export const recordOperation = (undo: UndoEntry[], operation: UndoableOperation, now: number): { merged: boolean } => {
  const keys = operation.keys ?? [];
  const afterShape = shapeOf(operation.apply.doc as Record<string, any>, keys);
  const beforeShape = shapeOf(operation.invert.doc as Record<string, any>, keys);
  const isStructural = afterShape !== beforeShape;

  const top = undo[undo.length - 1];
  const canMerge =
    !!top &&
    !top.sealed &&
    !isStructural &&
    keys.length > 0 &&
    top.keys.length === keys.length &&
    top.keys.every(key => keys.includes(key)) &&
    top.shape === afterShape &&
    now - top.createdAt < COALESCE_MS;

  if (canMerge) {
    // Keep the original `invert` (oldest before-state); advance `apply` to the newest after-state.
    top.operation = { apply: operation.apply, invert: top.operation.invert, keys };
    top.createdAt = now;
    return { merged: true };
  }

  undo.push({ operation, keys, shape: afterShape, sealed: isStructural, createdAt: now });
  while (undo.length > UNDO_STACK_MAX) {
    undo.shift();
  }
  return { merged: false };
};

/** Ends the current coalescing group so the next edit starts a fresh step. */
export const sealTop = (undo: UndoEntry[]): void => {
  const top = undo[undo.length - 1];
  if (top) {
    top.sealed = true;
  }
};
