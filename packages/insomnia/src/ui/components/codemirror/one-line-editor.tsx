import React, { forwardRef, Fragment, useImperativeHandle, useRef, useState } from 'react';

import { CodeEditor, CodeEditorHandle } from './code-editor';

interface Props {
  defaultValue: string;
  forceEditor?: boolean;
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
  forceEditor,
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

});
OneLineEditor.displayName = 'OneLineEditor';
