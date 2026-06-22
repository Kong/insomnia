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
  const apply = (kind: 'undo' | 'redo') => {
    if (kind === 'undo') {
      undo();
    } else {
      redo();
    }
  };

  // Pointer path: the native Edit menu sends these via IPC (it has no accelerator, so it never
  // competes with the keyboard path below). A focused multiline editor still gets native undo;
  // a plain native field is left alone; otherwise drive the app stack.
  useEffect(() => {
    const onMenu = (kind: 'undo' | 'redo') => () => {
      const cm = focusedMultilineCodeMirror();
      if (cm) {
        cm[kind]();
      } else if (!focusedNativeEditable()) {
        apply(kind);
      }
    };
    const unsubscribers = [window.main.on('app-undo', onMenu('undo')), window.main.on('app-redo', onMenu('redo'))];
    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo, redo]);

  // Keyboard path: capture-phase so a single-line CodeMirror does not also self-undo. Multiline
  // editors and plain native fields keep their own native undo.
  const onKey = (kind: 'undo' | 'redo') => (event: KeyboardEvent) => {
    if (focusedMultilineCodeMirror() || focusedNativeEditable()) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    apply(kind);
  };
  useDocBodyKeyboardShortcuts({
    request_undo: onKey('undo'),
    request_redo: onKey('redo'),
  });
};

/** Renders nothing; registers the global undo/redo shortcuts. Must live inside `UndoProvider`. */
export const UndoKeyboardShortcuts = () => {
  useUndoKeyboardShortcuts();
  return null;
};
