import React, { forwardRef, Fragment, useImperativeHandle, useRef, useState } from 'react';

import { CodeEditor, CodeEditorHandle } from './code-editor';

const NUNJUCKS_REGEX = /({%|%}|{{|}})/;

interface Props {
  defaultValue: string;
  forceEditor?: boolean;
  forceInput?: boolean;
  getAutocompleteConstants?: () => string[] | PromiseLike<string[]>;
  id?: string;
  onChange?: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent | React.KeyboardEvent, value?: any) => void;
  onPaste?: (event: ClipboardEvent) => void;
  placeholder?: string;
  readOnly?: boolean;
  type?: string;
}

const mayContainNunjucks = (text: string) => {
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
  // NOTE: only used for some weird multiline paste logic
  getValue: () => string | undefined;
  getSelectionStart: () => void;
  getSelectionEnd: () => void;
}
export const OneLineEditor = forwardRef<OneLineEditorHandle, Props>(({
  defaultValue,
  forceEditor,
  forceInput,
  getAutocompleteConstants,
  id,
  onChange,
  onKeyDown,
  onPaste,
  placeholder,
  readOnly,
  type,
}, ref) => {
  const editorRef = useRef<CodeEditorHandle>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isEditor, setIsEditor] = useState(forceEditor || mayContainNunjucks(defaultValue));
  useImperativeHandle(ref, () => ({
    getValue: () => {
      if (isEditor) {
        return editorRef.current?.getValue();
      }
      return inputRef.current?.value;
    },
    getSelectionStart: () => {
      if (isEditor) {
        return editorRef.current?.getSelectionStart();
      }
      return inputRef.current?.selectionStart;
    },
    getSelectionEnd: () => {
      if (isEditor) {
        return editorRef.current?.getSelectionEnd();
      }
      return inputRef.current?.selectionEnd;
    },
    focus: () => {
      if (isEditor) {
        editorRef.current && !editorRef.current.hasFocus() && editorRef.current?.focus();
        return;
      }
      inputRef.current && inputRef.current !== document.activeElement && inputRef.current.focus();
    },
    focusEnd: () => {
      if (isEditor) {
        editorRef.current && !editorRef.current.hasFocus() && editorRef.current?.focusEnd();
        return;
      }
      if (inputRef.current && inputRef.current !== document.activeElement) {
        inputRef.current.value = inputRef.current.value;
        inputRef.current.focus();
      }
    },
    selectAll: () => {
      if (isEditor) {
        editorRef.current?.selectAll();
        return;
      }
      inputRef.current?.select();
    },
  }));

  const convertToEditorPreserveFocus = () => {
    if (!isEditor || forceInput || !inputRef.current) {
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
    setIsEditor(true);
  };

  const convertToInputIfNotFocused = () => {
    if (isEditor && !forceEditor && !editorRef.current?.hasFocus() && !mayContainNunjucks(editorRef.current?.getValue() || '')) {
      setIsEditor(false);
    }
  };
  if (isEditor) {
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
          id={id}
          singleLine
          ignoreEditorFontSettings
          enableNunjucks
          autoCloseBrackets={false}
          tabIndex={0}
          type={type || 'text'}
          placeholder={placeholder}
          onPaste={onPaste}
          onBlur={() => {
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
          }}
          onKeyDown={event => onKeyDown?.(event, editorRef.current?.getValue())}
          onFocus={() => editorRef.current?.setAttribute('data-focused', 'on')}
          onMouseLeave={convertToInputIfNotFocused}
          onChange={onChange}
          getAutocompleteConstants={getAutocompleteConstants}
          className="editor--single-line"
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
        style={{ width: '100%' }}
        placeholder={placeholder}
        defaultValue={defaultValue}
        disabled={readOnly}
        onBlur={() => inputRef.current?.removeAttribute('data-focused')}
        onChange={event => {
          convertToEditorPreserveFocus();
          onChange?.(event.target.value);
        }}
        onMouseEnter={convertToEditorPreserveFocus}
        onDragEnter={convertToEditorPreserveFocus}
        onPaste={e => onPaste?.(e.nativeEvent)}
        onFocus={() => inputRef.current?.setAttribute('data-focused', 'on')}
        onKeyDown={event => onKeyDown?.(event, event.currentTarget.value)}
      />
    );
  }
});
OneLineEditor.displayName = 'OneLineEditor';
