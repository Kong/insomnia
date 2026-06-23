import { database, type UndoableOperation } from 'insomnia-data';
import React, { createContext, type FC, type PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRevalidator } from 'react-router';

import { emptyStacks, type FormStacks, recordOperation, type RequestSubTab, sealTop } from './editor-undo-stack';

export type { RequestSubTab } from './editor-undo-stack';

interface ActiveForm {
  requestId: string;
  subTab: RequestSubTab;
}

interface EditorUndoContextValue {
  /** The request pane reports which request + sub-tab is currently visible (the active "form"). */
  registerActiveForm: (requestId: string, subTab: RequestSubTab) => void;
  /** Ends the current coalescing group (called on blur and sub-tab change). */
  finalizeGroup: () => void;
  /**
   * Increments after an undo/redo write is revalidated. The request pane folds this into its editor
   * remount keys so uncontrolled OneLineEditors refresh to the reverted value.
   */
  undoRevision: number;
}

const noop = () => {};

const EditorUndoContext = createContext<EditorUndoContextValue>({
  registerActiveForm: noop,
  finalizeGroup: noop,
  undoRevision: 0,
});

/** True when focus is in a single-line editor (OneLineEditor) inside the request pane. */
const focusedInScopeSingleLineEditor = (): boolean => {
  const el = document.activeElement;
  return !!el && !!el.closest('.editor--single-line') && !!el.closest('[data-testid="request-pane"]');
};

/** When focus is in a multiline CodeMirror (body/scripts), return its instance so native undo can run. */
const focusedMultilineCodeMirror = (): { undo: () => void; redo: () => void } | null => {
  const el = document.activeElement;
  if (!el) {
    return null;
  }
  const codeMirror = el.closest('.CodeMirror');
  if (!codeMirror || codeMirror.closest('.editor--single-line')) {
    return null;
  }
  return (codeMirror as unknown as { CodeMirror?: { undo: () => void; redo: () => void } }).CodeMirror ?? null;
};

const formKeyOf = (form: ActiveForm) => `${form.requestId}::${form.subTab}`;

export const EditorUndoProvider: FC<PropsWithChildren> = ({ children }) => {
  const revalidator = useRevalidator();

  // One undo/redo stack pair per visible form (request + sub-tab). Refs: these never need to re-render.
  const stacksRef = useRef<Map<string, FormStacks>>(new Map());
  const activeFormRef = useRef<ActiveForm | null>(null);

  // Remount key for uncontrolled editors, bumped once an undo/redo write has been revalidated.
  const [undoRevision, setUndoRevision] = useState(0);
  const pendingBumpRef = useRef(false);
  useEffect(() => {
    if (revalidator.state === 'idle' && pendingBumpRef.current) {
      pendingBumpRef.current = false;
      setUndoRevision(revision => revision + 1);
    }
  }, [revalidator.state]);

  const stacksForActiveForm = useCallback((): FormStacks | null => {
    const form = activeFormRef.current;
    if (!form) {
      return null;
    }
    const key = formKeyOf(form);
    let stacks = stacksRef.current.get(key);
    if (!stacks) {
      stacks = emptyStacks();
      stacksRef.current.set(key, stacks);
    }
    return stacks;
  }, []);

  const applyOperation = useCallback(
    async (operation: UndoableOperation, direction: 'undo' | 'redo') => {
      const descriptor = direction === 'undo' ? operation.invert : operation.apply;
      pendingBumpRef.current = true;
      await database.applyUndoOperation(descriptor);
      // The write doesn't go through a route action, so revalidate manually to refresh the loader.
      revalidator.revalidate();
    },
    [revalidator],
  );

  const undo = useCallback(async () => {
    const stacks = stacksForActiveForm();
    const entry = stacks?.undo.pop();
    if (!stacks || !entry) {
      return;
    }
    await applyOperation(entry.operation, 'undo');
    stacks.redo.push(entry);
  }, [applyOperation, stacksForActiveForm]);

  const redo = useCallback(async () => {
    const stacks = stacksForActiveForm();
    const entry = stacks?.redo.pop();
    if (!stacks || !entry) {
      return;
    }
    await applyOperation(entry.operation, 'redo');
    stacks.undo.push(entry);
  }, [applyOperation, stacksForActiveForm]);

  // Record operations emitted by the data layer onto the active form's stack.
  useEffect(() => {
    const unsubscribe = window.main.on('db.operations', (_event, operations: UndoableOperation[]) => {
      const form = activeFormRef.current;
      if (!form) {
        return;
      }
      const stacks = stacksForActiveForm();
      if (!stacks) {
        return;
      }
      for (const operation of operations) {
        // Only field edits to the currently visible request participate; whole add/delete are ignored.
        if (operation.apply.kind !== 'update' || operation.apply.doc._id !== form.requestId) {
          continue;
        }
        recordOperation(stacks.undo, operation, Date.now());
        // A fresh user edit invalidates the redo timeline for this form.
        stacks.redo = [];
      }
    });
    return () => unsubscribe();
  }, [stacksForActiveForm]);

  // Keyboard: capture-phase so a single-line editor doesn't also self-undo. Only acts when focus is in
  // an in-scope single-line editor; multiline CodeMirror and native fields keep their own undo.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      const isUndo = mod && event.key.toLowerCase() === 'z' && !event.shiftKey;
      const isRedo = mod && ((event.key.toLowerCase() === 'z' && event.shiftKey) || event.key.toLowerCase() === 'y');
      if (!isUndo && !isRedo) {
        return;
      }
      if (!focusedInScopeSingleLineEditor()) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (isRedo) {
        redo();
      } else {
        undo();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [undo, redo]);

  // Edit-menu path (no accelerator, so it never competes with the keyboard handler above).
  useEffect(() => {
    const onMenu = (direction: 'undo' | 'redo') => () => {
      const codeMirror = focusedMultilineCodeMirror();
      if (codeMirror) {
        codeMirror[direction]();
        return;
      }
      if (focusedInScopeSingleLineEditor()) {
        if (direction === 'undo') {
          undo();
        } else {
          redo();
        }
      }
    };
    const unsubscribers = [window.main.on('app-undo', onMenu('undo')), window.main.on('app-redo', onMenu('redo'))];
    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [undo, redo]);

  const registerActiveForm = useCallback((requestId: string, subTab: RequestSubTab) => {
    activeFormRef.current = { requestId, subTab };
  }, []);

  const finalizeGroup = useCallback(() => {
    const stacks = stacksForActiveForm();
    if (stacks) {
      sealTop(stacks.undo);
    }
  }, [stacksForActiveForm]);

  return (
    <EditorUndoContext.Provider value={{ registerActiveForm, finalizeGroup, undoRevision }}>
      {children}
    </EditorUndoContext.Provider>
  );
};

export const useEditorUndoContext = () => useContext(EditorUndoContext);
