import type CodeMirror from 'codemirror';

// Persisted CodeMirror state, cached by a stable `uniquenessKey` so it survives
// editor remounts (when a parent changes its React `key`). Used by both
// CodeEditor and OneLineEditor. `history` is the undo/redo stack; the remaining
// fields are only populated by the richer multi-line CodeEditor.
export interface CachedEditorState {
  history: any;
  scroll?: CodeMirror.ScrollInfo;
  selections?: CodeMirror.Range[];
  cursor?: CodeMirror.Position;
  marks?: Partial<CodeMirror.MarkerRange>[];
}

// Bounded LRU. Keys can be ephemeral (e.g. one per key-value pair id, minted per
// row and never reused), so without a cap this would grow unboundedly for the
// lifetime of the renderer, each entry retaining a CodeMirror history stack.
// The cap only needs to cover editors that might remount roughly concurrently;
// a few dozen is plenty, 100 is comfortably safe.
const MAX_CACHED_EDITOR_STATES = 100;
// Map preserves insertion order, so the first key is the least-recently-used.
const editorStates = new Map<string, CachedEditorState>();

export const getCachedEditorState = (uniquenessKey: string): CachedEditorState | undefined => {
  const state = editorStates.get(uniquenessKey);
  if (state) {
    // mark as most-recently-used
    editorStates.delete(uniquenessKey);
    editorStates.set(uniquenessKey, state);
  }
  return state;
};

export const setCachedEditorState = (uniquenessKey: string, state: CachedEditorState): void => {
  // re-insert at the end so it counts as most-recently-used
  editorStates.delete(uniquenessKey);
  editorStates.set(uniquenessKey, state);
  while (editorStates.size > MAX_CACHED_EDITOR_STATES) {
    const lruKey = editorStates.keys().next().value;
    if (lruKey === undefined) {
      break;
    }
    editorStates.delete(lruKey);
  }
};
