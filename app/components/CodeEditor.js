import React, {Component, PropTypes} from 'react';
import {getDOMNode} from 'react-dom';
import CodeMirror from 'codemirror';

// Modes
import 'codemirror/mode/css/css';
import 'codemirror/mode/htmlmixed/htmlmixed';
import 'codemirror/mode/javascript/javascript';

// CSS
import 'codemirror/lib/codemirror.css'

// Plugins
import 'codemirror/addon/scroll/simplescrollbars';
import 'codemirror/addon/scroll/simplescrollbars.css';

import 'codemirror/addon/scroll/scrollpastend';

import 'codemirror/addon/fold/foldcode';
import 'codemirror/addon/fold/brace-fold';
import 'codemirror/addon/fold/comment-fold';
import 'codemirror/addon/fold/indent-fold';
import 'codemirror/addon/fold/xml-fold';

import 'codemirror/addon/fold/foldgutter';
import 'codemirror/addon/fold/foldgutter.css';

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
import '../css/components/editor.scss';

const DEFAULT_DEBOUNCE_MILLIS = 300;

const BASE_CODEMIRROR_OPTIONS = {
  theme: 'monokai',
  lineNumbers: true,
  scrollPastEnd: true,
  foldGutter: true,
  gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
  cursorScrollMargin: 60,
  extraKeys: {
    "Ctrl-Q": function (cm) {
      cm.foldCode(cm.getCursor());
    }
  },
  scrollbarStyle: 'overlay'
};

class Editor extends Component {

  constructor () {
    super();
    this.state = {isFocused: false}
  }

  componentDidMount () {
    var textareaNode = this.refs.textarea;

    this.codeMirror = CodeMirror.fromTextArea(textareaNode, BASE_CODEMIRROR_OPTIONS);
    this.codeMirror.on('change', this.codemirrorValueChanged.bind(this));
    this.codeMirror.on('focus', this.focusChanged.bind(this, true));
    this.codeMirror.on('blur', this.focusChanged.bind(this, false));
    this.codeMirror.on('paste', this.codemirrorValueChanged.bind(this));
    this._currentCodemirrorValue = this.props.defaultValue || this.props.value || '';
    this.codemirrorSetValue(this._currentCodemirrorValue);
    this.codemirrorSetOptions(this.props.options);
  }

  componentWillUnmount () {
    // todo: is there a lighter-weight way to remove the cm instance?
    if (this.codeMirror) {
      this.codeMirror.toTextArea();
    }
  }

  componentWillReceiveProps (nextProps) {
    if (this.codeMirror && nextProps.value !== undefined && this._currentCodemirrorValue !== nextProps.value) {
      this.codemirrorSetValue(nextProps.value);
    }

    // Reset any options that may have changed
    this.codemirrorSetOptions(nextProps.options);
  }

  focus () {
    if (this.codeMirror) {
      this.codeMirror.focus();
    }
  }

  focusChanged (focused) {
    this.setState({isFocused: focused});
    this.props.onFocusChange && this.props.onFocusChange(focused);
  }

  /**
   * Set options on the CodeMirror editor while also sanitizing them
   * @param options
   */
  codemirrorSetOptions (options) {
    if (options.mode === 'json') {
      options.mode = 'application/json';
    }

    if (options.mode === 'application/json') {
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
  codemirrorValueChanged (doc) {
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
   * Set the CodeMirror value without triggering the onChange event
   * @param code the code to set in the editor
   */
  codemirrorSetValue (code) {
    this._ignoreNextChange = true;
    this.codeMirror.setValue(code);
  }

  render () {
    return (
      <div className={`editor ${this.props.className || ''}`}>
        <textarea name={this.props.path}
                  ref='textarea'
                  defaultValue={this.props.value}
                  autoComplete='off'></textarea>
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
