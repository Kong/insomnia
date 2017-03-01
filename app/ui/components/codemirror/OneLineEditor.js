import React, {PureComponent, PropTypes} from 'react';
import Editor from './Editor';
import Input from '../base/DebouncedInput';

const MODE_INPUT = 'input';
const MODE_EDITOR = 'editor';
const NUNJUCKS_REGEX = /({%|%}|{{|}})/;

class OneLineEditor extends PureComponent {
  constructor (props) {
    super(props);

    let mode = MODE_INPUT;

    if (props.forceEditor) {
      mode = MODE_EDITOR;
    } else if (this._mayContainNunjucks(props.defaultValue)) {
      mode = MODE_EDITOR;
    }

    this.state = {mode};
  }

  focus () {
    if (this.state.mode === MODE_EDITOR) {
      if (!this._editor.hasFocus()) {
        this._editor.focusEnd();
      }
    } else {
      this._input.focus();
    }

  }

  getValue () {
    if (this.state.mode === MODE_EDITOR) {
      return this._editor.getValue();
    } else {
      return this._input.getValue();
    }
  }

  _handleInputFocus = e => {
    // If we're focusing the whole thing, blur the input. This happens when
    // the user tabs to the field.
    const start = this._input.getSelectionStart();
    const end = this._input.getSelectionEnd();
    const focusedFromTabEvent = start === 0 && end !== 0 && end === e.target.value.length;

    if (focusedFromTabEvent) {
      this._input.focusEnd();
    }

    this._changeToEditorTimeout = setTimeout(() => {
      const start = this._input.getSelectionStart();
      const end = this._input.getSelectionEnd();

      // Wait for the editor to swap and restore cursor position
      const check = () => {
        if (this._editor) {
          this._editor.setSelection(start, end);
        } else {
          setTimeout(check, 40);
        }
      };

      // Tell the component to show the editor
      this.setState({mode: MODE_EDITOR});
      check();
    }, 500);

    // Also call the regular callback
    this.props.onFocus && this.props.onFocus(e);
  };

  _handleInputBlur = e => {
    // If we're currently changing to an editor, stop it!
    clearTimeout(this._changeToEditorTimeout);

    // Also call the regular callback
    this.props.onBlur && this.props.onBlur(e);
  };

  _handleEditorBlur = () => {
    if (this.props.forceEditor) {
      return;
    }

    if (this._mayContainNunjucks(this.getValue())) {
      return;
    }

    this.setState({mode: MODE_INPUT});
  };

  _handleInputKeyDown = e => {
    this.props.onKeyDown && this.props.onKeyDown(e, this.getValue());
  };

  _handleEditorKeyDown = e => {
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
    this.props.onKeyDown && this.props.onKeyDown(e, this.getValue());
  };

  _setEditorRef = n => this._editor = n;
  _setInputRef = n => this._input = n;

  _mayContainNunjucks = text => !!text.match(NUNJUCKS_REGEX);

  render () {
    const {
      defaultValue,
      className,
      onChange,
      placeholder,
      onFocus,
      render
    } = this.props;

    return this.state.mode === MODE_EDITOR ? (
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
          onBlur={this._handleEditorBlur}
          onKeyDown={this._handleEditorKeyDown}
          onChange={onChange}
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
          style={{
            padding: '0 4px',
            width: '100%',
            background: 'rgba(255, 0, 0, 0.1)'
          }} // To match CodeMirror
          placeholder={placeholder}
          defaultValue={defaultValue}
          onChange={onChange}
          onKeyDown={this._handleInputKeyDown}
          onFocus={this._handleInputFocus}
          onBlur={this._handleInputBlur}
        />
      )
  }
}

OneLineEditor.propTypes = Object.assign({}, Editor.propTypes, {
  defaultValue: PropTypes.string.isRequired,

  // Optional
  forceEditor: PropTypes.bool,
});

export default OneLineEditor;
