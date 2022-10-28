import './base-imports';

import classnames from 'classnames';
import clone from 'clone';
import CodeMirror, { EditorConfiguration } from 'codemirror';
import { KeyCombination } from 'insomnia-common';
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useMount } from 'react-use';

import { DEBOUNCE_MILLIS } from '../../../common/constants';
import * as misc from '../../../common/misc';
import { getTagDefinitions } from '../../../templating/index';
import { NunjucksParsedTag } from '../../../templating/utils';
import { useNunjucks } from '../../context/nunjucks/use-nunjucks';
import { selectSettings } from '../../redux/selectors';
import { isKeyCombinationInRegistry } from '../settings/shortcuts';

export interface CodeInputProps {
  className: string;
  defaultValue: string;
  getAutocompleteConstants?: () => string[] | PromiseLike<string[]>;
  id?: string;
  onBlur: (event: FocusEvent) => void;
  onChange?: (value: string) => void;
  onFocus: (event: FocusEvent) => void;
  onKeyDown: (event: KeyboardEvent, value: string) => void;
  onPaste?: (event: ClipboardEvent) => void;
  placeholder?: string;
  readOnly?: boolean;
  type: string;
}

export interface CodeInputHandle {
  setValue: (value: string) => void;
  getValue: () => string;
  setCursor: (ch: number, line: number) => void;
  setSelection: (chStart: number, chEnd: number, lineStart: number, lineEnd: number) => void;
  scrollToSelection: (chStart: number, chEnd: number, lineStart: number, lineEnd: number) => void;
  getSelectionStart: () => void;
  getSelectionEnd: () => void;
  selectAll: () => void;
  focus: () => void;
  focusEnd: () => void;
  hasFocus: () => boolean;
  setAttribute: (name: string, value: string) => void;
  removeAttribute: (name: string) => void;
  getAttribute: (name: string) => void;
  clearSelection: () => void;
}
export const CodeInput = forwardRef<CodeInputHandle, CodeInputProps>(({
  className,
  defaultValue,
  getAutocompleteConstants,
  id,
  onBlur,
  onChange,
  onFocus,
  onKeyDown,
  onPaste,
  placeholder,
  readOnly,
  type,
}, ref) => {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const codeMirror = useRef<CodeMirror.EditorFromTextArea | null>(null);
  const settings = useSelector(selectSettings);
  const { handleRender, handleGetRenderContext } = useNunjucks();

  useMount(() => {
    if (!textAreaRef.current) {
      return;
    }

    const transformEnums = (
      tagDef: NunjucksParsedTag
    ): NunjucksParsedTag[] => {
      if (tagDef.args[0]?.type === 'enum') {
        return tagDef.args[0].options?.map(option => {
          const optionName = misc.fnOrString(option.displayName, tagDef.args);
          const newDef = clone(tagDef);
          newDef.displayName = `${tagDef.displayName} ⇒ ${optionName}`;
          newDef.args[0].defaultValue = option.value;

          return newDef;
        }) || [];
      }
      return [tagDef];
    };
    const canAutocomplete = !!(handleGetRenderContext || getAutocompleteConstants);
    const initialOptions: EditorConfiguration = {
      lineNumbers: false,
      placeholder: placeholder || '',
      foldGutter: false,
      autoRefresh: { delay: 2000 },
      lineWrapping: false,
      scrollbarStyle: 'null',
      lint: false,
      matchBrackets: false,
      autoCloseBrackets: false,
      viewportMargin: 30,
      readOnly: !!readOnly,
      tabindex: 0,
      selectionPointer: 'default',
      styleActiveLine: false,
      indentWithTabs: false,
      showCursorWhenSelecting: false,
      cursorScrollMargin: 12,
      // Only set keyMap if we're not read-only. This is so things like ctrl-a work on read-only mode.
      keyMap: !readOnly && settings.editorKeyMap ? settings.editorKeyMap : 'default',
      extraKeys: CodeMirror.normalizeKeyMap({
        'Ctrl-Space': 'autocomplete',
      }),
      gutters: [],
      mode: !handleRender ? 'text/plain' : {
        name: 'nunjucks',
        baseMode: 'text/plain',
      },
      environmentAutocomplete: canAutocomplete && {
        getVariables: async () => !handleGetRenderContext ? [] : (await handleGetRenderContext())?.keys || [],
        getTags: async () => !handleGetRenderContext ? [] : (await getTagDefinitions()).map(transformEnums).flat(),
        getConstants: getAutocompleteConstants,
        hotKeyRegistry: settings.hotKeyRegistry,
        autocompleteDelay: settings.autocompleteDelay,
      },
    };
    codeMirror.current = CodeMirror.fromTextArea(textAreaRef.current, initialOptions);
    codeMirror.current.on('beforeChange', (_: CodeMirror.Editor, change: CodeMirror.EditorChangeCancellable) => {
      const isPaste = change.text && change.text.length > 1;
      if (isPaste) {
        // If we're in single-line mode, merge all changed lines into one
        change.update?.(change.from, change.to, [change.text.join('').replace(/\n/g, ' ')]);
      }
    });
    codeMirror.current.on('changes', misc.debounce(() => {
      if (onChange) {
        onChange(codeMirror.current?.getDoc().getValue() || '');
      }
    }, DEBOUNCE_MILLIS));

    codeMirror.current.on('keydown', (doc: CodeMirror.Editor, event: KeyboardEvent) => {
      // Use default tab behaviour if we're told
      if (event.code === 'Tab') {
        // @ts-expect-error -- unsound property assignment
        event.codemirrorIgnore = true;
      }
      const pressedKeyComb: KeyCombination = {
        ctrl: event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
        meta: event.metaKey,
        keyCode: event.keyCode,
      };
      const isUserDefinedKeyboardShortcut = isKeyCombinationInRegistry(pressedKeyComb, settings.hotKeyRegistry);
      const isCodeInputAutoCompleteBinding = isKeyCombinationInRegistry(pressedKeyComb, {
        'showAutocomplete': settings.hotKeyRegistry.showAutocomplete,
      });
      const isEscapeKey = event.code === 'Escape';
      // Stop the editor from handling global keyboard shortcuts except for the autocomplete binding
      if (isUserDefinedKeyboardShortcut && !isCodeInputAutoCompleteBinding) {
        // @ts-expect-error -- unsound property assignment
        event.codemirrorIgnore = true;
        // Stop the editor from handling the escape key
      } else if (isEscapeKey) {
        // @ts-expect-error -- unsound property assignment
        event.codemirrorIgnore = true;
      } else {
        event.stopPropagation();
      }
      if (onKeyDown && !doc.isHintDropdownActive()) {
        onKeyDown(event, doc.getValue());
      }
    });

    codeMirror.current.on('blur', (_, e) => onBlur?.(e));
    codeMirror.current.on('focus', (_, e) => onFocus?.(e));
    codeMirror.current.on('paste', (_, e) => onPaste?.(e));
    codeMirror.current.on('keyHandled', (_: CodeMirror.Editor, _keyName: string, event: Event) => event.stopPropagation());
    // Prevent these things if we're type === "password"
    const preventDefault = (_: CodeMirror.Editor, event: Event) => type?.toLowerCase() === 'password' && event.preventDefault();
    codeMirror.current.on('copy', preventDefault);
    codeMirror.current.on('cut', preventDefault);
    codeMirror.current.on('dragstart', preventDefault);
    codeMirror.current.setCursor({ line: -1, ch: -1 });

    // Actually set the value
    codeMirror.current?.setValue(defaultValue || '');
    // Clear history so we can't undo the initial set
    codeMirror.current?.clearHistory();
    // Setup nunjucks listeners
    if (!readOnly && handleRender && !settings.nunjucksPowerUserMode) {
      codeMirror.current?.enableNunjucksTags(
        handleRender,
        handleGetRenderContext,
        settings.showVariableSourceAndValue,
      );
    }

    return () => {
      codeMirror.current?.toTextArea();
      codeMirror.current?.closeHintDropdown();
    };
  });

  useImperativeHandle(ref, () => ({
    setValue: value => codeMirror.current?.setValue(value),
    getValue: () => codeMirror.current?.getValue() || '',
    selectAll: () => codeMirror.current?.setSelection({ line: 0, ch: 0 }, { line: codeMirror.current.lineCount(), ch: 0 }),
    focus: () => codeMirror.current?.focus(),
    refresh: () => codeMirror.current?.refresh(),
    setCursor: (ch, line = 0) => {
      if (codeMirror.current && !codeMirror.current.hasFocus()) {
        codeMirror.current.focus();
      }
      codeMirror.current?.setCursor({ line, ch });
    },
    setSelection: (chStart: number, chEnd: number, lineStart: number, lineEnd: number) => {
      codeMirror.current?.setSelection({ line: lineStart, ch: chStart }, { line: lineEnd, ch: chEnd });
      codeMirror.current?.scrollIntoView({ line: lineStart, ch: chStart });
    },
    scrollToSelection: (chStart: number, chEnd: number, lineStart: number, lineEnd: number) => {
      codeMirror.current?.setSelection({ line: lineStart, ch: chStart }, { line: lineEnd, ch: chEnd });
      // If sizing permits, position selection just above center
      codeMirror.current?.scrollIntoView({ line: lineStart, ch: chStart }, window.innerHeight / 2 - 100);
    },
    getSelectionStart: () => codeMirror.current?.listSelections()?.[0].anchor.ch || 0,
    getSelectionEnd: () => codeMirror.current?.listSelections()?.[0].head.ch || 0,
    focusEnd: () => {
      if (codeMirror.current && !codeMirror.current.hasFocus()) {
        codeMirror.current.focus();
      }
      codeMirror.current?.getDoc()?.setCursor(codeMirror.current.getDoc().lineCount(), 0);
    },
    hasFocus: () => codeMirror.current?.hasFocus() || false,
    setAttribute: (name: string, value: string) => codeMirror.current?.getTextArea().parentElement?.setAttribute(name, value),
    removeAttribute: (name: string) => codeMirror.current?.getTextArea().parentElement?.removeAttribute(name),
    getAttribute: (name: string) => codeMirror.current?.getTextArea().parentElement?.getAttribute(name),
    clearSelection: () => {
      if (codeMirror.current && !codeMirror.current?.isHintDropdownActive()) {
        codeMirror.current.setSelection({ line: -1, ch: -1 }, { line: -1, ch: -1 }, { scroll: false },);
      }
    },
  }), []);

  return (
    <div
      className={classnames(className, {
        editor: true,
        'editor--readonly': readOnly,
      })}
      data-editor-type={type}
      data-testid="CodeInput"
    >
      <div className={classnames('editor__container', 'input', className)}>
        <textarea
          id={id}
          ref={textAreaRef}
          style={{ display: 'none' }}
          readOnly={readOnly}
          autoComplete="off"
          defaultValue=""
        />
      </div>
    </div >
  );
});
CodeInput.displayName = 'CodeInput';
