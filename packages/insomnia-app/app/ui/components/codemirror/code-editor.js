import * as React from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import CodeMirror from 'codemirror';
import classnames from 'classnames';
import clone from 'clone';
import jq from 'jsonpath';
import vkBeautify from 'vkbeautify';
import { showModal } from '../modals/index';
import FilterHelpModal from '../modals/filter-help-modal';
import * as misc from '../../../common/misc';
import prettify from 'insomnia-prettify';
import { DEBOUNCE_MILLIS, isMac } from '../../../common/constants';
import './base-imports';
import { getTagDefinitions } from '../../../templating/index';
import Dropdown from '../base/dropdown/dropdown';
import DropdownButton from '../base/dropdown/dropdown-button';
import DropdownItem from '../base/dropdown/dropdown-item';
import { query as queryXPath } from 'insomnia-xpath';
import deepEqual from 'deep-equal';

const TAB_KEY = 9;
const TAB_SIZE = 4;
const MAX_SIZE_FOR_LINTING = 1000000; // Around 1MB

// Global object used for storing and persisting editor states
const editorStates = {};

const BASE_CODEMIRROR_OPTIONS = {
  lineNumbers: true,
  placeholder: 'Start Typing...',
  foldGutter: true,
  height: 'auto',
  autoRefresh: 2000,
  lineWrapping: true,
  scrollbarStyle: 'native',
  lint: true,
  matchBrackets: true,
  autoCloseBrackets: true,
  tabSize: TAB_SIZE,
  indentUnit: TAB_SIZE,
  hintOptions: null,
  dragDrop: true,
  viewportMargin: 30, // default 10
  selectionPointer: 'default',
  styleActiveLine: true,
  indentWithTabs: true,
  showCursorWhenSelecting: false,
  cursorScrollMargin: 12, // NOTE: This is px
  keyMap: 'default',
  extraKeys: CodeMirror.normalizeKeyMap({
    'Ctrl-Q': function(cm) {
      cm.foldCode(cm.getCursor());
    },
    [isMac() ? 'Cmd-Enter' : 'Ctrl-Enter']: function(cm) {
      // HACK: So nothing conflicts withe the "Send Request" shortcut
    },
    [isMac() ? 'Cmd-/' : 'Ctrl-/']: 'toggleComment',
    'Ctrl-Space': 'autocomplete',

    // Change default find command from "find" to "findPersistent" so the
    // search box stays open after pressing Enter
    [isMac() ? 'Cmd-F' : 'Ctrl-F']: 'findPersistent'
  })
};

