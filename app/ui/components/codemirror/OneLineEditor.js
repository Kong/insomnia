import React, {PureComponent, PropTypes} from 'react';
import Editor from './Editor';
import Input from '../base/DebouncedInput';

class OneLineEditor extends PureComponent {
  constructor (props) {
    super(props);
    this.value = props.defaultValue;
    this.state = {forceEditor: false};
  }

  focus () {
    if (this._input) {
      this._input.focus();
    }

    if (this._editor && !this._editor.hasFocus()) {
      this._editor.focusEnd();
    }
  }

  _handleBlur = e => {
    if (this.state.forceEditor) {
      this.setState({forceEditor: false});
    }
  };

  _handleFocus = e => {
    // Force the editor view when it's focused
    if (!this.props.forceInput && !this.state.forceEditor) {
      setTimeout(() => {
        const cursorPosition = this._input.selectionStart();
        this.setState({forceEditor: true});
        const check = () => {
          if (!this._editor) {
            setTimeout(check, 40);
          } else {
            this._editor.focus();
            this._editor.setCursor(cursorPosition);
          }
        };
        check();
      });
    }

    this.props.onFocus && this.props.onFocus(e);
  };

  _handleChange = value => {
    this.value = value;
    this.props.onChange && this.props.onChange(value);
  };

  _handleKeyDown = e => {
    // submit form if needed
    if (e.keyCode === 13) {
      let node = e.target;
      for (let i = 0; i < 20 && node; i++) {
        if (node.tagName === 'FORM') {
          node.dispatchEvent(new Event('submit'));
          break;
        }
        node = node.parentNode;
      }
    }

    // Also call the original if there was one
    this.props.onKeyDown && this.props.onKeyDown(e, this.value);
  };

  _setEditorRef = n => this._editor = n;
  _setInputRef = n => this._input = n;

  _nunjucksRegex = /({%|%}|{{|}})/;

  _matchNunjucks = text => {
    return !!text.match(this._nunjucksRegex);
  };

  render () {
    const {defaultValue, forceInput, className, onBlur, placeholder, onFocus, render} = this.props;
    const {forceEditor} = this.state;
    const shouldBeEditor = forceEditor || (!forceInput && this._matchNunjucks(defaultValue));
    return shouldBeEditor ? (
        <Editor
          ref={this._setEditorRef}
          defaultTabBehavior
          hideLineNumbers
          hideScrollbars
          noDragDrop
          noMatchBrackets
          noStyleActiveLine
          noLint
          singleLine
          tabIndex={0}
          placeholder={placeholder}
          onBlur={this._handleBlur}
          onKeyDown={this._handleKeyDown}
          onChange={this._handleChange}
          onFocus={onFocus}
          render={render}
          className="editor--single-line"
          defaultValue={defaultValue}
          lineWrapping={false}
        />
      ) : (
        <Input
          ref={this._setInputRef}
          type="text"
          className={'editor--single-line input ' + className || ''}
          style={{padding: '0 4px', width: '100%'}} // To match CodeMirror
          placeholder={placeholder}
          defaultValue={defaultValue}
          onChange={this._handleChange}
          onKeyDown={this._handleKeyDown}
          onFocus={this._handleFocus}
          onBlur={onBlur}
        />
      )
  }
}

OneLineEditor.propTypes = Object.assign({}, Editor.propTypes, {
  defaultValue: PropTypes.string.isRequired,

  // Optional
  forceInput: PropTypes.bool,
});

export default OneLineEditor;
