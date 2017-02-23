import React, {Component, PropTypes} from 'react';
import {getDOMNode} from 'react-dom';
import CodeMirror from 'codemirror';
import classnames from 'classnames';
import jq from 'jsonpath';
import vkBeautify from 'vkbeautify';
import {DOMParser} from 'xmldom';
import xpath from 'xpath';
import 'codemirror/mode/css/css';
import 'codemirror/mode/htmlmixed/htmlmixed';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/go/go';
import 'codemirror/mode/shell/shell';
import 'codemirror/mode/clike/clike';
import 'codemirror/mode/mllike/mllike';
import 'codemirror/mode/php/php';
import 'codemirror/mode/markdown/markdown';
import 'codemirror/mode/python/python';
import 'codemirror/mode/ruby/ruby';
import 'codemirror/mode/swift/swift';
import 'codemirror/lib/codemirror.css';
import 'codemirror/addon/dialog/dialog';
import 'codemirror/addon/dialog/dialog.css';
import 'codemirror/addon/fold/foldcode';
import 'codemirror/addon/fold/foldgutter';
import 'codemirror/addon/fold/foldgutter.css';
import 'codemirror/addon/fold/brace-fold';
import 'codemirror/addon/fold/comment-fold';
import 'codemirror/addon/fold/indent-fold';
import 'codemirror/addon/fold/xml-fold';
import 'codemirror/addon/search/search';
import 'codemirror/addon/search/searchcursor';
import 'codemirror/addon/edit/matchbrackets';
import 'codemirror/addon/edit/closebrackets';
import 'codemirror/addon/search/matchesonscrollbar';
import 'codemirror/addon/search/matchesonscrollbar.css';
import 'codemirror/addon/selection/active-line';
import 'codemirror/addon/selection/selection-pointer';
import 'codemirror/addon/display/placeholder';
import 'codemirror/addon/lint/lint';
import 'codemirror/addon/lint/json-lint';
import 'codemirror/addon/lint/lint.css';
import 'codemirror/addon/mode/overlay';
import 'codemirror/addon/mode/simple';
import 'codemirror/keymap/vim';
import 'codemirror/keymap/emacs';
import 'codemirror/keymap/sublime';
import '../../../css/components/editor.less';
import {showModal} from '../../modals/index';
import AlertModal from '../../modals/AlertModal';
import Link from '../../base/Link';
import * as misc from '../../../../common/misc';
import {trackEvent} from '../../../../analytics/index';
// Make jsonlint available to the jsonlint plugin
import {parser as jsonlint} from 'jsonlint';
import {prettifyJson} from '../../../../common/prettify';
global.jsonlint = jsonlint;


const BASE_CODEMIRROR_OPTIONS = {
  lineNumbers: true,
  placeholder: 'Start Typing...',
  foldGutter: true,
  maxHighlightLength: 1000, // Default 10,000
  height: 'auto',
  lineWrapping: true,
  scrollbarStyle: 'native',
  lint: true,
  tabSize: 4,
  cursorHeight: 1,
  matchBrackets: true,
  autoCloseBrackets: true,
  indentUnit: 4,
  dragDrop: true,
  viewportMargin: 30, // default 10
  selectionPointer: 'default',
  styleActiveLine: true,
  indentWithTabs: true,
  showCursorWhenSelecting: true,
  cursorScrollMargin: 12, // NOTE: This is px
  keyMap: 'default',
  gutters: [
    'CodeMirror-linenumbers',
    'CodeMirror-foldgutter',
    'CodeMirror-lint-markers'
  ],
  extraKeys: {
    'Ctrl-Q': function (cm) {
      cm.foldCode(cm.getCursor());
    }
  }
};

class Editor extends Component {
  constructor (props) {
    super(props);
    this.state = {
      filter: props.filter || ''
    };
    this._originalCode = '';
  }

  componentWillUnmount () {
    if (this.codeMirror) {
      this.codeMirror.toTextArea();
    }
  }

  /**
   * Focus the cursor to the editor
   */
  focus () {
    if (this.codeMirror) {
      this.codeMirror.focus();
    }
  }

  selectAll () {
    if (this.codeMirror) {
      this.codeMirror.setSelection(
        {line: 0, ch: 0},
        {line: this.codeMirror.lineCount(), ch: 0}
      );
    }
  }

  getValue () {
    return this.codeMirror.getValue();
  }

