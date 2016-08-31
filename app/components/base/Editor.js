import React, {Component, PropTypes} from 'react';
import {getDOMNode} from 'react-dom';
import CodeMirror from 'codemirror';
import classnames from 'classnames';
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

// Modes

// CSS

// Plugins

// App styles

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
  constructor () {
    super();
    this.state = {isFocused: false}
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

    setTimeout(() => {
      this._codemirrorSetValue(value || '');
    }, 50);

    this._codemirrorSetOptions();
  }

  /**
   * Sets options on the CodeMirror editor while also sanitizing them
   */
  _codemirrorSetOptions () {
    // Clone first so we can modify it
    let options = {
      placeholder: this.props.placeholder || '',
      mode: this.props.mode || 'text/plain',
      readOnly: this.props.readOnly || false,
      lineWrapping: !!this.props.lineWrapping
    };

    // Strip of charset if there is one
    options.mode = options.mode ? options.mode.split(';')[0] : 'text/plain';

    if (options.mode.indexOf('application/json') !== -1) {
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
    this._ignoreNextChange = true;

    if (this.props.prettify) {
      try {
        code = JSON.stringify(JSON.parse(code), null, '\t');
      } catch (e) {
        // That's Ok, just leave it
        // TODO: support more than just JSON prettifying
      }
    }

    this.codeMirror.setValue(code);
  }

  componentDidUpdate () {
    this._codemirrorSetOptions();
  }

  render () {
    const {readOnly, fontSize, lightTheme} = this.props;

    const classes = classnames(
      'editor',
      this.props.className,
      {
        'editor--readonly': readOnly,
        'editor--light-theme': !!lightTheme,
        'editor--dark-theme': !lightTheme
      }
    );

    return (
      <div className={classes} style={{fontSize: `${fontSize || 12}px`}}>
          <textarea
            ref={n => this._initEditor(n)}
            readOnly={readOnly}
            autoComplete='off'>
          </textarea>
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
  lightTheme: PropTypes.bool
};

export default Editor;
