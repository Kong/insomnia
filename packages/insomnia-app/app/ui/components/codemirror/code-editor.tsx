import './base-imports';

import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import clone from 'clone';
import CodeMirror, { CodeMirrorLinkClickCallback, ShowHintOptions } from 'codemirror';
import { GraphQLInfoOptions } from 'codemirror-graphql/info';
import { ModifiedGraphQLJumpOptions } from 'codemirror-graphql/jump';
import deepEqual from 'deep-equal';
import { json as jsonPrettify } from 'insomnia-prettify';
import { query as queryXPath } from 'insomnia-xpath';
import jq from 'jsonpath';
import React, { Component, CSSProperties, ReactNode } from 'react';
import { connect } from 'react-redux';
import { unreachable } from 'ts-assert-unreachable';
import vkBeautify from 'vkbeautify';
import zprint from 'zprint-clj';

import {
  AUTOBIND_CFG,
  DEBOUNCE_MILLIS,
  EDITOR_KEY_MAP_VIM,
  isMac,
} from '../../../common/constants';
import { hotKeyRefs } from '../../../common/hotkeys';
import { executeHotKey } from '../../../common/hotkeys-listener';
import { keyboardKeys as keyCodes } from '../../../common/keyboard-keys';
import * as misc from '../../../common/misc';
import { HandleGetRenderContext, HandleRender } from '../../../common/render';
import { getTagDefinitions } from '../../../templating/index';
import { NunjucksParsedTag } from '../../../templating/utils';
import { RootState } from '../../redux/modules';
import { selectSettings } from '../../redux/selectors';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import KeydownBinder from '../keydown-binder';
import FilterHelpModal from '../modals/filter-help-modal';
import { showModal } from '../modals/index';
import { normalizeIrregularWhitespace } from './normalizeIrregularWhitespace';

const TAB_KEY = 9;
const TAB_SIZE = 4;
const MAX_SIZE_FOR_LINTING = 1000000; // Around 1MB

// Global object used for storing and persisting editor states
const editorStates = {};
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

type ReduxProps = ReturnType<typeof mapStateToProps>;

const mapStateToProps = (state: RootState) => {
  const { hotKeyRegistry, autocompleteDelay } = selectSettings(state);

  return {
    hotKeyRegistry,
    autocompleteDelay,
  };
};

interface Props extends ReduxProps {
  indentWithTabs?: boolean;
  onChange?: CodeEditorOnChange;
  onCursorActivity?: (cm: CodeMirror.EditorFromTextArea) => void;
  onFocus?: (e: FocusEvent) => void;
  onBlur?: (e: FocusEvent) => void;
  onClickLink?: CodeMirrorLinkClickCallback;
  onKeyDown?: (e: KeyboardEvent, value: string) => void;
  onMouseLeave?: React.MouseEventHandler<HTMLDivElement>;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  onPaste?: (e: ClipboardEvent) => void;
  onCodeMirrorInit?: (editor: CodeMirror.EditorFromTextArea) => void;
  render?: HandleRender;
  nunjucksPowerUserMode?: boolean;
  getRenderContext?: HandleGetRenderContext;
  getAutocompleteConstants?: () => string[] | PromiseLike<string[]>;
  getAutocompleteSnippets?: () => CodeMirror.Snippet[];
  keyMap?: string;
  mode?: string;
  id?: string;
  placeholder?: string;
  lineWrapping?: boolean;
  hideLineNumbers?: boolean;
  hideGutters?: boolean;
  noMatchBrackets?: boolean;
  hideScrollbars?: boolean;
  fontSize?: number;
  indentSize?: number;
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
  isVariableUncovered?: boolean;
  raw?: boolean;
}

interface State {
  filter: string;
}

