import classnames from 'classnames';
import React, { forwardRef, Fragment, useImperativeHandle, useRef, useState } from 'react';

import { CodeEditor, CodeEditorHandle, CodeEditorOnChange } from './code-editor';

const NUNJUCKS_REGEX = /({%|%}|{{|}})/;

interface Props {
  defaultValue: string;
  id?: string;
  type?: string;
  mode?: string;
  onKeyDown?: (event: KeyboardEvent | React.KeyboardEvent, value?: any) => void;
  onChange?: CodeEditorOnChange;
  onPaste?: (event: ClipboardEvent) => void;
  getAutocompleteConstants?: () => string[] | PromiseLike<string[]>;
  placeholder?: string;
  className?: string;
  forceEditor?: boolean;
  forceInput?: boolean;
  readOnly?: boolean;
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
  onKeyDown,
  onPaste,
  forceInput,
  forceEditor,
  readOnly,
  getAutocompleteConstants,
  mode,
  type,
}, ref) => {
  const editorRef = useRef<CodeEditorHandle>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isEditor, setIsEditor] = useState(forceEditor || _mayContainNunjucks(defaultValue));
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
    if (!isEditor || forceInput) {
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
    setIsEditor(true);
  };

  const convertToInputIfNotFocused = () => {
    if (isEditor && !forceEditor && !editorRef.current?.hasFocus() && !_mayContainNunjucks(editorRef.current?.getValue() || '')) {
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
          singleLine
          ignoreEditorFontSettings
          enableNunjucks
          autoCloseBrackets={false}
          tabIndex={0}
          id={id}
          type={type || 'text'}
          mode={mode}
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
        onBlur={() => inputRef.current?.removeAttribute('data-focused')}
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
        }}
        onKeyDown={event => onKeyDown?.(event, event.currentTarget.value)}
      />
    );
  }
});
OneLineEditor.displayName = 'OneLineEditor';
