import React, { forwardRef, Fragment, useImperativeHandle, useRef } from 'react';

import { CodeEditor, CodeEditorHandle } from './code-editor';

interface Props {
  defaultValue: string;
  getAutocompleteConstants?: () => string[] | PromiseLike<string[]>;
  id?: string;
  onChange?: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent | React.KeyboardEvent, value?: any) => void;
  onPaste?: (event: ClipboardEvent) => void;
  placeholder?: string;
  readOnly?: boolean;
  type?: string;
}

export interface OneLineEditorHandle {
  focus: () => void;
  focusEnd: () => void;
  selectAll: () => void;
}
export const OneLineEditor = forwardRef<OneLineEditorHandle, Props>(({
  defaultValue,
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

  useImperativeHandle(ref, () => ({
    focus: () => {
      editorRef.current && !editorRef.current.hasFocus() && editorRef.current?.focus();
    },
    focusEnd: () => {
      editorRef.current && !editorRef.current.hasFocus() && editorRef.current?.focusEnd();
    },
    selectAll: () => {
      editorRef.current?.selectAll();
    },
  }));

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
        onKeyDown={event => onKeyDown?.(event, editorRef.current?.getValue())}
        onFocus={() => editorRef.current?.setAttribute('data-focused', 'on')}
        onChange={onChange}
        getAutocompleteConstants={getAutocompleteConstants}
        className="editor--single-line"
        defaultValue={defaultValue}
        readOnly={readOnly}
      />
    </Fragment>
  );

});
OneLineEditor.displayName = 'OneLineEditor';
