import './base-imports';

import classnames from 'classnames';
import clone from 'clone';
import CodeMirror, { CodeMirrorLinkClickCallback, EditorConfiguration, ShowHintOptions } from 'codemirror';
import { GraphQLInfoOptions } from 'codemirror-graphql/info';
import { ModifiedGraphQLJumpOptions } from 'codemirror-graphql/jump';
import deepEqual from 'deep-equal';
import { JSONPath } from 'jsonpath-plus';
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useMount, useUnmount } from 'react-use';
import vkBeautify from 'vkbeautify';

import { DEBOUNCE_MILLIS, isMac } from '../../../common/constants';
import * as misc from '../../../common/misc';
import { KeyCombination } from '../../../common/settings';
import { getTagDefinitions } from '../../../templating/index';
import { NunjucksParsedTag } from '../../../templating/utils';
import { jsonPrettify } from '../../../utils/prettify/json';
import { queryXPath } from '../../../utils/xpath/query';
import { useGatedNunjucks } from '../../context/nunjucks/use-gated-nunjucks';
import { useRootLoaderData } from '../../routes/root';
import { Dropdown, DropdownButton, DropdownItem, ItemContent } from '../base/dropdown';
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
  autoPrettify?: boolean;
  className?: string;
  defaultValue?: string;
  dynamicHeight?: boolean;
  enableNunjucks?: boolean;
  filter?: string;
  filterHistory?: string[];
  getAutocompleteConstants?: () => string[] | PromiseLike<string[]>;
  getAutocompleteSnippets?: () => CodeMirror.Snippet[];
  hideGutters?: boolean;
  hideLineNumbers?: boolean;
  hintOptions?: ShowHintOptions;
  id: string;
  infoOptions?: GraphQLInfoOptions;
  jumpOptions?: ModifiedGraphQLJumpOptions;
  lintOptions?: Record<string, any>;
  showPrettifyButton?: boolean;
  mode?: string;
  noLint?: boolean;
  noMatchBrackets?: boolean;
  noStyleActiveLine?: boolean;
  // used only for saving env editor state
  onBlur?: () => void;
  onChange?: (value: string) => void;
  onClickLink?: CodeMirrorLinkClickCallback;
  pinToBottom?: boolean;
  placeholder?: string;
  readOnly?: boolean;
  style?: Object;
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
  scrollToSelection: (chStart: number, chEnd: number, lineStart: number, lineEnd: number) => void;
  selectAll: () => void;
  focus: () => void;
  focusEnd: () => void;
}
export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(({
  autoPrettify,
  className,
  defaultValue,
  dynamicHeight,
  enableNunjucks,
  filter,
  filterHistory,
  getAutocompleteConstants,
  getAutocompleteSnippets,
  hideGutters,
  hideLineNumbers,
  hintOptions,
  id,
  infoOptions,
  jumpOptions,
  lintOptions,
  showPrettifyButton,
  mode,
  noLint,
  noMatchBrackets,
  noStyleActiveLine,
  onBlur,
  onChange,
  onClickLink,
  pinToBottom,
  placeholder,
  readOnly,
  style,
  uniquenessKey,
  updateFilter,
}, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const codeMirror = useRef<CodeMirror.EditorFromTextArea | null>(null);
  const [originalCode, setOriginalCode] = useState('');
  const {
    settings,
  } = useRootLoaderData();
  const indentSize = settings.editorIndentSize;
  const indentWithTabs = shouldIndentWithTabs({ mode, indentWithTabs: settings.editorIndentWithTabs });
  const indentChars = indentWithTabs ? '\t' : new Array((indentSize || TAB_SIZE) + 1).join(' ');
  const extraKeys = {
    'Ctrl-Q': (cm: CodeMirror.Editor) => cm.foldCode(cm.getCursor()),
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
  const { handleRender, handleGetRenderContext } = useGatedNunjucks({ disabled: !enableNunjucks });
  const prettifyXML = (code: string, filter?: string) => {
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
      return vkBeautify.xml(code, indentChars);
    } catch (error) {
      // Failed to parse so just return original
      return code;
    }
  };
  const prettifyJSON = (code: string, filter?: string) => {
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
      return jsonPrettify(jsonString, indentChars, autoPrettify);
    } catch (error) {
      // That's Ok, just leave it
      return code;
    }
  };
  const maybePrettifyAndSetValue = (code?: string, forcePrettify?: boolean, filter?: string) => {
    if (typeof code !== 'string') {
      console.warn('Code editor was passed non-string value', code);
      return;
    }
    const shouldPrettify = forcePrettify || autoPrettify;
    if (shouldPrettify) {
      setOriginalCode(code);
      if (mode?.includes('xml')) {
        code = prettifyXML(code, filter);
      } else if (mode?.includes('json')) {
        code = prettifyJSON(code, filter);
      }
    }
    // this prevents codeMirror from needlessly setting the same thing repeatedly (which has the effect of moving the user's cursor and resetting the viewport scroll: a bad user experience)
    const currentCode = codeMirror.current?.getValue();
    if (currentCode === code) {
      return;
    }
    codeMirror.current?.setValue(code || '');
  };

  useDocBodyKeyboardShortcuts({
    beautifyRequestBody: () => {
      if (mode?.includes('json') || mode?.includes('xml')) {
        maybePrettifyAndSetValue(codeMirror.current?.getValue());
      }
    },
  });

  useMount(() => {
    if (!textAreaRef.current) {
      return;
    }

    const showGuttersAndLineNumbers = !hideGutters && !hideLineNumbers;

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

    const initialOptions: EditorConfiguration = {
      lineNumbers: showGuttersAndLineNumbers,
      placeholder: placeholder || '',
      foldGutter: showGuttersAndLineNumbers,
      autoRefresh: { delay: 2000 },
      lineWrapping: settings.editorLineWrapping ?? true,
      scrollbarStyle: 'native',
      lint: !noLint && !readOnly,
      matchBrackets: !noMatchBrackets,
      autoCloseBrackets: true,
      tabSize: indentSize || TAB_SIZE,
      indentUnit: indentSize || TAB_SIZE,
      hintOptions,
      info: infoOptions,
      viewportMargin: dynamicHeight ? Infinity : 30,
      readOnly: !!readOnly,
      selectionPointer: 'default',
      jump: jumpOptions,
      styleActiveLine: !noStyleActiveLine,
      indentWithTabs,
      showCursorWhenSelecting: false,
      cursorScrollMargin: 12,
      // Only set keyMap if we're not read-only. This is so things like ctrl-a work on read-only mode.
      keyMap: !readOnly && settings.editorKeyMap ? settings.editorKeyMap : 'default',
      extraKeys: CodeMirror.normalizeKeyMap(extraKeys),
      gutters: showGuttersAndLineNumbers ? ['CodeMirror-lint-markers', 'CodeMirror-linenumbers', 'CodeMirror-foldgutter'] : [],
      foldOptions: { widget: (from: CodeMirror.Position, to: CodeMirror.Position) => widget(codeMirror.current, from, to) },
      mode: !handleRender ? normalizeMimeType(mode) : { name: 'nunjucks', baseMode: normalizeMimeType(mode) },
      environmentAutocomplete: {
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
      const isGraphqlWithChange = doc.getOption('mode') === 'graphql' && change.text.length > 0;
      if (isGraphqlWithChange) {
        // Don't allow non-breaking spaces because they break the GraphQL syntax
        change.update?.(change.from, change.to, change.text.map(normalizeIrregularWhitespace));
      }
      if (pinToBottom) {
        const scrollInfo = doc.getScrollInfo();
        const scrollPosition = scrollInfo.height - scrollInfo.clientHeight;
        doc.scrollTo(0, scrollPosition);
      }
    });

    codeMirror.current.on('change', (doc: CodeMirror.Editor) => {
      if (pinToBottom) {
        const scrollInfo = doc.getScrollInfo();
        const scrollPosition = scrollInfo.height - scrollInfo.clientHeight;
        doc.scrollTo(0, scrollPosition);
      }
    });

    codeMirror.current.on('keydown', (doc: CodeMirror.Editor, event: KeyboardEvent) => {
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

        // Enable graphql completion if we're in that mode
        if (doc.getOption('mode') === 'graphql') {
          // Only operate on one-letter keys. This will filter out
          // any special keys (Backspace, Enter, etc)
          const isModifier = event.metaKey || event.ctrlKey || event.altKey || event.key.length > 1;
          // You don't want to re-trigger the hint dropdown if it's already open
          // for other reasons, like forcing its display with Ctrl+Space
          const isDropdownActive = codeMirror.current?.isHintDropdownActive();
          if ((isAutoCompleteBinding || !isModifier) && !isDropdownActive) {
            doc.execCommand('autocomplete');
          }
        }
      }
    });
    // NOTE: maybe we don't need this anymore?
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
    codeMirror.current.on('blur', () => {
      persistState();
      onBlur?.();
    });
    codeMirror.current.on('scroll', persistState);
    codeMirror.current.on('fold', persistState);
    codeMirror.current.on('unfold', persistState);
    codeMirror.current.on('keyHandled', (_: CodeMirror.Editor, _keyName: string, event: Event) => event.stopPropagation());
    codeMirror.current.setCursor({ line: -1, ch: -1 });

    // Actually set the value
    maybePrettifyAndSetValue(defaultValue || '', false, filter);
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
      codeMirror.current.makeLinksClickable(onClickLink);
    }
    // Restore the state
    if (uniquenessKey && editorStates[uniquenessKey]) {
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
  });
  useUnmount(() => {
    onBlur?.();
    codeMirror.current?.toTextArea();
    codeMirror.current?.closeHintDropdown();
    codeMirror.current = null;
  });

  useEffect(() => {
    const fn = misc.debounce((doc: CodeMirror.Editor) => {
      if (onChange) {
        const value = doc.getValue()?.trim() || '';
        // Disable linting if the document reaches a maximum size or is empty
        const withinLintingThresholds = value.length > 0 && value.length < MAX_SIZE_FOR_LINTING;
        const isLintPropOn = !noLint;
        const shouldLint = withinLintingThresholds && isLintPropOn;
        const lintOption = lintOptions || true;
        try {
          const newValue = shouldLint ? lintOption : false;
          if (!deepEqual(codeMirror.current?.getOption('lint'), newValue)) {
            tryToSetOption('lint', newValue);
          }
        } catch (err) {
          console.log('Failed to set CodeMirror option', err.message);
        }
        onChange(doc.getValue() || '');
        setOriginalCode(doc.getValue() || '');
      }
    }, DEBOUNCE_MILLIS);
    codeMirror.current?.on('changes', fn);
    return () => codeMirror.current?.off('changes', fn);
  }, [lintOptions, noLint, onChange]);

  useEffect(() => {
    const handleOnBlur = () => onBlur?.();
    codeMirror.current?.on('blur', handleOnBlur);
    return () => codeMirror.current?.on('blur', handleOnBlur);
  }, [onBlur]);

  const tryToSetOption = (key: keyof EditorConfiguration, value: any) => {
    try {
      codeMirror.current?.setOption(key, value);
    } catch (err) {
      console.log('Failed to set CodeMirror option', err.message, { key, value });
    }
  };
  useEffect(() => window.main.on('context-menu-command', (_, { key, tag }) =>
    id === key && codeMirror.current?.replaceSelection(tag)), [id]);
  useEffect(() => tryToSetOption('hintOptions', hintOptions), [hintOptions]);
  useEffect(() => tryToSetOption('info', infoOptions), [infoOptions]);
  useEffect(() => tryToSetOption('jump', jumpOptions), [jumpOptions]);
  useEffect(() => tryToSetOption('lint', lintOptions), [lintOptions]);
  useEffect(() => tryToSetOption('mode', !handleRender ? normalizeMimeType(mode) : { name: 'nunjucks', baseMode: normalizeMimeType(mode) }), [handleRender, mode]);

  useImperativeHandle(ref, () => ({
    setValue: value => codeMirror.current?.setValue(value),
    getValue: () => codeMirror.current?.getValue() || '',
    selectAll: () => codeMirror.current?.setSelection({ line: 0, ch: 0 }, { line: codeMirror.current.lineCount(), ch: 0 }),
    focus: () => codeMirror.current?.focus(),
    scrollToSelection: (chStart: number, chEnd: number, lineStart: number, lineEnd: number) => {
      codeMirror.current?.setSelection({ line: lineStart, ch: chStart }, { line: lineEnd, ch: chEnd });
      // If sizing permits, position selection just above center
      codeMirror.current?.scrollIntoView({ line: lineStart, ch: chStart }, window.innerHeight / 2 - 100);
    },
    focusEnd: () => {
      if (codeMirror.current && !codeMirror.current.hasFocus()) {
        codeMirror.current.focus();
      }
      codeMirror.current?.getDoc()?.setCursor(codeMirror.current.getDoc().lineCount(), 0);
    },
  }), []);

  const showFilter = readOnly && (mode?.includes('json') || mode?.includes('xml'));
  const showPrettify = showPrettifyButton && mode?.includes('json') || mode?.includes('xml');

  return (
    <div
      className={classnames(className, {
        editor: true,
        'editor--dynamic-height': dynamicHeight,
        'editor--readonly': readOnly,
      })}
      style={style}
      data-editor-type="text"
      data-testid="CodeEditor"
      onContextMenu={event => {
        if (readOnly) {
          return;
        }
        event.preventDefault();
        window.main.showContextMenu({ key: id });
      }}
    >
      <div
        className={classnames('editor__container', 'input', className)}
        style={{ fontSize: `${settings.editorFontSize}px` }}
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
                placeholder={mode?.includes('json') ? '$.store.books[*].author' : '/store/books/author'}
                onKeyDown={createKeybindingsHandler({
                  'Enter': () => {
                    const filter = inputRef.current?.value;
                    if (updateFilter) {
                      updateFilter(filter || '');
                    }
                    maybePrettifyAndSetValue(originalCode, false, filter);
                  },
                })}
                onChange={e => {
                  if (e.target.value === '') {
                    if (updateFilter) {
                      updateFilter('');
                    }
                    maybePrettifyAndSetValue(originalCode, false);
                  }
                }}
              />) : null}
            {showFilter && filterHistory?.length ?
              ((
                <Dropdown
                  aria-label='Filter History'
                  key="history"
                  className="tall"
                  triggerButton={
                    <DropdownButton className="btn btn--compact">
                      <i className="fa fa-clock-o" />
                    </DropdownButton>
                  }
                >
                  {filterHistory.reverse().map(filter => (
                    <DropdownItem
                      key={filter}
                      aria-label={filter}
                    >
                      <ItemContent
                        aria-label={filter}
                        label={filter}
                        onClick={() => {
                          if (inputRef.current) {
                            inputRef.current.value = filter;
                          }
                          if (updateFilter) {
                            updateFilter(filter);
                          }
                          maybePrettifyAndSetValue(originalCode, false, filter);
                        }}
                      />
                    </DropdownItem>
                  ))}
                </Dropdown>
              )) : null}
            {showFilter ?
              (<button key="help" className="btn btn--compact" onClick={() => showModal(FilterHelpModal, { isJSON: Boolean(mode?.includes('json')) })}>
                <i className="fa fa-question-circle" />
              </button>) : null}
            {showPrettify ?
              (<button
                key="prettify"
                className="btn btn--compact"
                title="Auto-format request body whitespace"
                onClick={() => {
                  if (mode?.includes('json') || mode?.includes('xml')) {
                    maybePrettifyAndSetValue(codeMirror.current?.getValue(), true);
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
