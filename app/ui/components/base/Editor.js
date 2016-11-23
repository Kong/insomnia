import React, {Component, PropTypes} from 'react';
import {getDOMNode} from 'react-dom';
import CodeMirror from 'codemirror';
import classnames from 'classnames';
import JSONPath from 'jsonpath-plus';
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
import 'codemirror/addon/display/autorefresh';
import 'codemirror/addon/search/search';
import 'codemirror/addon/search/searchcursor';
import 'codemirror/addon/edit/matchbrackets';
import 'codemirror/addon/search/matchesonscrollbar';
import 'codemirror/addon/search/matchesonscrollbar.css';
import 'codemirror/addon/fold/foldgutter';
import 'codemirror/addon/fold/foldgutter.css';
import 'codemirror/addon/display/placeholder';
import 'codemirror/addon/lint/lint';
import 'codemirror/addon/lint/json-lint';
import 'codemirror/addon/lint/lint.css';
import '../../css/components/editor.less';
import {showModal} from '../modals/index';
import AlertModal from '../modals/AlertModal';
import Link from '../base/Link';
import * as misc from '../../../common/misc';
import {trackEvent} from '../../../analytics/index';


const BASE_CODEMIRROR_OPTIONS = {
  lineNumbers: true,
  placeholder: 'Start Typing...',
  foldGutter: true,
  height: 'auto',
  autoRefresh: {delay: 250}, // Necessary to show up in the env modal first launch
  lineWrapping: true,
  lint: true,
  tabSize: 4,
  matchBrackets: true,
  indentUnit: 4,
  indentWithTabs: true,
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

  _initEditor (textarea) {
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
    this.codeMirror.on('change', misc.debounce(this._codemirrorValueChanged.bind(this)));
    this.codeMirror.on('paste', misc.debounce(this._codemirrorValueChanged.bind(this)));
    if (!this.codeMirror.getOption('indentWithTabs')) {
      this.codeMirror.setOption('extraKeys', {
        Tab: cm => {
          var spaces = Array(this.codeMirror.getOption('indentUnit') + 1).join(' ');
          cm.replaceSelection(spaces);
        }
      });
    }

    // Do this a bit later so we don't block the render process
    setTimeout(() => {
      this._codemirrorSetValue(value || '');
    }, 50);

    this._codemirrorSetOptions();
  }

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

  async _prettify (code) {
    if (this._isXML(this.props.mode)) {
      code = this._formatXML(code);
    } else {
      code = this._formatJSON(code);
    }

    this.codeMirror.setValue(code);
  }

  _formatJSON (code) {
    try {
      let obj = JSON.parse(code);

      if (this.props.updateFilter && this.state.filter) {
        obj = JSONPath({json: obj, path: this.state.filter});
      }

      return vkBeautify.json(obj, '\t');
    } catch (e) {
      // That's Ok, just leave it
      return code;
    }
  }

  _formatXML (code) {
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

    let options = {
      readOnly,
      placeholder: this.props.placeholder || '',
      mode: this.props.mode || 'text/plain',
      lineWrapping: !!this.props.lineWrapping,
      matchBrackets: !readOnly,
      lint: !readOnly
    };

    // Strip of charset if there is one
    options.mode = options.mode ? options.mode.split(';')[0] : 'text/plain';

    if (this._isJSON(options.mode)) {
      // set LD JSON because it highlights the keys a different color
      options.mode = {name: 'javascript', jsonld: true}
    }

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

    var newValue = doc.getValue();
    this.props.onChange(newValue);
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
      this.codeMirror.setValue(code);
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
      <Link
        href="https://www.w3.org/TR/xpath/">
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
              <td><code className="selectable">
                {json ? '$.store.books[*].title' : '/store/books/title'}
              </code>
              </td>
              <td>Get titles of all books in the store</td>
            </tr>
            <tr>
              <td><code className="selectable">
                {json ? '$.store.books[?(@.price < 10)].title' : '/store/books[price < 10]'}
              </code></td>
              <td>Get books costing less than $10</td>
            </tr>
            <tr>
              <td><code className="selectable">
                {json ? '$.store.books[-1:]' : '/store/books[last()]'}
              </code></td>
              <td>Get the last book in the store</td>
            </tr>
            <tr>
              <td><code className="selectable">
                {json ? '$.store.books.length' : 'count(/store/books)'}
              </code></td>
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
        <div className="editor__container">
          <textarea
            ref={n => this._initEditor(n)}
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
