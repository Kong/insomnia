import './base-imports';

import classnames from 'classnames';
import clone from 'clone';
import CodeMirror, { EditorConfiguration } from 'codemirror';
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { useMount, useUnmount } from 'react-use';

import { DEBOUNCE_MILLIS } from '../../../common/constants';
import * as misc from '../../../common/misc';
import { KeyCombination } from '../../../common/settings';
import { getTagDefinitions } from '../../../templating/index';
import { NunjucksParsedTag } from '../../../templating/utils';
import { useNunjucks } from '../../context/nunjucks/use-nunjucks';
import { useRootLoaderData } from '../../routes/root';
import { isKeyCombinationInRegistry } from '../settings/shortcuts';
export interface OneLineEditorProps {
  defaultValue: string;
  getAutocompleteConstants?: () => string[] | PromiseLike<string[]>;
  id: string;
  onChange: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent, value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  type?: string;
  onPaste?: (text: string) => void;
}

export interface OneLineEditorHandle {
  selectAll: () => void;
  focusEnd: () => void;
}
export const OneLineEditor = forwardRef<OneLineEditorHandle, OneLineEditorProps>(({
  defaultValue,
  getAutocompleteConstants,
  id,
  onChange,
  onKeyDown,
  placeholder,
  readOnly,
  type,
  onPaste,
}, ref) => {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const codeMirror = useRef<CodeMirror.EditorFromTextArea | null>(null);
  const {
    settings,
  } = useRootLoaderData();
  const { handleRender, handleGetRenderContext } = useNunjucks();

  useMount(() => {
    if (!textAreaRef.current) {
      return;
    }

    const transformEnums = (tagDef: NunjucksParsedTag): NunjucksParsedTag[] => {
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
        if (change.text[0].startsWith('curl')) {
          change.cancel();
          return;
        }
        // If we're in single-line mode, merge all changed lines into one
        change.update?.(change.from, change.to, [change.text.join('').replace(/\n/g, ' ')]);
      }
    });
    codeMirror.current.on('paste', (_, e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text/plain');
      // TODO: watch out for pasting urls that are curl<something>, e.g. curl.se would be picked up here without the space
      if (onPaste && text && text.startsWith('curl ')) {
        onPaste(text);
      }
    });

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
      const isAutoCompleteBinding = isKeyCombinationInRegistry(pressedKeyComb, {
        'showAutocomplete': settings.hotKeyRegistry.showAutocomplete,
      });
      // Stop the editor from handling global keyboard shortcuts except for the autocomplete binding
      const isShortcutButNotAutocomplete = isUserDefinedKeyboardShortcut && !isAutoCompleteBinding;
      // Should not capture escape in order to exit modals
      const isEscapeKey = event.code === 'Escape';
      if (isShortcutButNotAutocomplete) {
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

    codeMirror.current.on('blur', () => codeMirror.current?.getTextArea().parentElement?.removeAttribute('data-focused'));
    codeMirror.current.on('focus', () => codeMirror.current?.getTextArea().parentElement?.setAttribute('data-focused', 'on'));
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
  });
  useUnmount(() => {
    codeMirror.current?.toTextArea();
    codeMirror.current?.closeHintDropdown();
    codeMirror.current = null;
  });

  useEffect(() => {
    const fn = misc.debounce((doc: CodeMirror.Editor) => {
      if (onChange) {
        onChange(doc.getValue() || '');
      }
    }, DEBOUNCE_MILLIS);
    codeMirror.current?.on('changes', fn);
    return () => codeMirror.current?.off('changes', fn);
  }, [onChange]);

  useEffect(() => window.main.on('context-menu-command', (_, { key, tag }) =>
    id === key && codeMirror.current?.replaceSelection(tag)), [id]);

  useImperativeHandle(ref, () => ({
    selectAll: () => codeMirror.current?.setSelection({ line: 0, ch: 0 }, { line: codeMirror.current.lineCount(), ch: 0 }),
    focusEnd: () => {
      if (codeMirror.current && !codeMirror.current.hasFocus()) {
        codeMirror.current.focus();
      }
      codeMirror.current?.getDoc()?.setCursor(codeMirror.current.getDoc().lineCount(), 0);
    },
  }), []);

  return (
    <div
      className={classnames('editor--single-line', {
        editor: true,
        'editor--readonly': readOnly,
      })}
      data-editor-type={type || 'text'}
      data-testid="OneLineEditor"
      onContextMenu={event => {
        if (readOnly) {
          return;
        }
        event.preventDefault();
        window.main.showContextMenu({ key: id });
      }}
    >
      <div className="editor__container input editor--single-line">
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
OneLineEditor.displayName = 'OneLineEditor';
