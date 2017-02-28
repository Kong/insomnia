import React, {PureComponent, PropTypes} from 'react';
import Editor from './Editor';

class OneLineEditor extends PureComponent {
  constructor (props) {
    super(props);
    this.value = props.defaultValue;
  }

  focus () {
    if (!this.editor.hasFocus()) {
      this.editor.focusEnd();
    }
  }

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
    this.props.onKeyDown && this.props.onKeyDown(e);
  };

  _setRef = n => this.editor = n;

  render () {
    const {defaultValue, ...props} = this.props;
    return (
      <Editor
        ref={this._setRef}
        {...props}
        defaultTabBehavior
        hideLineNumbers
        hideScrollbars
        noDragDrop
        noMatchBrackets
        singleLine
        tabIndex={0}
        onKeyDown={this._handleKeyDown}
        onChange={this._handleChange}
        className="editor--single-line"
        value={defaultValue}
        lineWrapping={false}
      />
    )
  }
}

OneLineEditor.propTypes = Object.assign({}, Editor.propTypes, {
  defaultValue: PropTypes.string.isRequired,
});

export default OneLineEditor;
