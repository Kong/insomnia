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

const editorStates: Record<string, CachedEditorState> = {};

export const getCachedEditorState = (uniquenessKey: string): CachedEditorState | undefined =>
  editorStates[uniquenessKey];

export const setCachedEditorState = (uniquenessKey: string, state: CachedEditorState): void => {
  editorStates[uniquenessKey] = state;
};
