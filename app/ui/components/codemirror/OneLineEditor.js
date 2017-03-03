import React, {PureComponent, PropTypes} from 'react';
import autobind from 'autobind-decorator';
import Editor from './Editor';
import Input from '../base/DebouncedInput';

const MODE_INPUT = 'input';
const MODE_EDITOR = 'editor';
const TYPE_TEXT = 'text';
const NUNJUCKS_REGEX = /({%|%}|{{|}})/;

@autobind
class OneLineEditor extends PureComponent {
  constructor (props) {
    super(props);

    let mode = MODE_INPUT;

    if (props.forceInput) {
      mode = MODE_INPUT;
    } else if (props.forceEditor) {
      mode = MODE_EDITOR;
    } else if (this._mayContainNunjucks(props.defaultValue)) {
      mode = MODE_EDITOR;
    }

    this.state = {mode};
  }

  focus () {
    if (this.state.mode === MODE_EDITOR) {
      if (!this._editor.hasFocus()) {
        this._editor.focus();
      }
    } else {
      this._input.focus();
    }
  }

  focusEnd () {
    if (this.state.mode === MODE_EDITOR) {
      this._editor.focusEnd();
    } else {
      this._input.focus();
      this._input.value = this._input.value + '';
    }
  }

  selectAll () {
    if (this.state.mode === MODE_EDITOR) {
      this._editor.selectAll();
    } else {
      this._input.select();
    }
  }

  getValue () {
    if (this.state.mode === MODE_EDITOR) {
      return this._editor.getValue();
    } else {
      return this._input.getValue();
    }
  }

  _handleEditorFocus (e) {
    this.props.onFocus && this.props.onFocus(e);
  }

  _handleInputFocus (e) {
    if (this.props.blurOnFocus) {
      e.target.blur();
    } else {
      // If we're focusing the whole thing, blur the input. This happens when
      // the user tabs to the field.
      const start = this._input.getSelectionStart();
      const end = this._input.getSelectionEnd();
      const focusedFromTabEvent = start === 0 && end > 0 && end === e.target.value.length;

      if (focusedFromTabEvent) {
        this._input.focusEnd();
      }
    }

    // Also call the regular callback
    this.props.onFocus && this.props.onFocus(e);
  }

  _handleInputChange (value) {
    if (!this.props.forceInput && this._mayContainNunjucks(value)) {
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
    }

    this.props.onChange && this.props.onChange(value);
  }

  _handleInputKeyDown (e) {
    if (this.props.onKeyDown) {
      this.props.onKeyDown(e, e.target.value);
    }
  }

  _handleEditorBlur () {
    // Clear selection on blur to match default <input> behavior
    this._editor.clearSelection();
    this.props.onBlur && this.props.onBlur();

    if (this.props.forceEditor) {
      return;
    }

    if (this._mayContainNunjucks(this.getValue())) {
      return;
    }

    this.setState({mode: MODE_INPUT});
  }

  _handleEditorKeyDown (e) {
    // submit form if needed
    if (e.keyCode === 13) {
      let node = e.target;
      for (let i = 0; i < 20 && node; i++) {
        if (node.tagName === 'FORM') {
          node.dispatchEvent(new window.Event('submit'));
          break;
        }
        node = node.parentNode;
      }
    }

    // Also call the original if there was one
    this.props.onKeyDown && this.props.onKeyDown(e, this.getValue());
  }

  _setEditorRef (n) {
    this._editor = n;
  }

  _setInputRef (n) {
    this._input = n;
  }

  _mayContainNunjucks (text) {
    return !!text.match(NUNJUCKS_REGEX);
  }

  render () {
    const {
      defaultValue,
      className,
      onChange,
      placeholder,
      onBlur,
      render,
      type: originalType
    } = this.props;

    const {mode} = this.state;

    const type = originalType || TYPE_TEXT;
    const showEditor = type === TYPE_TEXT && mode === MODE_EDITOR;

    if (showEditor) {
      return (
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
          onFocus={this._handleEditorFocus}
          onChange={onChange}
          render={render}
          className="editor--single-line"
          defaultValue={defaultValue}
          lineWrapping={false}
        />
      );
    } else {
      return (
        <Input
          ref={this._setInputRef}
          type={type}
          className={'editor--single-line input ' + className || ''}
          style={{padding: '0 4px', width: '100%'}} // To match CodeMirror
          placeholder={placeholder}
          defaultValue={defaultValue}
          onChange={this._handleInputChange}
          onBlur={onBlur}
          onFocus={this._handleInputFocus}
          onKeyDown={this._handleInputKeyDown}
        />
      );
    }
  }
}

OneLineEditor.propTypes = Object.assign({}, Editor.propTypes, {
  defaultValue: PropTypes.string.isRequired,

  // Optional
  type: PropTypes.string,
  onBlur: PropTypes.func,
  onKeyDown: PropTypes.func,
  onFocus: PropTypes.func,
  onChange: PropTypes.func,
  render: PropTypes.func,
  placeholder: PropTypes.string,
  blurOnFocus: PropTypes.bool,
  forceEditor: PropTypes.bool,
  forceInput: PropTypes.bool
});

export default OneLineEditor;
