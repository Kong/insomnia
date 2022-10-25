import './base-imports';

import classnames from 'classnames';
import clone from 'clone';
import CodeMirror, { CodeMirrorLinkClickCallback, ShowHintOptions } from 'codemirror';
import { GraphQLInfoOptions } from 'codemirror-graphql/info';
import { ModifiedGraphQLJumpOptions } from 'codemirror-graphql/jump';
import deepEqual from 'deep-equal';
import { KeyCombination } from 'insomnia-common';
import { json as jsonPrettify } from 'insomnia-prettify';
import { query as queryXPath } from 'insomnia-xpath';
import { JSONPath } from 'jsonpath-plus';
import React, { forwardRef, ReactNode, useImperativeHandle, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useMount, useUnmount } from 'react-use';
import vkBeautify from 'vkbeautify';

import {
  DEBOUNCE_MILLIS,
  isMac,
} from '../../../common/constants';
import * as misc from '../../../common/misc';
import { getTagDefinitions } from '../../../templating/index';
import { NunjucksParsedTag } from '../../../templating/utils';
import { useGatedNunjucks } from '../../context/nunjucks/use-gated-nunjucks';
import { selectSettings } from '../../redux/selectors';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { useDocBodyKeyboardShortcuts } from '../keydown-binder';
import { FilterHelpModal } from '../modals/filter-help-modal';
import { showModal } from '../modals/index';
import { isKeyCombinationInRegistry } from '../settings/shortcuts';
import { normalizeIrregularWhitespace } from './normalizeIrregularWhitespace';
import { shouldIndentWithTabs } from './should-indent-with-tabs';

const TAB_SIZE = 4;
const MAX_SIZE_FOR_LINTING = 1000000; // Around 1MB

