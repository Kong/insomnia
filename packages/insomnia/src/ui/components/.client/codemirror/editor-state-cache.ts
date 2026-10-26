import type CodeMirror from 'codemirror';

// Persisted CodeMirror state, cached by a stable `historyKey` so it survives
// editor remounts (when a parent changes its React `key`). Used by both
// CodeEditor and OneLineEditor. `history` is the undo/redo stack; the remaining
// fields are only populated by the richer multi-line CodeEditor.
export interface CachedEditorState {
  history: any;
  // The editor content at unmount, plus the `defaultValue` baseline it was cached
  // against. On remount the value + history are only reused when the current
  // `defaultValue` still equals `valueSeed` — i.e. the model has NOT changed
  // externally since. This keeps content consistent with the restored history when
  // `defaultValue` merely lags (markdown write<->preview toggle), while letting a
  // genuinely-updated model win (e.g. a pre-request script or sync changed the
  // environment/response between two mounts sharing a historyKey).
  value?: string;
  valueSeed?: string;
  scroll?: CodeMirror.ScrollInfo;
  selections?: CodeMirror.Range[];
  cursor?: CodeMirror.Position;
  marks?: Partial<CodeMirror.MarkerRange>[];
}

// The cache is primarily bounded by lifecycle purging (see purgeCachedEditorStates):
// entries are dropped when their owning tab closes or their key-value row is
// deleted, so it tracks live editors rather than growing forever. The LRU cap
// below is only a safety backstop for entries no lifecycle event reaches. It must
// be high enough that a single param/header-heavy request — which alone can mint a
// few hundred keys (three per key-value row) — never evicts its own editors, and
// that switching between several open tabs never evicts a still-open tab's undo
// history. Each entry is a small CodeMirror history snapshot.
const MAX_CACHED_EDITOR_STATES = 2000;
// Map preserves insertion order, so the first key is the least-recently-used.
const editorStates = new Map<string, CachedEditorState>();

export const getCachedEditorState = (historyKey: string): CachedEditorState | undefined => {
  const state = editorStates.get(historyKey);
  if (state) {
    // mark as most-recently-used
    editorStates.delete(historyKey);
    editorStates.set(historyKey, state);
  }
  return state;
};

export const setCachedEditorState = (historyKey: string, state: CachedEditorState): void => {
  // re-insert at the end so it counts as most-recently-used
  editorStates.delete(historyKey);
  editorStates.set(historyKey, state);
  while (editorStates.size > MAX_CACHED_EDITOR_STATES) {
    const lruKey = editorStates.keys().next().value;
    if (lruKey === undefined) {
      break;
    }
    editorStates.delete(lruKey);
  }
};

// Lifecycle purge: drop every cached entry whose historyKey matches `shouldPurge`.
// Used to reclaim history when the owning scope goes away — e.g. a closed tab
// (purge keys that embed the closed request id) or a deleted key-value row (purge
// that pair's keys) — so stale entries never accumulate or crowd out live editors.
// Returns the number of entries removed.
export const purgeCachedEditorStates = (shouldPurge: (historyKey: string) => boolean): number => {
  let purged = 0;
  for (const key of editorStates.keys()) {
    if (shouldPurge(key)) {
      editorStates.delete(key);
      purged++;
    }
  }
  return purged;
};
