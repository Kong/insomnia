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
import 'codemirror/addon/fold/foldgutter';
import 'codemirror/addon/fold/foldgutter.css';
import 'codemirror/addon/display/placeholder';
import 'codemirror/addon/lint/lint';
import 'codemirror/addon/lint/json-lint';
import 'codemirror/addon/lint/lint.css';
import 'codemirror/addon/mode/overlay';
import 'codemirror/keymap/vim';
import 'codemirror/keymap/emacs';
import 'codemirror/keymap/sublime';
import '../../css/components/editor.less';
import {showModal} from '../modals/index';
import AlertModal from '../modals/AlertModal';
import Link from '../base/Link';
import * as misc from '../../../common/misc';
import {trackEvent} from '../../../analytics/index';
// Make jsonlint available to the jsonlint plugin
import {parser as jsonlint} from 'jsonlint';
import {prettifyJson} from '../../../common/prettify';
global.jsonlint = jsonlint;


const BASE_CODEMIRROR_OPTIONS = {
  lineNumbers: true,
  placeholder: 'Start Typing...',
  foldGutter: true,
  height: 'auto',
  lineWrapping: true,
  lint: true,
  tabSize: 4,
  matchBrackets: true,
  autoCloseBrackets: true,
  indentUnit: 4,
  indentWithTabs: true,
  keyMap: 'default',
  gutters: [
    'CodeMirror-linenumbers',
    'CodeMirror-foldgutter',
    'CodeMirror-lint-markers'
  ],
  cursorScrollMargin: 12, // NOTE: This is px
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
    // todo: is there a lighter-weight way to remove the cm instance?
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

    // Add overlay to editor to make all links clickable
    CodeMirror.defineMode('clickable', (config, parserConfig) => {
      const baseMode = CodeMirror.getMode(config, parserConfig.baseMode || 'text/plain');

      // Only add the click mode if we have links to click
      if (!this.props.onClickLink) {
        return baseMode;
      }

      const overlay = {
        token: function (stream, state) {
          // console.log('state', state);
          if (stream.match(/^(https?:\/\/)?([\da-z.\-]+)\.([a-z.]{2,6})([\/\w .\-]*)*\/?/, true)) {
            return 'clickable';
          }

          while (stream.next() != null && !stream.match("http", false)) {
            // Do nothing
          }

          return null;
        }
      };

      return CodeMirror.overlayMode(baseMode, overlay, true);
    });

    this.codeMirror = CodeMirror.fromTextArea(textarea, BASE_CODEMIRROR_OPTIONS);
    this.codeMirror.on('change', misc.debounce(this._codemirrorValueChanged.bind(this)));
    this.codeMirror.on('paste', misc.debounce(this._codemirrorValueChanged.bind(this)));
    if (!this.codeMirror.getOption('indentWithTabs')) {
      this.codeMirror.setOption('extraKeys', {
        Tab: cm => {
          const spaces = Array(this.codeMirror.getOption('indentUnit') + 1).join(' ');
          cm.replaceSelection(spaces);
        }
      });
    }

    // Do this a bit later so we don't block the render process
    setTimeout(() => this._codemirrorSetValue(value || ''), 50);

    this._codemirrorSetOptions();
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
    if (this._isXML(this.props.mode)) {
      code = this._prettifyXML(code);
    } else {
      code = this._prettifyJSON(code);
    }

    this.codeMirror.setValue(code);
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
    // Clone first so we can modify it
    const readOnly = this.props.readOnly || false;

    const normalizedMode = this.props.mode ? this.props.mode.split(';')[0] : 'text/plain';

    let options = {
      readOnly,
      placeholder: this.props.placeholder || '',
      mode: {
        name: 'clickable',
        baseMode: normalizedMode,
      },
      lineWrapping: this.props.lineWrapping,
      keyMap: this.props.keyMap || 'default',
      matchBrackets: !readOnly,
      lint: !readOnly
    };

    // Strip of charset if there is one
    Object.keys(options).map(key => {
      this.codeMirror.setOption(key, options[key]);
    });
  }

  /**
   * Wrapper function to add extra behaviour to our onChange event
   * @param doc CodeMirror document
   */
  _codemirrorValueChanged (doc) {

    // Don't trigger change event if we're ignoring changes
    if (this._ignoreNextChange || !this.props.onChange) {
      this._ignoreNextChange = false;
      return;
    }

    this.props.onChange(doc.getValue());
  }

  /**
   * Sets the CodeMirror value without triggering the onChange event
   * @param code the code to set in the editor
   */
  _codemirrorSetValue (code) {
    this._originalCode = code;
    this._ignoreNextChange = true;

    if (this.props.autoPrettify && this._canPrettify()) {
      this._prettify(code);
    } else {
      this.codeMirror.setValue(code || '');
    }
  }

  _handleFilterChange (filter) {
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
  }

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
    setTimeout(() => {
      this._codemirrorSetOptions();
    }, 50);
  }

  render () {
    const {readOnly, fontSize, lightTheme, mode, filter} = this.props;

    const classes = classnames(
      'editor',
      this.props.className,
      {
        'editor--readonly': readOnly,
        'editor--light-theme': !!lightTheme,
        'editor--dark-theme': !lightTheme
      }
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
          onChange={e => this._handleFilterChange(e.target.value)}
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
  keyMap: PropTypes.string,
  mode: PropTypes.string,
  placeholder: PropTypes.string,
  lineWrapping: PropTypes.bool,
  fontSize: PropTypes.number,
  value: PropTypes.string,
  autoPrettify: PropTypes.bool,
  manualPrettify: PropTypes.bool,
  className: PropTypes.any,
  lightTheme: PropTypes.bool,
  updateFilter: PropTypes.func,
  filter: PropTypes.string
};

export default Editor;