@autobind
class CodeEditor extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      filter: props.filter || ''
    };

    this._originalCode = '';
    this._uniquenessKey = this.props.uniquenessKey;
    this._previousUniquenessKey = 'n/a';
  }

  componentWillUnmount() {
    if (this.codeMirror) {
      this.codeMirror.toTextArea();
    }
  }

  componentDidMount() {
    this._restoreState();
  }

  componentWillReceiveProps(nextProps) {
    this._uniquenessKey = nextProps.uniquenessKey;
    this._previousUniquenessKey = this.props.uniquenessKey;

    // Sync the filter too
    this.setState({ filter: nextProps.filter || '' });
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
        { line: 0, ch: 0 },
        { line: this.codeMirror.lineCount(), ch: 0 }
      );
    }
  }

  focus() {
    if (this.codeMirror) {
      this.codeMirror.focus();
    }
  }

  setCursor(ch, line = 0) {
    if (this.codeMirror) {
      if (!this.hasFocus()) {
        this.focus();
      }
      this.codeMirror.setCursor({ line, ch });
    }
  }

  setSelection(chStart, chEnd, line = 0) {
    if (this.codeMirror) {
      this.codeMirror.setSelection({ line, ch: chStart }, { line, ch: chEnd });
    }
  }

  getSelectionStart() {
    const selections = this.codeMirror.listSelections();
    if (selections.length) {
      return selections[0].anchor.ch;
    } else {
      return 0;
    }
  }

  getSelectionEnd() {
    const selections = this.codeMirror.listSelections();
    if (selections.length) {
      return selections[0].head.ch;
    } else {
      return 0;
    }
  }

  focusEnd() {
    if (this.codeMirror) {
      if (!this.hasFocus()) {
        this.focus();
      }
      const doc = this.codeMirror.getDoc();
      doc.setCursor(doc.lineCount(), 0);
    }
  }

  hasFocus() {
    if (this.codeMirror) {
      return this.codeMirror.hasFocus();
    } else {
      return false;
    }
  }

  setAttribute(name, value) {
    this.codeMirror.getTextArea().parentNode.setAttribute(name, value);
  }

  removeAttribute(name) {
    this.codeMirror.getTextArea().parentNode.removeAttribute(name);
  }

  getAttribute(name) {
    this.codeMirror.getTextArea().parentNode.getAttribute(name);
  }

  clearSelection() {
    // Never do this if dropdown is open
    if (this.codeMirror.isHintDropdownActive()) {
      return;
    }

    if (this.codeMirror) {
      this.codeMirror.setSelection({ line: -1, ch: -1 }, { line: -1, ch: -1 }, { scroll: false });
    }
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

    editorStates[uniquenessKey] = {
      scroll: this.codeMirror.getScrollInfo(),
      selections: this.codeMirror.listSelections(),
      cursor: this.codeMirror.getCursor(),
      history: this.codeMirror.getHistory()
    };
  }

  _restoreState() {
    const { uniquenessKey } = this.props;
    if (!editorStates.hasOwnProperty(uniquenessKey)) {
      return;
    }

    const { scroll, selections, cursor, history } = editorStates[uniquenessKey];
    this.codeMirror.scrollTo(scroll.left, scroll.top);
    this.codeMirror.setHistory(history);

    // NOTE: These won't be visible unless the editor is focused
    this.codeMirror.setCursor(cursor.line, cursor.ch, { scroll: false });
    this.codeMirror.setSelections(selections, null, { scroll: false });
  }

  _setFilterInputRef(n) {
    this._filterInput = n;
  }

  _handleInitTextarea(textarea) {
    if (!textarea) {
      // Not mounted
      return;
    }

    if (this.codeMirror) {
      // Already initialized
      return;
    }

    const { defaultValue, debounceMillis: ms } = this.props;
    this.codeMirror = CodeMirror.fromTextArea(textarea, BASE_CODEMIRROR_OPTIONS);

    // Set default listeners
    const debounceMillis = typeof ms === 'number' ? ms : DEBOUNCE_MILLIS;
    this.codeMirror.on('changes', misc.debounce(this._codemirrorValueChanged, debounceMillis));
    this.codeMirror.on('changes', misc.debounce(this._codemirrorValueChanged, debounceMillis));
    this.codeMirror.on('beforeChange', this._codemirrorValueBeforeChange);
    this.codeMirror.on('keydown', this._codemirrorKeyDown);
    this.codeMirror.on('keyup', this._codemirrorTriggerCompletionKeyUp);
    this.codeMirror.on('endCompletion', this._codemirrorEndCompletion);
    this.codeMirror.on('focus', this._codemirrorFocus);
    this.codeMirror.on('blur', this._codemirrorBlur);
    this.codeMirror.on('paste', this._codemirrorPaste);
    this.codeMirror.on('scroll', this._codemirrorScroll);

    // Prevent these things if we're type === "password"
    this.codeMirror.on('copy', this._codemirrorPreventWhenTypePassword);
    this.codeMirror.on('cut', this._codemirrorPreventWhenTypePassword);
    this.codeMirror.on('dragstart', this._codemirrorPreventWhenTypePassword);

    this.codeMirror.setCursor({ line: -1, ch: -1 });

    if (!this.codeMirror.getOption('indentWithTabs')) {
      this.codeMirror.setOption('extraKeys', {
        Tab: cm => {
          const spaces = new Array(this.codeMirror.getOption('indentUnit') + 1).join(' ');
          cm.replaceSelection(spaces);
        }
      });
    }

    // Set editor options
    this._codemirrorSetOptions();

    const setup = () => {
      // Actually set the value
      this._codemirrorSetValue(defaultValue || '');

      // Clear history so we can't undo the initial set
      this.codeMirror.clearHistory();

      // Setup nunjucks listeners
      if (this.props.render && !this.props.nunjucksPowerUserMode) {
        this.codeMirror.enableNunjucksTags(this.props.render);
      }

      // Make URLs clickable
      if (this.props.onClickLink) {
        this.codeMirror.makeLinksClickable(this.props.onClickLink);
      }

      // HACK: Refresh because sometimes it renders too early and the scroll doesn't
      // quite fit.
      setTimeout(() => {
        this.codeMirror.refresh();
      }, 100);
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

  _isJSON(mode) {
    if (!mode) {
      return false;
    }

    return mode.indexOf('json') !== -1;
  }

  _isXML(mode) {
    if (!mode) {
      return false;
    }

    return mode.indexOf('xml') !== -1;
  }

  _handleBeautify() {
    this._prettify(this.codeMirror.getValue());
  }

  _prettify(code) {
    this._codemirrorSetValue(code, true);
  }

  _prettifyJSON(code) {
    try {
      let jsonString = code;

      if (this.props.updateFilter && this.state.filter) {
        let obj = JSON.parse(code);
        try {
          jsonString = JSON.stringify(jq.query(obj, this.state.filter));
        } catch (err) {
          console.log('[jsonpath] Error: ', err);
          jsonString = '[]';
        }
      }

      return prettify.json(jsonString, '\t', this.props.autoPrettify);
    } catch (e) {
      // That's Ok, just leave it
      return code;
    }
  }

  _prettifyXML(code) {
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
      return vkBeautify.xml(code, '\t');
    } catch (e) {
      // Failed to parse so just return original
      return code;
    }
  }

  /**
   * Sets options on the CodeMirror editor while also sanitizing them
   */
  async _codemirrorSetOptions() {
    const {
      mode: rawMode,
      readOnly,
      hideLineNumbers,
      keyMap,
      lineWrapping,
      getRenderContext,
      getAutocompleteConstants,
      hideGutters,
      tabIndex,
      placeholder,
      noMatchBrackets,
      noDragDrop,
      hideScrollbars,
      noStyleActiveLine,
      noLint,
      indentSize,
      dynamicHeight,
      hintOptions,
      infoOptions,
      jumpOptions,
      lintOptions
    } = this.props;

    let mode;
    if (this.props.render) {
      mode = { name: 'nunjucks', baseMode: this._normalizeMode(rawMode) };
    } else {
      // foo bar baz
      mode = this._normalizeMode(rawMode);
    }

    let options = {
      readOnly: !!readOnly,
      placeholder: placeholder || '',
      mode: mode,
      tabIndex: typeof tabIndex === 'number' ? tabIndex : null,
      dragDrop: !noDragDrop,
      scrollbarStyle: hideScrollbars ? 'null' : 'native',
      styleActiveLine: !noStyleActiveLine,
      lineNumbers: !hideGutters && !hideLineNumbers,
      foldGutter: !hideGutters && !hideLineNumbers,
      lineWrapping: lineWrapping,
      matchBrackets: !noMatchBrackets,
      lint: !noLint && !readOnly,
      gutters: []
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

    if (!hideGutters && options.lineNumbers) {
      options.gutters.push('CodeMirror-linenumbers');
    }

    if (!hideGutters && options.foldGutter) {
      options.gutters.push('CodeMirror-foldgutter');
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

    if (!hideGutters && options.lint) {
      // Don't really need this
      // options.gutters.push('CodeMirror-lint-markers');
    }

    // Setup the hint options
    if (getRenderContext || getAutocompleteConstants) {
      let getVariables = null;
      let getTags = null;
      if (getRenderContext) {
        getVariables = async () => {
          const context = await getRenderContext();
          const variables = context ? context.keys : [];
          return variables || [];
        };

        // Only allow tags if we have variables too
        getTags = async () => {
          const expandedTags = [];
          for (const tagDef of await getTagDefinitions()) {
            const firstArg = tagDef.args[0];
            if (!firstArg || firstArg.type !== 'enum') {
              expandedTags.push(tagDef);
              continue;
            }

            for (const option of tagDef.args[0].options) {
              const optionName = misc.fnOrString(option.displayName, tagDef.args) || option.name;
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
        getConstants: getAutocompleteConstants
      };
    }

    if (dynamicHeight) {
      options.viewportMargin = Infinity;
    }

    // Strip of charset if there is one
    const cm = this.codeMirror;
    Object.keys(options).map(key => {
      // Don't set the option if it hasn't changed
      if (deepEqual(options[key], cm.options[key])) {
        return;
      }

      cm.setOption(key, options[key]);
    });
  }

  _normalizeMode(mode) {
    const mimeType = mode ? mode.split(';')[0] : 'text/plain';

    if (mimeType.includes('graphql-variables')) {
      return 'graphql-variables';
    } else if (mimeType.includes('graphql')) {
      // Because graphQL plugin doesn't recognize application/graphql content-type
      return 'graphql';
    } else if (this._isJSON(mimeType)) {
      return 'application/json';
    } else if (this._isXML(mimeType)) {
      return 'application/xml';
    } else {
      return mimeType;
    }
  }

  _codemirrorCursorActivity(instance, e) {
    if (this.props.onCursorActivity) {
      this.props.onCursorActivity(instance);
    }
  }

  async _codemirrorKeyDown(doc, e) {
    // Use default tab behaviour if we're told
    if (this.props.defaultTabBehavior && e.keyCode === TAB_KEY) {
      e.codemirrorIgnore = true;
    }

    if (this.props.onKeyDown && !doc.isHintDropdownActive()) {
      this.props.onKeyDown(e, doc.getValue());
    }
  }

  _codemirrorEndCompletion(doc, e) {
    clearInterval(this._autocompleteDebounce);
  }

  _codemirrorTriggerCompletionKeyUp(doc, e) {
    // Enable graphql completion if we're in that mode
    if (doc.options.mode === 'graphql') {
      // Only operate on one-letter keys. This will filter out
      // any special keys (Backspace, Enter, etc)
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.length > 1) {
        return;
      }

      clearTimeout(this._autocompleteDebounce);
      this._autocompleteDebounce = setTimeout(() => {
        doc.execCommand('autocomplete');
      }, 700);
    }
  }

  _codemirrorFocus(doc, e) {
    if (this.props.onFocus) {
      this.props.onFocus(e);
    }
  }

  _codemirrorBlur(doc, e) {
    this._persistState();
    if (this.props.onBlur) {
      this.props.onBlur(e);
    }
  }

  _codemirrorScroll() {
    this._persistState();
  }

  _codemirrorValueBeforeChange(doc, change) {
    // If we're in single-line mode, merge all changed lines into one
    if (this.props.singleLine && change.text && change.text.length > 1) {
      const text = change.text
        .join('') // join all changed lines into one
        .replace(/\n/g, ' '); // Convert all whitespace to spaces
      change.update(change.from, change.to, [text]);
    }
  }

  _codemirrorPaste(cm, e) {
    if (this.props.onPaste) {
      this.props.onPaste(e);
    }
  }

  _codemirrorPreventWhenTypePassword(cm, e) {
    const { type } = this.props;
    if (type && type.toLowerCase() === 'password') {
      e.preventDefault();
    }
  }

  /**
   * Wrapper function to add extra behaviour to our onChange event
   */
  _codemirrorValueChanged() {
    // Don't trigger change event if we're ignoring changes
    if (this._ignoreNextChange || !this.props.onChange) {
      this._ignoreNextChange = false;
      return;
    }

    const value = this.codeMirror.getDoc().getValue();

    const lint = value.length > MAX_SIZE_FOR_LINTING ? false : !this.props.noLint;
    const existingLint = this.codeMirror.options.lint || false;
    if (lint !== existingLint) {
      this.codeMirror.setOption('lint', lint);
    }

    this.props.onChange(value);
  }

  /**
   * Sets the CodeMirror value without triggering the onChange event
   * @param code the code to set in the editor
   * @param forcePrettify
   */
  _codemirrorSetValue(code, forcePrettify = false) {
    if (typeof code !== 'string') {
      console.warn('Code editor was passed non-string value', code);
      return;
    }

    this._originalCode = code;

    // Don't ignore changes from prettify
    if (!forcePrettify) {
      this._ignoreNextChange = true;
    }

    const shouldPrettify = forcePrettify || this.props.autoPrettify;

    if (shouldPrettify && this._canPrettify()) {
      if (this._isXML(this.props.mode)) {
        code = this._prettifyXML(code);
      } else {
        code = this._prettifyJSON(code);
      }
    }

    this.codeMirror.setValue(code || '');
  }

  _handleFilterHistorySelect(filter) {
    this._filterInput.value = filter;
    this._setFilter(filter);
  }

  _handleFilterChange(e) {
    this._setFilter(e.target.value);
  }

  _setFilter(filter) {
    clearTimeout(this._filterTimeout);
    this._filterTimeout = setTimeout(() => {
      this.setState({ filter });
      this._codemirrorSetValue(this._originalCode);
      if (this.props.updateFilter) {
        this.props.updateFilter(filter);
      }
    }, 200);
  }

  _canPrettify() {
    const { mode } = this.props;
    return this._isJSON(mode) || this._isXML(mode);
  }

  _showFilterHelp() {
    const isJson = this._isJSON(this.props.mode);
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
      type
    } = this.props;

    const classes = classnames(className, {
      editor: true,
      'editor--dynamic-height': dynamicHeight,
      'editor--readonly': readOnly
    });

    const toolbarChildren = [];
    if (this.props.updateFilter && (this._isJSON(mode) || this._isXML(mode))) {
      toolbarChildren.push(
        <input
          ref={this._setFilterInputRef}
          key="filter"
          type="text"
          title="Filter response body"
          defaultValue={filter || ''}
          placeholder={this._isJSON(mode) ? '$.store.books[*].author' : '/store/books/author'}
          onChange={this._handleFilterChange}
        />
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
          </Dropdown>
        );
      }

      toolbarChildren.push(
        <button key="help" className="btn btn--compact" onClick={this._showFilterHelp}>
          <i className="fa fa-question-circle" />
        </button>
      );
    }

    if (this.props.manualPrettify && this._canPrettify()) {
      let contentTypeName = '';
      if (this._isJSON(mode)) {
        contentTypeName = 'JSON';
      } else if (this._isXML(mode)) {
        contentTypeName = 'XML';
      }

      toolbarChildren.push(
        <button
          key="prettify"
          className="btn btn--compact"
          title="Auto-format request body whitespace"
          onClick={this._handleBeautify}>
          Beautify {contentTypeName}
        </button>
      );
    }

    let toolbar = null;
    if (toolbarChildren.length) {
      toolbar = (
        <div key={this._uniquenessKey} className="editor__toolbar">
          {toolbarChildren}
        </div>
      );
    }

    const styles = {};
    if (fontSize) {
      styles.fontSize = `${fontSize}px`;
    }

    return (
      <div className={classes} style={style} data-editor-type={type}>
        <div
          className={classnames('editor__container', 'input', className)}
          style={styles}
          onClick={onClick}
          onMouseLeave={onMouseLeave}>
          <textarea
            id={id}
            ref={this._handleInitTextarea}
            style={{ display: 'none' }}
            defaultValue=" "
            readOnly={readOnly}
            autoComplete="off"
          />
        </div>
        {toolbar}
      </div>
    );
  }
}

CodeEditor.propTypes = {
  onChange: PropTypes.func,
  onCursorActivity: PropTypes.func,
  onFocus: PropTypes.func,
  onBlur: PropTypes.func,
  onClickLink: PropTypes.func,
  onKeyDown: PropTypes.func,
  onMouseLeave: PropTypes.func,
  onClick: PropTypes.func,
  onPaste: PropTypes.func,
  onCodeMirrorInit: PropTypes.func,
  render: PropTypes.func,
  nunjucksPowerUserMode: PropTypes.bool,
  getRenderContext: PropTypes.func,
  getAutocompleteConstants: PropTypes.func,
  keyMap: PropTypes.string,
  mode: PropTypes.string,
  id: PropTypes.string,
  placeholder: PropTypes.string,
  lineWrapping: PropTypes.bool,
  hideLineNumbers: PropTypes.bool,
  hideGutters: PropTypes.bool,
  noMatchBrackets: PropTypes.bool,
  hideScrollbars: PropTypes.bool,
  fontSize: PropTypes.number,
  indentSize: PropTypes.number,
  defaultValue: PropTypes.string,
  tabIndex: PropTypes.number,
  autoPrettify: PropTypes.bool,
  manualPrettify: PropTypes.bool,
  noLint: PropTypes.bool,
  noDragDrop: PropTypes.bool,
  noStyleActiveLine: PropTypes.bool,
  className: PropTypes.any,
  style: PropTypes.object,
  updateFilter: PropTypes.func,
  defaultTabBehavior: PropTypes.bool,
  readOnly: PropTypes.bool,
  type: PropTypes.string,
  filter: PropTypes.string,
  filterHistory: PropTypes.arrayOf(PropTypes.string.isRequired),
  singleLine: PropTypes.bool,
  debounceMillis: PropTypes.number,
  dynamicHeight: PropTypes.bool,
  hintOptions: PropTypes.object,
  lintOptions: PropTypes.object,
  infoOptions: PropTypes.object,
  jumpOptions: PropTypes.object,
  uniquenessKey: PropTypes.any
};

export default CodeEditor;