  _handleInitTextarea = textarea => {
    if (!textarea) {
      // Not mounted
      return;
    }

    if (this.codeMirror) {
      // Already initialized
      return;
    }

    const {value} = this.props;
    this.codeMirror = CodeMirror.fromTextArea(textarea, BASE_CODEMIRROR_OPTIONS);
    CodeMirror.defineMode('master', this._masterMode());

    // Set default listeners
    this.codeMirror.on('beforeChange', this._codemirrorValueBeforeChange);
    this.codeMirror.on('changes', misc.debounce(this._codemirrorValueChanged));
    this.codeMirror.on('paste', this._codemirrorValueChanged);

    // Setup nunjucks listeners
    this.codeMirror.on('changes', misc.debounce(this._highlightNunjucksTags));
    this.codeMirror.on('cursorActivity', misc.debounce(this._highlightNunjucksTags));
    this.codeMirror.on('viewportChange', misc.debounce(this._highlightNunjucksTags));

    if (!this.codeMirror.getOption('indentWithTabs')) {
      this.codeMirror.setOption('extraKeys', {
        Tab: cm => {
          const spaces = Array(this.codeMirror.getOption('indentUnit') + 1).join(' ');
          cm.replaceSelection(spaces);
        }
      });
    }

    this._codemirrorSetOptions();

    // Do this a bit later so we don't block the render process
    requestAnimationFrame(() => {
      this._codemirrorSetValue(value || '');
      this.codeMirror.setCursor({line: -1, ch: -1});
    });
  };

  _clickableOverlay = () => {
    // Only add the click mode if we have links to click
    const highlightLinks = !!this.props.onClickLink;
    const regexUrl = /^https?:\/\/([\da-z.\-]+)\.([a-z.]{2,6})([\/\w .\-+=;]*)*\/?/;

    return {
      token: function (stream, state) {
        if (highlightLinks && stream.match(regexUrl, true)) {
          return 'clickable';
        }

        while (stream.next() != null) {
          if (stream.match(regexUrl, false)) break;
        }

        return null;
      }
    }
  };

  _nunjucksMode = () => {
    const highlightNunjucks = !this.props.readOnly;

    const regexVariable = /^{{[^}]+}}/;
    const regexTag = /^{%[^%]+%}/;
    const regexComment = /^{#[^#]+#}/;

    return {
      token: function (stream, state) {
        if (highlightNunjucks && stream.match(regexVariable, true)) {
          return 'nunjucks nunjucks-variable';
        }

        if (highlightNunjucks && stream.match(regexTag, true)) {
          return 'nunjucks nunjucks-tag';
        }

        if (highlightNunjucks && stream.match(regexComment, true)) {
          return 'nunjucks nunjucks-comment';
        }

        while (stream.next() != null) {
          if (stream.match(regexVariable, false)) break;
          if (stream.match(regexTag, false)) break;
          if (stream.match(regexComment, false)) break;
        }

        return null;
      }
    };
  };

  // Add overlay to editor to make all links clickable
  _masterMode = () => {
    // Add overlay to editor to make all links clickable
    return (config, parserConfig) => {
      const baseMode = CodeMirror.getMode(config, parserConfig.baseMode || 'text/plain');
      const nunjucksMode = this._nunjucksMode();
      return CodeMirror.overlayMode(baseMode, nunjucksMode, false);
    };
  };

  _handleEditorClick = e => {
    if (!this.props.onClickLink) {
      return;
    }

    if (e.target.className.indexOf('cm-clickable') >= 0) {
      this.props.onClickLink(e.target.innerHTML);
    }
  };

  _isJSON (mode) {
    if (!mode) {
      return false;
    }

    return mode.indexOf('json') !== -1
  }

  _isXML (mode) {
    if (!mode) {
      return false;
    }

    return mode.indexOf('xml') !== -1
  }

  _handleBeautify () {
    trackEvent('Request', 'Beautify');
    this._prettify(this.codeMirror.getValue());
  }

  _prettify (code) {
    this._codemirrorSetValue(code, true);
  }

  _prettifyJSON (code) {
    try {
      let jsonString = code;

      if (this.props.updateFilter && this.state.filter) {
        let obj = JSON.parse(code);
        try {
          jsonString = JSON.stringify(jq.query(obj, this.state.filter));
        } catch (err) {
          jsonString = '[]';
        }
      }

      return prettifyJson(jsonString, '\t');
    } catch (e) {
      // That's Ok, just leave it
      return code;
    }
  }

