import './base-imports';

import classnames from 'classnames';
import clone from 'clone';
import CodeMirror, { type CodeMirrorLinkClickCallback, type EditorConfiguration, type ShowHintOptions } from 'codemirror';
import type { GraphQLInfoOptions } from 'codemirror-graphql/info';
import type { ModifiedGraphQLJumpOptions } from 'codemirror-graphql/jump';
import deepEqual from 'deep-equal';
import { JSONPath } from 'jsonpath-plus';
import React, { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Button, Menu, MenuItem, MenuTrigger, Popover, Toolbar } from 'react-aria-components';
import { useMount, useUnmount } from 'react-use';
import vkBeautify from 'vkbeautify';

import { DEBOUNCE_MILLIS, isMac } from '../../../common/constants';
import * as misc from '../../../common/misc';
import type { KeyCombination } from '../../../common/settings';
import { getTagDefinitions } from '../../../templating/index';
import { extractNunjucksTagFromCoords, type NunjucksParsedTag, type nunjucksTagContextMenuOptions } from '../../../templating/utils';
import { ednPrettify } from '../../../utils/prettify/edn';
import { jsonPrettify } from '../../../utils/prettify/json';
import { queryXPath } from '../../../utils/xpath/query';
import { useGatedNunjucks } from '../../context/nunjucks/use-gated-nunjucks';
import { useEditorRefresh } from '../../hooks/use-editor-refresh';
import { useRootLoaderData } from '../../routes/root';
import { Icon } from '../icon';
import { createKeybindingsHandler, useDocBodyKeyboardShortcuts } from '../keydown-binder';
import { FilterHelpModal } from '../modals/filter-help-modal';
import { showModal } from '../modals/index';
import { NunjucksModal } from '../modals/nunjucks-modal';
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
  // used only for saving env editor state, focusEvent doesn't work well
  onBlur?: (e: FocusEvent) => void;
  onFocus?: (e: Event, editor?: CodeMirror.Editor) => void;
  onChange?: (value: string) => void;
  onCursorActivity?: (doc: CodeMirror.Editor) => void;
  onPaste?: (value: string) => string;
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
    return 'application/json';
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
  getCursor: () => CodeMirror.Position | undefined;
  setCursorLine: (lineNumber: number) => void;
  tryToSetOption: (key: keyof EditorConfiguration, value: any) => void;
  hasFocus: () => boolean;
  indexFromPos: (pos?: CodeMirror.Position) => number;
  getDoc: () => CodeMirror.Doc | undefined;
}
export const CodeEditor = memo(forwardRef<CodeEditorHandle, CodeEditorProps>(({
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
  onFocus,
  onBlur,
  onChange,
  onCursorActivity,
  onPaste,
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
  const extraKeys = useMemo(() => ({
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
  }), [indentChars]);
  const { handleRender, handleGetRenderContext } = useGatedNunjucks({ disabled: !enableNunjucks });

  const maybePrettifyAndSetValue = useCallback((code?: string, forcePrettify?: boolean, filter?: string) => {
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
    const prettifyEDN = (code: string) => {
      try {
        return ednPrettify(code);
      } catch (error) {
        return code;
      }
    };
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
      } else if (mode?.includes('edn')) {
        code = prettifyEDN(code);
      }
    }
    // this prevents codeMirror from needlessly setting the same thing repeatedly (which has the effect of moving the user's cursor and resetting the viewport scroll: a bad user experience)
    const currentCode = codeMirror.current?.getValue();
    if (currentCode === code) {
      return;
    }
    codeMirror.current?.setValue(code || '');
  }, [autoPrettify, mode, indentChars, updateFilter]);

  useDocBodyKeyboardShortcuts({
    beautifyRequestBody: () => {
      if (mode?.includes('json') || mode?.includes('xml')) {
        maybePrettifyAndSetValue(codeMirror.current?.getValue());
      }
    },
  });

  // NOTE: maybe we don't need this anymore? Maybe not.
  const persistState = useCallback(() => {
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
  }, [uniquenessKey, codeMirror]);

  const initEditor = useCallback(() => {
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

      if (onPaste) {
        if (change.origin === 'paste' && change.update) {
          const translatedText = onPaste(
            change.text.join('\n')
          ).split('\n');

          change.update(
            change.from,
            change.to,
            translatedText,
          );
        }
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
        event.codemirrorIgnore = settings.editorKeyMap !== 'vim';
        // Stop the editor from handling the escape key
      } else if (isEscapeKey) {
        // @ts-expect-error -- unsound property assignment
        event.codemirrorIgnore = settings.editorKeyMap !== 'vim';
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
        id,
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
  }, [hideGutters, hideLineNumbers, placeholder, settings.editorLineWrapping, settings.editorKeyMap, settings.hotKeyRegistry, settings.autocompleteDelay, settings.nunjucksPowerUserMode, settings.showVariableSourceAndValue, noLint, readOnly, noMatchBrackets, indentSize, hintOptions, infoOptions, dynamicHeight, jumpOptions, noStyleActiveLine, indentWithTabs, extraKeys, handleRender, mode, getAutocompleteConstants, getAutocompleteSnippets, persistState, maybePrettifyAndSetValue, defaultValue, filter, onClickLink, uniquenessKey, handleGetRenderContext, pinToBottom, onPaste, id]);

  const cleanUpEditor = useCallback(() => {
    codeMirror.current?.toTextArea();
    codeMirror.current?.closeHintDropdown();
    codeMirror.current = null;
  }, []);

  useMount(() => {
    initEditor();
  });
  useUnmount(() => {
    persistState();
    cleanUpEditor();
  });

  const reinitialize = useCallback(() => {
    cleanUpEditor();
    initEditor();
  }, [cleanUpEditor, initEditor]);

  useEditorRefresh(reinitialize);

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
          console.log('[codemirror] Failed to set CodeMirror option', err.message);
        }
        onChange(doc.getValue() || '');
        setOriginalCode(doc.getValue() || '');
      }
    }, DEBOUNCE_MILLIS);

    codeMirror.current?.on('changes', fn);
    return () => codeMirror.current?.off('changes', fn);
  }, [lintOptions, noLint, onChange]);

  useEffect(() => {
    const handleOnBlur = (_: CodeMirror.Editor, e: FocusEvent) => onBlur?.(e);
    codeMirror.current?.on('blur', handleOnBlur);
    return () => codeMirror.current?.off('blur', handleOnBlur);
  }, [onBlur]);

  useEffect(() => {
    const handleOnFocus = (_: CodeMirror.Editor, e: FocusEvent) => onFocus?.(e, _);
    codeMirror.current?.on('focus', handleOnFocus);
    return () => codeMirror.current?.off('focus', handleOnFocus);
  }, [onFocus]);

  const tryToSetOption = (key: keyof EditorConfiguration, value: any) => {
    try {
      codeMirror.current?.setOption(key, value);
    } catch (err) {
      console.log('[codemirror] Failed to set CodeMirror option', err.message, { key, value });
    }
  };
  useEffect(() => {
    const unsubscribe = window.main.on('nunjucks-context-menu-command', (_, { key, tag, nunjucksTag }) => {
      if (id === key) {
        if (nunjucksTag) {
          const { type, template, range } = nunjucksTag as nunjucksTagContextMenuOptions;
          switch (type) {
            case 'edit':
              showModal(NunjucksModal, {
                template: template,
                editorId: id,
                onDone: (template: string | null) => {
                  const { from, to } = range;
                  codeMirror.current?.replaceRange(template!, from, to);
                },
              });
              return;

            case 'delete':
              const { from, to } = range;
              codeMirror.current?.replaceRange('', from, to);
              return;

            default:
              return;
          };
        } else {
          codeMirror.current?.replaceSelection(tag);
        }
      }
    });
    return () => {
      unsubscribe();
    };
  }, [id]);
  useEffect(() => tryToSetOption('hintOptions', hintOptions), [hintOptions]);
  useEffect(() => tryToSetOption('info', infoOptions), [infoOptions]);
  useEffect(() => tryToSetOption('jump', jumpOptions), [jumpOptions]);
  // This line will trigger codeMirror lint
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
    getCursor: () => {
      return codeMirror.current?.getCursor();
    },
    setCursorLine: (lineNumber: number) => {
      codeMirror.current?.setCursor(lineNumber);
    },
    tryToSetOption,
    hasFocus: () => codeMirror.current?.hasFocus() as boolean,
    indexFromPos: (pos?: CodeMirror.Position) => pos ? codeMirror.current?.indexFromPos(pos) || 0 : 0,
    getDoc: () => codeMirror.current?.getDoc(),
  }), []);

  useEffect(() => {
    const handleCursorActivity = (doc: CodeMirror.Editor) => {
      onCursorActivity?.(doc);
    };

    const handleFocus = (_: CodeMirror.Editor, event: Event) => {
      onFocus?.(event);
    };
    codeMirror.current?.on('cursorActivity', handleCursorActivity);

    codeMirror.current?.on('focus', handleFocus);

    return () => {
      codeMirror.current?.off('cursorActivity', handleCursorActivity);
      codeMirror.current?.off('focus', handleFocus);
    };
  }, [onCursorActivity, onFocus]);

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
        if (readOnly || !enableNunjucks) {
          return;
        }
        event.preventDefault();
        const target = event.target as HTMLElement;
        // right click on nunjucks tag
        if (target?.classList?.contains('nunjucks-tag')) {
          const { clientX, clientY } = event;
          const nunjucksTag = extractNunjucksTagFromCoords({ left: clientX, top: clientY }, codeMirror);
          if (nunjucksTag) {
            // show context menu for nunjucks tag
            window.main.showNunjucksContextMenu({ key: id, nunjucksTag });
          }
        } else {
          window.main.showNunjucksContextMenu({ key: id });
        }
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
          <div key={uniquenessKey} className="flex w-full items-center border-solid border-t border-[--hl-md] h-[--line-height-sm] text-[--font-size-sm]">
            {showFilter ?
              (<input
                ref={inputRef}
                key="filter"
                type="text"
                className='flex-1 pl-3'
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
            <Toolbar className="flex items-center h-full">
              {showFilter && filterHistory && filterHistory.length > 0 && (
                <MenuTrigger>
                  <Button
                    aria-label="Filter History"
                    className="flex items-center justify-center h-full aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                  >
                    <Icon icon="clock" />
                  </Button>
                  <Popover className="min-w-max overflow-y-hidden flex flex-col">
                    <Menu
                      aria-label="Filter history menu"
                      selectionMode="single"
                      onAction={key => {
                        const index = Number(key);
                        const filter = filterHistory[index];
                        if (inputRef.current) {
                          inputRef.current.value = filter;
                        }
                        if (updateFilter) {
                          updateFilter(filter);
                        }
                        maybePrettifyAndSetValue(originalCode, false, filter);
                      }}
                      items={filterHistory.map((filter, index) => ({
                        id: filter,
                        name: filter,
                        key: index,
                      }))}
                      className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto focus:outline-none"
                    >
                      {item => (
                        <MenuItem
                          className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
                          aria-label={item.name}
                        >
                          <span>{item.name}</span>
                        </MenuItem>
                      )}
                    </Menu>
                  </Popover>
                </MenuTrigger>
              )}

              {showFilter ? (
                <Button key="help" className="px-4 py-1 h-full flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] text-[--color-font] text-xs hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all" onPress={() => showModal(FilterHelpModal, { isJSON: Boolean(mode?.includes('json')) })}>
                  <i className="fa fa-question-circle" />
                </Button>
              ) : null}
              {showPrettify ? (
                <Button
                  key="prettify"
                  className="px-4 py-1 h-full flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] text-[--color-font] text-xs hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all"
                  aria-label="Auto-format request body whitespace"
                  onPress={() => {
                    if (mode?.includes('json') || mode?.includes('xml')) {
                      maybePrettifyAndSetValue(codeMirror.current?.getValue(), true);
                    }
                  }}
                >
                  Beautify {mode?.includes('json') ? 'JSON' : mode?.includes('xml') ? 'XML' : ''}
                </Button>
              ) : null}
            </Toolbar>
          </div>
        ) : null
      }
    </div >
  );
}));
CodeEditor.displayName = 'CodeEditor';
