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

class Editor extends Component {

  constructor () {
    super();
    this.state = {
      isFocused: false
    }
  }

  componentDidMount () {
    var textareaNode = this.refs.textarea;

    this.codeMirror = CodeMirror.fromTextArea(textareaNode);
    this.codeMirror.on('change', this.codemirrorValueChanged.bind(this));
    this.codeMirror.on('focus', this.focusChanged.bind(this, true));
    this.codeMirror.on('blur', this.focusChanged.bind(this, false));
    this._currentCodemirrorValue = this.props.defaultValue || this.props.value || '';
    this._ignoreNextChange = true;
    this.codemirrorSetOptions(this.props.options);
    this.codeMirror.setValue(this._currentCodemirrorValue);
  }

  componentDidUpdate () {
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
      this.codeMirror.setValue(nextProps.value);
    }
    if (typeof nextProps.options === 'object') {
      for (var optionName in nextProps.options) {
        if (nextProps.options.hasOwnProperty(optionName)) {
          this.codeMirror.setOption(optionName, nextProps.options[optionName]);
        }
      }
    }
  }

  focus () {
    if (this.codeMirror) {
      this.codeMirror.focus();
    }
  }

  focusChanged (focused) {
    this.setState({
      isFocused: focused
    });
    this.props.onFocusChange && this.props.onFocusChange(focused);
  }

  codemirrorSetOptions (options) {
    options = Object.assign({
      theme: 'monokai',
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
    }, options || {});

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

  codemirrorValueChanged (doc) {
    if (this._ignoreNextChange) {
      this._ignoreNextChange = false;
      return;
    }

    clearTimeout(this._timeout);
    this._timeout = setTimeout(() => {
      var newValue = doc.getValue();
      this._currentCodemirrorValue = newValue;
      this.props.onChange && this.props.onChange(newValue);
    }, (this.props.debounceMillis || 0));
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
