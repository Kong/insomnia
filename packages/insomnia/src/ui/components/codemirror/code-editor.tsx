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
import React, { forwardRef, ReactNode, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
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

// Global object used for storing and persisting editor states
const editorStates: Record<string, EditorState> = {};
const BASE_CODEMIRROR_OPTIONS: CodeMirror.EditorConfiguration = {
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
  extraKeys: CodeMirror.normalizeKeyMap({
    'Ctrl-Q': function(cm) {
      cm.foldCode(cm.getCursor());
    },
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
  }),
  // NOTE: Because the lint mode is initialized immediately, the lint gutter needs to
  //   be in the default options. DO NOT REMOVE THIS.
  gutters: ['CodeMirror-lint-markers'],
};

export type CodeEditorOnChange = (value: string) => void;

export interface CodeEditorProps {
  onChange?: CodeEditorOnChange;
  onCursorActivity?: (cm: CodeMirror.Editor) => void;
  onFocus?: (event: FocusEvent) => void;
  onBlur?: (event: FocusEvent) => void;
  onClickLink?: CodeMirrorLinkClickCallback;
  // NOTE: This is a hack to define keydown events on the Editor.
  onKeyDown?: (event: KeyboardEvent, value: string) => void;
  onMouseLeave?: React.MouseEventHandler<HTMLDivElement>;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  onPaste?: (event: ClipboardEvent) => void;
  onCodeMirrorInit?: (editor: CodeMirror.Editor) => void;
  getAutocompleteConstants?: () => string[] | PromiseLike<string[]>;
  getAutocompleteSnippets?: () => CodeMirror.Snippet[];
  mode?: string;
  id?: string;
  placeholder?: string;
  hideLineNumbers?: boolean;
  hideGutters?: boolean;
  noMatchBrackets?: boolean;
  hideScrollbars?: boolean;
  defaultValue?: string;
  tabIndex?: number;
  autoPrettify?: boolean;
  manualPrettify?: boolean;
  noLint?: boolean;
  noDragDrop?: boolean;
  noStyleActiveLine?: boolean;
  className?: string;
  style?: Object;
  updateFilter?: (filter: string) => void;
  defaultTabBehavior?: boolean;
  readOnly?: boolean;
  type?: string;
  filter?: string;
  filterHistory?: string[];
  singleLine?: boolean;
  debounceMillis?: number;
  dynamicHeight?: boolean;
  autoCloseBrackets?: boolean;
  hintOptions?: ShowHintOptions;
  lintOptions?: any;
  infoOptions?: GraphQLInfoOptions;
  jumpOptions?: ModifiedGraphQLJumpOptions;
  uniquenessKey?: string;
  raw?: boolean;
  enableNunjucks?: boolean;
  ignoreEditorFontSettings?: boolean;
}

const _normalizeMode = (mode?: string) => {
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
export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>((props, ref) => {
  const {
    id,
    readOnly,
    mode,
    filterHistory,
    onMouseLeave,
    onClick,
    className,
    dynamicHeight,
    style,
    type,
    raw,
    updateFilter,
    manualPrettify,
    autoPrettify,
    uniquenessKey,
    defaultValue,
    onChange,
    lintOptions,
    ignoreEditorFontSettings,
    enableNunjucks,
  } = props;
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
      const canPrettify = mode && (mode.includes('json') || mode.includes('xml'));
      if (canPrettify) {
        const code = codeMirror.current?.getValue();
        _codemirrorSetValue(code, canPrettify);
      }
    },
  });

  useEffect(() => {
    _codemirrorSetOptions();

    // if (_uniquenessKey && _uniquenessKey !== _previousUniquenessKey) {
    //   _codemirrorSetValue(defaultValue);

    //   _restoreState();
    // }
    return () => {
      if (codeMirror.current) {
        codeMirror.current?.toTextArea();
        codeMirror.current?.closeHintDropdown();
      }
    };
  }, []);
  if (textAreaRef.current) {
    _handleInitTextarea(textAreaRef.current);
  }
  useImperativeHandle(ref, () => ({
    setValue: value => {
      if (codeMirror.current) {
        codeMirror.current?.setValue(value);
      }
    },
    getValue: () => {
      if (codeMirror.current) {
        return codeMirror.current?.getValue();
      }
      return '';
    },
    selectAll: () => {
      if (codeMirror.current) {
        codeMirror.current.setSelection({ line: 0, ch: 0 }, { line: codeMirror.current.lineCount(), ch: 0 });
      }
    },
    focus: () => {
      if (codeMirror.current) {
        codeMirror.current.focus();
      }
    },
    refresh: () => {
      if (codeMirror.current) {
        codeMirror.current.refresh();
      }
    },
    setCursor: (ch, line = 0) => {
      if (codeMirror.current) {
        if (!codeMirror.current.hasFocus()) {
          focus();
        }
        codeMirror.current.setCursor({ line, ch });
      }
    },
    setSelection: (chStart: number, chEnd: number, lineStart: number, lineEnd: number) => {
      if (codeMirror.current) {
        codeMirror.current.setSelection({ line: lineStart, ch: chStart }, { line: lineEnd, ch: chEnd },);
        codeMirror.current.scrollIntoView({ line: lineStart, ch: chStart });
      }
    },
    scrollToSelection: (chStart: number, chEnd: number, lineStart: number, lineEnd: number) => {
      const selectionFocusPos = window.innerHeight / 2 - 100;
      if (codeMirror.current) {
        codeMirror.current.setSelection({ line: lineStart, ch: chStart }, { line: lineEnd, ch: chEnd },);
        // If sizing permits, position selection just above center
        codeMirror.current.scrollIntoView({ line: lineStart, ch: chStart }, selectionFocusPos,);
      }
    },
    getSelectionStart: () => {
      if (!codeMirror.current) {
        return null;
      }
      const selections = codeMirror.current.listSelections();
      if (selections.length) {
        return selections[0].anchor.ch;
      } else {
        return 0;
      }
    },
    getSelectionEnd: () => {
      if (!codeMirror.current) {
        return null;
      }
      const selections = codeMirror.current.listSelections();
      if (selections.length) {
        return selections[0].head.ch;
      } else {
        return 0;
      }
    },
    focusEnd: () => {
      if (codeMirror.current) {
        if (!codeMirror.current.hasFocus()) {
          focus();
        }
        const doc = codeMirror.current.getDoc();
        doc.setCursor(doc.lineCount(), 0);
      }
    },
    hasFocus: () => {
      if (codeMirror.current) {
        return codeMirror.current.hasFocus();
      } else {
        return false;
      }
    },
    setAttribute: (name: string, value: string) => {
      if (codeMirror.current) {
        codeMirror.current.getTextArea().parentElement?.setAttribute(name, value);
      }
    },
    removeAttribute: (name: string) => {
      if (codeMirror.current) {
        codeMirror.current.getTextArea().parentElement?.removeAttribute(name);
      }
    },
    getAttribute: (name: string) => {
      if (codeMirror.current) {
        codeMirror.current.getTextArea().parentElement?.getAttribute(name);
      }
    },
    clearSelection: () => {
      if (codeMirror.current && !codeMirror.current?.isHintDropdownActive()) {
        codeMirror.current.setSelection({ line: -1, ch: -1 }, { line: -1, ch: -1 }, { scroll: false },);
      }
    },
  }), []);

  function _persistState() {
    if (!uniquenessKey || !codeMirror.current) {
      return;
    }

    const marks = codeMirror.current
      .getAllMarks()
      .filter(mark => mark.__isFold)
      .map((mark): Partial<CodeMirror.MarkerRange> => {
        const result = mark.find();
        if (result && 'from' in result) {
          return result;
        }

        return {
          from: undefined,
          to: undefined,
        };
      });

    editorStates[uniquenessKey] = {
      scroll: codeMirror.current.getScrollInfo(),
      selections: codeMirror.current.listSelections(),
      cursor: codeMirror.current.getCursor(),
      history: codeMirror.current.getHistory(),
      marks,
    };
  }
  /**
   * Set option if it's different than in the current Codemirror instance
   */
  function _codemirrorSmartSetOption<K extends keyof CodeMirror.EditorConfiguration>(key: K, value: CodeMirror.EditorConfiguration[K]) {
    const cm = codeMirror.current;
    let shouldSetOption = false;

    if (key === 'jump' || key === 'info' || key === 'lint' || key === 'hintOptions') {
      // Use stringify here because these could be infinitely recursive due to GraphQL
      // schemas
      shouldSetOption = JSON.stringify(value) !== JSON.stringify(cm?.getOption(key));
    } else if (!deepEqual(value, cm?.getOption(key))) {
      // Don't set the option if it hasn't changed
      shouldSetOption = true;
    }

    // Don't set the option if it hasn't changed
    if (!shouldSetOption) {
      return;
    }

    // Set the option safely. When setting "lint", for example, it can throw an exception
    // and cause the editor to break.
    try {
      cm?.setOption(key, value);
    } catch (err) {
      console.log('Failed to set CodeMirror option', err.message, {
        key,
        value,
      });
    }
  }
  function _handleInitTextarea(textarea: HTMLTextAreaElement) {
    if (!textarea) {
      // Not mounted
      return;
    }

    if (codeMirror.current) {
      // Already initialized
      return;
    }

    codeMirror.current = CodeMirror.fromTextArea(textarea, {
      ...BASE_CODEMIRROR_OPTIONS,
      foldOptions: {
        widget: (from, to) => {
          let count;
          // Get open / close token
          let startToken = '{';
          let endToken = '}';
          // Prevent retrieving an invalid content if undefined
          if (!from?.line || !to?.line) {
            return '\u2194';
          }
          const prevLine = codeMirror.current?.getLine(from.line);
          if (!prevLine) {
            return '\u2194';
          }
          if (prevLine.lastIndexOf('[') > prevLine.lastIndexOf('{')) {
            startToken = '[';
            endToken = ']';
          }
          // Get json content
          const internal = codeMirror.current?.getRange(from, to);
          const toParse = startToken + internal + endToken;
          // Get key count
          try {
            const parsed = JSON.parse(toParse);
            count = Object.keys(parsed).length;
          } catch (error) { }
          return count ? `\u21A4 ${count} \u21A6` : '\u2194';
        },
      },
    });
    // Set default listeners
    codeMirror.current.on('beforeChange', (doc: CodeMirror.Editor, change: CodeMirror.EditorChangeCancellable) => {
      const value = codeMirror.current?.getDoc().getValue();

      // If we're in single-line mode, merge all changed lines into one
      if (props.singleLine && change.text && change.text.length > 1) {
        const text = change.text
          .join('') // join all changed lines into one
          .replace(/\n/g, ' ');
        // Convert all whitespace to spaces
        change.update?.(change.from, change.to, [text]);
      }

      // Don't allow non-breaking spaces because they break the GraphQL syntax
      if (doc.getOption('mode') === 'graphql' && change.text.length > 0) {
        const text = change.text.map(normalizeIrregularWhitespace);

        change.update?.(change.from, change.to, text);
      }

      // Suppress lint on empty doc or single space exists (default value)
      if (value?.trim() === '') {
        _codemirrorSmartSetOption('lint', false);
      } else {
        _codemirrorSmartSetOption('lint', props.lintOptions || true);
      }
    });
    codeMirror.current.on('changes', misc.debounce(() => {
      if (!onChange) {
        return;
      }
      const value = codeMirror.current?.getDoc().getValue() || '';
      // Disable linting if the document reaches a maximum size or is empty
      const isOverMaxSize = value.length > MAX_SIZE_FOR_LINTING;
      const shouldLint = isOverMaxSize || value.length === 0 ? false : !props.noLint;
      const existingLint = codeMirror.current?.getOption('lint') || false;
      if (shouldLint !== existingLint) {
        const lint = shouldLint ? lintOptions || true : false;
        _codemirrorSmartSetOption('lint', lint);
      }
      onChange(value);
    }, typeof props.debounceMillis === 'number' ? props.debounceMillis : DEBOUNCE_MILLIS));

    codeMirror.current.on('keydown', (doc: CodeMirror.Editor, event: KeyboardEvent) => {
      // Use default tab behaviour if we're told
      if (props.defaultTabBehavior && event.code === 'Tab') {
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
      if (props.onKeyDown && !doc.isHintDropdownActive()) {
        props.onKeyDown(event, doc.getValue());
      }
    });
    codeMirror.current.on('keyup', (doc: CodeMirror.Editor, event: KeyboardEvent) => {
      // Enable graphql completion if we're in that mode
      if (doc.getOption('mode') === 'graphql') {
        // Only operate on one-letter keys. This will filter out
        // any special keys (Backspace, Enter, etc)
        if (event.metaKey || event.ctrlKey || event.altKey || event.key.length > 1) {
          return;
        }
        // if (_autocompleteDebounce !== null) {
        //   clearTimeout(_autocompleteDebounce);
        // }

        // You don't want to re-trigger the hint dropdown if it's already open
        // for other reasons, like forcing its display with Ctrl+Space
        if (codeMirror.current?.isHintDropdownActive()) {
          return;
        }
        // _autocompleteDebounce = setTimeout(() => {
        doc.execCommand('autocomplete');
        // }, 700);
      }
    });
    codeMirror.current.on('endCompletion', () => {
      // if (_autocompleteDebounce !== null) {
      //   clearTimeout(_autocompleteDebounce);
      // }
    });
    codeMirror.current.on('focus', (_, e) => props.onFocus?.(e));
    codeMirror.current.on('blur', (_, e) => {
      _persistState();
      props.onBlur?.(e);
    });
    codeMirror.current.on('paste', (_, e) => props.onPaste?.(e));
    codeMirror.current.on('scroll', _persistState);
    codeMirror.current.on('fold', _persistState);
    codeMirror.current.on('unfold', _persistState);
    codeMirror.current.on('keyHandled', (_codeMirror: CodeMirror.Editor, _keyName: string, event: Event) => {
      event.stopPropagation();
    });
    // Prevent these things if we're type === "password"
    codeMirror.current.on('copy', (_cm: CodeMirror.Editor, event: Event) => {
      if (type && type.toLowerCase() === 'password') {
        event.preventDefault();
      }
    });
    codeMirror.current.on('cut', (_cm: CodeMirror.Editor, event: Event) => {
      if (type && type.toLowerCase() === 'password') {
        event.preventDefault();
      }
    });
    codeMirror.current.on('dragstart', (_cm: CodeMirror.Editor, event: Event) => {
      if (type && type.toLowerCase() === 'password') {
        event.preventDefault();
      }
    });
    codeMirror.current.setCursor({
      line: -1,
      ch: -1,
    });

    let extraKeys = BASE_CODEMIRROR_OPTIONS.extraKeys;
    extraKeys = extraKeys && typeof extraKeys !== 'string' ? extraKeys : {};

    codeMirror.current.setOption('extraKeys', {
      ...extraKeys,
      Tab: cm => {
        // Indent with tabs or spaces
        // From https://github.com/codemirror/CodeMirror/issues/988#issuecomment-14921785
        if (cm.somethingSelected()) {
          cm.indentSelection('add');
        } else {
          cm.replaceSelection(_indentChars(), 'end');
        }
      },
    });

    // Set editor options
    _codemirrorSetOptions();

    const setup = () => {
      // Actually set the value
      _codemirrorSetValue(defaultValue || '');

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
      if (props.onClickLink) {
        codeMirror.current?.makeLinksClickable(props.onClickLink);
      }

      // HACK: Refresh because sometimes it renders too early and the scroll doesn't quite fit.
      setTimeout(() => {
        codeMirror.current?.refresh();
      }, 100);

      // Restore the state
      _restoreState();
    };

    // Do this a bit later for big values so we don't block the render process
    if (defaultValue && defaultValue.length > 10000) {
      setTimeout(setup, 100);
    } else {
      setup();
    }

    if (props.onCodeMirrorInit) {
      props.onCodeMirrorInit(codeMirror.current);
    }

    // NOTE: Start listening to cursor after everything because it seems to fire
    // immediately for some reason
    codeMirror.current.on('cursorActivity', (instance: CodeMirror.Editor) => {
      if (props.onCursorActivity) {
        props.onCursorActivity(instance);
      }
    });
  }
  /**
   * Sets options on the CodeMirror editor while also sanitizing them
   */
  async function _codemirrorSetOptions() {
    let normalisedMode: EditorConfiguration['mode'];

    if (handleRender) {
      normalisedMode = {
        name: 'nunjucks',
        baseMode: _normalizeMode(mode),
      };
    } else {
      // foo bar baz
      normalisedMode = _normalizeMode(mode);
    }

    const options: CodeMirror.EditorConfiguration = {
      readOnly: !!readOnly,
      placeholder: props.placeholder || '',
      mode: normalisedMode,
      tabindex: typeof props.tabIndex === 'number' ? props.tabIndex : undefined,
      dragDrop: !props.noDragDrop,
      scrollbarStyle: props.hideScrollbars ? 'null' : 'native',
      styleActiveLine: !props.noStyleActiveLine,
      lineNumbers: !props.hideGutters && !props.hideLineNumbers,
      foldGutter: !props.hideGutters && !props.hideLineNumbers,
      lineWrapping: ignoreEditorFontSettings ? undefined : settings.editorLineWrapping,
      indentWithTabs: shouldIndentWithTabs({ mode, indentWithTabs: ignoreEditorFontSettings ? undefined : settings.editorIndentWithTabs }),
      matchBrackets: !props.noMatchBrackets,
      lint: !props.noLint && !readOnly,
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
    if (options.gutters && !props.hideGutters) {
      if (options.lint) {
        options.gutters.push('CodeMirror-lint-markers');
      }
      if (options.lineNumbers) {
        options.gutters.push('CodeMirror-linenumbers');
      }
    }
    if (!props.hideGutters && options.foldGutter) {
      options.gutters?.push('CodeMirror-foldgutter');
    }
    if (props.hintOptions) {
      options.hintOptions = props.hintOptions;
    }
    if (props.infoOptions) {
      options.info = props.infoOptions;
    }
    if (props.jumpOptions) {
      options.jump = props.jumpOptions;
    }
    if (lintOptions) {
      options.lint = lintOptions;
    }
    if (typeof props.autoCloseBrackets === 'boolean') {
      options.autoCloseBrackets = props.autoCloseBrackets;
    }
    // Setup the hint options
    if (handleGetRenderContext || props.getAutocompleteConstants || props.getAutocompleteSnippets) {
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
        getConstants: props.getAutocompleteConstants,
        getSnippets: props.getAutocompleteSnippets,
        hotKeyRegistry: settings.hotKeyRegistry,
        autocompleteDelay: settings.autocompleteDelay,
      };
    }

    if (dynamicHeight) {
      options.viewportMargin = Infinity;
    }

    // Strip of charset if there is one
    Object.keys(options).map(key =>
      _codemirrorSmartSetOption(
        key as keyof CodeMirror.EditorConfiguration,
        options[key as keyof CodeMirror.EditorConfiguration]
      )
    );
  }
  function _restoreState() {
    if (uniquenessKey === undefined) {
      return;
    }
    if (!editorStates.hasOwnProperty(uniquenessKey)) {
      return;
    }
    if (!codeMirror.current) {
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
  }
  function _setFilter(filter = '') {
    setFilter(filter);
    _codemirrorSetValue(originalCode);
    if (updateFilter) {
      updateFilter(filter);
    }
  }
  const _indentChars = () => codeMirror.current?.getOption('indentWithTabs')
    ? '\t'
    : new Array((codeMirror.current?.getOption?.('indentUnit') || 0) + 1).join(' ');

  /**
 * Sets the CodeMirror value without triggering the onChange event
 * @param code the code to set in the editor
 * @param forcePrettify
 */
  function _codemirrorSetValue(code?: string, forcePrettify?: boolean) {
    if (typeof code !== 'string') {
      console.warn('Code editor was passed non-string value', code);
      return;
    }
    setOriginalCode(code);
    const shouldPrettify = forcePrettify || autoPrettify;
    const isJSONOrXML = mode && (mode.includes('json') || mode.includes('xml'));

    if (shouldPrettify && isJSONOrXML) {
      if (mode.includes('xml')) {
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
          code = vkBeautify.xml(code, _indentChars());
        } catch (error) {
          // Failed to parse so just return original
        }
      } else if (mode.includes('json')) {
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
          code = jsonPrettify(jsonString, _indentChars(), autoPrettify);
        } catch (error) {
          // That's Ok, just leave it
        }
      } else {
        console.error('attempted to prettify in a mode that should not support prettifying');
      }
    }

    // this prevents codeMirror from needlessly setting the same thing repeatedly (which has the effect of moving the user's cursor and resetting the viewport scroll: a bad user experience)
    const currentCode = codeMirror.current?.getValue();
    if (currentCode === code) {
      return;
    }

    codeMirror.current?.setValue(code || '');
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
        onChange={event => _setFilter(event.target.value)}
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
                _setFilter(filter);
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
          const code = codeMirror.current?.getValue();
          _codemirrorSetValue(code, canPrettify);
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
          style={{
            display: 'none',
          }}
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
