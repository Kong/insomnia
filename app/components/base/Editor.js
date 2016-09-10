import React, {Component, PropTypes} from 'react';
import {getDOMNode} from 'react-dom';
import CodeMirror from 'codemirror';
import classnames from 'classnames';
import JSONPath from 'jsonpath-plus';
import xml2js from 'xml2js';
import xpath from 'xml2js-xpath';
import {DEBOUNCE_MILLIS} from '../../lib/constants';
import 'codemirror/mode/css/css';
import 'codemirror/mode/htmlmixed/htmlmixed';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/go/go';
import 'codemirror/mode/shell/shell';
import 'codemirror/mode/clike/clike';
import 'codemirror/mode/mllike/mllike';
import 'codemirror/mode/php/php';
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
import {getModal} from '../modals/index';
import AlertModal from '../modals/AlertModal';
import Link from '../base/Link';


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
    "Ctrl-Q": function (cm) {
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
    this.codeMirror.on('change', this._codemirrorValueChanged.bind(this));
    this.codeMirror.on('paste', this._codemirrorValueChanged.bind(this));
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

  _formatJSON (code) {
    try {
      let obj = JSON.parse(code);

      if (this.props.updateFilter && this.state.filter) {
        obj = JSONPath({json: obj, path: this.state.filter});
      }

      code = JSON.stringify(obj, null, '\t');
    } catch (e) {
      // That's Ok, just leave it
    }

    return Promise.resolve(code);
  }

  _formatXML (code) {
    return new Promise(resolve => {
      xml2js.parseString(code, (err, obj) => {
        if (err) {
          resolve(code);
          return;
        }

        if (this.props.updateFilter && this.state.filter) {
          obj = xpath.find(obj, this.state.filter);
        }

        const builder = new xml2js.Builder({
          renderOpts: {
            pretty: true,
            indent: '\t'
          }
        });
        const xml = builder.buildObject(obj);

        resolve(xml);
      });
    })
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

    // Debounce URL changes so we don't update the app so much
    clearTimeout(this._timeout);
    this._timeout = setTimeout(() => {
      // Update our cached value
      var newValue = doc.getValue();
      this.props.onChange(newValue);
    }, DEBOUNCE_MILLIS)
  }

  /**
   * Sets the CodeMirror value without triggering the onChange event
   * @param code the code to set in the editor
   */
  _codemirrorSetValue (code) {
    this._originalCode = code;
    this._ignoreNextChange = true;

    let promise;
    if (this.props.prettify) {
      if (this._isXML(this.props.mode)) {
        promise = this._formatXML(code);
      } else {
        promise = this._formatJSON(code);
      }
    } else {
      promise = Promise.resolve(code);
    }

    promise.then(code => this.codeMirror.setValue(code));
  }

  _handleFilterChange (filter) {
    clearTimeout(this._filterTimeout);
    this._filterTimeout = setTimeout(() => {
      this.setState({filter});
      this._codemirrorSetValue(this._originalCode);
      if (this.props.updateFilter) {
        this.props.updateFilter(filter);
      }
    }, DEBOUNCE_MILLIS);
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

    getModal(AlertModal).show({
      headerName: 'Response Filtering Help',
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
              <td>Get books costing more than $10</td>
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
    this._codemirrorSetOptions();
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

    let filterElement = null;
    if (this.props.updateFilter && (this._isJSON(mode) || this._isXML(mode))) {
      filterElement = (
        <div className="editor__filter">
          <div className="form-control form-control--outlined">
            <input
              type="text"
              defaultValue={filter || ''}
              placeholder={this._isJSON(mode) ? '$.store.books[*].author' : '/store/books/author'}
              onChange={e => this._handleFilterChange(e.target.value)}
            />
          </div>
          <button className="btn btn--compact"
                  onClick={() => this._showFilterHelp()}>
            <i className="fa fa-question-circle"></i>
          </button>
        </div>
      )
    }

    return (
      <div className={classes} style={{fontSize: `${fontSize || 12}px`}}>
        <textarea
          ref={n => this._initEditor(n)}
          readOnly={readOnly}
          autoComplete='off'>
        </textarea>
        {filterElement}
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
  prettify: PropTypes.bool,
  className: PropTypes.any,
  lightTheme: PropTypes.bool,
  updateFilter: PropTypes.func,
  filter: PropTypes.string
};

export default Editor;