function isMarkerRange(mark?: CodeMirror.Position | CodeMirror.MarkerRange): mark is CodeMirror.MarkerRange {
  if (!mark) {
    return false;
  }

  return Object.prototype.hasOwnProperty.call(mark, 'from');
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class UnconnectedCodeEditor extends Component<Props, State> {
  private _uniquenessKey?: string;
  private _previousUniquenessKey?: string;
  private _originalCode: string;
  codeMirror?: CodeMirror.EditorFromTextArea;
  private _filterInput: HTMLInputElement;
  private _autocompleteDebounce: NodeJS.Timeout | null = null;
  private _filterTimeout: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      filter: props.filter || '',
    };
    this._originalCode = '';
    this._uniquenessKey = this.props.uniquenessKey;
    this._previousUniquenessKey = 'n/a';
  }

  componentWillUnmount() {
    if (this.codeMirror) {
      this.codeMirror.toTextArea();
      this.codeMirror.closeHintDropdown();
    }
  }

  // eslint-disable-next-line camelcase
  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    this._uniquenessKey = nextProps.uniquenessKey;
    this._previousUniquenessKey = this.props.uniquenessKey;
    // Sync the filter too
    this.setState({
      filter: nextProps.filter || '',
    });
  }

  componentDidUpdate() {
    this._codemirrorSetOptions();

    const { defaultValue } = this.props;

    if (this._uniquenessKey && this._uniquenessKey !== this._previousUniquenessKey) {
      this._codemirrorSetValue(defaultValue);

      this._restoreState();
    }
  }

  shouldComponentUpdate(nextProps) {
    // Update if any properties changed, except value. We ignore value.
    for (const key of Object.keys(nextProps)) {
      if (key === 'defaultValue') {
        continue;
      }

      if (this.props[key] !== nextProps[key]) {
        return true;
      }
    }

    return false;
  }

  selectAll() {
    if (this.codeMirror) {
      this.codeMirror.setSelection(
        {
          line: 0,
          ch: 0,
        },
        {
          line: this.codeMirror.lineCount(),
          ch: 0,
        },
      );
    }
  }

  focus() {
    if (this.codeMirror) {
      this.codeMirror.focus();
    }
  }

  refresh() {
    if (this.codeMirror) {
      this.codeMirror.refresh();
    }
  }

  setCursor(ch: number, line = 0) {
    if (this.codeMirror) {
      if (!this.hasFocus()) {
        this.focus();
      }

      this.codeMirror.setCursor({
        line,
        ch,
      });
    }
  }

  setSelection(chStart: number, chEnd: number, lineStart: number, lineEnd: number) {
    if (this.codeMirror) {
      this.codeMirror.setSelection(
        {
          line: lineStart,
          ch: chStart,
        },
        {
          line: lineEnd,
          ch: chEnd,
        },
      );
      this.codeMirror.scrollIntoView({
        line: lineStart,
        ch: chStart,
      });
    }
  }

  scrollToSelection(chStart: number, chEnd: number, lineStart: number, lineEnd: number) {
    const selectionFocusPos = window.innerHeight / 2 - 100;

    if (this.codeMirror) {
      this.codeMirror.setSelection(
        {
          line: lineStart,
          ch: chStart,
        },
        {
          line: lineEnd,
          ch: chEnd,
        },
      );
      this.codeMirror.scrollIntoView(
        {
          line: lineStart,
          ch: chStart,
        }, // If sizing permits, position selection just above center
        selectionFocusPos,
      );
    }
  }

  getSelectionStart() {
    if (!this.codeMirror) {
      return null;
    }

    const selections = this.codeMirror.listSelections();

    if (selections.length) {
      return selections[0].anchor.ch;
    } else {
      return 0;
    }
  }

  getSelectionEnd() {
    if (!this.codeMirror) {
      return null;
    }

    const selections = this.codeMirror.listSelections();

    if (selections.length) {
      return selections[0].head.ch;
    } else {
      return 0;
    }
  }

  focusEnd() {
    if (!this.codeMirror) {
      return;
    }

    if (!this.hasFocus()) {
      this.focus();
    }

    const doc = this.codeMirror.getDoc();
    doc.setCursor(doc.lineCount(), 0);
  }

  hasFocus() {
    if (this.codeMirror) {
      return this.codeMirror.hasFocus();
    } else {
      return false;
    }
  }

  setAttribute(name: string, value: string) {
    if (!this.codeMirror) {
      return;
    }

    this.codeMirror.getTextArea().parentElement?.setAttribute(name, value);
  }

  removeAttribute(name: string) {
    if (!this.codeMirror) {
      return;
    }

    this.codeMirror.getTextArea().parentElement?.removeAttribute(name);
  }

  getAttribute(name: string) {
    if (!this.codeMirror) {
      return;
    }

    this.codeMirror.getTextArea().parentElement?.getAttribute(name);
  }

  clearSelection() {
    if (!this.codeMirror) {
      return;
    }

    // Never do this if dropdown is open
    if (this.codeMirror?.isHintDropdownActive()) {
      return;
    }

    this.codeMirror.setSelection(
      {
        line: -1,
        ch: -1,
      },
      {
        line: -1,
        ch: -1,
      },
      {
        scroll: false,
      },
    );
  }

  getValue() {
    if (this.codeMirror) {
      return this.codeMirror.getValue();
    } else {
      return '';
    }
  }

  _persistState() {
    const { uniquenessKey } = this.props;

    if (!uniquenessKey || !this.codeMirror) {
      return;
    }

    const marks = this.codeMirror
      .getAllMarks()
      .filter(mark => mark.__isFold)
      .map(mark => {
        const result = mark.find();

        if (isMarkerRange(result)) {
          return result;
        }

        return {
          from: undefined,
          to: undefined,
        };
      });

    editorStates[uniquenessKey] = {
      scroll: this.codeMirror.getScrollInfo(),
      selections: this.codeMirror.listSelections(),
      cursor: this.codeMirror.getCursor(),
      history: this.codeMirror.getHistory(),
      marks,
    };
  }

  _restoreState() {
    const { uniquenessKey } = this.props;

    if (uniquenessKey === undefined) {
      return;
    }
    if (!editorStates.hasOwnProperty(uniquenessKey)) {
      return;
    }
    if (!this.codeMirror) {
      return;
    }

    const { scroll, selections, cursor, history, marks } = editorStates[uniquenessKey];
    this.codeMirror.scrollTo(scroll.left, scroll.top);
    this.codeMirror.setHistory(history);
    // NOTE: These won't be visible unless the editor is focused
    this.codeMirror.setCursor(cursor.line, cursor.ch, { scroll: false });
    this.codeMirror.setSelections(selections, undefined, { scroll: false });

    // Restore marks one-by-one
    for (const { from, to } of marks || []) {
      this.codeMirror.foldCode(from, to);
    }
  }

  _setFilterInputRef(n: HTMLInputElement) {
    this._filterInput = n;
  }

  _handleInitTextarea(textarea: HTMLTextAreaElement) {
    if (!textarea) {
      // Not mounted
      return;
    }

    if (this.codeMirror) {
      // Already initialized
      return;
    }

    const foldOptions: CodeMirror.EditorConfiguration['foldOptions'] = {
      widget: (from, to) => {
        let count;
        // Get open / close token
        let startToken = '{';
        let endToken = '}';
        // Prevent retrieving an invalid content if undefined
        if (!from?.line || !to?.line) return '\u2194';
        const prevLine = this.codeMirror?.getLine(from.line);
        if (!prevLine) return '\u2194';

        if (prevLine.lastIndexOf('[') > prevLine.lastIndexOf('{')) {
          startToken = '[';
          endToken = ']';
        }

        // Get json content
        const internal = this.codeMirror?.getRange(from, to);
        const toParse = startToken + internal + endToken;

        // Get key count
        try {
          const parsed = JSON.parse(toParse);
          count = Object.keys(parsed).length;
        } catch (e) { }

        return count ? `\u21A4 ${count} \u21A6` : '\u2194';
      },
    };
    const { defaultValue, debounceMillis: ms } = this.props;
    this.codeMirror = CodeMirror.fromTextArea(textarea, {
      ...BASE_CODEMIRROR_OPTIONS,
      foldOptions,
    });
    // Set default listeners
    const debounceMillis = typeof ms === 'number' ? ms : DEBOUNCE_MILLIS;
    this.codeMirror.on('changes', misc.debounce(this._codemirrorValueChanged, debounceMillis));
    this.codeMirror.on('beforeChange', this._codemirrorValueBeforeChange);
    this.codeMirror.on('keydown', this._codemirrorKeyDown);
    this.codeMirror.on('keyup', this._codemirrorTriggerCompletionKeyUp);
    this.codeMirror.on('endCompletion', this._codemirrorEndCompletion);
    this.codeMirror.on('focus', this._codemirrorFocus);
    this.codeMirror.on('blur', this._codemirrorBlur);
    this.codeMirror.on('paste', this._codemirrorPaste);
    this.codeMirror.on('scroll', this._codemirrorScroll);
    this.codeMirror.on('fold', this._codemirrorToggleFold);
    this.codeMirror.on('unfold', this._codemirrorToggleFold);
    this.codeMirror.on('keyHandled', this._codemirrorKeyHandled);
    // Prevent these things if we're type === "password"
    this.codeMirror.on('copy', this._codemirrorPreventWhenTypePassword);
    this.codeMirror.on('cut', this._codemirrorPreventWhenTypePassword);
    this.codeMirror.on('dragstart', this._codemirrorPreventWhenTypePassword);
    this.codeMirror.setCursor({
      line: -1,
      ch: -1,
    });

    let extraKeys = BASE_CODEMIRROR_OPTIONS.extraKeys;
    extraKeys = extraKeys && typeof extraKeys !== 'string' ? extraKeys : {};

    this.codeMirror.setOption('extraKeys', {
      ...extraKeys,
      Tab: cm => {
        // Indent with tabs or spaces
        // From https://github.com/codemirror/CodeMirror/issues/988#issuecomment-14921785
        if (cm.somethingSelected()) {
          cm.indentSelection('add');
        } else {
          cm.replaceSelection(this._indentChars(), 'end');
        }
      },
    });

    // Set editor options
    this._codemirrorSetOptions();

    const setup = () => {
      // Actually set the value
      this._codemirrorSetValue(defaultValue || '');

      // Clear history so we can't undo the initial set
      this.codeMirror?.clearHistory();

      // Setup nunjucks listeners
      if (this.props.render && !this.props.nunjucksPowerUserMode) {
        this.codeMirror?.enableNunjucksTags(
          this.props.render,
          this.props.getRenderContext,
          this.props.isVariableUncovered,
        );
      }

      // Make URLs clickable
      if (this.props.onClickLink) {
        this.codeMirror?.makeLinksClickable(this.props.onClickLink);
      }

      // HACK: Refresh because sometimes it renders too early and the scroll doesn't quite fit.
      setTimeout(() => {
        this.codeMirror?.refresh();
      }, 100);

      // Restore the state
      this._restoreState();
    };

    // Do this a bit later for big values so we don't block the render process
    if (defaultValue && defaultValue.length > 10000) {
      setTimeout(setup, 100);
    } else {
      setup();
    }

    if (this.props.onCodeMirrorInit) {
      this.props.onCodeMirrorInit(this.codeMirror);
    }

    // NOTE: Start listening to cursor after everything because it seems to fire
    // immediately for some reason
    this.codeMirror.on('cursorActivity', this._codemirrorCursorActivity);
  }

  static _isJSON(mode?: string) {
    if (!mode) {
      return false;
    }

    return mode.indexOf('json') !== -1;
  }

  static _isYAML(mode?: string) {
    if (!mode) {
      return false;
    }

    return mode.indexOf('yaml') !== -1;
  }

  static _isXML(mode?: string) {
    if (!mode) {
      return false;
    }

    return mode.indexOf('xml') !== -1;
  }

  static _isEDN(mode?: string) {
    if (!mode) {
      return false;
    }

    return mode === 'application/edn' || mode.indexOf('clojure') !== -1;
  }

  _indentChars() {
    return this.codeMirror?.getOption('indentWithTabs')
      ? '\t'
      : new Array((this.codeMirror?.getOption?.('indentUnit') || 0) + 1).join(' ');
  }

  _prettify() {
    const canPrettify = this._canPrettify();
    if (!canPrettify) {
      return;
    }

    const code = this.codeMirror?.getValue();
    this._codemirrorSetValue(code, canPrettify);
  }

  _prettifyJSON(code: string) {
    try {
      let jsonString = code;

      if (this.props.updateFilter && this.state.filter) {
        try {
          const codeObj = JSON.parse(code);
          const results = jq.query(codeObj, this.state.filter.trim());
          jsonString = JSON.stringify(results);
        } catch (err) {
          console.log('[jsonpath] Error: ', err);
          jsonString = '[]';
        }
      }

      return jsonPrettify(jsonString, this._indentChars(), this.props.autoPrettify);
    } catch (e) {
      // That's Ok, just leave it
      return code;
    }
  }

  static _prettifyEDN(code: string) {
    try {
      return zprint(code, null);
    } catch (e) {
      return code;
    }
  }

  _prettifyXML(code: string) {
    if (this.props.updateFilter && this.state.filter) {
      try {
        const results = queryXPath(code, this.state.filter);
        code = `<result>${results.map(r => r.outer).join('\n')}</result>`;
      } catch (err) {
        // Failed to parse filter (that's ok)
        code = `<error>${err.message}</error>`;
      }
    }

    try {
      return vkBeautify.xml(code, this._indentChars());
    } catch (e) {
      // Failed to parse so just return original
      return code;
    }
  }

  async _handleKeyDown(event: KeyboardEvent) {
    executeHotKey(event, hotKeyRefs.BEAUTIFY_REQUEST_BODY, this._prettify);
  }

  /**
   * Sets options on the CodeMirror editor while also sanitizing them
   */
  async _codemirrorSetOptions() {
    const {
      mode: rawMode,
      autoCloseBrackets,
      autocompleteDelay,
      dynamicHeight,
      getAutocompleteConstants,
      getAutocompleteSnippets,
      getRenderContext,
      hideGutters,
      hideLineNumbers,
      hideScrollbars,
      hintOptions,
      hotKeyRegistry,
      indentSize,
      indentWithTabs,
      infoOptions,
      jumpOptions,
      keyMap,
      lineWrapping,
      lintOptions,
      noDragDrop,
      noLint,
      noMatchBrackets,
      noStyleActiveLine,
      placeholder,
      readOnly,
      tabIndex,
    } = this.props;
    let mode;

    if (this.props.render) {
      mode = {
        name: 'nunjucks',
        baseMode: CodeEditor._normalizeMode(rawMode),
      };
    } else {
      // foo bar baz
      mode = CodeEditor._normalizeMode(rawMode);
    }

    // NOTE: YAML is not valid when indented with Tabs
    const isYaml = typeof rawMode === 'string' ? rawMode.includes('yaml') : false;
    const actuallyIndentWithTabs = indentWithTabs && !isYaml;
    const options: CodeMirror.EditorConfiguration = {
      readOnly: !!readOnly,
      placeholder: placeholder || '',
      mode: mode,
      tabindex: typeof tabIndex === 'number' ? tabIndex : undefined,
      dragDrop: !noDragDrop,
      scrollbarStyle: hideScrollbars ? 'null' : 'native',
      styleActiveLine: !noStyleActiveLine,
      lineNumbers: !hideGutters && !hideLineNumbers,
      foldGutter: !hideGutters && !hideLineNumbers,
      lineWrapping: lineWrapping,
      indentWithTabs: actuallyIndentWithTabs,
      matchBrackets: !noMatchBrackets,
      lint: !noLint && !readOnly,
      gutters: [],
    };

    // Only set keyMap if we're not read-only. This is so things like
    // ctrl-a work on read-only mode.
    if (!readOnly && keyMap) {
      options.keyMap = keyMap;
    }

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
    if (getRenderContext || getAutocompleteConstants || getAutocompleteSnippets) {
      let getVariables: (() => Promise<CodeMirror.Variable[]>) | undefined;
      let getTags: (() => Promise<NunjucksParsedTag[]>) | undefined;

      if (getRenderContext) {
        getVariables = async () => {
          const context = await getRenderContext();
          const variables = context ? context.keys : [];
          return variables || [];
        };

        // Only allow tags if we have variables too
        getTags = async () => {
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
        };
      }

      options.environmentAutocomplete = {
        getVariables,
        getTags,
        getConstants: getAutocompleteConstants,
        getSnippets: getAutocompleteSnippets,
        hotKeyRegistry,
        autocompleteDelay,
      };
    }

    if (dynamicHeight) {
      options.viewportMargin = Infinity;
    }

    // Strip of charset if there is one
    Object.keys(options).map(key =>
      this._codemirrorSmartSetOption(
          key as keyof CodeMirror.EditorConfiguration,
          options[key]
      )
    );
  }

  /**
   * Set option if it's different than in the current Codemirror instance
   */
  _codemirrorSmartSetOption<K extends keyof CodeMirror.EditorConfiguration>(key: K, value: CodeMirror.EditorConfiguration[K]) {
    const cm = this.codeMirror;
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

  static _normalizeMode(mode?: string) {
    const mimeType = mode ? mode.split(';')[0] : 'text/plain';

    if (mimeType.includes('graphql-variables')) {
      return 'graphql-variables';
    } else if (mimeType.includes('graphql')) {
      // Because graphQL plugin doesn't recognize application/graphql content-type
      return 'graphql';
    } else if (CodeEditor._isJSON(mimeType)) {
      return 'application/json';
    } else if (CodeEditor._isEDN(mimeType)) {
      return 'application/edn';
    } else if (CodeEditor._isXML(mimeType)) {
      return 'application/xml';
    } else if (mimeType.includes('kotlin')) {
      return 'text/x-kotlin';
    } else if (CodeEditor._isYAML(mimeType)) {
      // code-mirror doesn't recognize text/yaml or application/yaml
      // as a valid mime-type
      return 'yaml';
    } else {
      return mimeType;
    }
  }

  _codemirrorCursorActivity(instance: CodeMirror.EditorFromTextArea) {
    if (this.props.onCursorActivity) {
      this.props.onCursorActivity(instance);
    }
  }

  async _codemirrorKeyDown(doc: CodeMirror.EditorFromTextArea, e: KeyboardEvent & {codemirrorIgnore: boolean}) {
    // Use default tab behaviour if we're told
    if (this.props.defaultTabBehavior && e.code === TAB_KEY.toString()) {
      e.codemirrorIgnore = true;
    }

    if (this.props.onKeyDown && !doc.isHintDropdownActive()) {
      this.props.onKeyDown(e, doc.getValue());
    }
  }

  _codemirrorEndCompletion() {
    if (this._autocompleteDebounce !== null) {
      clearTimeout(this._autocompleteDebounce);
    }
  }

  _codemirrorTriggerCompletionKeyUp(doc: CodeMirror.EditorFromTextArea, e: KeyboardEvent) {
    // Enable graphql completion if we're in that mode
    if (doc.getOption('mode') === 'graphql') {
      // Only operate on one-letter keys. This will filter out
      // any special keys (Backspace, Enter, etc)
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.length > 1) {
        return;
      }

      if (this._autocompleteDebounce !== null) {
        clearTimeout(this._autocompleteDebounce);
      }

      // You don't want to re-trigger the hint dropdown if it's already open
      // for other reasons, like forcing its display with Ctrl+Space
      if (this.codeMirror?.isHintDropdownActive()) {
        return;
      }

      this._autocompleteDebounce = setTimeout(() => {
        doc.execCommand('autocomplete');
      }, 700);
    }
  }

  _codemirrorFocus(_doc: CodeMirror.EditorFromTextArea, e: FocusEvent) {
    if (this.props.onFocus) {
      this.props.onFocus(e);
    }
  }

  _codemirrorBlur(_doc: CodeMirror.EditorFromTextArea, e: FocusEvent) {
    this._persistState();

    if (this.props.onBlur) {
      this.props.onBlur(e);
    }
  }

  _codemirrorScroll() {
    this._persistState();
  }

  _codemirrorToggleFold() {
    this._persistState();
  }

  _codemirrorKeyHandled(_codeMirror: CodeMirror.EditorFromTextArea, _keyName: string, event: KeyboardEvent) {
    const { keyMap } = this.props;
    const { keyCode } = event;
    const isVimKeyMap = keyMap === EDITOR_KEY_MAP_VIM;
    const pressedEscape = keyCode === keyCodes.esc.keyCode;

    if (isVimKeyMap && pressedEscape) {
      event.stopPropagation();
    }
  }

  _codemirrorValueBeforeChange(doc: CodeMirror.EditorFromTextArea, change: CodeMirror.EditorChangeCancellable) {
    const value = this.codeMirror?.getDoc().getValue();

    // If we're in single-line mode, merge all changed lines into one
    if (this.props.singleLine && change.text && change.text.length > 1) {
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
      this._codemirrorSmartSetOption('lint', false);
    } else {
      this._codemirrorSmartSetOption('lint', this.props.lintOptions || true);
    }
  }

  _codemirrorPaste(_cm: CodeMirror.EditorFromTextArea, e: ClipboardEvent) {
    if (this.props.onPaste) {
      this.props.onPaste(e);
    }
  }

  _codemirrorPreventWhenTypePassword(_cm: CodeMirror.EditorFromTextArea, e: Event) {
    const { type } = this.props;

    if (type && type.toLowerCase() === 'password') {
      e.preventDefault();
    }
  }

  /**
   * Wrapper function to add extra behaviour to our onChange event
   */
  _codemirrorValueChanged() {
    if (!this.props.onChange) {
      return;
    }

    const value = this.codeMirror?.getDoc().getValue() || '';
    // Disable linting if the document reaches a maximum size or is empty
    const isOverMaxSize = value.length > MAX_SIZE_FOR_LINTING;
    const shouldLint = isOverMaxSize || value.length === 0 ? false : !this.props.noLint;

    const existingLint = this.codeMirror?.getOption('lint') || false;

    if (shouldLint !== existingLint) {
      const { lintOptions } = this.props;
      const lint = shouldLint ? lintOptions || true : false;
      this._codemirrorSmartSetOption('lint', lint);
    }

    this.props.onChange(value);
  }

  /**
   * Sets the CodeMirror value without triggering the onChange event
   * @param code the code to set in the editor
   * @param forcePrettify
   */
  _codemirrorSetValue(code?: string, forcePrettify?: boolean) {
    if (typeof code !== 'string') {
      console.warn('Code editor was passed non-string value', code);
      return;
    }
    const { autoPrettify, mode } = this.props;
    this._originalCode = code;
    const shouldPrettify = forcePrettify || autoPrettify;

    if (shouldPrettify && this._canPrettify()) {
      if (CodeEditor._isXML(mode)) {
        code = this._prettifyXML(code);
      } else if (CodeEditor._isEDN(mode)) {
        code = CodeEditor._prettifyEDN(code);
      } else if (CodeEditor._isJSON(mode)) {
        code = this._prettifyJSON(code);
      } else {
        unreachable('attempted to prettify in a mode that should not support prettifying');
      }
    }

    // this prevents codeMirror from needlessly setting the same thing repeatedly (which has the effect of moving the user's cursor and resetting the viewport scroll: a bad user experience)
    const currentCode = this.codeMirror?.getValue();
    if (currentCode === code) {
      return;
    }

    this.codeMirror?.setValue(code || '');
  }

  _handleFilterHistorySelect(filter = '') {
    this._filterInput.value = filter;

    this._setFilter(filter);
  }

  _handleFilterChange(e) {
    this._setFilter(e.target.value);
  }

  _setFilter(filter = '') {
    if (this._filterTimeout !== null) {
      clearTimeout(this._filterTimeout);
    }
    this._filterTimeout = setTimeout(() => {
      this.setState({
        filter,
      });

      this._codemirrorSetValue(this._originalCode);

      if (this.props.updateFilter) {
        this.props.updateFilter(filter);
      }
    }, 200);
  }

  _canPrettify() {
    const { mode } = this.props;
    return CodeEditor._isJSON(mode) || CodeEditor._isXML(mode) || CodeEditor._isEDN(mode);
  }

  _showFilterHelp() {
    const isJson = CodeEditor._isJSON(this.props.mode);

    showModal(FilterHelpModal, isJson);
  }

  render() {
    const {
      id,
      readOnly,
      fontSize,
      mode,
      filter,
      filterHistory,
      onMouseLeave,
      onClick,
      className,
      dynamicHeight,
      style,
      type,
      isVariableUncovered,
      raw,
    } = this.props;
    const classes = classnames(className, {
      editor: true,
      'editor--dynamic-height': dynamicHeight,
      'editor--readonly': readOnly,
      'raw-editor': raw,
    });
    const toolbarChildren: ReactNode[] = [];

    if (this.props.updateFilter && (CodeEditor._isJSON(mode) || CodeEditor._isXML(mode))) {
      toolbarChildren.push(
        <input
          ref={this._setFilterInputRef}
          key="filter"
          type="text"
          title="Filter response body"
          defaultValue={filter || ''}
          placeholder={CodeEditor._isJSON(mode) ? '$.store.books[*].author' : '/store/books/author'}
          onChange={this._handleFilterChange}
        />,
      );

      if (filterHistory && filterHistory.length) {
        toolbarChildren.push(

          <Dropdown key="history" className="tall" right>
            <DropdownButton className="btn btn--compact">
              <i className="fa fa-clock-o" />
            </DropdownButton>
            {filterHistory.reverse().map(filter => (

              <DropdownItem key={filter} value={filter} onClick={this._handleFilterHistorySelect}>
                {filter}
              </DropdownItem>
            ))}
          </Dropdown>,
        );
      }

      toolbarChildren.push(
        <button key="help" className="btn btn--compact" onClick={this._showFilterHelp}>
          <i className="fa fa-question-circle" />
        </button>,
      );
    }

    if (this.props.manualPrettify && this._canPrettify()) {
      let contentTypeName = '';

      if (CodeEditor._isJSON(mode)) {
        contentTypeName = 'JSON';
      } else if (CodeEditor._isXML(mode)) {
        contentTypeName = 'XML';
      } else if (CodeEditor._isEDN(mode)) {
        contentTypeName = 'EDN';
      }

      toolbarChildren.push(
        <button
          key="prettify"
          className="btn btn--compact"
          title="Auto-format request body whitespace"
          onClick={this._prettify}
        >
          Beautify {contentTypeName}
        </button>,
      );
    }

    let toolbar: ReactNode = null;

    if (toolbarChildren.length) {
      toolbar = (
        <div key={this._uniquenessKey} className="editor__toolbar">
          {toolbarChildren}
        </div>
      );
    }

    const styles: CSSProperties = {};

    if (fontSize) {
      styles.fontSize = `${fontSize}px`;
    }

    return (
      <div className={classes} style={style} data-editor-type={type}>
        <KeydownBinder onKeydown={this._handleKeyDown} />
        <div
          className={classnames('editor__container', 'input', className)}
          style={styles}
          onClick={onClick}
          onMouseLeave={onMouseLeave}
        >
          <textarea
            key={isVariableUncovered ? 'foo' : 'bar'}
            id={id}
            ref={this._handleInitTextarea}
            style={{
              display: 'none',
            }}
            readOnly={readOnly}
            autoComplete="off"
            defaultValue=""
          />
        </div>
        {toolbar}
      </div>
    );
  }
}

const CodeEditor = connect(mapStateToProps, null, null, { forwardRef: true })(UnconnectedCodeEditor);

export default CodeEditor;
