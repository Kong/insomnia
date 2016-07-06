import React, {Component, PropTypes} from 'react';
import {getDOMNode} from 'react-dom';
import CodeMirror from 'codemirror';

import {DEBOUNCE_MILLIS} from '../../lib/constants'

// Modes
import '../../../node_modules/codemirror/mode/css/css'
import 'codemirror/mode/htmlmixed/htmlmixed'
import 'codemirror/mode/javascript/javascript'

// CSS
import 'codemirror/lib/codemirror.css'

// Plugins
import 'codemirror/addon/fold/foldcode'
import 'codemirror/addon/fold/brace-fold'
import 'codemirror/addon/fold/comment-fold'
import 'codemirror/addon/fold/indent-fold'
import 'codemirror/addon/fold/xml-fold'

import 'codemirror/addon/search/search'
import 'codemirror/addon/search/searchcursor'

import 'codemirror/addon/selection/active-line'

import 'codemirror/addon/search/matchesonscrollbar'
import 'codemirror/addon/search/matchesonscrollbar.css'

import 'codemirror/addon/dialog/dialog'
import 'codemirror/addon/dialog/dialog.css'

import 'codemirror/addon/fold/foldgutter'
import 'codemirror/addon/fold/foldgutter.css'

import 'codemirror/addon/display/placeholder'

import 'codemirror/addon/lint/lint'
import 'codemirror/addon/lint/json-lint'
import 'codemirror/addon/lint/lint.css'

// App styles
import '../../css/components/editor.scss';

const BASE_CODEMIRROR_OPTIONS = {
  lineNumbers: true,
  placeholder: 'Start Typing...',
  foldGutter: true,
  height: 'auto',
  lineWrapping: true,
  lint: true,
  tabSize: 4,
  indentUnit: 4,
  indentWithTabs: false,
  // styleActiveLine: true,
  gutters: [
    'CodeMirror-linenumbers',
    'CodeMirror-foldgutter',
    'CodeMirror-lint-markers'
  ],
  cursorScrollMargin: 80,
  extraKeys: {
    "Ctrl-Q": function (cm) {
      cm.foldCode(cm.getCursor());
    }
  }
};

class Editor extends Component {
  constructor() {
    super();
    this.state = {isFocused: false}
  }

  componentDidMount() {
    const {value} = this.props;

    var textareaNode = this.refs.textarea;

    this.codeMirror = CodeMirror.fromTextArea(textareaNode, BASE_CODEMIRROR_OPTIONS);
    this.codeMirror.on('change', this._codemirrorValueChanged.bind(this));
    this.codeMirror.on('paste', this._codemirrorValueChanged.bind(this));
    this._currentCodemirrorValue = value || '';
    this._codemirrorSetValue(this._currentCodemirrorValue);
    this._codemirrorSetOptions();
  }

  componentWillUnmount() {
    // todo: is there a lighter-weight way to remove the cm instance?
    if (this.codeMirror) {
      this.codeMirror.toTextArea();
    }
  }

  componentDidUpdate() {
    // Don't update if no CodeMirror instance
    if (!this.codeMirror) {
      return;
    }

    const {value} = this.props;

    // Reset any options that may have changed
    this._codemirrorSetOptions();

    // Don't update if no value passed
    if (value === undefined) {
      return;
    }

    // Don't update if same value passed again
    if (this._currentCodemirrorValue === value) {
      return;
    }

    // Set the new value
    this._codemirrorSetValue(value);
  }

  /**
   * Focus the cursor to the editor
   */
  focus() {
    if (this.codeMirror) {
      this.codeMirror.focus();
    }
  }

  /**
   * Sets options on the CodeMirror editor while also sanitizing them
   */
  _codemirrorSetOptions() {
    // Clone first so we can modify it
    let options = {
      placeholder: this.props.placeholder || '',
      mode: this.props.mode || 'text/plain',
      readOnly: this.props.readOnly || false,
      lineWrapping: !!this.props.lineWrapping
    };

    // Strip of charset if there is one
    options.mode = options.mode ? options.mode.split(';')[0] : 'text/plain';

    if (options.mode === 'application/json') {
      // ld+json looks better because keys are a different color
      options.mode = 'application/ld+json';
    }

    Object.keys(options).map(key => {
      this.codeMirror.setOption(key, options[key]);
    });
  }

  /**
   * Wrapper function to add extra behaviour to our onChange event
   * @param doc CodeMirror document
   */
  _codemirrorValueChanged(doc) {
    // Debounce URL changes so we don't update the app so much
    clearTimeout(this.timeout);
    this.timeout = setTimeout(() => {
      // Update our cached value
      var newValue = doc.getValue();
      this._currentCodemirrorValue = newValue;

      // Don't trigger change event if we're ignoring changes
      if (this._ignoreNextChange || !this.props.onChange) {
        this._ignoreNextChange = false;
        return;
      }

      this.props.onChange(newValue);
    }, DEBOUNCE_MILLIS)
  }

  /**
   * Sets the CodeMirror value without triggering the onChange event
   * @param code the code to set in the editor
   */
  _codemirrorSetValue(code) {
    this._ignoreNextChange = true;

    if (this.props.prettify) {
      if (this.props.mode === 'application/json') {
        try {
          code = JSON.stringify(JSON.parse(code), null, 4);
        } catch (e) {
        }
      }
    }

    this.codeMirror.setValue(code);
  }

  shouldComponentUpdate(nextProps) {
    // NOTE: This is pretty fragile but we really want to limit editor renders as much as
    // possible

    for (let key in nextProps) {
      if (nextProps.hasOwnProperty(key)) {
        if (typeof nextProps[key] === 'function') {
          // TODO: compare functions. We don't now because we're passing in anonymous ones
          continue;
        }

        if (nextProps[key] !== this.props[key]) {
          // Props difference found. Re-render
          return true;
        }
      }
    }

    return false;
  }

  render() {
    const classes = [
      'editor',
      this.props.className,
      this.props.readOnly ? 'editor--readonly' : ''
    ];

    const {path, value, readOnly} = this.props;

    return (
      <div className={classes.join(' ')}>
          <textarea
            name={path}
            ref='textarea'
            defaultValue={value}
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
  line: PropTypes.string,
  path: PropTypes.string,
  value: PropTypes.string,
  prettify: PropTypes.bool,
  className: PropTypes.any
};

export default Editor;
