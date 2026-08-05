/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { dispatchEditorUndo } from './editor-undo';

// jsdom does not implement execCommand, so install a stub per test to observe
// the native-fallback path. Restore the original explicitly afterwards:
// vi.restoreAllMocks() cannot revert a direct property assignment, so leaving it
// would leak the stub into later tests and make the suite order-dependent.
const originalExecCommand = document.execCommand;
let execCommand: ReturnType<typeof vi.fn>;

beforeEach(() => {
  execCommand = vi.fn().mockReturnValue(true);
  document.execCommand = execCommand;
});

afterEach(() => {
  document.body.innerHTML = '';
  document.execCommand = originalExecCommand;
  vi.restoreAllMocks();
});

// Build a focused element inside a `.CodeMirror` wrapper carrying a fake CM
// instance, mirroring how CodeMirror attaches itself to the wrapper node.
const mountFocusedCodeMirror = () => {
  const wrapper = document.createElement('div');
  wrapper.className = 'CodeMirror';
  const input = document.createElement('textarea');
  wrapper.append(input);
  document.body.append(wrapper);
  input.focus();
  const cm = { undo: vi.fn(), redo: vi.fn() };
  (wrapper as unknown as { CodeMirror: typeof cm }).CodeMirror = cm;
  return cm;
};

describe('dispatchEditorUndo', () => {
  it('drives CodeMirror history when focus is inside a CodeMirror editor', () => {
    const cm = mountFocusedCodeMirror();

    dispatchEditorUndo('undo');
    dispatchEditorUndo('redo');

    expect(cm.undo).toHaveBeenCalledTimes(1);
    expect(cm.redo).toHaveBeenCalledTimes(1);
    // CodeMirror surfaces must not also trigger the native stack.
    expect(execCommand).not.toHaveBeenCalled();
  });

  it('falls back to the native edit command for plain inputs', () => {
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();

    dispatchEditorUndo('undo');
    dispatchEditorUndo('redo');

    expect(execCommand).toHaveBeenNthCalledWith(1, 'undo');
    expect(execCommand).toHaveBeenNthCalledWith(2, 'redo');
  });

  it('falls back to the native edit command when nothing is focused', () => {
    dispatchEditorUndo('undo');

    expect(execCommand).toHaveBeenCalledWith('undo');
  });
});
