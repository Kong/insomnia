import classnames from 'classnames';
import React, { forwardRef, Fragment, useImperativeHandle, useRef, useState } from 'react';

import { CodeEditor, CodeEditorHandle, CodeEditorOnChange } from './code-editor';
const MODE_INPUT = 'input';
const MODE_EDITOR = 'editor';
const TYPE_TEXT = 'text';
const NUNJUCKS_REGEX = /({%|%}|{{|}})/;

interface Props {
  defaultValue: string;
  id?: string;
  type?: string;
  mode?: string;
  onBlur?: (event: FocusEvent | React.FocusEvent) => void;
  onKeyDown?: (event: KeyboardEvent | React.KeyboardEvent, value?: any) => void;
  onFocus?: (event: FocusEvent | React.FocusEvent) => void;
  onChange?: CodeEditorOnChange;
  onPaste?: (event: ClipboardEvent) => void;
  getAutocompleteConstants?: () => string[] | PromiseLike<string[]>;
  placeholder?: string;
  className?: string;
  forceEditor?: boolean;
  forceInput?: boolean;
  readOnly?: boolean;
  // TODO(TSCONVERSION) figure out why so many components pass this in yet it isn't used anywhere in this
  disabled?: boolean;
}

const _mayContainNunjucks = (text: string) => {
  // Not sure, but sometimes this isn't a string
  if (typeof text !== 'string') {
    return false;
  }
  // Does the string contain Nunjucks tags?
  return !!text.match(NUNJUCKS_REGEX);
};
export interface OneLineEditorHandle {
  focus: () => void;
  focusEnd: () => void;
  selectAll: () => void;
  getValue: () => string | undefined;
  getSelectionStart: () => void;
  getSelectionEnd: () => void;
}
export const OneLineEditor = forwardRef<OneLineEditorHandle, Props>(({
  id,
  defaultValue,
  className,
  onChange,
  placeholder,
  onBlur,
  onKeyDown,
  onPaste,
  onFocus,
  forceInput,
  forceEditor,
  readOnly,
  getAutocompleteConstants,
  mode: syntaxMode,
  type: originalType,
}, ref) => {
  const editorRef = useRef<CodeEditorHandle>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  let initMode;

  if (forceInput) {
    initMode = MODE_INPUT;
  } else if (forceEditor) {
    initMode = MODE_EDITOR;
  } else if (_mayContainNunjucks(defaultValue)) {
    initMode = MODE_EDITOR;
  } else {
    initMode = MODE_INPUT;
  }
  const [mode, setMode] = useState(initMode);
  useImperativeHandle(ref, () => ({
    getValue: () => {
      if (mode === MODE_EDITOR) {
        return editorRef.current?.getValue();
      }
      return inputRef.current?.value;
    },
    getSelectionStart: () => {
      if (mode === MODE_EDITOR) {
        return editorRef.current?.getSelectionStart();
      }
      return inputRef.current?.selectionStart;
    },
    getSelectionEnd: () => {
      if (mode === MODE_EDITOR) {
        return editorRef.current?.getSelectionEnd();
      }
      return inputRef.current?.selectionEnd;
    },
    focus: () => {
      if (mode === MODE_EDITOR) {
        editorRef.current && !editorRef.current.hasFocus() && editorRef.current?.focus();
        return;
      }
      inputRef.current && inputRef.current !== document.activeElement && inputRef.current.focus();
    },
    focusEnd: () => {
      if (mode === MODE_EDITOR) {
        editorRef.current && !editorRef.current.hasFocus() && editorRef.current?.focusEnd();
        return;
      }
      if (inputRef.current && inputRef.current !== document.activeElement) {
        inputRef.current.value = inputRef.current.value;
        inputRef.current.focus();
      }
    },
    selectAll: () => {
      if (mode === MODE_EDITOR) {
        editorRef.current?.selectAll();
        return;
      }
      inputRef.current?.select();
    },
  }));

  const convertToEditorPreserveFocus = () => {
    if (mode !== MODE_INPUT || forceInput) {
      return;
    }
    if (!inputRef.current) {
      return;
    }
    if (inputRef.current === document.activeElement) {
      const start = inputRef.current?.selectionStart;
      const end = inputRef.current?.selectionEnd;
      if (start === null || end === null) {
        return;
      }
      // Wait for the editor to swap and restore cursor position
      const check = () => {
        if (editorRef.current) {
          editorRef.current?.focus();
          editorRef.current?.setSelection(start, end, 0, 0);
        } else {
          setTimeout(check, 40);
        }
      };
      // Tell the component to show the editor
      setTimeout(check);
    }
    setMode(MODE_EDITOR);
  };

  const convertToInputIfNotFocused = () => {
    if (mode === MODE_INPUT || forceEditor) {
      return;
    }
    if (!editorRef.current || editorRef.current?.hasFocus()) {
      return;
    }
    if (_mayContainNunjucks(editorRef.current.getValue() || '')) {
      return;
    }
    setMode(MODE_INPUT);
  };
  const type = originalType || TYPE_TEXT;
  const showEditor = mode === MODE_EDITOR;

  if (showEditor) {
    return (
      <Fragment>
        <CodeEditor
          ref={editorRef}
          defaultTabBehavior
          hideLineNumbers
          hideScrollbars
          noMatchBrackets
          noStyleActiveLine
          noLint
          singleLine
          ignoreEditorFontSettings
          enableNunjucks
          autoCloseBrackets={false}
          tabIndex={0}
          id={id}
          type={type}
          mode={syntaxMode}
          placeholder={placeholder}
          onPaste={onPaste}
          onBlur={event => {
            // Editor was already removed from the DOM, so do nothing
            if (!editorRef.current) {
              return;
            }
            // Set focused state
            editorRef.current?.removeAttribute('data-focused');
            if (!forceEditor) {
              // Convert back to input sometime in the future.
              // NOTE: this was originally added because the input would disappear if
              // the user tabbed away very shortly after typing, but it's actually a pretty
              // good feature.
              setTimeout(() => {
                convertToInputIfNotFocused();
              }, 2000);
            }
            onBlur?.(event);
          }}
          onKeyDown={event => {
            // submit form if needed
            if (event.keyCode === 13) {
              // TODO: This can be NULL, or not an HTMLElement.
              let node = event.target as HTMLElement;
              for (let i = 0; i < 20 && node; i++) {
                if (node.tagName === 'FORM') {
                  node.dispatchEvent(new window.Event('submit'));
                  event.preventDefault();
                  event.stopPropagation();
                  break;
                }
                // TODO: This can be NULL.
                node = node.parentNode as HTMLElement;
              }
            }
            onKeyDown?.(event, editorRef.current?.getValue());
          }
          }
          onFocus={event => {
            // TODO: unclear why this is missing in TypeScript DOM.
            const focusedFromTabEvent = !!(event as any).sourceCapabilities;
            if (focusedFromTabEvent) {
              editorRef.current?.focusEnd();
            }
            if (!editorRef.current) {
              console.warn('Tried to focus editor when it was not mounted', this);
              return;
            }
            // Set focused state
            editorRef.current?.setAttribute('data-focused', 'on');
            onFocus?.(event);
          }}
          onMouseLeave={convertToInputIfNotFocused}
          onChange={onChange}
          getAutocompleteConstants={getAutocompleteConstants}
          className={classnames('editor--single-line', className)}
          defaultValue={defaultValue}
          readOnly={readOnly}
        />
      </Fragment>
    );
  } else {
    return (
      <input
        ref={inputRef}
        id={id}
        type={type}
        className={className}
        style={{
          // background: 'rgba(255, 0, 0, 0.05)', // For debugging
          width: '100%',
        }}
        placeholder={placeholder}
        defaultValue={defaultValue}
        disabled={readOnly}
        onBlur={event => {
          inputRef.current?.removeAttribute('data-focused');
          onBlur?.(event);
        }}
        onChange={event => {
          convertToEditorPreserveFocus();
          onChange?.(event.target.value);
        }}
        onMouseEnter={convertToEditorPreserveFocus}
        onDragEnter={convertToEditorPreserveFocus}
        onPaste={e => onPaste?.(e.nativeEvent)}
        onFocus={event => {
          // If we're focusing the whole thing, blur the input. This happens when
          // the user tabs to the field.
          if (!inputRef.current) {
            return;
          }
          const start = inputRef.current.selectionStart;
          const end = inputRef.current.selectionEnd;
          const focusedFromTabEvent = start === 0 && end === event.target.value.length;
          if (focusedFromTabEvent) {
            inputRef.current.value = inputRef.current.value;
            inputRef.current.focus();
            // Also convert to editor if we tabbed to it. Just in case the user
            // needs an editor
            convertToEditorPreserveFocus();
          }
          // Set focused state
          inputRef.current?.setAttribute('data-focused', 'on');
          // Also call the regular callback
          onFocus?.(event);
        }}
        onKeyDown={event => onKeyDown?.(event, event.currentTarget.value)}
      />
    );
  }
});
OneLineEditor.displayName = 'OneLineEditor';