  _prettifyXML (code) {
    if (this.props.updateFilter && this.state.filter) {
      try {
        const dom = new DOMParser().parseFromString(code);
        const nodes = xpath.select(this.state.filter, dom);
        const inner = nodes.map(n => n.toString()).join('\n');
        code = `<result>${inner}</result>`
      } catch (e) {
        // Failed to parse filter (that's ok)
        code = `<result></result>`
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
  _codemirrorSetOptions () {
    const {
      readOnly,
      mode,
      hideLineNumbers,
      keyMap,
      lineWrapping,
      placeholder,
      noMatchBrackets,
      hideScrollbars,
    } = this.props;

    const normalizedMode = mode ? mode.split(';')[0] : 'text/plain';

    let options = {
      readOnly,
      placeholder: placeholder || '',
      mode: {
        name: 'master',
        baseMode: normalizedMode,
      },
      scrollbarStyle: hideScrollbars ? 'null' : 'native',
      lineNumbers: !hideLineNumbers,
      lineWrapping: lineWrapping,
      keyMap: keyMap || 'default',
      matchBrackets: !noMatchBrackets,
      lint: !readOnly
    };

    const cm = this.codeMirror;

    // Strip of charset if there is one
    Object.keys(options).map(key => {
      // Don't set the option if it hasn't changed
      if (options[key] === cm.options[key]) {
        return;
      }

      // Since mode is an object, let's compare the inner baseMode instead
      if (key === 'mode' && options.mode.baseMode === cm.options.mode.baseMode) {
        return;
      }

      cm.setOption(key, options[key]);
    });

    // Add overlays;
    // this.codeMirror.addOverlay(this._nunjucksOverlay());
    this.codeMirror.addOverlay(this._clickableOverlay());
  }

  _codemirrorValueBeforeChange = (doc, change) => {
    // If we're in single-line mode, merge all changed lines into one
    if (this.props.singleLine && change.text.length > 1) {
      const text = change.text.join('');
      const from = {ch: change.from.ch, line: 0};
      const to = {ch: from.ch + text.length, line: 0};
      change.update(from, to, [text]);
    }
  };

  /**
   * Wrapper function to add extra behaviour to our onChange event
   * @param doc CodeMirror document
   */
  _codemirrorValueChanged = doc => {
    // Don't trigger change event if we're ignoring changes
    if (this._ignoreNextChange || !this.props.onChange) {
      this._ignoreNextChange = false;
      return;
    }

    this.props.onChange(doc.getValue());
  };

  /**
   * Sets the CodeMirror value without triggering the onChange event
   * @param code the code to set in the editor
   * @param forcePrettify
   */
  _codemirrorSetValue (code, forcePrettify = false) {
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

    this._highlightNunjucksTags();
  }

  _highlightNunjucksTags = () => {
    // Bail early if we can't even render
    if (!this.props.render) {
      return;
    }

    // Define a cache key that we can use for rendering
    // const renderCacheKey = Math.random() + '';
    const renderCacheKey = Math.random() + '';
    const renderString = text => this.props.render(text, true, renderCacheKey);

    // Only mark up Nunjucks tokens that are in the viewport
    const vp = this.codeMirror.getViewport();
    for (let lineNo = vp.from; lineNo < vp.to; lineNo++) {
      const line = this.codeMirror.getLineTokens(lineNo);
      const tokens = line.filter(({type}) => type && type.indexOf('nunjucks') >= 0);

      // Aggregate same tokens
      const newTokens = [];
      let currTok = null;
      for (let i = 0; i < tokens.length; i++) {
        const nextTok = tokens[i];

        if (currTok && currTok.type === nextTok.type && currTok.end === nextTok.start) {
          currTok.end = nextTok.end;
          currTok.string += nextTok.string;
        } else if (currTok) {
          newTokens.push(currTok);
          currTok = null;
        }

        if (!currTok) {
          currTok = Object.assign({}, nextTok);
        }
      }

      // Push the last one if we're done
      if (currTok) {
        newTokens.push(currTok);
      }

      for (const tok of newTokens) {
        const start = {line: lineNo, ch: tok.start};
        const end = {line: lineNo, ch: tok.end};
        const cursor = this.codeMirror.getDoc().getCursor();
        const isSameLine = cursor.line === lineNo;
        const isCursorInToken = cursor.ch >= tok.start && cursor.ch <= tok.end;
        const isFocused = this.codeMirror.hasFocus();

        // Show the token again if we're not inside of it.
        if (isFocused && isSameLine && isCursorInToken) {
          continue;
        }

        // See if we already have a mark for this
        const existingMarks = this.codeMirror.findMarks(start, end);
        if (existingMarks.length) {
          continue;
        }

        (async () => {
          const element = document.createElement('span');
          element.className = `nunjucks-widget ${tok.type}`;
          element.setAttribute('data-active', 'off');
          element.setAttribute('data-error', 'off');

          await Editor._updateElementText(renderString, element, tok.string);

          const marker = this.codeMirror.markText(start, end, {
            handleMouseEvents: false,
            replacedWith: element,
          });

          element.addEventListener('click', e => {
            element.setAttribute('data-active', 'on');

            // Define the dialog HTML
            const html = [
              '<div class="nunjucks-dialog" style="width:100%">',
              '<input type="text" name="template"/>',
              `<span style="margin-top:0.2em">${element.title}</spans>`,
              '</div>',
              '<button style="font-size:1.5em;padding:0 0.5em;">&times;</button>',
            ].join(' ');

            const dialogOptions = {
              __dirty: false,
              value: tok.string,
              selectValueOnOpen: true,
              closeOnEnter: true,
              async onClose () {
                element.removeAttribute('data-active');

                // Revert string back to original if it's changed
                if (this.dirty) {
                  await Editor._updateElementText(renderString, element, tok.string);
                  marker.changed();
                }
              },
              async onInput (e, text) {
                this.dirty = true;

                clearTimeout(this.__timeout);
                this.__timeout = setTimeout(async () => {
                  const el = e.target.parentNode.querySelector('.result');
                  await Editor._updateElementText(renderString, el, text, true);
                }, 600);
              }
            };

            this.codeMirror.openDialog(html, text => {
              // Replace the text with the newly edited stuff
              const {from, to} = marker.find();
              this.codeMirror.replaceRange(text, from, to);

              // Clear the marker so it doesn't mess us up later on.
              marker.clear();
            }, dialogOptions);
          });
        })();
      }
    }
  };

  static async _updateElementText (render, el, text, preview = false) {
    try {
      const str = text.replace(/\\/g, '');
      const tagMatch = str.match(/{% *(\w+).*%}/);
      const cleanedStr = str
        .replace(/^{%/, '')
        .replace(/%}$/, '')
        .replace(/^{{/, '')
        .replace(/}}$/, '')
        .trim();

      let innerHTML = '';

      if (tagMatch) {
        const tag = tagMatch[1];

        // Don't render other tags because they may be two-parters
        // eg. {% for %}...{% endfor %}
        const cleaned = cleanedStr.replace(tag, '').trim();
        innerHTML = `<label>${tag}</label> ${cleaned}`.trim();

        if (['uuid', 'timestamp', 'now'].includes(tag)) {
          // Try rendering these so we can show errors if needed
          const v = await render(str);
          el.title = v;
          innerHTML = preview ? v : innerHTML;
        } else {
          el.setAttribute('data-ignore', 'on');
        }
      } else {
        // Render if it's a variable
        const v = await render(str);
        el.title = v;
        innerHTML = preview ? v : `${cleanedStr}`.trim();
      }

      el.innerHTML = innerHTML;
      el.setAttribute('data-error', 'off');
    } catch (err) {
      const fullMessage = err.message.replace(/\[.+,.+]\s*/, '');
      let message = fullMessage;
      if (message.length > 30) {
        message = `${message.slice(0, 27)}&hellip;`
      }
      el.innerHTML = `&#x203c; ${message}`;
      el.className += ' nunjucks-widget--error';
      el.setAttribute('data-error', 'on');
      el.title = fullMessage;
    }
  }

  _handleFilterChange = e => {
    const filter = e.target.value;

    clearTimeout(this._filterTimeout);
    this._filterTimeout = setTimeout(() => {
      this.setState({filter});
      this._codemirrorSetValue(this._originalCode);
      if (this.props.updateFilter) {
        this.props.updateFilter(filter);
      }
    }, 400);

    // So we don't track on every keystroke, give analytics a longer timeout
    clearTimeout(this._analyticsTimeout);
    const json = this._isJSON(this.props.mode);
    this._analyticsTimeout = setTimeout(() => {
      trackEvent(
        'Response',
        `Filter ${json ? 'JSONPath' : 'XPath'}`,
        `${filter ? 'Change' : 'Clear'}`
      );
    }, 2000);
  };

  _canPrettify () {
    const {mode} = this.props;
    return this._isJSON(mode) || this._isXML(mode);
  }

  _showFilterHelp () {
    const json = this._isJSON(this.props.mode);
    const link = json ? (
        <Link href="http://goessner.net/articles/JsonPath/">
          JSONPath
        </Link>
      ) : (
        <Link href="https://www.w3.org/TR/xpath/">
          XPath
        </Link>
      );

    trackEvent('Response', `Filter ${json ? 'JSONPath' : 'XPath'}`, 'Help');

    showModal(AlertModal, {
      title: 'Response Filtering Help',
      message: (
        <div>
          <p>
            Use {link} to filter the response body. Here are some examples that
            you might use on a book store API.
          </p>
          <table className="pad-top-sm">
            <tbody>
            <tr>
              <td>
                <code className="selectable">
                  {json ? '$.store.books[*].title' : '/store/books/title'}
                </code>
              </td>
              <td>Get titles of all books in the store</td>
            </tr>
            <tr>
              <td>
                <code className="selectable">
                  {json ? '$.store.books[?(@.price < 10)].title' : '/store/books[price < 10]'}
                </code>
              </td>
              <td>Get books costing less than $10</td>
            </tr>
            <tr>
              <td>
                <code className="selectable">
                  {json ? '$.store.books[-1:]' : '/store/books[last()]'}
                </code>
              </td>
              <td>Get the last book in the store</td>
            </tr>
            <tr>
              <td>
                <code className="selectable">
                  {json ? '$.store.books.length' : 'count(/store/books)'}
                </code>
              </td>
              <td>Get the number of books in the store</td>
            </tr>
            </tbody>
          </table>
        </div>
      )
    })
  }

  componentDidUpdate () {
    // Don't don it sync because it might block the UI
    setTimeout(() => this._codemirrorSetOptions(), 50);
  }

  render () {
    const {readOnly, fontSize, mode, filter} = this.props;

    const classes = classnames(
      'editor',
      this.props.className,
      {'editor--readonly': readOnly}
    );

    const toolbarChildren = [];
    if (this.props.updateFilter && (this._isJSON(mode) || this._isXML(mode))) {
      toolbarChildren.push(
        <input
          key="filter"
          type="text"
          title="Filter response body"
          defaultValue={filter || ''}
          placeholder={this._isJSON(mode) ? '$.store.books[*].author' : '/store/books/author'}
          onChange={this._handleFilterChange}
        />
      );
      toolbarChildren.push(
        <button key="help"
                className="btn btn--compact"
                onClick={() => this._showFilterHelp()}>
          <i className="fa fa-question-circle"></i>
        </button>
      )
    }

    if (this.props.manualPrettify && this._canPrettify()) {
      let contentTypeName = '';
      if (this._isJSON(mode)) {
        contentTypeName = 'JSON'
      } else if (this._isXML(mode)) {
        contentTypeName = 'XML'
      }

      toolbarChildren.push(
        <button key="prettify"
                className="btn btn--compact"
                title="Auto-format request body whitespace"
                onClick={() => this._handleBeautify()}>
          Beautify {contentTypeName}
        </button>
      )
    }

    let toolbar = null;
    if (toolbarChildren.length) {
      toolbar = <div className="editor__toolbar">{toolbarChildren}</div>;
    }

    return (
      <div className={classes} style={{fontSize: `${fontSize || 12}px`}}>
        <div className="editor__container" onClick={this._handleEditorClick}>
          <textarea
            ref={this._handleInitTextarea}
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

Editor.propTypes = {
  onChange: PropTypes.func,
  onFocusChange: PropTypes.func,
  onClickLink: PropTypes.func,
  render: PropTypes.func,
  keyMap: PropTypes.string,
  mode: PropTypes.string,
  placeholder: PropTypes.string,
  lineWrapping: PropTypes.bool,
  hideLineNumbers: PropTypes.bool,
  noMatchBrackets: PropTypes.bool,
  hideScrollbars: PropTypes.bool,
  fontSize: PropTypes.number,
  value: PropTypes.string,
  autoPrettify: PropTypes.bool,
  manualPrettify: PropTypes.bool,
  className: PropTypes.any,
  updateFilter: PropTypes.func,
  readOnly: PropTypes.bool,
  filter: PropTypes.string,
  singleLine: PropTypes.bool,
};

export default Editor;
