import type CodeMirror from 'codemirror';

// CodeMirror sets its instance on the `.CodeMirror` wrapper DOM node.
type CodeMirrorWrapper = HTMLElement & { CodeMirror?: CodeMirror.Editor };

/**
 * Single app-level undo/redo dispatcher.
 *
 * The Electron Edit menu used to expose `role: 'undo'`/`'redo'`, which call the
 * native `webContents.undo()/redo()`. Those only understand plain DOM inputs,
 * and on macOS the menu accelerator swallows Cmd+Z before CodeMirror's own
 * keymap can act on it — so CodeMirror surfaces had no working undo and the two
 * stacks (native vs. CodeMirror) competed. The menu now routes here instead, so
 * there is one place that decides which stack to drive based on what's focused:
 *
 * - focus inside a CodeMirror editor  → drive CodeMirror's own history
 * - anything else (plain input/textarea) → replay the browser's native edit
 *   command, exactly as the old `role` did.
 */
export const dispatchEditorUndo = (mode: 'undo' | 'redo'): void => {
  const active = document.activeElement as HTMLElement | null;
  const wrapper = active?.closest('.CodeMirror') as CodeMirrorWrapper | null;
  const cm = wrapper?.CodeMirror;
  if (cm) {
    cm[mode]();
    return;
  }
  // Plain inputs/textareas: execCommand is deprecated but remains the only API
  // that drives the focused element's native undo stack, which is what the
  // previous native menu role relied on.
  document.execCommand(mode);
};
