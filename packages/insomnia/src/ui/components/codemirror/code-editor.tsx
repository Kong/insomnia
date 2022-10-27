import './base-imports';

import classnames from 'classnames';
import clone from 'clone';
import CodeMirror, { CodeMirrorLinkClickCallback, EditorConfiguration, ShowHintOptions } from 'codemirror';
import { GraphQLInfoOptions } from 'codemirror-graphql/info';
import { ModifiedGraphQLJumpOptions } from 'codemirror-graphql/jump';
import deepEqual from 'deep-equal';
import { KeyCombination } from 'insomnia-common';
import { json as jsonPrettify } from 'insomnia-prettify';
import { query as queryXPath } from 'insomnia-xpath';
import { JSONPath } from 'jsonpath-plus';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useMount } from 'react-use';
import vkBeautify from 'vkbeautify';

import { DEBOUNCE_MILLIS, isMac } from '../../../common/constants';
import * as misc from '../../../common/misc';
import { getTagDefinitions } from '../../../templating/index';
import { NunjucksParsedTag } from '../../../templating/utils';
import { useGatedNunjucks } from '../../context/nunjucks/use-gated-nunjucks';
import { selectSettings } from '../../redux/selectors';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { createKeybindingsHandler, useDocBodyKeyboardShortcuts } from '../keydown-binder';
import { FilterHelpModal } from '../modals/filter-help-modal';
import { showModal } from '../modals/index';
import { isKeyCombinationInRegistry } from '../settings/shortcuts';
import { normalizeIrregularWhitespace } from './normalizeIrregularWhitespace';

const TAB_SIZE = 4;
const MAX_SIZE_FOR_LINTING = 1000000; // Around 1MB

interface EditorState {
  scroll: CodeMirror.ScrollInfo;
  selections: CodeMirror.Range[];
  cursor: CodeMirror.Position;
  history: any;
  marks: Partial<CodeMirror.MarkerRange>[];
}

export const shouldIndentWithTabs = ({ mode, indentWithTabs }: { mode?: string; indentWithTabs?: boolean }) => {
  // YAML is not valid when indented with Tabs
  const isYaml = mode?.includes('yaml') || false;
  // OpenAPI is not valid when indented with Tabs
  // TODO: OpenAPI in yaml is not valid with tabs, but in JSON is. Currently we do not differentiate and disable tabs regardless. INS-1390
  const isOpenAPI = mode === 'openapi';
  return indentWithTabs && !isYaml && !isOpenAPI;
};

const widget = (cm: CodeMirror.EditorFromTextArea | null, from: CodeMirror.Position, to: CodeMirror.Position) => {
  // Prevent retrieving an invalid content if undefined
  if (!from?.line || !to?.line) {
    return '\u2194';
  }
  const prevLine = cm?.getLine(from.line);
  if (!prevLine) {
    return '\u2194';
  }
  try {
    const squareBraceIsOutsideCurlyBrace = prevLine.lastIndexOf('[') > prevLine.lastIndexOf('{');
    const startToken = squareBraceIsOutsideCurlyBrace ? '[' : '{';
    const endToken = squareBraceIsOutsideCurlyBrace ? ']' : '}';
    const keys = Object.keys(JSON.parse(startToken + cm?.getRange(from, to) + endToken));
    return keys.length ? `\u21A4 ${keys.length} \u21A6` : '\u2194';
  } catch (error) {
    return '\u2194';
  }
};
// Global object used for storing and persisting editor scroll, lint and folding margin states
const editorStates: Record<string, EditorState> = {};

export interface CodeEditorProps {
  autoCloseBrackets?: boolean;
  autoPrettify?: boolean;
  className?: string;
  debounceMillis?: number;
  defaultTabBehavior?: boolean;
  defaultValue?: string;
  dynamicHeight?: boolean;
  enableNunjucks?: boolean;
  filter?: string;
  filterHistory?: string[];
  getAutocompleteConstants?: () => string[] | PromiseLike<string[]>;
  getAutocompleteSnippets?: () => CodeMirror.Snippet[];
  hideGutters?: boolean;
  hideLineNumbers?: boolean;
  hideScrollbars?: boolean;
  hintOptions?: ShowHintOptions;
  id?: string;
  ignoreEditorFontSettings?: boolean;
  infoOptions?: GraphQLInfoOptions;
  jumpOptions?: ModifiedGraphQLJumpOptions;
  lintOptions?: Record<string, any>;
  manualPrettify?: boolean;
  mode?: string;
  noLint?: boolean;
  noMatchBrackets?: boolean;
  noStyleActiveLine?: boolean;
  onBlur?: (event: FocusEvent) => void;
  onChange?: (value: string) => void;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  onClickLink?: CodeMirrorLinkClickCallback;
  onFocus?: (event: FocusEvent) => void;
  // NOTE: This is a hack to define keydown events on the Editor.
  onKeyDown?: (event: KeyboardEvent, value: string) => void;
  onMouseLeave?: React.MouseEventHandler<HTMLDivElement>;
  onPaste?: (event: ClipboardEvent) => void;
  placeholder?: string;
  raw?: boolean;
  readOnly?: boolean;
  singleLine?: boolean;
  style?: Object;
  tabIndex?: number;
  type?: string;
  // NOTE: for caching scroll and marks
  uniquenessKey?: string;
  updateFilter?: (filter: string) => void;
}