interface EditorState {
  scroll: CodeMirror.ScrollInfo;
  selections: CodeMirror.Range[];
  cursor: CodeMirror.Position;
  history: any;
  marks: Partial<CodeMirror.MarkerRange>[];
}
const extraKeys = {
  'Ctrl-Q': (cm: CodeMirror.Editor) => cm.foldCode(cm.getCursor()),
  [isMac() ? 'Cmd-Enter' : 'Ctrl-Enter']: function() {
    // HACK: So nothing conflicts withe the "Send Request" shortcut
  },
  [isMac() ? 'Cmd-/' : 'Ctrl-/']: 'toggleComment',
  // Autocomplete
  'Ctrl-Space': 'autocomplete',
  // Change default find command from "find" to "findPersistent" so the
  // search box stays open after pressing Enter
  [isMac() ? 'Cmd-F' : 'Ctrl-F']: 'findPersistent',
  [isMac() ? 'Shift-Cmd--' : 'Shift-Ctrl--']: 'foldAll',
  [isMac() ? 'Shift-Cmd-=' : 'Shift-Ctrl-=']: 'unfoldAll',
  'Shift-Tab': 'indentLess',
  Tab: 'indentMore',
};
// Global object used for storing and persisting editor states
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
  noDragDrop?: boolean;
  noLint?: boolean;
  noMatchBrackets?: boolean;
  noStyleActiveLine?: boolean;
  onBlur?: (event: FocusEvent) => void;
  onChange?: (value: string) => void;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  onClickLink?: CodeMirrorLinkClickCallback;
  onCodeMirrorInit?: (editor: CodeMirror.Editor) => void;
  onCursorActivity?: (cm: CodeMirror.Editor) => void;
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
  noDragDrop,
  noLint,
  noMatchBrackets,
  noStyleActiveLine,
  onBlur,
  onChange,
  onClick,
  onClickLink,
  onCodeMirrorInit,
  onCursorActivity,
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
  const [filter, setFilter] = useState('');
  const [originalCode, setOriginalCode] = useState('');
  const settings = useSelector(selectSettings);

  const {
    handleRender,
    handleGetRenderContext,
  } = useGatedNunjucks({ disabled: !enableNunjucks });

  useDocBodyKeyboardShortcuts({
    beautifyRequestBody: () => {
      const canPrettify = mode?.includes('json') || mode?.includes('xml');
      if (canPrettify) {
        const code = codeMirror.current?.getValue();
        codemirrorSetValue(code, canPrettify);
      }
    },
  });
  useMount(() => {
    codemirrorSetOptions();
  });
  useUnmount(() => {
    codeMirror.current?.toTextArea();
    codeMirror.current?.closeHintDropdown();
  });
  useMount(() => {
    if (!textAreaRef.current || codeMirror.current) {
      return;
    }
    codeMirror.current = CodeMirror.fromTextArea(textAreaRef.current, {
      lineNumbers: true,
      placeholder: 'Start Typing...',
      foldGutter: true,
      autoRefresh: { delay: 2000 },
      lineWrapping: true,
      scrollbarStyle: 'native',
      lint: true,
      matchBrackets: true,
      autoCloseBrackets: true,
      tabSize: TAB_SIZE,
      indentUnit: TAB_SIZE,
      hintOptions: undefined,
      dragDrop: true,
      viewportMargin: 30,
      // default 10
      selectionPointer: 'default',
      styleActiveLine: true,
      indentWithTabs: true,
      showCursorWhenSelecting: false,
      cursorScrollMargin: 12,
      // NOTE: This is px
      keyMap: 'default',
      extraKeys: CodeMirror.normalizeKeyMap(extraKeys),
      // NOTE: Because the lint mode is initialized immediately, the lint gutter needs to
      //   be in the default options. DO NOT REMOVE THIS.
      gutters: ['CodeMirror-lint-markers'],
      foldOptions: {
        widget: (from, to) => {
          // Prevent retrieving an invalid content if undefined
          if (!from?.line || !to?.line) {
            return '\u2194';
          }
          const prevLine = codeMirror.current?.getLine(from.line);
          if (!prevLine) {
            return '\u2194';
          }
          try {
            const squareBraceIsOutsideCurlyBrace = prevLine.lastIndexOf('[') > prevLine.lastIndexOf('{');
            const startToken = squareBraceIsOutsideCurlyBrace ? '[' : '{';
            const endToken = squareBraceIsOutsideCurlyBrace ? ']' : '}';
            const keys = Object.keys(JSON.parse(startToken + codeMirror.current?.getRange(from, to) + endToken));
            return keys.length ? `\u21A4 ${keys.length} \u21A6` : '\u2194';
          } catch (error) {
            return '\u2194';
          }
        },
      },
    });
    codeMirror.current.on('beforeChange', (doc: CodeMirror.Editor, change: CodeMirror.EditorChangeCancellable) => {
      if (singleLine && change.text && change.text.length > 1) {
        // If we're in single-line mode, merge all changed lines into one
        change.update?.(change.from, change.to, [change.text.join('').replace(/\n/g, ' ')]);
      }
      if (doc.getOption('mode') === 'graphql' && change.text.length > 0) {
        // Don't allow non-breaking spaces because they break the GraphQL syntax
        change.update?.(change.from, change.to, change.text.map(normalizeIrregularWhitespace));
      }
      // Suppress lint on empty doc or single space exists (default value)
      const hasValue = codeMirror.current?.getDoc().getValue()?.trim() === '';
      const lintOption = lintOptions || true;
      codemirrorSmartSetOption('lint', hasValue ? lintOption : false);
    });
    codeMirror.current.on('changes', misc.debounce(() => {
      if (onChange) {
        const value = codeMirror.current?.getDoc().getValue() || '';
        // Disable linting if the document reaches a maximum size or is empty
        const withinLintingThresholds = value.length > 0 && value.length < MAX_SIZE_FOR_LINTING;
        const isLintPropOn = !noLint;
        const shouldLint = withinLintingThresholds && isLintPropOn;
        const lintOption = lintOptions || true;
        codemirrorSmartSetOption('lint', shouldLint ? lintOption : false);
        onChange(codeMirror.current?.getDoc().getValue() || '');
      }
    }, typeof debounceMillis === 'number' ? debounceMillis : DEBOUNCE_MILLIS));

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
    codeMirror.current.setOption('extraKeys', {
      ...extraKeys,
      Tab: cm => {
        // Indent with tabs or spaces
        // From https://github.com/codemirror/CodeMirror/issues/988#issuecomment-14921785
        if (cm.somethingSelected()) {
          cm.indentSelection('add');
        } else {
          cm.replaceSelection(indentChars(), 'end');
        }
      },
    });
    // Set editor options
    codemirrorSetOptions();
    // Actually set the value
    codemirrorSetValue(defaultValue || '');
    // Clear history so we can't undo the initial set
    codeMirror.current?.clearHistory();
    // Setup nunjucks listeners
    // TODO: we shouldn't need to set setup nunjucks if we're in readonly mode
    if (handleRender && !settings.nunjucksPowerUserMode) {
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
    // HACK: Refresh because sometimes it renders too early and the scroll doesn't quite fit.
    setTimeout(() => codeMirror.current?.refresh(), 100);
    // Restore the state
    restoreState();
    if (onCodeMirrorInit) {
      onCodeMirrorInit(codeMirror.current);
    }
    // NOTE: Start listening to cursor after everything because it seems to fire
    // immediately for some reason
    codeMirror.current.on('cursorActivity', (instance: CodeMirror.Editor) => onCursorActivity?.(instance));
  });

  useImperativeHandle(ref, () => ({
    setValue: value => codeMirror.current?.setValue(value),
    getValue: () => codeMirror.current?.getValue() || '',
    selectAll: () => codeMirror.current?.setSelection({ line: 0, ch: 0 }, { line: codeMirror.current.lineCount(), ch: 0 }),
    focus: () => codeMirror.current?.focus(),
    refresh: () => codeMirror.current?.refresh(),
    setCursor: (ch, line = 0) => {
      if (codeMirror.current && !codeMirror.current.hasFocus()) {
        focus();
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
        focus();
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

  /**
   * Set option if it's different than in the current Codemirror instance
   */
  function codemirrorSmartSetOption<K extends keyof CodeMirror.EditorConfiguration>(key: K, value: CodeMirror.EditorConfiguration[K]) {
    const allowList = key === 'jump' || key === 'info' || key === 'lint' || key === 'hintOptions';
    // Use stringify here because these could be infinitely recursive due to GraphQL schemas
    const hasOptionChanged = allowList ? !deepEqual(value, codeMirror.current?.getOption(key)) : JSON.stringify(value) !== JSON.stringify(codeMirror.current?.getOption(key));
    if (hasOptionChanged) {
      // Set the option safely. When setting "lint", for example, it can throw an exception
      // and cause the editor to break.
      try {
        codeMirror.current?.setOption(key, value);
      } catch (err) {
        console.log('Failed to set CodeMirror option', err.message, { key, value });
      }
    }
  }

  /**
   * Sets options on the CodeMirror editor while also sanitizing them
   */
  const codemirrorSetOptions = async () => {
    const options: CodeMirror.EditorConfiguration = {
      readOnly: !!readOnly,
      placeholder: placeholder || '',
      mode: !handleRender ? normalizeMimeType(mode) : {
        name: 'nunjucks',
        baseMode: normalizeMimeType(mode),
      },
      tabindex: typeof tabIndex === 'number' ? tabIndex : undefined,
      dragDrop: !noDragDrop,
      scrollbarStyle: hideScrollbars ? 'null' : 'native',
      styleActiveLine: !noStyleActiveLine,
      lineNumbers: !hideGutters && !hideLineNumbers,
      foldGutter: !hideGutters && !hideLineNumbers,
      lineWrapping: ignoreEditorFontSettings ? undefined : settings.editorLineWrapping,
      indentWithTabs: shouldIndentWithTabs({ mode, indentWithTabs: ignoreEditorFontSettings ? undefined : settings.editorIndentWithTabs }),
      matchBrackets: !noMatchBrackets,
      lint: !noLint && !readOnly,
      gutters: [],
    };
    // Only set keyMap if we're not read-only. This is so things like
    // ctrl-a work on read-only mode.
    if (!readOnly && settings.editorKeyMap) {
      options.keyMap = settings.editorKeyMap;
    }
    const indentSize = ignoreEditorFontSettings ? undefined : settings.editorIndentSize;
    if (indentSize) {
      options.tabSize = indentSize;
      options.indentUnit = indentSize;
    }
    if (options.gutters && !hideGutters) {
      if (options.lint) {
        options.gutters.push('CodeMirror-lint-markers');
      }
      if (options.lineNumbers) {
        options.gutters.push('CodeMirror-linenumbers');
      }
    }
    if (!hideGutters && options.foldGutter) {
      options.gutters?.push('CodeMirror-foldgutter');
    }
    if (hintOptions) {
      options.hintOptions = hintOptions;
    }
    if (infoOptions) {
      options.info = infoOptions;
    }
    if (jumpOptions) {
      options.jump = jumpOptions;
    }
    if (lintOptions) {
      options.lint = lintOptions;
    }
    if (typeof autoCloseBrackets === 'boolean') {
      options.autoCloseBrackets = autoCloseBrackets;
    }
    // Setup the hint options
    if (handleGetRenderContext || getAutocompleteConstants || getAutocompleteSnippets) {
      options.environmentAutocomplete = {
        getVariables: async () => {
          if (!handleGetRenderContext) {
            return [];
          }
          const context = await handleGetRenderContext();
          const variables = context ? context.keys : [];
          return variables || [];
        },
        getTags: async () => {
          if (!handleGetRenderContext) {
            return [];
          }
          const expandedTags: NunjucksParsedTag[] = [];
          for (const tagDef of await getTagDefinitions()) {
            const firstArg = tagDef.args[0];
            if (!firstArg || firstArg.type !== 'enum') {
              expandedTags.push(tagDef);
              continue;
            }
            for (const option of firstArg.options || []) {
              const optionName = misc.fnOrString(option.displayName, tagDef.args);
              const newDef = clone(tagDef);
              newDef.displayName = `${tagDef.displayName} ⇒ ${optionName}`;
              newDef.args[0].defaultValue = option.value;
              expandedTags.push(newDef);
            }
          }
          return expandedTags;
        },
        getConstants: getAutocompleteConstants,
        getSnippets: getAutocompleteSnippets,
        hotKeyRegistry: settings.hotKeyRegistry,
        autocompleteDelay: settings.autocompleteDelay,
      };
    }
    if (dynamicHeight) {
      options.viewportMargin = Infinity;
    }
    // Strip of charset if there is one
    Object.keys(options).map(key =>
      codemirrorSmartSetOption(
        key as keyof CodeMirror.EditorConfiguration,
        options[key as keyof CodeMirror.EditorConfiguration]
      )
    );
  };
  const restoreState = () => {
    if (!uniquenessKey || !editorStates.hasOwnProperty(uniquenessKey) || !codeMirror.current) {
      return;
    }
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
  };
  const indentChars = () => codeMirror.current?.getOption('indentWithTabs')
    ? '\t'
    : new Array((codeMirror.current?.getOption?.('indentUnit') || 0) + 1).join(' ');

  /**
 * Sets the CodeMirror value without triggering the onChange event
 * @param code the code to set in the editor
 * @param forcePrettify
 */
  function codemirrorSetValue(code?: string, forcePrettify?: boolean) {
    if (typeof code !== 'string') {
      console.warn('Code editor was passed non-string value', code);
      return;
    }
    setOriginalCode(code);
    const shouldPrettify = forcePrettify || autoPrettify;
    const isJSONOrXML = mode?.includes('json') || mode?.includes('xml');
    if (shouldPrettify && isJSONOrXML) {
      if (mode?.includes('xml')) {
        if (updateFilter && filter) {
          try {
            const results = queryXPath(code, filter);
            code = `<result>${results.map(r => r.outer).join('\n')}</result>`;
          } catch (err) {
            // Failed to parse filter (that's ok)
            code = `<error>${err.message}</error>`;
          }
        }

        try {
          code = vkBeautify.xml(code, indentChars());
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
          code = jsonPrettify(jsonString, indentChars(), autoPrettify);
        } catch (error) { }
      } else {
        console.error('attempted to prettify in a mode that should not support prettifying');
      }
    }
    // this prevents codeMirror from needlessly setting the same thing repeatedly (which has the effect of moving the user's cursor and resetting the viewport scroll: a bad user experience)
    if (codeMirror.current?.getValue() !== code) {
      codeMirror.current?.setValue(code || '');
    }
  }
  const toolbarChildren: ReactNode[] = [];

  if (updateFilter && mode && (mode.includes('json') || mode.includes('xml'))) {
    toolbarChildren.push(
      <input
        ref={inputRef}
        key="filter"
        type="text"
        title="Filter response body"
        defaultValue={filter || ''}
        placeholder={mode.includes('json') ? '$.store.books[*].author' : '/store/books/author'}
        onChange={event => {
          const filter = event.target.value;
          setFilter(filter);
          codemirrorSetValue(originalCode);
          if (updateFilter) {
            updateFilter(filter);
          }
        }}
      />,
    );

    if (filterHistory && filterHistory.length) {
      toolbarChildren.push(
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
                setFilter(filter);
                codemirrorSetValue(originalCode);
                if (updateFilter) {
                  updateFilter(filter);
                }
              }}
            >
              {filter}
            </DropdownItem>
          ))}
        </Dropdown>,
      );
    }

    toolbarChildren.push(
      <button key="help" className="btn btn--compact" onClick={() => showModal(FilterHelpModal, { isJSON: mode?.includes('json') })}>
        <i className="fa fa-question-circle" />
      </button>,
    );
  }

  if (manualPrettify && mode && (mode.includes('json') || mode.includes('xml'))) {
    let contentTypeName = '';
    if (mode?.includes('json')) {
      contentTypeName = 'JSON';
    } else if (mode?.includes('xml')) {
      contentTypeName = 'XML';
    }
    toolbarChildren.push(
      <button
        key="prettify"
        className="btn btn--compact"
        title="Auto-format request body whitespace"
        onClick={() => {
          const canPrettify = mode && (mode.includes('json') || mode.includes('xml'));
          if (!canPrettify) {
            return;
          }
          codemirrorSetValue(codeMirror.current?.getValue(), canPrettify);
        }}
      >
        Beautify {contentTypeName}
      </button>
    );
  }
  const fontSize = ignoreEditorFontSettings ? undefined : settings.editorFontSize;
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
        style={{ fontSize: `${fontSize}px` }}
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
      {toolbarChildren.length ? (
        <div key={uniquenessKey} className="editor__toolbar">
          {toolbarChildren}
        </div>
      ) : null}
    </div>
  );
});
CodeEditor.displayName = 'CodeEditor';
