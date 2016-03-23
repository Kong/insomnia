import React, {Component, PropTypes} from 'react';
import {getDOMNode} from 'react-dom';
import CodeMirror from 'codemirror';

// Modes
import '../../../node_modules/codemirror/mode/css/css';
import 'codemirror/mode/htmlmixed/htmlmixed';
import 'codemirror/mode/javascript/javascript';

// CSS
import 'codemirror/lib/codemirror.css'

// Plugins
import 'codemirror/addon/fold/foldcode';
import 'codemirror/addon/fold/brace-fold';
import 'codemirror/addon/fold/comment-fold';
import 'codemirror/addon/fold/indent-fold';
import 'codemirror/addon/fold/xml-fold';

import 'codemirror/addon/fold/foldgutter';
import 'codemirror/addon/fold/foldgutter.css';

// TODO: Figure out how to lint (json-lint doesn't build in webpack environment)
// import 'codemirror/addon/lint/lint';
// import 'codemirror/addon/lint/json-lint';
// import 'codemirror/addon/lint/html-lint';
// import 'codemirror/addon/lint/lint.css';
// import * as jsonlint from 'jsonlint';
// import * as htmlhint from 'htmlhint';

// window.jsonlint = jsonlint;
// window.htmlhint = htmlhint;

// CSS Themes
import 'codemirror/theme/material.css'
import 'codemirror/theme/railscasts.css'
import 'codemirror/theme/tomorrow-night-bright.css'
import 'codemirror/theme/tomorrow-night-eighties.css'
import 'codemirror/theme/ambiance.css'
import 'codemirror/theme/mbo.css'
import 'codemirror/theme/pastel-on-dark.css'
import 'codemirror/theme/seti.css'
import 'codemirror/theme/monokai.css'

// App styles
import '../../css/components/editor.scss';

const DEFAULT_DEBOUNCE_MILLIS = 500;

const BASE_CODEMIRROR_OPTIONS = {
  theme: 'monokai',
  lineNumbers: true,
  foldGutter: true,
  height: 'auto',
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

  constructor () {
    super();
    this.state = {isFocused: false}
  }

  componentDidMount () {
    var textareaNode = this.refs.textarea;

    this.codeMirror = CodeMirror.fromTextArea(textareaNode, BASE_CODEMIRROR_OPTIONS);
    this.codeMirror.on('change', this._codemirrorValueChanged.bind(this));
    this.codeMirror.on('paste', this._codemirrorValueChanged.bind(this));
    this._currentCodemirrorValue = this.props.defaultValue || this.props.value || '';
    this._codemirrorSetValue(this._currentCodemirrorValue);
    this._codemirrorSetOptions(this.props.options);
  }

  componentWillUnmount () {
    // todo: is there a lighter-weight way to remove the cm instance?
    if (this.codeMirror) {
      this.codeMirror.toTextArea();
    }
  }

  componentWillReceiveProps (nextProps) {
    // Don't update if no CodeMirror instance
    if (!this.codeMirror) {
      return;
    }

    // Don't update if no value passed
    if (nextProps.value === undefined) {
      return;
    }

    // Don't update if same value passed again
    if (this._currentCodemirrorValue === nextProps.value) {
      return;
    }

    // Set the new value
    this._codemirrorSetValue(nextProps.value);

    // Reset any options that may have changed
    this._codemirrorSetOptions(nextProps.options);
  }

  /**
   * Focus the cursor to the editor
   */
  focus () {
    if (this.codeMirror) {
      this.codeMirror.focus();
    }
  }

  /**
   * Sets options on the CodeMirror editor while also sanitizing them
   * @param options
   */
  _codemirrorSetOptions (options) {
    if (options.mode === 'json') {
      options.mode = 'application/json';
    }

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
  _codemirrorValueChanged (doc) {
    // Update our cached value
    var newValue = doc.getValue();
    this._currentCodemirrorValue = newValue;

    // Don't trigger change event if we're ignoring changes
    if (this._ignoreNextChange || !this.props.onChange) {
      this._ignoreNextChange = false;
      return;
    }

    // Do the debounce in a closure so the callback doesn't change while we're waiting
    const debounceMillis = this.props.debounceMillis || DEFAULT_DEBOUNCE_MILLIS;
    ((v, cb, millis) => {
      clearTimeout(this._timeout);
      this._timeout = setTimeout(() => cb(v), millis);
    })(newValue, this.props.onChange, debounceMillis);
  }

  /**
   * Sets the CodeMirror value without triggering the onChange event
   * @param code the code to set in the editor
   */
  _codemirrorSetValue (code) {
    this._ignoreNextChange = true;
    this.codeMirror.setValue(code);
  }

  render () {
    return (
      <div className={`editor ${this.props.className || ''}`}>
        <textarea
          name={this.props.path}
          ref='textarea'
          defaultValue={this.props.value}
          autoComplete='off'>
        </textarea>
      </div>
    );
  }
}

Editor.propTypes = {
  onChange: PropTypes.func,
  onFocusChange: PropTypes.func,
  options: PropTypes.object,
  path: PropTypes.string,
  value: PropTypes.string,
  className: PropTypes.any,
  debounceMillis: PropTypes.number
};

export default Editor;
