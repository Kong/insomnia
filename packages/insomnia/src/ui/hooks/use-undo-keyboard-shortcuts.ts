import { useEffect } from 'react';

import { useDocBodyKeyboardShortcuts } from '~/ui/components/keydown-binder';
import { useUndoContext } from '~/ui/context/app/undo-context';

/**
 * Hybrid precedence: when focus is inside a multiline CodeMirror editor (request body / scripts)
 * its native char-by-char undo handles the keystroke. For single-line form fields
 * (OneLineEditor, marked with `editor--single-line`) and anywhere else, the global undo stack wins.
 */
const focusedMultilineCodeMirror = (): { undo: () => void; redo: () => void } | null => {
  const active = document.activeElement;
  if (!active) {
    return null;
  }
  const codeMirror = active.closest('.CodeMirror');
  if (!codeMirror || codeMirror.closest('.editor--single-line')) {
    return null;
  }
  // CodeMirror attaches the editor instance to its wrapper DOM node.
  return (codeMirror as unknown as { CodeMirror?: { undo: () => void; redo: () => void } }).CodeMirror ?? null;
};

/**
 * True when focus is in a plain native editable field where the user is deliberately typing and
 * expects browser-native undo — a non-CodeMirror `<input>` (sidebar rename, search, settings) or a
 * contenteditable. The global request undo stack must NOT hijack Cmd+Z there.
 *
 * Plain `<textarea>` is intentionally NOT guarded: the only always-mounted one is the empty-collection
 * "first request" view, which auto-focuses and would otherwise swallow Cmd+Z right after deleting the
 * last request (blocking delete-restore). Request form fields (URL bar, key/value rows) are
 * OneLineEditor instances inside a `.CodeMirror` wrapper, so they also fall through to the app stack.
 */
const focusedNativeEditable = (): boolean => {
  const active = document.activeElement as HTMLElement | null;
  if (!active || active.closest('.CodeMirror')) {
    return false;
  }
  return active.tagName === 'INPUT' || active.isContentEditable;
};

export const useUndoKeyboardShortcuts = () => {
  const { undo, redo } = useUndoContext();

  // Pointer path: the native Edit menu sends these (it has no accelerator, so it never
  // competes with the keyboard path below).
  useEffect(() => {
    const offUndo = window.main.on('app-undo', () => {
      const cm = focusedMultilineCodeMirror();
      if (cm) {
        cm.undo();
      } else if (!focusedNativeEditable()) {
        undo();
      }
    });
    const offRedo = window.main.on('app-redo', () => {
      const cm = focusedMultilineCodeMirror();
      if (cm) {
        cm.redo();
      } else if (!focusedNativeEditable()) {
        redo();
      }
    });
    return () => {
      offUndo();
      offRedo();
    };
  }, [undo, redo]);

  // Keyboard path: capture-phase so single-line CodeMirror does not also self-undo.
  useDocBodyKeyboardShortcuts({
    request_undo: event => {
      // Multiline editors and plain native fields keep their own native undo.
      if (focusedMultilineCodeMirror() || focusedNativeEditable()) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      undo();
    },
    request_redo: event => {
      if (focusedMultilineCodeMirror() || focusedNativeEditable()) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      redo();
    },
  });
};

/** Renders nothing; registers the global undo/redo shortcuts. Must live inside `UndoProvider`. */
export const UndoKeyboardShortcuts = () => {
  useUndoKeyboardShortcuts();
  return null;
};
