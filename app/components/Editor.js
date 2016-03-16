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
    let options = Object.assign({
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
    }, this.props.options || {});

    if (options.mode === 'application/json') {
      options.mode = 'application/ld+json';
    }

    this.codeMirror = CodeMirror.fromTextArea(textareaNode, options);
    this.codeMirror.on('change', this.codemirrorValueChanged.bind(this));
    this.codeMirror.on('focus', this.focusChanged.bind(this, true));
    this.codeMirror.on('blur', this.focusChanged.bind(this, false));
    this._currentCodemirrorValue = this.props.defaultValue || this.props.value || '';
    this.codeMirror.setValue(this._currentCodemirrorValue);
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

  getCodeMirror () {
    return this.codeMirror;
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

  codemirrorValueChanged (doc, change) {
    var newValue = doc.getValue();
    this._currentCodemirrorValue = newValue;
    this.props.onChange && this.props.onChange(newValue);
  }

  render () {
    return (
      <textarea name={this.props.path}
                ref='textarea'
                defaultValue={this.props.value}
                autoComplete='off'></textarea>
    );
  }
}

Editor.propTypes = {
  onChange: PropTypes.func,
  onFocusChange: PropTypes.func,
  options: PropTypes.object,
  path: PropTypes.string,
  value: PropTypes.string,
  className: PropTypes.any
};

export default Editor;
