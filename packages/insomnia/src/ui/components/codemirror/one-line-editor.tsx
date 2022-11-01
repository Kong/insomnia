import React, { forwardRef, Fragment, useImperativeHandle, useRef } from 'react';

import { CodeInput, CodeInputHandle } from './code-input';

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
  const codeInputRef = useRef<CodeInputHandle>(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      codeInputRef.current && !codeInputRef.current.hasFocus() && codeInputRef.current?.focus();
    },
    focusEnd: () => {
      codeInputRef.current && !codeInputRef.current.hasFocus() && codeInputRef.current?.focusEnd();
    },
    selectAll: () => {
      codeInputRef.current?.selectAll();
    },
  }));

  return (
    <Fragment>
      <CodeInput
        ref={codeInputRef}
        id={id}
        type={type || 'text'}
        placeholder={placeholder}
        onPaste={onPaste}
        onKeyDown={event => onKeyDown?.(event, codeInputRef.current?.getValue())}
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