const normalizeMimeType = (mode?: string) => {
  const mimeType = mode ? mode.split(';')[0] : 'text/plain';
  if (mimeType.includes('graphql-variables')) {
    return 'graphql-variables';
  } else if (mimeType.includes('graphql')) {
    // Because graphQL plugin doesn't recognize application/graphql content-type
    return 'graphql';
  } else if (mimeType.includes('json')) {
    return 'application/json';
  } else if (mimeType.includes('clojure')) {
    return 'application/edn';
  } else if (mimeType.includes('xml')) {
    return 'application/xml';
  } else if (mimeType.includes('kotlin')) {
    return 'text/x-kotlin';
  } else if (mimeType.includes('yaml')) {
    // code-mirror doesn't recognize text/yaml or application/yaml
    // as a valid mime-type
    return 'yaml';
  } else {
    return mimeType;
  }
};
export interface CodeEditorHandle {
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
  cursorIndex: () => number | undefined;
  markText: (from: CodeMirror.Position, to: CodeMirror.Position, options: CodeMirror.TextMarkerOptions) => CodeMirror.TextMarker | undefined;
}
export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(({
  autoCloseBrackets,
  autoPrettify,
  className,
  debounceMillis,
  defaultTabBehavior,
  defaultValue,
  dynamicHeight,
  enableNunjucks,
  filter,
  filterHistory,
  getAutocompleteConstants,
  getAutocompleteSnippets,
  hideGutters,
  hideLineNumbers,
  hideScrollbars,
  hintOptions,
  id,
  ignoreEditorFontSettings,
  infoOptions,
  jumpOptions,
  lintOptions,
  manualPrettify,
  mode,
  noLint,
  noMatchBrackets,
  noStyleActiveLine,
  onBlur,
  onChange,
  onClick,
  onClickLink,
  onFocus,
  onKeyDown,
  onMouseLeave,
  onPaste,
  placeholder,
  raw,
  readOnly,
  singleLine,
  style,
  tabIndex,
  type,
  uniquenessKey,
  updateFilter,
}, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const codeMirror = useRef<CodeMirror.EditorFromTextArea | null>(null);
  const [originalCode, setOriginalCode] = useState('');
  const settings = useSelector(selectSettings);
  const indentSize = ignoreEditorFontSettings ? undefined : settings.editorIndentSize;
  const indentWithTabs = shouldIndentWithTabs({ mode, indentWithTabs: ignoreEditorFontSettings ? undefined : settings.editorIndentWithTabs });
  const indentChars = indentWithTabs ? '\t' : new Array((indentSize || TAB_SIZE) + 1).join(' ');
  const extraKeys = {
    'Ctrl-Q': (cm: CodeMirror.Editor) => cm.foldCode(cm.getCursor()),
    // HACK: So nothing conflicts withe the "Send Request" shortcut
    [isMac() ? 'Cmd-Enter' : 'Ctrl-Enter']: () => { },
    [isMac() ? 'Cmd-/' : 'Ctrl-/']: 'toggleComment',
    // Autocomplete
    'Ctrl-Space': 'autocomplete',
    // Change default find command from "find" to "findPersistent" so the
    // search box stays open after pressing Enter
    [isMac() ? 'Cmd-F' : 'Ctrl-F']: 'findPersistent',
    [isMac() ? 'Shift-Cmd--' : 'Shift-Ctrl--']: 'foldAll',
    [isMac() ? 'Shift-Cmd-=' : 'Shift-Ctrl-=']: 'unfoldAll',
    'Shift-Tab': 'indentLess',
    // Indent with tabs or spaces
    // From https://github.com/codemirror/CodeMirror/issues/988#issuecomment-14921785
    Tab: (cm: CodeMirror.Editor) => cm.somethingSelected() ? cm.indentSelection('add') : cm.replaceSelection(indentChars, 'end'),
  };
  const {
    handleRender,
    handleGetRenderContext,
  } = useGatedNunjucks({ disabled: !enableNunjucks });

  const prettifyAndSetValue = useCallback((code?: string, filter?: string) => {
    if (typeof code !== 'string') {
      console.warn('Code editor was passed non-string value', code);
      return;
    }
    setOriginalCode(code);
    if (autoPrettify) {
      if (mode?.includes('xml')) {
        if (updateFilter && filter) {
          try {
            const results = queryXPath(code, filter);
            code = `<result>${results.map(r => r.outer).join('\n')}</result>`;
          } catch (err) {
            code = `<error>${err.message}</error>`;
          }
        }
        try {
          code = vkBeautify.xml(code, indentChars);
        } catch (error) { }
      } else if (mode?.includes('json')) {
        try {
          let jsonString = code;
          if (updateFilter && filter) {
            try {
              const codeObj = JSON.parse(code);
              const results = JSONPath({ json: codeObj, path: filter.trim() });
              jsonString = JSON.stringify(results);
            } catch (err) {
              console.log('[jsonpath] Error: ', err);
              jsonString = '[]';
            }
          }
          code = jsonPrettify(jsonString, indentChars, autoPrettify);
        } catch (error) { }
      }
    }
    // this prevents codeMirror from needlessly setting the same thing repeatedly (which has the effect of moving the user's cursor and resetting the viewport scroll: a bad user experience)
    if (codeMirror.current?.getValue() !== code) {
      codeMirror.current?.setValue(code || '');
    }
  }, [autoPrettify, indentChars, mode, updateFilter]);

  useDocBodyKeyboardShortcuts({
    beautifyRequestBody: () => {
      if (mode?.includes('json') || mode?.includes('xml')) {
        prettifyAndSetValue(codeMirror.current?.getValue());
      }
    },
  });
  useEffect(() => codeMirror.current?.setOption('hintOptions', hintOptions), [hintOptions]);
  useEffect(() => codeMirror.current?.setOption('info', infoOptions), [infoOptions]);
  useEffect(() => codeMirror.current?.setOption('jump', jumpOptions), [jumpOptions]);
  useEffect(() => codeMirror.current?.setOption('lint', lintOptions), [lintOptions]);

  useMount(() => {
    if (!textAreaRef.current) {
      return;
    }

    const showGuttersAndLineNumbers = !hideGutters && !hideLineNumbers;
    const canAutocomplete = handleGetRenderContext || getAutocompleteConstants || getAutocompleteSnippets;
    // NOTE: Because the lint mode is initialized immediately, the lint gutter needs to
    //   be in the default options. DO NOT REMOVE THIS.
    const gutters = showGuttersAndLineNumbers ?
      ['CodeMirror-lint-markers', 'CodeMirror-linenumbers', 'CodeMirror-foldgutter']
      : ['CodeMirror-lint-markers'];

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

    const initialOptions: EditorConfiguration = {
      lineNumbers: showGuttersAndLineNumbers,
      placeholder: placeholder || '',
      foldGutter: showGuttersAndLineNumbers,
      autoRefresh: { delay: 2000 },
      lineWrapping: ignoreEditorFontSettings ? undefined : (settings.editorLineWrapping ?? true),
      scrollbarStyle: hideScrollbars ? 'null' : 'native',
      lint: !noLint && !readOnly,
      matchBrackets: !noMatchBrackets,
      autoCloseBrackets: autoCloseBrackets ?? true,
      tabSize: indentSize || TAB_SIZE,
      indentUnit: indentSize || TAB_SIZE,
      hintOptions,
      info: infoOptions,
      viewportMargin: dynamicHeight ? Infinity : 30,
      readOnly: !!readOnly,
      tabindex: typeof tabIndex === 'number' ? tabIndex : undefined,
      selectionPointer: 'default',
      jump: jumpOptions,
      styleActiveLine: !noStyleActiveLine,
      indentWithTabs,
      showCursorWhenSelecting: false,
      cursorScrollMargin: 12,
      // Only set keyMap if we're not read-only. This is so things like ctrl-a work on read-only mode.
      keyMap: !readOnly && settings.editorKeyMap ? settings.editorKeyMap : 'default',
      extraKeys: CodeMirror.normalizeKeyMap(extraKeys),
      gutters,
      foldOptions: { widget: (from: CodeMirror.Position, to: CodeMirror.Position) => widget(codeMirror.current, from, to) },
      mode: !handleRender ? normalizeMimeType(mode) : {
        name: 'nunjucks',
        baseMode: normalizeMimeType(mode),
      },
      environmentAutocomplete: canAutocomplete && {
        getVariables: async () => !handleGetRenderContext ? [] : (await handleGetRenderContext())?.keys || [],
        getTags: async () => !handleGetRenderContext ? [] : (await getTagDefinitions()).map(transformEnums).flat(),
        getConstants: getAutocompleteConstants,
        getSnippets: getAutocompleteSnippets,
        hotKeyRegistry: settings.hotKeyRegistry,
        autocompleteDelay: settings.autocompleteDelay,
      },
    };
    codeMirror.current = CodeMirror.fromTextArea(textAreaRef.current, initialOptions);
    codeMirror.current.on('beforeChange', (doc: CodeMirror.Editor, change: CodeMirror.EditorChangeCancellable) => {
      const isOneLineEditorWithChange = singleLine && change.text && change.text.length > 1;
      if (isOneLineEditorWithChange) {
        // If we're in single-line mode, merge all changed lines into one
        change.update?.(change.from, change.to, [change.text.join('').replace(/\n/g, ' ')]);
      }
      const isGraphqlWithChange = doc.getOption('mode') === 'graphql' && change.text.length > 0;
      if (isGraphqlWithChange) {
        // Don't allow non-breaking spaces because they break the GraphQL syntax
        change.update?.(change.from, change.to, change.text.map(normalizeIrregularWhitespace));
      }
    });
    const debounceTime = typeof debounceMillis === 'number' ? debounceMillis : DEBOUNCE_MILLIS;
    codeMirror.current.on('changes', misc.debounce(() => {
      if (onChange) {
        const value = codeMirror.current?.getDoc().getValue()?.trim() || '';
        // Disable linting if the document reaches a maximum size or is empty
        const withinLintingThresholds = value.length > 0 && value.length < MAX_SIZE_FOR_LINTING;
        const isLintPropOn = !noLint;
        const shouldLint = withinLintingThresholds && isLintPropOn;
        const lintOption = lintOptions || true;
        try {
          const newValue = shouldLint ? lintOption : false;
          if (!deepEqual(codeMirror.current?.getOption('lint'), newValue)) {
            codeMirror.current?.setOption('lint', newValue);
          }
        } catch (err) {
          console.log('Failed to set CodeMirror option', err.message);
        }
        onChange(codeMirror.current?.getDoc().getValue() || '');
        setOriginalCode(codeMirror.current?.getDoc().getValue() || '');
      }
    }, debounceTime));

    codeMirror.current.on('keydown', (doc: CodeMirror.Editor, event: KeyboardEvent) => {
      // Use default tab behaviour if we're told
      if (defaultTabBehavior && event.code === 'Tab') {
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
      const isCodeEditorAutoCompleteBinding = isKeyCombinationInRegistry(pressedKeyComb, {
        'showAutocomplete': settings.hotKeyRegistry.showAutocomplete,
      });
      const isEscapeKey = event.code === 'Escape';
      // Stop the editor from handling global keyboard shortcuts except for the autocomplete binding
      if (isUserDefinedKeyboardShortcut && !isCodeEditorAutoCompleteBinding) {
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
    codeMirror.current.on('keyup', (doc: CodeMirror.Editor, event: KeyboardEvent) => {
      // Enable graphql completion if we're in that mode
      if (doc.getOption('mode') === 'graphql') {
        // Only operate on one-letter keys. This will filter out
        // any special keys (Backspace, Enter, etc)
        const isModifier = event.metaKey || event.ctrlKey || event.altKey || event.key.length > 1;
        // You don't want to re-trigger the hint dropdown if it's already open
        // for other reasons, like forcing its display with Ctrl+Space
        const isDropdownActive = codeMirror.current?.isHintDropdownActive();
        if (!isModifier && !isDropdownActive) {
          doc.execCommand('autocomplete');
        }
      }
    });
    const persistState = () => {
      if (uniquenessKey && codeMirror.current) {
        editorStates[uniquenessKey] = {
          scroll: codeMirror.current.getScrollInfo(),
          selections: codeMirror.current.listSelections(),
          cursor: codeMirror.current.getCursor(),
          history: codeMirror.current.getHistory(),
          marks: codeMirror.current.getAllMarks()
            .filter(mark => mark.__isFold)
            .map((mark): Partial<CodeMirror.MarkerRange> => {
              const markerRange = mark.find();
              return markerRange && 'from' in markerRange ? markerRange : {
                from: undefined,
                to: undefined,
              };
            }),
        };
      }
    };
    codeMirror.current.on('blur', (_, e) => {
      persistState();
      onBlur?.(e);
    });
    codeMirror.current.on('scroll', persistState);
    codeMirror.current.on('fold', persistState);
    codeMirror.current.on('unfold', persistState);
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
    prettifyAndSetValue(defaultValue || '', filter);
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
    // Make URLs clickable
    if (onClickLink) {
      codeMirror.current?.makeLinksClickable(onClickLink);
    }
    // Restore the state
    if (uniquenessKey && editorStates.hasOwnProperty(uniquenessKey) && codeMirror.current) {
      const { scroll, selections, cursor, history, marks } = editorStates[uniquenessKey];
      codeMirror.current.scrollTo(scroll.left, scroll.top);
      codeMirror.current.setHistory(history);
      // NOTE: These won't be visible unless the editor is focused
      codeMirror.current.setCursor(cursor.line, cursor.ch, { scroll: false });
      codeMirror.current.setSelections(selections, undefined, { scroll: false });
      // Restore marks one-by-one
      for (const { from, to } of marks || []) {
        // @ts-expect-error -- type unsoundness
        codeMirror.current.foldCode(from, to);
      }
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
    cursorIndex: () => codeMirror.current?.indexFromPos(codeMirror.current.getCursor()),
    markText: (from: CodeMirror.Position, to: CodeMirror.Position, options: CodeMirror.TextMarkerOptions) => {
      return codeMirror.current?.getDoc().markText(from, to, options);
    },
  }), []);

  const showFilter = updateFilter && mode && (mode.includes('json') || mode.includes('xml'));
  const showPrettify = manualPrettify && mode?.includes('json') || mode?.includes('xml');

  return (
    <div
      className={classnames(className, {
        editor: true,
        'editor--dynamic-height': dynamicHeight,
        'editor--readonly': readOnly,
        'raw-editor': raw,
      })}
      style={style}
      data-editor-type={type}
      data-testid="CodeEditor"
    >
      <div
        className={classnames('editor__container', 'input', className)}
        style={ignoreEditorFontSettings ? {} : { fontSize: `${settings.editorFontSize}px` }}
        onClick={onClick}
        onMouseLeave={onMouseLeave}
      >
        <textarea
          id={id}
          ref={textAreaRef}
          style={{ display: 'none' }}
          readOnly={readOnly}
          autoComplete="off"
          defaultValue=""
        />
      </div>
      {
        showFilter || showPrettify ? (
          <div key={uniquenessKey} className="editor__toolbar">
            {showFilter ?
              (<input
                ref={inputRef}
                key="filter"
                type="text"
                title="Filter response body"
                defaultValue={filter || ''}
                placeholder={mode.includes('json') ? '$.store.books[*].author' : '/store/books/author'}
                onKeyDown={createKeybindingsHandler({
                  'Enter': () => {
                    const filter = inputRef.current?.value;
                    if (updateFilter) {
                      updateFilter(filter || '');
                    }
                    prettifyAndSetValue(originalCode, filter);
                  },
                })}
                onChange={e => {
                  if (e.target.value === '') {
                    if (updateFilter) {
                      updateFilter('');
                    }
                    prettifyAndSetValue(originalCode);
                  }
                }}
              />) : null}
            {showFilter && filterHistory?.length ?
              ((
                <Dropdown key="history" className="tall" right>
                  <DropdownButton className="btn btn--compact">
                    <i className="fa fa-clock-o" />
                  </DropdownButton>
                  {filterHistory.reverse().map(filter => (
                    <DropdownItem
                      key={filter}
                      onClick={() => {
                        if (inputRef.current) {
                          inputRef.current.value = filter;
                        }
                        if (updateFilter) {
                          updateFilter(filter);
                        }
                        prettifyAndSetValue(originalCode, filter);
                      }}
                    >
                      {filter}
                    </DropdownItem>
                  ))}
                </Dropdown>
              )) : null}
            {showFilter ?
              (<button key="help" className="btn btn--compact" onClick={() => showModal(FilterHelpModal, { isJSON: mode?.includes('json') })}>
                <i className="fa fa-question-circle" />
              </button>) : null}
            {showPrettify ?
              (<button
                key="prettify"
                className="btn btn--compact"
                title="Auto-format request body whitespace"
                onClick={() => {
                  if (mode?.includes('json') || mode?.includes('xml')) {
                    prettifyAndSetValue(codeMirror.current?.getValue());
                  }
                }}
              >
                Beautify {mode?.includes('json') ? 'JSON' : mode?.includes('xml') ? 'XML' : ''}
              </button>) : null}
          </div>
        ) : null
      }
    </div >
  );
});
CodeEditor.displayName = 'CodeEditor';
